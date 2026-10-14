begin;
insert into auth.users(id,email)values('50000000-0000-4000-8000-000000000001','remediation-owner@example.invalid'),('50000000-0000-4000-8000-000000000002','remediation-other@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.save_profile('{"age":32,"sex":"unselected"}','{"grip_combined":95,"sprint_10m":1.9,"bench_1rm":0.875}','remediation-owner',false,'{}','{"grip_combined":{"method":"device","protocol":{"id":"nhanes_grip_combined_v1","equipment":"Takei","hand":"both","trials":3}},"sprint_10m":{"method":"device","protocol":{"id":"sprint10m_gates_v1","equipment":"gates"}},"bench_1rm":{"method":"epley_estimate","derivation":{"formula":"epley_ratio_v1","inputs":[60,5],"bodyWeightKg":80}}}',0);
do $$begin
 if public.read_current_measurements()->'details'->'grip_combined'->'protocol'->>'hand'<>'both' then raise exception 'Combined grip protocol lost';end if;
 if public.read_current_measurements()->'details'->'bench_1rm'->'derivation'->>'bodyWeightKg'<>'80' then raise exception 'Original test weight lost';end if;
 if not exists(select 1 from public.metric_logs where reference_context->>'profileAgeAtEntry'='32' and reference_context->>'referenceSexAtEntry'='unselected')then raise exception 'Historical reference context missing';end if;
 if not exists(select 1 from public.profile_revisions where demographics->>'sex'='unselected')then raise exception 'Demographic history missing';end if;
 begin update public.profile_revisions set summary='{}';raise exception 'Assessment history writable by owner';exception when insufficient_privilege then null;end;
end$$;
insert into public.metric_logs(user_id,metric_id,metric_value,method,measured_at,protocol_context)values(auth.uid(),'pushups',20,'manual',now()-interval '2 days','{"id":"strict_pushups_v1"}'),(auth.uid(),'pushups',25,'manual',now()-interval '1 day','{"id":"strict_pushups_v1"}');
insert into public.metric_logs(user_id,metric_id,metric_value,method,measured_at,protocol_context)select auth.uid(),'pushups',20,'manual',now()-make_interval(days=>100+i),'{"id":"strict_pushups_v1"}'from generate_series(1,60)i;
do $$declare pair jsonb;begin
 pair:=public.read_history_comparison('pushups');if jsonb_array_length(pair)<>2 or(pair->0->>'value')::numeric-(pair->1->>'value')::numeric<>5 then raise exception 'Backfilled page changed global comparison';end if;
end$$;
select public.save_program_recorded(jsonb_build_object('version',1,'focus','consistency','tasks',jsonb_build_array(jsonb_build_object('id','walk','label','Original walk','days',jsonb_build_array(extract(isodow from current_date)::integer),'completed','[]'::jsonb))),0,current_date,'UTC',null);
select public.save_program_recorded((public.read_program_recorded()->'plan'),(public.read_program_recorded()->>'revision')::bigint,current_date,'UTC','{"taskId":"walk","completed":true}');
select public.save_program_recorded('{"version":1,"focus":"strength","tasks":[]}',(public.read_program_recorded()->>'revision')::bigint,current_date,'UTC',null);
do $$declare exported jsonb;begin
 if not exists(select 1 from public.program_schedule_history where effective_date=current_date and tasks->0->>'label'='Original walk')then raise exception 'Today schedule rewritten';end if;
 if not exists(select 1 from public.program_completion_history where task_label='Original walk' and completed)then raise exception 'Archived action history lost';end if;
 begin insert into public.program_completion_history(user_id,task_id,task_label,completion_date,completed)values(auth.uid(),'walk','Forged',current_date,true);raise exception 'Completion ledger writable directly';exception when insufficient_privilege then null;end;
 exported:=public.export_own_data();if jsonb_array_length(exported->'observations')<>65 or jsonb_array_length(exported->'assessmentHistory')<1 or jsonb_array_length(exported->'program'->'timeline'->'completions')<>1 then raise exception 'Export incomplete';end if;
end$$;
insert into public.metric_logs(user_id,metric_id,metric_value,method,measured_at,observation_window)values(auth.uid(),'total_sleep',420,'device',now()-interval '2 days','{"start":"not-a-date","end":"also-invalid","statistic":"mean","sampleCount":7}'),(auth.uid(),'total_sleep',450,'device',now()-interval '1 day','{"start":"not-a-date","end":"also-invalid","statistic":"mean","sampleCount":7}');
do $$begin if public.read_history_comparison('total_sleep')<>'[]' then raise exception 'Corrupt window was compared';end if;end$$;
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select public.save_profile('{"age":35,"sex":"male"}','{"pushups":10}',null,false,'{}','{}',0);
do $$begin if exists(select 1 from public.program_schedule_history)or exists(select 1 from public.program_completion_history)then raise exception 'Other routine history leaked';end if;end$$;
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$begin begin perform public.purge_own_history('pushups',0);raise exception 'Stale purge accepted';exception when sqlstate 'PT409' then null;end;end$$;
select public.purge_own_history('pushups',(select revision from public.profiles where id=auth.uid()));
do $$begin
 if exists(select 1 from public.metric_logs where metric_id='pushups')then raise exception 'Selected history remains';end if;
 if not exists(select 1 from public.metric_logs where metric_id='grip_combined')then raise exception 'Unselected history deleted';end if;
 if exists(select 1 from public.profiles where is_public)then raise exception 'Sharing was not revoked';end if;
end$$;
reset role;
update auth.sessions set created_at=now()-interval '11 minutes'where user_id='50000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin begin perform public.purge_own_history(null,(select revision from public.profiles where id=auth.uid()));raise exception 'Old session purged data';exception when insufficient_privilege then null;end;end$$;
reset role;
delete from auth.sessions where user_id='50000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin
 if public.active_account_session() then raise exception 'Revoked session accepted';end if;
 if exists(select 1 from public.profiles)or exists(select 1 from public.metric_logs)or exists(select 1 from public.programs)or exists(select 1 from public.profile_revisions)then raise exception 'Revoked JWT reads survived';end if;
 begin perform public.export_own_data();raise exception 'Revoked JWT exported data';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$begin if not public.active_account_session()or not exists(select 1 from public.metric_logs where metric_id='pushups')then raise exception 'Other owner affected by purge or revocation';end if;end$$;
reset role;
delete from auth.users where id='50000000-0000-4000-8000-000000000001';
do $$begin if exists(select 1 from public.profiles where id='50000000-0000-4000-8000-000000000001')or exists(select 1 from public.program_schedule_history where user_id='50000000-0000-4000-8000-000000000001')or exists(select 1 from public.profile_revisions where user_id='50000000-0000-4000-8000-000000000001')then raise exception 'Owned data did not cascade';end if;end$$;
rollback;
select 'Protocols, derivations, fixed history comparison, routine events, export, purge, revoked JWT and lifecycle ownership passed' as result;
