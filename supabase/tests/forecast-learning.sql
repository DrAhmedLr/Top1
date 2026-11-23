begin;
insert into auth.users(id,email) values
  ('40000000-0000-4000-8000-000000000001','forecast-fixture@example.invalid'),
  ('40000000-0000-4000-8000-000000000002','second-forecast-fixture@example.invalid');
insert into private.forecast_writer(capability_sha256) values(sha256(convert_to(repeat('a',64),'UTF8')));
insert into public.training_events(user_id,kind,entity_id,revision,request_id,mutation,source) values
  ('40000000-0000-4000-8000-000000000001','program','41000000-0000-4000-8000-000000000001',1,gen_random_uuid(),
  '{"data":{"version":1,"name":"Fixture","notes":"","timeZone":"UTC","archived":false,"sessions":[]}}','personal');
insert into public.training_state (user_id,counter) values('40000000-0000-4000-8000-000000000001',1);
create function pg_temp.issue(kind text, probability numeric) returns jsonb language sql as $$
  select jsonb_build_object('planId','41000000-0000-4000-8000-000000000001','revision',1,'metric','pushups',
    'goalUnit','metric','target',30,'deadline',(statement_timestamp() at time zone 'UTC')::date,
    'timeZone','UTC','version','test-outcome-v1','kind',kind,'probability',probability,
    'issuedProbability',probability+0.01,'relativeGap',0.23,'horizonDays',7)
$$;
create function pg_temp.replay(status text,measured timestamptz,resolved timestamptz) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('planId','41000000-0000-4000-8000-000000000001',
    'revision',1,'status',status,'measuredAt',measured,'resolvedAt',resolved,
    'baselineRecordedAt',statement_timestamp()-interval '4 days','completed',3,'due',3,'planned',4))
