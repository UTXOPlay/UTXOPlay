import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { optimizedStatic } from "../server/static.mjs";
test("precompressed assets preserve contents, negotiation, revalidation and range requests", async () => {
  const dir = mkdtempSync(join(tmpdir(), "utxoplay-static-"));
  const source = 'console.log("play");\n'.repeat(100);
  for (const file of ["app.js", "index-abcdefgh.js"]) {
    writeFileSync(join(dir, file), source);
    writeFileSync(join(dir, file + ".br"), brotliCompressSync(source));
    writeFileSync(join(dir, file + ".gz"), gzipSync(source));
  }
  const app = express();
  app.use(optimizedStatic(dir));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    for (const [accept, encoding] of [
      ["br, gzip", "br"],
      ["gzip;q=1, br;q=0.2", "gzip"],
      ["br;q=0, gzip;q=0", ""],
      ["identity", ""],
    ]) {
      const response = await fetch(base + "/app.js", {
        headers: { "Accept-Encoding": accept },
      });
      assert.equal(response.headers.get("Content-Encoding") || "", encoding);
      assert.equal(await response.text(), source);
      assert.match(response.headers.get("Vary"), /Accept-Encoding/);
      assert.equal(response.headers.get("Cache-Control"), "no-cache");
      assert.match(response.headers.get("Content-Type"), /javascript/);
    }
    const immutable = await fetch(base + "/index-abcdefgh.js");
    assert.match(immutable.headers.get("Cache-Control"), /immutable/);
    const first = await fetch(base + "/app.js", {
      headers: { "Accept-Encoding": "br" },
    });
    await first.text();
    const unchanged = await fetch(base + "/app.js", {
      headers: {
        "Accept-Encoding": "br",
        "Cache-Control": "max-age=0",
        "If-None-Match": first.headers.get("etag"),
      },
    });
    assert.equal(unchanged.status, 304);
    const range = await fetch(base + "/app.js", {
      headers: { "Accept-Encoding": "br", Range: "bytes=0-6" },
    });
    assert.equal(range.status, 206);
    assert.equal(range.headers.get("Content-Encoding"), null);
    assert.equal(await range.text(), source.slice(0, 7));
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(dir, { recursive: true, force: true });
  }
});
