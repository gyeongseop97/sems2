import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/health/route";

test("health verifies server database access without reading records or exposing secrets", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co/";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  globalThis.fetch = async () => { throw new Error("missing configuration must not issue a request"); };
  const unconfigured = await GET();
  assert.equal(unconfigured.status, 503);
  assert.equal((await unconfigured.json()).supabase, "not_configured");

  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-server-only-key";
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/rest/v1/workspace_states");
    assert.equal(url.searchParams.get("limit"), "0");
    assert.equal(url.searchParams.get("select"), "scope_key");
    assert.equal(init?.method ?? "GET", "GET");
    assert.equal(new Headers(init?.headers).get("apikey"), "test-server-only-key");
    assert.equal(init?.cache, "no-store");
    assert.ok(init?.signal);
    return new Response("[]", { status: 200 });
  };
  const healthy = await GET();
  assert.equal(healthy.status, 200);
  assert.deepEqual(await healthy.json(), { status: "ok", app: "ok", supabase: "connected", supabaseStatus: 200 });

  globalThis.fetch = async () => new Response("private database error", { status: 401 });
  const rejected = await GET();
  assert.equal(rejected.status, 503);
  const rejectedText = await rejected.text();
  assert.doesNotMatch(rejectedText, /test-server-only-key|private database error/);
  assert.equal(JSON.parse(rejectedText).supabaseStatus, 401);

  globalThis.fetch = async () => { throw new Error("secret connection detail"); };
  const unavailable = await GET();
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { status: "degraded", app: "ok", supabase: "connection_failed" });
});
