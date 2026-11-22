-- Private preferences and personal targets. No probability or scoring changes.
create table public.personal_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null check(jsonb_typeof(data)='object' and data->>'version'='1' and jsonb_typeof(data->'context')='object' and data ? 'goal' and jsonb_typeof(data->'goal') in ('object','null') and octet_length(data::text)<=16384),
 revision bigint not null default 1 check(revision>0),
 updated_at timestamptz not null default now()
);
alter table public.personal_workspaces enable row level security;
revoke all on public.personal_workspaces from public,anon,authenticated;
grant select on public.personal_workspaces to authenticated;
grant insert(user_id,data),update(data) on public.personal_workspaces to authenticated;
create policy personal_workspaces_owner on public.personal_workspaces for all to authenticated
 using(user_id=(select auth.uid()) and (select private.has_active_session()))
 with check(user_id=(select auth.uid()) and (select private.has_active_session()));
create function private.bump_workspace_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.revision:=old.revision+1;new.updated_at:=now();return new;end $$;
revoke all on function private.bump_workspace_revision() from public,anon,authenticated;
create trigger workspace_revision before update on public.personal_workspaces for each row execute function private.bump_workspace_revision();
create function public.save_personal_workspace(p_data jsonb,p_revision bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare saved public.personal_workspaces;
begin
 if auth.uid() is null or not private.has_active_session() then raise exception 'Sign in required' using errcode='42501';end if;
 if p_revision is null or p_revision<0 or p_data is null then raise exception 'Invalid workspace' using errcode='22023';end if;
 if p_revision=0 then
  insert into public.personal_workspaces(user_id,data) values(auth.uid(),p_data) on conflict(user_id) do nothing returning * into saved;
 else
  update public.personal_workspaces set data=p_data where user_id=auth.uid() and revision=p_revision returning * into saved;
 end if;
 if saved.user_id is null then raise exception 'Workspace changed elsewhere' using errcode='PT409';end if;
 return jsonb_build_object('data',saved.data,'revision',saved.revision);
end $$;
revoke all on function public.save_personal_workspace(jsonb,bigint) from public,anon;
grant execute on function public.save_personal_workspace(jsonb,bigint) to authenticated;
