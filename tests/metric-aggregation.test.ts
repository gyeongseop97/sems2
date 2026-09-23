import assert from "node:assert/strict";
import test from "node:test";
import { aggregateMetric, dataValueStatus, validateDataValue } from "../lib/metric-aggregation";

test("year-end headcount selects each organization's snapshot before summing 100 + 300", () => {
  const result = aggregateMetric({ aggregation: "최종값", unit: "명" }, [
    { company: "A", site: "본사", period: "2026-01", value: 90 },
    { company: "B", site: "공장", period: "2026-12", value: 300 },
    { company: "A", site: "본사", period: "2026-12", value: 100 },
    { company: "B", site: "공장", period: "2026-01", value: 200 },
    { company: "A", site: "본사", period: "2025-12", value: 1000 },
  ], { year: 2026 });
  assert.equal(result.value, 400);
  assert.deepEqual(result.groups.map(group => group.value), [100, 300]);
  assert.ok(result.groups.every(group => group.periods.join() === "2026-12"));
});

test("period averages and organization aggregation are separate", () => {
  const rows = [
    { company: "A", period: "2026-01", value: 100 },
    { company: "A", period: "2026-02", value: 200 },
    { company: "B", period: "2026-01", value: 400 },
  ];
  assert.equal(aggregateMetric({ aggregation: "평균" }, rows).value, 550);
  assert.equal(aggregateMetric({ aggregation: "평균", organizationAggregation: "평균" }, rows).value, 275);
});

test("group ratio recalculates from 60 / 1100 instead of averaging percentages", () => {
  const rows = [
    { company: "A", period: "2026-12", value: 50, numerator: 50, denominator: 100 },
    { company: "B", period: "2026-12", value: 1, numerator: 10, denominator: 1000 },
  ];
  const result = aggregateMetric({ aggregation: "최종값", organizationAggregation: "비율", unit: "%" }, rows);
  assert.equal(result.value, 60 / 1100 * 100);
  assert.equal(result.numerator, 60);
  assert.equal(result.denominator, 1100);
  const noBasis = aggregateMetric({ aggregation: "최종값", unit: "%" }, rows.map(({ company, period, value }) => ({ company, period, value })));
  assert.equal(noBasis.value, null);
  assert.match(noBasis.warnings.join(), /분자와 분모/);
});

test("zero, estimate, not-applicable and missing remain distinct", () => {
  const result = aggregateMetric({ aggregation: "합계" }, [
    { company: "A", period: "2026-01", value: 0, dataStatus: "zero" },
    { company: "B", period: "2026-01", value: 0, dataStatus: "estimated" },
    { company: "C", period: "2026-01", value: 100, dataStatus: "not_applicable" },
    { company: "D", period: "2026-01", value: 0, dataStatus: "missing" },
  ], { expectedOrganizations: [{ company: "A" }, { company: "B" }, { company: "C" }, { company: "D" }, { company: "E" }] });
  assert.equal(result.value, 0);
  assert.equal(result.zeroCount, 1);
  assert.equal(result.estimatedCount, 1);
  assert.equal(result.notApplicableCount, 1);
  assert.equal(result.missingCount, 2);
  assert.equal(dataValueStatus({ value: null }), "missing");
  assert.equal(dataValueStatus({ value: 0, dataStatus: "estimated" }), "estimated");
  assert.notEqual(validateDataValue({ value: 10, dataStatus: "zero" }), null);
  assert.notEqual(validateDataValue({ value: 0, dataStatus: "not_applicable" }), null);
  assert.equal(validateDataValue({ value: 0, dataStatus: "not_applicable", description: "대상 시설 없음" }), null);
  assert.notEqual(validateDataValue({ value: 10, dataStatus: "estimated" }), null);
  assert.equal(validateDataValue({ value: 10, dataStatus: "estimated", description: "전년 사용량 비례 추정" }), null);
});

test("a missing or not-applicable final period never silently reuses an older snapshot", () => {
  assert.equal(aggregateMetric({ aggregation: "최종값" }, [
    { company: "A", period: "2026-01", value: 100 },
    { company: "A", period: "2026-12", value: null },
  ]).value, null);
  assert.equal(aggregateMetric({ aggregation: "최종값" }, [
    { company: "A", period: "2026-01", value: 100 },
    { company: "A", period: "2026-12", value: 0, dataStatus: "not_applicable" },
  ]).value, null);
});

test("missing expected sites and periods remain visible even when other rows are confirmed", () => {
  const result = aggregateMetric({ aggregation: "합계" }, [
    { company: "A", site: "본사", period: "2026-01", value: 20 },
  ], { expectedOrganizations: [{ company: "A", site: "본사" }, { company: "A", site: "공장" }], expectedPeriods: ["2026-01", "2026-02"] });
  assert.equal(result.value, 20);
  assert.equal(result.missingCount, 3);
  assert.equal(result.groups.find(group => group.site === "공장")?.value, null);
});

test("ratios with zero denominator and duplicate snapshots do not produce misleading totals", () => {
  assert.equal(aggregateMetric({ organizationAggregation: "비율" }, [{ company: "A", period: "2026-01", value: 0, numerator: 10, denominator: 0 }]).value, null);
  const result = aggregateMetric({ aggregation: "최종값" }, [
    { company: "A", period: "2026-12", value: 100 },
    { company: "A", period: "2026-12", value: 200 },
  ]);
  assert.equal(result.value, null);
  assert.match(result.warnings.join(), /중복/);
});

test("unknown runtime data states are invalid instead of becoming measured values", () => {
  assert.equal(dataValueStatus({ value: 10, dataStatus: "constructor" as never }), "missing");
  assert.match(validateDataValue({ value: 10, dataStatus: "random" as never }) ?? "", /올바르지/);
});

test("a duplicate earlier month does not replace a valid unique year-end snapshot", () => {
  const result = aggregateMetric({ aggregation: "최종값" }, [
    { company: "A", period: "2026-01", value: 90 },
    { company: "A", period: "2026-01", value: 95 },
    { company: "A", period: "2026-12", value: 100 },
  ]);
  assert.equal(result.value, 100);
  assert.deepEqual(result.groups[0].periods, ["2026-12"]);
});

test("non-finite aggregation results are surfaced as a calculation problem", () => {
  const result = aggregateMetric({ aggregation: "합계" }, [
    { company: "A", period: "2026-01", value: Number.MAX_VALUE },
    { company: "A", period: "2026-02", value: Number.MAX_VALUE },
  ]);
  assert.equal(result.value, null);
});
