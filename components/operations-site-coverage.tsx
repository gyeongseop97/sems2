"use client";

import { useMemo, useState } from "react";
import { countCoverage, coverageDisplayStatus, type CoverageItem } from "../lib/collection-coverage";
import { DATA_STATUS_LABELS } from "../lib/metric-aggregation";
import styles from "./operations-site-coverage.module.css";

type Item = CoverageItem<string | number>;
type Props = {
  kind: "ghg" | "esg";
  year: string;
  sitesByCompany: Record<string, string[]>;
  items: Item[];
  targetLabel: (id: string | number) => string;
  onSelect: (item: Item) => void;
};
const siteKey = (company: string, site?: string) => JSON.stringify([company, site ?? ""]);
const cellKey = (company: string, site: string | undefined, month: string) => JSON.stringify([company, site ?? "", month]);
function statusClass(status: string) {
  if (status === "확정") return styles.confirmed;
  if (status === "반려" || status === "기한초과") return styles.problem;
  if (status === "검토대기" || status === "작성중") return styles.pending;
  return styles.missing;
}

export function OperationsSiteCoverage({ kind, year, sitesByCompany, items, targetLabel, onSelect }: Props) {
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`), [year]);
  const groups = useMemo(() => {
    const rows = new Map<string, { company: string; site?: string }>();
    Object.entries(sitesByCompany).forEach(([company, sites]) => {
      if (!sites.length) rows.set(siteKey(company), { company });
      else sites.forEach(site => rows.set(siteKey(company, site), { company, site }));
    });
    items.forEach(item => rows.set(siteKey(item.company, item.site), { company: item.company, site: item.site }));
    return [...rows.values()].sort((a, b) => a.company.localeCompare(b.company, "ko") || (a.site ?? "").localeCompare(b.site ?? "", "ko"));
  }, [items, sitesByCompany]);
  const byCell = useMemo(() => {
    const cells = new Map<string, Item[]>();
    items.forEach(item => {
      const key = cellKey(item.company, item.site, item.month);
      cells.set(key, [...(cells.get(key) ?? []), item]);
    });
    return cells;
  }, [items]);
  const requestedItems = items.filter(item => item.status !== "미요청");
  const counts = countCoverage(requestedItems);
  const firstRequested = requestedItems.find(item => item.status !== "확정") ?? requestedItems[0];
  const defaultCell = firstRequested ? cellKey(firstRequested.company, firstRequested.site, firstRequested.month) : null;
  const activeCell = selectedCell && byCell.has(selectedCell) ? selectedCell : defaultCell;
  const selected = activeCell ? byCell.get(activeCell) ?? [] : [];
  const selectedHead = selected[0];
  const completion = requestedItems.length ? Math.round(counts.확정 / requestedItems.length * 100) : 0;
  const estimated = requestedItems.filter(item => item.dataStatus === "estimated").length;

  return <section className={styles.panel} aria-label="사업장별 수집 현황">
    <div className={styles.heading}>
      <div><span className={styles.eyebrow}>{kind === "ghg" ? "온실가스" : "ESG 정량지표"} · {year}년</span><h2>사업장별 수집 현황</h2><p>월을 선택하면 요청 항목과 입력 상태를 확인할 수 있습니다.</p></div>
      <div className={styles.completion}><strong>{completion}<small>%</small></strong><span>요청 {requestedItems.length}건 중 {counts.확정}건 확정</span></div>
    </div>
    <div className={styles.summary}>
      <span>미입력 <strong>{counts.미입력}</strong></span><span>검토 대기 <strong>{counts.검토대기}</strong></span><span>기한 초과 <strong>{counts.기한초과}</strong></span><span>추정 포함 <strong>{estimated}</strong></span>
    </div>
    <div className={styles.tableScroll}><table className={styles.table}>
      <caption className={styles.srOnly}>{year}년 법인·사업장별 월간 요청·제출 상태</caption>
      <thead><tr><th scope="col">법인 / 사업장</th>{months.map(month => <th scope="col" key={month}>{Number(month.slice(-2))}월</th>)}</tr></thead>
      <tbody>{groups.map(group => <tr key={siteKey(group.company, group.site)}><th scope="row"><strong>{group.company}</strong><span>{group.site ?? "법인 공통"}</span></th>{months.map(month => {
        const key = cellKey(group.company, group.site, month);
        const cell = byCell.get(key) ?? [];
        const requested = cell.filter(item => item.status !== "미요청");
        const status = coverageDisplayStatus(requested.length ? requested : cell);
        const done = requested.filter(item => item.status === "확정").length;
        return <td key={month}><button type="button" className={`${styles.cell} ${statusClass(status)} ${activeCell === key ? styles.selected : ""}`} disabled={!cell.length} aria-pressed={activeCell === key} aria-label={`${group.company} ${group.site ?? "법인 공통"} ${Number(month.slice(-2))}월 ${status}, ${requested.length}건 중 ${done}건 확정`} onClick={() => setSelectedCell(key)}><span>{cell.length ? status : "—"}</span><small>{requested.length ? `${done}/${requested.length}` : "요청 없음"}</small></button></td>;
      })}</tr>)}</tbody>
    </table></div>
    {!groups.length && <p className={styles.empty}>등록된 법인·사업장이 없습니다.</p>}
    <div className={styles.legend}><span><i className={styles.confirmed}/>확정</span><span><i className={styles.pending}/>작성·검토 중</span><span><i className={styles.problem}/>반려·기한 초과</span><span><i className={styles.missing}/>미입력·미요청</span><small>사업장별 모든 요청 항목이 확정되어야 완료로 표시됩니다.</small></div>
    <div className={styles.details}>
      <div className={styles.detailHeading}><h3>{selectedHead ? `${selectedHead.company} · ${selectedHead.site ?? "법인 공통"} · ${Number(selectedHead.month.slice(-2))}월` : "항목 상세"}</h3><span>{selected.length}개 항목</span></div>
      {selected.length ? <ul className={styles.list}>{selected.map(item => <li key={`${item.targetId}-${item.month}-${item.site ?? ""}`}>
        <div className={styles.itemTitle}><strong>{targetLabel(item.targetId)}</strong><span>{item.requestIds.length ? `연결 요청 ${item.requestIds.length}건` : "수집 요청이 없습니다"}</span></div>
        <div className={styles.badges}><span className={`${styles.badge} ${statusClass(item.overdue ? "기한초과" : item.status)}`}>{item.overdue ? `기한초과 · ${item.status}` : item.status}</span>{item.status !== "미요청" && <span className={`${styles.badge} ${item.dataStatus === "estimated" ? styles.pending : styles.neutral}`}>{DATA_STATUS_LABELS[item.dataStatus ?? (item.status === "미입력" ? "missing" : "actual")]}</span>}</div>
        <button className={styles.openButton} type="button" onClick={() => onSelect(item)}>{item.status === "미요청" ? "요청 확인" : item.status === "미입력" || item.status === "반려" ? "입력하기" : "자료 보기"}<span aria-hidden="true"> →</span></button>
      </li>)}</ul> : <p className={styles.empty}>수집 요청을 만들면 사업장별 진행 상황이 표시됩니다.</p>}
    </div>
  </section>;
}
export default OperationsSiteCoverage;
