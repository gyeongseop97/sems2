-- Rebuild the live SEMS2 database around the canonical application schema.
-- The incompatible legacy tables are renamed instead of deleted so the
-- original rows remain recoverable.

begin;

create extension if not exists pgcrypto;

drop trigger if exists on_auth_user_created on auth.users;

do $$
begin
  if to_regclass('public.profiles') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'profiles'
         and column_name = 'full_name'
     )
  then
    if to_regclass('public.legacy_profiles_20260729') is not null then
      raise exception 'legacy_profiles_20260729 already exists';
    end if;
    alter table public.profiles rename to legacy_profiles_20260729;
  end if;

  if to_regclass('public.sites') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'sites'
         and column_name = 'company_name'
     )
  then
    if to_regclass('public.legacy_sites_20260729') is not null then
      raise exception 'legacy_sites_20260729 already exists';
    end if;
    alter table public.sites rename to legacy_sites_20260729;
  end if;

  if to_regclass('public.collection_periods') is not null
     and not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'collection_periods'
         and column_name = 'code'
     )
  then
    if to_regclass('public.legacy_collection_periods_20260729') is not null then
      raise exception 'legacy_collection_periods_20260729 already exists';
    end if;
    alter table public.collection_periods rename to legacy_collection_periods_20260729;
  end if;

  if to_regclass('public.emission_factors') is not null
     and not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'emission_factors'
         and column_name = 'code'
     )
  then
    if to_regclass('public.legacy_emission_factors_20260729') is not null then
      raise exception 'legacy_emission_factors_20260729 already exists';
    end if;
    alter table public.emission_factors rename to legacy_emission_factors_20260729;
  end if;

  if to_regclass('public.reduction_targets') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'reduction_targets'
         and column_name = 'company'
     )
  then
    if to_regclass('public.legacy_reduction_targets_20260729') is not null then
      raise exception 'legacy_reduction_targets_20260729 already exists';
    end if;
    alter table public.reduction_targets rename to legacy_reduction_targets_20260729;
  end if;

  if to_regclass('public.reduction_plans') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'reduction_plans'
         and column_name = 'company'
     )
  then
    if to_regclass('public.legacy_reduction_plans_20260729') is not null then
      raise exception 'legacy_reduction_plans_20260729 already exists';
    end if;
    alter table public.reduction_plans rename to legacy_reduction_plans_20260729;
  end if;

  if to_regclass('public.companies') is not null then
    if to_regclass('public.legacy_companies_20260729') is not null then
      raise exception 'legacy_companies_20260729 already exists';
    end if;
    alter table public.companies rename to legacy_companies_20260729;
  end if;

  if to_regclass('public.esg_indicators') is not null then
    if to_regclass('public.legacy_esg_indicators_20260729') is not null then
      raise exception 'legacy_esg_indicators_20260729 already exists';
    end if;
    alter table public.esg_indicators rename to legacy_esg_indicators_20260729;
  end if;

  if to_regclass('public.evidence_items') is not null then
    if to_regclass('public.legacy_evidence_items_20260729') is not null then
      raise exception 'legacy_evidence_items_20260729 already exists';
    end if;
    alter table public.evidence_items rename to legacy_evidence_items_20260729;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'sems_role'
  ) then
    create type public.sems_role as enum ('admin', 'manager', 'editor', 'viewer');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'record_status'
  ) then
    create type public.record_status as enum ('작성중', '검토대기', '반려', '확정');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'period_status'
  ) then
    create type public.period_status as enum ('예정', '수집중', '검토중', '마감', '잠금');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'target_status'
  ) then
    create type public.target_status as enum ('초안', '승인', '종료');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'plan_status'
  ) then
    create type public.plan_status as enum ('계획', '진행중', '완료', '지연');
  end if;
