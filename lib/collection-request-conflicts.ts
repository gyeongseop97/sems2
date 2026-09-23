import { collectionSitesForCompany, collectionTaskKey, parseCollectionTaskKey, periodsForCollectionCycle, type CollectionSites } from "./collection-task-expansion";

export type CollectionRequestTarget = string | number;
export type CollectionRequestInput<TTarget extends CollectionRequestTarget> = {
  id: string;
  title: string;
  periodFrom: string;
  periodTo: string;
  companies: readonly string[];
  sitesByCompany?: CollectionSites;
  targetIds: readonly TTarget[];
  taskKeys?: readonly string[];
  status: string;
};
export type CollectionRequestConflict<TTarget extends CollectionRequestTarget> = {
  requestId: string;
  title: string;
  status: string;
  months: string[];
  companies: string[];
  sites?: string[];
  targetIds: TTarget[];
  duplicateCount: number;
};

function tasksForRequest<TTarget extends CollectionRequestTarget>(request: CollectionRequestInput<TTarget>) {
  if (request.taskKeys !== undefined) return [...new Set(request.taskKeys)].flatMap(key => {
    const parsed = parseCollectionTaskKey(key);
    if (!parsed) return [];
    const targetId = request.targetIds.find(target => String(target) === parsed.targetId);
    return targetId === undefined ? [] : [{ ...parsed, targetId }];
  });
  return [...new Set(request.companies)].flatMap(company => collectionSitesForCompany(company, request.sitesByCompany).flatMap(site => [...new Set(request.targetIds)].flatMap(targetId =>
    periodsForCollectionCycle(request.periodFrom, request.periodTo, "월").map(period => ({ company, site, targetId, period })),
  )));
}

export function findCollectionRequestConflicts<TTarget extends CollectionRequestTarget>(candidate: CollectionRequestInput<TTarget>, existing: readonly CollectionRequestInput<TTarget>[]) {
  const candidateTasks = tasksForRequest(candidate);
  return existing.flatMap<CollectionRequestConflict<TTarget>>(request => {
    if (request.id === candidate.id) return [];
    const requestTasks = tasksForRequest(request);
    const overlaps = new Map<string, { company: string; site?: string; targetId: TTarget; period: string }>();
    const requestIndex = new Map<string, typeof requestTasks>();
    for (const task of requestTasks) {
      const key = collectionTaskKey(task.company, task.targetId, task.period);
      requestIndex.set(key, [...(requestIndex.get(key) ?? []), task]);
    }
    for (const task of candidateTasks) {
      for (const other of requestIndex.get(collectionTaskKey(task.company, task.targetId, task.period)) ?? []) {
        if (task.site && other.site && task.site !== other.site) continue;
        const site = task.site ?? other.site;
        overlaps.set(collectionTaskKey(task.company, task.targetId, task.period, site), { ...task, site });
      }
    }
    const matches = [...overlaps.values()];
    if (!matches.length) return [];
    return [{ requestId: request.id, title: request.title, status: request.status,
      months: [...new Set(matches.map(task => task.period))].sort(), companies: [...new Set(matches.map(task => task.company))],
      sites: [...new Set(matches.flatMap(task => task.site ? [task.site] : []))],
      targetIds: [...new Set(matches.map(task => task.targetId))], duplicateCount: matches.length }];
  });
}
