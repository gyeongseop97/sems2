import assert from "node:assert/strict";
import test from "node:test";
import {
  GRI_WORKBOOK_INDICATORS,
  GRI_WORKBOOK_INDICATOR_COUNTS,
} from "../lib/gri-workbook-indicators";

test("the complete quantitative workbook catalog is available as SEMS indicators", () => {
  assert.equal(GRI_WORKBOOK_INDICATOR_COUNTS.total, 579);
  assert.equal(GRI_WORKBOOK_INDICATOR_COUNTS.sourceDataPoints, 425);
  assert.equal(GRI_WORKBOOK_INDICATOR_COUNTS.supplemental, 414);
  assert.equal(GRI_WORKBOOK_INDICATOR_COUNTS.future, 133);
  assert.equal(GRI_WORKBOOK_INDICATORS.filter((item) => item.inputTemplate === "BREAKDOWN").length, 209);

  assert.equal(new Set(GRI_WORKBOOK_INDICATORS.map((item) => item.id)).size, GRI_WORKBOOK_INDICATORS.length);
  assert.equal(new Set(GRI_WORKBOOK_INDICATORS.map((item) => item.code)).size, GRI_WORKBOOK_INDICATORS.length);
  assert.equal(new Set(GRI_WORKBOOK_INDICATORS.map((item) => item.name)).size, GRI_WORKBOOK_INDICATORS.length);
});

test("granular GRI data points remain independently collectable", () => {
  const waterWithdrawal = GRI_WORKBOOK_INDICATORS.filter((item) => item.code.startsWith("GRI-303-3-"));
  assert.equal(waterWithdrawal.length, 20);
  assert.ok(waterWithdrawal.some((item) => item.name.includes("표층수 · 물 스트레스 지역 · 담수")));
  assert.ok(waterWithdrawal.some((item) => item.name.includes("제3자 공급수 · 전체 · 기타수")));

  const requiredNames = [
    "임직원 총 교육시간",
    "개인정보 침해·유출 사건 수",
    "지정폐기물 재활용량",
    "이사회 평균 참석률",
    "ESG 평가 협력사 수",
  ];
  for (const name of requiredNames) {
    assert.ok(GRI_WORKBOOK_INDICATORS.some((item) => item.name === name), `${name} 누락`);
  }
});
