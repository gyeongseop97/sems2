import { stableWorkspaceJson, type WorkspaceDataRow } from "./workspace-integrity";

/** Ratio metadata is only required when input values change, so historic
 * submissions can still be reviewed without manufacturing missing bases. */
export function validateMetricRatio(row: WorkspaceDataRow, current: WorkspaceDataRow | undefined, indicator: WorkspaceDataRow): string | null {
  const unit = String(indicator.unit ?? "");
  const isRatio = indicator.organizationAggregation === "비율" || unit.includes("%") || unit.includes("/");
  if (!isRatio || row.dataStatus === "not_applicable") return null;
  if (current && ["value", "numerator", "denominator", "indicatorId", "dataStatus", "detailRows"].every(key => stableWorkspaceJson(current[key]) === stableWorkspaceJson(row[key]))) return null;
  if (typeof row.numerator !== "number" || !Number.isFinite(row.numerator) || row.numerator < 0) return "비율·원단위 지표의 집계 분자는 0 이상 숫자로 입력해 주세요.";
  if (typeof row.denominator !== "number" || !Number.isFinite(row.denominator) || row.denominator <= 0) return "비율·원단위 지표의 집계 분모는 0보다 큰 숫자로 입력해 주세요.";
  const multiplier = indicator.ratioMultiplier ?? (unit.includes("%") ? 100 : 1);
  if (typeof multiplier !== "number" || !Number.isFinite(multiplier) || multiplier <= 0) return "지표의 비율 배수를 확인해 주세요.";
  const expected = row.numerator / row.denominator * multiplier;
  if (typeof row.value !== "number" || !Number.isFinite(row.value) || Math.abs(row.value - expected) > 1e-6) return "제출값이 집계 분자·분모로 계산한 비율과 일치하지 않습니다.";
  return null;
}
