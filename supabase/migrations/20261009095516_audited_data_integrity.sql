begin;
alter table public.profiles add column revision bigint not null default 1 check(revision>=0);
alter table public.metric_logs add column sequence bigint generated always as identity;
create index idx_metric_logs_latest_sequence on public.metric_logs(user_id,metric_id,sequence desc);
grant usage,select on sequence public.metric_logs_sequence_seq to authenticated;
alter table public.metric_logs add column is_deleted boolean not null default false;
alter table public.metric_logs add column measured_at timestamptz;
alter table public.metric_logs add column method text;
alter table public.metric_logs add column source text;
alter table public.metric_logs add column age_at_measurement integer check(age_at_measurement between 18 and 120);
alter table public.metric_logs add constraint supported_method check(method is null or method in('manual','lab','direct_cpet','cooper_estimate','wearable_estimate','dynamometer_single_hand','dexa','skinfold_estimate','direct_1rm','epley_estimate','device'));
-- Every writer, including direct owner REST writes, advances the revision.
create function public.advance_profile_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(old.id::text,0));
 new.revision:=old.revision+1;new.updated_at:=now();return new;
end $$;
create trigger advance_profile_revision before update on public.profiles for each row execute function public.advance_profile_revision();
create function public.advance_measurement_revision() returns trigger language plpgsql security invoker set search_path='' as $$
declare uid uuid;
begin
 uid:=case when tg_op='DELETE' then old.user_id else new.user_id end;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
 update public.profiles set updated_at=now() where id=uid;
 return coalesce(new,old);
end $$;
create trigger advance_measurement_revision after insert or update or delete on public.metric_logs for each row execute function public.advance_measurement_revision();
revoke all on function public.advance_profile_revision(),public.advance_measurement_revision() from public,anon,authenticated;
-- recorded_at remains entry time. Legacy measured_at/method remain unknown.
create or replace function public.read_current_metrics()
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_object_agg(metric_id,metric_value),'{}'::jsonb) from
 (select distinct on(metric_id) metric_id,metric_value,is_deleted from public.metric_logs where user_id=(select auth.uid()) order by metric_id,sequence desc) latest where not is_deleted;
$$;
create function public.read_current_measurements()
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('values',coalesce(jsonb_object_agg(metric_id,metric_value),'{}'::jsonb),'details',coalesce(jsonb_object_agg(metric_id,jsonb_strip_nulls(jsonb_build_object('method',method,'measuredAt',measured_at,'source',source,'ageAtMeasurement',age_at_measurement))),'{}'::jsonb)) from
 (select distinct on(metric_id) metric_id,metric_value,is_deleted,method,measured_at,source,age_at_measurement from public.metric_logs where user_id=(select auth.uid()) order by metric_id,sequence desc) latest where not is_deleted;
$$;
revoke all on function public.read_current_measurements() from public,anon;
grant execute on function public.read_current_measurements() to authenticated;

drop function public.save_profile(jsonb,jsonb,text,boolean,jsonb);
create function public.save_profile(p_demographics jsonb,p_metrics jsonb,p_username text,p_is_public boolean,p_summary jsonb,p_details jsonb default '{}',p_expected_revision bigint default null)
returns bigint language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); item record; previous public.metric_logs; current_revision bigint; removed record; next_revision bigint;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
 if p_metrics is null or jsonb_typeof(p_metrics)<>'object' or p_details is null or jsonb_typeof(p_details)<>'object' then raise exception 'Invalid measurements'; end if;
 select revision into current_revision from public.profiles where id=uid;
 current_revision:=coalesce(current_revision,0);
 if p_expected_revision is null or p_expected_revision<>current_revision then raise exception 'Profile revision conflict' using errcode='40001'; end if;
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
revoke all on function public.save_profile(jsonb,jsonb,text,boolean,jsonb,jsonb,bigint) from public,anon;
grant execute on function public.save_profile(jsonb,jsonb,text,boolean,jsonb,jsonb,bigint) to authenticated;

drop function public.migrate_local_profile(text,jsonb,jsonb);
create function public.migrate_local_profile(p_import_id text,p_demographics jsonb,p_metrics jsonb,p_details jsonb default '{}')
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
   insert into public.metric_logs(user_id,metric_id,metric_value,method,measured_at,source,age_at_measurement)values(uid,item.key,item.value::numeric,p_details->item.key->>'method',(p_details->item.key->>'measuredAt')::timestamptz,p_details->item.key->>'source',(p_details->item.key->>'ageAtMeasurement')::integer);
  end if;
 end loop;
 update public.profiles set revision=revision+1,updated_at=now() where id=uid;
 insert into public.profile_imports(user_id,import_id) values(uid,p_import_id);
end $$;
revoke all on function public.migrate_local_profile(text,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.migrate_local_profile(text,jsonb,jsonb,jsonb) to authenticated;
commit;
