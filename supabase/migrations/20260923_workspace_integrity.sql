-- Run after the existing migrations. This never changes historical payloads.
-- Deploy this migration BEFORE the application that calls save_workspace_checked.
alter table public.workspace_states add column if not exists revision bigint not null default 0;

create table if not exists public.workspace_change_log (
  id bigint generated always as identity primary key,
  scope_key text not null,
  organization_id uuid,
  revision bigint not null,
  collection text not null,
  entity_key text not null,
  operation text not null check (operation in ('create','update','delete')),
  before_value jsonb,
  after_value jsonb,
  actor_id uuid not null,
  actor_name text not null,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists workspace_change_log_scope_id on public.workspace_change_log(scope_key, id desc);
create table if not exists public.workspace_save_receipts (
  actor_id uuid not null,
  mutation_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (actor_id, mutation_id)
);
alter table public.workspace_change_log enable row level security;
alter table public.workspace_save_receipts enable row level security;
-- All writes pass through the authenticated server API; direct browser writes
-- would bypass workflow validation, revision comparison and audit generation.
revoke insert, update, delete on public.workspace_states from anon, authenticated;
revoke all on public.workspace_change_log, public.workspace_save_receipts from anon, authenticated;
grant select, insert on public.workspace_change_log, public.workspace_save_receipts to service_role;
revoke update, delete, truncate on public.workspace_change_log from service_role;
grant usage, select on sequence public.workspace_change_log_id_seq to service_role;

create or replace function public.deny_workspace_audit_mutation() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception 'Workspace change history is append-only';
end;
$$;
drop trigger if exists workspace_audit_append_only on public.workspace_change_log;
create trigger workspace_audit_append_only before update or delete on public.workspace_change_log
for each row execute function public.deny_workspace_audit_mutation();

create or replace function public.save_workspace_checked(
  p_expected jsonb, p_states jsonb, p_actor_id uuid, p_mutation_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor public.profiles%rowtype;
  item jsonb;
  old_payload jsonb;
  new_payload jsonb;
  current_revision bigint;
  next_revision bigint;
  field_name text;
  previous_item jsonb;
  incoming_item jsonb;
  entry_key text;
  change_row record;
  conflicts jsonb := '[]'::jsonb;
  versions jsonb := '{}'::jsonb;
  receipt jsonb;
  saved_at timestamptz := clock_timestamp();
begin
  -- Also serializes creation of a scope that has no row to SELECT FOR UPDATE.
  perform pg_advisory_xact_lock(727302023);
  select result into receipt from public.workspace_save_receipts where actor_id=p_actor_id and mutation_id=p_mutation_id;
  if found then return receipt; end if;
  select * into actor from public.profiles where id=p_actor_id and active=true;
  if not found or actor.role::text not in ('admin','manager','editor') then raise exception 'Inactive or unauthorized workspace actor'; end if;
  if jsonb_typeof(p_expected) <> 'object' or jsonb_typeof(p_states) <> 'array' or jsonb_array_length(p_states)=0 then raise exception 'Invalid save request'; end if;
  for field_name in select jsonb_object_keys(p_expected) loop
    select revision into current_revision from public.workspace_states where scope_key=field_name for update;
    current_revision := coalesce(current_revision, 0);
    versions := versions || jsonb_build_object(field_name,current_revision);
    if (p_expected->>field_name)::bigint <> current_revision then conflicts := conflicts || to_jsonb(field_name); end if;
  end loop;
  if jsonb_array_length(conflicts)>0 then return jsonb_build_object('conflict',true,'scopes',conflicts,'revisions',versions); end if;
  for item in select value from jsonb_array_elements(p_states) loop
    if not (p_expected ? (item->>'scope_key')) then raise exception 'Missing expected scope revision'; end if;
    if actor.role::text='editor' and ((item->>'scope_key') <> 'organization:'||actor.organization_id::text or (item->>'organization_id')::uuid is distinct from actor.organization_id) then raise exception 'Organization mismatch'; end if;
    select payload,revision into old_payload,current_revision from public.workspace_states where scope_key=item->>'scope_key';
    old_payload := coalesce(old_payload,'{}'::jsonb);
    current_revision := coalesce(current_revision,0);
    new_payload := item->'payload';
    if old_payload = new_payload then continue; end if;
    next_revision := current_revision+1;
    for field_name in select key from (select jsonb_object_keys(old_payload) as key union select jsonb_object_keys(new_payload) as key) fields loop
      -- The old browser activity list is a display cache, not an audit source.
      if field_name in ('audit','organizations') or old_payload->field_name is not distinct from new_payload->field_name then continue; end if;
      if jsonb_typeof(coalesce(new_payload->field_name,old_payload->field_name))='array' then
        for change_row in
          with old_rows as (select coalesce(value->>'id',value->>'code','index:'||ordinality::text) as key,value from jsonb_array_elements(coalesce(old_payload->field_name,'[]'::jsonb)) with ordinality),
          new_rows as (select coalesce(value->>'id',value->>'code','index:'||ordinality::text) as key,value from jsonb_array_elements(coalesce(new_payload->field_name,'[]'::jsonb)) with ordinality)
          select coalesce(o.key,n.key) as key,o.value as before_value,n.value as after_value from old_rows o full join new_rows n using(key) where o.value is distinct from n.value
        loop
          insert into public.workspace_change_log(scope_key,organization_id,revision,collection,entity_key,operation,before_value,after_value,actor_id,actor_name,created_at)
          values(item->>'scope_key',(item->>'organization_id')::uuid,next_revision,field_name,change_row.key,case when change_row.before_value is null then 'create' when change_row.after_value is null then 'delete' else 'update' end,change_row.before_value,change_row.after_value,p_actor_id,coalesce(nullif(actor.display_name,''),actor.email,'SEMS 사용자'),saved_at);
        end loop;
      else
        insert into public.workspace_change_log(scope_key,organization_id,revision,collection,entity_key,operation,before_value,after_value,actor_id,actor_name,created_at)
        values(item->>'scope_key',(item->>'organization_id')::uuid,next_revision,field_name,field_name,'update',old_payload->field_name,new_payload->field_name,p_actor_id,coalesce(nullif(actor.display_name,''),actor.email,'SEMS 사용자'),saved_at);
      end if;
    end loop;
    insert into public.workspace_states(scope_key,organization_id,payload,revision,updated_by,updated_at)
    values(item->>'scope_key',(item->>'organization_id')::uuid,new_payload,next_revision,p_actor_id,saved_at)
    on conflict(scope_key) do update set payload=excluded.payload,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
    versions := versions || jsonb_build_object(item->>'scope_key',next_revision);
  end loop;
  receipt := jsonb_build_object('savedAt',saved_at,'revisions',versions);
  insert into public.workspace_save_receipts(actor_id,mutation_id,result) values(p_actor_id,p_mutation_id,receipt);
  return receipt;
end;
$$;
revoke all on function public.save_workspace_checked(jsonb,jsonb,uuid,uuid) from public, anon, authenticated;
grant execute on function public.save_workspace_checked(jsonb,jsonb,uuid,uuid) to service_role;
