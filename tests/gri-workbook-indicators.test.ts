import assert from "node:assert/strict";
import test from "node:test";
import {
  GRI_WORKBOOK_INDICATORS,
  GRI_WORKBOOK_INDICATOR_ALIASES,
  GRI_WORKBOOK_INDICATOR_COUNTS,
  GRI_WORKBOOK_LEGACY_INDICATORS,
} from "../lib/gri-workbook-indicators";

test("workbook rows are grouped into one SEMS indicator per table title", () => {
  assert.equal(GRI_WORKBOOK_INDICATOR_COUNTS.total, 137);
  assert.equal(GRI_WORKBOOK_INDICATOR_COUNTS.original, 62);
  assert.equal(GRI_WORKBOOK_INDICATOR_COUNTS.supplemental, 75);
  assert.equal(GRI_WORKBOOK_INDICATOR_COUNTS.legacy, 579);
  assert.equal(GRI_WORKBOOK_INDICATOR_COUNTS.future, 133);
  assert.equal(GRI_WORKBOOK_INDICATORS.filter((item) => item.inputTemplate === "FIXED").length, 137);

  assert.equal(new Set(GRI_WORKBOOK_INDICATORS.map((item) => item.id)).size, GRI_WORKBOOK_INDICATORS.length);
  assert.equal(new Set(GRI_WORKBOOK_INDICATORS.map((item) => item.code)).size, GRI_WORKBOOK_INDICATORS.length);
});

test("the human-rights education table is one indicator with fixed detail values", () => {
  const indicator = GRI_WORKBOOK_INDICATORS.find((item) => item.name === "인권 교육 이수 현황");
  assert.ok(indicator);
  assert.equal(indicator.detailItems?.length, 9);
  assert.ok(indicator.detailItems?.some((detail) => detail.label === "장애인 인식개선 교육시간" && detail.unit === "시간"));
  assert.ok(indicator.detailItems?.some((detail) => detail.label === "직장 내 괴롭힘 예방교육 이수 인원" && detail.unit === "명"));
});

test("customer satisfaction workbook tables remain exactly three indicators", () => {
  const names = GRI_WORKBOOK_INDICATORS
    .filter((item) => item.name.startsWith("고객만족"))
    .map((item) => item.name);
  assert.deepEqual(names, [
    "고객만족도 조사 결과",
    "고객만족(클레임)",
    "고객만족(불량건수)",
  ]);
});

test("every legacy workbook indicator migrates to a grouped indicator detail", () => {
  assert.equal(Object.keys(GRI_WORKBOOK_INDICATOR_ALIASES).length, GRI_WORKBOOK_LEGACY_INDICATORS.length);
  const groupedIds = new Set(GRI_WORKBOOK_INDICATORS.map((item) => item.id));
  for (const legacy of GRI_WORKBOOK_LEGACY_INDICATORS) {
    const alias = GRI_WORKBOOK_INDICATOR_ALIASES[legacy.id];
    assert.ok(alias, `${legacy.name} 이관 규칙 누락`);
    assert.ok(groupedIds.has(alias.indicatorId), `${legacy.name} 대상 묶음 누락`);
  }
});

test("supplemental GRI points are grouped by disclosure title", () => {
  const supplemental = GRI_WORKBOOK_INDICATORS.filter((item) => item.id >= 13001);
  assert.equal(supplemental.length, 75);
  assert.ok(supplemental.some((item) => item.name === "수자원 (GRI 303-3)" && item.detailItems?.length === 20));
  assert.ok(supplemental.some((item) => item.name === "가치사슬 에너지 (GRI 103-3)" && item.detailItems?.length === 30));
});
