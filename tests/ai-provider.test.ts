import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import {
  extractAiDocument,
  generateAiDraft,
  readAiConfiguration,
  type AiConfiguration,
  type AiDocument,
} from "../lib/server/ai-provider";
import type { AiDraftRequest, AiExtraction, AiExtractionContext, AiSource } from "../lib/ai/types";

type CapturedRequest = { url: string; headers: Headers; body: Record<string, unknown> };
type ContentPart = Record<string, unknown>;

const fakeKey = "test-only-provider-key";
const draftRequest: AiDraftRequest = {
  mode: "answer", company: "세원정공", year: 2026, question: "확정된 전력 사용량을 설명해 주세요.",
};
const sources: AiSource[] = [{
  id: "metric-electricity-2026", kind: "metric", title: "전력 사용량",
  excerpt: "2026년 확정 자료: 42 MWh", company: "세원정공", period: "2026",
}];
const draft = {
  text: "전력 사용량은 42 MWh입니다. [근거: metric-electricity-2026]",
  sourceIds: [sources[0].id], gaps: ["자료 미입력 월은 별도로 확인해 주세요."],
};
const extractionContext: AiExtractionContext = {
  mode: "extract", company: "세원정공", year: 2026, targetLabel: "전력 사용량",
  expectedUnit: "kWh", period: "2026-09",
};
const extraction: AiExtraction = {
  company: "세원정공", site: null, periodFrom: "2026-09", periodTo: "2026-09",
  metricName: "전력 사용량", amount: 42000, unit: "kWh",
  sourceExcerpt: "사용량 42,000 kWh", sourcePage: 1, notes: [],
};
const image: AiDocument = {
  bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
  mediaType: "image/png", filename: "고지서.png", sourceId: "evidence-1",
};
const pdf: AiDocument = {
  bytes: new TextEncoder().encode("%PDF-1.7\nfixture-only\n%%EOF"),
  mediaType: "application/pdf", filename: "전력고지서.pdf", sourceId: "evidence-2",
};

function chatConfig(overrides: Record<string, string> = {}): AiConfiguration {
  return readAiConfiguration({
    SEMS_AI_API_KEY: fakeKey, SEMS_AI_MODEL: "external/model-name",
    SEMS_AI_BASE_URL: "https://gateway.example.test/v1", ...overrides,
  });
}

function responsesConfig(): AiConfiguration {
  return readAiConfiguration({ SEMS_AI_API_KEY: fakeKey, SEMS_AI_MODEL: "gpt-4.1-mini" });
}

function chatResponse(content: string) {
  return {
    id: "chatcmpl-fixture", created: 1, model: "fixture-model",
    choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  };
}

function responsesResponse(content: string) {
  return {
    id: "resp_fixture", created_at: 1, model: "gpt-4.1-mini",
    output: [{
      type: "message", id: "msg_fixture", role: "assistant",
      content: [{ type: "output_text", text: content, annotations: [] }],
    }],
    usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
  };
}

// Mock the actual SDK transport, not generateText: these tests exercise provider
// URL/header/body serialization and the SDK's response parser without networking.
function fakeFetch(t: TestContext, protocol: "chat" | "responses", content: string, status = 200) {
  const calls: CapturedRequest[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    assert.equal(typeof init?.body, "string", "AI calls must use a JSON request body");
    const body = JSON.parse(init!.body as string) as Record<string, unknown>;
    calls.push({ url, headers: new Headers(init?.headers), body });
    const reply = status >= 400
      ? { error: { message: "fixture rejected request", type: "invalid_request_error", code: "invalid_request" } }
      : protocol === "chat" ? chatResponse(content) : responsesResponse(content);
    return new Response(JSON.stringify(reply), { status, headers: { "Content-Type": "application/json" } });
  });
  return calls;
}

function contentParts(body: Record<string, unknown>, key: "messages" | "input"): ContentPart[] {
  assert(Array.isArray(body[key]));
  const messages = body[key] as { content?: string | ContentPart[] }[];
  return messages.flatMap(message => Array.isArray(message.content) ? message.content : []);
}

test("AI configuration requires an explicit model and rejects unsafe URL forms", () => {
  assert.equal(readAiConfiguration({}).configured, false);
  assert.equal(readAiConfiguration({ SEMS_AI_API_KEY: fakeKey }).configured, false);
  const fallback = readAiConfiguration({ OPENAI_API_KEY: ` ${fakeKey} `, SEMS_AI_MODEL: " gpt-4.1-mini " });
  assert.equal(fallback.configured, true);
  assert.equal(fallback.apiKey, fakeKey);
  assert.equal(fallback.model, "gpt-4.1-mini");
  assert.equal(fallback.protocol, "responses");
  for (const url of ["http://gateway.example.test/v1", "https://user:password@gateway.example.test/v1", "https://gateway.example.test/v1?key=secret", "https://gateway.example.test/v1#fragment", "not-a-url"]) {
    assert.equal(chatConfig({ SEMS_AI_BASE_URL: url }).configured, false, url);
  }
});

