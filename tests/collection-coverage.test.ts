import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGHGCoverage,
  buildMetricCoverage,
  countCoverage,
  coverageDisplayStatus,
  monthsForCycle,
} from "../lib/collection-coverage";
import { collectionTaskKey } from "../lib/collection-task-expansion";

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

test("stored task keys mark only the generated periods as requested", () => {
  const items = buildMetricCoverage({
    year: "2026",
    companies: ["세원정공"],
    targetIds: [1],
    targetCycles: { 1: "월" },
    requests: [{
      id: "MR-2",
      periodFrom: "2026-01",
      periodTo: "2026-12",
      dueDate: "2027-01-31",
      companies: ["세원정공"],
      targetIds: [1],
      taskKeys: [
        collectionTaskKey("세원정공", 1, "2026-07"),
        collectionTaskKey("세원정공", 1, "2026-08"),
      ],
    }],
    submissions: [],
    today: "2026-07-31",
  });

  assert.equal(items.find(item => item.month === "2026-06")?.status, "미요청");
  assert.equal(items.find(item => item.month === "2026-07")?.status, "미입력");
  assert.equal(items.find(item => item.month === "2026-08")?.status, "미입력");
  assert.equal(items.find(item => item.month === "2026-09")?.status, "미요청");
});

test("legacy company task keys expand across registered sites and cannot hide a missing site", () => {
  const items = buildGHGCoverage({
    year: "2026", companies: ["세원정공"], sitesByCompany: { 세원정공: ["본사", "공장"] }, targetIds: ["Scope 2"],
    requests: [{ id: "legacy", periodFrom: "2026-01", periodTo: "2026-01", dueDate: "2026-02-10", companies: ["세원정공"], targetIds: ["Scope 2"], taskKeys: [collectionTaskKey("세원정공", "Scope 2", "2026-01")] }],
    records: [{ requestId: "legacy", company: "세원정공", site: "본사", month: "2026-01", targetId: "Scope 2", status: "확정", dataStatus: "zero" }], today: "2026-02-11",
  });
  const january = items.filter(item => item.month === "2026-01");
  assert.equal(january.length, 2);
  assert.equal(january.find(item => item.site === "본사")?.dataStatus, "zero");
  assert.equal(january.find(item => item.site === "본사")?.status, "확정");
  assert.equal(january.find(item => item.site === "공장")?.status, "미입력");
  assert.equal(countCoverage(january).확정, 1);
  assert.equal(countCoverage(january).기한초과, 1);
});

test("specific-site tasks never request another site; explicit missing values are not complete", () => {
  const items = buildMetricCoverage({
    year: "2026", companies: ["A"], sitesByCompany: { A: ["본사", "공장"] }, targetIds: [1], targetCycles: { 1: "연" },
    requests: [{ id: "r", periodFrom: "2026-01", periodTo: "2026-12", dueDate: "2027-01-01", companies: ["A"], targetIds: [1], taskKeys: [collectionTaskKey("A", 1, "2026-12", "본사")] }],
    submissions: [{ requestId: "r", company: "A", site: "본사", month: "2026-12", targetId: 1, status: "확정", dataStatus: "missing" }], today: "2026-12-01",
  });
  assert.equal(items.find(item => item.site === "본사")?.status, "미입력");
  assert.equal(items.find(item => item.site === "공장")?.status, "미요청");
});

test("partial-quarter and partial-year requests are shown at their actual requested periods", () => {
  const items = buildMetricCoverage({
    year: "2026", companies: ["A"], targetIds: [1, 2], targetCycles: { 1: "분기", 2: "연" },
    requests: [{ id: "r", periodFrom: "2026-01", periodTo: "2026-02", dueDate: "2026-03-01", companies: ["A"], targetIds: [1, 2] }], submissions: [], today: "2026-02-01",
  });
  assert.equal(items.filter(item => item.month === "2026-02" && item.status === "미입력").length, 2);
  assert.equal(items.filter(item => item.month === "2026-03" && item.status === "미입력").length, 0);
});
