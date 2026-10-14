import assert from "node:assert/strict";
import test from "node:test";
import { createAiHandlers, type AiAccess, type AiDependencies } from "../lib/server/ai-handler";
import { AI_MAX_FILE_BYTES } from "../lib/ai/extraction";
import type { AiDraftRequest, AiExtraction, AiExtractionContext, AiSource, AiWorkspace } from "../lib/ai/types";
import type { AiConfiguration, AiDocument } from "../lib/server/ai-provider";

const config: AiConfiguration = {
  configured: true, apiKey: "fake-key", baseURL: "https://example.invalid/v1", model: "fake-model",
  protocol: "responses", filesEnabled: true, structuredOutputs: true,
};
const draftRequest = (patch: Partial<AiDraftRequest> = {}): AiDraftRequest => ({
  mode: "answer", question: "온실가스 배출량을 설명해 주세요.", company: "A", year: 2026, ...patch,
});
const extractionContext = (patch: Partial<AiExtractionContext> = {}): AiExtractionContext => ({
  mode: "extract", company: "A", year: 2026, targetLabel: "전력 사용량", expectedUnit: "kWh",
  period: "2026-01", site: "본사", ...patch,
});
const extraction: AiExtraction = {
  company: "A", site: "본사", periodFrom: "2026-01-01", periodTo: "2026-01-31",
  metricName: "전력 사용량", amount: 0, unit: "kWh", sourceExcerpt: "사용량 0 kWh", sourcePage: 1, notes: [],
};
const pdf = new TextEncoder().encode("%PDF-1.7\nfixture");
const workspace = (patch: Partial<AiWorkspace> = {}): AiWorkspace => ({
  organizations: { A: ["본사"] },
  records: [{ id: 1, company: "A", site: "본사", period: "2026-01", scope: "Scope 2", emissions: 10, status: "확정", active: true }],
  metricSubmissions: [], evidence: [], indicators: [], targets: [], reports: [], ...patch,
});

function harness(options: {
  profile?: Partial<AiAccess["profile"]>;
  workspace?: Partial<AiWorkspace>;
  configuration?: Partial<AiConfiguration>;
  draft?: AiDependencies["draft"];
  extract?: AiDependencies["extract"];
  download?: AiDependencies["download"];
  allowRequest?: AiDependencies["allowRequest"];
  saveAnswer?: AiDependencies["saveAnswer"];
  loadWorkspace?: AiDependencies["loadWorkspace"];
} = {}) {
  const payload = workspace(options.workspace);
  const calls = { draft: [] as { input: AiDraftRequest; sources: AiSource[]; files: AiDocument[] }[], extract: [] as { context: AiExtractionContext; file: AiDocument }[], download: 0 };
  const deps: AiDependencies = {
    loadWorkspace: options.loadWorkspace ?? (async request => request.headers.get("authorization") === "Bearer fake-token"
      ? { profile: { id: "user-A", role: "editor", active: true, organization: { name: "A" }, site: { name: "본사" }, ...options.profile }, payload }
      : Response.json({ error: "로그인이 필요합니다." }, { status: 401 })),
    config: () => ({ ...config, ...options.configuration }),
    draft: async (...args) => {
      const [, input, sources, files] = args;
      calls.draft.push({ input, sources, files });
      if (options.draft) return options.draft(...args);
      return { text: `확인한 자료입니다. [근거: ${sources[0].id}]`, sourceIds: [sources[0].id], gaps: [] };
    },
    extract: async (...args) => {
      calls.extract.push({ context: args[1], file: args[2] });
      return options.extract ? options.extract(...args) : { ...extraction, notes: [] };
    },
    download: async (...args) => {
      calls.download++;
      return options.download ? options.download(...args) : null;
    },
    ...(options.saveAnswer ? { saveAnswer: options.saveAnswer } : {}),
    ...(options.allowRequest ? { allowRequest: options.allowRequest } : {}),
  };
  return { handlers: createAiHandlers(deps), calls, payload };
}

