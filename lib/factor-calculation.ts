/** One shared, deterministic calculation boundary for browser and server. */
export type FactorDefinition = {
  id: string;
  scope: string;
  category: string;
  source: string;
  value: number;
  activityUnit: string;
  factorUnit: string;
  year: string;
  authority: string;
  active: boolean;
  factorType?: string;
  method?: string;
  reference?: string;
  referenceUrl?: string;
  notes?: string;
  indicatorKind?: string;
  validFrom?: string;
  validTo?: string;
};

export type FactorSnapshot = Omit<FactorDefinition, "active"> & {
  revision: string;
  calculationVersion: "unit-aware-v1";
};

export type EmissionCalculation =
  | { ok: true; emissions: number; normalizedUsage: number; snapshot: FactorSnapshot; formula: string; warnings: string[] }
  | { ok: false; errors: string[] };

type Unit = { dimension: string; scale: number; label: string };
const units: Record<string, Unit> = {
  wh: { dimension: "energy", scale: 0.001, label: "Wh" },
  kwh: { dimension: "energy", scale: 1, label: "kWh" },
  mwh: { dimension: "energy", scale: 1000, label: "MWh" },
  mj: { dimension: "energy", scale: 1 / 3.6, label: "MJ" },
  gj: { dimension: "energy", scale: 1000 / 3.6, label: "GJ" },
  tj: { dimension: "energy", scale: 1_000_000 / 3.6, label: "TJ" },
  g: { dimension: "mass", scale: 0.001, label: "g" },
  kg: { dimension: "mass", scale: 1, label: "kg" },
  t: { dimension: "mass", scale: 1000, label: "t" },
  ton: { dimension: "mass", scale: 1000, label: "t" },
  tonne: { dimension: "mass", scale: 1000, label: "t" },
  ml: { dimension: "volume", scale: 0.001, label: "mL" },
  l: { dimension: "volume", scale: 1, label: "L" },
  kl: { dimension: "volume", scale: 1000, label: "kL" },
  m3: { dimension: "volume", scale: 1000, label: "m³" },
  nm3: { dimension: "normal-volume", scale: 1, label: "Nm³" },
  m: { dimension: "distance", scale: 0.001, label: "m" },
  km: { dimension: "distance", scale: 1, label: "km" },
  "ton-km": { dimension: "freight", scale: 1, label: "ton-km" },
  "t-km": { dimension: "freight", scale: 1, label: "ton-km" },
  "kg-km": { dimension: "freight", scale: 0.001, label: "kg-km" },
};

function compactUnit(value: string) {
  return value.trim().replaceAll("³", "3").replaceAll("₂", "2").replaceAll("·", "-").replace(/\s+/g, "");
}
function normalizeUnit(value: string) {
  return value.trim().replaceAll("³", "3").replaceAll("₂", "2").replaceAll("·", "-").replace(/\s+/g, "").toLowerCase();
}

function unitDefinition(value: string): Unit {
  const compact = compactUnit(value);
  // SI prefixes are case-sensitive: ML is a million litres, mL is a millilitre.
  if (compact === "ML") return { dimension: "volume", scale: 1_000_000, label: "ML" };
  if (compact === "mWh") return { dimension: "energy", scale: 0.000001, label: "mWh" };
  const normalized = normalizeUnit(value);
  // Custom units can match exactly but cannot be guessed or converted.
  return Object.hasOwn(units, normalized) ? units[normalized] : { dimension: `custom:${compact}`, scale: 1, label: value.trim() };
}

function calendarDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

function periodBounds(period: string): [string, string] | null {
  if (/^\d{4}-\d{2}$/.test(period)) {
    const first = calendarDate(`${period}-01`);
    if (!first) return null;
    const monthEnd = new Date(`${first}T00:00:00Z`);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
    const last = monthEnd.toISOString().slice(0, 10);
    return [first, last];
  }
  const day = calendarDate(period);
  return day ? [day, day] : null;
}

export function isFactorEffective(factor: FactorDefinition, period: string): boolean {
  const range = periodBounds(period);
  if (!range || !factor.active) return false;
  const from = factor.validFrom?.trim();
  const to = factor.validTo?.trim();
  if ((from && !calendarDate(from)) || (to && !calendarDate(to))) return false;
  if (from && to && from > to) return false;
  // A monthly total requires a factor valid for the entire month.
  return (!from || from <= range[0]) && (!to || to >= range[1]);
}

