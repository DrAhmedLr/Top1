-- Engagement history only. Does not modify measurements or benchmark scores.
create table public.game_days (
 user_id uuid not null references auth.users(id) on delete cascade,
 day date not null check(day >= date '2026-01-01'),
 check_in boolean not null default false,
 test_done boolean not null default false,
 primary key(user_id,day)
);
alter table public.game_days enable row level security;
revoke all on public.game_days from public,anon,authenticated;
grant select,insert,update on public.game_days to authenticated;
create policy game_days_owner on public.game_days for all to authenticated
using(user_id=(select auth.uid()) and (select private.has_active_session()))
with check(user_id=(select auth.uid()) and (select private.has_active_session()) and day<=current_date+1);
create function public.sync_game_progress(p_days jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare item record; v_day date; result jsonb;
begin
 if auth.uid() is null or not private.has_active_session() then raise exception 'Sign in required' using errcode='42501'; end if;
 if jsonb_typeof(p_days)<>'object' or octet_length(p_days::text)>262144 then raise exception 'Invalid progress'; end if;
 for item in select key,value from jsonb_each(p_days) loop
  if item.key !~ '^\d{4}-\d{2}-\d{2}$' or jsonb_typeof(item.value)<>'object' then raise exception 'Invalid day'; end if;
  v_day:=item.key::date;
  if v_day<date '2026-01-01' or v_day>current_date+1 then raise exception 'Invalid day'; end if;
  insert into public.game_days(user_id,day,check_in,test_done)
  values(auth.uid(),v_day,coalesce(item.value->'check'='true'::jsonb,false),coalesce(item.value->'test'='true'::jsonb,false))
  on conflict(user_id,day) do update set check_in=game_days.check_in or excluded.check_in,test_done=game_days.test_done or excluded.test_done;
 end loop;
 select coalesce(jsonb_object_agg(day::text,jsonb_build_object('check',check_in,'test',test_done)),'{}'::jsonb) into result from public.game_days where user_id=auth.uid();
 return jsonb_build_object('version',1,'days',result);
end $$;
revoke all on function public.sync_game_progress(jsonb) from public,anon;
grant execute on function public.sync_game_progress(jsonb) to authenticated;
