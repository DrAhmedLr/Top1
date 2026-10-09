begin;
create extension if not exists "uuid-ossp" with schema extensions;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  username text unique check (username ~ '^[a-z0-9][a-z0-9_-]{2,29}$'),
  age integer not null default 23 check (age between 18 and 120),
  sex text not null default 'male' check (sex in ('male','female')),
  weight_kg numeric(5,2) not null default 70 check (weight_kg between 25 and 350),
  height_cm numeric(5,2) not null default 175 check (height_cm between 100 and 240),
  is_public boolean not null default false,
  public_summary jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint public_requires_username check (not is_public or username is not null)
);
create table public.metric_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  metric_id text not null,
  metric_value numeric(10,3) not null check (metric_value >= 0 and metric_value < 100000),
  constraint metric_range check (case metric_id
    when 'apob' then metric_value between 1 and 300
    when 'lpa' then metric_value between .1 and 1000
    when 'fasting_insulin' then metric_value between .1 and 100
    when 'hscrp' then metric_value between .01 and 100
    when 'hba1c' then metric_value between 3 and 15
    when 'homocysteine' then metric_value between 1 and 100
    when 'cystatin_c' then metric_value between .1 and 10
    when 'ggt' then metric_value between 1 and 1000
    when 'vo2_max' then metric_value between 10 and 100
    when 'zone2_power' then metric_value between .1 and 8
    when 'pefr' then metric_value between 10 and 200
    when 'rhr' then metric_value between 25 and 150
    when 'hrv' then metric_value between 1 and 250
    when 'hrr_1min' then metric_value between 0 and 100
    when 'bp_systolic' then metric_value between 70 and 240
    when 'body_fat' then metric_value between 3 and 60
    when 'visceral_fat' then metric_value between 1 and 500
    when 'grip_strength' then metric_value between 1 and 120
    when 'cmj' then metric_value between 1 and 120
    when 'broad_jump' then metric_value between .1 and 4
    when 'squat_1rm' then metric_value between .1 and 4
    when 'deadlift_1rm' then metric_value between .1 and 5
    when 'bench_1rm' then metric_value between .1 and 3
    when 'pullup_1rm' then metric_value between 0 and 2
    when 'farmers_carry' then metric_value between 1 and 300
    when 'sit_to_stand' then metric_value between 1 and 60
    when 'ankle_dorsiflexion' then metric_value between 1 and 70
    when 'total_sleep' then metric_value between 120 and 900
    when 'sleep_efficiency' then metric_value between 30 and 100
    when 'circadian_regularity' then metric_value between 0 and 100
    when 'single_leg_balance' then metric_value between 0 and 180
    when 'reaction_time' then metric_value between 100 and 1000
    else false end),
  created_at timestamptz not null default now()
);
create index idx_metric_logs_user_metric on public.metric_logs(user_id,metric_id,recorded_at desc,id desc);
-- The UNIQUE username constraint already supplies a username index.
create table public.profile_imports (
  user_id uuid not null references public.profiles(id) on delete cascade,
  import_id text not null check (length(import_id) between 1 and 100),
  created_at timestamptz not null default now(),
  primary key(user_id,import_id)
);
alter table public.profiles enable row level security;
alter table public.metric_logs enable row level security;
alter table public.profile_imports enable row level security;
create policy "Read profile" on public.profiles for select to anon,authenticated using ((select auth.uid()) = id or is_public);
create policy "Insert own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "Update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Manage own metric logs" on public.metric_logs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Manage own imports" on public.profile_imports for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select on public.profiles to anon;
grant select,insert,update on public.profiles to authenticated;
grant select,insert,update,delete on public.metric_logs,public.profile_imports to authenticated;

-- Transactional migration: one auth.uid() scope, serialized per account. The
-- receipt and data commit together. Existing cloud values take precedence.
create function public.migrate_local_profile(p_import_id text, p_demographics jsonb, p_metrics jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); item record;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
  if exists(select 1 from public.profile_imports where user_id=uid and import_id=p_import_id) then return; end if;
  if pg_catalog.jsonb_typeof(p_metrics) <> 'object' then raise exception 'Invalid metrics'; end if;
  insert into public.profiles(id,age,sex,weight_kg,height_cm)
  values(uid,(p_demographics->>'age')::integer,p_demographics->>'sex',(p_demographics->>'weight')::numeric,(p_demographics->>'height')::numeric)
  on conflict(id) do nothing;
  for item in select key,value from pg_catalog.jsonb_each_text(p_metrics) loop
    if not exists(select 1 from public.metric_logs where user_id=uid and metric_id=item.key) then
      insert into public.metric_logs(user_id,metric_id,metric_value) values(uid,item.key,item.value::numeric);
    end if;
  end loop;
  insert into public.profile_imports(user_id,import_id) values(uid,p_import_id);
end $$;

-- Saves a complete current profile and changed measurements atomically. Removed
-- measurements are removed from logs too; unchanged measurements aren't duplicated.
create function public.save_profile(p_demographics jsonb,p_metrics jsonb,p_username text,p_is_public boolean,p_summary jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); item record; previous numeric;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
  if pg_catalog.jsonb_typeof(p_metrics) <> 'object' then raise exception 'Invalid metrics'; end if;
  insert into public.profiles(id,age,sex,weight_kg,height_cm,username,is_public,public_summary)
  values(uid,(p_demographics->>'age')::integer,p_demographics->>'sex',(p_demographics->>'weight')::numeric,(p_demographics->>'height')::numeric,p_username,p_is_public,p_summary)
  on conflict(id) do update set age=excluded.age,sex=excluded.sex,weight_kg=excluded.weight_kg,height_cm=excluded.height_cm,username=excluded.username,is_public=excluded.is_public,public_summary=excluded.public_summary,updated_at=now();
  delete from public.metric_logs where user_id=uid and not (p_metrics ? metric_id);
  for item in select key,value from pg_catalog.jsonb_each_text(p_metrics) loop
    select metric_value into previous from public.metric_logs where user_id=uid and metric_id=item.key order by recorded_at desc,id desc limit 1;
    if previous is distinct from item.value::numeric then
      insert into public.metric_logs(user_id,metric_id,metric_value) values(uid,item.key,item.value::numeric);
    end if;
  end loop;
end $$;
revoke all on function public.migrate_local_profile(text,jsonb,jsonb) from public,anon;
revoke all on function public.save_profile(jsonb,jsonb,text,boolean,jsonb) from public,anon;
grant execute on function public.migrate_local_profile(text,jsonb,jsonb),public.save_profile(jsonb,jsonb,text,boolean,jsonb) to authenticated;
commit;
