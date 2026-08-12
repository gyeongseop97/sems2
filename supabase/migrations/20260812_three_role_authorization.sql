-- SEMS2 three-role authorization model
-- 관리자: all organizations, writes, reviews and approvals
-- 자료 입력자: own organization reads plus assigned-request input/submission
-- 조회자: own organization read-only

-- Keep the legacy enum label for migration compatibility, but remove it from
-- active accounts and from every authorization policy.
update public.profiles
set role = 'admin'::public.sems_role,
    updated_at = now()
where role::text = 'manager';

drop policy if exists "authenticated users read organizations" on public.organizations;
create policy "users read allowed organizations"
on public.organizations for select to authenticated
using (
  public.current_profile_role() = 'admin'
  or id = public.current_profile_organization()
);

drop policy if exists "authenticated users read sites" on public.sites;
create policy "users read allowed sites"
on public.sites for select to authenticated
using (
  public.current_profile_role() = 'admin'
  or organization_id = public.current_profile_organization()
);

drop policy if exists "authenticated users read periods" on public.collection_periods;
drop policy if exists "managers manage periods" on public.collection_periods;
create policy "users read assigned periods"
on public.collection_periods for select to authenticated
using (
  public.current_profile_role() = 'admin'
  or exists (
    select 1
    from public.period_organizations po
    where po.period_id = collection_periods.id
      and po.organization_id = public.current_profile_organization()
  )
);
create policy "admins manage periods"
on public.collection_periods for all to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "authenticated users read period organizations" on public.period_organizations;
drop policy if exists "managers manage period organizations" on public.period_organizations;
create policy "users read assigned period organizations"
on public.period_organizations for select to authenticated
using (
  public.current_profile_role() = 'admin'
  or organization_id = public.current_profile_organization()
);
create policy "admins manage period organizations"
on public.period_organizations for all to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "authenticated users read period scopes" on public.period_scopes;
drop policy if exists "managers manage period scopes" on public.period_scopes;
create policy "users read assigned period scopes"
on public.period_scopes for select to authenticated
using (
  public.current_profile_role() = 'admin'
  or exists (
    select 1
    from public.period_organizations po
    where po.period_id = period_scopes.period_id
      and po.organization_id = public.current_profile_organization()
  )
);
create policy "admins manage period scopes"
on public.period_scopes for all to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "authenticated users read factors" on public.emission_factors;
drop policy if exists "managers manage factors" on public.emission_factors;
create policy "users read active factors"
on public.emission_factors for select to authenticated
using (active = true or public.current_profile_role() = 'admin');
create policy "admins manage factors"
on public.emission_factors for all to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "users read allowed activity records" on public.activity_records;
drop policy if exists "editors create own organization records" on public.activity_records;
drop policy if exists "editors update allowed records" on public.activity_records;
drop policy if exists "managers delete activity records" on public.activity_records;
create policy "users read own organization activity records"
on public.activity_records for select to authenticated
using (
  public.current_profile_role() = 'admin'
  or organization_id = public.current_profile_organization()
);
create policy "admins or assigned editors create activity records"
on public.activity_records for insert to authenticated
with check (
  public.current_profile_role() = 'admin'
  or (
    public.current_profile_role() = 'editor'
    and organization_id = public.current_profile_organization()
    and created_by = auth.uid()
    and status in ('작성중', '검토대기')
    and exists (
      select 1
      from public.collection_periods cp
      join public.period_organizations po on po.period_id = cp.id
      where cp.id = activity_records.period_id
        and cp.status = '수집중'
        and po.organization_id = public.current_profile_organization()
    )
  )
);
create policy "admins or assigned editors update activity records"
on public.activity_records for update to authenticated
using (
  public.current_profile_role() = 'admin'
  or (
    public.current_profile_role() = 'editor'
    and organization_id = public.current_profile_organization()
    and status in ('작성중', '반려')
    and locked = false
  )
)
with check (
  public.current_profile_role() = 'admin'
  or (
    public.current_profile_role() = 'editor'
    and organization_id = public.current_profile_organization()
    and status in ('작성중', '검토대기')
    and locked = false
  )
);
create policy "admins delete activity records"
on public.activity_records for delete to authenticated
using (public.current_profile_role() = 'admin');

