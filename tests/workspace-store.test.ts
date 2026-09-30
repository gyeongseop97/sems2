import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createWorkspaceStore } from "../lib/server/workspace-store";

function fixture(response: unknown = [], status = 200) {
  const requests: { url: URL; init: RequestInit | undefined }[] = [];
  const client = createClient("https://example.supabase.co", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        requests.push({ url: new URL(String(input)), init });
        return new Response(JSON.stringify(response), { status, headers: { "Content-Type": "application/json" } });
      },
    },
  });
  return { store: createWorkspaceStore(client), requests };
}

test("workspace reads retain the explicit organization scope and revision field", async () => {
  const { store, requests } = fixture();
  await store.readStates(["global", "organization:one"]);
  assert.equal(requests[0].url.searchParams.get("scope_key"), "in.(global,organization:one)");
  assert.equal(requests[0].url.searchParams.get("select"), "scope_key,organization_id,payload,revision");
  await store.readStates();
  assert.equal(requests[1].url.searchParams.has("scope_key"), false);
});

test("receipt lookup binds both actor and mutation", async () => {
  const { store, requests } = fixture(null);
  await store.readReceipt("actor-one", "mutation-one");
  assert.equal(requests[0].url.searchParams.get("actor_id"), "eq.actor-one");
  assert.equal(requests[0].url.searchParams.get("mutation_id"), "eq.mutation-one");
});

test("save remains one atomic RPC carrying revisions, actor and idempotency key", async () => {
  const receipt = { conflict: true, scopes: ["global"] };
  const { store, requests } = fixture(receipt);
  const states = [{ scope_key: "global", payload: { records: [] } }];
  const result = await store.saveChecked(states, { global: 3 }, "actor", "mutation");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.pathname, "/rest/v1/rpc/save_workspace_checked");
  assert.equal(requests[0].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {
    p_expected: { global: 3 }, p_states: states, p_actor_id: "actor", p_mutation_id: "mutation",
  });
  assert.deepEqual(result.data, receipt);
});

test("history keeps descending pagination and the extra next-page record", async () => {
  const { store, requests } = fixture();
  await store.readHistory("100");
  assert.equal(requests[0].url.searchParams.get("id"), "lt.100");
  assert.equal(requests[0].url.searchParams.get("order"), "id.desc");
  assert.equal(requests[0].url.searchParams.get("limit"), "101");
});

test("database errors reach the caller instead of becoming a successful empty read", async () => {
  const { store } = fixture({ message: "missing revision", code: "42703" }, 400);
  const result = await store.readStates(["global"]);
  assert.equal(result.error?.code, "42703");
  await assert.rejects(() => store.readOrganizationDirectory(), /missing revision/);
});
