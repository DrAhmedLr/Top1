-- Unified TOP1% Mobile Gym, Social, Gamification, Shop & Strava Schema
-- Strictly follows TOP1 least-privilege RLS, active-session checks, and tamper-resistant triggers/RPCs.

-- 1. Workout Presets & Folders
create table public.workout_folders (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(char_length(btrim(name)) between 1 and 60),
  sort_order integer not null default 0 check(sort_order between 0 and 10000),
  created_at timestamptz not null default now()
);
create index workout_folders_user_idx on public.workout_folders(user_id, sort_order asc);
alter table public.workout_folders enable row level security;
revoke all on public.workout_folders from public, anon, authenticated;
grant select, delete on public.workout_folders to authenticated;
grant insert(user_id, name, sort_order), update(name, sort_order) on public.workout_folders to authenticated;
create policy workout_folders_owner on public.workout_folders for all to authenticated
  using(user_id = (select auth.uid()) and (select private.has_active_session()))
  with check(user_id = (select auth.uid()) and (select private.has_active_session()));

create table public.workout_presets (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid references public.workout_folders(id) on delete set null,
  name text not null check(char_length(btrim(name)) between 1 and 100),
  description text not null default '' check(char_length(description) <= 400),
  is_public boolean not null default false,
  exercises_json jsonb not null default '[]'::jsonb check(jsonb_typeof(exercises_json)='array' and octet_length(exercises_json::text)<=65536),
  downloads_count integer not null default 0 check(downloads_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_presets_user_idx on public.workout_presets(user_id, updated_at desc);
alter table public.workout_presets enable row level security;
revoke all on public.workout_presets from public, anon, authenticated;
grant select, delete on public.workout_presets to authenticated;
grant insert(user_id, folder_id, name, description, is_public, exercises_json),
      update(folder_id, name, description, is_public, exercises_json) on public.workout_presets to authenticated;
create policy workout_presets_read on public.workout_presets for select to authenticated
  using((user_id = (select auth.uid()) or is_public = true) and (select private.has_active_session()));
create policy workout_presets_insert on public.workout_presets for insert to authenticated
  with check(user_id = (select auth.uid()) and (select private.has_active_session()));
create policy workout_presets_update on public.workout_presets for update to authenticated
  using(user_id = (select auth.uid()) and (select private.has_active_session()))
  with check(user_id = (select auth.uid()) and (select private.has_active_session()));
create policy workout_presets_delete on public.workout_presets for delete to authenticated
  using(user_id = (select auth.uid()) and (select private.has_active_session()));

-- 2. Social Graph (Friends & Requests) — defined before workout_posts so friends-visibility RLS can reference it
create table public.friend_links (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(user_id <> friend_user_id),
  unique(user_id, friend_user_id)
);
create index friend_links_friend_status_idx on public.friend_links(friend_user_id, status);
alter table public.friend_links enable row level security;
revoke all on public.friend_links from public, anon, authenticated;
grant select, delete on public.friend_links to authenticated;
grant insert(user_id, friend_user_id, status), update(status) on public.friend_links to authenticated;
create policy friend_links_read on public.friend_links for select to authenticated
  using((user_id = (select auth.uid()) or friend_user_id = (select auth.uid())) and (select private.has_active_session()));
create policy friend_links_request on public.friend_links for insert to authenticated
  with check(user_id = (select auth.uid()) and status = 'pending' and (select private.has_active_session()));
create policy friend_links_accept on public.friend_links for update to authenticated
  using(friend_user_id = (select auth.uid()) and status = 'pending' and (select private.has_active_session()))
  with check(friend_user_id = (select auth.uid()) and status = 'accepted' and (select private.has_active_session()));
create policy friend_links_block on public.friend_links for update to authenticated
  using((user_id = (select auth.uid()) or friend_user_id = (select auth.uid())) and (select private.has_active_session()))
  with check((user_id = (select auth.uid()) or friend_user_id = (select auth.uid())) and status = 'blocked' and (select private.has_active_session()));
create policy friend_links_delete on public.friend_links for delete to authenticated
  using((user_id = (select auth.uid()) or friend_user_id = (select auth.uid())) and (select private.has_active_session()));

-- 3. Social Workout Posts (with live bodygraph heatmap, media, friend tags, Strava link)
create table public.workout_posts (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  preset_id uuid references public.workout_presets(id) on delete set null,
  title text not null check(char_length(btrim(title)) between 1 and 120),
  caption text not null default '' check(char_length(caption) <= 500),
  notes text not null default '' check(char_length(notes) <= 2000),
  duration_seconds integer not null default 0 check(duration_seconds between 0 and 86400),
  total_volume_kg numeric(10,1) not null default 0 check(total_volume_kg between 0 and 500000),
  total_sets integer not null default 0 check(total_sets between 0 and 500),
  visibility text not null default 'friends' check(visibility in ('public','friends','private')),
  exercises_json jsonb not null default '[]'::jsonb check(jsonb_typeof(exercises_json)='array' and octet_length(exercises_json::text)<=131072),
  muscle_heatmap_json jsonb not null default '{}'::jsonb check(jsonb_typeof(muscle_heatmap_json)='object' and octet_length(muscle_heatmap_json::text)<=8192),
  media_urls text[] not null default '{}'::text[] check(cardinality(media_urls) <= 8),
  tagged_user_ids uuid[] not null default '{}'::uuid[] check(cardinality(tagged_user_ids) <= 12),
  strava_activity_id text check(strava_activity_id is null or char_length(strava_activity_id) <= 64),
  xp_earned integer not null default 100 check(xp_earned between 0 and 50000),
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_posts_user_idx on public.workout_posts(user_id, created_at desc);
create index workout_posts_visibility_idx on public.workout_posts(visibility, created_at desc);
alter table public.workout_posts enable row level security;
revoke all on public.workout_posts from public, anon, authenticated;
grant select, delete on public.workout_posts to authenticated;
grant insert(user_id, preset_id, title, caption, notes, duration_seconds, total_volume_kg, total_sets, visibility, exercises_json, muscle_heatmap_json, media_urls, tagged_user_ids, strava_activity_id, started_at, completed_at),
      update(title, caption, notes, visibility, exercises_json, muscle_heatmap_json, media_urls, tagged_user_ids, strava_activity_id)
  on public.workout_posts to authenticated;
create policy workout_posts_read on public.workout_posts for select to authenticated
  using(
    (select private.has_active_session())
    and (
      user_id = (select auth.uid())
      or visibility = 'public'
      or (
        visibility = 'friends'
        and exists (
          select 1 from public.friend_links fl
          where fl.status = 'accepted'
            and (
              (fl.user_id = workout_posts.user_id and fl.friend_user_id = (select auth.uid()))
              or (fl.friend_user_id = workout_posts.user_id and fl.user_id = (select auth.uid()))
            )
        )
      )
    )
  );
create policy workout_posts_write on public.workout_posts for insert to authenticated
  with check(user_id = (select auth.uid()) and (select private.has_active_session()));
create policy workout_posts_update on public.workout_posts for update to authenticated
  using(user_id = (select auth.uid()) and (select private.has_active_session()))
  with check(user_id = (select auth.uid()) and (select private.has_active_session()));
create policy workout_posts_delete on public.workout_posts for delete to authenticated
  using(user_id = (select auth.uid()) and (select private.has_active_session()));

-- 4. Post Reactions & Comments (strictly inherit parent workout_post visibility)
create table public.post_reactions (
  id uuid primary key default extensions.uuid_generate_v4(),
  post_id uuid not null references public.workout_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction_key text not null check(char_length(reaction_key) between 1 and 16),
  created_at timestamptz not null default now(),
  unique(post_id, user_id, reaction_key)
);
alter table public.post_reactions enable row level security;
revoke all on public.post_reactions from public, anon, authenticated;
grant select, delete on public.post_reactions to authenticated;
grant insert(post_id, user_id, reaction_key) on public.post_reactions to authenticated;
create policy post_reactions_read on public.post_reactions for select to authenticated
  using(
    (select private.has_active_session())
    and exists (select 1 from public.workout_posts wp where wp.id = post_id)
  );
create policy post_reactions_owner on public.post_reactions for insert to authenticated
  with check(
    user_id = (select auth.uid())
    and (select private.has_active_session())
    and exists (select 1 from public.workout_posts wp where wp.id = post_id)
  );
create policy post_reactions_del on public.post_reactions for delete to authenticated
  using(user_id = (select auth.uid()) and (select private.has_active_session()));

create table public.post_comments (
  id uuid primary key default extensions.uuid_generate_v4(),
  post_id uuid not null references public.workout_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check(char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index post_comments_post_idx on public.post_comments(post_id, created_at asc);
alter table public.post_comments enable row level security;
revoke all on public.post_comments from public, anon, authenticated;
grant select, delete on public.post_comments to authenticated;
grant insert(post_id, user_id, body) on public.post_comments to authenticated;
create policy post_comments_read on public.post_comments for select to authenticated
  using(
    (select private.has_active_session())
    and exists (select 1 from public.workout_posts wp where wp.id = post_id)
  );
create policy post_comments_owner on public.post_comments for insert to authenticated
  with check(
    user_id = (select auth.uid())
    and (select private.has_active_session())
    and exists (select 1 from public.workout_posts wp where wp.id = post_id)
  );
create policy post_comments_del on public.post_comments for delete to authenticated
  using(user_id = (select auth.uid()) and (select private.has_active_session()));

-- 5. Gamification State (read-only for authenticated clients; mutated only via verified triggers & RPCs)
create table public.athlete_gamification (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0 check(xp >= 0),
  credits integer not null default 250 check(credits >= 0),
  streak_days integer not null default 0 check(streak_days >= 0),
  longest_streak integer not null default 0 check(longest_streak >= 0),
  owned_cosmetics text[] not null default '{}'::text[] check(cardinality(owned_cosmetics) <= 128),
  claimed_levels integer[] not null default '{}'::integer[] check(cardinality(claimed_levels) <= 100),
  daily_deals_json jsonb not null default '[]'::jsonb check(jsonb_typeof(daily_deals_json)='array' and octet_length(daily_deals_json::text)<=8192),
  strava_connected boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.athlete_gamification enable row level security;
revoke all on public.athlete_gamification from public, anon, authenticated;
grant select on public.athlete_gamification to authenticated;
create policy athlete_gamification_read on public.athlete_gamification for select to authenticated
  using(user_id = (select auth.uid()) and (select private.has_active_session()));

-- Server-computed XP on workout_posts insert + atomic gamification award trigger
create function private.compute_workout_post_xp()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.xp_earned := greatest(
    50,
    least(2500, 100 + coalesce(new.total_sets, 0) * 12 + round(coalesce(new.total_volume_kg, 0) / 200.0)::integer)
  );
  return new;
end $$;
revoke all on function private.compute_workout_post_xp() from public, anon, authenticated;
create trigger workout_posts_compute_xp before insert on public.workout_posts
  for each row execute function private.compute_workout_post_xp();

create function private.award_workout_post_gamification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credits integer := round(new.xp_earned / 5.0)::integer;
begin
  insert into public.athlete_gamification(user_id, xp, credits, streak_days, longest_streak)
  values (new.user_id, new.xp_earned, 250 + v_credits, 1, 1)
  on conflict (user_id) do update
    set xp = public.athlete_gamification.xp + new.xp_earned,
        credits = public.athlete_gamification.credits + v_credits,
        streak_days = greatest(1, public.athlete_gamification.streak_days + 1),
        longest_streak = greatest(public.athlete_gamification.longest_streak, public.athlete_gamification.streak_days + 1),
        updated_at = now();
  return new;
end $$;
revoke all on function private.award_workout_post_gamification() from public, anon, authenticated;
create trigger workout_posts_award_gamification after insert on public.workout_posts
  for each row execute function private.award_workout_post_gamification();

-- Verified gamification mutation RPC (enforces XP thresholds, server-side prices, and atomic credit balance)
create function public.apply_gamification_action(
  p_action text,
  p_level integer default null,
  p_deal_id text default null,
  p_strava_connected boolean default null,
  p_daily_deals jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.athlete_gamification%rowtype;
  v_earned_level integer;
  v_price integer;
begin
  if v_uid is null or not (select private.has_active_session()) then
    raise exception 'Active authenticated session required.' using errcode = '42501';
  end if;

  insert into public.athlete_gamification(user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  select * into v_row
  from public.athlete_gamification
  where user_id = v_uid
  for update;

  if p_action = 'claim_level' then
    if p_level is null or p_level < 1 or p_level > 100 then
      raise exception 'Invalid level.' using errcode = '22023';
    end if;
    v_earned_level := greatest(1, floor(v_row.xp / 250.0)::integer + 1);
    if p_level > v_earned_level then
      raise exception 'Level not reached yet.' using errcode = '22023';
    end if;
    if p_level = any(v_row.claimed_levels) then
      raise exception 'Level reward already claimed.' using errcode = '23505';
    end if;
    update public.athlete_gamification
      set claimed_levels = array_append(claimed_levels, p_level),
          credits = credits + (100 + p_level * 25),
          updated_at = now()
    where user_id = v_uid
    returning * into v_row;

  elsif p_action = 'buy_deal' then
    v_price := case p_deal_id
      when 'border_apex_obsidian' then 240
      when 'card_carbon_telemetry' then 210
      when 'title_top1_hybrid' then 180
      when 'border_solar_crest' then 175
      when 'card_glacier_pulse' then 220
      when 'emote_pr_bell' then 110
      else null
    end;
    if v_price is null then
      raise exception 'Deal not found.' using errcode = 'P0002';
    end if;
    if p_deal_id = any(v_row.owned_cosmetics) then
      raise exception 'Item already owned.' using errcode = '23505';
    end if;
    if v_row.credits < v_price then
      raise exception 'Insufficient credits.' using errcode = '22023';
    end if;
    update public.athlete_gamification
      set credits = credits - v_price,
          owned_cosmetics = array_append(owned_cosmetics, p_deal_id),
          updated_at = now()
    where user_id = v_uid
    returning * into v_row;

  elsif p_action = 'reroll_deals' then
    if v_row.credits < 50 then
      raise exception 'Need 50 credits to reroll daily deals.' using errcode = '22023';
    end if;
    if p_daily_deals is null or jsonb_typeof(p_daily_deals) <> 'array' or octet_length(p_daily_deals::text) > 8192 then
      raise exception 'Invalid deals payload.' using errcode = '22023';
    end if;
    update public.athlete_gamification
      set credits = credits - 50,
          daily_deals_json = p_daily_deals,
          updated_at = now()
    where user_id = v_uid
    returning * into v_row;

  elsif p_action = 'set_strava' then
    update public.athlete_gamification
      set strava_connected = coalesce(p_strava_connected, false),
          updated_at = now()
    where user_id = v_uid
    returning * into v_row;

  else
    raise exception 'Unsupported gamification action.' using errcode = '22023';
  end if;

  return to_jsonb(v_row);
end $$;

revoke all on function public.apply_gamification_action(text, integer, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.apply_gamification_action(text, integer, text, boolean, jsonb) to authenticated;

-- 6. Community Feature Requests Board
create table public.feature_requests (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check(char_length(btrim(title)) between 3 and 120),
  description text not null default '' check(char_length(description) <= 600),
  status text not null default 'open' check(status in ('open','planned','shipped')),
  votes_count integer not null default 1 check(votes_count >= 0),
  created_at timestamptz not null default now()
);
alter table public.feature_requests enable row level security;
revoke all on public.feature_requests from public, anon, authenticated;
grant select, delete on public.feature_requests to authenticated;
grant insert(user_id, title, description) on public.feature_requests to authenticated;
create policy feature_requests_read on public.feature_requests for select to authenticated
  using((select private.has_active_session()));
create policy feature_requests_owner on public.feature_requests for insert to authenticated
  with check(user_id = (select auth.uid()) and (select private.has_active_session()));
create policy feature_requests_del on public.feature_requests for delete to authenticated
  using(user_id = (select auth.uid()) and (select private.has_active_session()));

-- 7. Operator Backend Health Summary RPC (for /admin Backend & Metrics Inspector)
create function public.admin_backend_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_journey_operator();

  return jsonb_build_object(
    'profiles', (select count(*) from public.profiles),
    'metricLogs', (select count(*) from public.metric_logs),
    'trainingEvents', (select count(*) from public.training_events),
    'personalWorkspaces', (select count(*) from public.personal_workspaces),
    'wearableSnapshots', (select count(*) from public.wearable_daily_snapshots),
    'nutritionLogs', (select count(*) from public.nutrition_logs),
    'customExercises', (select count(*) from public.custom_exercises),
    'workoutPosts', (select count(*) from public.workout_posts),
    'workoutPresets', (select count(*) from public.workout_presets),
    'featureRequests', (select count(*) from public.feature_requests)
  );
end $$;

revoke all on function public.admin_backend_summary() from public, anon, authenticated;
grant execute on function public.admin_backend_summary() to authenticated;

-- Timestamp touch trigger
create function private.touch_unified_updated_at() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke all on function private.touch_unified_updated_at() from public, anon, authenticated;
create trigger workout_presets_updated_at before update on public.workout_presets
  for each row execute function private.touch_unified_updated_at();
create trigger workout_posts_updated_at before update on public.workout_posts
  for each row execute function private.touch_unified_updated_at();
create trigger friend_links_updated_at before update on public.friend_links
  for each row execute function private.touch_unified_updated_at();
create trigger athlete_gamification_updated_at before update on public.athlete_gamification
  for each row execute function private.touch_unified_updated_at();
