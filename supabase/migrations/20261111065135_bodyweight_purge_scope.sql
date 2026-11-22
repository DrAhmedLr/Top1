-- Removing a weight series must not remove unrelated fitness assessments.
create or replace function private.purge_history_with_bodyweight(p_metric text,p_expected_revision bigint) returns bigint language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); r bigint;
begin
 perform private.require_recent_session();
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
 if p_metric='bodyweight' then
  select revision into r from public.profiles where id=uid;
  r:=coalesce(r,0);
  if r is distinct from p_expected_revision then raise exception 'Profile revision conflict' using errcode='PT409';end if;
 else
  r:=public.purge_own_history(p_metric,p_expected_revision);
 end if;
 if p_metric is null or p_metric='bodyweight' then
  delete from public.bodyweight_events where user_id=uid;
  insert into public.bodyweight_state(user_id,epoch) values(uid,1)
  on conflict(user_id) do update set epoch=bodyweight_state.epoch+1;
 end if;
 return r;
end $$;
revoke all on function private.purge_history_with_bodyweight(text,bigint) from public,anon;
grant execute on function private.purge_history_with_bodyweight(text,bigint) to authenticated;
