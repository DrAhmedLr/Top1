begin;
-- SQLSTATE 40001 causes PostgREST retries. Return the intended HTTP conflict
-- without retrying a deliberately rejected stale snapshot.
create or replace function public.save_profile(p_demographics jsonb,p_metrics jsonb,p_username text,p_is_public boolean,p_summary jsonb,p_details jsonb default '{}',p_expected_revision bigint default null)
returns bigint language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); item record; previous public.metric_logs; current_revision bigint; removed record; next_revision bigint;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
 if p_metrics is null or jsonb_typeof(p_metrics)<>'object' or p_details is null or jsonb_typeof(p_details)<>'object' then raise exception 'Invalid measurements'; end if;
 select revision into current_revision from public.profiles where id=uid;
 current_revision:=coalesce(current_revision,0);
 if p_expected_revision is null or p_expected_revision<>current_revision then raise exception 'Profile revision conflict' using errcode='PT409'; end if;
 next_revision:=current_revision+1;
 insert into public.profiles(id,age,sex,weight_kg,height_cm,username,is_public,public_summary,revision)
 values(uid,(p_demographics->>'age')::integer,p_demographics->>'sex',(p_demographics->>'weight')::numeric,(p_demographics->>'height')::numeric,p_username,p_is_public,p_summary,next_revision)
 on conflict(id) do update set age=excluded.age,sex=excluded.sex,weight_kg=excluded.weight_kg,height_cm=excluded.height_cm,username=excluded.username,is_public=excluded.is_public,public_summary=excluded.public_summary,revision=next_revision,updated_at=now();
 for removed in select * from (select distinct on(metric_id) * from public.metric_logs where user_id=uid order by metric_id,sequence desc) latest where not is_deleted and not(p_metrics?metric_id) loop
  insert into public.metric_logs(user_id,metric_id,metric_value,is_deleted,method,measured_at,source) values(uid,removed.metric_id,removed.metric_value,true,removed.method,removed.measured_at,removed.source);
 end loop;
 for item in select key,value from pg_catalog.jsonb_each_text(p_metrics) loop
  select * into previous from public.metric_logs where user_id=uid and metric_id=item.key order by sequence desc limit 1;
  if previous.id is null or previous.is_deleted or previous.metric_value is distinct from item.value::numeric or (p_details?item.key and (previous.method is distinct from (p_details->item.key->>'method') or previous.measured_at is distinct from (p_details->item.key->>'measuredAt')::timestamptz or previous.source is distinct from (p_details->item.key->>'source') or previous.age_at_measurement is distinct from (p_details->item.key->>'ageAtMeasurement')::integer)) then
   insert into public.metric_logs(user_id,metric_id,metric_value,method,measured_at,source,age_at_measurement)
   values(uid,item.key,item.value::numeric,case when p_details?item.key then p_details->item.key->>'method' else previous.method end,case when p_details?item.key then (p_details->item.key->>'measuredAt')::timestamptz else previous.measured_at end,case when p_details?item.key then p_details->item.key->>'source' else previous.source end,case when p_details?item.key then (p_details->item.key->>'ageAtMeasurement')::integer else previous.age_at_measurement end);
  end if;
 end loop;
 select revision into next_revision from public.profiles where id=uid;
 return next_revision;
end $$;
commit;
