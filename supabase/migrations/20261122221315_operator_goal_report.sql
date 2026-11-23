begin;

-- Only opted-in, prospectively shared receipts can acquire a progress row.
-- Withdrawal, history purges and account deletion cascade from the receipt.
create table private.shared_goal_progress (
  forecast_id bigint primary key references private.forecast_contributions(forecast_id) on delete cascade,
  status text not null check (status in ('active','reached','missed','unobserved','superseded')),
  completed integer not null check (completed >= 0),
  due integer not null check (due >= completed),
  planned integer not null check (planned >= due),
  profile_revision bigint not null,
  training_epoch bigint not null,
  training_counter bigint not null
);
alter table private.shared_goal_progress enable row level security;
revoke all on private.shared_goal_progress from public, anon, authenticated;
create index goal_forecasts_maturity on private.goal_forecasts(matures_at);

-- The existing synchronizer authenticates the owner and writer, validates both
-- source revisions, and holds the account lock for this entire transaction.
create function private.forecast_sync_with_shared_progress(
  p_owner uuid,p_capability text,p_profile_revision bigint,p_training_epoch bigint,p_training_counter bigint,
  p_forecast jsonb,p_outcomes jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt jsonb;
begin
  receipt := private.forecast_learning_sync(p_owner,p_capability,p_profile_revision,p_training_epoch,
    p_training_counter,p_forecast,p_outcomes);
  if not (receipt->>'enabled')::boolean then return receipt; end if;

  with snapshot as materialized (
    select f.id,r.status,r.completed,r.due,r.planned
    from jsonb_to_recordset(p_outcomes) as r("planId" uuid,revision bigint,status text,completed integer,due integer,planned integer)
    join private.goal_forecasts f on f.user_id=p_owner and f.plan_id=r."planId" and f.revision=r.revision
    join private.forecast_contributions c on c.forecast_id=f.id
    where r.status in ('active','reached','missed','unobserved','superseded')
      and r.completed>=0 and r.due>=r.completed and r.planned>=r.due
  ), saved as (
    insert into private.shared_goal_progress as old(forecast_id,status,completed,due,planned,
      profile_revision,training_epoch,training_counter)
    select id,status,completed,due,planned,p_profile_revision,p_training_epoch,p_training_counter from snapshot
    on conflict (forecast_id) do update set status=excluded.status,completed=excluded.completed,
      due=excluded.due,planned=excluded.planned,profile_revision=excluded.profile_revision,
      training_epoch=excluded.training_epoch,training_counter=excluded.training_counter
    where (old.status,old.completed,old.due,old.planned,old.profile_revision,old.training_epoch,old.training_counter)
      is distinct from (excluded.status,excluded.completed,excluded.due,excluded.planned,excluded.profile_revision,
        excluded.training_epoch,excluded.training_counter)
  )
  delete from private.shared_goal_progress p using private.forecast_contributions c
    where p.forecast_id=c.forecast_id and c.user_id=p_owner and not exists(select 1 from snapshot s where s.id=p.forecast_id);
  return receipt;
end $$;

create or replace function public.forecast_learning_sync(p_owner uuid,p_capability text,p_profile_revision bigint,
  p_training_epoch bigint,p_training_counter bigint,p_forecast jsonb,p_outcomes jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select private.forecast_sync_with_shared_progress(p_owner,p_capability,p_profile_revision,p_training_epoch,
    p_training_counter,p_forecast,p_outcomes)
$$;

-- Include these stored snapshots in the same owner-scoped export. Keys are
-- unique per goal opening, model and stage. Preserve the existing receipt order.
create function private.own_forecasts_with_shared_progress()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb := private.own_forecast_learning_export();
begin
  return jsonb_set(result,'{forecasts}',coalesce((
    select jsonb_agg(case when s.forecast_id is null then r.receipt else r.receipt || jsonb_build_object(
      'sharedProgress',jsonb_build_object('status',case when s.status='missed' and f.matures_at>statement_timestamp()
        then 'active' else s.status end,'completed',s.completed,'due',s.due,
      'planned',s.planned,'profileRevision',s.profile_revision,'trainingEpoch',s.training_epoch,
      'trainingCounter',s.training_counter)) end order by r.position)
    from jsonb_array_elements(result->'forecasts') with ordinality as r(receipt,position)
    join private.goal_forecasts f on f.user_id=auth.uid() and f.plan_id=(r.receipt->>'planId')::uuid
      and f.revision=(r.receipt->>'revision')::bigint and f.kind=r.receipt->>'kind' and f.model_version=r.receipt->>'version'
    left join private.shared_goal_progress s on s.forecast_id=f.id
  ),'[]'::jsonb));
end $$;

create or replace function public.own_forecast_learning_export()
returns jsonb language sql stable security invoker set search_path='' as $$
  select private.own_forecasts_with_shared_progress()
$$;

create function private.admin_goal_report(p_days integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  as_of timestamptz := statement_timestamp();
  since timestamptz;
  report jsonb;
begin
  perform private.require_journey_operator();
  if p_days is null or p_days not in (7,30,90) then
    raise exception 'Unsupported reporting period' using errcode='22023';
  end if;
  since := ((as_of at time zone 'UTC')::date - (p_days-1))::timestamp at time zone 'UTC';

  -- Put early successes and last-day misses in the same elapsed-deadline
  -- cohort. Edits invalidate a cached replay until its owner reconciles it.
  with receipts as materialized (
    select f.metric,f.goal_unit,f.opening_event,f.user_id,f.id,f.issued_at,f.kind,f.model_version,f.issued_probability,
      o.reached as scored_outcome,
      o.remaining_due>0 and o.remaining_completed=o.remaining_due as followed_remaining_plan,
      coalesce(s.status,case when o.reached then 'reached' when not o.reached then 'missed' end) as status,
      coalesce(s.completed,o.completed) as completed,
      -- Every scheduled slot is due at maturity for an unchanged open plan.
      -- A reached or superseded plan stops at its recorded resolution.
      case when s.status in ('active','unobserved','missed') then s.planned else coalesce(s.due,o.due) end as due
    from private.goal_forecasts f
    join private.forecast_contributions c on c.forecast_id=f.id
    left join public.profiles p on p.id=f.user_id
    left join public.training_state t on t.user_id=f.user_id
    left join private.shared_goal_progress s on s.forecast_id=f.id and s.profile_revision=coalesce(p.revision,0)
      and s.training_epoch=t.epoch and s.training_counter=t.counter
    left join private.forecast_outcomes o on o.forecast_id=f.id and o.resolved_at<=as_of and o.available_at<=as_of
      and o.profile_revision=coalesce(p.revision,0) and o.training_epoch=t.epoch and o.training_counter=t.counter
    where f.matures_at between since and as_of
  ), attempts as (
    select distinct on (opening_event) * from receipts
    order by opening_event,(status is null),(scored_outcome is null),issued_at,id
  ), metrics as (
    select metric,goal_unit,count(distinct user_id) as users,count(*) as attempts,
      count(distinct user_id) filter(where status='reached') as reached_users,
      count(*) filter(where status='reached') as reached,count(*) filter(where status='missed') as missed,
      count(*) filter(where status is null or status in ('active','unobserved')) as unknown,
      count(*) filter(where status='superseded') as superseded,
      count(completed) as adherence_attempts,coalesce(sum(completed),0) as completed,coalesce(sum(due),0) as due
    from attempts group by metric,goal_unit
  ), errors as (
    select *,scored_outcome::integer as actual,scored_outcome::integer-issued_probability as error
    from receipts
  ), stages as (
    select metric,goal_unit,kind,model_version,count(*) as forecasts,count(actual) as observed,
      count(actual) filter(where followed_remaining_plan) as scored,
      avg(issued_probability) filter(where followed_remaining_plan and actual is not null) as predicted,
      avg(actual) filter(where followed_remaining_plan) as actual,
      100*avg(error) filter(where followed_remaining_plan) as gap,
      avg(power(error,2)) filter(where followed_remaining_plan) as brier,
      avg(issued_probability) filter(where actual is not null) as observed_predicted,
      avg(actual) as observed_actual,100*avg(error) as observed_gap,avg(power(error,2)) as observed_brier
    from errors group by metric,goal_unit,kind,model_version
  ), stage_reports as (
    select metric,goal_unit,jsonb_agg(jsonb_build_object(
      'kind',kind,'modelVersion',model_version,'forecasts',forecasts,'observed',observed,'scored',scored,
      'predicted',predicted,'actual',actual,'gapPoints',gap,'brier',brier,'observedPredicted',observed_predicted,
      'observedActual',observed_actual,'observedGapPoints',observed_gap,'observedBrier',observed_brier
    ) order by kind,model_version) as stages from stages group by metric,goal_unit
  )
  select jsonb_build_object('metrics',coalesce(jsonb_agg(jsonb_build_object(
    'metric',m.metric,'goalUnit',m.goal_unit,'users',m.users,'attempts',m.attempts,'reachedUsers',m.reached_users,
    'reached',m.reached,'missed',m.missed,'unknown',m.unknown,'superseded',m.superseded,
    'adherenceAttempts',m.adherence_attempts,'completed',m.completed,'due',m.due,'stages',sr.stages
  ) order by m.metric,m.goal_unit),'[]'::jsonb)) into report
  from metrics m join stage_reports sr using(metric,goal_unit);
  return report;
end $$;

create function public.admin_goal_report(p_days integer)
returns jsonb language sql stable security invoker set search_path='' as $$ select private.admin_goal_report(p_days) $$;

revoke all on function private.forecast_sync_with_shared_progress(uuid,text,bigint,bigint,bigint,jsonb,jsonb),
  private.own_forecasts_with_shared_progress(),private.admin_goal_report(integer),public.admin_goal_report(integer)
  from public,anon,authenticated;
grant execute on function private.forecast_sync_with_shared_progress(uuid,text,bigint,bigint,bigint,jsonb,jsonb),
  private.own_forecasts_with_shared_progress(),private.admin_goal_report(integer),public.admin_goal_report(integer)
  to authenticated;
commit;
