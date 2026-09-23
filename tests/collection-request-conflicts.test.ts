import assert from "node:assert/strict";
import test from "node:test";
import { findCollectionRequestConflicts } from "../lib/collection-request-conflicts";
import { collectionTaskKey, parseCollectionTaskKey } from "../lib/collection-task-expansion";

test("request conflicts compare exact task keys and site scope", () => {
  const base = { id: "one", title: "전력", periodFrom: "2026-01", periodTo: "2026-02", companies: ["A"], targetIds: [1], status: "수집중" };
  const specific = { ...base, id: "two", taskKeys: [collectionTaskKey("A", 1, "2026-01", "공장")] };
  assert.equal(findCollectionRequestConflicts({ ...base, taskKeys: [collectionTaskKey("A", 1, "2026-01", "본사")] }, [specific]).length, 0);
  assert.equal(findCollectionRequestConflicts({ ...base, taskKeys: [collectionTaskKey("A", 1, "2026-01")] }, [specific])[0]?.duplicateCount, 1);
  assert.equal(findCollectionRequestConflicts({ ...base, taskKeys: [] }, [specific]).length, 0);
});

test("malformed saved task keys are ignored instead of crashing the workspace", () => {
  assert.equal(parseCollectionTaskKey("%::1::2026-01"), null);
  assert.equal(parseCollectionTaskKey("A::1::2026-13"), null);
  assert.equal(parseCollectionTaskKey("A::1::2026-01::"), null);
  assert.deepEqual(parseCollectionTaskKey(collectionTaskKey("법인::A", 1, "2026-01", "공장::1")), { company: "법인::A", targetId: "1", period: "2026-01", site: "공장::1" });
});
