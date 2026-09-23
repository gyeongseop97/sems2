import assert from "node:assert/strict";
import test from "node:test";
import { revisionConflicts, stableWorkspaceJson, validateWorkspaceTransition } from "../lib/workspace-integrity";

const draft = { id: 1, company: "법인 A", site: "공장 A", status: "작성중", usage: 100, locked: false };
const submitted = { ...draft, status: "검토대기" };
const confirmed = { ...draft, status: "확정", locked: true };

test("every read scope needs an exact revision, including missing organizations", () => {
  assert.deepEqual(revisionConflicts({global:1,org:0},{global:1},["global","org"]), []);
  assert.deepEqual(revisionConflicts({org:0},{global:1},["global","org"]), ["global"]);
  assert.deepEqual(revisionConflicts({global:1,org:2},{global:2,org:2},["global","org"]), ["global"]);
  assert.deepEqual(revisionConflicts({global:-1},{global:0},["global"]), ["global"]);
});
test("structural equality ignores object order, preserving real numeric changes", () => {
  assert.equal(stableWorkspaceJson({a:1,b:{c:2}}),stableWorkspaceJson({b:{c:2},a:1}));
  assert.notEqual(stableWorkspaceJson({a:0}),stableWorkspaceJson({a:null}));
});
test("editors submit and withdraw unchanged data but cannot grant approval", () => {
  assert.equal(validateWorkspaceTransition(draft, submitted, false), null);
  assert.equal(validateWorkspaceTransition(submitted, draft, false), null);
  assert.match(validateWorkspaceTransition(submitted, {...submitted,status:"확정"}, false)!, /관리자/);
  assert.match(validateWorkspaceTransition(draft, {...draft,reviewNote:"승인함"}, false)!, /관리자/);
  assert.match(validateWorkspaceTransition(draft, {...draft,qualityResolutions:{x:{status:"사유 확인"}}}, false)!, /관리자/);
});
test("reviewers cannot change submitted numbers or approve drafts", () => {
  assert.match(validateWorkspaceTransition(submitted, {...submitted,usage:200,status:"확정"}, true)!, /숫자/);
  assert.match(validateWorkspaceTransition(draft, {...draft,status:"확정"}, true)!, /제출/);
  assert.equal(validateWorkspaceTransition(submitted, {...submitted,status:"확정",locked:true,reviewNote:"검토 완료"}, true), null);
});
test("confirmed values remain immutable until a separate reasoned reopening", () => {
  assert.match(validateWorkspaceTransition(confirmed, {...confirmed,usage:200}, true)!, /확정/);
  assert.match(validateWorkspaceTransition(confirmed, {...confirmed,locked:false,status:"작성중"}, true)!, /보완 요청/);
  assert.equal(validateWorkspaceTransition(confirmed, {...confirmed,locked:false,status:"반려",rejectionReason:"계량기 정정 확인"}, true), null);
  assert.match(validateWorkspaceTransition(confirmed, {...confirmed,locked:false,status:"반려",rejectionReason:"정정"}, false)!, /확정/);
});
test("a row cannot move across company or site boundaries", () => {
  assert.match(validateWorkspaceTransition(draft,{...draft,site:"공장 B"},false)!, /사업장/);
  assert.match(validateWorkspaceTransition(draft,{...draft,company:"법인 B"},true)!, /법인/);
});
