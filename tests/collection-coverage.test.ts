import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGHGCoverage,
  buildMetricCoverage,
  countCoverage,
  coverageDisplayStatus,
  monthsForCycle,
} from "../lib/collection-coverage";

test("greenhouse-gas coverage separates requested, missing, confirmed, and overdue items", () => {
  const items = buildGHGCoverage({
    year: "2026",
    companies: ["세원정공"],
    targetIds: ["Scope 1", "Scope 2"],
    requests: [{
      id: "CP-1",
      periodFrom: "2026-01",
      periodTo: "2026-02",
      dueDate: "2026-02-20",
      companies: ["세원정공"],
      targetIds: ["Scope 2"],
    }],
    records: [{
      requestId: "CP-1",
      company: "세원정공",
      month: "2026-01",
      targetId: "Scope 2",
      status: "확정",
    }],
    today: "2026-03-01",
  });

  assert.equal(items.length, 24);
  assert.equal(items.find(item => item.month === "2026-01" && item.targetId === "Scope 1")?.status, "미요청");
  assert.equal(items.find(item => item.month === "2026-01" && item.targetId === "Scope 2")?.status, "확정");
  const missingFebruary = items.find(item => item.month === "2026-02" && item.targetId === "Scope 2");
  assert.equal(missingFebruary?.status, "미입력");
  assert.equal(missingFebruary?.overdue, true);
  assert.equal(coverageDisplayStatus(items.filter(item => item.month === "2026-02")), "기한초과");
  assert.equal(countCoverage(items).기한초과, 1);
});

test("metric coverage follows each indicator collection cycle", () => {
  assert.deepEqual(monthsForCycle("2026", "분기"), ["2026-03", "2026-06", "2026-09", "2026-12"]);
  assert.deepEqual(monthsForCycle("2026", "연"), ["2026-12"]);

  const items = buildMetricCoverage({
    year: "2026",
    companies: ["세원정공"],
    targetIds: [1, 2],
    targetCycles: { 1: "월", 2: "연" },
    requests: [{
      id: "MR-1",
      periodFrom: "2026-01",
      periodTo: "2026-12",
      dueDate: "2027-01-31",
      companies: ["세원정공"],
      targetIds: [1, 2],
    }],
    submissions: [{
      requestId: "MR-1",
      company: "세원정공",
      month: "2026-12",
      targetId: 2,
      status: "확정",
    }],
    today: "2026-07-31",
  });

  assert.equal(items.filter(item => item.targetId === 1).length, 12);
  assert.equal(items.filter(item => item.targetId === 2).length, 1);
  assert.equal(items.find(item => item.targetId === 2)?.status, "확정");
});
