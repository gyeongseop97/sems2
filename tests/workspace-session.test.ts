import assert from "node:assert/strict";
import test from "node:test";
import { WorkspaceSessionGuard } from "../lib/workspace-session";

test("a slow account A load cannot replace account B or signed-out state",()=>{
  const guard=new WorkspaceSessionGuard();
  const accountA=guard.begin("A"),accountB=guard.begin("B");
  assert.equal(guard.isCurrent(accountA),false);
  assert.equal(guard.finish(accountA),false);
  assert.equal(guard.busy,true);
  assert.equal(guard.isCurrent(accountB),true);
  const signedOut=guard.begin(null);
  assert.equal(guard.isCurrent(accountB),false);
  assert.equal(guard.finish(signedOut),true);
  assert.equal(guard.canSave("A"),false);assert.equal(guard.canSave("B"),false);
});
test("same account sign-out/sign-in rejects an earlier generation too",()=>{
  const guard=new WorkspaceSessionGuard();
  const old=guard.begin("A");guard.begin(null);const fresh=guard.begin("A");
  assert.equal(guard.isCurrent(old),false);assert.equal(guard.isCurrent(fresh),true);
});
test("manual reload blocks autosave until that exact GET has completed",()=>{
  const guard=new WorkspaceSessionGuard();const initial=guard.begin("A");guard.finish(initial);
  assert.equal(guard.canSave("A"),true);
  const oldSave=guard.capture(),reload=guard.begin("A");
  assert.equal(guard.canSave("A"),false);assert.equal(guard.isCurrent(oldSave),false);
  guard.finish(reload);assert.equal(guard.canSave("A"),true);
});
test("late completion of an abandoned reload cannot unblock a newer load",()=>{
  const guard=new WorkspaceSessionGuard();const abandoned=guard.begin("A"),current=guard.begin("B");
  assert.equal(guard.finish(abandoned),false);assert.equal(guard.canSave("B"),false);
  assert.equal(guard.finish(current),true);assert.equal(guard.canSave("B"),true);
});

test("initial session lookup cannot start a stale load after a newer auth event",()=>{
  const guard=new WorkspaceSessionGuard();const lookup=guard.capture();
  const signedIn=guard.begin("B");guard.finish(signedIn);
  assert.equal(guard.isCurrent(lookup),false);assert.equal(guard.canSave("B"),true);
});
