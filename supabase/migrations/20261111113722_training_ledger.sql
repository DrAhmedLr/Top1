-- Structured training is additive: the legacy checklist and its history remain intact.
create function private.valid_training_set(s jsonb,actual boolean default false) returns boolean language plpgsql immutable set search_path='' as $$
declare k text; n numeric;begin
 if coalesce(jsonb_typeof(s),'')<>'object' or not(s ? 'id') or (s->>'id')::uuid is null then return false;end if;
 foreach k in array array['reps','loadKg','durationSeconds','distanceMeters','restSeconds'] loop
  if s ? k then
   if jsonb_typeof(s->k)<>'number' then return false;end if;n:=(s->>k)::numeric;
   if n<0 or n>(case k when 'reps' then 10000 when 'loadKg' then 2000 when 'durationSeconds' then 604800 when 'distanceMeters' then 1000000 else 86400 end) or (k='reps' and n<>trunc(n)) then return false;end if;
  end if;
 end loop;
 return (s ? 'reps' or s ? 'durationSeconds' or s ? 'distanceMeters') and (not actual or coalesce(jsonb_typeof(s->'completed'),'')='boolean');
exception when others then return false;end $$;
create function private.valid_training_exercises(es jsonb,actual boolean default false) returns boolean language plpgsql immutable set search_path='' as $$
declare e jsonb; s jsonb;begin
 if coalesce(jsonb_typeof(es),'')<>'array' or jsonb_array_length(es)>64 then return false;end if;
 if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(es)) then return false;end if;
 for e in select value from jsonb_array_elements(es) loop
  if coalesce(jsonb_typeof(e),'')<>'object' or not(e ?& array['id','name','notes','sets']) or (e->>'id')::uuid is null or jsonb_typeof(e->'name')<>'string' or length(btrim(e->>'name')) not between 1 and 160 or jsonb_typeof(e->'notes')<>'string' or length(e->>'notes')>2000 then return false;end if;
  if not actual and (not(e ? 'equipment') or jsonb_typeof(e->'equipment')<>'string' or length(e->>'equipment')>160) then return false;end if;
  if actual and (not(e ?& array['status','substitutionReason']) or coalesce(e->>'status','') not in('pending','performed','skipped') or jsonb_typeof(e->'substitutionReason')<>'string' or length(e->>'substitutionReason')>1000) then return false;end if;
  if e ? 'plannedExerciseId' and (e->>'plannedExerciseId')::uuid is null then return false;end if;
  if jsonb_typeof(e->'sets')<>'array' or jsonb_array_length(e->'sets')>64 or (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(e->'sets')) then return false;end if;
  for s in select value from jsonb_array_elements(e->'sets') loop
   if not private.valid_training_set(s,actual) or (actual and e->>'status'<>'performed' and (s->>'completed')::boolean) then return false;end if;
  end loop;
 end loop;return true;
