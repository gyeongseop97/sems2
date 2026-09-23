import assert from "node:assert/strict";
import test from "node:test";
import { getWorkspaceClosingIssues, type ClosingRow } from "../lib/workspace-closing";
import { collectionTaskKey } from "../lib/collection-task-expansion";
const request={id:"CP",status:"검토중",companies:["A"],dataFrom:"2026-08",dataTo:"2026-09",scopes:["Scope 2"]};
const record=(id:number,site:string,period:string):ClosingRow=>({id,company:"A",site,period,collectionId:"CP",scope:"Scope 2",usage:0,emissions:0,dataStatus:"zero",status:"확정"});
const rows=[record(1,"S1","2026-08"),record(2,"S2","2026-08"),record(3,"S1","2026-09"),record(4,"S2","2026-09")];
const options={kind:"ghg" as const,request,rows,organizations:{A:["S1","S2"]}};
test("closing covers all registered sites and months, with actual zero accepted",()=>{
  assert.deepEqual(getWorkspaceClosingIssues(options),[]);
  const issues=getWorkspaceClosingIssues({...options,rows:rows.slice(0,3)});
  assert.equal(issues.length,1);assert.equal(issues[0].code,"missing");assert.equal(issues[0].site,"S2");assert.equal(issues[0].period,"2026-09");
});
test("one approved row cannot hide an unconfirmed or invalid row in the same task",()=>{
  const issues=getWorkspaceClosingIssues({...options,rows:[...rows,{...rows[0],id:9,status:"검토대기",dataStatus:"missing"}]});
  assert.ok(issues.some(issue=>issue.code==="unconfirmed"));assert.ok(issues.some(issue=>issue.code==="invalid"));
});
test("legacy company keys expand across sites while site-specific keys stay exact",()=>{
  const legacy={...request,taskKeys:[collectionTaskKey("A","Scope 2","2026-08")]};
  assert.equal(getWorkspaceClosingIssues({...options,request:legacy,rows:[rows[0]]})[0].site,"S2");
  assert.deepEqual(getWorkspaceClosingIssues({...options,request:{...legacy,taskKeys:[collectionTaskKey("A","Scope 2","2026-08","S1")]},rows:[rows[0]]}),[]);
});
test("site-less historical data only closes a company with no configured sites",()=>{
  const legacyRow={...rows[0],site:undefined};
  const legacyRequest={...request,dataTo:"2026-08"};
  assert.equal(getWorkspaceClosingIssues({...options,request:legacyRequest,rows:[legacyRow]}).length,2);
  assert.deepEqual(getWorkspaceClosingIssues({...options,request:legacyRequest,rows:[legacyRow],organizations:{A:[]}}),[]);
});
test("explicit requested sites and N/A reasons are respected",()=>{
  const limited={...request,dataTo:"2026-08",sitesByCompany:{A:["S1"]}};
  assert.deepEqual(getWorkspaceClosingIssues({...options,request:limited,rows:[{...rows[0],dataStatus:"not_applicable",description:"미가동"}]}),[]);
  assert.equal(getWorkspaceClosingIssues({...options,request:limited,rows:[{...rows[0],dataStatus:"not_applicable"}]})[0].code,"invalid");
});
test("metric closing follows indicator cycles and rejects invalid ratio bases",()=>{
  const metricRequest={id:"M",status:"검토중",companies:["A"],periodFrom:"2026-01",periodTo:"2026-06",indicatorIds:[1]};
  const metricRows:ClosingRow[]=[{id:1,company:"A",site:"S1",period:"2026-03",requestId:"M",indicatorId:1,value:25,numerator:1,denominator:4,status:"확정"},{id:2,company:"A",site:"S1",period:"2026-06",requestId:"M",indicatorId:1,value:50,numerator:2,denominator:4,status:"확정"}];
  const metric={kind:"metric" as const,request:metricRequest,rows:metricRows,indicators:[{id:1,cycle:"분기",unit:"%"}],organizations:{A:["S1"]}};
  assert.deepEqual(getWorkspaceClosingIssues(metric),[]);
  assert.equal(getWorkspaceClosingIssues({...metric,rows:[{...metricRows[0],denominator:0},metricRows[1]]})[0].code,"invalid");
});
test("empty target configuration cannot be marked complete",()=>{
  assert.equal(getWorkspaceClosingIssues({...options,request:{...request,taskKeys:[]}})[0].code,"empty");
});

import { collectionTaskMatchesRow, mergeWorkspaceRows, validateClosedRequestChange } from "../lib/workspace-integrity";
test("site-specific metric tasks cannot authorize another site",()=>{
  const task={company:"A",targetId:1,period:"2026-09",site:"S1"};
  assert.equal(collectionTaskMatchesRow(task,{...task,site:"S2"}),false);
  assert.equal(collectionTaskMatchesRow(task,{...task,site:"S1"}),true);
  assert.equal(collectionTaskMatchesRow({...task,site:undefined},{...task,site:"S2"}),true);
  assert.equal(collectionTaskMatchesRow({...task,site:undefined},{...task,site:"S2"},["S1"]),false);
});
test("omitted pending rows remain in the exact merged state validated for closing",()=>{
  const pending={...rows[0],id:99,status:"검토대기"};
  const merged=mergeWorkspaceRows([...rows,pending],rows);
  assert.equal(merged.length,5);
  assert.ok(getWorkspaceClosingIssues({...options,rows:merged as ClosingRow[]}).some(issue=>issue.recordId===99&&issue.code==="unconfirmed"));
});
test("closed scope cannot expand even when reopening in the same request",()=>{
  const closed={...request,status:"마감"};
  assert.equal(validateClosedRequestChange(closed,{...closed,status:"수집중"}),null);
  assert.match(validateClosedRequestChange(closed,{...closed,dataTo:"2026-10"})!,/다시 열고/);
  assert.match(validateClosedRequestChange(closed,{...closed,status:"수집중",sitesByCompany:{A:["S3"]}})!,/다시 열고/);
  assert.match(validateClosedRequestChange(closed,{...closed,taskKeys:[collectionTaskKey("A","Scope 2","2026-10")]})!,/다시 열고/);
  assert.equal(validateClosedRequestChange({...closed,status:"수집중"},{...closed,status:"수집중",dataTo:"2026-10"}),null);
});
