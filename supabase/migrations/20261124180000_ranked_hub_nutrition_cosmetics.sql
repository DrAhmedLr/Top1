-- Nutrition & barcode food logs + Athlete cosmetics / seasonal preferences
-- Strictly follows TOP1 least-privilege RLS and active-session enforcement.

create table public.nutrition_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_date date not null default current_date,
  meal_slot text not null default 'snack' check(meal_slot in ('breakfast','lunch','dinner','snack','post_workout')),
  source text not null default 'manual' check(source in ('manual','barcode','quick_preset')),
  barcode text check(barcode is null or (char_length(barcode) between 4 and 32 and barcode ~ '^[0-9A-Za-z-]+$')),
  product_name text not null check(char_length(btrim(product_name)) between 1 and 120),
  brand text check(brand is null or char_length(brand) <= 80),
  serving_size text check(serving_size is null or char_length(serving_size) <= 60),
  calories integer not null check(calories between 0 and 8000),
  protein_g numeric(6,1) not null default 0 check(protein_g between 0 and 600),
  carbs_g numeric(6,1) not null default 0 check(carbs_g between 0 and 1200),
  fat_g numeric(6,1) not null default 0 check(fat_g between 0 and 500),
  created_at timestamptz not null default now()
);

create index nutrition_logs_user_date_idx on public.nutrition_logs(user_id, logged_date desc, created_at desc);

alter table public.nutrition_logs enable row level security;
revoke all on public.nutrition_logs from public, anon, authenticated;
grant select, delete on public.nutrition_logs to authenticated;
grant insert(user_id, logged_date, meal_slot, source, barcode, product_name, brand, serving_size, calories, protein_g, carbs_g, fat_g)
  on public.nutrition_logs to authenticated;

create policy nutrition_logs_owner on public.nutrition_logs for all to authenticated
  using(user_id = (select auth.uid()) and (select private.has_active_session()))
  with check(user_id = (select auth.uid()) and (select private.has_active_session()));

create table public.athlete_cosmetics (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_border text not null default 'obsidian' check(profile_border in ('obsidian','bronze_crest','silver_edge','gold_aura','platinum_pulse','diamond_prism','top1_apex')),
  card_theme text not null default 'midnight' check(card_theme in ('midnight','cobalt','emerald','solar','crimson')),
  app_icon text not null default 'classic' check(app_icon in ('classic','apex_front','apex_side','star_emblem')),
  claimed_quests text[] not null default '{}'::text[] check(cardinality(claimed_quests) <= 64),
  daily_calorie_target integer not null default 2400 check(daily_calorie_target between 1000 and 7500),
  daily_protein_target integer not null default 160 check(daily_protein_target between 40 and 450),
  updated_at timestamptz not null default now()
);

alter table public.athlete_cosmetics enable row level security;
revoke all on public.athlete_cosmetics from public, anon, authenticated;
grant select on public.athlete_cosmetics to authenticated;
grant insert(user_id, profile_border, card_theme, app_icon, claimed_quests, daily_calorie_target, daily_protein_target),
      update(profile_border, card_theme, app_icon, claimed_quests, daily_calorie_target, daily_protein_target)
  on public.athlete_cosmetics to authenticated;

create policy athlete_cosmetics_owner on public.athlete_cosmetics for all to authenticated
  using(user_id = (select auth.uid()) and (select private.has_active_session()))
  with check(user_id = (select auth.uid()) and (select private.has_active_session()));

create function private.touch_athlete_cosmetics() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke all on function private.touch_athlete_cosmetics() from public, anon, authenticated;
create trigger athlete_cosmetics_updated_at before update on public.athlete_cosmetics
  for each row execute function private.touch_athlete_cosmetics();
