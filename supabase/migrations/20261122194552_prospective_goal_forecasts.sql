begin;

-- Provision only sha256(UTF8(TOP1_GOAL_TRACKING_KEY)) after deployment review.
create table private.forecast_writer (
  singleton boolean primary key default true check (singleton),
  capability_sha256 bytea not null check (octet_length(capability_sha256)=32)
);
create table private.forecast_consent (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table private.goal_forecasts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  opening_event bigint not null references public.training_events(sequence) on delete cascade,
  plan_id uuid not null,
  revision bigint not null check (revision>0),
  metric text not null check (length(metric) between 1 and 64),
  goal_unit text not null check (goal_unit in ('metric','kg')),
  target numeric not null check (target>=0 and target<'Infinity'::numeric),
  deadline date not null check (isfinite(deadline)),
  time_zone text not null,
  matures_at timestamptz not null,
  issued_at timestamptz not null default statement_timestamp(),
  model_version text not null check (length(model_version) between 1 and 80),
  kind text not null check (kind in ('illustrative','personal')),
  probability numeric not null check (probability between 0 and 1),
  issued_probability numeric not null check (issued_probability between 0 and 1),
  horizon_days integer not null check (horizon_days>=0),
  relative_gap numeric not null check (relative_gap>=0 and relative_gap<'Infinity'::numeric),
  unique (opening_event,model_version,kind),
  unique (user_id,id)
);
create index goal_forecasts_owner on private.goal_forecasts(user_id,plan_id,revision);
create index goal_forecasts_cohort on private.goal_forecasts(metric,goal_unit,model_version,kind,matures_at);
-- Eligibility is created only when the forecast is first issued. Re-enabling
-- consent cannot recreate a withdrawn contribution from an earlier forecast.
create table private.forecast_contributions (
  user_id uuid not null references private.forecast_consent(user_id) on delete cascade,
  forecast_id bigint primary key,
  foreign key (user_id,forecast_id) references private.goal_forecasts(user_id,id) on delete cascade
);
create index forecast_contributions_owner on private.forecast_contributions(user_id);
create table private.forecast_outcomes (
  forecast_id bigint primary key references private.goal_forecasts(id) on delete cascade,
  reached boolean not null,
  measured_at timestamptz not null,
  resolved_at timestamptz not null,
  completed integer not null check (completed>=0),
  due integer not null check (due>=completed),
  planned integer not null check (planned>=due),
  profile_revision bigint not null,
  training_epoch bigint not null,
  training_counter bigint not null,
  available_at timestamptz not null default statement_timestamp()
);
alter table private.forecast_writer enable row level security;
alter table private.forecast_consent enable row level security;
alter table private.goal_forecasts enable row level security;
alter table private.forecast_contributions enable row level security;
alter table private.forecast_outcomes enable row level security;
revoke all on private.forecast_writer, private.forecast_consent, private.goal_forecasts,
  private.forecast_contributions, private.forecast_outcomes from public, anon, authenticated;
revoke all on sequence private.goal_forecasts_id_seq from public,anon,authenticated;

create function private.require_forecast_owner(p_owner uuid) returns void
language plpgsql stable security invoker set search_path='' as $$
begin
  if p_owner is null or p_owner is distinct from auth.uid() or not private.has_active_session() then
    raise exception 'Active account required' using errcode='42501';
  end if;
end $$;
create function private.require_forecast_writer(p_owner uuid,p_capability text) returns void
language plpgsql stable security invoker set search_path='' as $$
begin
  perform private.require_forecast_owner(p_owner);
  if p_capability is null or p_capability !~ '^[0-9a-f]{64}$' or not exists (
    select 1 from private.forecast_writer where capability_sha256=sha256(convert_to(p_capability,'UTF8'))
  ) then raise exception 'Forecast writer required' using errcode='42501'; end if;
end $$;

create function private.forecast_learning_preference(p_owner uuid,p_enabled boolean) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  perform private.require_forecast_owner(p_owner);
  if p_enabled is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
    if p_enabled then
      insert into private.forecast_consent values(p_owner) on conflict do nothing;
    else
      delete from private.forecast_consent where user_id=p_owner;
    end if;
  end if;
  return exists(select 1 from private.forecast_consent where user_id=p_owner);
end $$;

