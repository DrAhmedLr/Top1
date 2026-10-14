begin;
alter table public.profiles drop constraint profiles_sex_check;
alter table public.profiles add constraint profiles_sex_check check(sex in('male','female','unselected'));
alter table public.profiles add column age_recorded_at timestamptz;
alter table public.metric_logs add column protocol_context jsonb;
alter table public.metric_logs add column observation_window jsonb;
alter table public.metric_logs add column calculation_inputs jsonb;
alter table public.metric_logs add column reference_context jsonb;
alter table public.metric_logs add constraint structured_context_shape check((protocol_context is null or jsonb_typeof(protocol_context)='object') and (observation_window is null or jsonb_typeof(observation_window)='object') and (calculation_inputs is null or jsonb_typeof(calculation_inputs)='object') and octet_length(coalesce(protocol_context,'{}')::text||coalesce(observation_window,'{}')::text||coalesce(calculation_inputs,'{}')::text)<=4096);

create function private.has_active_session() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select auth.jwt())->>'is_anonymous','false')='false' and exists(select 1 from auth.sessions where id=((select auth.jwt())->>'session_id')::uuid and user_id=(select auth.uid()));
$$;
revoke all on function private.has_active_session() from public,anon;
grant execute on function private.has_active_session() to authenticated;
create function private.require_recent_session() returns void language plpgsql stable security definer set search_path='' as $$begin
 if not private.has_active_session() or not exists(select 1 from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=auth.uid() and created_at>=now()-interval '10 minutes') then raise exception 'Sign in again before this sensitive action' using errcode='42501';end if;
end $$;
revoke all on function private.require_recent_session() from public,anon;
grant execute on function private.require_recent_session() to authenticated;

alter policy "Read own profile" on public.profiles using((select auth.uid())=id and (select private.has_active_session()));
alter policy "Insert own profile" on public.profiles with check((select auth.uid())=id and (select private.has_active_session()));
alter policy "Update own profile" on public.profiles using((select auth.uid())=id and (select private.has_active_session())) with check((select auth.uid())=id and (select private.has_active_session()));
alter policy "Manage own metric logs" on public.metric_logs using((select auth.uid())=user_id and (select private.has_active_session())) with check((select auth.uid())=user_id and (select private.has_active_session()));
alter policy "Manage own imports" on public.profile_imports using((select auth.uid())=user_id and (select private.has_active_session())) with check((select auth.uid())=user_id and (select private.has_active_session()));
alter policy "Own program" on public.programs using((select auth.uid())=user_id and (select private.has_active_session())) with check((select auth.uid())=user_id and (select private.has_active_session()));

create table public.profile_revisions(user_id uuid not null references public.profiles(id) on delete cascade,revision bigint not null,demographics jsonb not null,summary jsonb not null,recorded_at timestamptz not null default now(),primary key(user_id,revision));
alter table public.profile_revisions enable row level security;
revoke all on public.profile_revisions from public,anon,authenticated;
grant select on public.profile_revisions to authenticated;
create policy "Own assessment history" on public.profile_revisions for select to authenticated using(user_id=(select auth.uid()) and (select private.has_active_session()));
create function private.stamp_profile_context() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if TG_OP='INSERT' then NEW.age_recorded_at=now();else
  if NEW.age is distinct from OLD.age then NEW.age_recorded_at=now();else NEW.age_recorded_at=OLD.age_recorded_at;end if;
  NEW.revision=greatest(OLD.revision+1,NEW.revision);
 end if;return NEW;
end $$;
revoke all on function private.stamp_profile_context() from public,anon,authenticated;
create trigger stamp_profile_context before insert or update on public.profiles for each row execute function private.stamp_profile_context();
create function private.capture_profile_revision() returns trigger language plpgsql security definer set search_path='' as $$begin
 if TG_OP='UPDATE' and NEW.public_summary is not distinct from OLD.public_summary and NEW.age is not distinct from OLD.age and NEW.sex is not distinct from OLD.sex and NEW.weight_kg is not distinct from OLD.weight_kg and NEW.height_cm is not distinct from OLD.height_cm then return NEW;end if;
 insert into public.profile_revisions(user_id,revision,demographics,summary)values(NEW.id,NEW.revision,jsonb_build_object('age',NEW.age,'sex',NEW.sex,'weight',NEW.weight_kg,'height',NEW.height_cm),NEW.public_summary);return NEW;