$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ declare result jsonb; begin
  begin perform public.forecast_learning_sync(auth.uid(),repeat('b',64),0,0,1,pg_temp.issue('illustrative',0.33),'[]');
    raise exception 'Untrusted writer'; exception when insufficient_privilege then null; end;
  begin perform public.forecast_learning_preference('40000000-0000-4000-8000-000000000002',true);
    raise exception 'Spoofed consent'; exception when insufficient_privilege then null; end;
  begin perform public.forecast_learning_sync(auth.uid(),repeat('a',64),0,0,0,null,'[]');
    raise exception 'Stale writer'; exception when sqlstate 'PT409' then null; end;
  begin perform public.forecast_learning_evidence(auth.uid(),null,'pushups','metric','test-outcome-v1','personal',7,0.23,0.66);
    raise exception 'Untrusted pooled evidence'; exception when insufficient_privilege then null; end;
  result:=public.forecast_learning_sync(auth.uid(),repeat('a',64),0,0,1,pg_temp.issue('illustrative',0.33),'[]');
  if (result-'firstForecasts')<>'{"enabled":false,"captured":true}' or result #>> '{firstForecasts,0,probability}'<>'0.34' then raise exception 'Private snapshot failed'; end if;
  perform public.forecast_learning_preference(auth.uid(),true);
  perform public.forecast_learning_sync(auth.uid(),repeat('a',64),0,0,1,pg_temp.issue('illustrative',0.26),'[]');
  perform public.forecast_learning_sync(auth.uid(),repeat('a',64),0,0,1,pg_temp.issue('personal',0.66),'[]');
  result:=public.own_forecast_learning_export();
  if result #>> '{forecasts,0,contributing}' <> 'true' or result #>> '{forecasts,1,contributing}' <> 'false'
    or (result #>> '{forecasts,1,probability}')::numeric<>0.33 or (result #>> '{forecasts,1,issuedProbability}')::numeric<>0.34
    or jsonb_array_length(result->'forecasts')<>2 then raise exception 'Snapshot replacement or retrospective sharing'; end if;
end $$;

-- Move fixture issuance into the past so a later trusted callback can stage the
-- final-day result. Only the database owner can alter these fixture timestamps.
reset role;
update private.goal_forecasts set issued_at=statement_timestamp()-interval '2 days';
set local role authenticated;
do $$declare result jsonb; begin
  perform public.forecast_learning_sync(auth.uid(),repeat('a',64),0,0,1,null,
    pg_temp.replay('reached',statement_timestamp()-interval '3 days',statement_timestamp()));
  if public.own_forecast_learning_export() #> '{forecasts,0,outcome}' <> 'null' then raise exception 'Retrospective sample'; end if;
  perform public.forecast_learning_sync(auth.uid(),repeat('a',64),0,0,1,null,
    jsonb_set(pg_temp.replay('reached',statement_timestamp(),statement_timestamp()),'{0,baselineRecordedAt}',to_jsonb(statement_timestamp())));
  if public.own_forecast_learning_export() #> '{forecasts,0,outcome}' <> 'null' then raise exception 'Backfilled baseline accepted'; end if;
  perform public.forecast_learning_sync(auth.uid(),repeat('a',64),0,0,1,null,
    pg_temp.replay('missed',statement_timestamp(),(((statement_timestamp() at time zone 'UTC')::date+1)::timestamp at time zone 'UTC')));
  if public.own_forecast_learning_export() #> '{forecasts,0,outcome}' <> 'null' then raise exception 'Premature miss reported'; end if;
end $$;
reset role;
do $$begin if (select count(*) from private.forecast_outcomes where not reached)<>2 then raise exception 'Deadline-day miss lost'; end if;end $$;
set local role authenticated;
do $$begin
  perform public.forecast_learning_sync(auth.uid(),repeat('a',64),0,0,1,null,
    pg_temp.replay('reached',statement_timestamp(),statement_timestamp()));
  if public.own_forecast_learning_export() #>> '{forecasts,0,outcome,status}' is distinct from 'reached' then raise exception 'Correction lost'; end if;
  if public.own_forecast_learning_export() #> '{forecasts,0,outcome,afterIssue}' is distinct from 'null'::jsonb then
    raise exception 'Missing post-issue counts inferred from total attendance'; end if;
  declare receipts jsonb:=public.own_forecast_learning_export()->'forecasts'; good jsonb; bad jsonb; outcome jsonb;
  begin
    good:=jsonb_build_object('kind',receipts->0->'kind','version',receipts->0->'version',
      'issuedAt',receipts->0->'issuedAt','due',2,'completed',2);
    outcome:=jsonb_set(pg_temp.replay('reached',statement_timestamp(),statement_timestamp()),'{0,completed}','2');
    perform public.forecast_learning_sync(auth.uid(),repeat('a',64),0,0,1,null,
      jsonb_set(outcome,'{0,afterIssue}',jsonb_build_array(good)));
    receipts:=public.own_forecast_learning_export()->'forecasts';
    if receipts #> '{0,outcome,afterIssue}' is distinct from '{"due":2,"completed":2}'::jsonb or
      receipts #> '{1,outcome,afterIssue}' is distinct from 'null'::jsonb then
      raise exception 'Post-issue attendance mixed stages'; end if;
    foreach bad in array array[jsonb_build_array(good,good),jsonb_build_array(good||'{"version":"other"}'),
      jsonb_build_array(good||'{"issuedAt":"unparseable"}'),jsonb_build_array(good||'{"due":"2"}'),
      jsonb_build_array(good||'{"completed":3}'),jsonb_build_array(good||'{"due":10}'),'"invalid"'::jsonb] loop
      perform public.forecast_learning_sync(auth.uid(),repeat('a',64),0,0,1,null,jsonb_set(outcome,'{0,afterIssue}',bad));
      receipts:=public.own_forecast_learning_export()->'forecasts';
      if receipts #> '{0,outcome,afterIssue}' is distinct from 'null'::jsonb or receipts #>> '{0,outcome,status}' is distinct from 'reached' then
        raise exception 'Invalid receipt match changed private outcome or fabricated adherence'; end if;
    end loop;
  end;
  perform public.forecast_learning_sync(auth.uid(),repeat('a',64),0,0,1,null,'[]');
  if public.own_forecast_learning_export() #> '{forecasts,0,outcome}' <> 'null' then raise exception 'Stale label retained'; end if;
  perform public.forecast_learning_preference(auth.uid(),false);
  perform public.forecast_learning_preference(auth.uid(),true);
  perform public.forecast_learning_sync(auth.uid(),repeat('a',64),0,0,1,pg_temp.issue('personal',0.44),'[]');
  if public.own_forecast_learning_export() #>> '{forecasts,0,contributing}' <> 'false' then raise exception 'Revoked sample restored'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$begin
  if public.own_forecast_learning_export()<>'{"enabled":false,"forecasts":[]}' then raise exception 'Export crossed accounts'; end if;
  if public.forecast_learning_evidence(auth.uid(),repeat('a',64),'pushups','metric','test-outcome-v1','personal',7,0.23,0.66)
    <> '{"training":null,"validation":null}' then raise exception 'Small cohort leaked'; end if;
end $$;
reset role;
do $$declare t regclass;begin
  foreach t in array array['private.forecast_writer'::regclass,'private.goal_forecasts'::regclass,'private.forecast_consent'::regclass,
    'private.forecast_contributions'::regclass,'private.forecast_outcomes'::regclass] loop
    if has_table_privilege('anon',t,'select,insert,update,delete,truncate') or has_table_privilege('authenticated',t,'select,insert,update,delete,truncate')
      or not(select relrowsecurity from pg_class where oid=t) then raise exception 'Direct table access to %',t; end if;
  end loop;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000001","is_anonymous":true}',true);
do $$begin
  begin perform public.own_forecast_learning_export();raise exception 'Anonymous export';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000001","session_id":"40000000-0000-4000-8000-000000000002"}',true);
do $$begin
  begin perform public.forecast_learning_preference(auth.uid(),true);raise exception 'Revoked session sharing';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Exercise erasure without requiring a subsequent refresh or a worker.
insert into public.profiles(id) values('40000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.purge_history_with_training('pushups',(select revision from public.profiles where id=auth.uid()));
do $$begin if public.own_forecast_learning_export()->'forecasts'<>'[]' then raise exception 'Metric purge retained forecast'; end if;end $$;
reset role;
insert into public.training_events(user_id,kind,entity_id,revision,request_id,mutation,source)
  select user_id,kind,entity_id,2,gen_random_uuid(),mutation,source from public.training_events
    where user_id='40000000-0000-4000-8000-000000000001' and revision=1;
set local role authenticated;
do $$declare result jsonb;begin
  result:=public.forecast_learning_sync(auth.uid(),repeat('a',64),(select revision from public.profiles where id=auth.uid()),
    0,1,pg_temp.issue('illustrative',0.33)||'{"revision":2}', '[]');
  if result->>'captured'<>'true' then raise exception 'Fresh goal failed after metric purge'; end if;
end $$;
reset role;
delete from auth.users where id='40000000-0000-4000-8000-000000000001';
do $$begin
  if exists(select 1 from private.goal_forecasts) or exists(select 1 from private.forecast_contributions)
    or exists(select 1 from private.forecast_outcomes) or exists(select 1 from private.forecast_consent) then
    raise exception 'Account cascade incomplete'; end if;
end $$;
-- Fixed, chronological synthetic cohort. Its training labels come from before
-- the validation forecasts were issued. Each contributor supplies one attempt.
create temporary table calibration_people as
  select n,gen_random_uuid() as person, gen_random_uuid() as plan,
    statement_timestamp()-(160-n)*interval '1 day' as issued from generate_series(1,100) n;
insert into auth.users(id) select person from calibration_people;
insert into public.training_events(user_id,kind,entity_id,revision,request_id,mutation,source)
  select person,'program',plan,1,gen_random_uuid(),
    '{"data":{"version":1,"name":"Fixture","notes":"","timeZone":"UTC","archived":false,"sessions":[]}}','personal'
  from calibration_people;
insert into public.training_state(user_id,counter) select person,1 from calibration_people;
insert into private.forecast_consent select person from calibration_people;
insert into private.goal_forecasts(user_id,opening_event,plan_id,revision,metric,goal_unit,target,deadline,time_zone,
  matures_at,issued_at,model_version,kind,probability,issued_probability,horizon_days,relative_gap)
  select person,e.sequence,plan,1,'pushups','metric',20,(issued at time zone 'UTC')::date+1,'UTC',
    issued+interval '2 days',issued,'test-outcome-v1','personal',0.66,0.66,7,0.23
  from calibration_people cp join public.training_events e on cp.person=e.user_id;
insert into private.forecast_contributions select user_id,id from private.goal_forecasts;
insert into private.forecast_outcomes(forecast_id,reached,measured_at,resolved_at,completed,due,planned,
  profile_revision,training_epoch,training_counter,available_at,remaining_due,remaining_completed)
  select f.id,n%2=0,issued+interval '1 day',issued+interval '2 days',3,3,3,0,0,1,issued+interval '2 days',2,2
  from private.goal_forecasts f join calibration_people cp on f.user_id=cp.person;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$declare evidence jsonb;begin
  evidence:=public.forecast_learning_evidence(auth.uid(),repeat('a',64),'pushups','metric','test-outcome-v1','personal',7,0.23,0.66);
  if (evidence #>> '{training,participants}')::integer is distinct from 67
    or (evidence #>> '{validation,participants}')::integer is distinct from 31
    or (evidence #>> '{training,reached}')::integer<>33 or (evidence #>> '{validation,reached}')::integer<>16
    or abs((evidence #>> '{validation,expected}')::numeric-20.46)>0.00001
    then raise exception 'Wrong chronological calibration split: %',evidence; end if;
  if public.forecast_learning_evidence(auth.uid(),repeat('a',64),'pushups','metric','other-version','personal',7,0.23,0.66)
    <>'{"training":null,"validation":null}' then raise exception 'Mixed model versions'; end if;
end $$;
reset role;
-- Follow-up uses all mature consenting people. The missing ten retests leave
-- 21 observed validation participants (still above the per-partition privacy
-- floor) but below the 70% minimum observed follow-up rate.
savepoint complete_cohort;
delete from private.forecast_outcomes o using private.goal_forecasts f,calibration_people cp
  where o.forecast_id=f.id and f.user_id=cp.person and cp.n between 71 and 80;
set local role authenticated;
do $$begin if public.forecast_learning_evidence(auth.uid(),repeat('a',64),'pushups','metric','test-outcome-v1','personal',7,0.23,0.66)
  <>'{"training":null,"validation":null}' then raise exception 'Insufficient follow-up accepted'; end if;end $$;
reset role;
rollback to savepoint complete_cohort;
-- Partially adherent people still count as observed for follow-up. Only fully
-- adherent examples enter the conditional probability calculation.
update private.forecast_outcomes o set remaining_completed=1 from private.goal_forecasts f,calibration_people cp
  where o.forecast_id=f.id and f.user_id=cp.person and cp.n between 71 and 80;
set local role authenticated;
do $$declare evidence jsonb;begin
  evidence:=public.forecast_learning_evidence(auth.uid(),repeat('a',64),'pushups','metric','test-outcome-v1','personal',7,0.23,0.66);
  if (evidence #>> '{validation,participants}')::integer is distinct from 21 then raise exception 'Adherence confused with coverage'; end if;
end $$;
reset role;
-- Ten people had already missed one workout before issuance but completed
-- every remaining opportunity. Past absences do not reduce this cohort.
update private.forecast_outcomes o set completed=2,remaining_completed=2 from private.goal_forecasts f,calibration_people cp
  where o.forecast_id=f.id and f.user_id=cp.person and cp.n between 71 and 80;
set local role authenticated;
do $$declare evidence jsonb;begin
  evidence:=public.forecast_learning_evidence(auth.uid(),repeat('a',64),'pushups','metric','test-outcome-v1','personal',7,0.23,0.66);
  if (evidence #>> '{validation,participants}')::integer is distinct from 31 then raise exception 'Pre-issue absence censored remaining-schedule result'; end if;
end $$;
reset role;
-- Completing workouts before issue cannot supply a post-issue exposure.
update private.forecast_outcomes o set remaining_due=0,remaining_completed=0 from private.goal_forecasts f,calibration_people cp
  where o.forecast_id=f.id and f.user_id=cp.person and cp.n between 71 and 80;
set local role authenticated;
do $$declare evidence jsonb;begin
  evidence:=public.forecast_learning_evidence(auth.uid(),repeat('a',64),'pushups','metric','test-outcome-v1','personal',7,0.23,0.66);
  if (evidence #>> '{validation,participants}')::integer is distinct from 21 then raise exception 'Included zero post-issue opportunities'; end if;
end $$;
reset role;
-- All participants become stale when an unprocessed measurement changes their profile revisions.
insert into public.profiles(id,revision) select person,1 from calibration_people;
set local role authenticated;
do $$begin if public.forecast_learning_evidence(auth.uid(),repeat('a',64),'pushups','metric','test-outcome-v1','personal',7,0.23,0.66)
  <>'{"training":null,"validation":null}' then raise exception 'Pooled stale outcomes'; end if;end $$;
reset role;
rollback;