function factorContent(factor: FactorDefinition) {
  return {
    id: factor.id, scope: factor.scope, category: factor.category, source: factor.source,
    value: factor.value, activityUnit: factor.activityUnit, factorUnit: factor.factorUnit,
    year: factor.year, authority: factor.authority,
    factorType: factor.factorType ?? "", method: factor.method ?? "", reference: factor.reference ?? "",
    referenceUrl: factor.referenceUrl ?? "", notes: factor.notes ?? "", indicatorKind: factor.indicatorKind ?? "",
    validFrom: factor.validFrom ?? "", validTo: factor.validTo ?? "",
  };
}

/** A content version for reproducibility, not a signature or security checksum. */
export function factorRevision(factor: FactorDefinition): string {
  const content = JSON.stringify(factorContent(factor));
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash = Math.imul(hash ^ content.charCodeAt(index), 16777619);
  }
  return `ef-v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function snapshotFactor(factor: FactorDefinition): FactorSnapshot {
  return { ...factorContent(factor), revision: factorRevision(factor), calculationVersion: "unit-aware-v1" };
}

export function calculateEmission({ usage, unit, period, factor }: {
  usage: number; unit: string; period: string; factor: FactorDefinition;
}): EmissionCalculation {
  const errors: string[] = [];
  if (!Number.isFinite(usage) || usage < 0) errors.push("사용량은 0 이상의 유한한 숫자여야 합니다.");
  if (!Number.isFinite(factor.value) || factor.value < 0) errors.push("배출계수 값이 올바르지 않습니다.");
  if (!factor.active) errors.push("사용이 중지된 배출계수입니다.");
  if (!periodBounds(period)) errors.push("자료 기준월 또는 날짜가 올바르지 않습니다.");
  else if (factor.active && !isFactorEffective(factor, period)) errors.push("배출계수의 적용 기간이 자료 기준기간 전체를 포함하지 않습니다.");
  if (factor.indicatorKind && factor.indicatorKind !== "배출계수") errors.push("열량계수·지구온난화지수·산화계수는 단독 배출계수로 적용할 수 없습니다.");
  if (!unit.trim() || !factor.activityUnit.trim()) errors.push("활동량 단위를 선택해 주세요.");
  const matched = compactUnit(factor.factorUnit).match(/^(kg|g|t|ton|tonne)co2(e)?\/(.+)$/i);
  if (!matched) errors.push("지원하는 배출계수 단위가 아닙니다. g·kg·t CO₂(e)/활동량 단위를 사용해 주세요.");
  if (errors.length || !matched) return { ok: false, errors };
  const input = unitDefinition(unit);
  const activity = unitDefinition(factor.activityUnit);
  const denominator = unitDefinition(matched[3]);
  if (input.dimension !== activity.dimension || activity.dimension !== denominator.dimension) {
    return { ok: false, errors: [`활동량 단위(${unit})와 배출계수 단위(${factor.factorUnit})가 호환되지 않습니다.`] };
  }
  const normalizedUsage = usage * input.scale / denominator.scale;
  const massUnit = matched[1].toLowerCase();
  const tonnesScale = massUnit === "g" ? 0.000001 : massUnit === "kg" ? 0.001 : 1;
  const result = normalizedUsage * factor.value * tonnesScale;
  if (!Number.isFinite(result)) return { ok: false, errors: ["산정 결과가 처리 가능한 숫자 범위를 벗어났습니다."] };
  const warnings = matched[2] ? [] : ["CO₂ 전용 계수입니다. CH₄·N₂O 등 다른 온실가스 포함 여부를 확인하세요."];
  if (factor.factorType === "참고계수") warnings.push("참고계수로 산정한 값입니다. 보고 전 적용 적합성을 확인하세요.");
  return {
    ok: true, emissions: Number(result.toFixed(8)), normalizedUsage,
    snapshot: snapshotFactor(factor),
    formula: `${normalizedUsage} ${denominator.label} × ${factor.value} ${factor.factorUnit} × ${tonnesScale} = ${Number(result.toFixed(8))} tCO₂e`,
    warnings,
  };
}
