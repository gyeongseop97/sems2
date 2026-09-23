import { calculateEmission, type FactorDefinition } from "./factor-calculation";
import { stableWorkspaceJson, type WorkspaceDataRow } from "./workspace-integrity";

export function validateEmissionIntegrity(row: WorkspaceDataRow, current: WorkspaceDataRow | undefined, factors: unknown[]) {
  const inputsChanged = !current || ["usage", "unit", "period", "factorId", "factor", "emissions", "scope", "category", "source"].some(key => stableWorkspaceJson(current[key]) !== stableWorkspaceJson(row[key]));
  if (!inputsChanged) {
    return stableWorkspaceJson(current?.factorSnapshot) !== stableWorkspaceJson(row.factorSnapshot) ? "기존 산정에 사용한 배출계수 기록은 변경할 수 없습니다." : null;
  }
  const factor = factors.map(value => value as WorkspaceDataRow).find(value => value.id === row.factorId) as FactorDefinition | undefined;
  if (!factor) return "적용할 배출계수를 다시 선택해 주세요.";
  if (factor.scope !== row.scope || factor.category !== row.category || factor.source !== row.source) return "선택한 배출계수와 활동자료 분류가 일치하지 않습니다.";
  const calculation = calculateEmission({ usage: Number(row.usage), unit: String(row.unit ?? ""), period: String(row.period ?? ""), factor });
  if (!calculation.ok) return calculation.errors.join(" ");
  if (!Number.isFinite(Number(row.emissions)) || Math.abs(Number(row.emissions) - calculation.emissions) > 1e-8 || Number(row.factor) !== factor.value) return "활동량·단위·배출계수와 배출량이 일치하지 않습니다. 산정값을 다시 확인해 주세요.";
  if (stableWorkspaceJson(row.factorSnapshot) !== stableWorkspaceJson(calculation.snapshot)) return "배출계수 버전이 변경되었습니다. 계수를 다시 선택하여 산정값을 확인해 주세요.";
  return null;
}