exception when others then return false;end $$;
create function private.valid_training_document(kind text,d jsonb) returns boolean language plpgsql stable set search_path='' as $$
declare s jsonb; e jsonb; parent jsonb; start_at timestamptz; end_at timestamptz;begin
 if coalesce(jsonb_typeof(d),'')<>'object' or not(d ?& array['version','name','notes','timeZone']) or d->>'version'<>'1' or jsonb_typeof(d->'name')<>'string' or length(btrim(d->>'name')) not between 1 and 160 or jsonb_typeof(d->'notes')<>'string' or length(d->>'notes')>4000 or jsonb_typeof(d->'timeZone')<>'string' or not exists(select 1 from pg_catalog.pg_timezone_names where name=d->>'timeZone') then return false;end if;
 if kind='program' then
  if not(d ?& array['archived','sessions']) or jsonb_typeof(d->'archived')<>'boolean' or jsonb_typeof(d->'sessions')<>'array' or jsonb_array_length(d->'sessions')>32 or (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(d->'sessions')) then return false;end if;
  for s in select value from jsonb_array_elements(d->'sessions') loop
   if not(s ?& array['id','name','weekdays','exercises']) or (s->>'id')::uuid is null or jsonb_typeof(s->'name')<>'string' or length(btrim(s->>'name')) not between 1 and 160 or jsonb_typeof(s->'weekdays')<>'array' or jsonb_array_length(s->'weekdays')>7 or not private.valid_training_exercises(s->'exercises') then return false;end if;
   if exists(select 1 from jsonb_array_elements(s->'weekdays') v where jsonb_typeof(v)<>'number' or v::text !~ '^[1-7]$') or (select count(*)<>count(distinct value) from jsonb_array_elements(s->'weekdays')) then return false;end if;
  end loop;
 elsif kind='workout' then
  if not(d ?& array['status','origin','snapshot','startedAt','exercises']) or not(d->'snapshot' ?& array['name','exercises']) or coalesce(d->>'status','') not in('in_progress','completed','abandoned') or jsonb_typeof(d->'snapshot')<>'object' or jsonb_typeof(d->'snapshot'->'name')<>'string' or length(btrim(d->'snapshot'->>'name')) not between 1 and 160 or not private.valid_training_exercises(d->'snapshot'->'exercises') or not private.valid_training_exercises(d->'exercises',true) then return false;end if;
  if not(d ? 'origin') then return false;end if;
  if d->'origin'<>'null'::jsonb then
   if not(d->'origin' ?& array['programId','sessionId','revision']) or jsonb_typeof(d->'origin')<>'object' or (d->'origin'->>'programId')::uuid is null or (d->'origin'->>'sessionId')::uuid is null or jsonb_typeof(d->'origin'->'revision')<>'number' or (d->'origin'->>'revision')::bigint<1 then return false;end if;
  end if;
  if jsonb_typeof(d->'startedAt')<>'string' or d->>'startedAt' !~ '^\d{4}-\d\d-\d\dT.*(Z|[+-]\d\d:\d\d)$' then return false;end if;
  start_at:=(d->>'startedAt')::timestamptz;if start_at>now()+interval '5 minutes' then return false;end if;
  if d->>'status'='in_progress' then if d ? 'endedAt' then return false;end if;
  else
   if jsonb_typeof(d->'endedAt')<>'string' or d->>'endedAt' !~ '^\d{4}-\d\d-\d\dT.*(Z|[+-]\d\d:\d\d)$' then return false;end if;
   end_at:=(d->>'endedAt')::timestamptz;if end_at<start_at or end_at>now()+interval '5 minutes' then return false;end if;
  end if;
  if (select count(*)<>count(distinct value->>'plannedExerciseId') from jsonb_array_elements(d->'exercises') where value ? 'plannedExerciseId') then return false;end if;
  for e in select value from jsonb_array_elements(d->'exercises') loop
   if e ? 'plannedExerciseId' then
    select value into parent from jsonb_array_elements(d->'snapshot'->'exercises') where value->>'id'=e->>'plannedExerciseId';
    if parent is null or (parent->>'name'<>e->>'name' and length(btrim(e->>'substitutionReason'))=0) then return false;end if;
   end if;
  end loop;
  if d->>'status'='completed' and not exists(select 1 from jsonb_array_elements(d->'exercises') actual_row,jsonb_array_elements(actual_row.value->'sets') set_row where actual_row.value->>'status'='performed' and set_row.value->>'completed'='true') then return false;end if;
 else return false;end if;return true;
exception when others then return false;end $$;
revoke all on function private.valid_training_set(jsonb,boolean),private.valid_training_exercises(jsonb,boolean),private.valid_training_document(text,jsonb) from public,anon;
grant execute on function private.valid_training_set(jsonb,boolean),private.valid_training_exercises(jsonb,boolean),private.valid_training_document(text,jsonb) to authenticated;

create table public.training_state(user_id uuid primary key references auth.users(id) on delete cascade,epoch bigint not null default 0 check(epoch>=0),counter bigint not null default 0 check(counter>=0));
create table public.training_events(
 sequence bigint generated always as identity primary key,user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in('program','workout')),entity_id uuid not null,revision bigint not null check(revision>0),request_id uuid not null,
 mutation jsonb not null,source text not null check(source in('personal','guest-import')),recorded_at timestamptz not null default now(),
 unique(user_id,kind,entity_id,revision),unique(user_id,request_id),check(octet_length(mutation::text)<=262144),check(private.valid_training_document(kind,mutation->'data')));
