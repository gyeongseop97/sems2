"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./operations-audit.module.css";

type AuditEntry = {
  id: string; scope_key: string; organization_id: string | null; revision: number;
  collection: string; entity_key: string; operation: string;
  before_value: unknown; after_value: unknown; actor_id: string; actor_name: string | null; created_at: string;
};

const collections: Record<string, string> = {
  records: "활동자료", periods: "수집기간", factors: "배출계수", indicators: "ESG 지표",
  metricRequests: "지표 수집요청", metricSubmissions: "지표 제출자료", criteria: "수집 기준",
  organizations: "조직·사업장", reports: "보고서", targets: "감축목표", plans: "이행계획",
  disclosureMappings: "공시 기준 연결", noticePrefs: "알림 설정",
};
const fields: Record<string, string> = {
  company: "법인", site: "사업장", period: "자료 기준월", scope: "Scope", category: "활동자료 구분", source: "배출원",
  usage: "사용량", unit: "단위", factor: "배출계수", factorId: "계수 ID", factorSnapshot: "적용 계수 기록", emissions: "배출량",
  owner: "담당자", department: "담당 부서", status: "상태", value: "값", dataStatus: "값 구분", numerator: "분자", denominator: "분모",
  description: "설명", rejectionReason: "반려 사유", reviewNote: "검토 의견", reviewedBy: "검토자", reviewedAt: "검토일시",
  qualityResolutions: "품질 확인", updatedAt: "수정일시", createdAt: "등록일시", locked: "수정 잠금", active: "사용 여부",
  name: "이름", title: "제목", companies: "대상 법인", sitesByCompany: "대상 사업장", dueDate: "제출기한",
};
const operationNames: Record<string, string> = { create: "등록", insert: "등록", update: "수정", delete: "삭제" };

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "예" : "아니오";
  return typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
}

function changedFields(entry: AuditEntry) {
  const before = entry.before_value && typeof entry.before_value === "object" && !Array.isArray(entry.before_value) ? entry.before_value as Record<string, unknown> : { value: entry.before_value };
  const after = entry.after_value && typeof entry.after_value === "object" && !Array.isArray(entry.after_value) ? entry.after_value as Record<string, unknown> : { value: entry.after_value };
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map(key => ({ key, before: before[key], after: after[key] }));
}

function exportEntries(entries: AuditEntry[]) {
  const cell = (value: unknown) => {
    let text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const rows = [["저장일시", "변경자", "구분", "대상", "작업", "이전값", "저장값"], ...entries.map(entry => [entry.created_at, entry.actor_name || entry.actor_id, collections[entry.collection] || entry.collection, entry.entity_key, operationNames[entry.operation] || entry.operation, entry.before_value, entry.after_value])];
  const blob = new Blob(["\uFEFF", rows.map(row => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `SEMS_저장변경이력_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function OperationsAudit() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastCursor, setLastCursor] = useState<string | undefined>();
  const request = useRef(0);

  const load = useCallback((cursor?: string) => {
    const id = ++request.current;
    const readPage = async () => {
      const supabase = getSupabaseBrowserClient();
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      if (!session) throw new Error("로그인 정보를 확인한 후 다시 시도해 주세요.");
      const response = await fetch(`/api/workspace?view=audit${cursor ? `&before=${encodeURIComponent(cursor)}` : ""}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "서버 변경 이력을 불러오지 못했습니다.");
      return body;
    };
    return readPage().then(body => {
      if (request.current !== id) return;
      const page = Array.isArray(body.entries) ? body.entries as AuditEntry[] : [];
      setEntries(previous => cursor ? [...previous, ...page.filter(entry => !previous.some(old => old.id === entry.id))] : page);
      setNextCursor(body.nextCursor || null);
    }).catch((cause: unknown) => {
      if (request.current === id) setError(cause instanceof Error ? cause.message : "변경 이력을 불러오지 못했습니다.");
    }).finally(() => {
      if (request.current === id) setLoading(false);
    });
  }, []);
  const startLoad = (cursor?: string) => { setLoading(true); setError(""); setLastCursor(cursor); void load(cursor); };

  useEffect(() => { void load(); return () => { request.current += 1; }; }, [load]);

  return <section className={`card ${styles.panel}`} aria-labelledby="saved-audit-heading">
    <div className={styles.header}>
      <div><h2 id="saved-audit-heading">서버 저장 이력</h2><p>저장된 변경의 이전 값과 저장 값을 확인합니다. 저장되지 않은 작업은 포함되지 않습니다.</p></div>
      <div className={styles.actions}><button className="secondary-button" disabled={loading} onClick={() => startLoad()}>새로고침</button><button className="secondary-button" disabled={!entries.length} onClick={() => exportEntries(entries)}>조회한 {entries.length}건 내보내기</button></div>
    </div>
    <p className={styles.note}>이력 보관 기능을 적용한 이후의 기록부터 표시됩니다.</p>
    {error && <div className={styles.error} role="alert"><span>{error}</span><button className="secondary-button" onClick={() => startLoad(lastCursor)} disabled={loading}>다시 시도</button></div>}
    {!entries.length && !loading && !error && <p className={styles.empty}>저장된 변경 이력이 없습니다.</p>}
    <div className={styles.list}>{entries.map(entry => {
      const changed = changedFields(entry);
      return <details className={styles.entry} key={entry.id}>
        <summary><span className={styles.kind}>{operationNames[entry.operation] || entry.operation}</span><span className={styles.subject}><strong>{collections[entry.collection] || entry.collection}</strong><span>{entry.entity_key}</span></span><span className={styles.actor}>{entry.actor_name || entry.actor_id}<time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString("ko-KR")}</time></span><span className={styles.count}>{changed.length}개 항목</span></summary>
        <div className={styles.tableWrap}><table><thead><tr><th>변경 항목</th><th>이전 값</th><th>저장 값</th></tr></thead><tbody>{changed.map(change => <tr key={change.key}><th scope="row">{fields[change.key] || change.key}</th><td><pre>{displayValue(change.before)}</pre></td><td><pre>{displayValue(change.after)}</pre></td></tr>)}</tbody></table></div>
      </details>;
    })}</div>
    <div className={styles.footer} aria-live="polite">{loading ? <span>변경 이력을 불러오는 중입니다.</span> : <span>{entries.length}건 조회됨</span>}{nextCursor && <button className="secondary-button" disabled={loading} onClick={() => startLoad(nextCursor)}>이전 이력 더 보기</button>}</div>
  </section>;
}
