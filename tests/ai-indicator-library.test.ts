import assert from "node:assert/strict";
import test from "node:test";
import { getAiIndicators, getDefaultIndicators } from "../lib/ai/indicator-library";
import {
  GRI_WORKBOOK_EXCLUDED_INDICATOR_IDS,
  GRI_WORKBOOK_INDICATOR_ALIASES,
  GRI_WORKBOOK_INDICATORS,
} from "../lib/gri-workbook-indicators";
import type { AiIndicator } from "../lib/ai/types";

const custom: AiIndicator = {
  id: 900_001,
  code: "CUSTOM-E-01",
  name: "설비 점검 완료율",
  category: "환경",
  unit: "%",
  cycle: "월",
  aggregation: "최종값",
  organizationAggregation: "비율",
  owner: "공정기술팀",
  reviewer: "기획실",
  definition: "계획한 점검 중 완료한 점검의 비율",
  boundary: "선택한 법인·사업장·기준월",
  formula: "완료 점검 수 ÷ 계획 점검 수 × 100",
  dataSource: "설비 점검대장",
  evidenceExample: "승인된 점검표",
  frameworks: ["고객사 설비 점검"],
  inputTemplate: "GENERAL",
  active: true,
};

test("AI defaults contain the same 129 indicators and 125 active indicators as the client", () => {
  const indicators = getAiIndicators([]);

  assert.equal(indicators.length, 129);
  assert.equal(indicators.filter(indicator => indicator.active !== false).length, 125);
  assert.equal(new Set(indicators.map(indicator => indicator.id)).size, 129);
  assert.deepEqual(indicators, getDefaultIndicators());
  assert.ok(indicators.every(indicator => !("status" in indicator) && !("progress" in indicator)));
});

test("GHG collection and legacy duplicate indicators stay out of the other-ESG library", () => {
  const defaults = getDefaultIndicators();
  const canonical = new Set(GRI_WORKBOOK_INDICATORS.map(indicator => indicator.id));
  const legacyId = Object.keys(GRI_WORKBOOK_INDICATOR_ALIASES).map(Number).find(id => !canonical.has(id));
  assert.notEqual(legacyId, undefined);
  const saved = [
    { ...custom, id: legacyId!, code: "OLD-WORKBOOK" },
    { ...custom, id: GRI_WORKBOOK_EXCLUDED_INDICATOR_IDS[0], code: "OLD-GHG" },
    { ...custom, id: 10001, code: "ENV-GHG-S1" },
    { ...custom, id: 900_002, code: "E-WATER-01" },
    { ...custom, id: 900_003, code: "E-WASTE-01" },
    { ...custom, id: 900_004, code: "E-WASTE-02" },
    { ...custom, id: 900_005, code: "S-TRAIN-02" },
  ];
  const indicators = getAiIndicators(saved);

  assert.deepEqual(indicators, defaults);
  assert.ok(!indicators.some(indicator => ["ENV-GHG-S1", "ENV-GHG-S2", "ENV-GHG-S3"].includes(indicator.code)));
  assert.ok(!indicators.some(indicator => GRI_WORKBOOK_EXCLUDED_INDICATOR_IDS.includes(indicator.id)));
});

test("saved custom indicators and edited definitions keep their complete collection metadata", () => {
  const original = getDefaultIndicators().find(indicator => indicator.code === "ENV-ENERGY");
  assert.ok(original);
  const edited = {
    ...original,
    definition: "관리자가 검토한 수정 정의",
    boundary: "대구공장 전력 사용량만",
    formula: "고지서별 전력 사용량 합계",
    dataSource: "한국전력 고지서",
    evidenceExample: "해당 월 고지서 원본",
    owner: "시설팀",
    reviewer: "환경안전팀",
    unit: "kWh",
    cycle: "월",
    aggregation: "평균" as const,
    organizationAggregation: "평균" as const,
    frameworks: ["사내 관리기준"],
    inputTemplate: "ENERGY",
    active: false,
  };
  const indicators = getAiIndicators([{ ...custom }, edited]);

  assert.deepEqual(indicators.find(indicator => indicator.id === custom.id), custom);
  assert.deepEqual(indicators.find(indicator => indicator.id === original.id), edited);
  assert.equal(indicators.filter(indicator => indicator.id === original.id).length, 1);
  assert.equal(indicators.length, 130);
  assert.equal(indicators.filter(indicator => indicator.active !== false).length, 125);
});

