-- Canonical evidence library bucket used by the Vercel application.
-- Operational records remain empty; this migration creates storage structure only.

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
