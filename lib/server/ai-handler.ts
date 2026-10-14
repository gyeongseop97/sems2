import { isAdminRole, canWriteRequestedData } from "../access-control";
import { AI_MAX_FILE_BYTES, inspectAiFile } from "../ai/extraction";
import { buildAiGrounding } from "../ai/context";
import { getAiIndicators } from "../ai/indicator-library";
import { draftRequestSchema, extractionContextSchema, draftOutputSchema, extractionOutputSchema } from "../ai/schemas";
import type { AiDraftRequest, AiExtraction, AiExtractionContext, AiResult, AiSource, AiWorkspace, AiEvidenceCandidate } from "../ai/types";
import type { AiConfiguration, AiDocument } from "./ai-provider";

export type AiAccess = { profile: { id: string; role: string; active: boolean; organization?: { name: string } | null; site?: { name: string } | null }; payload: AiWorkspace };
export type AiDependencies = {
  loadWorkspace: (request: Request) => Promise<AiAccess | Response>;
  config: () => AiConfiguration;
  draft: (config: AiConfiguration, request: AiDraftRequest, sources: AiSource[], files: AiDocument[], signal: AbortSignal) => Promise<unknown>;
  extract: (config: AiConfiguration, context: AiExtractionContext, file: AiDocument, signal: AbortSignal) => Promise<AiExtraction>;
  download: (candidate: AiEvidenceCandidate, request: Request) => Promise<AiDocument | null>;
  saveAnswer?: (request: Request, access: AiAccess, question: string, result: AiResult) => Promise<void>;
  allowRequest?: (userId: string) => boolean;
};

const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const error = (message: string, status: number, code: string) => json({ error: message, code }, status);
const validRole = (role: string) => ["admin", "manager", "editor", "viewer"].includes(role);

function selectedCompany(access: AiAccess, requested: string): string | null {
  if (!requested && isAdminRole(access.profile.role)) return "";
  const company = requested || access.profile.organization?.name || "";
  if (!company || !Object.hasOwn(access.payload.organizations, company)) return null;
  if (!isAdminRole(access.profile.role) && company !== access.profile.organization?.name) return null;
  return company;
}

export function validateDraftReferences(output: unknown, sources: AiSource[]) {
  const draft = draftOutputSchema.parse(output);
  // The model must cite source IDs; only this server assigns display numbers.
  if (/\[\s*\d+\s*\]/.test(draft.text)) throw new Error("AI_INVALID_REFERENCES");
  const byId = new Map(sources.map(source => [source.id, source]));
  const inline = [...draft.text.matchAll(/\[근거:\s*([^\]]+)\]/g)].map(match => match[1].trim());
  const ids = [...new Set([...draft.sourceIds, ...inline])];
  if (!ids.length || ids.some(id => !byId.has(id))) throw new Error("AI_INVALID_REFERENCES");
  const referenced = ids.map(id => byId.get(id)!);
  const text = draft.text.replace(/\[근거:\s*([^\]]+)\]/g, (_match, id: string) => `[${ids.indexOf(id.trim()) + 1}]`);
  return { text, sources: referenced, gaps: draft.gaps };
}