end $$;
revoke all on function private.capture_profile_revision() from public,anon,authenticated;
create trigger capture_profile_revision after insert or update on public.profiles for each row execute function private.capture_profile_revision();
create function private.stamp_metric_context() returns trigger language plpgsql security invoker set search_path='' as $$begin
 select jsonb_build_object('profileAgeAtEntry',age,'referenceSexAtEntry',sex,'profileRevision',revision) into NEW.reference_context from public.profiles where id=NEW.user_id;return NEW;
end $$;
revoke all on function private.stamp_metric_context() from public,anon,authenticated;
create trigger stamp_metric_context before insert on public.metric_logs for each row execute function private.stamp_metric_context();
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
 when 'grip_combined' then metric_value between 0 and 240
 when 'sprint_10m' then metric_value between 1 and 30
 else false end);
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
  insert into public.metric_logs(user_id,metric_id,metric_value,is_deleted,method,measured_at,source,age_at_measurement,exercise_mode,protocol_context,observation_window,calculation_inputs) values(uid,removed.metric_id,removed.metric_value,true,removed.method,removed.measured_at,removed.source,removed.age_at_measurement,removed.exercise_mode,removed.protocol_context,removed.observation_window,removed.calculation_inputs);
 end loop;
 for item in select key,value from pg_catalog.jsonb_each_text(p_metrics) loop
  select * into previous from public.metric_logs where user_id=uid and metric_id=item.key order by sequence desc limit 1;
  if previous.id is null or previous.is_deleted or previous.metric_value is distinct from item.value::numeric or (p_details?item.key and (previous.method is distinct from (p_details->item.key->>'method') or previous.measured_at is distinct from (p_details->item.key->>'measuredAt')::timestamptz or previous.source is distinct from (p_details->item.key->>'source') or previous.age_at_measurement is distinct from (p_details->item.key->>'ageAtMeasurement')::integer or previous.exercise_mode is distinct from (p_details->item.key->>'exerciseMode') or previous.protocol_context is distinct from (p_details->item.key->'protocol') or previous.observation_window is distinct from (p_details->item.key->'window') or previous.calculation_inputs is distinct from (p_details->item.key->'derivation'))) then
   insert into public.metric_logs(user_id,metric_id,metric_value,method,measured_at,source,age_at_measurement,exercise_mode,protocol_context,observation_window,calculation_inputs)
   values(uid,item.key,item.value::numeric,case when p_details?item.key then p_details->item.key->>'method' else previous.method end,case when p_details?item.key then (p_details->item.key->>'measuredAt')::timestamptz else previous.measured_at end,case when p_details?item.key then p_details->item.key->>'source' else previous.source end,case when p_details?item.key then (p_details->item.key->>'ageAtMeasurement')::integer else previous.age_at_measurement end,case when p_details?item.key then p_details->item.key->>'exerciseMode' else previous.exercise_mode end,p_details->item.key->'protocol',p_details->item.key->'window',p_details->item.key->'derivation');
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
   insert into public.metric_logs(user_id,metric_id,metric_value,method,measured_at,source,age_at_measurement,exercise_mode,protocol_context,observation_window,calculation_inputs)values(uid,item.key,item.value::numeric,p_details->item.key->>'method',(p_details->item.key->>'measuredAt')::timestamptz,p_details->item.key->>'source',(p_details->item.key->>'ageAtMeasurement')::integer,p_details->item.key->>'exerciseMode',p_details->item.key->'protocol',p_details->item.key->'window',p_details->item.key->'derivation');
  end if;
 end loop;
 update public.profiles set revision=revision+1,updated_at=now(),is_public=false,public_summary='{}' where id=uid;
 insert into public.profile_imports(user_id,import_id) values(uid,p_import_id);
end $$;

