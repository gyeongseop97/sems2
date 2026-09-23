"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export type ReviewHistoryEntry = { at: string; actor: string; action: string; note: string };
export type QualityResolution = { reason: string; status: "검토중" | "사유 확인"; updatedAt: string; actor: string; fingerprint: string };
export type OperationCheck = { title: string; detail: string; severity: "error" | "warning" | "pass" };
export type OperationReviewRow = {
  id: number; title: string; company: string; site: string; period: string; status: string;
  owner: string; department: string; value: string; dataStatus: string; description?: string;
  reviewNote?: string; reviewedAt?: string; reviewedBy?: string; rejectionReason?: string;
  updatedAt: string; locked?: boolean; resubmitted?: boolean; facts: { label: string; value: string }[];
  checks: OperationCheck[]; history?: ReviewHistoryEntry[]; detail?: ReactNode;
};

export function OperationsWorkbench({ rows, onAction }: {
  rows: OperationReviewRow[];
  onAction: (id: number, action: "approve" | "reject" | "note", note: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState("");
  const [period, setPeriod] = useState("");
  const [status, setStatus] = useState("검토대기");
  const companies = [...new Set(rows.map(row => row.company))].sort();
  const periods = [...new Set(rows.map(row => row.period))].sort().reverse();
  const visible = rows.filter(row => (!company || row.company === company) && (!period || row.period === period)
    && (!status || row.status === status) && `${row.title} ${row.company} ${row.site} ${row.owner}`.toLowerCase().includes(query.toLowerCase()));
  const selected = visible.find(row => row.id === selectedId) ?? visible[0];
  return <section className="operations-board" aria-label="제출자료 검토 작업함">
    <div className="operations-summary">{["검토대기", "반려", "확정"].map(value => <button type="button" key={value} className={status === value ? "active" : ""} onClick={() => setStatus(value)}>
      <span>{value === "반려" ? "보완 요청" : value}</span><strong>{rows.filter(row => row.status === value).length}<small>건</small></strong>
    </button>)}<div><span>변동 사유 확인</span><strong>{rows.filter(row => row.status === "검토대기" && row.checks.some(check => check.severity === "warning")).length}<small>건</small></strong></div></div>
    <div className="operations-filters card">
      <label className="operations-search"><span>자료 찾기</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="지표·배출원, 사업장, 담당자 검색" /></label>
      <label><span>법인</span><select value={company} onChange={event => setCompany(event.target.value)}><option value="">전체 법인</option>{companies.map(value => <option key={value}>{value}</option>)}</select></label>
      <label><span>기준월</span><select value={period} onChange={event => setPeriod(event.target.value)}><option value="">전체 기간</option>{periods.map(value => <option key={value}>{value}</option>)}</select></label>
      <label><span>처리 상태</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="">전체 상태</option>{["검토대기", "반려", "확정", "작성중"].map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <div className="operations-workspace">
      <aside className="card operations-queue"><div className="operations-section-title"><strong>검토 목록</strong><span>{visible.length}건</span></div>
        <div className="operations-queue-items">{visible.map(row => <button type="button" key={row.id} className={selected?.id === row.id ? "active" : ""} onClick={() => setSelectedId(row.id)} aria-pressed={selected?.id === row.id}>
          <div><span className={`operations-tag ${row.status === "반려" ? "warning" : row.status === "확정" ? "success" : ""}`}>{row.resubmitted && row.status === "검토대기" ? "재제출" : row.status}</span><span>{row.period}</span></div>
          <strong>{row.title}</strong><p>{row.company} · {row.site || "사업장 미지정"}</p><div><span>{row.owner}</span><b>{row.dataStatus === "해당 없음" ? row.dataStatus : row.value}</b></div>
        </button>)}{!visible.length && <div className="operations-empty"><strong>조건에 맞는 자료가 없습니다.</strong><p>다른 상태나 기간을 선택해 보세요.</p></div>}</div>
      </aside>
      {selected ? <ReviewDetail key={`${selected.id}:${selected.reviewedAt ?? ""}`} row={selected} onAction={onAction} /> : <article className="card operations-empty operations-detail"><strong>검토할 자료가 없습니다.</strong><p>제출자료가 등록되면 계산 근거와 검사 결과를 함께 확인할 수 있습니다.</p></article>}
    </div>
  </section>;
}

function ReviewDetail({ row, onAction }: { row: OperationReviewRow; onAction: (id: number, action: "approve" | "reject" | "note", note: string) => void }) {
  const [tab, setTab] = useState("근거·산정");
  const [note, setNote] = useState(row.reviewNote ?? "");
  const [error, setError] = useState("");
  const blocked = row.locked || row.status !== "검토대기";
  const hasError = row.checks.some(check => check.severity === "error");
  const action = (value: "approve" | "reject" | "note") => {
    if ((value === "reject" || value === "note") && !note.trim()) { setError("검토 의견을 입력해 주세요. 보완 요청에는 수정할 내용을 적어 주세요."); return; }
    setError(""); onAction(row.id, value, note.trim());
  };
  return <article className="card operations-detail">
    <header className="operations-detail-head"><div><span className="operations-eyebrow">{row.company} / {row.site || "사업장 미지정"} · {row.period}</span><h2>{row.title}</h2><p>{row.owner} · {row.department} <span className="operations-tag">{row.dataStatus}</span></p></div><div className="operations-number"><strong>{row.dataStatus === "해당 없음" ? "해당 없음" : row.value}</strong><span>{row.status}{row.locked ? " · 기간 잠금" : ""}</span></div></header>
    <div className="operations-tabs" role="tablist" aria-label="검토 상세">{["근거·산정", "검증", "변경·검토 정보"].map(value => <button type="button" key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{value}{value === "검증" && <span>{row.checks.filter(check => check.severity !== "pass").length}</span>}</button>)}</div>
    <div className="operations-detail-body" role="tabpanel" aria-label={tab}>
      {tab === "근거·산정" && <><dl className="operations-facts">{row.facts.map((fact, index) => <div key={`${fact.label}-${index}`}><dt>{fact.label}</dt><dd>{fact.value || "미입력"}</dd></div>)}</dl>{row.detail}<div className="operations-description"><h3>입력 설명·변동 사유</h3><p>{row.description || "입력자가 남긴 설명이 없습니다."}</p></div>{row.rejectionReason && <div className="operations-callout warning"><strong>이전 보완 요청</strong><p>{row.rejectionReason}</p></div>}</>}
      {tab === "검증" && <div className="operations-checks">{row.checks.map((check, index) => <div key={`${check.title}-${index}`} className={`operations-check ${check.severity}`}><span aria-hidden="true">{check.severity === "pass" ? "✓" : "!"}</span><div><strong>{check.title}</strong><p>{check.detail}</p></div><small>{check.severity === "error" ? "수정 필요" : check.severity === "warning" ? "검토 필요" : "통과"}</small></div>)}<p className="operations-help">자동 검증은 입력값의 형식과 일관성을 검사합니다. 의미상 적정성은 담당자가 검토해야 합니다.</p></div>}
      {tab === "변경·검토 정보" && <><dl className="operations-facts"><div><dt>최근 자료 변경</dt><dd>{row.updatedAt}</dd></div><div><dt>최근 검토자</dt><dd>{row.reviewedBy || "검토 기록 없음"}</dd></div><div><dt>최근 검토 시각</dt><dd>{row.reviewedAt || "—"}</dd></div></dl><div className="operations-history">{row.history?.length ? [...row.history].reverse().map((item, index) => <div key={`${item.at}-${index}`}><strong>{item.action}</strong><span>{item.actor} · {item.at}</span><p>{item.note || "별도 의견 없음"}</p></div>) : <p>이 자료에 저장된 검토 이력이 없습니다. 전체 변경 이력은 감사 로그에서 확인하세요.</p>}</div></>}
    </div>
    <div className="operations-review-footer"><label>검토 의견<textarea value={note} onChange={event => { setNote(event.target.value); setError(""); }} placeholder="산정 기준과 변동 사유의 확인 결과, 보완할 내용을 기록하세요." disabled={row.locked} /></label>{error && <p role="alert" className="form-error">{error}</p>}{hasError && row.status === "검토대기" && <p className="form-error">수정이 필요한 검증 오류가 있습니다. 보완 요청 후 다시 검토해 주세요.</p>}<div><span className="operations-help">의견과 처리 결과는 자료에 함께 저장됩니다.</span><button type="button" className="secondary-button" onClick={() => action("note")} disabled={row.locked}>의견 저장</button><button type="button" className="danger-button" onClick={() => action("reject")} disabled={blocked}>보완 요청</button><button type="button" className="primary-button" onClick={() => action("approve")} disabled={blocked || hasError}>검토 확정</button></div></div>
  </article>;
}

export function DataStatusFields({ value, status, description, onChange }: { value: number; status?: string; description?: string; onChange: (status: "actual" | "zero" | "not_applicable" | "estimated") => void }) {
  const resolved = status ?? (value === 0 ? "zero" : "actual");
  return <div className="operations-data-status"><label>자료 구분<select value={resolved === "missing" ? "actual" : resolved} onChange={event => onChange(event.target.value as "actual" | "zero" | "not_applicable" | "estimated")}><option value="actual">실측값</option><option value="zero">실측 0</option><option value="not_applicable">해당 없음</option><option value="estimated">추정값</option></select></label><p>{resolved === "zero" ? "실제로 사용량·발생량이 없음을 확인한 값입니다." : resolved === "not_applicable" ? "집계에서 제외합니다. 입력 설명에 해당하지 않는 사유를 적어 주세요." : resolved === "estimated" ? "집계에 포함하되 추정값으로 표시합니다. 추정 방법과 가정을 설명해 주세요." : "확인한 실제 수치를 입력하세요. 미입력은 0으로 처리하지 않습니다."}{["estimated", "not_applicable"].includes(resolved) && !description?.trim() && <strong> 사유 입력이 필요합니다.</strong>}</p></div>;
}