function jsonRequest(body: unknown, authenticated = true) {
  return new Request("https://example.invalid/api/ai", {
    method: "POST", headers: { "Content-Type": "application/json", ...(authenticated ? { Authorization: "Bearer fake-token" } : {}) },
    body: JSON.stringify(body),
  });
}
function fileRequest(context: unknown = extractionContext(), bytes: Uint8Array = pdf, type = "application/pdf", name = "usage.pdf") {
  const form = new FormData();
  form.set("context", JSON.stringify(context));
  form.set("file", new File([Uint8Array.from(bytes)], name, { type }));
  return new Request("https://example.invalid/api/ai", { method: "POST", headers: { Authorization: "Bearer fake-token" }, body: form });
}
async function assertError(response: Response, status: number, code: string) {
  assert.equal(response.status, status);
  assert.equal((await response.json()).code, code);
}

test("authentication is required and inactive or unknown-role accounts cannot use AI", async () => {
  const anonymous = harness();
  assert.equal((await anonymous.handlers.POST(jsonRequest(draftRequest(), false))).status, 401);
  assert.equal((await anonymous.handlers.GET(new Request("https://example.invalid/api/ai"))).status, 401);
  assert.equal(anonymous.calls.draft.length, 0);
  for (const profile of [{ active: false }, { role: "unsupported-role" }]) {
    const client = harness({ profile });
    await assertError(await client.handlers.POST(jsonRequest(draftRequest())), 403, "AI_FORBIDDEN");
    assert.equal(client.calls.draft.length, 0);
  }
});

test("status lookup failures return a safe JSON error instead of a raw authentication error", async () => {
  const client = harness({ loadWorkspace: async () => { throw new Error("fake-key internal-auth-debug"); } });
  const response = await client.handlers.GET(new Request("https://example.invalid/api/ai"));
  const body = await response.text();
  assert.equal(response.status, 502);
  assert.equal(JSON.parse(body).code, "AI_STATUS_FAILED");
  assert.ok(!body.includes("fake-key"));
  assert.ok(!body.includes("internal-auth-debug"));
});

test("configuration status exposes only readiness flags and never credentials", async () => {
  const client = harness({ configuration: { filesEnabled: false } });
  const response = await client.handlers.GET(new Request("https://example.invalid/api/ai", { headers: { Authorization: "Bearer fake-token" } }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { configured: true, filesEnabled: false });
  const disabled = harness({ configuration: { configured: false } });
  await assertError(await disabled.handlers.POST(jsonRequest(draftRequest())), 503, "AI_NOT_CONFIGURED");
  assert.equal(disabled.calls.draft.length, 0);
});

test("an editor cannot request another company even when it appears in the authorized fixture metadata", async () => {
  const client = harness({ workspace: { organizations: { A: ["본사"], B: ["공장"] } } });
  await assertError(await client.handlers.POST(jsonRequest(draftRequest({ company: "B" }))), 403, "AI_SCOPE_FORBIDDEN");
  assert.equal(client.calls.draft.length, 0);
});

test("an empty company resolves to the account's own company for editors and viewers", async () => {
  for (const role of ["editor", "viewer"]) {
    const client = harness({ profile: { role } });
    const response = await client.handlers.POST(jsonRequest(draftRequest({ company: "" })));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).scope, { company: "A", year: 2026 });
    assert.equal(client.calls.draft[0].input.company, "A");
    assert.ok(client.calls.draft[0].sources.every(source => source.company === "A"));
  }
});

