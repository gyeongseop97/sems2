"use client";

import type { AiDraftRequest, AiExtractionContext, AiResult } from "@/lib/ai/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

class AiRequestError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "AiRequestError";
  }
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("AI 요청을 취소했습니다.", "AbortError");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isAiResult(value: unknown): value is AiResult {
  if (!isObject(value) || !["extract", "guide", "report", "answer"].includes(String(value.mode))) return false;
  if (typeof value.text !== "string" || !isStringArray(value.gaps) || !isStringArray(value.warnings)) return false;
  if (!isObject(value.scope) || typeof value.scope.company !== "string" || typeof value.scope.year !== "number" || !Number.isFinite(value.scope.year)) return false;
  if (!Array.isArray(value.sources) || !value.sources.every((source: unknown) =>
    isObject(source) && typeof source.id === "string" && typeof source.title === "string" && typeof source.excerpt === "string" &&
    ["activity", "metric", "indicator", "evidence", "target"].includes(String(source.kind)) &&
    (source.company === undefined || typeof source.company === "string") &&
    (source.period === undefined || typeof source.period === "string") &&
    (source.view === undefined || ["inventory", "metric-collection", "indicators", "evidence", "targets"].includes(String(source.view))))) return false;
  if (value.fileName !== undefined && typeof value.fileName !== "string") return false;
  if (value.extraction !== undefined) {
    const extraction = value.extraction;
    if (!isObject(extraction) || !isStringArray(extraction.notes)) return false;
    if (!["company", "site", "periodFrom", "periodTo", "metricName", "unit", "sourceExcerpt"].every((key) => extraction[key] === null || typeof extraction[key] === "string")) return false;
    if (!["amount", "sourcePage"].every((key) => extraction[key] === null || (typeof extraction[key] === "number" && Number.isFinite(extraction[key])))) return false;
  }
  return true;
}

async function getAccessToken(signal?: AbortSignal): Promise<string> {
  checkAbort(signal);
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new AiRequestError("로그인 연결 정보가 없습니다. 로그인 설정을 확인해 주세요.", "AUTH_REQUIRED");
  try {
    const { data, error } = await supabase.auth.getSession();
    checkAbort(signal);
    if (error || !data.session?.access_token) throw new AiRequestError("로그인 세션이 없습니다. 다시 로그인한 후 AI 기능을 이용해 주세요.", "AUTH_REQUIRED");
    return data.session.access_token;
  } catch (error) {
    checkAbort(signal);
    if (error instanceof AiRequestError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new AiRequestError("로그인 세션을 확인하지 못했습니다. 다시 로그인한 후 이용해 주세요.", "AUTH_REQUIRED");
  }
}

async function requestAi(init: RequestInit, signal?: AbortSignal, endpoint = "/api/ai"): Promise<unknown> {
  const token = await getAccessToken(signal);
  checkAbort(signal);
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${token}`);
  try {
    const response = await fetch(endpoint, { ...init, headers, signal, cache: "no-store" });
    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      checkAbort(signal);
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new AiRequestError(response.ok ? "AI 응답 형식이 올바르지 않습니다. 잠시 후 다시 시도해 주세요." : "AI 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.", "INVALID_RESPONSE");
    }
    checkAbort(signal);
    if (!response.ok) {
      const message = isObject(payload) && typeof payload.error === "string" && payload.error.trim()
        ? payload.error
        : response.status === 401 ? "로그인 세션이 만료되었습니다. 다시 로그인해 주세요." : "AI 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
      const code = isObject(payload) && typeof payload.code === "string" ? payload.code : undefined;
      throw new AiRequestError(message, code);
    }
    return payload;
  } catch (error) {
    checkAbort(signal);
    if (error instanceof AiRequestError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new AiRequestError("AI 서버에 연결하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.", "NETWORK_ERROR");
  }
}

export async function getAiConfiguration(signal?: AbortSignal): Promise<{ configured: boolean; filesEnabled: boolean }> {
  const payload = await requestAi({ method: "GET" }, signal);
  if (!isObject(payload) || typeof payload.configured !== "boolean") throw new AiRequestError("AI 설정 응답 형식이 올바르지 않습니다.", "INVALID_RESPONSE");
  return { configured: payload.configured, filesEnabled: payload.filesEnabled === true };
}

export async function requestAiDraft(request: AiDraftRequest, signal?: AbortSignal): Promise<AiResult> {
  // Send only the API contract; workspace values and provider credentials stay out of the browser payload.
  const body: AiDraftRequest = {
    mode: request.mode,
    question: request.question,
    company: request.company,
    year: request.year,
    ...(request.indicatorId !== undefined ? { indicatorId: request.indicatorId } : {}),
    ...(request.reportId !== undefined ? { reportId: request.reportId } : {}),
  };
  const payload = await requestAi({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, signal);
  if (!isAiResult(payload) || payload.mode !== request.mode || payload.scope.company !== request.company || payload.scope.year !== request.year) throw new AiRequestError("AI 응답의 회사·연도 또는 형식이 요청과 다릅니다. 다시 확인해 주세요.", "INVALID_RESPONSE");
  return payload;
}

export async function requestAiExtraction(context: AiExtractionContext, file: File, signal?: AbortSignal): Promise<AiResult> {
  const safeContext: AiExtractionContext = {
    mode: "extract",
    company: context.company,
    year: context.year,
    targetLabel: context.targetLabel,
    expectedUnit: context.expectedUnit,
    ...(context.period !== undefined ? { period: context.period } : {}),
    ...(context.site !== undefined ? { site: context.site } : {}),
    ...(context.indicatorId !== undefined ? { indicatorId: context.indicatorId } : {}),
  };
  const body = new FormData();
  body.append("context", JSON.stringify(safeContext));
  body.append("file", file);
  const payload = await requestAi({ method: "POST", body }, signal);
  if (!isAiResult(payload) || payload.mode !== "extract" || payload.scope.company !== context.company || payload.scope.year !== context.year) throw new AiRequestError("AI 추출 응답의 회사·연도 또는 형식이 요청과 다릅니다. 다시 확인해 주세요.", "INVALID_RESPONSE");
  return payload;
}


export type AiAnswerHistoryEntry = { id: string; createdAt: string; question: string; result: AiResult };
export async function getAiAnswerHistory(signal?: AbortSignal): Promise<AiAnswerHistoryEntry[]> {
  const payload = await requestAi({ method: "GET" }, signal, "/api/ai/history");
  if (!isObject(payload) || !Array.isArray(payload.entries) || !payload.entries.every(item => isObject(item) && typeof item.id === "string" && typeof item.createdAt === "string" && typeof item.question === "string" && isAiResult(item.result))) throw new AiRequestError("답변 기록 형식이 올바르지 않습니다.", "INVALID_RESPONSE");
  return payload.entries as AiAnswerHistoryEntry[];
}
export async function deleteAiAnswerHistory(): Promise<void> {
  const payload = await requestAi({ method: "DELETE" }, undefined, "/api/ai/history");
  if (!isObject(payload) || payload.deleted !== true) throw new AiRequestError("답변 기록을 삭제하지 못했습니다.");
}
