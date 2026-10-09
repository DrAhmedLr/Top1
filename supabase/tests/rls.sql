-- Transactional integration test. Test users and data are rolled back.
begin;
insert into auth.users(id,email) values('10000000-0000-4000-8000-000000000001','top1-rls-owner@example.invalid'),('10000000-0000-4000-8000-000000000002','top1-rls-other@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.migrate_local_profile('rls-import','{"age":32,"sex":"male","weight":78,"height":180}','{"rhr":49,"vo2_max":52,"body_fat":14}');
select public.migrate_local_profile('rls-import','{"age":32,"sex":"male","weight":78,"height":180}','{"rhr":49,"vo2_max":52,"body_fat":14}');
do $$ begin
 if (select count(*) from public.metric_logs)<>3 then raise exception 'Import was not idempotent'; end if;
 if (select count(*) from public.profile_imports)<>1 then raise exception 'Import receipt missing'; end if;
 if public.read_current_metrics()->>'rhr'<>'49.000' then raise exception 'Current metric query failed'; end if;
end $$;
select public.save_profile('{"age":32,"sex":"male","weight":78,"height":180}','{"rhr":49,"vo2_max":52,"body_fat":14}','top1-rls-test',false,'{}','{}',(select revision from public.profiles where id=auth.uid()));
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',true);
do $$ begin
 if exists(select 1 from public.profiles) then raise exception 'Anonymous signed-in owner read private profile'; end if;
 if exists(select 1 from public.metric_logs) then raise exception 'Anonymous signed-in owner read measurements'; end if;
 update public.profiles set is_public=true where id=auth.uid();
 if found then raise exception 'Anonymous signed-in owner changed profile'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.profiles)<>0 then raise exception 'Private profile leaked'; end if;
 if (select count(*) from public.metric_logs)<>0 then raise exception 'Measurements leaked'; end if;
 if (select count(*) from public.profile_imports)<>0 then raise exception 'Import receipts leaked'; end if;
 update public.profiles set is_public=true where id='10000000-0000-4000-8000-000000000001';
 if found then raise exception 'Cross-owner update succeeded'; end if;
 begin
  insert into public.metric_logs(user_id,metric_id,metric_value) values('10000000-0000-4000-8000-000000000001','rhr',55);
  raise exception 'Cross-owner insert succeeded';
 exception when insufficient_privilege then null;
 end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
update public.profiles set is_public=true where id=auth.uid();
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
 if (select count(*) from public.profiles where username='top1-rls-test')<>1 then raise exception 'Public profile inaccessible'; end if;
 begin
  perform * from public.metric_logs;
  raise exception 'Anonymous metric access succeeded';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.migrate_local_profile('unauthorized','{}','{}');
  raise exception 'Anonymous migration succeeded';
 exception when insufficient_privilege then null;
 end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
update public.profiles set is_public=false where id=auth.uid();
do $$ begin
 begin
  perform public.migrate_local_profile('invalid','{"age":32,"sex":"male","weight":78,"height":180}','{"grip_strength":500}');
  raise exception 'Invalid measurement imported';
 exception when check_violation then null;
 end;
 if exists(select 1 from public.profile_imports where import_id='invalid') then raise exception 'Failed import left receipt'; end if;
 if (select count(*) from public.metric_logs)<>3 then raise exception 'Failed import changed logs'; end if;
end $$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
 if exists(select 1 from public.profiles where username='top1-rls-test') then raise exception 'Revoked profile still public'; end if;
end $$;
reset role;
rollback;
select 'RLS isolation, idempotency, atomic rollback, and visibility revocation passed' as result;