test("administrators and legacy managers can query their available company scope", async () => {
  for (const role of ["admin", "manager"]) {
    const client = harness({ profile: { role }, workspace: {
      organizations: { A: ["본사"], B: ["공장"] },
      records: [
        { id: 1, company: "A", period: "2026-01", scope: "Scope 2", emissions: 10, status: "확정" },
        { id: 2, company: "B", period: "2026-01", scope: "Scope 2", emissions: 20, status: "확정" },
      ],
    } });
    const response = await client.handlers.POST(jsonRequest(draftRequest({ company: "" })));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).scope.company, "");
    assert.equal(JSON.parse(client.calls.draft[0].sources[0].excerpt).배출량, 30);
  }
});

test("request schemas reject client workspace facts, model overrides, and wrongly typed fields", async () => {
  const client = harness();
  for (const body of [
    { ...draftRequest(), workspace: { records: [{ emissions: 999 }] } },
    { ...draftRequest(), model: "client-selected-model" },
    { ...draftRequest(), year: "2026" },
    { ...draftRequest(), year: 2026.5 },
    { ...draftRequest(), indicatorId: "10004" },
    { ...draftRequest(), question: "   " },
    { ...draftRequest(), mode: "extract" },
  ]) await assertError(await client.handlers.POST(jsonRequest(body)), 400, "AI_INVALID_REQUEST");
  assert.equal(client.calls.draft.length, 0);
});

test("invalid JSON is rejected before any provider call", async () => {
  const client = harness();
  const request = new Request("https://example.invalid/api/ai", { method: "POST", headers: { Authorization: "Bearer fake-token", "Content-Type": "application/json" }, body: "{" });
  await assertError(await client.handlers.POST(request), 400, "AI_INVALID_JSON");
  assert.equal(client.calls.draft.length, 0);
});

test("guide mode restores active default definitions but rejects saved inactive and missing indicators", async () => {
  const active = harness({ workspace: { records: [] } });
  assert.equal((await active.handlers.POST(jsonRequest(draftRequest({ mode: "guide", indicatorId: 10004 })))).status, 200);
  assert.equal(active.calls.draft[0].sources.length, 1);
  assert.equal(active.calls.draft[0].sources[0].kind, "indicator");
  assert.match(active.calls.draft[0].sources[0].excerpt, /에너지 소비량/);
  const inactive = harness({ workspace: { indicators: [{ id: 10004, code: "ENV-ENERGY", name: "에너지 소비량", active: false, frameworks: [] }] } });
  await assertError(await inactive.handlers.POST(jsonRequest(draftRequest({ mode: "guide", indicatorId: 10004 }))), 404, "AI_INDICATOR_NOT_FOUND");
  await assertError(await inactive.handlers.POST(jsonRequest(draftRequest({ mode: "guide", indicatorId: 999999 }))), 404, "AI_INDICATOR_NOT_FOUND");
  assert.equal(inactive.calls.draft.length, 0);
});

test("a year without current or prior-year facts returns gaps without contacting the provider", async () => {
  const client = harness();
  const response = await client.handlers.POST(jsonRequest(draftRequest({ year: 2030 })));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.sources, []);
  assert.ok(result.gaps.length > 0);
  assert.match(result.text, /확정자료/);
  assert.equal(client.calls.draft.length, 0);
  assert.equal(client.calls.download, 0);
});

test("pending records and submissions cannot serve as confirmed performance facts", async () => {
  const client = harness({ workspace: {
    records: [{ id: 1, company: "A", period: "2026-01", scope: "Scope 2", emissions: 999, status: "검토대기" }],
    metricSubmissions: [{ id: 1, indicatorId: 10004, company: "A", site: "본사", period: "2026-01", value: 999, status: "작성중" }],
  } });
  const response = await client.handlers.POST(jsonRequest(draftRequest()));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.sources, []);
  assert.ok(result.warnings.length > 0);
  assert.equal(client.calls.draft.length, 0);
});

