begin;
-- A measured count of zero is a real result; blank remains unmeasured.
alter table public.metric_logs drop constraint metric_range;
alter table public.metric_logs add constraint metric_range check (case metric_id
 when 'apob' then metric_value between 1 and 300
 when 'lpa' then metric_value between 0.1 and 1000
 when 'fasting_insulin' then metric_value between 0.1 and 100
 when 'hscrp' then metric_value between 0.01 and 100
 when 'hba1c' then metric_value between 3 and 15
 when 'homocysteine' then metric_value between 1 and 100
 when 'cystatin_c' then metric_value between 0.1 and 10
 when 'ggt' then metric_value between 1 and 1000
 when 'vo2_max' then metric_value between 10 and 100
 when 'zone2_power' then metric_value between 0.1 and 8
 when 'pefr' then metric_value between 10 and 200
 when 'rhr' then metric_value between 25 and 150
 when 'hrv' then metric_value between 1 and 250
 when 'hrr_1min' then metric_value between 0 and 100
 when 'bp_systolic' then metric_value between 70 and 240
 when 'body_fat' then metric_value between 3 and 60
 when 'visceral_fat' then metric_value between 1 and 500
 when 'grip_strength' then metric_value between 1 and 120
 when 'cmj' then metric_value between 1 and 120
 when 'broad_jump' then metric_value between 0.1 and 4
 when 'squat_1rm' then metric_value between 0.1 and 4
 when 'deadlift_1rm' then metric_value between 0.1 and 5
 when 'bench_1rm' then metric_value between 0.1 and 3
 when 'pullup_1rm' then metric_value between 0 and 2
 when 'farmers_carry' then metric_value between 1 and 300
 when 'sit_to_stand' then metric_value between 0 and 60
 when 'ankle_dorsiflexion' then metric_value between 1 and 70
 when 'total_sleep' then metric_value between 120 and 900
 when 'sleep_efficiency' then metric_value between 30 and 100
 when 'circadian_regularity' then metric_value between 0 and 100
 when 'single_leg_balance' then metric_value between 0 and 180
 when 'reaction_time' then metric_value between 100 and 1000
 when 'waist_height_ratio' then metric_value between 0.2 and 1.5
 when 'fasting_glucose' then metric_value between 20 and 600
 when 'pushups' then metric_value between 0 and 150
 when 'sauna_minutes' then metric_value between 0 and 600
 when 'cold_plunge_minutes' then metric_value between 0 and 120
 when 'thermal_hrv_rebound' then metric_value between 0.01 and 10
 else false end);
alter table public.metric_logs add column exercise_mode text;
alter table public.metric_logs add constraint supported_exercise_mode check(exercise_mode is null or (metric_id='vo2_max' and exercise_mode in ('treadmill','cycle','other')));
-- No backfill: a legacy CPET record does not establish its exercise modality.
create or replace function public.read_current_measurements()
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('values',coalesce(jsonb_object_agg(metric_id,metric_value),'{}'::jsonb),'details',coalesce(jsonb_object_agg(metric_id,jsonb_strip_nulls(jsonb_build_object('method',method,'measuredAt',measured_at,'source',source,'ageAtMeasurement',age_at_measurement,'exerciseMode',exercise_mode))),'{}'::jsonb)) from
 (select distinct on(metric_id) metric_id,metric_value,is_deleted,method,measured_at,source,age_at_measurement,exercise_mode from public.metric_logs where user_id=(select auth.uid()) order by metric_id,sequence desc) latest where not is_deleted;
$$;
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
  insert into public.metric_logs(user_id,metric_id,metric_value,is_deleted,method,measured_at,source,age_at_measurement,exercise_mode) values(uid,removed.metric_id,removed.metric_value,true,removed.method,removed.measured_at,removed.source,removed.age_at_measurement,removed.exercise_mode);
 end loop;
 for item in select key,value from pg_catalog.jsonb_each_text(p_metrics) loop
  select * into previous from public.metric_logs where user_id=uid and metric_id=item.key order by sequence desc limit 1;
  if previous.id is null or previous.is_deleted or previous.metric_value is distinct from item.value::numeric or (p_details?item.key and (previous.method is distinct from (p_details->item.key->>'method') or previous.measured_at is distinct from (p_details->item.key->>'measuredAt')::timestamptz or previous.source is distinct from (p_details->item.key->>'source') or previous.age_at_measurement is distinct from (p_details->item.key->>'ageAtMeasurement')::integer or previous.exercise_mode is distinct from (p_details->item.key->>'exerciseMode'))) then
   insert into public.metric_logs(user_id,metric_id,metric_value,method,measured_at,source,age_at_measurement,exercise_mode)
   values(uid,item.key,item.value::numeric,case when p_details?item.key then p_details->item.key->>'method' else previous.method end,case when p_details?item.key then (p_details->item.key->>'measuredAt')::timestamptz else previous.measured_at end,case when p_details?item.key then p_details->item.key->>'source' else previous.source end,case when p_details?item.key then (p_details->item.key->>'ageAtMeasurement')::integer else previous.age_at_measurement end,case when p_details?item.key then p_details->item.key->>'exerciseMode' else previous.exercise_mode end);
  end if;
 end loop;
 select revision into next_revision from public.profiles where id=uid;
 return next_revision;
end $$;

create or replace function public.migrate_local_profile(p_import_id text,p_demographics jsonb,p_metrics jsonb,p_details jsonb default '{}')
returns void language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); item record;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
 if exists(select 1 from public.profile_imports where user_id=uid and import_id=p_import_id)then return;end if;
 if p_metrics is null or jsonb_typeof(p_metrics)<>'object' or p_details is null or jsonb_typeof(p_details)<>'object' then raise exception 'Invalid measurements';end if;
 insert into public.profiles(id,age,sex,weight_kg,height_cm) values(uid,(p_demographics->>'age')::integer,p_demographics->>'sex',(p_demographics->>'weight')::numeric,(p_demographics->>'height')::numeric) on conflict(id)do nothing;
 for item in select key,value from pg_catalog.jsonb_each_text(p_metrics)loop
  if not exists(select 1 from public.metric_logs where user_id=uid and metric_id=item.key)then
   insert into public.metric_logs(user_id,metric_id,metric_value,method,measured_at,source,age_at_measurement,exercise_mode)values(uid,item.key,item.value::numeric,p_details->item.key->>'method',(p_details->item.key->>'measuredAt')::timestamptz,p_details->item.key->>'source',(p_details->item.key->>'ageAtMeasurement')::integer,p_details->item.key->>'exerciseMode');
  end if;
 end loop;
 update public.profiles set revision=revision+1,updated_at=now() where id=uid;
 insert into public.profile_imports(user_id,import_id) values(uid,p_import_id);
end $$;
revoke all on function public.migrate_local_profile(text,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.migrate_local_profile(text,jsonb,jsonb,jsonb) to authenticated;

commit;
