begin;
insert into auth.users(id,email) values('20000000-0000-4000-8000-000000000001','integrity@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.save_profile('{"age":32,"sex":"male","weight":78,"height":180}','{"vo2_max":52}',null,false,'{}','{"vo2_max":{"method":"direct_cpet","measuredAt":"2026-10-01T10:00:00Z","ageAtMeasurement":32}}',0);
do $$ declare r bigint; begin
 select revision into r from public.profiles where id=auth.uid();
 begin
  perform public.save_profile('{"age":32,"sex":"male","weight":78,"height":180}','{}',null,false,'{}','{}',0);
  raise exception 'Stale write accepted';
 exception when sqlstate 'PT409' then null;end;
 if (public.read_current_measurements()->'details'->'vo2_max'->>'ageAtMeasurement')::integer<>32 then raise exception 'Metadata lost';end if;
 perform public.save_profile('{"age":32,"sex":"male","weight":78,"height":180}','{}',null,false,'{}','{}',r);
 if (select count(*) from public.metric_logs)<>2 then raise exception 'History removed instead of tombstoned';end if;
 if public.read_current_metrics()<>'{}'::jsonb then raise exception 'Cleared measurement returned';end if;
 perform public.migrate_local_profile('old-local','{"age":32,"sex":"male","weight":78,"height":180}','{"vo2_max":55}','{}');
 if public.read_current_metrics()<>'{}'::jsonb then raise exception 'Import resurrected cleared value';end if;
 select revision into r from public.profiles where id=auth.uid();
 insert into public.metric_logs(user_id,metric_id,metric_value)values(auth.uid(),'rhr',55);
 if (select revision from public.profiles where id=auth.uid())<=r then raise exception 'Direct writer missed revision';end if;
end $$;
do $$ begin
 insert into public.metric_logs(user_id,metric_id,metric_value)values
 (auth.uid(),'run_5k',20),(auth.uid(),'pullups',21),(auth.uid(),'sprint_400m',60),(auth.uid(),'dead_hang',120),(auth.uid(),'run_10k',36.3),(auth.uid(),'dips',12),(auth.uid(),'waist_height_ratio',.48),(auth.uid(),'fasting_glucose',90),(auth.uid(),'pushups',28),
 (auth.uid(),'sauna_minutes',0),(auth.uid(),'cold_plunge_minutes',0),(auth.uid(),'thermal_hrv_rebound',1.1);
 if (public.read_current_metrics()->>'run_5k')::numeric<>20 then raise exception '5 km did not round trip';end if;
 if (public.read_current_metrics()->>'pullups')::numeric<>21 or (public.read_current_metrics()->>'sprint_400m')::numeric<>60 or (public.read_current_metrics()->>'dead_hang')::numeric<>120 then raise exception 'New performance tests failed to round trip';end if;
 begin
  insert into public.metric_logs(user_id,metric_id,metric_value)values(auth.uid(),'pullups',12.5);
  raise exception 'Fractional pull-ups accepted';
 exception when check_violation then null;end;
 begin
  insert into public.metric_logs(user_id,metric_id,metric_value)values(auth.uid(),'sprint_400m',2.5);
  raise exception '10 m result accepted as 400 m';
 exception when check_violation then null;end;
 begin
  insert into public.metric_logs(user_id,metric_id,metric_value)values(auth.uid(),'dead_hang',1201);
  raise exception 'Out-of-range dead hang accepted';
 exception when check_violation then null;end;
 if (public.read_current_metrics()->>'run_10k')::numeric<>36.3 then raise exception '10 km duration failed to round trip';end if;
 begin
  insert into public.metric_logs(user_id,metric_id,metric_value)values(auth.uid(),'run_10k',20);
  raise exception 'Unsupported 10 km time accepted';
 exception when check_violation then null;end;
 if (public.read_current_metrics()->>'dips')::numeric<>12 then raise exception 'Dips failed to round trip';end if;
 begin
  insert into public.metric_logs(user_id,metric_id,metric_value)values(auth.uid(),'dips',12.5);
  raise exception 'Fractional dips accepted';
 exception when check_violation then null;end;
 begin
  insert into public.metric_logs(user_id,metric_id,metric_value)values(auth.uid(),'dips',101);
  raise exception 'Out-of-range dips accepted';
 exception when check_violation then null;end;
 if public.read_current_metrics()->>'sauna_minutes'<>'0.000' then raise exception 'Zero exposure not retained';end if;
 begin
  insert into public.metric_logs(user_id,metric_id,metric_value)values(auth.uid(),'cold_plunge_minutes',121);
  raise exception 'Out-of-range thermal value accepted';
 exception when check_violation then null;end;
end $$;
reset role;
rollback;
