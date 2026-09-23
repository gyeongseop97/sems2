import assert from "node:assert/strict";
import test from "node:test";
import { calculateEmission, type FactorDefinition } from "../lib/factor-calculation";
import { validateEmissionIntegrity } from "../lib/workspace-emissions";
const factor: FactorDefinition = { id:"F1",scope:"Scope 2",category:"구매 전력",source:"전력",value:0.4,activityUnit:"kWh",factorUnit:"kgCO2e/kWh",year:"2026",authority:"test",active:true };
const calculation = calculateEmission({usage:2,unit:"MWh",period:"2026-09",factor});
if(!calculation.ok)throw new Error("fixture calculation failed");
const record={id:1,usage:2,unit:"MWh",period:"2026-09",scope:factor.scope,category:factor.category,source:factor.source,factorId:"F1",factor:factor.value,emissions:calculation.emissions,factorSnapshot:calculation.snapshot,status:"작성중"};
test("server accepts exactly reproducible values and rejects manual numeric tampering",()=>{
  assert.equal(validateEmissionIntegrity(record,undefined,[factor]),null);
  assert.match(validateEmissionIntegrity({...record,emissions:50},undefined,[factor])!,/일치/);
  assert.match(validateEmissionIntegrity({...record,factorSnapshot:{...record.factorSnapshot,value:5}},undefined,[factor])!,/버전/);
});
test("old snapshots remain authoritative on a status-only edit after the library changes",()=>{
  assert.equal(validateEmissionIntegrity({...record,status:"확정"},record,[{...factor,value:5}]),null);
  assert.match(validateEmissionIntegrity({...record,status:"확정",factorSnapshot:{...record.factorSnapshot,value:5}},record,[{...factor,value:5}])!,/기록/);
});
test("legacy rows may be reviewed without inventing a historical factor snapshot",()=>{
  const legacy={...record,factorId:undefined,factorSnapshot:undefined};
  assert.equal(validateEmissionIntegrity({...legacy,status:"확정"},legacy,[]),null);
  assert.match(validateEmissionIntegrity({...legacy,usage:3},legacy,[factor])!,/다시 선택/);
});
test("new activity data cannot use the wrong scope or an expired factor",()=>{
  assert.match(validateEmissionIntegrity({...record,scope:"Scope 1"},undefined,[factor])!,/분류/);
  assert.match(validateEmissionIntegrity(record,undefined,[{...factor,validTo:"2026-08-31"}])!,/기간/);
});
