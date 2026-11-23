begin;

-- Access is granted by a database operator in the SQL editor. No app role can
-- add itself. Membership takes effect immediately, including revocation.
create table private.usage_operators (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table private.usage_collection (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default true,
  revision integer not null default 0 check (revision>=0)
);
insert into private.usage_collection(singleton) values(true);

create table private.usage_consent (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table private.usage_counts (
  user_id uuid not null references private.usage_consent(user_id) on delete cascade,
  day date not null default (now() at time zone 'UTC')::date,
  event_name text not null check (event_name in (
    'journey_recommendation_shown','journey_basics_started','journey_basics_saved','journey_recommendation_skipped',
    'game_quest_started','game_checkin_completed','game_reward_earned','game_library_opened','app_viewed',
    'onboarding_started','onboarding_completed','journey_started','journey_result_saved','journey_reveal_viewed',
    'journey_challenge_chosen','journey_retest_completed','signup_requested','signup_confirmed','login_succeeded',
    'recovery_requested','measurement_saved','measurement_cleared','profile_migrated','public_link_shared','simulator_used',
    'quick_log_opened','goal_saved','workout_logged'
  )),
  screen text not null check (
    case when event_name='app_viewed' then screen in (
      'journey','overview','ranking','program','measurements','progress','scenarios','profile','settings','methodology',
      'labs','sign-in','sign-up','forgot-password','reset-password','account-password','share','privacy'
    ) else screen='' end
  ),
  total integer not null default 1 check (total between 1 and 500),
  primary key(user_id, day, event_name, screen)
);
create index usage_counts_day on private.usage_counts(day);

alter table private.usage_operators enable row level security;
alter table private.usage_collection enable row level security;
alter table private.usage_consent enable row level security;
alter table private.usage_counts enable row level security;
revoke all on private.usage_operators, private.usage_collection, private.usage_consent, private.usage_counts from public,anon,authenticated;
grant select, update(enabled,revision) on private.usage_collection to authenticated;
grant select on private.usage_operators to authenticated;
grant select,insert(user_id),delete on private.usage_consent to authenticated;
grant select,insert(user_id,event_name,screen),update(total) on private.usage_counts to authenticated;

create policy usage_operator_self on private.usage_operators for select to authenticated
  using (user_id=(select auth.uid()) and (select private.has_active_session()));
create policy usage_collection_read on private.usage_collection for select to authenticated
  using ((select private.has_active_session()));
create policy usage_collection_write on private.usage_collection for update to authenticated
  using (exists(select 1 from private.usage_operators) and (select private.has_active_session()))
  with check (exists(select 1 from private.usage_operators) and (select private.has_active_session()));
create policy usage_consent_owner on private.usage_consent for all to authenticated
  using (user_id=(select auth.uid()) and (select private.has_active_session()))
  with check (user_id=(select auth.uid()) and (select private.has_active_session()));
create policy usage_count_read on private.usage_counts for select to authenticated
  using ((user_id=(select auth.uid()) or exists(select 1 from private.usage_operators)) and (select private.has_active_session()));
create policy usage_count_create on private.usage_counts for insert to authenticated
  with check (user_id=(select auth.uid()) and (select private.has_active_session()) and (select enabled from private.usage_collection));
create policy usage_count_increment on private.usage_counts for update to authenticated
  using (user_id=(select auth.uid()) and (select private.has_active_session()))
  with check (user_id=(select auth.uid()) and (select private.has_active_session()) and (select enabled from private.usage_collection));

create function public.usage_preference(p_owner uuid, p_enabled boolean default null)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is distinct from p_owner or not private.has_active_session() then
    raise exception 'Account changed' using errcode='42501';
  end if;
  if p_enabled then
    insert into private.usage_consent(user_id) values(p_owner) on conflict do nothing;
  elsif p_enabled=false then
    delete from private.usage_consent where user_id=p_owner;
  end if;
  return exists(select 1 from private.usage_consent where user_id=p_owner);
end $$;

create function public.record_usage_event(p_owner uuid, p_event text, p_view text)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is distinct from p_owner or not private.has_active_session() then
    raise exception 'Account changed' using errcode='42501';
  end if;
  -- Serialize changes to the collection switch with in-flight event writes.
  perform pg_advisory_xact_lock_shared(hashtextextended('private.usage_collection',0));
  if not (select enabled from private.usage_collection) then return; end if;
  insert into private.usage_counts as counts(user_id,event_name,screen)
    select user_id,p_event,p_view from private.usage_consent where user_id=p_owner
    on conflict (user_id, day, event_name, screen) do update
    set total=counts.total+1 where counts.total<500;
end $$;

create function public.set_usage_collection(p_enabled boolean,p_revision integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare state private.usage_collection;
begin
  if not private.has_active_session() or not exists(select 1 from private.usage_operators where user_id=auth.uid()) then
    raise exception 'Operator access required' using errcode='42501';
  end if;
  if p_enabled is null or p_revision is null or p_revision<0 then
    raise exception 'Invalid collection setting' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('private.usage_collection',0));
  select * into strict state from private.usage_collection where singleton;
  if state.enabled is distinct from p_enabled then
    if state.revision<>p_revision then raise exception 'Collection setting changed' using errcode='PT409'; end if;
    update private.usage_collection set enabled=p_enabled,revision=revision+1 where singleton returning * into state;
  end if;
  return jsonb_build_object('enabled',state.enabled,'revision',state.revision);
end $$;

create function public.own_usage_export()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  if not private.has_active_session() then raise exception 'Sign in required' using errcode='42501'; end if;
  return jsonb_build_object('enabled', exists(select 1 from private.usage_consent where user_id=auth.uid()),
    'counts', coalesce((select jsonb_agg(jsonb_build_object('day',day,'event',event_name,'view',screen,'count',total)
      order by day,event_name,screen) from private.usage_counts where user_id=auth.uid()), '[]'::jsonb));
end $$;

create function public.usage_report(p_days integer)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  today date := (now() at time zone 'UTC')::date;
  report jsonb;
begin
  if not private.has_active_session() or not exists(select 1 from private.usage_operators where user_id=auth.uid()) then
    raise exception 'Operator access required' using errcode='42501';
  end if;
  if p_days is null or p_days not in (7,30,90) then raise exception 'Unsupported reporting period' using errcode='22023'; end if;
  with activity as materialized (
    select * from private.usage_counts where day between today - (p_days - 1) and today
  ), daily as (
    select day,count(distinct user_id) as accounts,sum(total) as events from activity group by day
  ), breakdown as (
    select event_name,screen, count(distinct user_id) as accounts,sum(total) as events
    from activity group by event_name,screen
  ), users as (
    select user_id,count(distinct day)>1 as returned from activity group by user_id
  )
  select jsonb_build_object(
    'collection', (select jsonb_build_object('enabled',enabled,'revision',revision) from private.usage_collection),
    'active', (select count(*) from users),
    'returning', (select count(*) from users where returned),
    'events', coalesce((select sum(events) from daily),0),
    'daily', (select jsonb_agg(jsonb_build_object('day',today-i,'accounts',coalesce(d.accounts,0),'events',coalesce(d.events,0)) order by i desc)
      from generate_series(0,p_days-1) i left join daily d on d.day=today-i),
    'breakdown', coalesce((select jsonb_agg(jsonb_build_object('event',event_name,'view',screen,'accounts',accounts,'events',events)
      order by events desc,event_name,screen) from breakdown), '[]'::jsonb)
  ) into report;
  return report;
end $$;

revoke all on function public.usage_preference(uuid,boolean), public.record_usage_event(uuid,text,text),
  public.usage_report(integer), public.own_usage_export(), public.set_usage_collection(boolean,integer) from public,anon,authenticated;
grant execute on function public.usage_preference(uuid,boolean), public.record_usage_event(uuid,text,text),
  public.usage_report(integer), public.own_usage_export(), public.set_usage_collection(boolean,integer) to authenticated;

commit;
