import { buildGHGCollectionTasks, buildMetricCollectionTasks, collectionSitesForCompany, collectionTaskKey, type CollectionSites, type CollectionTask } from "./collection-task-expansion";
import { validateDataValue, type DataStatus } from "./metric-aggregation";
import { validateMetricRatio } from "./workspace-metrics";

export type ClosingRequest = {
  id: string; status: string; companies: readonly string[];
  dataFrom?: string; dataTo?: string; periodFrom?: string; periodTo?: string;
  scopes?: readonly string[]; indicatorIds?: readonly number[];
  sitesByCompany?: CollectionSites; taskKeys?: readonly string[];
};
export type ClosingRow = {
  id: string | number; company: string; site?: string; period: string; status: string;
  collectionId?: string; requestId?: string; scope?: string; indicatorId?: number;
  active?: boolean; dataStatus?: DataStatus; description?: string;
  usage?: number; emissions?: number; value?: number; numerator?: number; denominator?: number;
};
export type ClosingIndicator = { id: number; cycle?: string; unit?: string; organizationAggregation?: string; ratioMultiplier?: number };
export type ClosingIssue = {
  code: "missing" | "unconfirmed" | "invalid" | "empty";
  company?: string; site?: string; period?: string; targetId?: string | number;
  recordId?: string | number; message: string;
};

/** A saved company-wide task expands to every requested/registered site.
 * A legacy site-less row cannot silently satisfy several registered sites. */
export function getWorkspaceClosingIssues({kind,request,rows,indicators=[],organizations}: {
  kind: "ghg" | "metric"; request: ClosingRequest; rows: readonly ClosingRow[];
  indicators?: readonly ClosingIndicator[]; organizations: CollectionSites;
}): ClosingIssue[] {
  const sitesByCompany = Object.fromEntries(request.companies.map(company => [company,
    request.sitesByCompany?.[company]?.length ? request.sitesByCompany[company] : organizations[company] ?? [],
  ]));
  const rawTasks: CollectionTask<string | number>[] = kind === "ghg"
    ? buildGHGCollectionTasks({ ...request, dataFrom: request.dataFrom ?? "", dataTo: request.dataTo ?? "", scopes: request.scopes ?? [], sitesByCompany })
    : buildMetricCollectionTasks({ ...request, periodFrom: request.periodFrom ?? "", periodTo: request.periodTo ?? "", indicatorIds: request.indicatorIds ?? [], sitesByCompany }, indicators.map(indicator => ({...indicator,cycle:indicator.cycle ?? "월"})));
  const tasks = [...new Map(rawTasks.flatMap(task => task.site ? [task] : collectionSitesForCompany(task.company, sitesByCompany).map(site => ({...task,site,key:collectionTaskKey(task.company,task.targetId,task.period,site)}))).map(task => [task.key,task])).values()];
  if (!tasks.length) return [{code:"empty",message:"마감할 수집 대상과 기간이 없습니다. 요청 설정을 확인해 주세요."}];
  const issues: ClosingIssue[] = [];
  for (const task of tasks) {
    const context = {company:task.company,site:task.site,period:task.period,targetId:task.targetId};
    const label = [task.company,task.site,task.period,kind === "ghg" ? task.targetId : `지표 ${task.targetId}`].filter(Boolean).join(" · ");
    const matches = rows.filter(row => row.active !== false && (kind === "ghg" ? row.collectionId : row.requestId) === request.id
      && row.company === task.company && (!task.site || row.site === task.site) && row.period === task.period
      && (kind === "ghg" ? row.scope : row.indicatorId) === task.targetId);
    if (!matches.length) { issues.push({...context,code:"missing",message:`${label}: 입력된 자료가 없습니다.`}); continue; }
    for (const row of matches) {
      if (row.status !== "확정") issues.push({...context,recordId:row.id,code:"unconfirmed",message:`${label}: 승인되지 않은 자료(${row.status})가 있습니다.`});
      const value = kind === "ghg" ? row.usage : row.value;
      const validation = validateDataValue({value,dataStatus:row.dataStatus,description:row.description})
        ?? (row.dataStatus !== "not_applicable" && typeof value === "number" && value < 0 ? "음수인 자료를 확인해 주세요." : null)
        ?? (kind === "ghg" && (typeof row.emissions !== "number" || !Number.isFinite(row.emissions) || row.emissions < 0) ? "배출량이 올바르지 않습니다." : null)
        ?? (kind === "metric" ? validateMetricRatio({...row},undefined,{...indicators.find(indicator => indicator.id === row.indicatorId)}) : null);
      if (validation) issues.push({...context,recordId:row.id,code:"invalid",message:`${label}: ${validation}`});
    }
  }
  return issues;
}
