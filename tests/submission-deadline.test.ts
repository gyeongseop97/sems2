import assert from "node:assert/strict";
import test from "node:test";
import { canCollect, effectiveCollection, submissionExpired } from "../lib/submission-deadline";

test("deadline includes the last millisecond of the Korean calendar day", () => {
  const request = { status: "수집중", dueDate: "2026-09-23" };
  assert.equal(canCollect(request, Date.parse("2026-09-23T14:59:59.999Z")), true);
  assert.equal(canCollect(request, Date.parse("2026-09-23T15:00:00Z")), false);
  assert.equal(effectiveCollection(request, Date.parse("2026-09-23T15:00:00Z")).status, "검토중");
  assert.equal(request.status, "수집중");
});
test("manual closure is respected and deadline extension can reopen collection", () => {
  const now = Date.parse("2026-09-24T00:00:00+09:00");
  assert.equal(canCollect({status:"검토중",dueDate:"2026-09-30"}, now), false);
  assert.equal(canCollect({status:"수집중",dueDate:"2026-09-30"}, now), true);
  assert.equal(submissionExpired({dueDate:""},now), false);
  assert.equal(canCollect(undefined,now), false);
  assert.equal(effectiveCollection({status:"잠금",dueDate:"2026-09-23"},now).status,"잠금");
});
