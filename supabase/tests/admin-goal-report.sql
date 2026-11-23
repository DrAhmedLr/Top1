begin;
insert into auth.users(id,email,email_confirmed_at) values
  ('99000000-0000-4000-8000-000000000010','drahmedlr@gmail.com',now());
insert into private.usage_operators values('99000000-0000-4000-8000-000000000010');
insert into private.forecast_writer values(true,sha256(convert_to(repeat('c',64),'UTF8')));

create temporary table goal_fixture as
select n, md5('report-plan-'||n)::uuid plan,md5('report-person-'||owner_no)::uuid person,probability,completed,due,planned
from (values (1,1,.8,1,2,4),(2,1,.4,2,2,3),(3,2,.2,1,3,3),(4,2,.7,3,3,3),(5,3,.6,2,3,6),
  (6,1,.4,1,2,5),(7,4,.6,0,1,2),(8,4,.5,1,1,1),(9,4,.9,1,1,4),(10,4,.65,1,1,1))
  as seed(n,owner_no,probability,completed,due,planned);
insert into auth.users(id) select distinct person from goal_fixture;
insert into public.training_state(user_id,counter) select distinct person,1 from goal_fixture;
insert into public.training_events(user_id,kind,entity_id,revision,request_id,mutation,source)
select person,'program',plan,1,gen_random_uuid(),
  '{"data":{"version":1,"name":"Fixture","notes":"","timeZone":"UTC","archived":false,"sessions":[]}}','personal'
from goal_fixture;
insert into private.forecast_consent select distinct person from goal_fixture;
insert into private.goal_forecasts(user_id,opening_event,plan_id,revision,metric,goal_unit,target,deadline,time_zone,
  matures_at,issued_at,model_version,kind,probability,issued_probability,horizon_days,relative_gap)
select g.person,e.sequence,g.plan,1,'pushups',case when n=10 then 'kg' else 'metric' end,20,days.maturity::date-1,
  'UTC',days.maturity,days.maturity-interval '15 days','fixture-v1',stage.kind,.01,
  case when stage.kind='personal' then .9 else g.probability end,15,.25
from goal_fixture g join public.training_events e on e.entity_id=g.plan
cross join lateral (select ((now() at time zone 'UTC')::date +
  case n when 8 then -19 when 9 then 2 else -1 end)::timestamp at time zone 'UTC' maturity) days
cross join (values ('illustrative'),('personal')) stage(kind) where stage.kind='illustrative' or n=1;
insert into private.forecast_contributions
select f.user_id,f.id from private.goal_forecasts f join goal_fixture g on g.plan=f.plan_id where n<>7;
insert into private.forecast_outcomes(forecast_id,reached,measured_at,resolved_at,completed,due,planned,
  profile_revision,training_epoch,training_counter,available_at,remaining_due,remaining_completed)
select f.id,n<>3,least(now()-interval '1 hour',f.matures_at-interval '1 hour'),
  least(now()-interval '1 hour',f.matures_at),g.completed,g.due,g.planned,0,0,case n when 4 then 0 else 1 end,
  now()-interval '1 hour',case when n=10 then 0 when f.kind='personal' then 1 else g.due end,
  case n when 10 then 0 else g.completed end
from private.goal_forecasts f join goal_fixture g on g.plan=f.plan_id where n not in (5,6);
insert into private.shared_goal_progress
select f.id,'superseded',g.completed,g.due,g.planned,0,0,1
from private.goal_forecasts f join goal_fixture g on g.plan=f.plan_id where n=6;

-- An owner can persist attendance for an open plan with no retest. The
-- snapshot is available in their export, and its scheduled slots mature
-- without another visit. A repeated reconciliation is idempotent.
select set_config('request.jwt.claims',jsonb_build_object('sub',person)::text,true) from goal_fixture where n=5;
create function pg_temp.test_replay() returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('planId',md5('report-plan-5')::uuid,'revision',1,
    'status','active','completed',2,'due',3,'planned',6))
$$;
set local role authenticated;
select public.forecast_learning_sync(auth.uid(),repeat('c',64),0,0,1,null,pg_temp.test_replay());
select public.forecast_learning_sync(auth.uid(),repeat('c',64),0,0,1,null,pg_temp.test_replay());
do $$begin
  if public.own_forecast_learning_export() #>> '{forecasts,0,sharedProgress,planned}' is distinct from '6' then
    raise exception 'Contributing account cannot export stored attendance'; end if;
  begin perform public.admin_goal_report(7);raise exception 'Non-operator read shared results';
    exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"99000000-0000-4000-8000-000000000010"}',true);
