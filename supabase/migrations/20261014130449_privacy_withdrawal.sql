begin;
-- Irreversible history removal uses the recent-session-gated definer RPC.
-- Owner INSERT/UPDATE tracking remains supported; direct DELETE cannot bypass
-- the product's reauthentication requirement.
revoke delete on public.metric_logs,public.profile_imports from authenticated;
-- Independent withdrawal serialized with all profile saves. It never accepts
-- an account ID, client revision, measurements, or a signed public snapshot.
create function public.withdraw_public_profile() returns bigint
language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); result bigint; original_revision bigint;
begin
 if uid is null or not private.has_active_session() then raise exception 'Sign in' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
 select revision into original_revision from public.profiles where id=uid;
 update public.profiles set is_public=false,public_summary=case when public_summary?'publicFields' then jsonb_build_object('publicFields',public_summary->'publicFields') else '{"publicFields":{"referenceSex":true,"bodySize":true}}'::jsonb end where id=uid and is_public=true returning revision into result;
 return coalesce(result,original_revision,0);
end $$;
revoke all on function public.withdraw_public_profile() from public,anon;
grant execute on function public.withdraw_public_profile() to authenticated;

-- Retain session/ownership enforcement and expose the anonymous restriction
-- directly in each policy for database advisory tools and future reviewers.
alter policy "Read own profile" on public.profiles using((select auth.uid())=id and (select private.has_active_session()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false');
alter policy "Insert own profile" on public.profiles with check((select auth.uid())=id and (select private.has_active_session()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false');
alter policy "Update own profile" on public.profiles using((select auth.uid())=id and (select private.has_active_session()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false') with check((select auth.uid())=id and (select private.has_active_session()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false');
alter policy "Manage own metric logs" on public.metric_logs using((select auth.uid())=user_id and (select private.has_active_session()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false') with check((select auth.uid())=user_id and (select private.has_active_session()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false');
alter policy "Manage own imports" on public.profile_imports using((select auth.uid())=user_id and (select private.has_active_session()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false') with check((select auth.uid())=user_id and (select private.has_active_session()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false');
alter policy "Own program" on public.programs using((select auth.uid())=user_id and (select private.has_active_session()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false') with check((select auth.uid())=user_id and (select private.has_active_session()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false');
alter policy "Own assessment history" on public.profile_revisions using((select auth.uid())=user_id and (select private.has_active_session()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false');
alter policy "Own routine schedules" on public.program_schedule_history using((select auth.uid())=user_id and (select private.has_active_session()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false');
alter policy "Own routine completions" on public.program_completion_history using((select auth.uid())=user_id and (select private.has_active_session()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false');

-- Historical snapshots keep their original disclosure/signature. New snapshots
-- choose only the fields reviewed by the owner, with minimal default disclosure.
create or replace function private.public_profile(p_username text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('username',p.username,'ageCohort',case when age>=70 then '70+' when age<25 then '18-24' else (25+5*((age-25)/5))::text||'-'||(29+5*((age-25)/5))::text end,
 'sex',case when public_summary->'publicFields' is null or public_summary->'publicFields'->>'referenceSex'='true' then sex else 'unselected' end,
 'weight',case when public_summary->'publicFields' is null or public_summary->'publicFields'->>'bodySize'='true' then weight_kg else null end,
 'height',case when public_summary->'publicFields' is null or public_summary->'publicFields'->>'bodySize'='true' then height_cm else null end,
 'summary',public_summary)
 from public.profiles p where p.username=p_username and p.is_public=true;
$$;
commit;
