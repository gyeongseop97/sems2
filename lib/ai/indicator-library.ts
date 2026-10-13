import {
  COMPLILAW_DISCLOSURE_MAPPINGS,
  COMPLILAW_DISCLOSURE_STANDARDS,
  COMPLILAW_QUANTITATIVE_INDICATORS,
  mergeMasterRows,
} from "../complilaw-master-data";
import {
  GRI_WORKBOOK_EXCLUDED_INDICATOR_IDS,
  GRI_WORKBOOK_INDICATOR_ALIASES,
  GRI_WORKBOOK_INDICATORS,
} from "../gri-workbook-indicators";
import type { AiIndicator } from "./types";

const redundantCodes = new Set(["E-WATER-01", "E-WASTE-01", "E-WASTE-02", "S-TRAIN-02"]);
const canonicalIds = new Set(GRI_WORKBOOK_INDICATORS.map(indicator => indicator.id));
const legacyIds = new Set(Object.keys(GRI_WORKBOOK_INDICATOR_ALIASES).map(Number).filter(id => !canonicalIds.has(id)));
const excludedGhgCodes = new Set(["ENV-GHG-S1", "ENV-GHG-S2", "ENV-GHG-S3"]);
const excludedGhgIds = new Set([
  ...GRI_WORKBOOK_EXCLUDED_INDICATOR_IDS,
  ...COMPLILAW_QUANTITATIVE_INDICATORS.filter(indicator => excludedGhgCodes.has(indicator.code)).map(indicator => indicator.id),
]);

/** Match the client indicator normalization without importing a client component. */
function normalizeIndicators(indicators: AiIndicator[]): AiIndicator[] {
  return indicators
    .filter(indicator => !redundantCodes.has(indicator.code) && !legacyIds.has(indicator.id) && !excludedGhgIds.has(indicator.id))
    .map(indicator => {
      if (indicator.code === "ENV-WASTE") return {
        ...indicator,
        inputTemplate: "WASTE",
        definition: "사업장에서 발생한 폐기물 총량. 처리방법별 상세 입력으로 재활용량을 함께 집계합니다.",
        formula: "폐기물 처리량 합계(재활용 선택 행은 재활용량으로 별도 자동 집계)",
      };
      if (indicator.code === "ENV-WATER") return {
        ...indicator,
        inputTemplate: "WATER",
        definition: "사업장 운영 과정에서 취수하거나 공급받은 전체 용수량",
        formula: "용수 구분별 사용량 합계",
      };
      if (indicator.code === "S-TRAIN-01") return {
        ...indicator,
        name: "임직원 교육시간",
        inputTemplate: "TRAINING",
        formula: "총 교육시간 합계 및 총 교육시간 ÷ 임직원 총원",
      };
      return indicator;
    });
}

function copyIndicator(indicator: AiIndicator): AiIndicator {
  return {
    ...indicator,
    frameworks: [...indicator.frameworks],
    ...(indicator.detailItems ? {
      detailItems: indicator.detailItems.map(detail => ({
        ...detail,
        ...(detail.legacyIndicatorIds ? { legacyIndicatorIds: [...detail.legacyIndicatorIds] } : {}),
      })),
    } : {}),
  };
}

function masterIndicators(): AiIndicator[] {
  return [
    ...COMPLILAW_QUANTITATIVE_INDICATORS.map((item): AiIndicator => ({
      id: item.id,
      code: item.code,
      name: item.name,
      category: item.category,
      unit: item.unit,
      cycle: item.cycle,
      aggregation: "합계",
      owner: item.owner,
      reviewer: "ESG 담당자",
      definition: `Complilaw 정량 데이터 항목 관리에서 동기화한 ${item.name}`,
      boundary: "연결된 조직·사업장과 보고기간",
      formula: item.code.startsWith("ENV-GHG-") ? "확정된 인벤토리 배출량 자동 집계" : "담당 부서 제출값 집계",
      dataSource: item.source ?? "Complilaw 기준정보",
      evidenceExample: "원천자료, 집계표, 승인 문서",
      frameworks: COMPLILAW_DISCLOSURE_MAPPINGS
        .filter(mapping => mapping.indicatorCode === item.code)
        .map(mapping => COMPLILAW_DISCLOSURE_STANDARDS.find(standard => standard.id === mapping.standardId)?.code ?? "")
        .filter(Boolean),
      active: item.active !== false,
    })),
    ...GRI_WORKBOOK_INDICATORS.map(copyIndicator),
  ];
}

export function getDefaultIndicators(): AiIndicator[] {
  return normalizeIndicators(masterIndicators());
}

/** Saved rows replace matching IDs; absent defaults are restored, as in the client. */
export function getAiIndicators(saved: readonly Record<string, unknown>[]): AiIndicator[] {
  const current = saved
    .filter(row => typeof row.id === "number" && Number.isSafeInteger(row.id) && row.id > 0
      && typeof row.code === "string" && typeof row.name === "string")
    .map(row => copyIndicator({
      ...row,
      frameworks: Array.isArray(row.frameworks) ? row.frameworks.filter((value): value is string => typeof value === "string") : [],
    } as AiIndicator));
  return normalizeIndicators(mergeMasterRows(current, masterIndicators()));
}
