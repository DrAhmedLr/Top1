begin;
insert into auth.users(id,email,email_confirmed_at,created_at) values
 ('b0000000-0000-4000-8000-000000000001','alice@journey.invalid',now(),now()-interval '2 weeks'),
 ('b0000000-0000-4000-8000-000000000002','bob@journey.invalid',now(),now()-interval '1 day'),
 ('b0000000-0000-4000-8000-000000000003','drahmedlr@gmail.com',now(),now()-interval '1 month');
insert into private.usage_operators values ('b0000000-0000-4000-8000-000000000003');
insert into private.forecast_writer(singleton,capability_sha256) values(true,sha256(convert_to('journey-test-key','UTF8')));
select set_config('test.proof',encode(sha256(sha256(convert_to('journey-test-key','UTF8'))||convert_to('TOP1/customer-journey/v1','UTF8')),'hex'),true);
select set_config('test.events',jsonb_build_array(
 jsonb_build_object('id',gen_random_uuid(),'sessionId','d0000000-0000-4000-8000-000000000001','at',clock_timestamp(),'view','program','event','goal_saved','metric','pushups'),
 jsonb_build_object('id',gen_random_uuid(),'sessionId','d0000000-0000-4000-8000-000000000001','at',clock_timestamp(),'view','program','event','screen_time','seconds',34)
)::text,true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$declare r jsonb; c uuid;begin
  if public.customer_journey_preference(auth.uid())->>'enabled'<>'false' then raise exception 'Unexpected default'; end if;
  perform public.usage_preference(auth.uid(),true);
  if public.customer_journey_preference(auth.uid())->>'enabled'<>'false' then raise exception 'Transfer of aggregate preference'; end if;
  begin perform public.admin_customer_directory(30); raise exception 'Directory accessible'; exception when insufficient_privilege then null; end;
  begin perform public.admin_customer_journey(auth.uid(),30); raise exception 'Detail accessible'; exception when insufficient_privilege then null; end;
  begin perform public.customer_journey_preference('b0000000-0000-4000-8000-000000000002',true);raise exception 'Owner changed';exception when insufficient_privilege then null;end;
  if public.record_customer_journey(auth.uid(),gen_random_uuid(),current_setting('test.proof'),'192.0.2.5',current_setting('test.events')::jsonb)<>0 then raise exception 'Preconsent event'; end if;
  r:=public.customer_journey_preference(auth.uid(),true);
  c:=(r->>'consentId')::uuid;
  if public.customer_journey_preference(auth.uid(),true)<>r then raise exception 'Re-opt-in changed consent id';end if;
  begin perform public.record_customer_journey(auth.uid(),c,'sample-false-proof','192.0.2.5',current_setting('test.events')::jsonb);
    raise exception 'Unauthenticated IP'; exception when insufficient_privilege then null; end;
  if public.record_customer_journey(auth.uid(),c,current_setting('test.proof'),'192.0.2.5',current_setting('test.events')::jsonb)<>0 then raise exception 'Prior events retained'; end if;
  perform set_config('test.consent',c::text,true);
end $$;
reset role;
update private.customer_journey_consent set consented_at=now()-interval '10 minutes';
set local role authenticated;
do $$declare r jsonb; c uuid:=current_setting('test.consent')::uuid; batch jsonb:=current_setting('test.events')::jsonb; begin
  if public.record_customer_journey(auth.uid(),c,current_setting('test.proof'),'2001:db8::1',batch)<>2 then raise exception 'Events lost'; end if;
  if public.record_customer_journey(auth.uid(),c,current_setting('test.proof'),'192.0.2.5',batch)<>0 then raise exception 'Retry doubled'; end if;
  r:=public.own_customer_journey_export(0,1);
  if jsonb_array_length(r->'events')<>1 or (r->>'nextAfter')::bigint is null or (r->>'highWater')::bigint<1
    or r->'events'->0->>'ip'<>'2001:db8::1' then raise exception 'Bad export cursor or IP'; end if;
  if jsonb_array_length(public.own_customer_journey_export((r->>'nextAfter')::bigint,1,(r->>'highWater')::bigint)->'events')<>1 then raise exception 'Missing second page'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$begin if jsonb_array_length(public.own_customer_journey_export()->'events')<>0 then raise exception 'Cross-account export';end if;end $$;
select set_config('request.jwt.claims','{"sub":"b0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$declare r jsonb;begin
  r:=public.admin_customer_directory(30,'@journey.invalid',null);
  if jsonb_array_length(r->'customers')<>2 or r->'customers'->0->>'email'<>'bob@journey.invalid' or r->'customers'->0->>'sharing'<>'false' then raise exception 'Directory sorting, search or coverage'; end if;
  r:=public.admin_customer_journey('b0000000-0000-4000-8000-000000000001',30);
  if r->'customer'->>'activeSeconds'<>'34' or r->'customer'->>'sessions'<>'1' or r->'customer'->>'eventCount'<>'1'
    or jsonb_array_length(r->'events')<>1 or r->'recentIp'->>'address'<>'2001:db8::1' or r->'screens'->0 <> '{"view":"program","seconds":34}'::jsonb then raise exception 'Detail totals'; end if;
  perform public.set_usage_collection(false,0);
end $$;
select set_config('request.jwt.claims','{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$begin
  if public.record_customer_journey(auth.uid(),current_setting('test.consent')::uuid,current_setting('test.proof'),null,
    jsonb_build_array((current_setting('test.events')::jsonb->0)||jsonb_build_object('id',gen_random_uuid())))<>0 then raise exception 'Pause ignored'; end if;
end $$;
reset role;
update private.usage_collection set enabled=true;
set local role authenticated;
do $$begin
  if public.record_customer_journey(auth.uid(),current_setting('test.consent')::uuid,current_setting('test.proof'),null,
    jsonb_build_array((current_setting('test.events')::jsonb->0)||jsonb_build_object('id',gen_random_uuid())))<>0 then raise exception 'Buffered event from before resume'; end if;
end $$;
reset role;
insert into private.customer_journey_events(user_id,client_id,visit_id,event_at,event_name,screen,seconds,ip)
 select 'b0000000-0000-4000-8000-000000000001',gen_random_uuid(),gen_random_uuid(),now()-make_interval(days=>days),'app_viewed','overview',0,'192.0.2.5'::inet from (values(31),(91)) d(days);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$declare r jsonb:=public.admin_customer_journey('b0000000-0000-4000-8000-000000000001',90);begin
  if jsonb_array_length(r->'events')<>2 or r->'events'->0->>'ip' is not null then raise exception 'Retention read boundary';end if;
end $$;
reset role;
select private.purge_expired_customer_journeys();
do $$begin if exists(select 1 from private.customer_journey_events where event_at<now()-interval '90 days' or (event_at<now()-interval '30 days' and ip is not null)) then raise exception 'Retention purge';end if;end $$;
-- Pagination also works when multiple registrations have the same timestamp.
insert into auth.users(id,email,created_at) select gen_random_uuid(),'fixture'||i||'@paging.invalid',now() from generate_series(1,28) i;
set local role authenticated;
do $$declare first_page jsonb:=public.admin_customer_directory(7,'@paging.invalid',null); last_page jsonb; begin
  last_page:=public.admin_customer_directory(7,'@paging.invalid',(first_page->>'nextAfter')::uuid);
  if jsonb_array_length(first_page->'customers')<>25 or jsonb_array_length(last_page->'customers')<>3 or last_page->>'nextAfter' is not null then raise exception 'Directory pagination'; end if;
end $$;
reset role;
update auth.users set email='previous-operator@journey.invalid' where id='b0000000-0000-4000-8000-000000000003';
set local role authenticated;
do $$begin
  if public.is_usage_operator(auth.uid()) then raise exception 'Email change retained operator link';end if;
  begin perform public.usage_report(7);raise exception 'Old operator report';exception when insufficient_privilege then null;end;
  begin perform public.admin_customer_directory(7);raise exception 'Stale operator access';exception when insufficient_privilege then null;end;
end $$;
reset role;
update auth.users set email='drahmedlr@gmail.com',email_confirmed_at=null where id='b0000000-0000-4000-8000-000000000003';
set local role authenticated;
do $$begin if public.is_usage_operator(auth.uid()) then raise exception 'Unverified operator';end if;end $$;
select set_config('request.jwt.claims','{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$declare c uuid;begin
  perform public.customer_journey_preference(auth.uid(),false);
  if (public.own_customer_journey_export()->>'enabled')::boolean or jsonb_array_length(public.own_customer_journey_export()->'events')<>0 then raise exception 'Withdrawal retained data';end if;
  c:=(public.customer_journey_preference(auth.uid(),true)->>'consentId')::uuid;
  if c=current_setting('test.consent')::uuid or public.record_customer_journey(auth.uid(),current_setting('test.consent')::uuid,current_setting('test.proof'),null,current_setting('test.events')::jsonb)<>0 then raise exception 'Stale consent replay';end if;
end $$;
reset role;
delete from auth.users where id='b0000000-0000-4000-8000-000000000001';
do $$begin
 if exists(select 1 from private.customer_journey_consent) then raise exception 'Account deletion retained journey';end if;
 if has_function_privilege('anon','public.admin_customer_directory(int,text,uuid)','execute') or has_table_privilege('authenticated','private.customer_journey_events','select') or has_function_privilege('authenticated','private.purge_expired_customer_journeys()','execute') then raise exception 'Excess privileges';end if;
end $$;
rollback;
