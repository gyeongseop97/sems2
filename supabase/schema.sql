-- SEMS2 Supabase database schema
-- Run this file once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create type public.sems_role as enum ('admin', 'manager', 'editor', 'viewer');
create type public.record_status as enum ('작성중', '검토대기', '반려', '확정');
create type public.period_status as enum ('예정', '수집중', '검토중', '마감', '잠금');
create type public.target_status as enum ('초안', '승인', '종료');
create type public.plan_status as enum ('계획', '진행중', '완료', '지연');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.profiles (
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

create table public.collection_periods (
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

create table public.period_organizations (
  period_id uuid not null references public.collection_periods(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  primary key (period_id, organization_id)
);

create table public.period_scopes (
  period_id uuid not null references public.collection_periods(id) on delete cascade,
  scope text not null check (scope in ('Scope 1', 'Scope 2', 'Scope 3')),
  primary key (period_id, scope)
);

create table public.emission_factors (
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

create table public.activity_records (
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

create table public.reduction_targets (
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

create table public.reduction_target_scopes (
  target_id uuid not null references public.reduction_targets(id) on delete cascade,
  scope text not null check (scope in ('Scope 1', 'Scope 2', 'Scope 3')),
  primary key (target_id, scope)
);

create table public.reduction_plans (
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

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

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

create policy "authenticated users read organizations" on public.organizations for select to authenticated using (active = true);
create policy "authenticated users read sites" on public.sites for select to authenticated using (active = true);
create policy "users read own profile or admins read all" on public.profiles for select to authenticated using (id = auth.uid() or public.current_profile_role() = 'admin');
create policy "admins update profiles" on public.profiles for update to authenticated using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');

create policy "authenticated users read periods" on public.collection_periods for select to authenticated using (true);
create policy "managers manage periods" on public.collection_periods for all to authenticated using (public.current_profile_role() in ('admin', 'manager')) with check (public.current_profile_role() in ('admin', 'manager'));
create policy "authenticated users read period organizations" on public.period_organizations for select to authenticated using (true);
create policy "managers manage period organizations" on public.period_organizations for all to authenticated using (public.current_profile_role() in ('admin', 'manager')) with check (public.current_profile_role() in ('admin', 'manager'));
create policy "authenticated users read period scopes" on public.period_scopes for select to authenticated using (true);
create policy "managers manage period scopes" on public.period_scopes for all to authenticated using (public.current_profile_role() in ('admin', 'manager')) with check (public.current_profile_role() in ('admin', 'manager'));

create policy "authenticated users read factors" on public.emission_factors for select to authenticated using (active = true or public.current_profile_role() in ('admin', 'manager'));
create policy "managers manage factors" on public.emission_factors for all to authenticated using (public.current_profile_role() in ('admin', 'manager')) with check (public.current_profile_role() in ('admin', 'manager'));

create policy "users read allowed activity records" on public.activity_records for select to authenticated using (
  public.current_profile_role() in ('admin', 'manager')
  or organization_id = public.current_profile_organization()
);
create policy "editors create own organization records" on public.activity_records for insert to authenticated with check (
  public.current_profile_role() in ('admin', 'manager')
  or (public.current_profile_role() = 'editor' and organization_id = public.current_profile_organization() and created_by = auth.uid())
);
create policy "editors update allowed records" on public.activity_records for update to authenticated using (
  public.current_profile_role() in ('admin', 'manager')
  or (public.current_profile_role() = 'editor' and organization_id = public.current_profile_organization() and status in ('작성중', '반려') and locked = false)
) with check (
  public.current_profile_role() in ('admin', 'manager')
  or (public.current_profile_role() = 'editor' and organization_id = public.current_profile_organization())
);
create policy "managers delete activity records" on public.activity_records for delete to authenticated using (public.current_profile_role() in ('admin', 'manager'));

create policy "authenticated users read targets" on public.reduction_targets for select to authenticated using (
  public.current_profile_role() in ('admin', 'manager') or organization_id = public.current_profile_organization()
);
create policy "managers manage targets" on public.reduction_targets for all to authenticated using (public.current_profile_role() in ('admin', 'manager')) with check (public.current_profile_role() in ('admin', 'manager'));
create policy "authenticated users read target scopes" on public.reduction_target_scopes for select to authenticated using (true);
create policy "managers manage target scopes" on public.reduction_target_scopes for all to authenticated using (public.current_profile_role() in ('admin', 'manager')) with check (public.current_profile_role() in ('admin', 'manager'));

create policy "authenticated users read plans" on public.reduction_plans for select to authenticated using (
  public.current_profile_role() in ('admin', 'manager') or organization_id = public.current_profile_organization()
);
create policy "managers manage plans" on public.reduction_plans for all to authenticated using (public.current_profile_role() in ('admin', 'manager')) with check (public.current_profile_role() in ('admin', 'manager'));

create policy "authenticated users read audit" on public.audit_events for select to authenticated using (public.current_profile_role() in ('admin', 'manager'));
create policy "authenticated users insert audit" on public.audit_events for insert to authenticated with check (actor_id = auth.uid());

create policy "authenticated users read settings" on public.app_settings for select to authenticated using (true);
create policy "admins manage settings" on public.app_settings for all to authenticated using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');

insert into storage.buckets (id, name, public)
values ('sems-evidence', 'sems-evidence', false)
on conflict (id) do nothing;

create policy "authenticated users read evidence files"
on storage.objects for select to authenticated
using (bucket_id = 'sems-evidence');

create policy "editors upload evidence files"
on storage.objects for insert to authenticated
with check (bucket_id = 'sems-evidence' and public.current_profile_role() in ('admin', 'manager', 'editor'));

create policy "owners and managers update evidence files"
on storage.objects for update to authenticated
using (bucket_id = 'sems-evidence' and (owner_id = auth.uid()::text or public.current_profile_role() in ('admin', 'manager')))
with check (bucket_id = 'sems-evidence');

create policy "owners and managers delete evidence files"
on storage.objects for delete to authenticated
using (bucket_id = 'sems-evidence' and (owner_id = auth.uid()::text or public.current_profile_role() in ('admin', 'manager')));

-- No sample operational data is inserted intentionally.
