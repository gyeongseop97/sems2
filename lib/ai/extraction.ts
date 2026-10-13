import type { AiExtraction } from "./types";

const unitKey = (value: string) => value.trim().replace(/\s/g, "").replace(/³/g, "3");
const companyKey = (value: string) => value.replace(/주식회사|\(주\)|㈜|[\s.,]/g, "");
export function isAiEvidencePeriod(value: string): boolean {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])(?:-\d{2})?$/.test(value)) return false;
  if (value.length === 7) return true;
  const instant = Date.parse(value);
  return Number.isFinite(instant) && new Date(instant).toISOString().slice(0, 10) === value;
}
const units: Record<string, { family: string; scale: number }> = {
  Wh: { family: "power", scale: 0.001 }, kWh: { family: "power", scale: 1 }, MWh: { family: "power", scale: 1000 },
  kg: { family: "mass", scale: 1 }, t: { family: "mass", scale: 1000 }, ton: { family: "mass", scale: 1000 }, 톤: { family: "mass", scale: 1000 },
  L: { family: "liquid", scale: 1 }, l: { family: "liquid", scale: 1 }, 리터: { family: "liquid", scale: 1 },
  m3: { family: "volume", scale: 1 },
  MJ: { family: "energy", scale: 1 }, GJ: { family: "energy", scale: 1000 }, TJ: { family: "energy", scale: 1_000_000 },
};

/** Resolve only explicit units. Never guess a unit, reporting period, or company. */
export function resolveExtractedValue(
  extraction: AiExtraction, expectedUnit: string,
  context?: { company?: string; period?: string; site?: string },
): { ok: true; value: number; notes: string[] } | { ok: false; error: string } {
  if (extraction.amount === null || !Number.isFinite(extraction.amount) || extraction.amount < 0) return { ok: false, error: "추출한 사용량을 확인할 수 없습니다. 원본을 확인해 직접 입력해 주세요." };
  if (!extraction.unit?.trim() || !expectedUnit.trim()) return { ok: false, error: "단위를 확인할 수 없어 자동 반영하지 않습니다." };
  if ([extraction.periodFrom, extraction.periodTo].some(period => period !== null && !isAiEvidencePeriod(period))) return { ok: false, error: "증빙에서 읽은 사용기간이 올바른 날짜가 아닙니다. 원본을 확인해 주세요." };
  if (context?.company && extraction.company && companyKey(context.company) !== companyKey(extraction.company)) return { ok: false, error: "증빙의 회사가 선택한 회사와 다릅니다." };
  if (context?.site && extraction.site && context.site.replace(/\s/g, "") !== extraction.site.replace(/\s/g, "")) return { ok: false, error: "증빙의 사업장이 선택한 사업장과 다릅니다." };
  if (context?.period) {
    const expected = context.period;
    for (const period of [extraction.periodFrom, extraction.periodTo]) {
      if (period && period.slice(0, expected.length) !== expected) return { ok: false, error: "증빙의 사용기간이 선택한 자료 기준기간과 다릅니다." };
    }
  }
  const from = unitKey(extraction.unit), to = unitKey(expectedUnit);
  let value = extraction.amount;
  const notes: string[] = [];
  if (from !== to) {
    const source = units[from], target = units[to];
    if (!source || !target || source.family !== target.family) return { ok: false, error: `증빙 단위(${extraction.unit})와 입력 단위(${expectedUnit})를 변환할 수 없습니다.` };
    value = value * source.scale / target.scale;
    notes.push(`${extraction.amount} ${extraction.unit} → ${value} ${expectedUnit}로 단위를 변환했습니다.`);
  }
  if (!Number.isFinite(value)) return { ok: false, error: "변환한 값이 처리 가능한 숫자 범위를 벗어났습니다." };
  if (!extraction.company) notes.push("문서에서 회사명을 확인하지 못했습니다. 선택한 회사를 확인해 주세요.");
  if (!extraction.periodFrom && !extraction.periodTo) notes.push("문서에서 사용기간을 확인하지 못했습니다. 자료 기준기간을 확인해 주세요.");
  return { ok: true, value, notes };
}

export const AI_MAX_FILE_BYTES = 3 * 1024 * 1024;

export function inspectAiFile(bytes: Uint8Array, declaredType: string): string | null {
  if (!bytes.length || bytes.length > AI_MAX_FILE_BYTES) return null;
  if (declaredType === "application/pdf" && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") return declaredType;
  if (declaredType === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return declaredType;
  if (declaredType === "image/png" && [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value)) return declaredType;
  if (declaredType === "image/webp" && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return declaredType;
  return null;
}
