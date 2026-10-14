begin;
insert into auth.users(id,email)values('60000000-0000-4000-8000-000000000001','withdrawal-owner@example.invalid'),('60000000-0000-4000-8000-000000000002','withdrawal-other@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.save_profile('{"age":32,"sex":"male","weight":78,"height":180}','{"pushups":30}','withdrawal-owner',true,'{"publicFields":{"referenceSex":false,"bodySize":false}}','{}',0);
do $$begin
 begin delete from public.metric_logs where user_id=auth.uid();raise exception 'Direct destructive history bypass allowed';exception when insufficient_privilege then null;end;
 begin delete from public.profile_imports where user_id=auth.uid();raise exception 'Direct receipt deletion bypass allowed';exception when insufficient_privilege then null;end;
end$$;
do $$declare r bigint;next bigint;begin
 if public.read_public_profile('withdrawal-owner')->>'sex'<>'unselected' or public.read_public_profile('withdrawal-owner')->>'weight' is not null then raise exception 'Minimal disclosure failed';end if;
 select revision into r from public.profiles where id=auth.uid();next:=public.withdraw_public_profile();
 if next<=r or public.read_public_profile('withdrawal-owner') is not null then raise exception 'Withdrawal did not revoke public access';end if;
 if (public.read_current_measurements()->'values'->>'pushups')::numeric is distinct from 30 then raise exception 'Withdrawal changed measurements';end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and public_summary->'publicFields'='{"referenceSex":false,"bodySize":false}'::jsonb and not(public_summary?'signature')) then raise exception 'Withdrawal lost preferences or retained a signature';end if;
 begin perform public.save_profile('{"age":32,"sex":"male"}','{"pushups":31}','withdrawal-owner',true,'{}','{}',r);raise exception 'Stale publication survived withdrawal';exception when sqlstate 'PT409' then null;end;
end$$;
select public.save_profile('{"age":32,"sex":"male","weight":78,"height":180}','{"pushups":30}','withdrawal-owner',true,'{}','{}',(select revision from public.profiles where id=auth.uid()));
do $$begin
 if public.read_public_profile('withdrawal-owner')->>'sex'<>'male' then raise exception 'Legacy disclosure changed';end if;
 perform public.withdraw_public_profile();
 if not exists(select 1 from public.profiles where id=auth.uid() and public_summary->'publicFields'='{"referenceSex":true,"bodySize":true}'::jsonb) then raise exception 'Legacy preferences lost';end if;
end$$;
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$begin if public.withdraw_public_profile()<>0 then raise exception 'Missing owner profile was modified';end if;end$$;
select public.save_profile('{"age":35,"sex":"male"}','{"vo2_max":45}','cpet-roundtrip',false,'{}','{"vo2_max":{"method":"direct_cpet","exerciseMode":"treadmill","ageAtMeasurement":35,"measuredAt":"2026-10-12T12:00:00Z","protocol":{"id":"cpet_treadmill_v1","peakRer":1.1,"referencePopulation":"matches"}}}',0);
do $$begin
 if public.read_current_measurements()->'details'->'vo2_max'->'protocol' is distinct from '{"id":"cpet_treadmill_v1","peakRer":1.1,"referencePopulation":"matches"}'::jsonb then raise exception 'CPET source criteria did not round-trip through cloud persistence';end if;
end$$;
reset role;
set local role anon;
do $$begin begin perform public.withdraw_public_profile();raise exception 'Anonymous withdrawal allowed';exception when insufficient_privilege then null;end;end$$;
rollback;