end
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default '',
  department text not null default '',
  role public.sems_role not null default 'viewer',
  organization_id uuid references public.organizations(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_periods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  cycle text not null,
  data_from text not null,
  data_to text not null,
  open_date date not null,
  due_date date not null,
  review_date date,
  evidence_required boolean not null default true,
  status public.period_status not null default '예정',
  description text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.period_organizations (
  period_id uuid not null references public.collection_periods(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  primary key (period_id, organization_id)
);

create table if not exists public.period_scopes (
  period_id uuid not null references public.collection_periods(id) on delete cascade,
  scope text not null check (scope in ('Scope 1', 'Scope 2', 'Scope 3')),
  primary key (period_id, scope)
);

create table if not exists public.emission_factors (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  scope text not null check (scope in ('Scope 1', 'Scope 2', 'Scope 3')),
  category text not null,
  source text not null,
  value numeric not null,
  activity_unit text not null,
  factor_unit text not null,
  reference_year text not null,
  authority text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_records (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.collection_periods(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  reporting_period text not null,
  scope text not null check (scope in ('Scope 1', 'Scope 2', 'Scope 3')),
  category text not null,
  source text not null,
  usage numeric not null default 0,
  unit text not null,
  factor numeric not null default 0,
  emissions numeric not null default 0,
  owner_name text not null default '',
  department text not null default '',
  status public.record_status not null default '작성중',
  evidence_path text,
  description text,
  rejection_reason text,
  locked boolean not null default false,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, organization_id, site_id, reporting_period, scope, category, source)
);

create table if not exists public.reduction_targets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  baseline_year integer not null,
  baseline_emissions numeric not null,
  target_year integer not null,
  reduction_rate numeric not null,
  target_emissions numeric not null,
  owner_name text not null default '',
  status public.target_status not null default '초안',
  description text not null default '',
  approved_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reduction_target_scopes (
  target_id uuid not null references public.reduction_targets(id) on delete cascade,
  scope text not null check (scope in ('Scope 1', 'Scope 2', 'Scope 3')),
  primary key (target_id, scope)
);

create table if not exists public.reduction_plans (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.reduction_targets(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  title text not null,
  scope text not null check (scope in ('Scope 1', 'Scope 2', 'Scope 3')),
  category text not null,
  department text not null default '',
  owner_name text not null default '',
  start_date date not null,
  end_date date not null,
  expected_reduction numeric not null default 0,
  actual_reduction numeric not null default 0,
  budget numeric not null default 0,
  progress integer not null default 0 check (progress between 0 and 100),
  status public.plan_status not null default '계획',
  verification text not null default '',
  description text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_states (
  scope_key text primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.organizations (name, code, active)
values
  ('세원정공', 'SEWON-PRECISION', true),
  ('세원물산', 'SEWON-CORP', true),
  ('세원테크', 'SEWON-TECH', true),
  ('세원E&I', 'SEWON-ENI', true),
  ('Sewon America', 'SEWON-AMERICA', true)
on conflict (name) do update
set code = excluded.code, active = true;

insert into public.sites (organization_id, name, code, active)
select o.id, s.site_name, s.site_code, true
from (
  values
    ('SEWON-PRECISION', '세원정공', 'SP-01'),
    ('SEWON-CORP', '도남공장', 'SC-01'),
    ('SEWON-CORP', '채신공장', 'SC-02'),
    ('SEWON-TECH', '세원테크', 'ST-01'),
    ('SEWON-ENI', '세원E&I', 'SE-01'),
    ('SEWON-AMERICA', 'LaGrange', 'SA-01'),
    ('SEWON-AMERICA', 'Rincon', 'SA-02')
) as s(org_code, site_name, site_code)
join public.organizations o on o.code = s.org_code
on conflict (organization_id, name) do update
set code = excluded.code, active = true;

do $$
begin
  if to_regclass('public.legacy_profiles_20260729') is not null then
    execute $migration$
      insert into public.profiles (
        id,
        email,
        display_name,
        department,
        role,
        organization_id,
        site_id,
        active,
        created_at,
        updated_at
      )
      select
        u.id,
        u.email,
        case
          when lower(coalesce(u.email, '')) = 'mgs15158@se-won.co.kr' then '문경섭'
          else coalesce(
            nullif(regexp_replace(lp.full_name, '^기획팀\s*', ''), ''),
            split_part(coalesce(u.email, ''), '@', 1)
          )
        end,
        case when coalesce(lp.full_name, '') like '기획팀%' then '기획팀' else '' end,
        case
          when lp.role in ('admin', 'manager', 'editor', 'viewer') then lp.role::public.sems_role
          else 'viewer'::public.sems_role
        end,
        null,
        null,
        coalesce(lp.active, true),
        coalesce(lp.created_at, now()),
        now()
      from auth.users u
      left join public.legacy_profiles_20260729 lp on lp.id = u.id
      on conflict (id) do update
      set
        email = excluded.email,
        display_name = excluded.display_name,
        department = excluded.department,
        role = excluded.role,
        active = excluded.active,
        updated_at = now()
    $migration$;
  else
    insert into public.profiles (
      id,
      email,
      display_name,
      department,
      role,
      active
    )
    select
      u.id,
      u.email,
      case
        when lower(coalesce(u.email, '')) = 'mgs15158@se-won.co.kr' then '문경섭'
        else split_part(coalesce(u.email, ''), '@', 1)
      end,
      case when lower(coalesce(u.email, '')) = 'mgs15158@se-won.co.kr' then '기획팀' else '' end,
      case
        when lower(coalesce(u.email, '')) = 'mgs15158@se-won.co.kr' then 'admin'::public.sems_role
        else 'viewer'::public.sems_role
      end,
      true
    from auth.users u
    on conflict (id) do nothing;
  end if;
end
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organizations_touch on public.organizations;
drop trigger if exists sites_touch on public.sites;
drop trigger if exists profiles_touch on public.profiles;
drop trigger if exists periods_touch on public.collection_periods;
drop trigger if exists factors_touch on public.emission_factors;
drop trigger if exists activity_touch on public.activity_records;
drop trigger if exists targets_touch on public.reduction_targets;
drop trigger if exists plans_touch on public.reduction_plans;

create trigger organizations_touch before update on public.organizations for each row execute function public.touch_updated_at();
create trigger sites_touch before update on public.sites for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger periods_touch before update on public.collection_periods for each row execute function public.touch_updated_at();
create trigger factors_touch before update on public.emission_factors for each row execute function public.touch_updated_at();
create trigger activity_touch before update on public.activity_records for each row execute function public.touch_updated_at();
create trigger targets_touch before update on public.reduction_targets for each row execute function public.touch_updated_at();
create trigger plans_touch before update on public.reduction_plans for each row execute function public.touch_updated_at();

create or replace function public.current_profile_role()
returns public.sems_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.current_profile_organization()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid() and active = true;
$$;

alter table public.organizations enable row level security;
alter table public.sites enable row level security;
alter table public.profiles enable row level security;
alter table public.collection_periods enable row level security;
alter table public.period_organizations enable row level security;
alter table public.period_scopes enable row level security;
alter table public.emission_factors enable row level security;
alter table public.activity_records enable row level security;
alter table public.reduction_targets enable row level security;
alter table public.reduction_target_scopes enable row level security;
alter table public.reduction_plans enable row level security;
alter table public.audit_events enable row level security;
alter table public.app_settings enable row level security;
alter table public.workspace_states enable row level security;

drop policy if exists "authenticated users read organizations" on public.organizations;
drop policy if exists "authenticated users read sites" on public.sites;
drop policy if exists "users read own profile or admins read all" on public.profiles;
drop policy if exists "admins update profiles" on public.profiles;
drop policy if exists "authenticated users read periods" on public.collection_periods;
drop policy if exists "managers manage periods" on public.collection_periods;
drop policy if exists "authenticated users read period organizations" on public.period_organizations;
drop policy if exists "managers manage period organizations" on public.period_organizations;
drop policy if exists "authenticated users read period scopes" on public.period_scopes;
drop policy if exists "managers manage period scopes" on public.period_scopes;
drop policy if exists "authenticated users read factors" on public.emission_factors;
drop policy if exists "managers manage factors" on public.emission_factors;
drop policy if exists "users read allowed activity records" on public.activity_records;
drop policy if exists "editors create own organization records" on public.activity_records;
drop policy if exists "editors update allowed records" on public.activity_records;
drop policy if exists "managers delete activity records" on public.activity_records;
drop policy if exists "authenticated users read targets" on public.reduction_targets;
drop policy if exists "managers manage targets" on public.reduction_targets;
drop policy if exists "authenticated users read target scopes" on public.reduction_target_scopes;
drop policy if exists "managers manage target scopes" on public.reduction_target_scopes;
drop policy if exists "authenticated users read plans" on public.reduction_plans;
drop policy if exists "managers manage plans" on public.reduction_plans;
drop policy if exists "authenticated users read audit" on public.audit_events;
drop policy if exists "authenticated users insert audit" on public.audit_events;
drop policy if exists "authenticated users read settings" on public.app_settings;
drop policy if exists "admins manage settings" on public.app_settings;
drop policy if exists "managers read all workspace states" on public.workspace_states;
drop policy if exists "organization users read own workspace state" on public.workspace_states;
drop policy if exists "managers insert all workspace states" on public.workspace_states;
drop policy if exists "editors insert own workspace state" on public.workspace_states;
drop policy if exists "managers update all workspace states" on public.workspace_states;
drop policy if exists "editors update own workspace state" on public.workspace_states;

create policy "authenticated users read organizations"
on public.organizations for select to authenticated using (active = true);

create policy "authenticated users read sites"
on public.sites for select to authenticated using (active = true);

create policy "users read own profile or admins read all"
on public.profiles for select to authenticated
using (id = auth.uid() or public.current_profile_role() = 'admin');

create policy "admins update profiles"
on public.profiles for update to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy "authenticated users read periods"
on public.collection_periods for select to authenticated using (true);

create policy "managers manage periods"
on public.collection_periods for all to authenticated
using (public.current_profile_role() in ('admin', 'manager'))
with check (public.current_profile_role() in ('admin', 'manager'));

create policy "authenticated users read period organizations"
on public.period_organizations for select to authenticated using (true);

create policy "managers manage period organizations"
on public.period_organizations for all to authenticated
using (public.current_profile_role() in ('admin', 'manager'))
with check (public.current_profile_role() in ('admin', 'manager'));

create policy "authenticated users read period scopes"
on public.period_scopes for select to authenticated using (true);

create policy "managers manage period scopes"
on public.period_scopes for all to authenticated
using (public.current_profile_role() in ('admin', 'manager'))
with check (public.current_profile_role() in ('admin', 'manager'));

create policy "authenticated users read factors"
on public.emission_factors for select to authenticated
using (active = true or public.current_profile_role() in ('admin', 'manager'));

create policy "managers manage factors"
on public.emission_factors for all to authenticated
using (public.current_profile_role() in ('admin', 'manager'))
with check (public.current_profile_role() in ('admin', 'manager'));

create policy "users read allowed activity records"
on public.activity_records for select to authenticated
using (
  public.current_profile_role() in ('admin', 'manager')
  or organization_id = public.current_profile_organization()
);

create policy "editors create own organization records"
on public.activity_records for insert to authenticated
with check (
  public.current_profile_role() in ('admin', 'manager')
  or (
    public.current_profile_role() = 'editor'
    and organization_id = public.current_profile_organization()
    and created_by = auth.uid()
  )
);

create policy "editors update allowed records"
on public.activity_records for update to authenticated
using (
  public.current_profile_role() in ('admin', 'manager')
  or (
    public.current_profile_role() = 'editor'
    and organization_id = public.current_profile_organization()
    and status in ('작성중', '반려')
    and locked = false
  )
)
with check (
  public.current_profile_role() in ('admin', 'manager')
  or (
    public.current_profile_role() = 'editor'
    and organization_id = public.current_profile_organization()
  )
);

create policy "managers delete activity records"
on public.activity_records for delete to authenticated
using (public.current_profile_role() in ('admin', 'manager'));

create policy "authenticated users read targets"
on public.reduction_targets for select to authenticated
using (
  public.current_profile_role() in ('admin', 'manager')
  or organization_id = public.current_profile_organization()
);

create policy "managers manage targets"
on public.reduction_targets for all to authenticated
using (public.current_profile_role() in ('admin', 'manager'))
with check (public.current_profile_role() in ('admin', 'manager'));

create policy "authenticated users read target scopes"
on public.reduction_target_scopes for select to authenticated using (true);

create policy "managers manage target scopes"
on public.reduction_target_scopes for all to authenticated
using (public.current_profile_role() in ('admin', 'manager'))
with check (public.current_profile_role() in ('admin', 'manager'));

create policy "authenticated users read plans"
on public.reduction_plans for select to authenticated
using (
  public.current_profile_role() in ('admin', 'manager')
  or organization_id = public.current_profile_organization()
);

create policy "managers manage plans"
on public.reduction_plans for all to authenticated
using (public.current_profile_role() in ('admin', 'manager'))
with check (public.current_profile_role() in ('admin', 'manager'));

create policy "authenticated users read audit"
on public.audit_events for select to authenticated
using (public.current_profile_role() in ('admin', 'manager'));

create policy "authenticated users insert audit"
on public.audit_events for insert to authenticated
with check (actor_id = auth.uid());

create policy "authenticated users read settings"
on public.app_settings for select to authenticated using (true);

create policy "admins manage settings"
on public.app_settings for all to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy "managers read all workspace states"
on public.workspace_states for select to authenticated
using (public.current_profile_role() in ('admin', 'manager'));

create policy "organization users read own workspace state"
on public.workspace_states for select to authenticated
using (organization_id = public.current_profile_organization());

create policy "managers insert all workspace states"
on public.workspace_states for insert to authenticated
with check (public.current_profile_role() in ('admin', 'manager'));

create policy "editors insert own workspace state"
on public.workspace_states for insert to authenticated
with check (
  public.current_profile_role() = 'editor'
  and organization_id = public.current_profile_organization()
  and updated_by = auth.uid()
);

create policy "managers update all workspace states"
on public.workspace_states for update to authenticated
using (public.current_profile_role() in ('admin', 'manager'))
with check (public.current_profile_role() in ('admin', 'manager'));

create policy "editors update own workspace state"
on public.workspace_states for update to authenticated
using (
  public.current_profile_role() = 'editor'
  and organization_id = public.current_profile_organization()
)
with check (
  public.current_profile_role() = 'editor'
  and organization_id = public.current_profile_organization()
  and updated_by = auth.uid()
);

create index if not exists workspace_states_organization_idx
on public.workspace_states (organization_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sems2-evidence',
  'sems2-evidence',
  false,
  20971520,
  array[
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated users read evidence files" on storage.objects;
drop policy if exists "editors upload evidence files" on storage.objects;
drop policy if exists "owners and managers update evidence files" on storage.objects;
drop policy if exists "owners and managers delete evidence files" on storage.objects;

create policy "authenticated users read evidence files"
on storage.objects for select to authenticated
using (bucket_id = 'sems2-evidence');

create policy "editors upload evidence files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'sems2-evidence'
  and public.current_profile_role() in ('admin', 'manager', 'editor')
);

create policy "owners and managers update evidence files"
on storage.objects for update to authenticated
using (
  bucket_id = 'sems2-evidence'
  and (owner_id = auth.uid()::text or public.current_profile_role() in ('admin', 'manager'))
)
with check (bucket_id = 'sems2-evidence');

create policy "owners and managers delete evidence files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'sems2-evidence'
  and (owner_id = auth.uid()::text or public.current_profile_role() in ('admin', 'manager'))
);

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on table
  public.organizations,
  public.sites,
  public.profiles,
  public.collection_periods,
  public.period_organizations,
  public.period_scopes,
  public.emission_factors,
  public.activity_records,
  public.reduction_targets,
  public.reduction_target_scopes,
  public.reduction_plans,
  public.audit_events,
  public.app_settings,
  public.workspace_states
to authenticated;

grant all privileges on table
  public.organizations,
  public.sites,
  public.profiles,
  public.collection_periods,
  public.period_organizations,
  public.period_scopes,
  public.emission_factors,
  public.activity_records,
  public.reduction_targets,
  public.reduction_target_scopes,
  public.reduction_plans,
  public.audit_events,
  public.app_settings,
  public.workspace_states
to service_role;

grant execute on function public.current_profile_role() to authenticated, service_role;
grant execute on function public.current_profile_organization() to authenticated, service_role;

commit;
