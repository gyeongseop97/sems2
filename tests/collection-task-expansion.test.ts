import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGHGCollectionTasks,
  buildMetricCollectionTasks,
  classifyCollectionTasks,
  collectionTaskKey,
  periodsForCollectionCycle,
} from "../lib/collection-task-expansion";

test("annual metric requests expand by each indicator collection cycle", () => {
  const tasks = buildMetricCollectionTasks({
    periodFrom: "2026-01",
    periodTo: "2026-12",
    companies: ["세원정공", "세원물산"],
    indicatorIds: [1, 2, 3, 4],
  }, [
    { id: 1, cycle: "월" },
    { id: 2, cycle: "분기" },
    { id: 3, cycle: "반기" },
    { id: 4, cycle: "연" },
  ]);

  assert.equal(tasks.length, (12 + 4 + 2 + 1) * 2);
  assert.deepEqual(periodsForCollectionCycle("2026-01", "2026-12", "분기"), [
    "2026-03",
    "2026-06",
    "2026-09",
    "2026-12",
  ]);
  assert.deepEqual(periodsForCollectionCycle("2026-01", "2026-12", "반기"), [
    "2026-06",
    "2026-12",
  ]);
  assert.deepEqual(periodsForCollectionCycle("2026-01", "2026-12", "연"), [
    "2026-12",
  ]);
});

test("greenhouse-gas requests always expand into monthly company and scope tasks", () => {
  const tasks = buildGHGCollectionTasks({
    dataFrom: "2026-01",
    dataTo: "2026-12",
    companies: ["세원정공"],
    scopes: ["Scope 1", "Scope 2"],
  });

  assert.equal(tasks.length, 24);
  assert.equal(tasks[0]?.period, "2026-01");
  assert.equal(tasks.at(-1)?.period, "2026-12");
});

test("existing and confirmed tasks are excluded while new tasks remain", () => {
  const candidates = buildMetricCollectionTasks({
    periodFrom: "2026-01",
    periodTo: "2026-03",
    companies: ["세원정공"],
    indicatorIds: [1],
  }, [{ id: 1, cycle: "월" }]);
  const result = classifyCollectionTasks(
    candidates,
    new Set([collectionTaskKey("세원정공", 1, "2026-01")]),
    new Set([collectionTaskKey("세원정공", 1, "2026-02")]),
  );

  assert.equal(result.existing.length, 1);
  assert.equal(result.confirmed.length, 1);
  assert.deepEqual(result.available.map(task => task.period), ["2026-03"]);
});

test("stored task keys preserve a request's exact non-duplicate scope", () => {
  const taskKeys = [
    collectionTaskKey("세원정공", 1, "2026-07"),
    collectionTaskKey("세원정공", 1, "2026-08"),
  ];
  const tasks = buildMetricCollectionTasks({
    periodFrom: "2026-01",
    periodTo: "2026-12",
    companies: ["세원정공"],
    indicatorIds: [1],
    taskKeys,
  }, [{ id: 1, cycle: "월" }]);

  assert.deepEqual(tasks.map(task => task.period), ["2026-07", "2026-08"]);
});
