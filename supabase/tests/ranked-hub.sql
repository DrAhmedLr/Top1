begin;
do $$
declare
  u1 uuid := '11111111-1111-4111-8111-111111111111';
  u2 uuid := '22222222-2222-4222-8222-222222222222';
  c int;
begin
  if has_table_privilege('anon','public.nutrition_logs','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'Anon privileges leaked on nutrition_logs';
  end if;
  if has_table_privilege('anon','public.athlete_cosmetics','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'Anon privileges leaked on athlete_cosmetics';
  end if;
  if has_table_privilege('authenticated','public.nutrition_logs','TRUNCATE') then
    raise exception 'Authenticated TRUNCATE leaked on nutrition_logs';
  end if;

  insert into auth.users(id, email) values (u1, 'u1-ranked@test.invalid'), (u2, 'u2-ranked@test.invalid') on conflict do nothing;

  execute format('set local role authenticated');
  execute format('set local request.jwt.claims = %L', json_build_object('sub', u1, 'session_id', u1)::text);

  insert into public.nutrition_logs(user_id, logged_date, meal_slot, source, barcode, product_name, calories, protein_g, carbs_g, fat_g)
  values (u1, '2026-11-24', 'post_workout', 'barcode', '3017620422003', 'Whey Isolate Shake', 240, 48, 6, 2);

  insert into public.athlete_cosmetics(user_id, profile_border, card_theme, claimed_quests, daily_calorie_target, daily_protein_target)
  values (u1, 'gold_aura', 'cobalt', array['welcome_calibration'], 2650, 175);

  select count(*) into c from public.nutrition_logs;
  if c <> 1 then raise exception 'Expected 1 nutrition log for u1, got %', c; end if;

  -- Switch to u2 and verify strict isolation
  execute format('set local request.jwt.claims = %L', json_build_object('sub', u2, 'session_id', u2)::text);
  select count(*) into c from public.nutrition_logs;
  if c <> 0 then raise exception 'Cross-user nutrition_logs leak: %', c; end if;
  select count(*) into c from public.athlete_cosmetics;
  if c <> 0 then raise exception 'Cross-user athlete_cosmetics leak: %', c; end if;

  reset role;
end $$;
rollback;
select 'Ranked hub nutrition_logs and athlete_cosmetics RLS checks passed' as result;