create function private.forecast_learning_sync(
  p_owner uuid,p_capability text,p_profile_revision bigint,p_training_epoch bigint,p_training_counter bigint,
  p_forecast jsonb,p_outcomes jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  f record;
  issue_id bigint;
  program public.training_events;
  current_profile bigint;
  training public.training_state;
  shares boolean;
begin
  perform private.require_forecast_writer(p_owner,p_capability);
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
  select revision into current_profile from public.profiles where id=p_owner;
  select * into training from public.training_state where user_id=p_owner;
  if coalesce(current_profile,0) is distinct from p_profile_revision
    or coalesce(training.epoch,0) is distinct from p_training_epoch
    or coalesce(training.counter,0) is distinct from p_training_counter then
    raise exception 'Forecast inputs changed' using errcode='PT409';
  end if;
  if jsonb_typeof(p_outcomes) is distinct from 'array' then
    raise exception 'A complete outcome replay is required' using errcode='22023';
  end if;
  shares:=exists(select 1 from private.forecast_consent where user_id=p_owner);
  if p_forecast is not null and p_forecast<>'null'::jsonb then
    select * into f from jsonb_to_record(p_forecast) as v(
      "planId" uuid,revision bigint,metric text,"goalUnit" text,target numeric,deadline date,
      "timeZone" text,version text,kind text,probability numeric,"issuedProbability" numeric,"horizonDays" integer,"relativeGap" numeric);
    select * into program from public.training_events
      where user_id=p_owner and kind='program' and entity_id=f."planId" and revision=f.revision;
    if not found or f."timeZone" is distinct from program.mutation->'data'->>'timeZone' then
      raise exception 'Forecast opening program unavailable' using errcode='PT409';
    end if;
    if statement_timestamp() < ((f.deadline+1)::timestamp at time zone f."timeZone")
      and not exists(select 1 from jsonb_array_elements(p_outcomes) as r
        where r->>'planId'=f."planId"::text and (r->>'revision')::bigint=f.revision
          and r->>'status' in ('reached','missed','superseded','unobserved')) then
      insert into private.goal_forecasts(user_id,opening_event,plan_id,revision,metric,goal_unit,target,
        deadline,time_zone,matures_at,model_version,kind,probability,issued_probability,horizon_days,relative_gap)
      values(p_owner,program.sequence,f."planId",f.revision,f.metric,f."goalUnit",f.target,
        f.deadline,f."timeZone",(f.deadline+1)::timestamp at time zone f."timeZone",f.version,f.kind,
        f.probability,coalesce(f."issuedProbability",f.probability),f."horizonDays",f."relativeGap")
      on conflict (opening_event,model_version,kind) do nothing returning id into issue_id;
      if shares and issue_id is not null then
        insert into private.forecast_contributions values(p_owner,issue_id);
      end if;
    end if;
  end if;

  -- A full replay retracts unsupported labels, including a corrected test that
  -- used to imply success. Measurement time and server resolution must follow
  -- issue. A final-day miss can be staged through midnight without a later visit.
  with replay as materialized (
    select * from jsonb_to_recordset(p_outcomes) as v("planId" uuid,revision bigint,status text,
      "measuredAt" timestamptz,"resolvedAt" timestamptz,"baselineRecordedAt" timestamptz,completed integer,due integer,planned integer)
  ), labels as materialized (
    select g.id,r.status='reached' as reached,r."measuredAt" as measured_at,r."resolvedAt" as resolved_at,
      r.completed,r.due,r.planned
    from private.goal_forecasts g join replay r on g.plan_id=r."planId" and g.revision=r.revision
    where g.user_id=p_owner and r.status in ('reached','missed') and r."baselineRecordedAt"<=g.issued_at
      and r."measuredAt">g.issued_at and r."measuredAt"<=statement_timestamp() and r."measuredAt"<g.matures_at
      and r."resolvedAt">g.issued_at and r."resolvedAt">=r."measuredAt"
      and (r."resolvedAt"<=statement_timestamp() or (r.status='missed' and r."resolvedAt"=g.matures_at))
      and (r.status='reached' or (r."measuredAt" at time zone g.time_zone)::date=g.deadline)
  ), applied as (
    insert into private.forecast_outcomes as old(forecast_id,reached,measured_at,resolved_at,
      completed,due,planned,profile_revision,training_epoch,training_counter)
    select id,reached,measured_at,resolved_at,completed,due,planned,p_profile_revision,p_training_epoch,p_training_counter from labels
    on conflict(forecast_id) do update set reached=excluded.reached,measured_at=excluded.measured_at,
      resolved_at=excluded.resolved_at,completed=excluded.completed,due=excluded.due,planned=excluded.planned,
      profile_revision=excluded.profile_revision,training_epoch=excluded.training_epoch,training_counter=excluded.training_counter,
      available_at=case when (old.reached,old.measured_at,old.resolved_at,old.completed,old.due,old.planned)
        is distinct from (excluded.reached,excluded.measured_at,excluded.resolved_at,excluded.completed,excluded.due,excluded.planned)
        then statement_timestamp() else old.available_at end
    returning forecast_id
  )
  delete from private.forecast_outcomes o using private.goal_forecasts g
    where o.forecast_id=g.id and g.user_id=p_owner and not exists(select 1 from labels where id=g.id);
  return jsonb_build_object('enabled',shares,'captured',issue_id is not null,'firstForecasts',coalesce((
    select jsonb_agg(jsonb_build_object('planId',first_issue.plan_id,'revision',first_issue.revision,'probability',first_issue.issued_probability,
      'kind',first_issue.kind,'issuedAt',first_issue.issued_at) order by first_issue.issued_at desc,first_issue.id desc)
    from (select distinct on (plan_id,revision) plan_id,revision,issued_probability,kind,issued_at,id
      from private.goal_forecasts where user_id=p_owner order by plan_id,revision,issued_at,id) first_issue
  ),'[]'::jsonb));
end $$;

-- The three comparisons are intentionally coarse and fixed for all callers.
-- The raw rows and the contributor's identity never leave this function.
create function private.forecast_learning_evidence(
  p_owner uuid,p_capability text,p_metric text,p_goal_unit text,p_version text,p_kind text,
  p_horizon_days integer,p_relative_gap numeric,p_probability numeric
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform private.require_forecast_writer(p_owner,p_capability);
  if p_probability not between 0 and 1 or p_horizon_days<0 or p_relative_gap<0 then
    raise exception 'Invalid calibration cohort' using errcode='22023';
  end if;
  with issued as materialized (
    -- Choose the attempt before looking at its outcome. Conditioning this choice
    -- on a retest would favor people who returned with a successful result.
    select distinct on (f.user_id) f.user_id,f.id,f.issued_at,f.matures_at,f.probability
    from private.goal_forecasts f
    join private.forecast_contributions c on c.forecast_id=f.id
    where f.user_id<>p_owner and f.metric=p_metric and f.goal_unit=p_goal_unit
      and f.model_version=p_version and f.kind=p_kind
      and least(9,floor(f.probability*10))=least(9,floor(p_probability*10))
      and width_bucket(f.horizon_days,array[15,43,91])=width_bucket(p_horizon_days,array[15,43,91])
      and width_bucket(f.relative_gap,array[0.1,0.25,0.50])=width_bucket(p_relative_gap,array[0.1,0.25,0.50])
      and f.matures_at<=statement_timestamp()
    order by f.user_id,f.issued_at,f.id
  ), cutoff as (
    select percentile_disc(0.7) within group (order by issued_at) as split from issued
  ), partitions as (
    select f.*,case when f.issued_at>=split then 'validation' else 'training' end as part,
      case when f.issued_at>=split then statement_timestamp() else split end as known_before
    from issued f cross join cutoff where f.issued_at>=split or f.matures_at<split
  ), checked as materialized (
    select f.part,f.probability,o.reached,o.due>0 and o.completed=o.due as adherent,
      coalesce(o.available_at<f.known_before and o.resolved_at<f.known_before
        and o.profile_revision=coalesce(p.revision,0) and o.training_epoch=t.epoch
        and o.training_counter=t.counter,false) as observed
    from partitions f left join private.forecast_outcomes o on o.forecast_id=f.id
    left join public.profiles p on p.id=f.user_id
    left join public.training_state t on t.user_id=f.user_id
  ), followup as (
    select part,count(*) filter (where observed)*10>=count(*)*7 as sufficient
    from checked group by part
  ), statistics as (
    select part,jsonb_build_object('participants',count(*),'reached',count(*) filter(where reached),
      'expected',sum(probability),'brierBase',avg(power(probability-reached::integer,2))) as stats
    from checked where observed and adherent group by part having count(*)>=20
  )
  select case when (select count(*)=2 and bool_and(sufficient) from followup) then
    jsonb_build_object('training',(select stats from statistics where part='training'),
      'validation',(select stats from statistics where part='validation'))
    else '{"training":null,"validation":null}'::jsonb end into result;
  return result;
end $$;

create function private.own_forecast_learning_export() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();
begin
  perform private.require_forecast_owner(owner_id);
  return jsonb_build_object('enabled',exists(select 1 from private.forecast_consent where user_id=owner_id),
    'forecasts',coalesce((select jsonb_agg(jsonb_build_object(
      'planId',f.plan_id,'revision',f.revision,'metric',f.metric,'goalUnit',f.goal_unit,'target',f.target,
      'deadline',f.deadline,'timeZone',f.time_zone,'issuedAt',f.issued_at,'version',f.model_version,
      'kind',f.kind,'probability',f.probability,'issuedProbability',f.issued_probability,
      'horizonDays',f.horizon_days,'relativeGap',f.relative_gap,'contributing',c.forecast_id is not null,
      'outcome',case when o.forecast_id is not null and (o.reached or f.matures_at<=statement_timestamp())
        and o.resolved_at<=statement_timestamp() and o.profile_revision=coalesce(p.revision,0)
        and o.training_epoch=t.epoch and o.training_counter=t.counter then jsonb_build_object(
          'status',case when o.reached then 'reached' else 'missed' end,'measuredAt',o.measured_at,
          'resolvedAt',o.resolved_at,'completed',o.completed,'due',o.due,'planned',o.planned) end)
      order by f.issued_at desc,f.id desc)
      from private.goal_forecasts f left join private.forecast_outcomes o on o.forecast_id=f.id
      left join private.forecast_contributions c on c.forecast_id=f.id
      left join public.profiles p on p.id=f.user_id left join public.training_state t on t.user_id=f.user_id
      where f.user_id=owner_id),'[]'::jsonb));
end $$;

-- Keep the original purges and their revision / fresh-session guards. Deleting
-- an opening ledger event already cascades through its forecasts on training
-- purge. Metric and weight purges must also erase derived forecast records.
create or replace function private.purge_own_history(p_metric text,p_expected_revision bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); r bigint;
begin
  perform private.require_recent_session();
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select revision into r from public.profiles where id=uid;
  if r is null or r is distinct from p_expected_revision then
    raise exception 'Profile revision conflict' using errcode='PT409';
  end if;
  delete from private.goal_forecasts where user_id=uid and (p_metric is null or metric=p_metric);
  delete from public.metric_logs where user_id=uid and (p_metric is null or metric_id=p_metric);
  delete from public.profile_revisions where user_id=uid;
  update public.profiles set is_public=false,public_summary='{}',revision=r+1,updated_at=now() where id=uid;
  select revision into r from public.profiles where id=uid;
  return r;
end $$;

create or replace function private.purge_history_with_bodyweight(p_metric text,p_expected_revision bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); r bigint;
begin
  perform private.require_recent_session();
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  if p_metric='bodyweight' then
    select revision into r from public.profiles where id=uid;
    r:=coalesce(r,0);
    if r is distinct from p_expected_revision then raise exception 'Profile revision conflict' using errcode='PT409'; end if;
    delete from private.goal_forecasts where user_id=uid and goal_unit='kg';
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

create function public.forecast_learning_preference(p_owner uuid,p_enabled boolean default null)
returns boolean language sql security invoker set search_path='' as $$
  select private.forecast_learning_preference(p_owner,p_enabled)
$$;
create function public.forecast_learning_sync(p_owner uuid,p_capability text,p_profile_revision bigint,
  p_training_epoch bigint,p_training_counter bigint,p_forecast jsonb,p_outcomes jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select private.forecast_learning_sync(p_owner,p_capability,p_profile_revision,p_training_epoch,p_training_counter,p_forecast,p_outcomes)
$$;
create function public.forecast_learning_evidence(p_owner uuid,p_capability text,p_metric text,
  p_goal_unit text,p_version text,p_kind text,p_horizon_days integer,p_relative_gap numeric,p_probability numeric)
returns jsonb language sql stable security invoker set search_path='' as $$
  select private.forecast_learning_evidence(p_owner,p_capability,p_metric,p_goal_unit,p_version,p_kind,p_horizon_days,p_relative_gap,p_probability)
$$;
create function public.own_forecast_learning_export()
returns jsonb language sql stable security invoker set search_path='' as $$ select private.own_forecast_learning_export() $$;

revoke all on function private.require_forecast_writer(uuid,text), private.require_forecast_owner(uuid)
  from public,anon,authenticated;
revoke all on function private.forecast_learning_preference(uuid,boolean),public.forecast_learning_preference(uuid,boolean),
  private.forecast_learning_sync(uuid,text,bigint,bigint,bigint,jsonb,jsonb),public.forecast_learning_sync(uuid,text,bigint,bigint,bigint,jsonb,jsonb),
  private.forecast_learning_evidence(uuid,text,text,text,text,text,integer,numeric,numeric),
  public.forecast_learning_evidence(uuid,text,text,text,text,text,integer,numeric,numeric),
  private.own_forecast_learning_export(),public.own_forecast_learning_export() from public,anon,authenticated;
grant execute on function private.forecast_learning_preference(uuid,boolean),public.forecast_learning_preference(uuid,boolean),
  private.forecast_learning_sync(uuid,text,bigint,bigint,bigint,jsonb,jsonb),public.forecast_learning_sync(uuid,text,bigint,bigint,bigint,jsonb,jsonb),
  private.forecast_learning_evidence(uuid,text,text,text,text,text,integer,numeric,numeric),
  public.forecast_learning_evidence(uuid,text,text,text,text,text,integer,numeric,numeric),
  private.own_forecast_learning_export(),public.own_forecast_learning_export() to authenticated;
commit;