test("saved inactive rows remain inactive and absent defaults are restored rather than inferred deleted", () => {
  const defaults = getDefaultIndicators();
  const existing = defaults.find(indicator => indicator.code === "SOC-HIRES");
  assert.ok(existing);
  const indicators = getAiIndicators([{ ...existing, active: false }, { ...custom, active: false }]);

  assert.equal(indicators.find(indicator => indicator.id === existing.id)?.active, false);
  assert.equal(indicators.find(indicator => indicator.id === custom.id)?.active, false);
  assert.equal(indicators.filter(indicator => indicator.active !== false).length, 124);
  assert.equal(indicators.find(indicator => indicator.code === "ENV-ENERGY")?.id, 10004);
});

test("waste, water, and training keep the client display normalization after saved overrides", () => {
  const defaults = getDefaultIndicators();
  const waste = defaults.find(indicator => indicator.code === "ENV-WASTE");
  const water = defaults.find(indicator => indicator.code === "ENV-WATER");
  assert.ok(waste);
  assert.ok(water);
  const training = { ...custom, id: 900_006, code: "S-TRAIN-01", name: "교육 초안 이름", formula: "이전 교육 산식", inputTemplate: "GENERAL" };
  const indicators = getAiIndicators([
    { ...waste, definition: "이전 폐기물 정의", formula: "이전 폐기물 산식", active: false, dataSource: "사내 폐기물 대장" },
    { ...water, definition: "이전 용수 정의", formula: "이전 용수 산식", inputTemplate: "GENERAL" },
    training,
  ]);

  assert.equal(indicators.find(indicator => indicator.id === waste.id)?.definition, waste.definition);
  assert.equal(indicators.find(indicator => indicator.id === waste.id)?.formula, waste.formula);
  assert.equal(indicators.find(indicator => indicator.id === waste.id)?.inputTemplate, "WASTE");
  assert.equal(indicators.find(indicator => indicator.id === waste.id)?.dataSource, "사내 폐기물 대장");
  assert.equal(indicators.find(indicator => indicator.id === waste.id)?.active, false);
  assert.equal(indicators.find(indicator => indicator.id === water.id)?.definition, water.definition);
  assert.equal(indicators.find(indicator => indicator.id === water.id)?.formula, water.formula);
  assert.equal(indicators.find(indicator => indicator.id === water.id)?.inputTemplate, "WATER");
  assert.equal(indicators.find(indicator => indicator.id === training.id)?.name, "임직원 교육시간");
  assert.equal(indicators.find(indicator => indicator.id === training.id)?.formula, "총 교육시간 합계 및 총 교육시간 ÷ 임직원 총원");
  assert.equal(indicators.find(indicator => indicator.id === training.id)?.inputTemplate, "TRAINING");
});

test("fixed-detail definitions and saved detail changes survive without mutating the seed library", () => {
  const original = getDefaultIndicators().find(indicator => indicator.name === "인권 교육 이수 현황");
  assert.ok(original?.detailItems?.length);
  const edited = {
    ...original,
    detailItems: original.detailItems.map((detail, index) => index === 0 ? {
      ...detail, label: "수정된 세부 입력 안내", unit: "시간", aggregation: "최종값" as const,
    } : detail),
  };
  const indicators = getAiIndicators([edited]);
  const result = indicators.find(indicator => indicator.id === original.id);

  assert.deepEqual(result?.detailItems, edited.detailItems);
  assert.equal(result?.inputTemplate, "FIXED");
  assert.ok(result?.detailItems?.some(detail => detail.label === "직장 내 괴롭힘 예방교육 이수 인원" && detail.unit === "명"));
  result!.frameworks.push("로컬 변경");
  result!.detailItems![0].label = "로컬 변경";
  assert.deepEqual(getDefaultIndicators().find(indicator => indicator.id === original.id), original);
  assert.equal(edited.detailItems[0].label, "수정된 세부 입력 안내");
});