/** This handler reads scoped data and generates drafts. It never saves or approves workspace rows. */
export function createAiHandlers(deps: AiDependencies) {
  async function authenticate(request: Request) {
    const access = await deps.loadWorkspace(request);
    if (access instanceof Response) return access;
    if (!access.profile?.active || !validRole(access.profile.role)) return error("사용 가능한 로그인 계정이 필요합니다.", 403, "AI_FORBIDDEN");
    return access;
  }

  async function respond(request: Request, access: AiAccess, input: AiDraftRequest, result: AiResult) {
    if (input.mode === "answer" && deps.saveAnswer) {
      try { await deps.saveAnswer(request, access, input.question, result); }
      catch { result.warnings = [...result.warnings, "답변은 생성했지만 서버 기록 저장에 실패했습니다. 텍스트로 다운로드하고 DB 설정을 확인해 주세요."]; }
    }
    return json(result);
  }
  return {
    async GET(request: Request) {
      try {
        const access = await authenticate(request);
        if (access instanceof Response) return access;
        const config = deps.config();
        return json({ configured: config.configured, filesEnabled: config.filesEnabled });
      } catch {
        return error("AI 연결 설정을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.", 502, "AI_STATUS_FAILED");
      }
    },
    async POST(request: Request) {
      try {
        const access = await authenticate(request);
        if (access instanceof Response) return access;
        const config = deps.config();
        if (!config.configured) return error("AI 연결이 아직 설정되지 않았습니다. 관리자에게 연결 설정을 요청해 주세요.", 503, "AI_NOT_CONFIGURED");
        if (deps.allowRequest && !deps.allowRequest(access.profile.id)) return error("AI 요청이 많습니다. 잠시 후 다시 시도해 주세요.", 429, "AI_RATE_LIMIT");
        const contentLength = Number(request.headers.get("content-length") || "0");
        if (contentLength > AI_MAX_FILE_BYTES + 32_000) return error("AI 증빙은 3MB 이하로 선택해 주세요.", 413, "AI_FILE_TOO_LARGE");
        const indicators = getAiIndicators(access.payload.indicators);
        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(55_000)]);

        if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
          if (!canWriteRequestedData(access.profile.role)) return error("증빙 추출은 자료 입력 권한이 필요합니다.", 403, "AI_FORBIDDEN");
          if (!config.filesEnabled) return error("연결된 API의 이미지·PDF 지원을 먼저 설정해 주세요. 텍스트 답변 기능은 사용할 수 있습니다.", 422, "AI_DOCUMENTS_DISABLED");
          const form = await request.formData();
          const rawContext = form.get("context");
          if (typeof rawContext !== "string" || rawContext.length > 4000) return error("증빙 읽기 조건이 올바르지 않습니다.", 400, "AI_INVALID_REQUEST");
          const parsed = extractionContextSchema.safeParse(JSON.parse(rawContext));
          if (!parsed.success) return error("증빙 읽기 조건을 확인해 주세요.", 400, "AI_INVALID_REQUEST");
          const company = selectedCompany(access, parsed.data.company);
          if (company === null) return error("선택한 회사의 자료를 조회할 권한이 없습니다.", 403, "AI_SCOPE_FORBIDDEN");
          if (parsed.data.site && (!company || !access.payload.organizations[company]?.includes(parsed.data.site))) return error("선택한 사업장의 자료를 조회할 권한이 없습니다.", 403, "AI_SCOPE_FORBIDDEN");
          if (parsed.data.indicatorId && !indicators.some(indicator => indicator.id === parsed.data.indicatorId && indicator.active !== false)) return error("사용 중 지표를 찾을 수 없습니다.", 404, "AI_INDICATOR_NOT_FOUND");
          const file = form.get("file");
          if (!(file instanceof File) || !file.size || file.size > AI_MAX_FILE_BYTES) return error("3MB 이하의 PDF·JPG·PNG·WEBP 파일을 선택해 주세요.", 413, "AI_FILE_TOO_LARGE");
          const bytes = new Uint8Array(await file.arrayBuffer());
          const mediaType = inspectAiFile(bytes, file.type);
          if (!mediaType) return error("PDF·JPG·PNG·WEBP 형식의 실제 증빙파일을 선택해 주세요.", 415, "AI_UNSUPPORTED_FILE");
          const fileName = file.name.slice(0, 180);
          const context = { ...parsed.data, company };
          const extraction = extractionOutputSchema.parse(await deps.extract(config, context, { bytes, mediaType, filename: fileName }, signal));
          const result: AiResult = { mode: "extract", text: "원본과 추출값을 확인한 뒤 입력값에 반영해 주세요.", extraction, fileName,
            sources: [], gaps: [], warnings: [], scope: { company, year: context.year } };
          return json(result);
        }

        const raw = await request.text();
        if (raw.length > 12_000) return error("질문이 너무 깁니다.", 413, "AI_INVALID_REQUEST");
        const parsed = draftRequestSchema.safeParse(JSON.parse(raw));
        if (!parsed.success) return error("질문과 회사·연도 선택을 확인해 주세요.", 400, "AI_INVALID_REQUEST");
        const company = selectedCompany(access, parsed.data.company);
        if (company === null) return error("선택한 회사의 자료를 조회할 권한이 없습니다.", 403, "AI_SCOPE_FORBIDDEN");
        const input: AiDraftRequest = { ...parsed.data, company };
        if (input.mode === "guide" && !indicators.some(indicator => indicator.id === input.indicatorId && indicator.active !== false)) return error("사용 중 지표를 선택해 주세요.", 404, "AI_INDICATOR_NOT_FOUND");
        if (input.mode === "report") {
          const report = access.payload.reports.find(row => row.id === input.reportId);
          if (!report) return error("보고서를 먼저 저장한 뒤 다시 시도해 주세요.", 404, "AI_REPORT_NOT_FOUND");
          const reportCompany = report.organization === "세원그룹" ? "" : report.organization;
          if (reportCompany !== company) return error("보고서의 회사와 조회 회사가 다릅니다.", 400, "AI_REPORT_SCOPE_MISMATCH");
        }
        const grounding = buildAiGrounding(access.payload, indicators, input);
        const files: AiDocument[] = [];
        const readIds = new Set<string>();
        if (config.filesEnabled && input.mode !== "guide") {
          for (const candidate of grounding.evidenceCandidates.slice(0, 2)) {
            const file = await deps.download(candidate, request);
            if (file) { files.push({ ...file, sourceId: candidate.sourceId }); readIds.add(candidate.sourceId); }
            else grounding.warnings.push("일부 증빙 원문을 열 수 없어 그 내용을 답변 근거에서 제외했습니다.");
          }
        }
        const sources = grounding.sources.filter(source => source.kind !== "evidence" || readIds.has(source.id));
        if (!sources.length || (!grounding.hasFacts && !files.length)) {
          return respond(request, access, input, { mode: input.mode, text: "선택한 회사·연도에 답변을 작성할 확정자료나 읽을 수 있는 승인 증빙이 없습니다. 필요한 자료를 먼저 등록·확정해 주세요.",
            sources: [], gaps: ["확정된 실적 또는 승인된 원본 증빙이 필요합니다."], warnings: grounding.warnings, scope: { company, year: input.year } } satisfies AiResult);
        }
        const draft = validateDraftReferences(await deps.draft(config, input, sources, files, signal), sources);
        return respond(request, access, input, { mode: input.mode, ...draft, warnings: grounding.warnings, scope: { company, year: input.year } } satisfies AiResult);
      } catch (cause) {
        if (cause instanceof SyntaxError) return error("요청 또는 AI 응답 형식을 확인할 수 없습니다. 다시 시도해 주세요.", 400, "AI_INVALID_JSON");
        if (cause instanceof Error && ["AbortError", "TimeoutError"].includes(cause.name)) return error("AI 요청이 취소되었거나 시간이 초과되었습니다.", 504, "AI_TIMEOUT");
        // Never return provider response bodies, credentials, or raw storage errors to the browser.
        return error("AI 결과를 확인할 수 없습니다. API 연결과 지원 모델을 확인한 뒤 다시 시도해 주세요.", 502, "AI_GENERATION_FAILED");
      }
    },
  };
}
