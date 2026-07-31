export type CoverageStatus = "미요청" | "미입력" | "작성중" | "검토대기" | "반려" | "확정";

export type CoverageItem<TTarget extends string | number> = {
  month: string;
  company: string;
  targetId: TTarget;
  status: CoverageStatus;
  overdue: boolean;
  requestIds: string[];
};

type GHGRequest<TTarget extends string> = {
  id: string;
  periodFrom: string;
  periodTo: string;
  dueDate: string;
  companies: string[];
  targetIds: TTarget[];
};

type GHGRecord<TTarget extends string> = {
  requestId?: string;
  company: string;
  month: string;
  targetId: TTarget;
  status: Exclude<CoverageStatus, "미요청" | "미입력">;
  active?: boolean;
};

type MetricRequest<TTarget extends number> = {
  id: string;
  periodFrom: string;
  periodTo: string;
  dueDate: string;
  companies: string[];
  targetIds: TTarget[];
};

type MetricSubmission<TTarget extends number> = {
  requestId: string;
  company: string;
  month: string;
  targetId: TTarget;
  status: Exclude<CoverageStatus, "미요청" | "미입력">;
};

export type CoverageCounts = Record<CoverageStatus | "기한초과", number>;

const incompletePriority: CoverageStatus[] = ["반려", "검토대기", "작성중"];

export function monthsForYear(year: string) {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

export function monthsForCycle(year: string, cycle: string, requestedMonths: string[] = []) {
  const months = monthsForYear(year);
  if (cycle === "분기") return months.filter(month => ["03", "06", "09", "12"].includes(month.slice(-2)));
  if (cycle === "반기") return months.filter(month => ["06", "12"].includes(month.slice(-2)));
  if (cycle === "연") return months.filter(month => month.endsWith("-12"));
  if (cycle === "수시") return [...new Set(requestedMonths.filter(month => month.startsWith(`${year}-`)))].sort();
  return months;
}

function requestIncludes<TTarget extends string | number>(
  request: { periodFrom: string; periodTo: string; companies: string[]; targetIds: TTarget[] },
  month: string,
  company: string,
  targetId: TTarget,
) {
  return request.periodFrom <= month
    && request.periodTo >= month
    && request.companies.includes(company)
    && request.targetIds.includes(targetId);
}

function recordStatus(
  rows: { status: Exclude<CoverageStatus, "미요청" | "미입력"> }[],
): CoverageStatus {
  if (!rows.length) return "미입력";
  if (rows.every(row => row.status === "확정")) return "확정";
  return incompletePriority.find(status => rows.some(row => row.status === status)) ?? "작성중";
}

function isOverdue(
  status: CoverageStatus,
  requests: { dueDate: string }[],
  today: string,
) {
  return status !== "확정" && requests.some(request => Boolean(request.dueDate) && request.dueDate < today);
}

export function buildGHGCoverage<TTarget extends string>({
  year,
  companies,
  targetIds,
  requests,
  records,
  today,
}: {
  year: string;
  companies: string[];
  targetIds: TTarget[];
  requests: GHGRequest<TTarget>[];
  records: GHGRecord<TTarget>[];
  today: string;
}): CoverageItem<TTarget>[] {
  return monthsForYear(year).flatMap(month => companies.flatMap(company => targetIds.map(targetId => {
    const matchingRequests = requests.filter(request => requestIncludes(request, month, company, targetId));
    if (!matchingRequests.length) {
      return { month, company, targetId, status: "미요청" as const, overdue: false, requestIds: [] };
    }
    const requestIds = matchingRequests.map(request => request.id);
    const matchingRecords = records.filter(record => record.active !== false
      && record.requestId !== undefined
      && requestIds.includes(record.requestId)
      && record.company === company
      && record.month === month
      && record.targetId === targetId);
    const status = recordStatus(matchingRecords);
    return {
      month,
      company,
      targetId,
      status,
      overdue: isOverdue(status, matchingRequests, today),
      requestIds,
    };
  })));
}

export function buildMetricCoverage<TTarget extends number>({
  year,
  companies,
  targetIds,
  requests,
  submissions,
  targetCycles,
  today,
}: {
  year: string;
  companies: string[];
  targetIds: TTarget[];
  requests: MetricRequest<TTarget>[];
  submissions: MetricSubmission<TTarget>[];
  targetCycles: Partial<Record<TTarget, string>>;
  today: string;
}): CoverageItem<TTarget>[] {
  return targetIds.flatMap(targetId => {
    const requestedMonths = requests
      .filter(request => request.targetIds.includes(targetId))
      .flatMap(request => monthsForYear(year).filter(month => request.periodFrom <= month && request.periodTo >= month));
    return monthsForCycle(year, targetCycles[targetId] ?? "월", requestedMonths).flatMap(month => companies.map(company => {
    const matchingRequests = requests.filter(request => requestIncludes(request, month, company, targetId));
    if (!matchingRequests.length) {
      return { month, company, targetId, status: "미요청" as const, overdue: false, requestIds: [] };
    }
    const requestIds = matchingRequests.map(request => request.id);
    const matchingSubmissions = submissions.filter(submission => requestIds.includes(submission.requestId)
      && submission.company === company
      && submission.month === month
      && submission.targetId === targetId);
    const status = recordStatus(matchingSubmissions);
    return {
      month,
      company,
      targetId,
      status,
      overdue: isOverdue(status, matchingRequests, today),
      requestIds,
    };
    }));
  });
}

export function countCoverage<TTarget extends string | number>(items: CoverageItem<TTarget>[]): CoverageCounts {
  const counts: CoverageCounts = {
    미요청: 0,
    미입력: 0,
    작성중: 0,
    검토대기: 0,
    반려: 0,
    확정: 0,
    기한초과: 0,
  };
  items.forEach(item => {
    counts[item.status] += 1;
    if (item.overdue) counts.기한초과 += 1;
  });
  return counts;
}

export function coverageDisplayStatus<TTarget extends string | number>(items: CoverageItem<TTarget>[]) {
  if (items.some(item => item.overdue)) return "기한초과";
  return ["반려", "검토대기", "작성중", "미입력", "미요청", "확정"]
    .find(status => items.some(item => item.status === status)) ?? "미요청";
}