test("document and structured-output flags can explicitly disable unsupported capabilities", () => {
  const config = readAiConfiguration({ SEMS_AI_API_KEY: fakeKey, SEMS_AI_MODEL: "text-only-model",
    SEMS_AI_PROTOCOL: "responses", SEMS_AI_FILES_ENABLED: "false", SEMS_AI_STRUCTURED_OUTPUTS: "false" });
  assert.equal(config.configured, true);
  assert.equal(config.filesEnabled, false);
  assert.equal(config.structuredOutputs, false);
});

test("external chat calls retain the configured base URL, Bearer key, model and ordinary token field", async t => {
  const config = chatConfig({ SEMS_AI_BASE_URL: " https://gateway.example.test/custom/v1/// " });
  assert.equal(config.protocol, "chat");
  assert.equal(config.filesEnabled, false);
  assert.equal(config.structuredOutputs, false);
  const calls = fakeFetch(t, "chat", JSON.stringify(draft));
  assert.deepEqual(await generateAiDraft(config, draftRequest, sources, [], new AbortController().signal), draft);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://gateway.example.test/custom/v1/chat/completions");
  assert.equal(calls[0].headers.get("authorization"), `Bearer ${fakeKey}`);
  assert.equal(calls[0].body.model, config.model);
  assert.equal(calls[0].body.max_tokens, 3000);
  assert.equal(calls[0].body.max_completion_tokens, undefined);
  assert.equal(calls[0].body.response_format, undefined);
  assert(!JSON.stringify(calls[0].body).includes(fakeKey), "the API key must stay out of model context");
});

test("MonoRouter receives max_completion_tokens rather than the incompatible max_tokens for draft and extraction", async t => {
  const config = chatConfig({ SEMS_AI_BASE_URL: "https://monogpt.kr/api/monorouter/v1/", SEMS_AI_FILES_ENABLED: "true" });
  assert.equal(config.chatTokenField, "max_completion_tokens");
  const calls = fakeFetch(t, "chat", JSON.stringify(draft));
  await generateAiDraft(config, draftRequest, sources, [], new AbortController().signal);
  assert.equal(calls[0].url, "https://monogpt.kr/api/monorouter/v1/chat/completions");
  assert.equal(calls[0].headers.get("authorization"), `Bearer ${fakeKey}`);
  assert.equal(calls[0].body.max_completion_tokens, 3000);
  assert.equal(calls[0].body.max_tokens, undefined);

  t.mock.restoreAll();
  const extractionCalls = fakeFetch(t, "chat", JSON.stringify(extraction));
  assert.deepEqual(await extractAiDocument(config, extractionContext, image, new AbortController().signal), extraction);
  assert.equal(extractionCalls[0].body.max_completion_tokens, 1800);
  assert.equal(extractionCalls[0].body.max_tokens, undefined);
});

test("explicit token-field overrides work without treating every external gateway as MonoRouter", async t => {
  const calls = fakeFetch(t, "chat", JSON.stringify(draft));
  await generateAiDraft(chatConfig({ SEMS_AI_CHAT_TOKEN_FIELD: "max_completion_tokens" }), draftRequest, sources, [], new AbortController().signal);
  assert.equal(calls[0].body.max_completion_tokens, 3000);
  assert.equal(calls[0].body.max_tokens, undefined);
  await generateAiDraft(chatConfig({ SEMS_AI_BASE_URL: "https://monogpt.kr/api/monorouter/v1", SEMS_AI_CHAT_TOKEN_FIELD: "max_tokens" }), draftRequest, sources, [], new AbortController().signal);
  assert.equal(calls[1].body.max_tokens, 3000);
  assert.equal(calls[1].body.max_completion_tokens, undefined);
});

test("generic chat accepts a complete fenced JSON object and rejects extra commentary or invalid output shape", async t => {
  fakeFetch(t, "chat", `\n\`\`\`json\n${JSON.stringify(draft)}\n\`\`\`\n`);
  assert.deepEqual(await generateAiDraft(chatConfig(), draftRequest, sources, [], new AbortController().signal), draft);
  for (const invalid of ["확인했습니다. " + JSON.stringify(draft), "{invalid json}", JSON.stringify({ ...draft, sourceIds: [123] }), JSON.stringify({ ...draft, unsupportedField: true }), JSON.stringify({ ...draft, text: "" })]) {
    t.mock.restoreAll();
    fakeFetch(t, "chat", invalid);
    await assert.rejects(() => generateAiDraft(chatConfig(), draftRequest, sources, [], new AbortController().signal));
  }
});

