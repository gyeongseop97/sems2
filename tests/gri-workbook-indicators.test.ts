import assert from "node:assert/strict";
import test from "node:test";
import {
  GRI_WORKBOOK_INDICATORS,
  GRI_WORKBOOK_EXCLUDED_INDICATOR_IDS,
  GRI_WORKBOOK_INDICATOR_ALIASES,
  GRI_WORKBOOK_INDICATOR_COUNTS,
  GRI_WORKBOOK_LEGACY_INDICATORS,
} from "../lib/gri-workbook-indicators";

test("workbook rows are grouped into one SEMS indicator per business topic", () => {
  assert.equal(GRI_WORKBOOK_INDICATOR_COUNTS.total, 35);
  assert.equal(GRI_WORKBOOK_INDICATOR_COUNTS.original, 29);
  assert.equal(GRI_WORKBOOK_INDICATOR_COUNTS.supplemental, 6);
  assert.equal(GRI_WORKBOOK_INDICATOR_COUNTS.excludedGhG, 44);
  assert.equal(GRI_WORKBOOK_INDICATOR_COUNTS.legacy, 579);
  assert.equal(GRI_WORKBOOK_INDICATOR_COUNTS.future, 133);
  assert.equal(GRI_WORKBOOK_INDICATORS.filter((item) => item.inputTemplate === "FIXED").length, 35);

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

test("non-GHG legacy workbook indicators migrate to a semantic indicator detail", () => {
  const excludedIds = new Set(GRI_WORKBOOK_EXCLUDED_INDICATOR_IDS);
  const groupedIds = new Set(GRI_WORKBOOK_INDICATORS.map((item) => item.id));
  for (const legacy of GRI_WORKBOOK_LEGACY_INDICATORS) {
    const alias = GRI_WORKBOOK_INDICATOR_ALIASES[legacy.id];
    if (excludedIds.has(legacy.id)) {
      assert.equal(alias, undefined, `${legacy.name}은 기타 ESG에서 제외되어야 함`);
      continue;
    }
    assert.ok(alias, `${legacy.name} 이관 규칙 누락`);
    assert.ok(groupedIds.has(alias.indicatorId), `${legacy.name} 대상 묶음 누락`);
  }
});

test("similar original and supplemental indicators share one business-topic indicator", () => {
  assert.ok(GRI_WORKBOOK_INDICATORS.some((item) => item.name === "용수 취수·사용·방류 현황" && item.detailItems?.length === 45));
  assert.ok(GRI_WORKBOOK_INDICATORS.some((item) => item.name === "폐기물 발생 및 처리 현황" && item.detailItems?.length === 37));
  assert.ok(GRI_WORKBOOK_INDICATORS.some((item) => item.name === "임직원 구성·다양성·현지채용 현황" && item.detailItems?.length === 27));
  assert.ok(GRI_WORKBOOK_INDICATORS.some((item) => item.name === "윤리·반부패·준법 현황" && item.detailItems?.length === 26));
});

test("Scope 1, 2, and 3 collection stays out of other ESG metrics", () => {
  const names = GRI_WORKBOOK_INDICATORS.map((item) => item.name);
  assert.ok(!names.some((name) => /Scope\s*[123]/i.test(name)));
  for (const id of [11001, 11126, 11127, 11263, 11264, 11308, 11506]) {
    assert.ok(GRI_WORKBOOK_EXCLUDED_INDICATOR_IDS.includes(id));
    assert.equal(GRI_WORKBOOK_INDICATOR_ALIASES[id], undefined);
  }
});

