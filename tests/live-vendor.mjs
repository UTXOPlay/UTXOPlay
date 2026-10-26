// Real local Myelin runtime + Store + vendor adapter; no payment, no production publication.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { ccc } from "@ckb-ccc/shell";
import { createApp } from "../server/index.mjs";
import { createVendorAdapter } from "../vendor/adapter.mjs";
if (!process.env.RUNTIME_TOKEN)
  throw Error(
    "Set RUNTIME_TOKEN for your existing local Myelin Chess runtime.",
  );
const dir = mkdtempSync(path.join(tmpdir(), "utxoplay-live-vendor-"));
const owner = ccc.ClientPublicMainnet.open(),
  signer = new ccc.SignerCkbPrivateKey(
    owner.value,
    "0x" + randomBytes(32).toString("hex"),
  );
const address = await signer.getRecommendedAddress(),
  publicVendor = "https://vendor.example.com";
let adapter, adapterServer, vendorBase;
// Listen first to choose a free local port; mount the real Store with that exact origin.
const { default: express } = await import("express");
const app = express(),
  server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const origin = "http://127.0.0.1:" + server.address().port;
const store = createApp({
  dataDir: dir,
  origin,
  marketplaceOptions: {
    storeAddress: "",
    startWorker: false,
    manifestFetch: async () => {
      const r = await fetch(vendorBase + "/.well-known/utxoplay.json");
      if (!r.ok) throw Error("Real runtime unavailable");
      return r.json();
    },
  },
});
app.use(store.app);
async function api(url, body, cookie = "") {
  const r = await fetch(origin + url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
  };
}
try {
  const challenge = await api("/api/auth/challenge", { address });
  const login = await api(
    "/api/auth/verify",
    {
      id: challenge.data.id,
      proof: await signer.signMessage(challenge.data.message),
    },
    challenge.cookie,
  );
  assert.equal(login.status, 200);
  const p = (
    await api(
      "/api/developer/projects",
      {
        title: "Local runtime integration",
        description: "Disposable integration test",
        controls: "e2e4",
        gameUrl: publicVendor + "/game",
        runtimeUrl: publicVendor,
      },
      login.cookie,
    )
  ).data;
  const key = (
    await api(`/api/developer/projects/${p.id}/key`, {}, login.cookie)
  ).data.key;
  adapter = createVendorAdapter({
    storeOrigin: origin,
    projectId: p.id,
    verificationToken: p.verificationToken,
    vendorKey: key,
    publicOrigin: publicVendor,
    gameUrl: publicVendor + "/game",
    runtimeUrl: process.env.CHESS_URL || "http://127.0.0.1:8781",
    runtimeToken: process.env.RUNTIME_TOKEN,
    myelinVersion: "local-integration",
    sessionSecret: randomBytes(32).toString("hex"),
    webRoot: path.resolve(process.env.VENDOR_TEST_WEB_ROOT || "../myelin-chess/dist/chess"),
    secureCookies: false,
  });
  adapterServer = adapter.app.listen(0, "127.0.0.1");
  await new Promise((r) => adapterServer.once("listening", r));
  adapter.attach(adapterServer);
  vendorBase = "http://127.0.0.1:" + adapterServer.address().port;
  assert.equal(
    (
      await api(
        `/api/developer/projects/${p.id}/publish`,
        { revision: p.revision },
        login.cookie,
      )
    ).status,
    200,
  );
  const guest = await api("/api/guest", {}),
    game = "vendor-" + p.id;
  const ticket = (await api(`/api/games/${game}/launch`, {}, guest.cookie)).data
    .ticket;
  const launch = await fetch(vendorBase + "/utxoplay/launch", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "ticket=" + ticket,
    redirect: "manual",
  });
  assert.equal(launch.status, 303);
  const cookie = launch.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const vapi = async (url, body) => {
    const r = await fetch(vendorBase + "/api" + url, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Origin: publicVendor,
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.equal(r.status, 200);
    return r.json();
  };
  const state = await vapi("/state");
  assert.ok(state.session.id);
  const moved = await vapi("/action", {
    session_id: state.session.id,
    expected_block: state.session.block_hash,
    action: { type: "move", uci: "e2e4" },
  });
  assert.equal(moved.session.actions, 1);
  assert.equal((await vapi("/replay", {})).verified, true);
  assert.equal((await vapi("/export")).blocks.length, 1);
  assert.equal(
    (await fetch(vendorBase + "/game/", { headers: { Cookie: cookie } }))
      .status,
    200,
  );
  assert.equal((await fetch(vendorBase + "/api/state")).status, 401);
  const replay = await fetch(vendorBase + "/utxoplay/launch", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "ticket=" + ticket,
    redirect: "manual",
  });
  assert.equal(replay.status, 401);
  assert.equal(store.db.prepare("SELECT count(*) n FROM orders").get().n, 0);
  console.log(
    "Real vendor integration PASS: cryptographic login, free publication, ready runtime, one-use ticket, authenticated move, Myelin replay/export, protected web root; zero payments.",
  );
} finally {
  adapter?.close();
  if (adapterServer) await new Promise((r) => adapterServer.close(r));
  await new Promise((r) => server.close(r));
  store.close();
  await owner.dispose();
  rmSync(dir, { recursive: true, force: true });
}
