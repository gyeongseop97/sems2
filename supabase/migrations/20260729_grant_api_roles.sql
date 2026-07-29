-- Grant PostgREST API roles access to the canonical SEMS2 tables.
-- RLS policies continue to control which rows authenticated users can read
-- and modify. The service role is used only by server-side API routes.

begin;

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