drop policy if exists "authenticated users read targets" on public.reduction_targets;
drop policy if exists "managers manage targets" on public.reduction_targets;
create policy "users read own organization targets"
on public.reduction_targets for select to authenticated
using (
  public.current_profile_role() = 'admin'
  or organization_id = public.current_profile_organization()
);
create policy "admins manage targets"
on public.reduction_targets for all to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "authenticated users read target scopes" on public.reduction_target_scopes;
drop policy if exists "managers manage target scopes" on public.reduction_target_scopes;
create policy "users read allowed target scopes"
on public.reduction_target_scopes for select to authenticated
using (
  public.current_profile_role() = 'admin'
  or exists (
    select 1
    from public.reduction_targets rt
    where rt.id = reduction_target_scopes.target_id
      and rt.organization_id = public.current_profile_organization()
  )
);
create policy "admins manage target scopes"
on public.reduction_target_scopes for all to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "authenticated users read plans" on public.reduction_plans;
drop policy if exists "managers manage plans" on public.reduction_plans;
create policy "users read own organization plans"
on public.reduction_plans for select to authenticated
using (
  public.current_profile_role() = 'admin'
  or organization_id = public.current_profile_organization()
);
create policy "admins manage plans"
on public.reduction_plans for all to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "authenticated users read audit" on public.audit_events;
create policy "admins read audit"
on public.audit_events for select to authenticated
using (public.current_profile_role() = 'admin');

-- workspace_states is a JSON migration bridge. Editors write through the
-- server API so field-level and workflow validation cannot be bypassed by a
-- direct PostgREST update.
drop policy if exists "managers read all workspace states" on public.workspace_states;
drop policy if exists "organization users read own workspace state" on public.workspace_states;
drop policy if exists "managers insert all workspace states" on public.workspace_states;
drop policy if exists "editors insert own workspace state" on public.workspace_states;
drop policy if exists "managers update all workspace states" on public.workspace_states;
drop policy if exists "editors update own workspace state" on public.workspace_states;
create policy "admins read all workspace states"
on public.workspace_states for select to authenticated
using (public.current_profile_role() = 'admin');
create policy "organization users read own workspace state"
on public.workspace_states for select to authenticated
using (organization_id = public.current_profile_organization());
create policy "admins insert workspace states"
on public.workspace_states for insert to authenticated
with check (public.current_profile_role() = 'admin');
create policy "admins update workspace states"
on public.workspace_states for update to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

drop policy if exists "authenticated users read evidence files" on storage.objects;
drop policy if exists "editors upload evidence files" on storage.objects;
drop policy if exists "owners and managers update evidence files" on storage.objects;
drop policy if exists "owners and managers delete evidence files" on storage.objects;
create policy "users read allowed evidence files"
on storage.objects for select to authenticated
using (
  bucket_id = 'sems2-evidence'
  and (
    public.current_profile_role() = 'admin'
    or owner_id = auth.uid()::text
    or (storage.foldername(name))[1] = public.current_profile_organization()::text
  )
);
create policy "admins and editors upload evidence files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'sems2-evidence'
  and (
    public.current_profile_role() = 'admin'
    or (
      public.current_profile_role() = 'editor'
      and (storage.foldername(name))[1] = public.current_profile_organization()::text
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);
create policy "admins update evidence files"
on storage.objects for update to authenticated
using (bucket_id = 'sems2-evidence' and public.current_profile_role() = 'admin')
with check (bucket_id = 'sems2-evidence' and public.current_profile_role() = 'admin');
create policy "admins delete evidence files"
on storage.objects for delete to authenticated
using (bucket_id = 'sems2-evidence' and public.current_profile_role() = 'admin');
