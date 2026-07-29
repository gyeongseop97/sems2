-- Remove only the legacy SEMS demo workspace.
-- The marker check prevents this migration from clearing a real workspace.

update public.workspace_states
set
  payload = jsonb_build_object(
    'periods', '[]'::jsonb,
    'records', '[]'::jsonb,
    'factors', '[]'::jsonb,
    'evidence', '[]'::jsonb,
    'indicators', '[]'::jsonb,
    'targets', '[]'::jsonb,
    'plans', '[]'::jsonb,
    'audit', '[]'::jsonb,
    'criteria', jsonb_build_object(
      'variance', 10,
      'evidenceRequired', true,
      'lockConfirmed', true,
      'defaultYear', extract(year from current_date)::text
    ),
    'noticePrefs', jsonb_build_object(
      'deadline', true,
      'review', true,
      'rejected', true,
      'weekly', false
    ),
    'organizations', '{}'::jsonb
  ),
  updated_by = null,
  updated_at = now()
where
  payload::text like '%CP-2026-07%'
  or payload::text like '%TG-001%'
  or payload::text like '%2026_06_electricity.pdf%'
  or payload::text like '%세원그룹 Scope 1·2 중기 감축목표%';
