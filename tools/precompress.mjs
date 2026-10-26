import { readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { brotliCompressSync, gzipSync, constants } from "node:zlib";
function compress(root) {
  for (const item of readdirSync(root, { withFileTypes: true })) {
    const file = join(root, item.name);
    if (item.isDirectory()) {
      if (item.name !== ".vite") compress(file);
      continue;
    }
    if (!/\.(?:js|mjs|css|json|svg|html)$/.test(file)) continue;
    for (const suffix of [".br", ".gz"]) rmSync(file + suffix, { force: true });
    const input = readFileSync(file);
    if (input.length < 1024) continue;
    const br = brotliCompressSync(input, {
        params: { [constants.BROTLI_PARAM_QUALITY]: 9 },
      }),
      gz = gzipSync(input, { level: 9 });
    if (br.length < input.length) writeFileSync(file + ".br", br);
    if (gz.length < input.length) writeFileSync(file + ".gz", gz);
  }
}
compress("dist");
