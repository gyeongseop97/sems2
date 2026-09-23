import { collectionSitesForCompany, collectionTaskKey, parseCollectionTaskKey, periodsForCollectionCycle, type CollectionSites } from "./collection-task-expansion";
import type { DataStatus } from "./metric-aggregation";

export type CoverageStatus = "미요청" | "미입력" | "작성중" | "검토대기" | "반려" | "확정";
export type CoverageItem<TTarget extends string | number> = {
  month: string;
  company: string;
  site?: string;
  targetId: TTarget;
  status: CoverageStatus;
  dataStatus?: DataStatus;
  overdue: boolean;
  requestIds: string[];
};
type CoverageRequest<TTarget extends string | number> = {
  id: string;
  periodFrom: string;
  periodTo: string;
  dueDate: string;
  companies: readonly string[];
  sitesByCompany?: CollectionSites;
  targetIds: readonly TTarget[];
  taskKeys?: readonly string[];
};
type CoverageRecord<TTarget extends string | number> = {
  requestId?: string;
  company: string;
  site?: string;
  month: string;
  targetId: TTarget;
  status: Exclude<CoverageStatus, "미요청" | "미입력">;
  dataStatus?: DataStatus;
  active?: boolean;
};
export type CoverageCounts = Record<CoverageStatus | "기한초과", number>;
const incompletePriority: CoverageStatus[] = ["반려", "검토대기", "작성중"];

export function monthsForYear(year: string) {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}
export function monthsForCycle(year: string, cycle: string, requestedMonths: readonly string[] = []) {
  const months = monthsForYear(year);
  if (cycle === "분기") return months.filter(month => ["03", "06", "09", "12"].includes(month.slice(-2)));
  if (cycle === "반기") return months.filter(month => ["06", "12"].includes(month.slice(-2)));
  if (cycle === "연") return months.filter(month => month.endsWith("-12"));
  if (cycle === "수시") return [...new Set(requestedMonths.filter(month => month.startsWith(`${year}-`)))].sort();
  return months;
}

function requestIncludes<TTarget extends string | number>(request: CoverageRequest<TTarget>, month: string, company: string, targetId: TTarget, site?: string) {
  if (request.taskKeys !== undefined) {
    if (request.taskKeys.includes(collectionTaskKey(company, targetId, month, site))) return true;
    // A saved company-level task covers every registered site, never just the first submitted site.
    if (!request.taskKeys.includes(collectionTaskKey(company, targetId, month))) return false;
  } else if (!(request.periodFrom <= month && request.periodTo >= month && request.companies.includes(company) && request.targetIds.includes(targetId))) return false;
  const requestedSites = request.sitesByCompany?.[company]?.filter(Boolean);
  return !requestedSites?.length || (site !== undefined && requestedSites.includes(site));
}
function recordStatus(rows: readonly CoverageRecord<string | number>[]): CoverageStatus {
  if (!rows.length || rows.some(row => row.dataStatus === "missing")) return "미입력";
  if (rows.every(row => row.status === "확정")) return "확정";
  return incompletePriority.find(status => rows.some(row => row.status === status)) ?? "작성중";
}
function combinedDataStatus(rows: readonly CoverageRecord<string | number>[]): DataStatus {
  if (!rows.length || rows.some(row => row.dataStatus === "missing")) return "missing";
  if (rows.some(row => row.dataStatus === "estimated")) return "estimated";
  if (rows.every(row => row.dataStatus === "not_applicable")) return "not_applicable";
  if (rows.every(row => row.dataStatus === "zero" || row.dataStatus === "not_applicable")) return "zero";
  return "actual";
}
function sitesForCoverage<TTarget extends string | number>(company: string, sitesByCompany: CollectionSites | undefined, requests: readonly CoverageRequest<TTarget>[], rows: readonly CoverageRecord<TTarget>[]) {
  const sites = [...new Set([
    ...(sitesByCompany?.[company] ?? []),
    ...requests.flatMap(request => request.sitesByCompany?.[company] ?? []),
    ...requests.flatMap(request => (request.taskKeys ?? []).flatMap(key => {
      const parsed = parseCollectionTaskKey(key);
      return parsed?.company === company && parsed.site ? [parsed.site] : [];
    })),
    ...rows.filter(row => row.company === company && row.active !== false).flatMap(row => row.site ? [row.site] : []),
  ].filter(Boolean))];
  return collectionSitesForCompany(company, { [company]: sites });
}
function coverageCell<TTarget extends string | number>(month: string, company: string, targetId: TTarget, site: string | undefined, requests: readonly CoverageRequest<TTarget>[], rows: readonly CoverageRecord<TTarget>[], today: string): CoverageItem<TTarget> {
  const matchingRequests = requests.filter(request => requestIncludes(request, month, company, targetId, site));
  const base = { month, company, ...(site ? { site } : {}), targetId };
  if (!matchingRequests.length) return { ...base, status: "미요청", dataStatus: "missing", overdue: false, requestIds: [] };
  const requestIds = matchingRequests.map(request => request.id);
  const matchingRecords = rows.filter(row => row.active !== false && row.requestId !== undefined && requestIds.includes(row.requestId)
    && row.company === company && row.month === month && row.targetId === targetId && (!site || row.site === site));
  const status = recordStatus(matchingRecords);
  return { ...base, status, dataStatus: combinedDataStatus(matchingRecords), requestIds,
    overdue: status !== "확정" && matchingRequests.some(request => Boolean(request.dueDate) && request.dueDate < today) };
}

