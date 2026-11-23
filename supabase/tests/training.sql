begin;
insert into auth.users(id,email) values('10000000-0000-4000-8000-000000000091','training-owner@example.invalid'),('10000000-0000-4000-8000-000000000092','training-other@example.invalid');
insert into public.programs(user_id,plan) values('10000000-0000-4000-8000-000000000091','{"version":1,"focus":"consistency","tasks":[]}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000091","role":"authenticated"}',true);
do $$declare m jsonb:='{"version": 1, "kind": "program", "id": "20000000-0000-4000-8000-000000000001", "requestId": "30000000-0000-4000-8000-000000000001", "expectedRevision": 0, "epoch": 0, "deleted": false, "reason": "", "data": {"version": 1, "name": "Strength plan", "notes": "", "timeZone": "UTC", "archived": false, "sessions": [{"id": "20000000-0000-4000-8000-000000000002", "name": "Push", "weekdays": [1, 4], "exercises": [{"id": "20000000-0000-4000-8000-000000000003", "name": "Bench", "equipment": "Barbell", "notes": "", "sets": [{"id": "20000000-0000-4000-8000-000000000004", "reps": 5, "loadKg": 50}]}]}]}}'::jsonb;
 saved jsonb; w jsonb; change jsonb; result jsonb;begin
 saved:=public.write_training(m);perform public.write_training(m);
 if (select count(*) from public.training_events)<>1 then raise exception 'Training retry duplicated program';end if;
 declare b jsonb; c jsonb; r jsonb;begin
  b:=m||jsonb_build_object('id',gen_random_uuid(),'requestId',gen_random_uuid());
  c:=m||jsonb_build_object('id',gen_random_uuid(),'requestId',gen_random_uuid());
  begin
    perform public.write_training_batch(jsonb_build_array(b,c||'{"expectedRevision":4}'),1);
    raise exception 'Partial stale batch accepted';
  exception when sqlstate 'PT409' then null; end;
  if (select count(*) from public.training_events)<>1 then raise exception 'Partial batch persisted';end if;
  r:=public.write_training_batch(jsonb_build_array(b,c),1);
  if jsonb_array_length(r)<>2 or public.write_training_batch(jsonb_build_array(b,c),1)<>r then raise exception 'Lost-response batch duplicated'; end if;
  begin
    perform public.write_training_batch(jsonb_build_array(m||jsonb_build_object('id',gen_random_uuid(),'requestId',gen_random_uuid())),1);
    raise exception 'Concurrent batch allowed obsolete ledger head';
  exception when sqlstate 'PT409' then null; end;
  raise exception using errcode='PT001';
 exception when sqlstate 'PT001' then null; end;
 begin perform public.write_training(jsonb_set(m,'{data,name}','"Different"'));raise exception 'Altered retry accepted';exception when sqlstate 'PT409' then null;end;
 begin perform public.write_training(jsonb_set(m,'{requestId}',to_jsonb(gen_random_uuid()::text)));raise exception 'Stale revision accepted';exception when sqlstate 'PT409' then null;end;
 if private.valid_training_document('program',(m->'data')-'name') or private.valid_training_document('program',jsonb_set(m->'data','{sessions,0,exercises,0,sets,0,reps}','-1')) then raise exception 'Malformed plan accepted';end if;
 w:=jsonb_build_object('version',1,'name','Push','notes','','timeZone','UTC','startedAt','2026-11-10T08:00:00.000Z','status','in_progress','origin',jsonb_build_object('programId',m->>'id','revision',1,'sessionId','20000000-0000-4000-8000-000000000002'),'snapshot',jsonb_build_object('name','Push','exercises',m->'data'->'sessions'->0->'exercises'),'exercises','[]'::jsonb);
 change:=jsonb_build_object('version',1,'kind','workout','id','20000000-0000-4000-8000-000000000010','requestId',gen_random_uuid(),'expectedRevision',0,'epoch',0,'deleted',false,'reason','','data',w);
 perform public.write_training(change);
 -- Future program edits cannot mutate the stored workout snapshot.
 m:=m||jsonb_build_object('requestId',gen_random_uuid(),'expectedRevision',1,'data',jsonb_set(m->'data','{sessions,0,exercises,0,sets,0,loadKg}','100'));
 perform public.write_training(m);
 if (select mutation->'data'->'snapshot'->'exercises'->0->'sets'->0->>'loadKg' from public.training_events where kind='workout')<>'50' then raise exception 'Plan edit mutated workout';end if;
 begin perform public.write_training(change||jsonb_build_object('requestId',gen_random_uuid(),'expectedRevision',1,'data',jsonb_set(w,'{snapshot,name}','"Rewrite"')));raise exception 'Original context changed';exception when sqlstate '22023' then null;end;
 w:=w||jsonb_build_object('status','completed','endedAt','2026-11-10T09:00:00.000Z','exercises',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'plannedExerciseId','20000000-0000-4000-8000-000000000003','name','Dumbbell bench','notes','','substitutionReason','Barbell busy','status','performed','sets',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'reps',8,'loadKg',20,'completed',true)))));
 change:=change||jsonb_build_object('requestId',gen_random_uuid(),'expectedRevision',1,'data',w);perform public.write_training(change);
 change:=change||jsonb_build_object('requestId',gen_random_uuid(),'expectedRevision',2,'data',w||'{"notes":"Corrected load"}'::jsonb);
 begin perform public.write_training(change);raise exception 'Silent correction accepted';exception when sqlstate '22023' then null;end;
 perform public.write_training(change||'{"reason":"Original entry typo"}'::jsonb);
 if (select count(*) from public.training_events where kind='workout')<>3 then raise exception 'Workout history lost';end if;
 if (public.read_training_page()->>'counter')::int<>5 then raise exception 'Change counter incorrect';end if;
 begin insert into public.training_state(user_id) values(auth.uid());raise exception 'Direct write accepted';exception when insufficient_privilege then null;end;
 -- New imported entities remain separate; repeated imports are idempotent.
 m:=m||jsonb_build_object('id',gen_random_uuid(),'requestId',gen_random_uuid(),'expectedRevision',0);
 perform public.import_training(jsonb_build_array(m),0);perform public.import_training(jsonb_build_array(m),0);
 if (select count(*) from public.training_events)<>6 then raise exception 'Import duplicated';end if;
 -- Import cannot modify an account-created entity, even at the right revision.
 m:=m||jsonb_build_object('id','20000000-0000-4000-8000-000000000001','requestId',gen_random_uuid(),'expectedRevision',2);
 begin perform public.import_training(jsonb_build_array(m),0);raise exception 'Import overwrote account entity';exception when sqlstate 'PT409' then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000092","role":"authenticated"}',true);
