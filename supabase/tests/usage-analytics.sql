begin;
insert into auth.users(id,email) values
  ('30000000-0000-4000-8000-000000000081','usage-a@example.invalid'),
  ('30000000-0000-4000-8000-000000000082','usage-b@example.invalid'),
  ('30000000-0000-4000-8000-000000000083','drahmedlr@gmail.com');
update auth.users set email_confirmed_at=now() where id='30000000-0000-4000-8000-000000000083';
insert into private.usage_operators values('30000000-0000-4000-8000-000000000083');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000081","role":"authenticated"}',true);
do $$begin
  if public.is_usage_operator(auth.uid()) or public.is_usage_operator('30000000-0000-4000-8000-000000000083') then raise exception 'Incorrect operator link visibility'; end if;
  perform public.record_usage_event(auth.uid(),'goal_saved','');
  if public.own_usage_export() <> '{"enabled":false,"counts":[]}' then raise exception 'Events collected before consent'; end if;
  perform public.usage_preference(auth.uid(),true);
  perform public.usage_preference(auth.uid(),true);
  perform public.record_usage_event(auth.uid(),'app_viewed','overview');
  perform public.record_usage_event(auth.uid(),'app_viewed','overview');
  perform public.record_usage_event(auth.uid(),'goal_saved','');
  begin perform public.usage_preference('30000000-0000-4000-8000-000000000082',true); raise exception 'Consent spoofed'; exception when insufficient_privilege then null; end;
  begin perform public.record_usage_event(auth.uid(),'app_viewed','?token=secret'); raise exception 'Unknown screen accepted'; exception when check_violation then null; end;
  begin perform public.record_usage_event(auth.uid(),'pushups=45',''); raise exception 'Unknown event accepted'; exception when check_violation then null; end;
  begin insert into private.usage_operators values(auth.uid()); raise exception 'Self-granted operator'; exception when insufficient_privilege then null; end;
  begin perform public.set_usage_collection(false,0); raise exception 'Non-operator pause'; exception when insufficient_privilege then null; end;
  begin perform public.usage_report(7); raise exception 'Non-operator report'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000082","role":"authenticated"}',true);
do $$begin
  if exists(select 1 from private.usage_counts) or public.own_usage_export() <> '{"enabled":false,"counts":[]}' then raise exception 'Other account counts leaked'; end if;
  perform public.usage_preference(auth.uid(),true);
  perform public.record_usage_event(auth.uid(),'app_viewed','overview');
end $$;
reset role;
insert into private.usage_counts(user_id,day,event_name,screen) values
  ('30000000-0000-4000-8000-000000000081',(now() at time zone 'UTC')::date-6,'workout_logged',''),
  ('30000000-0000-4000-8000-000000000081',(now() at time zone 'UTC')::date-7,'workout_logged','');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000083","role":"authenticated"}',true);
do $$declare report jsonb := public.usage_report(7); begin
  if report->>'active'<>'2' or report->>'returning'<>'1' or report->>'events'<>'5' or jsonb_array_length(report->'daily')<>7
    or report->'breakdown'->0 <> '{"event":"app_viewed","view":"overview","accounts":2,"events":3}' then raise exception 'Incorrect report %',report; end if;
  if public.own_usage_export() <> '{"enabled":false,"counts":[]}' then raise exception 'Operator export included user counts'; end if;
  if report->'collection' <> '{"enabled":true,"revision":0}' then raise exception 'Unexpected initial configuration'; end if;
  if public.set_usage_collection(false,0) <> '{"enabled":false,"revision":1}' then raise exception 'Pause failed'; end if;
  if public.set_usage_collection(false,0)->>'revision'<>'1' then raise exception 'Repeated pause changed revision'; end if;
  begin perform public.set_usage_collection(true,0);raise exception 'Stale change accepted';exception when sqlstate 'PT409' then null; end;
  begin perform public.usage_report(365); raise exception 'Unbounded period'; exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000081","role":"authenticated"}',true);
do $$declare prior jsonb:=public.own_usage_export();begin
  perform public.record_usage_event(auth.uid(),'goal_saved','');
  if public.own_usage_export()<>prior or prior->>'enabled'<>'true' then raise exception 'Pause altered user data or consent'; end if;
end $$;
select public.usage_preference(auth.uid(),false);
select public.record_usage_event(auth.uid(),'goal_saved','');
do $$begin if exists(select 1 from private.usage_counts) then raise exception 'Withdrawal retained counts'; end if;end $$;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000083","role":"authenticated"}',true);
do $$begin if not public.is_usage_operator(auth.uid()) then raise exception 'Missing operator link'; end if;
  if public.set_usage_collection(true,1)<>'{"enabled":true,"revision":2}' then raise exception 'Resume failed'; end if;end $$;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000082","role":"authenticated"}',true);
select public.record_usage_event(auth.uid(),'workout_logged','');
do $$begin if not exists(select 1 from private.usage_counts where event_name='workout_logged') then raise exception 'Event dropped after resume'; end if;end $$;
reset role;
delete from auth.users where id='30000000-0000-4000-8000-000000000082';
delete from auth.sessions where user_id='30000000-0000-4000-8000-000000000083';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000083","role":"authenticated"}',true);
do $$begin if public.is_usage_operator(auth.uid()) then raise exception 'Revoked operator link'; end if;
  begin perform public.usage_report(7);raise exception 'Revoked operator session'; exception when insufficient_privilege then null;end; end $$;
reset role;
do $$begin
  if exists(select 1 from private.usage_counts) or exists(select 1 from private.usage_consent) then raise exception 'Cascade failed'; end if;
  if has_function_privilege('anon','public.is_usage_operator(uuid)','execute') or has_function_privilege('anon','public.record_usage_event(uuid,text,text)','execute') or has_table_privilege('anon','private.usage_counts','select') then raise exception 'Guest privileges'; end if;
end $$;
rollback;
