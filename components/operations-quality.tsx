"use client";

import { useState } from "react";
import type { QualityResolution } from "./operations-workbench";

export type OperationsQualityIssue = {
  key: string; recordId: number; severity: "error" | "warning"; rule: string; detail: string;
  company: string; site: string; period: string; title: string; owner: string; editable: boolean;
  fingerprint: string; resolution?: QualityResolution; resolutionLocked?: boolean;
};

export function OperationsQuality({ issues, checkedCount, onOpenRecord, onResolve }: {
  issues: OperationsQualityIssue[]; checkedCount: number;
  onOpenRecord: (id: number) => void;
  onResolve: (issue: OperationsQualityIssue, reason: string, status: "검토중" | "사유 확인") => void;
}) {
  const [filter, setFilter] = useState("미처리");
  const [severity, setSeverity] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const statusFor = (issue: OperationsQualityIssue) => issue.resolution?.fingerprint === issue.fingerprint ? issue.resolution.status : "미처리";
  const resolved = issues.filter(issue => issue.severity !== "error" && statusFor(issue) === "사유 확인").length;
  const visible = issues.filter(issue => (!severity || issue.severity === severity) && (filter === "전체" || (filter === "미처리" ? statusFor(issue) !== "사유 확인" || issue.severity === "error" : statusFor(issue) === filter)));
  const selected = visible.find(issue => issue.key === selectedKey) ?? visible[0];
  return <section className="operations-quality">
    <div className="operations-summary"><div><span>검사 대상</span><strong>{checkedCount}<small>건</small></strong></div><div><span>수정 필요</span><strong>{issues.filter(issue => issue.severity === "error").length}<small>건</small></strong></div><div><span>확인할 문제</span><strong>{issues.length - resolved}<small>건</small></strong></div><div><span>사유 확인</span><strong>{resolved}<small>건</small></strong></div></div>
    <div className="card"><div className="operations-filters"><label>처리 상태<select value={filter} onChange={event => setFilter(event.target.value)}><option>미처리</option><option>검토중</option><option>사유 확인</option><option>전체</option></select></label><label>중요도<select value={severity} onChange={event => setSeverity(event.target.value)}><option value="">전체 중요도</option><option value="error">수정 필요</option><option value="warning">확인 필요</option></select></label><p className="operations-help">값이 바뀌면 이전 확인은 자동으로 무효화됩니다. 오류는 원래 값을 수정해야 해소됩니다.</p></div>
      <div className="table-scroll"><table className="data-table operations-quality-table"><thead><tr><th>중요도 / 상태</th><th>검사 규칙</th><th>법인 / 사업장</th><th>기준월</th><th>자료 / 담당자</th><th>조치</th></tr></thead><tbody>{visible.map(issue => <tr key={issue.key} className={selected?.key === issue.key ? "selected" : ""}><td><strong className={issue.severity === "error" ? "danger-text" : ""}>{issue.severity === "error" ? "수정 필요" : "확인 필요"}</strong><span>{statusFor(issue)}</span></td><td><strong>{issue.rule}</strong><span>{issue.detail}</span></td><td><strong>{issue.company}</strong><span>{issue.site}</span></td><td>{issue.period}</td><td><strong>{issue.title}</strong><span>{issue.owner}</span></td><td><button type="button" className="outline-small" onClick={() => setSelectedKey(issue.key)}>문제 확인</button></td></tr>)}</tbody></table>{!visible.length && <div className="operations-empty"><strong>조건에 해당하는 문제가 없습니다.</strong></div>}</div>
    </div>
    {selected && <IssueResolution key={`${selected.key}:${selected.fingerprint}:${selected.resolution?.updatedAt ?? ""}`} issue={selected} onOpenRecord={onOpenRecord} onResolve={onResolve} />}
  </section>;
}

function IssueResolution({ issue, onOpenRecord, onResolve }: { issue: OperationsQualityIssue; onOpenRecord: (id: number) => void; onResolve: (issue: OperationsQualityIssue, reason: string, status: "검토중" | "사유 확인") => void }) {
  const current = issue.resolution?.fingerprint === issue.fingerprint ? issue.resolution : undefined;
  const [reason, setReason] = useState(current?.reason ?? "");
  const [error, setError] = useState("");
  const save = (status: "검토중" | "사유 확인") => { if (issue.resolutionLocked) return; if (!reason.trim()) { setError("확인한 내용과 변동 사유 또는 조치 계획을 입력해 주세요."); return; } onResolve(issue, reason.trim(), status); };
  return <article className="card operations-resolution"><div className="operations-detail-head"><div><span className="operations-eyebrow">{issue.company} · {issue.site} · {issue.period}</span><h2>{issue.rule}</h2><p>{issue.detail}</p></div><button type="button" className="secondary-button" onClick={() => onOpenRecord(issue.recordId)} disabled={!issue.editable}>관련 입력 수정</button></div><div className="operations-review-footer"><label>확인 사유·조치 계획<textarea value={reason} disabled={issue.resolutionLocked} onChange={event => { setReason(event.target.value); setError(""); }} placeholder="생산량·가동일 변화, 단위 확인 결과, 수정 계획 등 구체적인 사유를 적어 주세요." /></label>{error && <p role="alert" className="form-error">{error}</p>}{issue.resolutionLocked && <p className="operations-help">마감 또는 잠금된 수집기간의 확인 내용은 읽기 전용입니다. 수집기간을 다시 열고 서버 저장을 완료한 후 수정할 수 있습니다.</p>}{!issue.editable && !issue.resolutionLocked && <p className="operations-help">확정 또는 마감된 자료입니다. 수정이 필요하면 수집 기간과 자료 잠금을 먼저 확인하세요.</p>}<div><span className="operations-help">{current ? `${current.actor} · ${current.updatedAt}` : "처리 기록 없음"}</span><button type="button" className="secondary-button" disabled={issue.resolutionLocked} onClick={() => save("검토중")}>검토중으로 저장</button><button type="button" className="primary-button" disabled={issue.severity === "error" || issue.resolutionLocked} onClick={() => save("사유 확인")}>사유 확인 완료</button></div></div></article>}
