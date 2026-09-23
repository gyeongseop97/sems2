/** Shared, pure guards used by the workspace API and its regression tests. */
export type WorkspaceRevisions = Record<string, number>;
export type WorkspaceDataRow = Record<string, unknown>;

export function revisionConflicts(expected: WorkspaceRevisions, actual: WorkspaceRevisions, scopes: string[]) {
  return scopes.filter(scope => !Number.isSafeInteger(expected[scope]) || expected[scope] < 0 || expected[scope] !== (actual[scope] ?? 0));
}

export function stableWorkspaceJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableWorkspaceJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stableWorkspaceJson(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

const reviewFields = new Set(["reviewNote", "reviewedAt", "reviewedBy", "reviewHistory", "qualityResolutions"]);
const workflowFields = new Set(["status", "locked", "rejectionReason", "updatedAt", ...reviewFields]);
function valuesExcept(row: WorkspaceDataRow, excluded: Set<string>) {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !excluded.has(key)));
}

/** A review changes workflow metadata, never a submitted numeric value in-place. */
export function validateWorkspaceTransition(current: WorkspaceDataRow | undefined, next: WorkspaceDataRow, isAdmin: boolean): string | null {
  const status = String(next.status ?? "");
  if (!["작성중", "검토대기", "반려", "확정"].includes(status)) return "알 수 없는 자료 상태입니다.";
  if (!isAdmin && [...reviewFields].some(key => stableWorkspaceJson(current?.[key]) !== stableWorkspaceJson(next[key]))) return "검토 의견과 품질 확인은 관리자만 변경할 수 있습니다.";
  if (!current) {
    if (!["작성중", "검토대기"].includes(status)) return "새 자료는 작성 또는 제출 상태로 등록한 후 검토해야 합니다.";
    if (!isAdmin && next.locked === true) return "자료 입력자는 자료를 확정하거나 잠글 수 없습니다.";
    return null;
  }
  if (current.company !== next.company || current.site !== next.site || current.id !== next.id) return "저장된 자료의 법인·사업장·식별자는 변경할 수 없습니다.";
  if (!isAdmin && next.locked !== current.locked && next.locked === true) return "자료 입력자는 자료를 잠글 수 없습니다.";
  const changedData = stableWorkspaceJson(valuesExcept(current, workflowFields)) !== stableWorkspaceJson(valuesExcept(next, workflowFields));
  if (current.locked === true || current.status === "확정") {
    if (!isAdmin && stableWorkspaceJson(current) !== stableWorkspaceJson(next)) return "확정된 자료는 변경할 수 없습니다.";
    if (changedData) return "확정된 숫자는 변경할 수 없습니다. 먼저 사유를 남겨 보완 요청한 후 수정해 주세요.";
    if (next.status !== current.status && !(isAdmin && status === "반려" && String(next.rejectionReason ?? "").trim() && next.locked !== true)) return "확정자료는 사유를 입력한 보완 요청으로만 다시 열 수 있습니다.";
  }
  if (current.status === "검토대기") {
    if (changedData) return "검토 중인 숫자는 변경할 수 없습니다. 제출을 회수하거나 반려한 후 수정해 주세요.";
    if (!isAdmin && !["검토대기", "작성중"].includes(status)) return "승인과 반려는 관리자만 수행할 수 있습니다.";
  } else if (!isAdmin && ["확정", "반려"].includes(status) && status !== current.status) {
    return "승인과 반려는 관리자만 수행할 수 있습니다.";
  }
  if (isAdmin && status === "확정" && current.status !== "확정" && current.status !== "검토대기") return "제출된 자료만 승인할 수 있습니다.";
  if (status === "반려" && status !== current.status && !String(next.rejectionReason ?? "").trim()) return "보완 요청 사유를 입력해 주세요.";
  return null;
}

/** Matching one task never authorizes a different site on the same request. */
export function collectionTaskMatchesRow(task: { company: string; targetId: string | number; period: string; site?: string }, row: { company: unknown; targetId: unknown; period: unknown; site?: unknown }, requestedSites?: unknown) {
  return task.company === row.company && task.targetId === row.targetId && task.period === row.period && (!task.site || task.site === row.site)
    && (!Array.isArray(requestedSites) || !requestedSites.length || requestedSites.includes(row.site));
}

/** Omitted rows are preserved by the JSON bridge. Validate this exact result
 * before saving or closing, instead of validating only the supplied subset. */
export function mergeWorkspaceRows(existingRows: readonly unknown[], incomingRows: readonly unknown[]): WorkspaceDataRow[] {
  const row = (value: unknown): WorkspaceDataRow => value && typeof value === "object" ? value as WorkspaceDataRow : {};
  const key = (value: WorkspaceDataRow) => String(value.id ?? ["records",value.organization ?? value.company ?? "",value.id ?? "",value.code ?? "",value.at ?? ""].join("|"));
  const incoming = new Map(incomingRows.map(value => {const item=row(value);return [key(item),item];}));
  const result = existingRows.map(value => {const current=row(value),next=incoming.get(key(current));incoming.delete(key(current));return next ? {...current,...next} : current;});
  return [...result,...incoming.values()];
}

export function validateClosedRequestChange(current: WorkspaceDataRow | undefined, next: WorkspaceDataRow): string | null {
  if (!current || !["마감","잠금"].includes(String(current.status))) return null;
  const fields=["companies","scopes","indicatorIds","taskKeys","sitesByCompany","dataFrom","dataTo","periodFrom","periodTo"];
  const semanticValue = (value: unknown): unknown => Array.isArray(value) ? [...value].sort() : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key,entry])=>[key,semanticValue(entry)])) : value;
  if (fields.some(key=>stableWorkspaceJson(semanticValue(current[key]))!==stableWorkspaceJson(semanticValue(next[key])))) return "마감·잠긴 요청의 대상과 기간은 변경할 수 없습니다. 먼저 기간을 다시 열고 서버 저장이 완료된 후 요청 범위를 수정해 주세요.";
  return null;
}
