begin;
insert into auth.users(id,email) values('10000000-0000-4000-8000-000000000081','weight-owner@example.invalid'),('10000000-0000-4000-8000-000000000082','weight-other@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000081","role":"authenticated"}',true);
select public.write_bodyweight('20000000-0000-4000-8000-000000000081','30000000-0000-4000-8000-000000000081',0,'save',80,'kg','2026-10-01T12:00:00Z','UTC');
select public.write_bodyweight('20000000-0000-4000-8000-000000000081','30000000-0000-4000-8000-000000000081',0,'save',80,'kg','2026-10-01T12:00:00Z','UTC');
do $$begin
 if (select count(*) from public.bodyweight_events)<>1 then raise exception 'Retry duplicated weight';end if;
 begin perform public.write_bodyweight('20000000-0000-4000-8000-000000000081','30000000-0000-4000-8000-000000000083',0,'save',79,'kg','2026-10-01T12:00:00Z','UTC');raise exception 'Conflict accepted';exception when sqlstate 'PT409' then null;end;
 begin insert into public.bodyweight_events(user_id,entry_id,request_id,revision,kg,entered_value,unit,measured_at,time_zone,action)values(auth.uid(),gen_random_uuid(),gen_random_uuid(),1,80,80,'kg',now(),'UTC','save');raise exception 'Direct insert accepted';exception when insufficient_privilege then null;end;
end $$;
select public.write_bodyweight('20000000-0000-4000-8000-000000000081','30000000-0000-4000-8000-000000000084',1,'save',176.36981,'lb','2026-10-01T11:00:00-01:00','UTC');
select public.write_bodyweight('20000000-0000-4000-8000-000000000082','30000000-0000-4000-8000-000000000085',0,'save',80,'kg','2026-10-02T12:00:00Z','Africa/Casablanca');
do $$declare p jsonb;begin
 p:=public.read_bodyweight_page(null,null,false,1);
 if (p->>'total')::int<>2 or jsonb_array_length(p->'entries')<>1 or p->'next'='null' then raise exception 'Pagination or repeated weight failed';end if;
 if (p->'entries'->0->>'id')<>'20000000-0000-4000-8000-000000000082' then raise exception 'Date order incorrect';end if;
 if (select count(*) from public.bodyweight_events)<>3 then raise exception 'Correction did not retain original';end if;
 if (public.read_bodyweight_page((p->'next'->>'date')::timestamptz,(p->'next'->>'id')::uuid,false,1)->'entries'->0->>'revision')::int<>2 then raise exception 'Correction revision missing';end if;
end $$;
select public.write_bodyweight('20000000-0000-4000-8000-000000000082','30000000-0000-4000-8000-000000000086',1,'delete');
do $$begin if (public.read_bodyweight_page()->>'total')::int<>1 then raise exception 'Soft delete failed';end if;end $$;
select public.write_bodyweight('20000000-0000-4000-8000-000000000082','30000000-0000-4000-8000-000000000087',2,'restore');
select public.import_bodyweight('[{"id":"20000000-0000-4000-8000-000000000083","value":78,"unit":"kg","measuredAt":"2026-10-03T12:00:00Z","timeZone":"UTC"}]');
select public.import_bodyweight('[{"id":"20000000-0000-4000-8000-000000000083","value":99,"unit":"kg","measuredAt":"2026-10-03T12:00:00Z","timeZone":"UTC"}]');
do $$begin if (public.read_bodyweight_page()->>'total')::int<>3 then raise exception 'Guest import duplicated';end if;end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000081","role":"authenticated","is_anonymous":true}',true);
do $$begin
 if exists(select 1 from public.bodyweight_events) then raise exception 'Anonymous session reads weights';end if;
 begin perform public.write_bodyweight(gen_random_uuid(),gen_random_uuid(),0,'save',80,'kg',now(),'UTC');raise exception 'Anonymous session writes weights';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000082","role":"authenticated"}',true);
do $$begin if exists(select 1 from public.bodyweight_events) or (public.read_bodyweight_page()->>'total')::int<>0 then raise exception 'Other account sees weights';end if;end $$;
select public.write_bodyweight('20000000-0000-4000-8000-000000000081','30000000-0000-4000-8000-000000000081',0,'save',95,'kg','2026-10-01T12:00:00Z','UTC');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000081","role":"authenticated"}',true);
select public.save_profile('{"age":30,"sex":"male","weight":90}','{"pushups":25}',null,false,'{}','{"pushups":{"method":"manual","measuredAt":"2026-10-04T12:00:00Z","ageAtMeasurement":30,"protocol":{"id":"strict_pushups_v1"}}}',0);
do $$declare before_profile jsonb; before_logs jsonb; before_assessments jsonb;begin
 select to_jsonb(p) into before_profile from public.profiles p where id=auth.uid();
 select jsonb_agg(to_jsonb(l) order by l.id) into before_logs from public.metric_logs l;
 select jsonb_agg(to_jsonb(a) order by a.user_id,a.revision) into before_assessments from public.profile_revisions a;
 if before_logs is null or before_assessments is null then raise exception 'Fitness preservation fixture is empty';end if;
 perform public.purge_history_with_bodyweight('bodyweight',(before_profile->>'revision')::bigint);
 if before_profile is distinct from (select to_jsonb(p) from public.profiles p where id=auth.uid())
 or before_logs is distinct from (select jsonb_agg(to_jsonb(l) order by l.id) from public.metric_logs l)
 or before_assessments is distinct from (select jsonb_agg(to_jsonb(a) order by a.user_id,a.revision) from public.profile_revisions a)
 then raise exception 'Weight-only purge changed unrelated fitness data';end if;
end $$;
do $$begin
 if exists(select 1 from public.bodyweight_events) then raise exception 'Purge retained owner history';end if;
 if (public.read_bodyweight_page()->>'epoch')::int<>1 then raise exception 'Purge did not advance replay version';end if;
 begin perform public.write_bodyweight('20000000-0000-4000-8000-000000000084','30000000-0000-4000-8000-000000000090',0,'save',80,'kg','2026-10-01T12:00:00Z','UTC');raise exception 'Old offline change recreated purged history';exception when sqlstate 'PT409' then null;end;
end $$;
select public.write_bodyweight('20000000-0000-4000-8000-000000000085','30000000-0000-4000-8000-000000000091',0,'save',80,'kg','2026-10-01T12:00:00Z','UTC',1);
select public.purge_history_with_bodyweight(null,(select revision from public.profiles where id=auth.uid()));
do $$begin if exists(select 1 from public.bodyweight_events) or exists(select 1 from public.metric_logs) then raise exception 'All-history purge missed a series';end if;end $$;
reset role;
do $$begin
 if has_table_privilege('anon','public.bodyweight_events','select') or has_table_privilege('authenticated','public.bodyweight_events','insert') or has_table_privilege('authenticated','public.bodyweight_events','truncate') then raise exception 'Excess weight privilege';end if;
 if (select count(*) from public.bodyweight_events where user_id='10000000-0000-4000-8000-000000000082')<>1 then raise exception 'Purge crossed account';end if;
end $$;
delete from auth.users where id='10000000-0000-4000-8000-000000000082';
do $$begin if exists(select 1 from public.bodyweight_events) then raise exception 'Account cascade left weights';end if;end $$;
rollback;
