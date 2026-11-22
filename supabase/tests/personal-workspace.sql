begin;
insert into auth.users(id,email) values('10000000-0000-4000-8000-000000000081','workspace-owner@example.invalid'),('10000000-0000-4000-8000-000000000082','workspace-other@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000081","role":"authenticated"}',true);
select public.save_personal_workspace('{"version":1,"context":{"days":3},"goal":null}',0);
do $$begin
 begin perform public.save_personal_workspace('{"version":1,"context":{},"goal":null}',0);raise exception 'Stale create accepted';exception when sqlstate 'PT409' then null;end;
 if (select data->'context'->>'days' from public.personal_workspaces)<>'3' then raise exception 'Initial save missing';end if;
end $$;
select public.save_personal_workspace('{"version":1,"context":{"days":4},"goal":{"version":1,"metric":"pushups","target":30,"baseline":20,"date":"2027-12-01","createdAt":"2026-11-12T00:00:00Z"}}',1);
do $$begin
 begin perform public.save_personal_workspace('{"version":1,"context":{},"goal":null}',1);raise exception 'Stale update accepted';exception when sqlstate 'PT409' then null;end;
 if (select revision from public.personal_workspaces)<>2 then raise exception 'Revision failed';end if;
 begin update public.personal_workspaces set revision=0;raise exception 'Revision writable';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000082","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from public.personal_workspaces) then raise exception 'Cross-owner read';end if;
 begin perform public.save_personal_workspace('{"version":1,"context":{},"goal":null}',2);raise exception 'Cross-owner update';exception when sqlstate 'PT409' then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000081","role":"authenticated","is_anonymous":true}',true);
do $$begin
 if exists(select 1 from public.personal_workspaces) then raise exception 'Anonymous read';end if;
 begin perform public.save_personal_workspace('{"version":1,"context":{},"goal":null}',2);raise exception 'Anonymous write';exception when insufficient_privilege then null;end;
end $$;
reset role;
delete from auth.sessions where user_id='10000000-0000-4000-8000-000000000081';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000081","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from public.personal_workspaces) then raise exception 'Revoked session read';end if;
 begin perform public.save_personal_workspace('{"version":1,"context":{},"goal":null}',2);raise exception 'Revoked session write';exception when insufficient_privilege then null;end;
end $$;
reset role;
delete from auth.users where id='10000000-0000-4000-8000-000000000081';
do $$begin
 if exists(select 1 from public.personal_workspaces) then raise exception 'Account cascade failed';end if;
 if has_table_privilege('anon','public.personal_workspaces','select') or has_table_privilege('authenticated','public.personal_workspaces','delete') or has_table_privilege('authenticated','public.personal_workspaces','truncate') then raise exception 'Excess workspace grants';end if;
end $$;
rollback;
