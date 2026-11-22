-- Independent, append-only dated weights. Never backfill from profile context.
create table public.bodyweight_state(user_id uuid primary key references auth.users(id) on delete cascade,epoch bigint not null default 0 check(epoch>=0));
alter table public.bodyweight_state enable row level security;
revoke all on public.bodyweight_state from public,anon,authenticated;
grant select on public.bodyweight_state to authenticated;
create policy "Own weight history version" on public.bodyweight_state for select to authenticated using(user_id=(select auth.uid()) and(select private.has_active_session()));

create table public.bodyweight_events(
 sequence bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 entry_id uuid not null, request_id uuid not null,
 revision integer not null check(revision>0),
 kg numeric(8,3) not null check(kg between 25 and 350),
 entered_value numeric(12,6) not null,
 unit text not null check(unit in ('kg','lb')),
 measured_at timestamptz not null, time_zone text not null check(length(time_zone) between 1 and 64),
 recorded_at timestamptz not null default now(),
 is_deleted boolean not null default false,
 action text not null check(action in ('save','delete','restore')),
 source text not null default 'manual' check(source in ('manual','guest_import')),
 unique(user_id,entry_id,revision),unique(user_id,request_id),
 check(kg=round(case when unit='lb' then entered_value*0.45359237 else entered_value end,3))
);
create index bodyweight_owner_latest on public.bodyweight_events(user_id,entry_id,revision desc);
alter table public.bodyweight_events enable row level security;
revoke all on public.bodyweight_events from public,anon,authenticated;
revoke all on sequence public.bodyweight_events_sequence_seq from public,anon,authenticated;
grant select on public.bodyweight_events to authenticated;
create policy "Own dated bodyweight" on public.bodyweight_events for select to authenticated
 using(user_id=(select auth.uid()) and (select private.has_active_session()));

create function private.weight_event_json(e jsonb) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',e->'entry_id','requestId',e->'request_id','revision',e->'revision','kg',e->'kg','value',e->'entered_value','unit',e->'unit','measuredAt',e->'measured_at','timeZone',e->'time_zone','recordedAt',e->'recorded_at','deleted',e->'is_deleted','action',e->'action','source',e->'source');
$$;
revoke all on function private.weight_event_json(jsonb) from public,anon;
grant execute on function private.weight_event_json(jsonb) to authenticated;

create function private.write_bodyweight(p_entry uuid,p_request uuid,p_revision integer,p_action text,p_value numeric default null,p_unit text default null,p_measured_at timestamptz default null,p_time_zone text default null,p_source text default 'manual',p_epoch bigint default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); old public.bodyweight_events; duplicate public.bodyweight_events; saved public.bodyweight_events; weight_kg numeric;
begin
 if uid is null or not private.has_active_session() then raise exception 'Sign in to record bodyweight' using errcode='42501';end if;
 if p_entry is null or p_request is null or p_revision is null or p_revision<0 or p_action is null or p_action not in ('save','delete','restore') or p_source is null or p_source not in ('manual','guest_import') then raise exception 'Invalid weight request';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
 if p_epoch is distinct from coalesce((select epoch from public.bodyweight_state where user_id=uid),0) then raise exception 'Weight history was cleared; reload before recording' using errcode='PT409';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text||p_entry::text,0));
 if p_action='save' then
  if p_unit is null or p_unit not in ('kg','lb') or p_value is null or p_measured_at is null or p_measured_at>now()+interval '5 minutes' or not isfinite(p_measured_at) or p_time_zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_time_zone) then raise exception 'Review value, unit and test date';end if;
  p_value:=round(p_value,6);
  weight_kg:=round(case when p_unit='lb' then p_value*0.45359237 else p_value end,3);
  if not(weight_kg between 25 and 350) then raise exception 'Weight outside supported range';end if;
 end if;
 select * into duplicate from public.bodyweight_events where user_id=uid and request_id=p_request;
 if duplicate.sequence is not null then
  if duplicate.entry_id<>p_entry or duplicate.revision<>p_revision+1 or duplicate.action<>p_action or (p_action='save' and (duplicate.entered_value is distinct from p_value or duplicate.unit is distinct from p_unit or duplicate.measured_at is distinct from p_measured_at or duplicate.time_zone is distinct from p_time_zone)) then raise exception 'Request ID already used';end if;
  return private.weight_event_json(to_jsonb(duplicate));
 end if;
 select * into old from public.bodyweight_events where user_id=uid and entry_id=p_entry order by revision desc limit 1;
 if coalesce(old.revision,0)<>p_revision then raise exception 'Weight revision conflict' using errcode='PT409';end if;
 if p_action<>'save' and old.sequence is null then raise exception 'Entry no longer exists';end if;
 if p_action='restore' and not old.is_deleted then raise exception 'Entry already active';end if;
 insert into public.bodyweight_events(user_id,entry_id,request_id,revision,kg,entered_value,unit,measured_at,time_zone,is_deleted,action,source)
 values(uid,p_entry,p_request,p_revision+1,case when p_action='save' then weight_kg else old.kg end,case when p_action='save' then p_value else old.entered_value end,case when p_action='save' then p_unit else old.unit end,case when p_action='save' then p_measured_at else old.measured_at end,case when p_action='save' then p_time_zone else old.time_zone end,p_action='delete',p_action,p_source) returning * into saved;
 return private.weight_event_json(to_jsonb(saved));
