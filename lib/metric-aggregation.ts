export type DataStatus = "actual" | "zero" | "not_applicable" | "estimated" | "missing";

export const DATA_STATUS_LABELS: Record<DataStatus, string> = {
  actual: "실측값", zero: "실제 0", not_applicable: "해당 없음", estimated: "추정값", missing: "미입력",
};

export type DataValue = { value?: number | null; dataStatus?: DataStatus; description?: string };

export function dataValueStatus(row: DataValue): DataStatus {
  if (row.dataStatus !== undefined && !Object.hasOwn(DATA_STATUS_LABELS, row.dataStatus)) return "missing";
  if (row.dataStatus === "not_applicable") return "not_applicable";
  if (row.dataStatus === "missing" || typeof row.value !== "number" || !Number.isFinite(row.value)) return "missing";
  if (row.dataStatus === "estimated") return "estimated";
  return row.value === 0 ? "zero" : "actual";
}

export function validateDataValue(row: DataValue): string | null {
  if (row.dataStatus !== undefined && !Object.hasOwn(DATA_STATUS_LABELS, row.dataStatus)) return "값 구분이 올바르지 않습니다.";
  const status = dataValueStatus(row);
  if (status === "missing") return "값을 입력하거나 실제 0·해당 없음·추정값을 선택해 주세요.";
  if (row.dataStatus === "zero" && row.value !== 0) return "실제 0은 제출값이 0이어야 합니다.";
  if (status === "not_applicable" && !row.description?.trim()) return "해당 없음의 사유를 입력해 주세요.";
  if (status === "estimated" && !row.description?.trim()) return "추정 방법과 근거를 입력해 주세요.";
  return null;
}

export type PeriodAggregation = "합계" | "평균" | "최종값";
export type OrganizationAggregation = "합계" | "평균" | "비율";
export type MetricAggregationRule = {
  aggregation?: PeriodAggregation;
  organizationAggregation?: OrganizationAggregation;
  unit?: string;
  ratioMultiplier?: number;
};
export type MetricAggregationRow = DataValue & {
  company: string;
  site?: string;
  period: string;
  numerator?: number | null;
  denominator?: number | null;
};
export type MetricAggregationOptions = {
  year?: number | string;
  periodFrom?: string;
  periodTo?: string;
  expectedOrganizations?: readonly { company: string; site?: string }[];
  expectedPeriods?: readonly string[];
};
export type MetricAggregationGroup = {
  company: string;
  site?: string;
  value: number | null;
  periods: string[];
  missingCount: number;
  estimatedCount: number;
};
export type MetricAggregationResult = {
  value: number | null;
  groups: MetricAggregationGroup[];
  missingCount: number;
  notApplicableCount: number;
  estimatedCount: number;
  zeroCount: number;
  warnings: string[];
  numerator?: number;
  denominator?: number;
};

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const organizationKey = (row: { company: string; site?: string }) => JSON.stringify([row.company, row.site ?? ""]);

function periodValue(rows: readonly MetricAggregationRow[], mode: PeriodAggregation, field: "value" | "numerator" | "denominator") {
  const values = rows.map(row => row[field]).filter(finite);
  if (!values.length) return null;
  if (mode === "최종값") return values.at(-1) ?? null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return mode === "평균" ? total / values.length : total;
}

/** Aggregate each organization's time series first, then combine organizations.
 * Missing/N/A values never become zero. Ratios use summed numerators and denominators.
 */