export function buildGHGCoverage<TTarget extends string>({ year, companies, sitesByCompany, targetIds, requests, records, today }: {
  year: string;
  companies: readonly string[];
  sitesByCompany?: CollectionSites;
  targetIds: readonly TTarget[];
  requests: readonly CoverageRequest<TTarget>[];
  records: readonly CoverageRecord<TTarget>[];
  today: string;
}): CoverageItem<TTarget>[] {
  return monthsForYear(year).flatMap(month => [...new Set(companies)].flatMap(company => sitesForCoverage(company, sitesByCompany, requests, records).flatMap(site => [...new Set(targetIds)].map(targetId =>
    coverageCell(month, company, targetId, site, requests, records, today),
  ))));
}

export function buildMetricCoverage<TTarget extends number>({ year, companies, sitesByCompany, targetIds, requests, submissions, targetCycles, today }: {
  year: string;
  companies: readonly string[];
  sitesByCompany?: CollectionSites;
  targetIds: readonly TTarget[];
  requests: readonly CoverageRequest<TTarget>[];
  submissions: readonly CoverageRecord<TTarget>[];
  targetCycles: Partial<Record<TTarget, string>>;
  today: string;
}): CoverageItem<TTarget>[] {
  return [...new Set(targetIds)].flatMap(targetId => {
    const cycle = targetCycles[targetId] ?? "월";
    const requestedMonths = requests.flatMap(request => request.taskKeys !== undefined
      ? request.taskKeys.flatMap(key => {
        const parsed = parseCollectionTaskKey(key);
        return parsed?.targetId === String(targetId) && parsed.period.startsWith(`${year}-`) ? [parsed.period] : [];
      })
      : request.targetIds.includes(targetId) ? periodsForCollectionCycle(request.periodFrom, request.periodTo, cycle).filter(month => month.startsWith(`${year}-`)) : []);
    // Partial-quarter and partial-year requests may end before a normal cycle boundary.
    const months = [...new Set([...monthsForCycle(year, cycle, requestedMonths), ...requestedMonths])].sort();
    return months.flatMap(month => [...new Set(companies)].flatMap(company => sitesForCoverage(company, sitesByCompany, requests, submissions).map(site =>
      coverageCell(month, company, targetId, site, requests.filter(request => request.taskKeys !== undefined || periodsForCollectionCycle(request.periodFrom, request.periodTo, cycle).includes(month)), submissions, today),
    )));
  });
}

export function countCoverage<TTarget extends string | number>(items: readonly CoverageItem<TTarget>[]): CoverageCounts {
  const counts: CoverageCounts = { 미요청: 0, 미입력: 0, 작성중: 0, 검토대기: 0, 반려: 0, 확정: 0, 기한초과: 0 };
  items.forEach(item => { counts[item.status] += 1; if (item.overdue) counts.기한초과 += 1; });
  return counts;
}
export function coverageDisplayStatus<TTarget extends string | number>(items: readonly CoverageItem<TTarget>[]) {
  if (items.some(item => item.overdue)) return "기한초과";
  return ["반려", "검토대기", "작성중", "미입력", "미요청", "확정"].find(status => items.some(item => item.status === status)) ?? "미요청";
}
