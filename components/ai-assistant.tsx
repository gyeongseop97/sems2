"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { useSemsAuth } from "@/components/auth-context";
import { getAiConfiguration, requestAiDraft, requestAiExtraction } from "@/lib/ai-client";
import { isAdminRole } from "@/lib/access-control";
import { resolveExtractedValue } from "@/lib/ai/extraction";
import type { AiDraftRequest, AiExtraction, AiExtractionContext, AiResult, AiSource } from "@/lib/ai/types";

import "@/app/ai.css";

type AiView = NonNullable<AiSource["view"]>;
type Navigate = (view: AiView) => void;
type JobState = { context: string; runId: number; loading: boolean; result: AiResult | null; text: string; error: string };

function isAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function useAiAvailability(profileId: string) {
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState<{ profileId: string; configured: boolean | null; filesEnabled: boolean; error: string }>({ profileId, configured: null, filesEnabled: false, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    getAiConfiguration(controller.signal).then(value => {
      if (!controller.signal.aborted) setStatus({ profileId, configured: value.configured, filesEnabled: value.filesEnabled, error: "" });
    }).catch(error => {
      if (!controller.signal.aborted && !isAbort(error)) setStatus({ profileId, configured: null, filesEnabled: false, error: messageOf(error) });
    });
    return () => controller.abort();
  }, [profileId, retry]);
  return {
    configured: status.profileId === profileId ? status.configured : null,
    error: status.profileId === profileId ? status.error : "",
    filesEnabled: status.profileId === profileId && status.filesEnabled,
    retry: () => setRetry(value => value + 1),
  };
}

/** Every response belongs to an account and an input context. Context changes hide it immediately. */
function useAiJob(context: string) {
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const [stored, setStored] = useState<JobState>({ context, runId: 0, loading: false, result: null, text: "", error: "" });
  const state: JobState = stored.context === context ? stored : { context, runId: 0, loading: false, result: null, text: "", error: "" };

  useEffect(() => {
    return () => {
      sequence.current += 1;
      controller.current?.abort();
    };
  }, [context]);

  const reset = useCallback(() => {
    sequence.current += 1;
    controller.current?.abort();
    setStored({ context, runId: sequence.current, loading: false, result: null, text: "", error: "" });
  }, [context]);

  const cancel = useCallback(() => {
    sequence.current += 1;
    controller.current?.abort();
    setStored({ context, runId: sequence.current, loading: false, result: null, text: "", error: "생성을 취소했습니다." });
  }, [context]);

  const run = useCallback(async (request: (signal: AbortSignal) => Promise<AiResult>) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const runId = ++sequence.current;
    setStored({ context, runId, loading: true, result: null, text: "", error: "" });
    try {
      const result = await request(current.signal);
      if (current.signal.aborted || runId !== sequence.current) return;
      setStored({ context, runId, loading: false, result, text: result.text, error: "" });
    } catch (error) {
      if (current.signal.aborted || runId !== sequence.current || isAbort(error)) return;
      setStored({ context, runId, loading: false, result: null, text: "", error: messageOf(error) });
    }
  }, [context]);

  const setText = (text: string) => setStored(previous => previous.context === context ? { ...previous, text } : previous);
  const setError = (error: string) => setStored({ context, runId: ++sequence.current, loading: false, result: null, text: "", error });
  return { ...state, run, reset, cancel, setText, setError };
}

function Availability({ status }: { status: ReturnType<typeof useAiAvailability> }) {
  if (status.error) return <div className="sems-ai-notice sems-ai-error" role="alert"><span>{status.error}</span><button type="button" className="secondary-button compact" onClick={status.retry}>연결 다시 확인</button></div>;
  if (status.configured === null) return <p className="sems-ai-help" role="status">AI 연결 상태를 확인하고 있습니다.</p>;
  if (!status.configured) return <p className="sems-ai-notice">AI 기능이 아직 설정되지 않았습니다. 관리자에게 서버 설정을 요청해 주세요.</p>;
  return null;
}