export function aggregateMetric(
  rule: MetricAggregationRule,
  inputRows: readonly MetricAggregationRow[],
  options: MetricAggregationOptions = {},
): MetricAggregationResult {
  const rows = inputRows.filter(row => (!options.year || row.period.startsWith(`${options.year}-`))
    && (!options.periodFrom || row.period >= options.periodFrom)
    && (!options.periodTo || row.period <= options.periodTo));
  const buckets = new Map<string, { organization: { company: string; site?: string }; rows: MetricAggregationRow[] }>();
  for (const organization of options.expectedOrganizations ?? []) buckets.set(organizationKey(organization), { organization, rows: [] });
  for (const row of rows) {
    const key = organizationKey(row);
    if (!buckets.has(key)) buckets.set(key, { organization: { company: row.company, ...(row.site ? { site: row.site } : {}) }, rows: [] });
    buckets.get(key)!.rows.push(row);
  }
  const result: MetricAggregationResult = {
    value: null, groups: [], missingCount: 0, notApplicableCount: 0, estimatedCount: 0, zeroCount: 0, warnings: [],
  };
  const mode = rule.aggregation ?? "합계";
  const ratioLike = rule.unit?.includes("%") || rule.unit?.includes("/");
  const ratioRequested = rule.organizationAggregation === "비율" || (!rule.organizationAggregation && ratioLike);
  const ratioParts: { numerator: number; denominator: number }[] = [];
  let incompleteRatio = false;
  for (const bucket of buckets.values()) {
    const ordered = [...bucket.rows].sort((first, second) => first.period.localeCompare(second.period));
    const missingRows = ordered.filter(row => dataValueStatus(row) === "missing" || (row.dataStatus === "zero" && row.value !== 0));
    const valid = ordered.filter(row => !["missing", "not_applicable"].includes(dataValueStatus(row)) && !(row.dataStatus === "zero" && row.value !== 0));
    const missingPeriods = options.expectedPeriods?.filter(period => !ordered.some(row => row.period === period)).length
      ?? (ordered.length ? 0 : 1);
    const missingCount = missingRows.length + missingPeriods;
    const chosen = mode === "최종값" && ordered.length ? valid.filter(row => row.period === ordered.at(-1)!.period) : valid;
    const estimatedCount = chosen.filter(row => dataValueStatus(row) === "estimated").length;
    // In a snapshot, multiple rows for the same site and period are ambiguous.
    const duplicatePeriods = [...new Set(chosen.map(row => row.period))].filter(period => chosen.filter(row => row.period === period).length > 1);
    if (duplicatePeriods.length) result.warnings.push(`${bucket.organization.company}${bucket.organization.site ? ` · ${bucket.organization.site}` : ""}: 동일 기간 제출값이 ${duplicatePeriods.length}개 기간에서 중복됩니다.`);
    const computed = duplicatePeriods.length ? null : periodValue(chosen, mode, "value");
    const value = finite(computed) ? computed : null;
    if (computed !== null && !finite(computed)) result.warnings.push(`${bucket.organization.company}: 집계 결과가 처리 가능한 숫자 범위를 벗어났습니다.`);
    result.groups.push({ ...bucket.organization, value, periods: [...new Set(chosen.map(row => row.period))], missingCount, estimatedCount });
    result.missingCount += missingCount;
    result.estimatedCount += estimatedCount;
    result.notApplicableCount += ordered.filter(row => dataValueStatus(row) === "not_applicable").length;
    result.zeroCount += chosen.filter(row => dataValueStatus(row) === "zero").length;
    if (ratioRequested && duplicatePeriods.length) incompleteRatio = true;
    if (ratioRequested && chosen.length) {
      if (chosen.some(row => !finite(row.numerator) || !finite(row.denominator) || row.denominator < 0)) incompleteRatio = true;
      else ratioParts.push({ numerator: periodValue(chosen, mode, "numerator")!, denominator: periodValue(chosen, mode, "denominator")! });
    }
  }
  const values = result.groups.map(group => group.value).filter(finite);
  if (ratioRequested) {
    if (!incompleteRatio && ratioParts.length) {
      result.numerator = ratioParts.reduce((sum, part) => sum + part.numerator, 0);
      result.denominator = ratioParts.reduce((sum, part) => sum + part.denominator, 0);
      if (result.denominator > 0) result.value = result.numerator / result.denominator * (rule.ratioMultiplier ?? (rule.unit?.includes("%") ? 100 : 1));
      else result.warnings.push("분모가 0이므로 비율을 계산할 수 없습니다.");
    } else if (values.length === 1 && rule.organizationAggregation !== "비율") {
      result.value = values[0];
      result.warnings.push("기존 비율값입니다. 분자·분모를 등록하면 그룹 비율을 재계산할 수 있습니다.");
    } else if (values.length) result.warnings.push("비율·원단위는 분자와 분모가 필요합니다. 사업장별 비율을 단순 합산하지 않습니다.");
  } else if (values.length) {
    const total = values.reduce((sum, value) => sum + value, 0);
    result.value = rule.organizationAggregation === "평균" ? total / values.length : total;
  }
  if (result.value !== null && !Number.isFinite(result.value)) {
    result.value = null;
    result.warnings.push("집계 결과가 처리 가능한 숫자 범위를 벗어났습니다.");
  }
  if (result.missingCount) result.warnings.push(`미입력 ${result.missingCount}건이 있어 집계가 불완전합니다.`);
  if (result.estimatedCount) result.warnings.push(`추정값 ${result.estimatedCount}건을 포함합니다.`);
  if (result.notApplicableCount) result.warnings.push(`해당 없음 ${result.notApplicableCount}건은 수치 집계에서 제외했습니다.`);
  return result;
}
