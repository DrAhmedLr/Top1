begin;
create schema if not exists private;
-- Owners retain full access; public visibility never grants direct row access.
drop policy "Read profile" on public.profiles;
create policy "Read own profile" on public.profiles for select to authenticated
using ((select auth.uid())=id and coalesce((select auth.jwt())->>'is_anonymous','false')='false');
revoke select on public.profiles from anon;
-- Narrow public projection: no account identifier, exact age, revision or internal timestamps.
create function private.public_profile(p_username text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('username',p.username,'ageCohort',case when age>=70 then '70+' when age<25 then '18-24' else (25+5*((age-25)/5))::text||'-'||(29+5*((age-25)/5))::text end,
 'sex',sex,'weight',weight_kg,'height',height_cm,'summary',public_summary)
 from public.profiles p where p.username=p_username and p.is_public=true;
$$;
revoke all on function private.public_profile(text) from public;
grant usage on schema private to anon,authenticated;
grant execute on function private.public_profile(text) to anon,authenticated;
create function public.read_public_profile(p_username text) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.public_profile(p_username); $$;
revoke all on function public.read_public_profile(text) from public;
grant execute on function public.read_public_profile(text) to anon,authenticated;
create function public.import_guest_profile(p_expected_user uuid,p_import_id text,p_demographics jsonb,p_metrics jsonb,p_details jsonb default '{}') returns void
language plpgsql security invoker set search_path='' as $$ begin
 if (select auth.uid()) is distinct from p_expected_user then raise exception 'Account changed' using errcode='42501'; end if;
 perform public.migrate_local_profile(p_import_id,p_demographics,p_metrics,p_details);
end $$;
revoke all on function public.import_guest_profile(uuid,text,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.import_guest_profile(uuid,text,jsonb,jsonb,jsonb) to authenticated;
commit;
