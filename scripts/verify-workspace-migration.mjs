/** Run with PGLITE_MODULE pointing at an isolated @electric-sql/pglite install.
 * This starts a disposable in-memory PostgreSQL instance. No external DB is used.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite');
const db = new PGlite();
const admin = '10000000-0000-4000-8000-000000000001';
const editor = '10000000-0000-4000-8000-000000000002';
const org = '20000000-0000-4000-8000-000000000001';
const otherOrg = '20000000-0000-4000-8000-000000000002';
let requestNumber = 0;
const mutation = () => `30000000-0000-4000-8000-${String(++requestNumber).padStart(12,'0')}`;
await db.exec(`
create role anon; create role authenticated; create role service_role;
create table public.profiles(id uuid primary key, organization_id uuid, display_name text, email text, active boolean, role text);
create table public.workspace_states(scope_key text primary key,organization_id uuid,payload jsonb not null default '{}',updated_by uuid,updated_at timestamptz);
insert into public.profiles values ('${admin}',null,'관리자','admin@example.test',true,'admin'),('${editor}','${org}','입력자','editor@example.test',true,'editor');
`);
const migration = await fs.readFile(new URL('../supabase/migrations/20260923_workspace_integrity.sql', import.meta.url),'utf8');
await db.exec(migration);
await db.exec(migration); // A repeated deployment does not destroy data or fail.
async function save(expected, states, actor=admin, id=mutation()) {
  return (await db.query('select public.save_workspace_checked($1::jsonb,$2::jsonb,$3::uuid,$4::uuid) as result',[JSON.stringify(expected),JSON.stringify(states),actor,id])).rows[0].result;
}
const scope=`organization:${org}`;
const global={scope_key:'global',organization_id:null,payload:{periods:[{id:'P1',status:'수집중'}],audit:[]}};
const initial={scope_key:scope,organization_id:org,payload:{records:[{id:1,usage:100,status:'작성중'},{id:2,usage:200,status:'작성중'}],audit:[{actor:'fake',at:'1900-01-01'}]}};
const firstId=mutation();
const first=await save({global:0,[scope]:0},[global,initial],admin,firstId);
assert.equal(first.revisions.global,1);assert.equal(first.revisions[scope],1);
const history=(await db.query('select * from public.workspace_change_log order by id')).rows;
assert.equal(history.length,3);assert.ok(history.every(row=>row.actor_id===admin&&row.actor_name==='관리자'));
assert.ok(history.every(row=>String(row.created_at).includes('2026') || Date.parse(row.created_at)>Date.parse('2020-01-01')));
assert.equal(history.filter(row=>row.collection==='audit').length,0);
assert.equal(history.find(row=>row.entity_key==='1').after_value.usage,100);
assert.deepEqual(await save({global:0,[scope]:0},[global,initial],admin,firstId),first);
assert.equal((await db.query('select count(*)::int as count from public.workspace_change_log')).rows[0].count,3);
console.log('PASS: first save atomically records each changed row with server actor/time; lost response retries are idempotent.');
const revised={...initial,payload:{...initial.payload,records:[{id:1,usage:150,status:'작성중'},{id:2,usage:250,status:'작성중'}]}};
const [winner,loser]=await Promise.all([save(first.revisions,[revised],editor),save(first.revisions,[{...revised,payload:{records:[{id:1,usage:999}]}}],editor)]);
assert.equal(winner.revisions[scope],2);assert.equal(loser.conflict,true);
const state=(await db.query('select * from public.workspace_states where scope_key=$1',[scope])).rows[0];
assert.equal(state.payload.records[0].usage,150);assert.equal(state.payload.records[1].usage,250);
const deltas=(await db.query('select * from public.workspace_change_log where revision=2 order by id')).rows;
assert.equal(deltas.length,2);assert.equal(deltas[0].before_value.usage,100);assert.equal(deltas[0].after_value.usage,150);
console.log('PASS: concurrent saves with one base revision produce exactly one winner and preserve its values.');
// The first scope would be mutated before the invalid second scope throws.
const beforeRollback=(await db.query('select count(*)::int as count from public.workspace_change_log')).rows[0].count;
await assert.rejects(save(winner.revisions,[{...global,payload:{periods:[{id:'P1',status:'검토중'}]}},{scope_key:`organization:${otherOrg}`,organization_id:otherOrg,payload:{}}]));
assert.equal((await db.query("select payload->'periods'->0->>'status' as status from public.workspace_states where scope_key='global'")).rows[0].status,'수집중');
assert.equal((await db.query('select count(*)::int as count from public.workspace_change_log')).rows[0].count,beforeRollback);
console.log('PASS: a later write failure rolls back both earlier scopes and audit events in the same transaction.');
await assert.rejects(db.exec("update public.workspace_change_log set actor_name='forged'"),/append-only/);
await assert.rejects(db.exec('delete from public.workspace_change_log'),/append-only/);
await assert.rejects(save({...winner.revisions,[`organization:${otherOrg}`]:0},[{scope_key:`organization:${otherOrg}`,organization_id:otherOrg,payload:{records:[]}}],editor),/Organization mismatch/);
await db.exec('set role authenticated');
await assert.rejects(db.exec("update public.workspace_states set payload='{}'"),/permission denied/);
await assert.rejects(db.query('select public.save_workspace_checked($1::jsonb,$2::jsonb,$3::uuid,$4::uuid)',['{}','[]',admin,mutation()]),/permission denied/);
await db.exec('reset role');
console.log('PASS: history cannot be edited/deleted; organization scope and browser write boundaries are enforced.');
await db.close();