function SourceList({ sources, onNavigate }: { sources: AiSource[]; onNavigate?: Navigate }) {
  return <details className="sems-ai-sources" open>
    <summary>답변 근거 {sources.length}개</summary>
    {sources.length ? <ol>{sources.map((source, index) => <li key={`${source.id}-${index}`}>
      <div className="sems-ai-source-head"><strong>{source.title}</strong>{source.view && onNavigate && <button type="button" className="secondary-button compact" onClick={() => onNavigate(source.view!)}>관련 자료 보기</button>}</div>
      {(source.company || source.period) && <p className="sems-ai-help">{[source.company, source.period].filter(Boolean).join(" · ")}</p>}
      <p className="sems-ai-source-excerpt">{source.excerpt}</p>
    </li>)}</ol> : <p className="sems-ai-help">이 범위에서 확인한 등록 자료가 없습니다. 답변에 적힌 일반 안내와 회사 실적을 구분해 주세요.</p>}
  </details>;
}

function ResultNotes({ result }: { result: AiResult }) {
  return <>
    {result.gaps.length > 0 && <div className="sems-ai-notice"><strong>추가로 필요한 자료</strong><ul>{result.gaps.map((gap, index) => <li key={index}>{gap}</li>)}</ul></div>}
    {result.warnings.length > 0 && <div className="sems-ai-notice"><strong>확인 사항</strong><ul>{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
  </>;
}

function TextActions({ text, context, downloadName, downloadText, children }: { text: string; context: string; downloadName?: string; downloadText?: string; children?: React.ReactNode }) {
  const [feedback, setFeedback] = useState<{ context: string; message: string }>({ context, message: "" });
  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error("이 브라우저에서는 자동 복사를 지원하지 않습니다. 초안의 글을 선택해 복사해 주세요.");
      await navigator.clipboard.writeText(text);
      setFeedback({ context, message: "초안을 복사했습니다." });
    } catch (error) { setFeedback({ context, message: messageOf(error) }); }
  };
  const download = () => {
    const blob = new Blob(["\uFEFF", downloadText ?? text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = downloadName || "SEMS2_AI_Draft.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="sems-ai-actions">
    <button type="button" className="secondary-button compact" disabled={!text.trim()} onClick={copy}>초안 복사</button>
    {downloadName && <button type="button" className="secondary-button compact" disabled={!text.trim()} onClick={download}>텍스트 다운로드</button>}
    {children}
    {feedback.context === context && feedback.message && <span className="sems-ai-help" role="status">{feedback.message}</span>}
  </div>;
}

function answerExport(result: AiResult, text: string) {
  const sections = [`${result.scope.company || "전체 법인"} · ${result.scope.year}년 답변 초안`, text];
  if (result.sources.length) sections.push("답변 근거\n" + result.sources.map((source, index) => `[${index + 1}] ${source.title}\n${[source.company, source.period].filter(Boolean).join(" · ")}\n${source.excerpt}`).join("\n\n"));
  if (result.gaps.length) sections.push("추가로 필요한 자료\n" + result.gaps.map(gap => `- ${gap}`).join("\n"));
  if (result.warnings.length) sections.push("확인 사항\n" + result.warnings.map(warning => `- ${warning}`).join("\n"));
  return sections.join("\n\n");
}

type AnswerHistoryEntry = { id: string; createdAt: string; question: string; result: AiResult };
const subscribeHistory = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("sems-ai-history", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("sems-ai-history", callback); };
};
const emptyHistory = () => "[]";

export function AiAnswerWorkspace({ organizationNames, currentOrganization, isAdmin, onNavigate }: { organizationNames: string[]; currentOrganization: string; isAdmin: boolean; onNavigate?: Navigate }) {
  const { profile } = useSemsAuth();
  const allowedCompanies = isAdmin ? ["", ...organizationNames] : [currentOrganization];
  const defaultCompany = isAdmin ? "" : currentOrganization;
  const historyKey = `sems-ai-answer-history:v1:${JSON.stringify([profile.id, isAdmin, currentOrganization, [...organizationNames].sort()])}`;
  const historyJson = useSyncExternalStore(subscribeHistory, () => {
    try { return localStorage.getItem(historyKey) || "[]"; } catch { return "[]"; }
  }, emptyHistory);
  const history = useMemo<AnswerHistoryEntry[]>(() => {
    try { const value = JSON.parse(historyJson); return Array.isArray(value) ? value.filter(item => item && typeof item.id === "string" && typeof item.question === "string" && item.result?.mode === "answer" && typeof item.result.text === "string" && Array.isArray(item.result.sources) && Array.isArray(item.result.gaps) && Array.isArray(item.result.warnings) && (isAdmin ? !item.result.scope?.company || organizationNames.includes(item.result.scope.company) : item.result.scope?.company === currentOrganization)).slice(0, 30) : []; } catch { return []; }
  }, [historyJson, isAdmin, organizationNames, currentOrganization]);
  const [historySelection, setHistorySelection] = useState<{ key: string; id: string } | null>(null);
  const [historyError, setHistoryError] = useState("");
  const saveHistory = (items: AnswerHistoryEntry[]) => {
    try { localStorage.setItem(historyKey, JSON.stringify(items)); window.dispatchEvent(new Event("sems-ai-history")); setHistoryError(""); }
    catch { setHistoryError("이 브라우저에 답변 기록을 저장하지 못했습니다. 텍스트 다운로드로 보관해 주세요."); }
  };

  const [selection, setSelection] = useState({ profileId: profile.id, company: defaultCompany, year: new Date().getFullYear(), question: "" });
  const company = selection.profileId === profile.id && allowedCompanies.includes(selection.company) ? selection.company : defaultCompany;
  const year = selection.profileId === profile.id ? selection.year : new Date().getFullYear();
  const question = selection.profileId === profile.id ? selection.question : "";
  const context = JSON.stringify([profile.id, company, year, question]);
  const job = useAiJob(context);
  const availability = useAiAvailability(profile.id);
  const questionId = useId();
  const update = (next: Partial<{ company: string; year: number; question: string }>) => setSelection({ profileId: profile.id, company, year, question, ...next });
  const ask = () => {
    if (!question.trim() || (!company && !isAdmin) || !Number.isInteger(year) || year < 2000 || year > 2100) { job.setError("회사, 연도와 질문을 확인해 주세요."); return; }
    const request: AiDraftRequest = { mode: "answer", company, year, question: question.trim() };
    setHistorySelection(null);
    void job.run(async signal => {
      const result = await requestAiDraft(request, signal);
      if (!signal.aborted) saveHistory([{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), question: request.question, result }, ...history].slice(0, 30));
      return result;
    });
  };
  const savedAnswer = history.find(item => item.id === (historySelection?.key === historyKey ? historySelection.id : history[0]?.id));
  const shownResult = historySelection?.key === historyKey ? savedAnswer?.result : job.result ?? savedAnswer?.result;
  const shownText = shownResult === job.result ? job.text : shownResult?.text ?? "";
  return <section className="sems-ai sems-ai-workspace">
    <article className="card"><div className="card-header"><div><h2>고객사 답변 초안</h2><p>선택한 회사와 연도의 등록 자료를 찾아 답변과 근거를 함께 정리합니다.</p></div></div>
      <div className="sems-ai-body"><Availability status={availability} />
        <div className="sems-ai-scope"><label>회사<select value={company} onChange={event => update({ company: event.target.value })} disabled={!isAdmin}>{allowedCompanies.map(name => <option key={name} value={name}>{name || "전체 법인"}</option>)}</select></label><label>기준연도<input type="number" min={2000} max={2100} value={year} onChange={event => update({ year: Number(event.target.value) })} /></label></div>
        <label htmlFor={questionId}>고객사 질문 또는 확인할 내용</label><textarea id={questionId} className="sems-ai-question" rows={5} maxLength={2000} value={question} onChange={event => update({ question: event.target.value })} placeholder="예: 올해 전력 사용량과 온실가스 배출량, 관련 근거를 정리해 주세요." />
        <div className="sems-ai-actions"><button type="button" className="primary-button" disabled={availability.configured !== true || job.loading || !question.trim() || (!company && !isAdmin)} onClick={ask}>{job.loading ? "답변을 작성하고 있습니다…" : "답변 초안 만들기"}</button>{job.loading && <button type="button" className="secondary-button" onClick={job.cancel}>취소</button>}</div>
        <p className="sems-ai-help">답변 기록은 이 브라우저에 계정별로 최근 30건 저장됩니다. 탭 이동·새로고침 후에도 확인할 수 있습니다. 근거와 수치를 확인한 뒤 사용해 주세요.</p>
        {job.error && <p className="sems-ai-error" role="alert">{job.error}</p>}
        {job.loading && <p className="sems-ai-help" role="status" aria-live="polite">등록 자료를 확인하고 답변을 작성하는 중입니다.</p>}
      </div>
    </article>
    <article className="card"><div className="sems-ai-body"><h2>답변 기록</h2>
      {historyError && <p role="alert">{historyError}</p>}
      {!history.length && <p>저장된 답변이 없습니다.</p>}
      {history.length > 0 && <><button type="button" className="secondary-button compact" onClick={() => { saveHistory([]); setHistorySelection(null); job.reset(); }}>기록 전체 삭제</button><ol>{history.map(item => <li key={item.id}><button type="button" className="secondary-button compact" onClick={() => { job.cancel(); setHistorySelection({ key: historyKey, id: item.id }); }}>{item.result.scope.company || "전체 법인"} · {item.result.scope.year}년 · {item.question}</button><p className="sems-ai-help">{new Date(item.createdAt).toLocaleString("ko-KR")} · 저장 당시 답변</p></li>)}</ol></>}
    </div></article>
    {shownResult && <article className="card"><div className="card-header"><div><h2>답변 초안</h2><p>{shownResult.scope.company || "전체 법인"} · {shownResult.scope.year}년</p></div></div><div className="sems-ai-body"><div className="sems-ai-answer">{shownText}</div><TextActions text={answerExport(shownResult, shownText)} context={`${context}:${job.runId}`} downloadName={`SEMS2_AI_Answer_${year}.txt`} downloadText={answerExport(shownResult, shownText)} /><ResultNotes result={shownResult} /><SourceList sources={shownResult.sources} onNavigate={onNavigate} /></div></article>}
  </section>;
}

export function AiDraftPanel({ mode, company, year, indicatorId, reportId, title, defaultQuestion, contextKey, onApply, onNavigate }: { mode: "guide" | "report"; company: string; year: number; indicatorId?: number; reportId?: string; title: string; defaultQuestion?: string; contextKey?: string; onApply?: (text: string) => void; onNavigate?: Navigate }) {
  const { profile, canWrite } = useSemsAuth();
  const context = JSON.stringify([profile.id, mode, company, year, indicatorId, reportId, defaultQuestion, contextKey]);
  const [input, setInput] = useState({ context, value: defaultQuestion || (mode === "guide" ? "이 지표의 입력 기준과 필요한 증빙을 알려 주세요." : "등록 자료와 근거를 바탕으로 보고서 설명 초안을 작성해 주세요.") });
  const question = input.context === context ? input.value : defaultQuestion || (mode === "guide" ? "이 지표의 입력 기준과 필요한 증빙을 알려 주세요." : "등록 자료와 근거를 바탕으로 보고서 설명 초안을 작성해 주세요.");
  const job = useAiJob(JSON.stringify([context, question]));
  const availability = useAiAvailability(profile.id);
  const inputId = useId();
  const makeDraft = () => {
    if (!question.trim() || (!company && !isAdminRole(profile.role))) { job.setError("회사와 질문을 확인해 주세요."); return; }
    void job.run(signal => requestAiDraft({ mode, question: question.trim(), company, year, ...(indicatorId === undefined ? {} : { indicatorId }), ...(reportId ? { reportId } : {}) }, signal));
  };
  return <details className="sems-ai sems-ai-panel">
    <summary>{title}<span className="sems-ai-help">AI 도움</span></summary>
    <div className="sems-ai-panel-body"><Availability status={availability} /><p className="sems-ai-help">{company || "전체 법인"} · {year}년 자료 기준입니다. 생성한 내용과 근거를 확인해 주세요.</p>
      <label htmlFor={inputId}>요청할 내용</label><textarea id={inputId} rows={3} maxLength={2000} value={question} onChange={event => setInput({ context, value: event.target.value })} />
      <div className="sems-ai-actions"><button type="button" className="secondary-button compact" disabled={availability.configured !== true || job.loading || !question.trim() || (!company && !isAdminRole(profile.role))} onClick={makeDraft}>{job.loading ? "작성 중…" : mode === "guide" ? "입력 도움 받기" : "설명 초안 만들기"}</button>{job.loading && <button type="button" className="secondary-button compact" onClick={job.cancel}>취소</button>}</div>
      {job.error && <p className="sems-ai-error" role="alert">{job.error}</p>}
      {job.loading && <p className="sems-ai-help" role="status">근거를 확인해 초안을 작성하고 있습니다.</p>}
      {job.result && <div className="sems-ai-result"><label>검토할 초안<textarea rows={8} value={job.text} onChange={event => job.setText(event.target.value)} /></label><TextActions text={job.text} context={`${context}:${job.runId}`}>{mode === "report" && onApply && <button type="button" className="primary-button compact" disabled={!canWrite || !job.text.trim() || !job.result.sources.length} onClick={() => onApply(job.text + "\n\n근거\n" + job.result!.sources.map((source, index) => `[${index + 1}] ${source.title} ${[source.company, source.period].filter(Boolean).join(" · ")}`).join("\n"))}>이 초안 넣기</button>}</TextActions><ResultNotes result={job.result} /><SourceList sources={job.result.sources} onNavigate={onNavigate} /></div>}
    </div>
  </details>;
}

const MAX_FILE_SIZE = 3 * 1024 * 1024;
const MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export function AiExtractionPanel({ company, period, site, targetLabel, expectedUnit, indicatorId, contextKey, onApply }: { company: string; period: string; site?: string; targetLabel: string; expectedUnit: string; indicatorId?: number; contextKey?: string; onApply: (extraction: AiExtraction, value: number, fileName: string) => void }) {
  const { profile, canWrite } = useSemsAuth();
  const context = JSON.stringify([profile.id, company, period, site, targetLabel, expectedUnit, indicatorId, contextKey]);
  const [selection, setSelection] = useState<{ context: string; file: File | null }>({ context, file: null });
  const [confirmation, setConfirmation] = useState({ context: "", checked: false });
  const file = selection.context === context ? selection.file : null;
  const job = useAiJob(context);
  const availability = useAiAvailability(profile.id);
  const extraction = job.result?.extraction;
  const conversion = useMemo(() => extraction ? resolveExtractedValue(extraction, expectedUnit, { company, period, site }) : null, [extraction, expectedUnit, company, period, site]);
  const confirmationKey = `${context}:${job.runId}`;
  const checked = confirmation.context === confirmationKey && confirmation.checked;
  const inputId = useId();
  const selectFile = (selected: File | undefined) => {
    job.reset();
    setConfirmation({ context: "", checked: false });
    if (!selected) { setSelection({ context, file: null }); return; }
    if (!/\.(pdf|jpe?g|png|webp)$/i.test(selected.name) || (selected.type && !MIME_TYPES.has(selected.type))) { setSelection({ context, file: null }); job.setError("PDF, JPG, PNG, WEBP 파일만 선택해 주세요."); return; }
    if (!selected.size || selected.size > MAX_FILE_SIZE) { setSelection({ context, file: null }); job.setError("파일 크기는 0바이트보다 크고 3MB 이하여야 합니다."); return; }
    setSelection({ context, file: selected });
  };
  const readEvidence = () => {
    if (!file) { job.setError("읽을 증빙파일을 선택해 주세요."); return; }
    setConfirmation({ context: "", checked: false });
    const year = Number(period.slice(0, 4));
    if (!Number.isInteger(year) || year < 2000 || year > 2100 || !company) { job.setError("회사와 기준기간을 확인해 주세요."); return; }
    const request: AiExtractionContext = { mode: "extract", company, year, period, ...(site ? { site } : {}), targetLabel, expectedUnit, ...(indicatorId === undefined ? {} : { indicatorId }) };
    void job.run(signal => requestAiExtraction(request, file, signal));
  };
  const apply = () => {
    if (!canWrite || !checked || !extraction || !conversion?.ok || !file || job.loading) return;
    onApply(extraction, conversion.value, file.name);
  };
  return <details className="sems-ai sems-ai-panel sems-ai-extraction">
    <summary>증빙에서 입력값 확인<span className="sems-ai-help">AI 도움</span></summary>
    <div className="sems-ai-panel-body"><Availability status={availability} />{availability.configured && !availability.filesEnabled && <p className="sems-ai-notice">연결된 API의 이미지·PDF 지원 설정이 필요합니다. 관리자에게 확인해 주세요.</p>}<p className="sems-ai-help">{targetLabel} · {company}{site ? ` · ${site}` : ""} · {period} · 입력 단위 {expectedUnit}</p>
      <label htmlFor={inputId}>증빙파일 선택 (PDF·JPG·PNG·WEBP, 최대 3MB)</label><input key={context} id={inputId} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={event => selectFile(event.target.files?.[0])} />
      {file && <p className="sems-ai-help">선택한 파일: {file.name} ({(file.size / 1024).toFixed(0)}KB)</p>}
      <div className="sems-ai-actions"><button type="button" className="secondary-button compact" disabled={availability.configured !== true || !availability.filesEnabled || !canWrite || job.loading || !file} onClick={readEvidence}>{job.loading ? "증빙을 읽고 있습니다…" : "증빙 읽기"}</button>{job.loading && <button type="button" className="secondary-button compact" onClick={job.cancel}>취소</button>}</div>
      <p className="sems-ai-help">선택한 파일을 AI로 읽습니다. 원본 증빙의 등록·저장과 입력값 확정은 별도로 진행합니다.</p>
      {job.error && <p className="sems-ai-error" role="alert">{job.error}</p>}
      {job.loading && <p className="sems-ai-help" role="status">문서에서 회사, 기간과 값을 확인하고 있습니다.</p>}
      {job.result && !extraction && <p className="sems-ai-error" role="alert">확인할 입력값을 찾지 못했습니다. 원본을 확인해 직접 입력해 주세요.</p>}
      {extraction && <div className="sems-ai-result"><h3>읽은 내용</h3><dl className="sems-ai-extraction-fields"><div><dt>회사</dt><dd>{extraction.company || "확인하지 못함"}</dd></div><div><dt>사업장</dt><dd>{extraction.site || "확인하지 못함"}</dd></div><div><dt>기간</dt><dd>{[extraction.periodFrom, extraction.periodTo].filter(Boolean).join(" ~ ") || "확인하지 못함"}</dd></div><div><dt>항목</dt><dd>{extraction.metricName || "확인하지 못함"}</dd></div><div><dt>값</dt><dd>{extraction.amount === null ? "확인하지 못함" : extraction.amount.toLocaleString("ko-KR", { maximumFractionDigits: 8 })}</dd></div><div><dt>단위</dt><dd>{extraction.unit || "확인하지 못함"}</dd></div><div><dt>페이지</dt><dd>{extraction.sourcePage === null ? "확인하지 못함" : extraction.sourcePage}</dd></div></dl>
        <p className="sems-ai-help">원문 발췌</p><blockquote className="sems-ai-source-excerpt">{extraction.sourceExcerpt || "확인한 원문이 없습니다."}</blockquote>
        {extraction.notes.length > 0 && <ul className="sems-ai-note-list">{extraction.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>}
        {conversion?.ok ? <div className="sems-ai-notice"><strong>반영할 값: {conversion.value.toLocaleString("ko-KR", { maximumFractionDigits: 8 })} {expectedUnit}</strong>{conversion.notes.length > 0 && <ul>{conversion.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>}</div> : conversion && <p className="sems-ai-error" role="alert">{conversion.error}</p>}
        <label className="sems-ai-confirm"><input type="checkbox" checked={checked} onChange={event => setConfirmation({ context: confirmationKey, checked: event.target.checked })} disabled={!conversion?.ok || !file} /><span>원본에서 회사·사업장·기간·항목·값과 단위를 확인했습니다.</span></label>
        <button type="button" className="primary-button compact" disabled={!canWrite || !checked || !conversion?.ok || !file || job.loading} onClick={apply}>확인한 값 입력란에 반영</button>
        <p className="sems-ai-help">반영 후에도 입력 화면의 저장·제출 절차를 진행해야 합니다.</p>{job.result && <ResultNotes result={job.result} />}
      </div>}
    </div>
  </details>;
}
