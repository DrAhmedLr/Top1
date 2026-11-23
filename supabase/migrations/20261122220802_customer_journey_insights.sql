begin;

create table private.customer_journey_consent (
  user_id uuid primary key references auth.users(id) on delete cascade,
  consent_id uuid not null default gen_random_uuid(),
  consented_at timestamptz not null default clock_timestamp()
);
create table private.customer_journey_events (
  seq bigint generated always as identity primary key,
  user_id uuid not null references private.customer_journey_consent(user_id) on delete cascade,
  client_id uuid not null,
  visit_id uuid not null,
  event_at timestamptz not null,
  received_at timestamptz not null default statement_timestamp(),
  event_name text not null check (event_name in (
    'journey_recommendation_shown','journey_basics_started','journey_basics_saved','journey_recommendation_skipped',
    'game_quest_started','game_checkin_completed','game_reward_earned','game_library_opened','app_viewed',
    'onboarding_started','onboarding_completed','journey_started','journey_result_saved','journey_reveal_viewed',
    'journey_challenge_chosen','journey_retest_completed','signup_requested','signup_confirmed','login_succeeded',
    'recovery_requested','measurement_saved','measurement_cleared','profile_migrated','public_link_shared','simulator_used',
    'quick_log_opened','goal_saved','workout_logged','screen_time','goal_selected','workout_skipped','goal_retest_opened',
    'goal_save_failed','workout_save_failed')),
  screen text not null check (screen in ('journey','overview','ranking','program','measurements','progress','scenarios','profile',
    'settings','methodology','labs','sign-in','sign-up','forgot-password','reset-password','account-password','share','privacy')),
  metric text check (metric in ('apob','lpa','fasting_insulin','hscrp','hba1c','homocysteine','cystatin_c','ggt','vo2_max',
    'zone2_power','rhr','hrv','hrr_1min','bp_systolic','body_fat','grip_strength','cmj','broad_jump','squat_1rm',
    'deadlift_1rm','bench_1rm','pullup_1rm','sit_to_stand','total_sleep','sleep_efficiency','circadian_regularity',
    'single_leg_balance','reaction_time','run_5k','pullups','sprint_400m','dead_hang','dips','waist_height_ratio','fasting_glucose','pushups')),
  seconds smallint not null check (case when event_name='screen_time' then seconds between 1 and 60 else seconds=0 end),
  ip inet check (masklen(ip) = case family(ip) when 4 then 32 else 128 end),
  unique(user_id,client_id)
);
create index customer_journey_owner_seq on private.customer_journey_events(user_id,seq);
create index customer_journey_owner_time on private.customer_journey_events(user_id,event_at);
create index customer_journey_time on private.customer_journey_events(event_at);
create index customer_journey_ip_expiry on private.customer_journey_events(event_at) where ip is not null;

alter table private.customer_journey_consent enable row level security;
alter table private.customer_journey_events enable row level security;
revoke all on private.customer_journey_consent,private.customer_journey_events from public,anon,authenticated;
revoke all on sequence private.customer_journey_events_seq_seq from public,anon,authenticated;

-- Consult the current Auth record: changing email or revoking the session must take effect immediately.
create function private.is_current_usage_operator() returns boolean
language sql stable security definer set search_path='' as $$
  select private.has_active_session() and exists (
    select 1 from private.usage_operators o join auth.users u on u.id=o.user_id
    where u.id=auth.uid() and lower(u.email)='drahmedlr@gmail.com' and u.email_confirmed_at is not null
    and not coalesce(u.is_anonymous,false)
  )
$$;
alter policy usage_operator_self on private.usage_operators using (
  user_id=(select auth.uid()) and (select private.is_current_usage_operator())
);
create function private.require_journey_operator() returns void
language plpgsql stable security invoker set search_path='' as $$
begin
  if not private.is_current_usage_operator() then raise exception 'Operator access required' using errcode='42501'; end if;
end $$;

-- Buffered events from a paused interval cannot be posted after collection resumes.
alter table private.usage_collection add column journey_resumed_at timestamptz not null default '-infinity';
create function private.mark_journey_resumption() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.enabled and not old.enabled then new.journey_resumed_at:=clock_timestamp(); end if;
  return new;
