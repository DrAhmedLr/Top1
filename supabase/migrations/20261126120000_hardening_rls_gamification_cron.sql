-- Security & Integrity Hardening for Unified Mobile Social, Gamification & Weekly Self-Optimization Cron

-- 1. Harden athlete_gamification trigger: cap daily XP (2500/UTC day) & increment streak at most once per UTC day
alter table public.athlete_gamification
  add column if not exists last_workout_day date,
  add column if not exists daily_xp_day date,
  add column if not exists daily_xp_awarded integer not null default 0 check(daily_xp_awarded >= 0);

create or replace function private.award_workout_post_gamification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'UTC')::date;
  v_row public.athlete_gamification%rowtype;
  v_existing_daily integer := 0;
  v_award_xp integer;
  v_award_credits integer;
  v_next_streak integer;
begin
  insert into public.athlete_gamification(user_id)
  values (new.user_id)
  on conflict (user_id) do nothing;

  select * into v_row
  from public.athlete_gamification
  where user_id = new.user_id
  for update;

  if v_row.daily_xp_day = v_today then
    v_existing_daily := v_row.daily_xp_awarded;
  end if;

  v_award_xp := greatest(0, least(coalesce(new.xp_earned, 0), greatest(0, 2500 - v_existing_daily)));
  v_award_credits := case when v_award_xp > 0 then round(v_award_xp / 5.0)::integer else 0 end;

  if v_row.last_workout_day = v_today then
    v_next_streak := greatest(1, v_row.streak_days);
  elsif v_row.last_workout_day = (v_today - 1) then
    v_next_streak := v_row.streak_days + 1;
  else
    v_next_streak := 1;
  end if;

  update public.athlete_gamification
    set xp = xp + v_award_xp,
        credits = credits + v_award_credits,
        streak_days = v_next_streak,
        longest_streak = greatest(longest_streak, v_next_streak),
        last_workout_day = v_today,
        daily_xp_day = v_today,
        daily_xp_awarded = v_existing_daily + v_award_xp,
        updated_at = now()
  where user_id = new.user_id;

  return new;
end $$;

-- 2. Harden friend_links blocking & prevent blocked users from unblocking themselves or viewing blocker posts
alter table public.friend_links
  add column if not exists blocked_by uuid references auth.users(id) on delete set null;

create or replace function private.track_friend_link_blocker()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'blocked' and old.status is distinct from 'blocked' then
    new.blocked_by := (select auth.uid());
  end if;
  return new;
end $$;
revoke all on function private.track_friend_link_blocker() from public, anon, authenticated;
drop trigger if exists friend_links_track_blocker on public.friend_links;
create trigger friend_links_track_blocker before update on public.friend_links
  for each row execute function private.track_friend_link_blocker();

drop policy if exists friend_links_delete on public.friend_links;
create policy friend_links_delete on public.friend_links for delete to authenticated
  using(
    (select private.has_active_session())
    and (
      (status <> 'blocked' and (user_id = (select auth.uid()) or friend_user_id = (select auth.uid())))
      or (status = 'blocked' and blocked_by = (select auth.uid()))
    )
  );

drop policy if exists workout_posts_read on public.workout_posts;
create policy workout_posts_read on public.workout_posts for select to authenticated
  using(
    (select private.has_active_session())
    and not exists (
      select 1 from public.friend_links blk
      where blk.status = 'blocked'
        and (
          (blk.user_id = workout_posts.user_id and blk.friend_user_id = (select auth.uid()))
          or (blk.friend_user_id = workout_posts.user_id and blk.user_id = (select auth.uid()))
        )
    )
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

-- 3. Service-role-only self-optimization cron reader & audit persistence (fixes broken /api/cron/self-optimize)
create table if not exists private.optimization_runs (
  id bigint generated always as identity primary key,
  version text not null,
  decision text not null,
  sample_size integer not null default 0 check(sample_size >= 0),
  result_json jsonb not null,
  ran_at timestamptz not null default now()
);
alter table private.optimization_runs enable row level security;
revoke all on private.optimization_runs from public, anon, authenticated;

create or replace function public.read_self_optimization_records(p_limit integer default 2000)
returns table (
  user_id uuid,
  metric text,
  model_version text,
  issued_at timestamptz,
  probability numeric,
  issued_probability numeric,
  reached boolean
)
language sql
security definer
set search_path = ''
as $$
  select
    gf.user_id,
    gf.metric,
    gf.model_version,
    gf.issued_at,
    gf.probability,
    gf.issued_probability,
    fo.reached
  from private.forecast_contributions fc
  join private.goal_forecasts gf on gf.id = fc.forecast_id
  left join private.forecast_outcomes fo on fo.forecast_id = gf.id
  order by gf.issued_at asc
  limit greatest(1, least(5000, coalesce(p_limit, 2000)));
$$;
revoke all on function public.read_self_optimization_records(integer) from public, anon, authenticated;

create or replace function public.record_self_optimization_run(
  p_version text,
  p_decision text,
  p_sample_size integer,
  p_result_json jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into private.optimization_runs(version, decision, sample_size, result_json)
  values (p_version, p_decision, greatest(0, coalesce(p_sample_size, 0)), coalesce(p_result_json, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.record_self_optimization_run(text, text, integer, jsonb) from public, anon, authenticated;