end $$;
revoke all on function private.write_bodyweight(uuid,uuid,integer,text,numeric,text,timestamptz,text,text,bigint) from public,anon;
grant execute on function private.write_bodyweight(uuid,uuid,integer,text,numeric,text,timestamptz,text,text,bigint) to authenticated;
create function public.write_bodyweight(p_entry uuid,p_request uuid,p_revision integer,p_action text,p_value numeric default null,p_unit text default null,p_measured_at timestamptz default null,p_time_zone text default null,p_epoch bigint default 0)
returns jsonb language sql security invoker set search_path='' as $$
 select private.write_bodyweight(p_entry,p_request,p_revision,p_action,p_value,p_unit,p_measured_at,p_time_zone,'manual',p_epoch);
$$;
revoke all on function public.write_bodyweight(uuid,uuid,integer,text,numeric,text,timestamptz,text,bigint) from public,anon;
grant execute on function public.write_bodyweight(uuid,uuid,integer,text,numeric,text,timestamptz,text,bigint) to authenticated;

create function public.read_bodyweight_page(p_before timestamptz default null,p_before_id uuid default null,p_deleted boolean default false,p_limit integer default 30)
returns jsonb language sql stable security invoker set search_path='' as $$
 with latest as (
 select distinct on(entry_id) * from public.bodyweight_events where user_id=(select auth.uid()) order by entry_id,revision desc
 ), selected as (
 select * from latest where (p_deleted or not is_deleted) and(p_before is null or (measured_at,entry_id)<(p_before,p_before_id))
 order by measured_at desc,entry_id desc limit greatest(1,least(p_limit,100))+1
 ), page as (
 select * from selected order by measured_at desc,entry_id desc limit greatest(1,least(p_limit,100))
 )
 select jsonb_build_object(
 'epoch',coalesce((select epoch from public.bodyweight_state where user_id=(select auth.uid())),0),
 'entries',coalesce((select jsonb_agg(private.weight_event_json(to_jsonb(p)) order by p.measured_at desc,p.entry_id desc) from page p),'[]'::jsonb),
 'latest',coalesce((select jsonb_agg(private.weight_event_json(to_jsonb(s)) order by s.measured_at desc,s.entry_id desc) from (select * from latest where not is_deleted order by measured_at desc,entry_id desc limit 2) s),'[]'::jsonb),
 'total',(select count(*) from latest where p_deleted or not is_deleted),
 'next',case when(select count(*) from selected)>greatest(1,least(p_limit,100)) then (select jsonb_build_object('date',measured_at,'id',entry_id) from page order by measured_at,entry_id limit 1) else null end);
$$;
revoke all on function public.read_bodyweight_page(timestamptz,uuid,boolean,integer) from public,anon;
grant execute on function public.read_bodyweight_page(timestamptz,uuid,boolean,integer) to authenticated;

create function private.import_bodyweight(p_entries jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); item jsonb; imported integer:=0;
begin
 if uid is null or not private.has_active_session() then raise exception 'Sign in before import' using errcode='42501';end if;
 if p_entries is null or jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)>50 then raise exception 'Import up to 50 weights at once';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
 for item in select * from jsonb_array_elements(p_entries) loop
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text||(item->>'id')::uuid::text,0));
  if not exists(select 1 from public.bodyweight_events where user_id=uid and entry_id=(item->>'id')::uuid) then
   perform private.write_bodyweight((item->>'id')::uuid,(item->>'id')::uuid,0,'save',(item->>'value')::numeric,item->>'unit',(item->>'measuredAt')::timestamptz,item->>'timeZone','guest_import',coalesce((select epoch from public.bodyweight_state where user_id=uid),0));
   imported:=imported+1;
  end if;
 end loop;
 return imported;
end $$;
revoke all on function private.import_bodyweight(jsonb) from public,anon;
grant execute on function private.import_bodyweight(jsonb) to authenticated;
create function public.import_bodyweight(p_entries jsonb) returns integer language sql security invoker set search_path='' as $$select private.import_bodyweight(p_entries);$$;
revoke all on function public.import_bodyweight(jsonb) from public,anon;
grant execute on function public.import_bodyweight(jsonb) to authenticated;

-- Existing history purge stays intact. The new wrapper adds the separate series.
create function private.purge_history_with_bodyweight(p_metric text,p_expected_revision bigint) returns bigint language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); r bigint;
begin
 perform private.require_recent_session();
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
 if p_metric='bodyweight' and not exists(select 1 from public.profiles where id=uid) then
  if p_expected_revision<>0 then raise exception 'Profile revision conflict' using errcode='PT409';end if;
  r:=0;
 else r:=public.purge_own_history(p_metric,p_expected_revision);
 end if;
 if p_metric is null or p_metric='bodyweight' then delete from public.bodyweight_events where user_id=uid;insert into public.bodyweight_state(user_id,epoch)values(uid,1)on conflict(user_id)do update set epoch=bodyweight_state.epoch+1;end if;
 return r;
end $$;
revoke all on function private.purge_history_with_bodyweight(text,bigint) from public,anon;
grant execute on function private.purge_history_with_bodyweight(text,bigint) to authenticated;
create function public.purge_history_with_bodyweight(p_metric text,p_expected_revision bigint) returns bigint language sql security invoker set search_path='' as $$select private.purge_history_with_bodyweight(p_metric,p_expected_revision);$$;
revoke all on function public.purge_history_with_bodyweight(text,bigint) from public,anon;
grant execute on function public.purge_history_with_bodyweight(text,bigint) to authenticated;
