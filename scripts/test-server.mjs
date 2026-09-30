import assert from "node:assert/strict";
import { cpSync } from "node:fs";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

// Runs against a local production build with no production credentials.
const standalone = process.argv.includes("--standalone");
if (standalone) {
  cpSync("public", ".next/standalone/public", { recursive: true });
  cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
}
const socket = createServer();
await new Promise((resolve, reject) => { socket.once("error", reject); socket.listen(0, "127.0.0.1", resolve); });
const port = String(socket.address().port);
await new Promise(resolve => socket.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const args = standalone ? [".next/standalone/server.js"] : ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", port];
const child = spawn(process.execPath, args, {
  env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: port, SUPABASE_SERVICE_ROLE_KEY: "", NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", chunk => { output += chunk; });
child.stderr.on("data", chunk => { output += chunk; });
let spawnError;
child.on("error", error => { spawnError = error; });
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error("Server exited before becoming ready");
    try {
      const response = await fetch(`${origin}/api/live`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch { /* The socket is not available until startup completes. */ }
    await delay(500);
  }
  assert.ok(ready, "Production server must start");
  const live = await fetch(`${origin}/api/live`);
  assert.deepEqual(await live.json(), { status: "ok" });
  assert.match(live.headers.get("cache-control") ?? "", /no-store/);
  for (const route of ["/api/workspace", "/api/admin/users"]) {
    assert.equal((await fetch(origin + route)).status, 401, `Unauthenticated ${route} must be blocked`);
  }
  const page = await fetch(origin);
  assert.equal(page.status, 200);
  const html = await page.text();
  const assets = [...html.matchAll(/(?:src|href)="([^"]*\/_next\/static\/[^"]+)"/g)].map(match => match[1]);
  assert.ok(assets.length > 0, "Page must include compiled assets");
  for (const asset of new Set(assets)) {
    assert.equal((await fetch(new URL(asset.replaceAll("&amp;", "&"), origin))).status, 200, asset);
  }
  console.log("Production server passed: liveness, unauthorized APIs, page and static assets.");
} catch (error) {
  console.error(output);
  throw error;
} finally {
  child.kill();
}
