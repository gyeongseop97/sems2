# SEMS2 Supabase + Vercel setup

## 1. Apply the database schema

Open **Supabase > SQL Editor** and run these files in order.

1. `supabase/schema.sql`
2. `supabase/migrations/20260724_workspace_state.sql`
3. `supabase/migrations/20260729_evidence_library.sql`
4. `supabase/migrations/20260729_remove_demo_workspace.sql`

The schema intentionally inserts no sample operational data. The last migration
clears a workspace only when one of the known legacy demo markers is present, so
it does not erase a real workspace.

## 2. Create the first administrator

1. Open **Supabase > Authentication > Users**.
2. Create the first administrator with an email and password.
3. Run the following SQL after replacing the email.

```sql
update public.profiles
set
  display_name = '문경섭',
  department = '기획팀',
  role = 'admin',
  active = true
where email = 'ADMIN_EMAIL@se-won.co.kr';
```

The administrator can then open `/admin/users` in SEMS and create all other accounts.

## 3. Register organizations and sites

No company or site is seeded automatically. Add the actual organization and site names before assigning editor/viewer accounts.

Example SQL structure:

```sql
insert into public.organizations (name, code)
values ('법인명', 'COMPANY_CODE');

insert into public.sites (organization_id, name, code)
select id, '사업장명', 'SITE_CODE'
from public.organizations
where code = 'COMPANY_CODE';
```

## 4. Add Vercel environment variables

Open **Vercel > sems2 > Settings > Environment Variables** and add:

| Name | Value | Exposure |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | Browser-safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Publishable/Anon key | Browser-safe |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Server only |

Apply the variables to Production, Preview, and Development as required, then redeploy.

Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser code or commit it to GitHub.

## 5. Current persistence model

The existing SEMS interface is connected to Supabase through `workspace_states` as a migration bridge.

- Admin/manager: shared global workspace
- Editor: assigned organization workspace
- Viewer: read-only assigned organization workspace

The browser keeps a temporary cache for rendering speed, but `/api/workspace`
loads and saves the authoritative state in Supabase. Every request is checked
against the authenticated profile:

- Admin: global configuration, organizations, sites, users, and all operating data
- Manager: global configuration and all operating data
- Editor: records, evidence, targets, and plans for the assigned organization
- Viewer: read-only data for the assigned organization

The service-role key is used only inside the server route after the access token
and profile role have been verified. The browser never receives it.

Evidence files are stored in the private `sems2-evidence` bucket. The application
uses short-lived signed URLs for downloads and keeps document metadata, indicator
links, framework mappings, version, validity, and review state in the workspace.

## 6. Health check

After deployment, open:

```text
/api/health
```

Expected status after environment variables are configured:

```json
{
  "status": "ok",
  "app": "ok",
  "supabase": "connected"
}
```