test("chat structured-output mode sends JSON schema and still validates the returned answer", async t => {
  const config = chatConfig({ SEMS_AI_STRUCTURED_OUTPUTS: "true" });
  const calls = fakeFetch(t, "chat", JSON.stringify(draft));
  assert.deepEqual(await generateAiDraft(config, draftRequest, sources, [], new AbortController().signal), draft);
  const format = calls[0].body.response_format as { type: string; json_schema: { schema: { properties: Record<string, unknown> } } };
  assert.equal(format.type, "json_schema");
  assert(Object.hasOwn(format.json_schema.schema.properties, "sourceIds"));
  t.mock.restoreAll();
  fakeFetch(t, "chat", JSON.stringify({ text: "답변", sourceIds: [], gaps: [123] }));
  await assert.rejects(() => generateAiDraft(config, draftRequest, sources, [], new AbortController().signal));
});

test("external chat serializes images as image_url and PDFs as named file_data rather than images", async t => {
  const calls = fakeFetch(t, "chat", JSON.stringify(draft));
  await generateAiDraft(chatConfig({ SEMS_AI_FILES_ENABLED: "true" }), draftRequest, sources, [image, pdf], new AbortController().signal);
  const parts = contentParts(calls[0].body, "messages");
  const imageParts = parts.filter(part => part.type === "image_url");
  const fileParts = parts.filter(part => part.type === "file");
  assert.equal(imageParts.length, 1);
  assert.equal(fileParts.length, 1);
  assert.deepEqual(imageParts[0].image_url, { url: `data:image/png;base64,${Buffer.from(image.bytes).toString("base64")}` });
  assert.deepEqual(fileParts[0].file, { filename: pdf.filename, file_data: `data:application/pdf;base64,${Buffer.from(pdf.bytes).toString("base64")}` });
  assert(parts.some(part => part.type === "text" && String(part.text).includes("evidence-1")));
  assert(parts.some(part => part.type === "text" && String(part.text).includes("evidence-2")));
});

test("external extraction preserves unknown fields as null and rejects fabricated numeric coercion", async t => {
  const unknown: AiExtraction = { ...extraction, amount: null, sourcePage: null, sourceExcerpt: null, notes: ["사용량을 읽을 수 없습니다."] };
  fakeFetch(t, "chat", JSON.stringify(unknown));
  assert.deepEqual(await extractAiDocument(chatConfig(), extractionContext, pdf, new AbortController().signal), unknown);
  for (const invalid of [{ ...extraction, amount: "42000" }, { ...extraction, amount: -1 }, { ...extraction, sourcePage: 0 }]) {
    t.mock.restoreAll();
    fakeFetch(t, "chat", JSON.stringify(invalid));
    await assert.rejects(() => extractAiDocument(chatConfig(), extractionContext, pdf, new AbortController().signal));
  }
});

test("direct Responses requests use store:false, max_output_tokens and a schema-validated draft", async t => {
  const calls = fakeFetch(t, "responses", JSON.stringify(draft));
  const config = responsesConfig();
  assert.deepEqual(await generateAiDraft(config, draftRequest, sources, [], new AbortController().signal), draft);
  assert.equal(calls[0].url, "https://api.openai.com/v1/responses");
  assert.equal(calls[0].headers.get("authorization"), `Bearer ${fakeKey}`);
  assert.equal(calls[0].body.model, config.model);
  assert.equal(calls[0].body.store, false);
  assert.equal(calls[0].body.max_output_tokens, 3000);
  assert.equal(calls[0].body.max_tokens, undefined);
  assert.equal((calls[0].body.text as { format: { type: string } }).format.type, "json_schema");
});

test("direct Responses extraction keeps store:false and distinguishes PDF input_file from input_image", async t => {
  const calls = fakeFetch(t, "responses", JSON.stringify(extraction));
  for (const document of [pdf, image]) {
    assert.deepEqual(await extractAiDocument(responsesConfig(), extractionContext, document, new AbortController().signal), extraction);
  }
  for (const call of calls) {
    assert.equal(call.body.store, false);
    assert.equal(call.body.max_output_tokens, 1800);
  }
  const pdfParts = contentParts(calls[0].body, "input");
  const imageParts = contentParts(calls[1].body, "input");
  const filePart = pdfParts.find(part => part.type === "input_file");
  assert(filePart);
  assert.equal(filePart.filename, pdf.filename);
  assert.equal(filePart.file_data, `data:application/pdf;base64,${Buffer.from(pdf.bytes).toString("base64")}`);
  assert(!pdfParts.some(part => part.type === "input_image"));
  assert(imageParts.some(part => part.type === "input_image" && part.image_url === `data:image/png;base64,${Buffer.from(image.bytes).toString("base64")}`));
  assert(!imageParts.some(part => part.type === "input_file"));
});

test("API failures propagate without retrying a rejected request", async t => {
  const calls = fakeFetch(t, "chat", "", 400);
  await assert.rejects(() => generateAiDraft(chatConfig(), draftRequest, sources, [], new AbortController().signal), /fixture rejected request/);
  assert.equal(calls.length, 1);
});
