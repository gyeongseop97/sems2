export type CollectionCycle = "월" | "분기" | "반기" | "연" | "수시";
export type CollectionSites = Readonly<Record<string, readonly string[]>>;

export type CollectionTask<TTarget extends string | number> = {
  key: string;
  company: string;
  site?: string;
  targetId: TTarget;
  period: string;
  cycle: CollectionCycle;
};

type MetricRequestLike = {
  periodFrom: string;
  periodTo: string;
  companies: readonly string[];
  sitesByCompany?: CollectionSites;
  indicatorIds: readonly number[];
  taskKeys?: readonly string[];
};
type IndicatorLike = { id: number; cycle: string };
type GHGRequestLike<TScope extends string> = {
  dataFrom: string;
  dataTo: string;
  companies: readonly string[];
  sitesByCompany?: CollectionSites;
  scopes: readonly TScope[];
  taskKeys?: readonly string[];
};

function monthIndex(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return year * 12 + month - 1;
}
function formatMonth(index: number) {
  return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`;
}
function monthsBetween(from: string, to: string) {
  const start = monthIndex(from);
  const end = monthIndex(to);
  if (start === null || end === null || start > end) return [];
  return Array.from({ length: end - start + 1 }, (_, index) => formatMonth(start + index));
}
function normalizeCycle(cycle: string): CollectionCycle {
  return ["월", "분기", "반기", "연", "수시"].includes(cycle) ? cycle as CollectionCycle : "월";
}
function cycleBucket(period: string, cycle: CollectionCycle) {
  const [year, month] = period.split("-").map(Number);
  if (cycle === "분기") return `${year}-Q${Math.ceil(month / 3)}`;
  if (cycle === "반기") return `${year}-H${Math.ceil(month / 6)}`;
  if (cycle === "연") return String(year);
  return period;
}
export function periodsForCollectionCycle(from: string, to: string, cycle: string) {
  const normalizedCycle = normalizeCycle(cycle);
  const months = monthsBetween(from, to);
  if (normalizedCycle === "월" || normalizedCycle === "수시") return months;
  const lastMonthByBucket = new Map<string, string>();
  months.forEach(month => lastMonthByBucket.set(cycleBucket(month, normalizedCycle), month));
  return [...lastMonthByBucket.values()];
}

/** A company without configured sites retains its original company-level task. */
export function collectionSitesForCompany(company: string, sitesByCompany?: CollectionSites): (string | undefined)[] {
  const sites = [...new Set((sitesByCompany?.[company] ?? []).map(site => site.trim()).filter(Boolean))];
  return sites.length ? sites : [undefined];
}

/** Three-part keys are intentionally unchanged for existing saved requests. */
export function collectionTaskKey(company: string, targetId: string | number, period: string, site?: string) {
  const base = `${encodeURIComponent(company)}::${encodeURIComponent(String(targetId))}::${period}`;
  return site ? `${base}::${encodeURIComponent(site)}` : base;
}
export function parseCollectionTaskKey(key: string) {
  const parts = key.split("::");
  if (parts.length !== 3 && parts.length !== 4) return null;
  const [company, targetId, period, site] = parts;
  if (!company || !targetId || monthIndex(period ?? "") === null || (parts.length === 4 && !site)) return null;
  try {
    return { company: decodeURIComponent(company), targetId: decodeURIComponent(targetId), period,
      ...(site ? { site: decodeURIComponent(site) } : {}) };
  } catch { return null; }
}

function taskFromKey<TTarget extends string | number>(key: string, target: TTarget, cycle: CollectionCycle) {
  const parsed = parseCollectionTaskKey(key);
  if (!parsed || String(target) !== parsed.targetId) return null;
  return { key, company: parsed.company, ...(parsed.site ? { site: parsed.site } : {}), targetId: target, period: parsed.period, cycle };
}

export function buildMetricCollectionTasks(request: MetricRequestLike, indicators: readonly IndicatorLike[], useStoredTasks = true): CollectionTask<number>[] {
  const indicatorById = new Map(indicators.map(indicator => [indicator.id, indicator]));
  if (useStoredTasks && request.taskKeys !== undefined) {
    return [...new Set(request.taskKeys)].flatMap(key => {
      const parsed = parseCollectionTaskKey(key);
      const targetId = Number(parsed?.targetId);
      const indicator = indicatorById.get(targetId);
      if (!indicator) return [];
      const task = taskFromKey(key, targetId, normalizeCycle(indicator.cycle));
      return task ? [task] : [];
    });
  }
  return [...new Set(request.companies)].flatMap(company => collectionSitesForCompany(company, request.sitesByCompany).flatMap(site => [...new Set(request.indicatorIds)].flatMap(indicatorId => {
    const indicator = indicatorById.get(indicatorId);
    if (!indicator) return [];
    const cycle = normalizeCycle(indicator.cycle);
    return periodsForCollectionCycle(request.periodFrom, request.periodTo, cycle).map(period => ({
      key: collectionTaskKey(company, indicatorId, period, site), company, ...(site ? { site } : {}), targetId: indicatorId, period, cycle,
    }));
  })));
}

export function buildGHGCollectionTasks<TScope extends string>(request: GHGRequestLike<TScope>, useStoredTasks = true): CollectionTask<TScope>[] {
  if (useStoredTasks && request.taskKeys !== undefined) {
    return [...new Set(request.taskKeys)].flatMap(key => {
      const parsed = parseCollectionTaskKey(key);
      const scope = request.scopes.find(candidate => candidate === parsed?.targetId);
      if (!scope) return [];
      const task = taskFromKey(key, scope, "월");
      return task ? [task] : [];
    });
  }
  return [...new Set(request.companies)].flatMap(company => collectionSitesForCompany(company, request.sitesByCompany).flatMap(site => [...new Set(request.scopes)].flatMap(scope =>
    periodsForCollectionCycle(request.dataFrom, request.dataTo, "월").map(period => ({
      key: collectionTaskKey(company, scope, period, site), company, ...(site ? { site } : {}), targetId: scope, period, cycle: "월" as const,
    })),
  )));
}

export function collectionTaskIsCovered<TTarget extends string | number>(task: CollectionTask<TTarget>, keys: ReadonlySet<string>) {
  if (keys.has(task.key)) return true;
  return Boolean(task.site && keys.has(collectionTaskKey(task.company, task.targetId, task.period)));
}
function collectionTaskOverlaps<TTarget extends string | number>(task: CollectionTask<TTarget>, keys: ReadonlySet<string>) {
  if (collectionTaskIsCovered(task, keys)) return true;
  if (task.site) return false;
  const prefix = `${collectionTaskKey(task.company, task.targetId, task.period)}::`;
  return [...keys].some(key => key.startsWith(prefix));
}
export function classifyCollectionTasks<TTarget extends string | number>(
  candidates: readonly CollectionTask<TTarget>[], existingKeys: ReadonlySet<string>, confirmedKeys: ReadonlySet<string>,
) {
  const unique = [...new Map(candidates.map(task => [task.key, task])).values()];
  const confirmed = unique.filter(task => collectionTaskIsCovered(task, confirmedKeys));
  const existing = unique.filter(task => !collectionTaskIsCovered(task, confirmedKeys) && (collectionTaskOverlaps(task, existingKeys) || collectionTaskOverlaps(task, confirmedKeys)));
  const available = unique.filter(task => !collectionTaskOverlaps(task, confirmedKeys) && !collectionTaskOverlaps(task, existingKeys));
  return { total: unique, available, existing, confirmed };
}
export function countTasksByCycle<TTarget extends string | number>(tasks: readonly CollectionTask<TTarget>[]) {
  return tasks.reduce<Record<CollectionCycle, number>>((counts, task) => {
    counts[task.cycle] += 1;
    return counts;
  }, { 월: 0, 분기: 0, 반기: 0, 연: 0, 수시: 0 });
}