do $$declare m jsonb; initial jsonb; personal jsonb; report jsonb; begin
  report:=public.admin_goal_report(7);
  if jsonb_array_length(report->'metrics')<>2 then raise exception 'Mixed goal units or lost rows'; end if;
  select value into m from jsonb_array_elements(report->'metrics') where value->>'goalUnit'='kg';
  if m #>> '{stages,0,scored}' is distinct from '0' or m #> '{stages,0,brier}' is distinct from 'null'::jsonb
    or m #>> '{stages,0,observed}' is distinct from '1' then raise exception 'Empty conditional scores misrepresented'; end if;
  select value into m from jsonb_array_elements(report->'metrics') where value->>'goalUnit'='metric';
  if (m-'stages') is distinct from '{"metric":"pushups","goalUnit":"metric","users":3,"attempts":6,"reachedUsers":1,
    "reached":2,"missed":1,"unknown":2,"superseded":1,"adherenceAttempts":5,"completed":7,"due":15}'::jsonb then
    raise exception 'Incorrect person/attempt counts, maturity, stale evidence, or attendance: %',m;
  end if;
  select value into initial from jsonb_array_elements(m->'stages') where value->>'kind'='illustrative';
  select value into personal from jsonb_array_elements(m->'stages') where value->>'kind'='personal';
  if (initial->>'forecasts')::int<>6 or (initial->>'observed')::int<>3 or (initial->>'scored')::int<>1
    or (initial->>'predicted')::numeric<>.4 or (initial->>'actual')::numeric<>1 or (initial->>'gapPoints')::numeric<>60
    or (initial->>'brier')::numeric<>.36 or round((initial->>'observedPredicted')::numeric,3)<>.467
    or round((initial->>'observedActual')::numeric,3)<>.667 or round((initial->>'observedGapPoints')::numeric,2)<>20
    or round((initial->>'observedBrier')::numeric,3)<>.147 or (personal->>'scored')::int<>1
    or (personal->>'predicted')::numeric<>.9 or (personal->>'brier')::numeric<>.01 then
    raise exception 'Incorrect as-issued vs actual stage scoring: %, %',initial,personal;
  end if;
  select value into m from jsonb_array_elements(public.admin_goal_report(30)->'metrics') where value->>'goalUnit'='metric';
  if (m->>'attempts')::integer<>7 then raise exception 'Reporting window ignored'; end if;
  begin perform public.admin_goal_report(1);raise exception 'Arbitrary time window accepted';
    exception when invalid_parameter_value then null;end;
  begin perform public.admin_goal_report(null);raise exception 'Null time window accepted';
    exception when invalid_parameter_value then null;end;
end $$;

reset role;
-- A source change invalidates an attendance snapshot until a new trusted
-- replay. Withdrawal deletes shared attendance and removes those attempts.
update public.training_state set counter=2 where user_id=(select person from goal_fixture where n=5);
set local role authenticated;
do $$declare m jsonb;begin
  select value into m from jsonb_array_elements(public.admin_goal_report(7)->'metrics') where value->>'goalUnit'='metric';
  if (m->>'adherenceAttempts')::int<>4 or (m->>'due')::int<>9 then raise exception 'Stale attendance counted'; end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',md5('report-person-3')::uuid)::text,true);
select public.forecast_learning_preference(auth.uid(),false);
select set_config('request.jwt.claims','{"sub":"99000000-0000-4000-8000-000000000010"}',true);
do $$declare m jsonb;begin
  select value into m from jsonb_array_elements(public.admin_goal_report(7)->'metrics') where value->>'goalUnit'='metric';
  if (m->>'users')::int<>2 or (m->>'attempts')::int<>5 then raise exception 'Withdrawal left member in cohort'; end if;
  if public.own_forecast_learning_export()<>'{"enabled":false,"forecasts":[]}' then raise exception 'Operator export leaked'; end if;
end $$;
reset role;
update auth.users set email='different@example.invalid' where id='99000000-0000-4000-8000-000000000010';
set local role authenticated;
do $$begin
  begin perform public.admin_goal_report(7);raise exception 'Grant with changed email retained operator access';
    exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin
  if has_function_privilege('anon','public.admin_goal_report(integer)','execute')
    or has_table_privilege('authenticated','private.shared_goal_progress','select,insert,update,delete,truncate')
    or not (select relrowsecurity from pg_class where oid='private.shared_goal_progress'::regclass)
    or exists(select 1 from private.shared_goal_progress s join private.goal_forecasts f on f.id=s.forecast_id
      where f.user_id=md5('report-person-3')::uuid)
  then raise exception 'Shared attendance privacy failure'; end if;
end $$;
rollback;