create index training_owner_sequence on public.training_events(user_id,sequence);
alter table public.training_state enable row level security;
alter table public.training_events enable row level security;
revoke all on public.training_state,public.training_events from public,anon,authenticated;
grant select on public.training_state,public.training_events to authenticated;
create policy training_state_owner on public.training_state for select to authenticated using(user_id=(select auth.uid()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false' and (select private.has_active_session()));
create policy training_events_owner on public.training_events for select to authenticated using(user_id=(select auth.uid()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false' and (select private.has_active_session()));
create function private.training_event_json(e public.training_events) returns jsonb language sql stable security invoker set search_path='' as $$select (e.mutation-'expectedRevision')||jsonb_build_object('revision',e.revision,'sequence',e.sequence,'recordedAt',e.recorded_at,'source',e.source)$$;
revoke all on function private.training_event_json(public.training_events) from public,anon;
grant execute on function private.training_event_json(public.training_events) to authenticated;

create function private.write_training(m jsonb,importing boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); old public.training_events; receipt public.training_events; inserted public.training_events; epoch_now bigint; d jsonb:=m->'data'; session jsonb; parent public.training_events;
begin
 if uid is null or not private.has_active_session() then raise exception 'Sign in to save training' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
 if coalesce(jsonb_typeof(m),'')<>'object' or not(m ?& array['version','id','requestId','kind','expectedRevision','epoch','data','deleted','reason']) or octet_length(m::text)>262144 or m->>'version'<>'1' or coalesce(m->>'kind','') not in('program','workout') or jsonb_typeof(m->'expectedRevision')<>'number' or coalesce(m->>'expectedRevision','') !~ '^(0|[1-9][0-9]*)$' or jsonb_typeof(m->'epoch')<>'number' or coalesce(m->>'epoch','') !~ '^(0|[1-9][0-9]*)$' or jsonb_typeof(m->'deleted')<>'boolean' or jsonb_typeof(m->'reason')<>'string' or length(m->>'reason')>1000 or not private.valid_training_document(m->>'kind',d) then raise exception 'Invalid training change' using errcode='22023';end if;
 select epoch into epoch_now from public.training_state where user_id=uid;epoch_now:=coalesce(epoch_now,0);
 if (m->>'epoch')::bigint<>epoch_now then raise exception 'Training history was cleared. Reload before saving.' using errcode='PT409';end if;
 select * into receipt from public.training_events where user_id=uid and request_id=(m->>'requestId')::uuid;
 if found then if receipt.mutation<>m then raise exception 'Request ID already used' using errcode='PT409';end if;return private.training_event_json(receipt);end if;
 select * into old from public.training_events where user_id=uid and kind=m->>'kind' and entity_id=(m->>'id')::uuid order by revision desc limit 1;
 if coalesce(old.revision,0)<>(m->>'expectedRevision')::bigint then raise exception 'Training changed elsewhere. Reload before saving.' using errcode='PT409';end if;
 if importing and old.revision is not null and exists(select 1 from public.training_events where user_id=uid and kind=old.kind and entity_id=old.entity_id and source<>'guest-import') then raise exception 'Import would overwrite account training' using errcode='PT409';end if;
 if m->>'kind'='workout' then
  if old.revision is not null then
   if d->'snapshot' is distinct from old.mutation->'data'->'snapshot' or d->'origin' is distinct from old.mutation->'data'->'origin' or d->'startedAt' is distinct from old.mutation->'data'->'startedAt' or d->'timeZone' is distinct from old.mutation->'data'->'timeZone' then raise exception 'Original workout context cannot change' using errcode='22023';end if;
   if (old.mutation->'data'->>'status'<>'in_progress' or old.mutation->>'deleted'='true' or m->>'deleted'='true') and length(btrim(m->>'reason'))<3 then raise exception 'Explain the workout correction' using errcode='22023';end if;
  elsif d->'origin'<>'null'::jsonb then
   select * into parent from public.training_events where user_id=uid and kind='program' and entity_id=(d->'origin'->>'programId')::uuid and revision=(d->'origin'->>'revision')::bigint;
   select value into session from jsonb_array_elements(parent.mutation->'data'->'sessions') where value->>'id'=d->'origin'->>'sessionId';
   if session is null or d->'snapshot'<>jsonb_build_object('name',session->'name','exercises',session->'exercises') then raise exception 'Original planned session was not found' using errcode='22023';end if;
  end if;
 end if;
 insert into public.training_events(user_id,kind,entity_id,revision,request_id,mutation,source) values(uid,m->>'kind',(m->>'id')::uuid,coalesce(old.revision,0)+1,(m->>'requestId')::uuid,m,case when importing then 'guest-import' else 'personal' end) returning * into inserted;
 insert into public.training_state(user_id,counter) values(uid,1) on conflict(user_id) do update set counter=training_state.counter+1;
 return private.training_event_json(inserted);
end $$;
revoke all on function private.write_training(jsonb,boolean) from public,anon;
grant execute on function private.write_training(jsonb,boolean) to authenticated;
create function public.write_training(m jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.write_training(m,false)$$;
revoke all on function public.write_training(jsonb) from public,anon;
grant execute on function public.write_training(jsonb) to authenticated;
create function public.import_training(changes jsonb,p_epoch bigint) returns void language plpgsql security invoker set search_path='' as $$declare m jsonb;begin
 if jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>20 or octet_length(changes::text)>2097152 then raise exception 'Invalid training import' using errcode='22023';end if;
 for m in select value from jsonb_array_elements(changes) loop
  if (m->>'epoch')::bigint is distinct from p_epoch then raise exception 'Import epoch mismatch' using errcode='PT409';end if;
  perform private.write_training(m,true);
 end loop;
end $$;
revoke all on function public.import_training(jsonb,bigint) from public,anon;
grant execute on function public.import_training(jsonb,bigint) to authenticated;
create function public.read_training_page(p_after bigint default 0) returns jsonb language sql stable security invoker set search_path='' as $$
 with page as(select e from public.training_events e where user_id=(select auth.uid()) and sequence>p_after order by sequence limit 250)
 select jsonb_build_object('epoch',coalesce((select epoch from public.training_state where user_id=(select auth.uid())),0),'counter',coalesce((select counter from public.training_state where user_id=(select auth.uid())),0),'events',coalesce((select jsonb_agg(private.training_event_json(e) order by (e).sequence) from page),'[]'::jsonb),'next',case when (select count(*) from page)=250 then (select max((e).sequence) from page) else null end)
$$;
revoke all on function public.read_training_page(bigint) from public,anon;
grant execute on function public.read_training_page(bigint) to authenticated;

create function private.purge_history_with_training(p_metric text,p_expected_revision bigint) returns bigint language plpgsql security definer set search_path='' as $$declare uid uuid:=auth.uid();r bigint;begin
 perform private.require_recent_session();perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
 if p_metric='training' then
  select revision into r from public.profiles where id=uid;r:=coalesce(r,0);
  if r is distinct from p_expected_revision then raise exception 'Profile revision conflict' using errcode='PT409';end if;
 else r:=private.purge_history_with_bodyweight(p_metric,p_expected_revision);end if;
 if p_metric is null or p_metric='training' then
  delete from public.training_events where user_id=uid;
  insert into public.training_state(user_id,epoch,counter) values(uid,1,1) on conflict(user_id) do update set epoch=training_state.epoch+1,counter=training_state.counter+1;
 end if;return r;
end $$;
revoke all on function private.purge_history_with_training(text,bigint) from public,anon;
grant execute on function private.purge_history_with_training(text,bigint) to authenticated;
create function public.purge_history_with_training(p_metric text,p_expected_revision bigint) returns bigint language sql security invoker set search_path='' as $$select private.purge_history_with_training(p_metric,p_expected_revision)$$;
revoke all on function public.purge_history_with_training(text,bigint) from public,anon;
grant execute on function public.purge_history_with_training(text,bigint) to authenticated;