test("report drafts require a saved report with the selected company", async () => {
  const client = harness({ workspace: { reports: [{ id: "report-A", organization: "A", year: 2026 }, { id: "report-B", organization: "B", year: 2026 }] } });
  await assertError(await client.handlers.POST(jsonRequest(draftRequest({ mode: "report", reportId: "missing" }))), 404, "AI_REPORT_NOT_FOUND");
  await assertError(await client.handlers.POST(jsonRequest(draftRequest({ mode: "report", reportId: "report-B" }))), 400, "AI_REPORT_SCOPE_MISMATCH");
  assert.equal(client.calls.draft.length, 0);
  assert.equal((await client.handlers.POST(jsonRequest(draftRequest({ mode: "report", reportId: "report-A" })))).status, 200);
  assert.equal(client.calls.draft.length, 1);
});

test("hallucinated references are rejected in both reference arrays and inline citations", async () => {
  const drafts: AiDependencies["draft"][] = [
    async (_config, _request, sources) => ({ text: "설명 [99]", sourceIds: [sources[0].id], gaps: [] }),
    async () => ({ text: "설명", sourceIds: ["invented-source"], gaps: [] }),
    async (_config, _request, sources) => ({ text: "설명 [근거: invented-source]", sourceIds: [sources[0].id], gaps: [] }),
    async () => ({ text: "근거 없는 설명", sourceIds: [], gaps: [] }),
  ];
  for (const draft of drafts) {
    const client = harness({ draft });
    await assertError(await client.handlers.POST(jsonRequest(draftRequest())), 502, "AI_GENERATION_FAILED");
  }
});

test("validated inline references are numbered and deduplicated in the response", async () => {
  const client = harness({ draft: async (_config, _request, sources) => ({
    text: `실적 [근거: ${sources[0].id}] 다시 확인 [근거: ${sources[0].id}]`, sourceIds: [sources[0].id], gaps: ["원인 확인 필요"],
  }) });
  const response = await client.handlers.POST(jsonRequest(draftRequest()));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.text, "실적 [1] 다시 확인 [1]");
  assert.equal(result.sources.length, 1);
  assert.deepEqual(result.gaps, ["원인 확인 필요"]);
});

test("raw provider errors and fake credentials never appear in browser error responses", async () => {
  const client = harness({ draft: async () => { throw new Error("provider debug: fake-key raw-provider-body"); } });
  const response = await client.handlers.POST(jsonRequest(draftRequest()));
  const body = await response.text();
  assert.equal(response.status, 502);
  assert.ok(!body.includes("fake-key"));
  assert.ok(!body.includes("raw-provider-body"));
  assert.equal(JSON.parse(body).code, "AI_GENERATION_FAILED");
});

test("rate limiting stops additional requests before a provider call", async () => {
  const ids: string[] = [];
  const client = harness({ allowRequest: userId => { ids.push(userId); return ids.length === 1; } });
  assert.equal((await client.handlers.POST(jsonRequest(draftRequest()))).status, 200);
  await assertError(await client.handlers.POST(jsonRequest(draftRequest())), 429, "AI_RATE_LIMIT");
  assert.deepEqual(ids, ["user-A", "user-A"]);
  assert.equal(client.calls.draft.length, 1);
});

test("document extraction requires write access and an enabled document provider", async () => {
  const viewer = harness({ profile: { role: "viewer" } });
  await assertError(await viewer.handlers.POST(fileRequest()), 403, "AI_FORBIDDEN");
  assert.equal(viewer.calls.extract.length, 0);
  const noDocuments = harness({ configuration: { filesEnabled: false } });
  await assertError(await noDocuments.handlers.POST(fileRequest()), 422, "AI_DOCUMENTS_DISABLED");
  assert.equal(noDocuments.calls.extract.length, 0);
  assert.equal((await noDocuments.handlers.POST(jsonRequest(draftRequest()))).status, 200);
});

