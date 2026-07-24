-- Transitional shared workspace persistence for the existing SEMS2 interface.
-- This keeps operational data in Supabase while the individual screens are
-- migrated from local state to normalized tables.

create table if not exists public.workspace_states (
  scope_key text primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.workspace_states enable row level security;

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
