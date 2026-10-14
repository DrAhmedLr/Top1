begin;
insert into auth.users(id,email) values('40000000-0000-4000-8000-000000000001','algorithm-owner@example.invalid'),('40000000-0000-4000-8000-000000000002','algorithm-other@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.save_profile('{"age":35,"sex":"male"}','{"vo2_max":50}',null,false,'{}','{"vo2_max":{"method":"direct_cpet","ageAtMeasurement":35}}',0);
do $$begin
 if public.read_current_measurements()->'details'->'vo2_max' ? 'exerciseMode' then raise exception 'Legacy modality was invented';end if;
end $$;
select public.save_profile('{"age":35,"sex":"male"}','{"vo2_max":50}',null,false,'{}','{"vo2_max":{"method":"direct_cpet","ageAtMeasurement":35,"exerciseMode":"treadmill"}}',(select revision from public.profiles where id=auth.uid()));
do $$begin
 if public.read_current_measurements()->'details'->'vo2_max'->>'exerciseMode' is distinct from 'treadmill' then raise exception 'Treadmill modality lost';end if;
end $$;
select public.save_profile('{"age":35,"sex":"male"}','{"vo2_max":50}',null,false,'{}','{"vo2_max":{"method":"direct_cpet","ageAtMeasurement":35,"exerciseMode":"cycle"}}',(select revision from public.profiles where id=auth.uid()));
do $$begin
 if (select count(*) from public.metric_logs where metric_id='vo2_max')<>3 then raise exception 'Modality change did not create history';end if;
 if public.read_current_measurements()->'details'->'vo2_max'->>'exerciseMode' is distinct from 'cycle' then raise exception 'Cycle modality lost';end if;
 begin insert into public.metric_logs(user_id,metric_id,metric_value,exercise_mode) values(auth.uid(),'pushups',20,'treadmill');raise exception 'Modality attached to incompatible metric';exception when check_violation then null;end;
 begin insert into public.metric_logs(user_id,metric_id,metric_value,exercise_mode) values(auth.uid(),'vo2_max',50,'unknown');raise exception 'Unsupported modality accepted';exception when check_violation then null;end;
end $$;
select public.save_profile('{"age":35,"sex":"male"}','{}',null,false,'{}','{}',(select revision from public.profiles where id=auth.uid()));
insert into public.metric_logs(user_id,metric_id,metric_value)values(auth.uid(),'sit_to_stand',0);
do $$begin
 if public.read_current_measurements()->'values' ? 'vo2_max' then raise exception 'Clear remained current';end if;
 if not exists(select 1 from public.metric_logs where is_deleted and exercise_mode='cycle' and age_at_measurement=35) then raise exception 'Clear destroyed protocol context';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$begin if exists(select 1 from public.metric_logs)then raise exception 'Other account context leaked';end if;end $$;
select public.import_guest_profile(auth.uid(),'protocol-context-import','{"age":35,"sex":"female"}','{"vo2_max":40}','{"vo2_max":{"method":"direct_cpet","exerciseMode":"treadmill","ageAtMeasurement":35}}');
do $$begin
 if public.read_current_measurements()->'details'->'vo2_max'->>'exerciseMode' is distinct from 'treadmill' then raise exception 'Explicit import lost modality';end if;
end $$;
reset role;rollback;
select 'Protocol persistence, changes, tombstones, import and owner isolation passed' as result;