test("extraction checks company, site, indicator, and context schema before reading a file", async () => {
  const client = harness({ workspace: { organizations: { A: ["본사"], B: ["공장"] } } });
  await assertError(await client.handlers.POST(fileRequest(extractionContext({ company: "B" }))), 403, "AI_SCOPE_FORBIDDEN");
  await assertError(await client.handlers.POST(fileRequest(extractionContext({ site: "다른 사업장" }))), 403, "AI_SCOPE_FORBIDDEN");
  await assertError(await client.handlers.POST(fileRequest(extractionContext({ indicatorId: 999999 }))), 404, "AI_INDICATOR_NOT_FOUND");
  await assertError(await client.handlers.POST(fileRequest({ ...extractionContext(), model: "override" })), 400, "AI_INVALID_REQUEST");
  await assertError(await client.handlers.POST(fileRequest({ ...extractionContext(), period: "2026-13" })), 400, "AI_INVALID_REQUEST");
  assert.equal(client.calls.extract.length, 0);
});

test("unsupported signatures, mislabeled HTML, and oversized files never reach extraction", async () => {
  const client = harness();
  const html = new TextEncoder().encode("<!doctype html><html>not a PDF</html>");
  await assertError(await client.handlers.POST(fileRequest(extractionContext(), html, "application/pdf")), 415, "AI_UNSUPPORTED_FILE");
  await assertError(await client.handlers.POST(fileRequest(extractionContext(), pdf, "text/csv", "usage.csv")), 415, "AI_UNSUPPORTED_FILE");
  await assertError(await client.handlers.POST(fileRequest(extractionContext(), new Uint8Array())), 413, "AI_FILE_TOO_LARGE");
  const large = new Uint8Array(AI_MAX_FILE_BYTES + 1);
  large.set(pdf);
  await assertError(await client.handlers.POST(fileRequest(extractionContext(), large)), 413, "AI_FILE_TOO_LARGE");
  assert.equal(client.calls.extract.length, 0);
});

test("valid extraction returns explicit zero and preserves period and site context without saving", async () => {
  const client = harness();
  const before = structuredClone(client.payload);
  const response = await client.handlers.POST(fileRequest(extractionContext({ company: "" })));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.extraction.amount, 0);
  assert.equal(result.fileName, "usage.pdf");
  assert.deepEqual(result.scope, { company: "A", year: 2026 });
  assert.equal(client.calls.extract[0].context.company, "A");
  assert.equal(client.calls.extract[0].context.period, "2026-01");
  assert.equal(client.calls.extract[0].context.site, "본사");
  assert.deepEqual(client.payload, before);
  assert.equal(client.calls.draft.length, 0);
});

test("draft generation has no workspace-writing dependency and leaves server data unchanged", async () => {
  const client = harness();
  const before = structuredClone(client.payload);
  const response = await client.handlers.POST(jsonRequest(draftRequest()));
  assert.equal(response.status, 200);
  assert.equal(client.calls.draft.length, 1);
  assert.deepEqual(client.payload, before);
});


test("answers save server-validated result under authenticated account; reports do not save", async () => {
  const saved: { user: string; question: string; text: string }[] = [];
  const { handlers } = harness({ saveAnswer: async (_request, access, question, result) => {
    saved.push({ user: access.profile.id, question, text: result.text });
    assert.equal(result.scope.company, "A");
    assert.ok(result.sources.length > 0);
  } });
  assert.equal((await handlers.POST(jsonRequest(draftRequest()))).status, 200);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].user, "user-A");
  assert.equal(saved[0].question, draftRequest().question);
  await handlers.POST(jsonRequest(draftRequest({ mode: "report" })));
  await handlers.POST(jsonRequest(draftRequest(), false));
  assert.equal(saved.length, 1);
});

test("history save failure preserves generated answer with explicit warning", async () => {
  const { handlers } = harness({ saveAnswer: async () => { throw new Error("secret database detail"); } });
  const response = await handlers.POST(jsonRequest(draftRequest()));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.match(result.text, /확인한 자료/);
  assert.match(result.warnings.join(), /서버 기록 저장에 실패/);
  assert.ok(!JSON.stringify(result).includes("secret database detail"));
});
