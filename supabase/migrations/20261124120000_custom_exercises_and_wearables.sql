-- User-created custom exercises (with inferred fractional muscle & joint-stress profile)
-- and rolling smartwatch daily biometric snapshots for adaptive readiness & recovery.

create table public.custom_exercises (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null check(slug ~ '^[a-z0-9_]{3,80}$'),
  name text not null check(char_length(trim(name)) between 2 and 120),
  pattern text not null check(pattern in (
    'horizontal_push','incline_push','vertical_push',
    'horizontal_pull','vertical_pull','hinge','squat','lunge_unilateral',
    'core_stability','elbow_flexion','elbow_extension',
    'shoulder_isolation','calf_isolation','aerobic_steady','aerobic_intervals'
  )),
  is_compound boolean not null default true,
  primary_muscles text[] not null check(cardinality(primary_muscles) between 1 and 3),
  secondary_muscles text[] not null default '{}'::text[] check(cardinality(secondary_muscles) <= 4),
  required_equipment text[] not null default '{}'::text[] check(cardinality(required_equipment) <= 6),
  mode text not null default 'reps' check(mode in ('reps','seconds')),
  default_amount integer not null default 10 check(default_amount between 1 and 7200),
  default_rest_seconds integer not null default 90 check(default_rest_seconds between 0 and 600),
  inferred_profile jsonb not null check(jsonb_typeof(inferred_profile)='object' and octet_length(inferred_profile::text)<=8192),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, slug)
);

create index custom_exercises_user_idx on public.custom_exercises(user_id, created_at desc);

alter table public.custom_exercises enable row level security;
revoke all on public.custom_exercises from public, anon, authenticated;
grant select, delete on public.custom_exercises to authenticated;
grant insert(user_id, slug, name, pattern, is_compound, primary_muscles, secondary_muscles, required_equipment, mode, default_amount, default_rest_seconds, inferred_profile),
      update(name, pattern, is_compound, primary_muscles, secondary_muscles, required_equipment, mode, default_amount, default_rest_seconds, inferred_profile)
  on public.custom_exercises to authenticated;

create policy custom_exercises_owner on public.custom_exercises for all to authenticated
  using(user_id = (select auth.uid()) and (select private.has_active_session()))
  with check(user_id = (select auth.uid()) and (select private.has_active_session()));

create function private.touch_custom_exercise() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke all on function private.touch_custom_exercise() from public, anon, authenticated;
create trigger custom_exercises_updated_at before update on public.custom_exercises
  for each row execute function private.touch_custom_exercise();

-- Smartwatch rolling daily biometric snapshots (HRV RMSSD, RHR, sleep, wrist temp, cardio TRIMP)
create table public.wearable_daily_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  source text not null check(source in (
    'apple_health','apple_watch','health_connect','google_health',
    'garmin','oura','whoop','polar','coros','fitbit','quest_diagnostics'
  )),
  hrv_rmssd_ms numeric(5,1) check(hrv_rmssd_ms is null or hrv_rmssd_ms between 5 and 300),
  resting_hr_bpm numeric(4,1) check(resting_hr_bpm is null or resting_hr_bpm between 28 and 130),
  total_sleep_minutes integer check(total_sleep_minutes is null or total_sleep_minutes between 60 and 960),
  sleep_efficiency_percent numeric(4,1) check(sleep_efficiency_percent is null or sleep_efficiency_percent between 30 and 100),
  wrist_temp_deviation_c numeric(4,2) check(wrist_temp_deviation_c is null or wrist_temp_deviation_c between -3 and 4),
  respiratory_rate_bpm numeric(4,1) check(respiratory_rate_bpm is null or respiratory_rate_bpm between 6 and 35),
  cardio_load_trimp numeric(5,1) check(cardio_load_trimp is null or cardio_load_trimp between 0 and 600),
  vo2_max numeric(4,1) check(vo2_max is null or vo2_max between 15 and 95),
  gps_run_5k_minutes numeric(5,2) check(gps_run_5k_minutes is null or gps_run_5k_minutes between 12 and 90),
  updated_at timestamptz not null default now(),
  primary key(user_id, snapshot_date)
);

create index wearable_daily_user_date_idx on public.wearable_daily_snapshots(user_id, snapshot_date desc);

alter table public.wearable_daily_snapshots enable row level security;
revoke all on public.wearable_daily_snapshots from public, anon, authenticated;
grant select, delete on public.wearable_daily_snapshots to authenticated;
grant insert(user_id, snapshot_date, source, hrv_rmssd_ms, resting_hr_bpm, total_sleep_minutes, sleep_efficiency_percent, wrist_temp_deviation_c, respiratory_rate_bpm, cardio_load_trimp, vo2_max, gps_run_5k_minutes),
      update(source, hrv_rmssd_ms, resting_hr_bpm, total_sleep_minutes, sleep_efficiency_percent, wrist_temp_deviation_c, respiratory_rate_bpm, cardio_load_trimp, vo2_max, gps_run_5k_minutes)
  on public.wearable_daily_snapshots to authenticated;

create policy wearable_daily_owner on public.wearable_daily_snapshots for all to authenticated
  using(user_id = (select auth.uid()) and (select private.has_active_session()))
  with check(user_id = (select auth.uid()) and (select private.has_active_session()));

create function private.touch_wearable_daily() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke all on function private.touch_wearable_daily() from public, anon, authenticated;
create trigger wearable_daily_updated_at before update on public.wearable_daily_snapshots
  for each row execute function private.touch_wearable_daily();