create or replace function public.read_current_measurements() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('values',coalesce(jsonb_object_agg(metric_id,metric_value),'{}'), 'details',coalesce(jsonb_object_agg(metric_id,jsonb_strip_nulls(jsonb_build_object('method',method,'measuredAt',measured_at,'source',source,'ageAtMeasurement',age_at_measurement,'exerciseMode',exercise_mode,'protocol',protocol_context,'window',observation_window,'derivation',calculation_inputs))),'{}')) from
 (select distinct on(metric_id) * from public.metric_logs where user_id=(select auth.uid()) order by metric_id,sequence desc) latest where not is_deleted;
$$;
-- Corrupt owner-managed legacy JSON must not make the whole history unreadable.
create function private.context_timestamp(value text) returns timestamptz language plpgsql stable security invoker set search_path='' as $$declare parsed timestamptz;begin
 parsed:=value::timestamptz;if not isfinite(parsed) then return null;end if;return parsed;
 exception when invalid_datetime_format or datetime_field_overflow then return null;
end $$;
revoke all on function private.context_timestamp(text) from public,anon;
grant execute on function private.context_timestamp(text) to authenticated;
create function public.read_history_comparison(p_metric text) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare recent public.metric_logs;latest public.metric_logs;prior public.metric_logs;
begin
 select * into recent from public.metric_logs where user_id=auth.uid() and metric_id=p_metric order by sequence desc limit 1;
 if recent.id is null or recent.is_deleted then return '[]';end if;
 select * into latest from public.metric_logs where user_id=auth.uid() and metric_id=p_metric and not is_deleted order by coalesce(measured_at,recorded_at) desc,sequence desc limit 1;
 if latest.measured_at is null or latest.method is null or latest.measured_at>now()+interval '5 minutes' then return '[]';end if;
 select * into prior from public.metric_logs where user_id=auth.uid() and metric_id=p_metric and not is_deleted and method=latest.method and measured_at<latest.measured_at and exercise_mode is not distinct from latest.exercise_mode and protocol_context is not distinct from latest.protocol_context and (observation_window is null and latest.observation_window is null or observation_window->>'statistic'=latest.observation_window->>'statistic' and observation_window->>'sampleCount'=latest.observation_window->>'sampleCount' and private.context_timestamp(observation_window->>'end')-private.context_timestamp(observation_window->>'start')=private.context_timestamp(latest.observation_window->>'end')-private.context_timestamp(latest.observation_window->>'start') and private.context_timestamp(observation_window->>'end')<=private.context_timestamp(latest.observation_window->>'start')) order by measured_at desc,sequence desc limit 1;
 if prior.id is null then return '[]';end if;
 return (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',r.id,'sequence',r.sequence,'metricId',r.metric_id,'value',r.metric_value,'cleared',false,'recordedAt',r.recorded_at,'measuredAt',r.measured_at,'method',r.method,'exerciseMode',r.exercise_mode,'protocol',r.protocol_context,'window',r.observation_window,'derivation',r.calculation_inputs,'referenceContext',r.reference_context))) from (select latest.* union all select prior.*)r);
end $$;
revoke all on function public.read_history_comparison(text) from public,anon;
grant execute on function public.read_history_comparison(text) to authenticated;

alter table public.programs add column time_zone text;
create table public.program_schedule_history(sequence bigint generated always as identity primary key,user_id uuid not null references public.programs(user_id) on delete cascade,effective_date date not null,time_zone text not null,tasks jsonb not null check(jsonb_typeof(tasks)='array'),recorded_at timestamptz not null default now(),unique(user_id,effective_date));
create table public.program_completion_history(id uuid primary key default extensions.uuid_generate_v4(),sequence bigint generated always as identity,user_id uuid not null references public.programs(user_id) on delete cascade,task_id text not null,task_label text not null,completion_date date not null,completed boolean not null,legacy boolean not null default false,recorded_at timestamptz not null default now());
create index program_completion_history_owner_date on public.program_completion_history(user_id,completion_date,sequence);
alter table public.program_schedule_history enable row level security;
alter table public.program_completion_history enable row level security;
revoke all on public.program_schedule_history,public.program_completion_history from public,anon,authenticated;
grant select on public.program_schedule_history,public.program_completion_history to authenticated;
create policy "Own routine schedules" on public.program_schedule_history for select to authenticated using(user_id=(select auth.uid()) and (select private.has_active_session()));
create policy "Own routine completions" on public.program_completion_history for select to authenticated using(user_id=(select auth.uid()) and (select private.has_active_session()));
create function public.read_program_recorded() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('plan',(select plan from public.programs where user_id=auth.uid()),'revision',coalesce((select revision from public.programs where user_id=auth.uid()),0),'timeZone',(select time_zone from public.programs where user_id=auth.uid()),'timeline',jsonb_build_object('schedules',coalesce((select jsonb_agg(jsonb_build_object('effectiveFrom',effective_date,'timeZone',time_zone,'tasks',tasks) order by effective_date)from public.program_schedule_history where user_id=auth.uid()),'[]'),'completions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'date',completion_date,'taskId',task_id,'label',task_label,'completed',completed,'recordedAt',recorded_at,'legacy',legacy)order by sequence)from public.program_completion_history where user_id=auth.uid()),'[]')));
$$;
revoke all on function public.read_program_recorded() from public,anon;
grant execute on function public.read_program_recorded() to authenticated;
create function private.save_program_recorded(p_plan jsonb,p_expected_revision bigint,p_day date,p_timezone text,p_completion jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();old public.programs;task jsonb;tasks jsonb;old_tasks jsonb;effective date;next_revision bigint;d text;target jsonb;weekday integer;last_completed boolean;
begin
 if uid is null or not private.has_active_session() then raise exception 'Sign in' using errcode='42501';end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Invalid time zone';end if;
 if p_day is distinct from (now() at time zone p_timezone)::date then raise exception 'Check-ins use the current local date';end if;
 if not private.valid_program(p_plan) or octet_length(p_plan::text)>65536 then raise exception 'Invalid plan';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('program:'||uid::text,0));
 select * into old from public.programs where user_id=uid;
 if coalesce(old.revision,0) is distinct from p_expected_revision then raise exception 'Program revision conflict' using errcode='PT409';end if;
 if old.time_zone is not null and old.time_zone<>p_timezone then raise exception 'Use the saved routine time zone';end if;
 next_revision:=coalesce(old.revision,0)+1;
 insert into public.programs(user_id,plan,revision,time_zone)values(uid,p_plan,next_revision,p_timezone)on conflict(user_id)do update set plan=excluded.plan,revision=excluded.revision,time_zone=excluded.time_zone,updated_at=now();
 select coalesce(jsonb_agg(t-'completed'),'[]')into tasks from jsonb_array_elements(p_plan->'tasks')t;
 if not exists(select 1 from public.program_schedule_history where user_id=uid) then
  select coalesce(jsonb_agg(t-'completed'),'[]')into old_tasks from jsonb_array_elements(coalesce(old.plan->'tasks',p_plan->'tasks'))t;
  if old_tasks='[]' then old_tasks:=tasks;end if;
  insert into public.program_schedule_history(user_id,effective_date,time_zone,tasks)values(uid,p_day,p_timezone,old_tasks);
  for task in select value from jsonb_array_elements(coalesce(old.plan->'tasks','[]')) loop
   for d in select value from jsonb_array_elements_text(task->'completed') loop
    insert into public.program_completion_history(user_id,task_id,task_label,completion_date,completed,legacy)values(uid,task->>'id',task->>'label',d::date,true,true);
   end loop;
  end loop;
 end if;
 select h.tasks into old_tasks from public.program_schedule_history h where user_id=uid order by effective_date desc limit 1;
 if old_tasks is distinct from tasks then
  effective:=p_day+1;
  insert into public.program_schedule_history(user_id,effective_date,time_zone,tasks)values(uid,effective,p_timezone,tasks)on conflict(user_id,effective_date)do update set tasks=excluded.tasks,recorded_at=now();
 end if;
 if p_completion is not null then
  if jsonb_typeof(p_completion)<>'object' or jsonb_typeof(p_completion->'completed')<>'boolean' or jsonb_typeof(p_completion->'taskId')<>'string' then raise exception 'Invalid check-in';end if;
  weekday:=extract(isodow from p_day);
  select t into target from public.program_schedule_history h cross join lateral jsonb_array_elements(h.tasks)t where h.user_id=uid and h.effective_date=(select max(effective_date)from public.program_schedule_history where user_id=uid and effective_date<=p_day)and t->>'id'=p_completion->>'taskId' and t->'days'@>jsonb_build_array(weekday);
  if target is null then raise exception 'Action not scheduled today';end if;
  select completed into last_completed from public.program_completion_history where user_id=uid and task_id=p_completion->>'taskId' and completion_date=p_day order by sequence desc limit 1;
  if coalesce(last_completed,false) is distinct from (p_completion->>'completed')::boolean then insert into public.program_completion_history(user_id,task_id,task_label,completion_date,completed)values(uid,target->>'id',target->>'label',p_day,(p_completion->>'completed')::boolean);end if;
 end if;
 return public.read_program_recorded();
end $$;
revoke all on function private.save_program_recorded(jsonb,bigint,date,text,jsonb) from public,anon;
grant execute on function private.save_program_recorded(jsonb,bigint,date,text,jsonb) to authenticated;
create function public.save_program_recorded(p_plan jsonb,p_expected_revision bigint,p_day date,p_timezone text,p_completion jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.save_program_recorded(p_plan,p_expected_revision,p_day,p_timezone,p_completion);$$;
revoke all on function public.save_program_recorded(jsonb,bigint,date,text,jsonb) from public,anon;
grant execute on function public.save_program_recorded(jsonb,bigint,date,text,jsonb) to authenticated;

create function public.export_own_data() returns jsonb language plpgsql stable security invoker set search_path='' as $$begin
 if auth.uid() is null or not private.has_active_session() then raise exception 'Sign in' using errcode='42501';end if;
 return jsonb_build_object('schemaVersion',2,'exportedAt',now(),'profile',(select to_jsonb(p)from public.profiles p where id=auth.uid()),'observations',coalesce((select jsonb_agg(to_jsonb(m)order by sequence)from public.metric_logs m where user_id=auth.uid()),'[]'),'assessmentHistory',coalesce((select jsonb_agg(to_jsonb(r)order by revision)from public.profile_revisions r where user_id=auth.uid()),'[]'),'importReceipts',coalesce((select jsonb_agg(to_jsonb(i)order by created_at,import_id)from public.profile_imports i where user_id=auth.uid()),'[]'),'program',public.read_program_recorded());
end $$;
revoke all on function public.export_own_data() from public,anon;
grant execute on function public.export_own_data() to authenticated;
create function private.purge_own_history(p_metric text,p_expected_revision bigint)returns bigint language plpgsql security definer set search_path='' as $$declare uid uuid:=auth.uid();r bigint;begin
 perform private.require_recent_session();
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
 select revision into r from public.profiles where id=uid;
 if r is null or r is distinct from p_expected_revision then raise exception 'Profile revision conflict'using errcode='PT409';end if;
 delete from public.metric_logs where user_id=uid and(p_metric is null or metric_id=p_metric);
 -- Remove assessment aggregates derived from the purged observations too.
 delete from public.profile_revisions where user_id=uid;
 update public.profiles set is_public=false,public_summary='{}',revision=r+1,updated_at=now()where id=uid;
 select revision into r from public.profiles where id=uid;return r;
end $$;
revoke all on function private.purge_own_history(text,bigint)from public,anon;
grant execute on function private.purge_own_history(text,bigint)to authenticated;
create function public.purge_own_history(p_metric text,p_expected_revision bigint)returns bigint language sql security invoker set search_path='' as $$select private.purge_own_history(p_metric,p_expected_revision);$$;
revoke all on function public.purge_own_history(text,bigint)from public,anon;
grant execute on function public.purge_own_history(text,bigint)to authenticated;

create function public.active_account_session() returns boolean language sql stable security invoker set search_path='' as $$select private.has_active_session();$$;
revoke all on function public.active_account_session() from public,anon;
grant execute on function public.active_account_session() to authenticated;
create function public.recent_account_session() returns boolean language plpgsql stable security invoker set search_path='' as $$begin perform private.require_recent_session();return true;end$$;
revoke all on function public.recent_account_session() from public,anon;
grant execute on function public.recent_account_session() to authenticated;
commit;