end $$;
revoke all on function private.mark_journey_resumption() from public,anon,authenticated;
create trigger mark_journey_resumption before update of enabled on private.usage_collection
for each row execute function private.mark_journey_resumption();

-- Identifiable journey sharing has its own permission. A new consent id after withdrawal
-- prevents delayed requests from an earlier sharing period from resurrecting deleted data.
create function private.customer_journey_preference(p_owner uuid,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_consent uuid;
begin
  perform private.require_forecast_owner(p_owner);
  if p_enabled is not null then
    perform pg_advisory_xact_lock(hashtextextended('journey/'||p_owner::text,0));
    if p_enabled then
      insert into private.customer_journey_consent(user_id) values(p_owner) on conflict do nothing;
    else
      delete from private.customer_journey_consent where user_id=p_owner;
    end if;
  end if;
  select consent_id into current_consent from private.customer_journey_consent where user_id=p_owner;
  return jsonb_build_object('enabled',current_consent is not null,'consentId',current_consent);
end $$;

create function private.record_customer_journey(p_owner uuid,p_consent uuid,p_proof text,p_ip inet,p_events jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare
  collection_start timestamptz;
  resumed_at timestamptz;
  accepted integer;
  received timestamptz:=statement_timestamp();
begin
  perform private.require_forecast_owner(p_owner);
  -- Only the web server has this purpose-bound value. Browser clients cannot submit their own IP via PostgREST.
  if p_proof is null or p_proof !~ '^[0-9a-f]{64}$' or not exists (
    select 1 from private.forecast_writer
    where encode(sha256(capability_sha256 || convert_to('TOP1/customer-journey/v1','UTF8')),'hex')=p_proof
  ) then raise exception 'Server attestation required' using errcode='42501'; end if;
  if p_events is null or jsonb_typeof(p_events)<>'array' then raise exception 'Invalid event batch' using errcode='22023'; end if;
  if jsonb_array_length(p_events) not between 1 and 25 or octet_length(p_events::text)>18000 then
    raise exception 'Invalid event batch' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock_shared(hashtextextended('private.usage_collection',0));
  select journey_resumed_at into resumed_at from private.usage_collection where enabled;
  if not found then return 0; end if;
  perform pg_advisory_xact_lock(hashtextextended('journey/'||p_owner::text,0));
  select consented_at into collection_start from private.customer_journey_consent where user_id=p_owner and consent_id=p_consent;
  if collection_start is null then return 0; end if;
  -- Bound bursts per account without preventing ordinary foreground timing pulses.
  if exists (select 1 from private.customer_journey_events where user_id=p_owner and event_at>=received-interval '1 day' limit 1 offset 11999) then return 0; end if;
  insert into private.customer_journey_events(user_id,client_id,visit_id,event_at,event_name,screen,metric,seconds,ip)
    select p_owner,x.id,x."sessionId",least(x.at,received),x.event,x.view,x.metric,coalesce(x.seconds,0),p_ip
    from jsonb_to_recordset(p_events) as x(id uuid,"sessionId" uuid,at timestamptz,event text,view text,metric text,seconds smallint)
    where x.at>=greatest(collection_start,resumed_at,received-interval '24 hours') and x.at<=received+interval '5 minutes'
    order by x.at,x.id
    on conflict (user_id,client_id) do nothing;
  get diagnostics accepted=row_count;
  return accepted;
end $$;

create function private.customer_journey_event(e private.customer_journey_events) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('seq',e.seq,'at',e.event_at,'sessionId',e.visit_id,'event',e.event_name,'view',e.screen,
    'metric',e.metric,'seconds',e.seconds,'ipSeenAt',case when e.ip is not null and e.event_at >= statement_timestamp()-interval '30 days' then e.received_at end,
    'ip',case when e.event_at >= statement_timestamp()-interval '30 days' then host(e.ip) end)
$$;

create function private.customer_journey_summary(p_customer uuid,p_since timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('id',u.id,'email',u.email,'createdAt',u.created_at,'sharing',c.user_id is not null,'consentedAt',c.consented_at,
    'lastSeen',stats.last_seen,'sessions',stats.visits,'eventCount',stats.actions,'activeSeconds',stats.seconds)
  from auth.users u left join private.customer_journey_consent c on c.user_id=u.id
  cross join lateral (
    select max(e.event_at) as last_seen,count(distinct e.visit_id) as visits,count(*) filter(where e.event_name<>'screen_time') as actions,
      coalesce(sum(e.seconds),0) as seconds
    from private.customer_journey_events e where e.user_id=c.user_id and e.event_at>=p_since
  ) stats where u.id=p_customer and not coalesce(u.is_anonymous,false) and u.email is not null
$$;

create function private.admin_customer_directory(p_days integer,p_search text,p_after uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare report jsonb; cutoff timestamptz; anchor timestamptz;
begin
  perform private.require_journey_operator();
  if p_days is null or p_days not in (7,30,90) or length(p_search)>254 then
    raise exception 'Invalid directory filter' using errcode='22023';
  end if;
  cutoff:=statement_timestamp()-make_interval(days=>p_days);
  if p_after is not null then
    select created_at into anchor from auth.users where id=p_after;
    if anchor is null then return jsonb_build_object('customers','[]'::jsonb,'nextAfter',null); end if;
  end if;
  with hits as materialized (
    select u.id,u.created_at from auth.users u
    where not coalesce(u.is_anonymous,false) and u.email is not null
      and (nullif(trim(p_search),'') is null or position(lower(trim(p_search)) in lower(u.email))>0 or u.id::text=trim(p_search))
      and (p_after is null or (u.created_at,u.id)<(anchor,p_after))
    order by u.created_at desc,u.id desc limit 26
  ), page as materialized (select * from hits order by created_at desc,id desc limit 25)
  select jsonb_build_object('customers',coalesce((select jsonb_agg(private.customer_journey_summary(id,cutoff) order by created_at desc,id desc) from page),'[]'::jsonb),
    'nextAfter',case when (select count(*) from hits)>25 then (select id from page order by created_at,id limit 1) end) into report;
  return report;
end $$;

create function private.admin_customer_journey(p_customer uuid,p_days integer,p_before bigint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare customer jsonb; cutoff timestamptz; report jsonb;
begin
  perform private.require_journey_operator();
  if p_days is null or p_days not in (7,30,90) or p_before<1 then raise exception 'Invalid journey filter' using errcode='22023'; end if;
  cutoff:=statement_timestamp()-make_interval(days=>p_days);
  customer:=private.customer_journey_summary(p_customer,cutoff);
  if customer is null then return null; end if;
  with hits as materialized (
    select e.* from private.customer_journey_events e where e.user_id=p_customer and e.event_at>=cutoff and e.event_name<>'screen_time' and (p_before is null or e.seq<p_before)
    order by e.seq desc limit 51
  ), page as materialized (select * from hits order by seq desc limit 50), screen_totals as (
    select screen,sum(seconds) as seconds from private.customer_journey_events where user_id=p_customer and event_at>=cutoff and seconds>0 group by screen
  )
  select jsonb_build_object('customer',customer,'recentIp',(
    select jsonb_build_object('address',host(e.ip),'at',e.received_at) from private.customer_journey_events e
    where e.user_id=p_customer and e.ip is not null and e.event_at>=greatest(cutoff,statement_timestamp()-interval '30 days')
    order by e.received_at desc,e.seq desc limit 1
  ),'events',coalesce((select jsonb_agg(private.customer_journey_event(p) order by p.seq desc)
    from page p),'[]'::jsonb),'nextBefore',case when (select count(*) from hits)>50 then (select min(seq) from page) end,
    'screens',coalesce((select jsonb_agg(jsonb_build_object('view',screen,'seconds',seconds) order by seconds desc,screen) from screen_totals),'[]'::jsonb))
    into report;
  return report;
end $$;

create function private.own_customer_journey_export(p_after bigint,p_limit integer,p_through bigint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); started timestamptz; consent uuid; high_water bigint; report jsonb;
begin
  perform private.require_forecast_owner(owner_id);
  if p_after is null or p_after<0 or p_limit is null or p_limit not between 1 and 250 or p_through<0 then raise exception 'Invalid export page' using errcode='22023'; end if;
  select consented_at,consent_id into started,consent from private.customer_journey_consent where user_id=owner_id;
  select coalesce(max(e.seq),0) into high_water from private.customer_journey_events e
    where e.user_id=owner_id and e.event_at>=statement_timestamp()-interval '90 days';
  with hits as materialized (
    select e.* from private.customer_journey_events e where e.user_id=owner_id and e.seq>p_after and e.seq<=coalesce(p_through,high_water) and e.event_at>=statement_timestamp()-interval '90 days'
    order by e.seq limit p_limit+1
  ), page as materialized (select * from hits order by seq limit p_limit)
  select jsonb_build_object('enabled',started is not null,'consentedAt',started,'consentId',consent,'highWater',high_water,'events',coalesce((select jsonb_agg(private.customer_journey_event(p) order by p.seq)
    from page p),'[]'::jsonb),'nextAfter',case when (select count(*) from hits)>p_limit then (select max(seq) from page) end)
    into report;
  return report;
end $$;

-- Mask IP addresses and exclude expired events at read time; remove their stored copies hourly even if nobody opens the app.
create function private.purge_expired_customer_journeys() returns void
language plpgsql security definer set search_path='' as $$
begin
  delete from private.customer_journey_events where event_at<statement_timestamp()-interval '90 days';
  update private.customer_journey_events set ip=null where ip is not null and event_at<statement_timestamp()-interval '30 days';
end $$;
do $$begin
  if exists(select 1 from pg_available_extensions where name='pg_cron') then
    execute 'create extension if not exists pg_cron with schema pg_catalog';
    perform cron.schedule('top1-customer-journey-retention','17 * * * *','select private.purge_expired_customer_journeys()');
  end if;
end $$;

create function public.customer_journey_preference(p_owner uuid,p_enabled boolean default null) returns jsonb
language sql security invoker set search_path='' as $$select private.customer_journey_preference(p_owner,p_enabled)$$;
create function public.record_customer_journey(p_owner uuid,p_consent uuid,p_proof text,p_ip inet,p_events jsonb) returns integer
language sql security invoker set search_path='' as $$select private.record_customer_journey(p_owner,p_consent,p_proof,p_ip,p_events)$$;
create function public.admin_customer_directory(p_days integer,p_search text default '',p_after uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$select private.admin_customer_directory(p_days,p_search,p_after)$$;
create function public.admin_customer_journey(p_customer uuid,p_days integer,p_before bigint default null) returns jsonb
language sql stable security invoker set search_path='' as $$select private.admin_customer_journey(p_customer,p_days,p_before)$$;
create function public.own_customer_journey_export(p_after bigint default 0,p_limit integer default 250,p_through bigint default null) returns jsonb
language sql stable security invoker set search_path='' as $$select private.own_customer_journey_export(p_after,p_limit,p_through)$$;

revoke all on function private.customer_journey_event(private.customer_journey_events),private.customer_journey_summary(uuid,timestamptz),
 private.purge_expired_customer_journeys() from public,anon,authenticated;
revoke all on function private.is_current_usage_operator(),private.require_journey_operator(),
 private.customer_journey_preference(uuid,boolean),public.customer_journey_preference(uuid,boolean),
 private.record_customer_journey(uuid,uuid,text,inet,jsonb),public.record_customer_journey(uuid,uuid,text,inet,jsonb),
 private.admin_customer_directory(integer,text,uuid),public.admin_customer_directory(integer,text,uuid),
 private.admin_customer_journey(uuid,integer,bigint),public.admin_customer_journey(uuid,integer,bigint),
 private.own_customer_journey_export(bigint,integer,bigint),public.own_customer_journey_export(bigint,integer,bigint) from public,anon,authenticated;
grant execute on function private.is_current_usage_operator(),private.require_journey_operator(),
 private.customer_journey_preference(uuid,boolean),public.customer_journey_preference(uuid,boolean),
 private.record_customer_journey(uuid,uuid,text,inet,jsonb),public.record_customer_journey(uuid,uuid,text,inet,jsonb),
 private.admin_customer_directory(integer,text,uuid),public.admin_customer_directory(integer,text,uuid),
 private.admin_customer_journey(uuid,integer,bigint),public.admin_customer_journey(uuid,integer,bigint),
 private.own_customer_journey_export(bigint,integer,bigint),public.own_customer_journey_export(bigint,integer,bigint) to authenticated;
commit;