do $$begin if exists(select 1 from public.training_events) or jsonb_array_length(public.read_training_page()->'events')<>0 then raise exception 'Training crossed account';end if;end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000091","role":"authenticated","is_anonymous":true}',true);
do $$begin if exists(select 1 from public.training_events) then raise exception 'Anonymous training read';end if;begin perform public.write_training('{}');raise exception 'Anonymous training write';exception when insufficient_privilege then null;end;end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000091","role":"authenticated"}',true);
select public.save_profile('{"age":30,"sex":"male","weight":90}','{"pushups":25}',null,false,'{}','{}',0);
do $$declare profile_before jsonb;begin
 select to_jsonb(p) into profile_before from public.profiles p where id=auth.uid();
 perform public.purge_history_with_training('training',(profile_before->>'revision')::bigint);
 if profile_before is distinct from (select to_jsonb(p) from public.profiles p where id=auth.uid()) or not exists(select 1 from public.metric_logs) or not exists(select 1 from public.programs) then raise exception 'Training purge changed measurements or legacy routines';end if;
end $$;
do $$begin
 if exists(select 1 from public.training_events) or (public.read_training_page()->>'epoch')::int<>1 then raise exception 'Training purge failed';end if;
 begin perform public.write_training('{"version": 1, "kind": "program", "id": "20000000-0000-4000-8000-000000000001", "requestId": "30000000-0000-4000-8000-000000000001", "expectedRevision": 0, "epoch": 0, "deleted": false, "reason": "", "data": {"version": 1, "name": "Strength plan", "notes": "", "timeZone": "UTC", "archived": false, "sessions": [{"id": "20000000-0000-4000-8000-000000000002", "name": "Push", "weekdays": [1, 4], "exercises": [{"id": "20000000-0000-4000-8000-000000000003", "name": "Bench", "equipment": "Barbell", "notes": "", "sets": [{"id": "20000000-0000-4000-8000-000000000004", "reps": 5, "loadKg": 50}]}]}]}}'::jsonb);raise exception 'Offline replay resurrected purged training';exception when sqlstate 'PT409' then null;end;
end $$;
do $$declare m jsonb:='{"version": 1, "kind": "program", "id": "20000000-0000-4000-8000-000000000001", "requestId": "30000000-0000-4000-8000-000000000001", "expectedRevision": 0, "epoch": 0, "deleted": false, "reason": "", "data": {"version": 1, "name": "Strength plan", "notes": "", "timeZone": "UTC", "archived": false, "sessions": [{"id": "20000000-0000-4000-8000-000000000002", "name": "Push", "weekdays": [1, 4], "exercises": [{"id": "20000000-0000-4000-8000-000000000003", "name": "Bench", "equipment": "Barbell", "notes": "", "sets": [{"id": "20000000-0000-4000-8000-000000000004", "reps": 5, "loadKg": 50}]}]}]}}'::jsonb; page jsonb;begin

 -- The immutable ledger pages deterministically across the 250-row boundary.
 m:=m||'{"epoch":1}'::jsonb;
 for i in 1..251 loop perform public.write_training(m||jsonb_build_object('id',gen_random_uuid(),'requestId',gen_random_uuid()));end loop;
 page:=public.read_training_page();
 if jsonb_array_length(page->'events')<>250 or page->>'next' is null or jsonb_array_length(public.read_training_page((page->>'next')::bigint)->'events')<>1 then raise exception 'Training paging lost revisions';end if;
 perform public.purge_history_with_training(null,(select revision from public.profiles where id=auth.uid()));
 if exists(select 1 from public.training_events) or exists(select 1 from public.metric_logs) or not exists(select 1 from public.programs) then raise exception 'All history purge scope incorrect';end if;
 perform public.write_training(m||jsonb_build_object('epoch',2,'id',gen_random_uuid(),'requestId',gen_random_uuid()));
end $$;
reset role;
do $$begin
 if has_table_privilege('anon','public.training_events','select') or has_table_privilege('authenticated','public.training_events','insert') or has_table_privilege('authenticated','public.training_events','truncate') or has_function_privilege('anon','public.write_training(jsonb)','execute') then raise exception 'Excess training privilege';end if;
end $$;
delete from auth.users where id='10000000-0000-4000-8000-000000000091';
do $$begin if exists(select 1 from public.training_events) or exists(select 1 from public.training_state) then raise exception 'Account cascade retained training';end if;end $$;
rollback;
