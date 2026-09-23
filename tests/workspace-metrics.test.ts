import assert from "node:assert/strict";
import test from "node:test";
import { validateMetricRatio } from "../lib/workspace-metrics";
const indicator={id:1,unit:"%",organizationAggregation:"비율"};
const row={indicatorId:1,value:25,numerator:1,denominator:4,status:"검토대기"};
test("new ratio inputs require a valid basis and matching value",()=>{
  assert.equal(validateMetricRatio(row,undefined,indicator),null);
  assert.match(validateMetricRatio({...row,denominator:0},undefined,indicator)!,/분모/);
  assert.match(validateMetricRatio({...row,numerator:undefined},undefined,indicator)!,/분자/);
  assert.match(validateMetricRatio({...row,value:50},undefined,indicator)!,/일치/);
  assert.equal(validateMetricRatio({...row,value:0,numerator:0,dataStatus:"zero"},undefined,indicator),null);
});
test("N/A and legacy review edits do not invent a ratio basis",()=>{
  assert.equal(validateMetricRatio({value:0,dataStatus:"not_applicable"},undefined,indicator),null);
  const legacy={value:25,status:"검토대기"};
  assert.equal(validateMetricRatio({...legacy,status:"확정",reviewNote:"확인"},legacy,indicator),null);
  assert.match(validateMetricRatio({...legacy,value:30},legacy,indicator)!,/분자/);
});
test("intensity uses multiplier one and plain numeric indicators keep their total",()=>{
  assert.equal(validateMetricRatio({...row,value:.25},undefined,{unit:"t/제품"}),null);
  assert.equal(validateMetricRatio({value:100},undefined,{unit:"시간"}),null);
});
