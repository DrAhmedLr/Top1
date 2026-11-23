begin;

create or replace function private.forecast_learning_sync(
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
  issues jsonb;
  captured boolean:=false;
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
  issues:=case when p_forecast is null or p_forecast='null'::jsonb then '[]'::jsonb
    when jsonb_typeof(p_forecast)='array' then p_forecast else jsonb_build_array(p_forecast) end;
  -- Each member is a distinct metric issued against this same ledger snapshot.
  if (jsonb_typeof(p_forecast)='array' and jsonb_array_length(issues)>p_training_counter) or exists (
    select 1 from jsonb_array_elements(issues) row group by row->>'metric' having count(*)>1
  ) then raise exception 'Invalid group forecasts' using errcode='22023'; end if;
  for f in select * from jsonb_to_recordset(issues) as v(
      "planId" uuid,revision bigint,metric text,"goalUnit" text,target numeric,deadline date,
      "timeZone" text,version text,kind text,probability numeric,"issuedProbability" numeric,"horizonDays" integer,"relativeGap" numeric)
  loop
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
      captured:=captured or issue_id is not null;
      if shares and issue_id is not null then
        insert into private.forecast_contributions values(p_owner,issue_id);
      end if;
    end if;
  end loop;

  -- A full replay retracts unsupported labels, including a corrected test that
  -- used to imply success. Measurement time and server resolution must follow
  -- issue. A final-day miss can be staged through midnight without a later visit.
  with replay as materialized (
    select * from jsonb_to_recordset(p_outcomes) as v("planId" uuid,revision bigint,status text,
      "measuredAt" timestamptz,"resolvedAt" timestamptz,"baselineRecordedAt" timestamptz,completed integer,due integer,planned integer,"afterIssue" jsonb)
  ), labels as materialized (
    select g.id,r.status='reached' as reached,r."measuredAt" as measured_at,r."resolvedAt" as resolved_at,
      r.completed,r.due,r.planned,remaining.remaining_due,remaining.remaining_completed
    from private.goal_forecasts g join replay r on g.plan_id=r."planId" and g.revision=r.revision
    left join lateral private.forecast_after_issue(r."afterIssue",g.kind,g.model_version,g.issued_at,r.due,r.completed) remaining on true
    where g.user_id=p_owner and r.status in ('reached','missed') and r."baselineRecordedAt"<=g.issued_at
      and r."measuredAt">g.issued_at and r."measuredAt"<=statement_timestamp() and r."measuredAt"<g.matures_at
      and r."resolvedAt">g.issued_at and r."resolvedAt">=r."measuredAt"
      and (r."resolvedAt"<=statement_timestamp() or (r.status='missed' and r."resolvedAt"=g.matures_at))
      and (r.status='reached' or (r."measuredAt" at time zone g.time_zone)::date=g.deadline)
  ), applied as (
    insert into private.forecast_outcomes as old(forecast_id,reached,measured_at,resolved_at,
      completed,due,planned,remaining_due,remaining_completed,profile_revision,training_epoch,training_counter)
    select id,reached,measured_at,resolved_at,completed,due,planned,remaining_due,remaining_completed,p_profile_revision,p_training_epoch,p_training_counter from labels
    on conflict(forecast_id) do update set reached=excluded.reached,measured_at=excluded.measured_at,
      resolved_at=excluded.resolved_at,completed=excluded.completed,due=excluded.due,planned=excluded.planned,
      remaining_due=excluded.remaining_due,remaining_completed=excluded.remaining_completed,
      profile_revision=excluded.profile_revision,training_epoch=excluded.training_epoch,training_counter=excluded.training_counter,
      available_at=case when (old.reached,old.measured_at,old.resolved_at,old.completed,old.due,old.planned,old.remaining_due,old.remaining_completed)
        is distinct from (excluded.reached,excluded.measured_at,excluded.resolved_at,excluded.completed,excluded.due,excluded.planned,excluded.remaining_due,excluded.remaining_completed)
        then statement_timestamp() else old.available_at end
    returning forecast_id
  )
  delete from private.forecast_outcomes o using private.goal_forecasts g
    where o.forecast_id=g.id and g.user_id=p_owner and not exists(select 1 from labels where id=g.id);
  return jsonb_build_object('enabled',shares,'captured',captured,'firstForecasts',coalesce((
    select jsonb_agg(jsonb_build_object('planId',first_issue.plan_id,'revision',first_issue.revision,'probability',first_issue.issued_probability,
      'kind',first_issue.kind,'issuedAt',first_issue.issued_at) order by first_issue.issued_at desc,first_issue.id desc)
    from (select distinct on (plan_id,revision) plan_id,revision,issued_probability,kind,issued_at,id
      from private.goal_forecasts where user_id=p_owner order by plan_id,revision,issued_at,id) first_issue
  ),'[]'::jsonb));
end $$;

-- All cohort estimates for a group use one database snapshot. Each criterion still
-- goes through the same conditional-adherence, availability and validation gates.
create function private.forecast_learning_evidence_batch(p_owner uuid,p_capability text,p_criteria jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare evidence jsonb;
begin
  perform private.require_forecast_writer(p_owner,p_capability);
  if jsonb_typeof(p_criteria) is distinct from 'array' then raise exception 'Invalid criteria' using errcode='22023';end if;
  if jsonb_array_length(p_criteria)>coalesce((select counter from public.training_state where user_id=p_owner),0) or exists(
    select 1 from jsonb_array_elements(p_criteria) row group by row->>'metric' having count(*)>1
  ) then raise exception 'Invalid group criteria' using errcode='22023';end if;
  select coalesce(jsonb_object_agg(c."planId"::text,private.forecast_learning_evidence(
    p_owner,p_capability,c.metric,c."goalUnit",c.version,c.kind,c."horizonDays",c."relativeGap",c.probability)),'{}'::jsonb)
    into evidence from jsonb_to_recordset(p_criteria) as c("planId" uuid,metric text,"goalUnit" text,version text,kind text,
      "horizonDays" integer,"relativeGap" numeric,probability numeric);
  return evidence;
end $$;
create function public.forecast_learning_evidence_batch(p_owner uuid,p_capability text,p_criteria jsonb)
returns jsonb language sql stable security invoker set search_path='' as $$select private.forecast_learning_evidence_batch(p_owner,p_capability,p_criteria)$$;
revoke all on function private.forecast_learning_evidence_batch(uuid,text,jsonb),public.forecast_learning_evidence_batch(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.forecast_learning_evidence_batch(uuid,text,jsonb),public.forecast_learning_evidence_batch(uuid,text,jsonb) to authenticated;

commit;
