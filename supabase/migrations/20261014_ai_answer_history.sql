-- Run once in Supabase SQL Editor before deploying the AI history update.
begin;
create table if not exists public.ai_answer_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  access_key text not null,
  question text not null check (length(question) between 1 and 2000),
  result jsonb not null check (jsonb_typeof(result) = 'object' and result->>'mode' = 'answer')
);
create index if not exists ai_answer_history_user_date on public.ai_answer_history(user_id, created_at desc, id desc);
alter table public.ai_answer_history enable row level security;
drop policy if exists ai_history_select_own on public.ai_answer_history;
create policy ai_history_select_own on public.ai_answer_history for select to authenticated
using (user_id = auth.uid() and exists(select 1 from public.profiles where id = auth.uid() and active));
drop policy if exists ai_history_delete_own on public.ai_answer_history;
create policy ai_history_delete_own on public.ai_answer_history for delete to authenticated
using (user_id = auth.uid() and exists(select 1 from public.profiles where id = auth.uid() and active));
revoke all on public.ai_answer_history from anon, authenticated;
grant select, delete on public.ai_answer_history to authenticated;
-- Serialize saves for each user so concurrent requests still retain exactly 100.
create or replace function public.save_ai_answer_history(p_question text, p_result jsonb, p_access_key text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null or not exists(select 1 from public.profiles where id = v_user and active) then
    raise exception 'Active account required';
  end if;
  if length(p_access_key) > 20000 or octet_length(p_result::text) > 250000 then
    raise exception 'History payload too large';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  insert into public.ai_answer_history(user_id, question, result, access_key)
  values(v_user, p_question, p_result, p_access_key) returning id into v_id;
  delete from public.ai_answer_history where user_id = v_user and id in (
    select id from public.ai_answer_history where user_id = v_user
    order by created_at desc, id desc offset 100
  );
  return v_id;
end;
$$;
revoke all on function public.save_ai_answer_history(text,jsonb,text) from public, anon;
grant execute on function public.save_ai_answer_history(text,jsonb,text) to authenticated;
commit;
