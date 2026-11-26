-- Verify RLS, least-privilege grants, anti-tamper gamification RPCs, and operator guardrails on unified mobile/social tables.
do $$
declare
  u1 uuid := 'aaaaaaaa-1111-4111-8111-111111111111';
  u2 uuid := 'bbbbbbbb-2222-4222-8222-222222222222';
  u3 uuid := 'dddddddd-4444-4444-8444-444444444444';
  public_preset_id uuid;
  private_post_id uuid;
  friends_post_id uuid;
  friend_link_id uuid;
  res jsonb;
  cnt integer;
begin
  insert into auth.users(id, email)
    values (u1, 'u1@top1.test'), (u2, 'u2@top1.test'), (u3, 'u3@top1.test')
    on conflict do nothing;

  -- Authenticate as u1
  perform set_config('request.jwt.claims', json_build_object('sub', u1::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.workout_presets(user_id, name, is_public, exercises_json)
    values (u1, 'TOP1 Push Private', false, '[{"name":"Barbell Bench Press"}]'::jsonb);

  insert into public.workout_presets(user_id, name, is_public, exercises_json)
    values (u1, 'TOP1 Push Public', true, '[{"name":"Barbell Bench Press"}]'::jsonb)
    returning id into public_preset_id;

  insert into public.workout_posts(user_id, title, visibility, total_volume_kg, total_sets)
    values (u1, 'Private PR Session', 'private', 4200, 12)
    returning id into private_post_id;

  insert into public.workout_posts(user_id, title, visibility, total_volume_kg, total_sets)
    values (u1, 'Friends Session', 'friends', 3000, 10)
    returning id into friends_post_id;

  -- u1 adds a comment & reaction on their own private post
  insert into public.post_comments(post_id, user_id, body) values (private_post_id, u1, 'Secret training note');
  insert into public.post_reactions(post_id, user_id, reaction_key) values (private_post_id, u1, 'fire');

  -- Trigger must have created athlete_gamification row with server-computed XP & credits
  select count(*) into cnt from public.athlete_gamification where user_id = u1 and xp >= 400 and credits >= 330;
  if cnt <> 1 then raise exception 'Expected workout_posts trigger to award XP and credits'; end if;

  -- Direct client UPDATE on athlete_gamification must be denied
  begin
    update public.athlete_gamification set credits = 999999 where user_id = u1;
    raise exception 'Expected direct UPDATE on athlete_gamification to fail';
  exception when insufficient_privilege then
    null;
  end;

  -- Claiming an unreached level (e.g. level 50) must be rejected
  begin
    perform public.apply_gamification_action('claim_level', 50, null, null, null);
    raise exception 'Expected unreached level claim to fail';
  exception when invalid_parameter_value then
    null;
  end;

  -- Claiming reached level 1 must succeed and award credits
  res := public.apply_gamification_action('claim_level', 1, null, null, null);
  if not (1 = any(array(select jsonb_array_elements_text(res->'claimed_levels')::integer))) then
    raise exception 'Expected level 1 to be recorded as claimed';
  end if;

  -- Buying a valid deal deducts exact server price and records cosmetic
  res := public.apply_gamification_action('buy_deal', null, 'emote_pr_bell', null, null);
  if not ('emote_pr_bell' = any(array(select jsonb_array_elements_text(res->'owned_cosmetics')))) then
    raise exception 'Expected emote_pr_bell to be owned after purchase';
  end if;

  -- u1 sends a pending friend request to u2
  insert into public.friend_links(user_id, friend_user_id, status)
    values (u1, u2, 'pending')
    returning id into friend_link_id;

  -- u1 MUST NOT be able to self-accept their own outgoing friend request
  begin
    update public.friend_links set status = 'accepted' where id = friend_link_id;
    raise exception 'Expected sender self-accept on friend_links to fail';
  exception when insufficient_privilege then
    null;
  end;
  select count(*) into cnt from public.friend_links where id = friend_link_id and status = 'accepted';
  if cnt <> 0 then raise exception 'RLS allowed sender to self-accept friend request'; end if;

  insert into public.feature_requests(user_id, title, description)
    values (u1, 'Apple Watch live set sync', 'Sync active sets directly from watch.');

  -- Non-operator cannot invoke admin_backend_summary()
  begin
    perform public.admin_backend_summary();
    raise exception 'Expected non-operator admin_backend_summary() to fail';
  exception when insufficient_privilege then
    null;
  end;

  -- Switch to u2: verify isolation BEFORE accepting friendship
  perform set_config('request.jwt.claims', json_build_object('sub', u2::text, 'role', 'authenticated')::text, true);

  -- u2 can see u1's public preset, NOT u1's private preset, and MUST NOT be able to DELETE u1's public preset
  select count(*) into cnt from public.workout_presets where user_id = u1;
  if cnt <> 1 then raise exception 'Expected u2 to see only u1 public preset'; end if;
  delete from public.workout_presets where id = public_preset_id;
  select count(*) into cnt from public.workout_presets where id = public_preset_id;
  if cnt <> 1 then raise exception 'RLS allowed another user to delete a public workout_preset'; end if;

  -- u2 must NOT see u1's private post, private post comments/reactions, or pending friends-only post
  select count(*) into cnt from public.workout_posts where id in (private_post_id, friends_post_id);
  if cnt <> 0 then raise exception 'RLS leaked private or unaccepted-friend workout_post'; end if;

  select count(*) into cnt from public.post_comments where post_id = private_post_id;
  if cnt <> 0 then raise exception 'RLS leaked comments on private workout_post'; end if;

  select count(*) into cnt from public.post_reactions where post_id = private_post_id;
  if cnt <> 0 then raise exception 'RLS leaked reactions on private workout_post'; end if;

  select count(*) into cnt from public.athlete_gamification where user_id = u1;
  if cnt <> 0 then raise exception 'RLS leaked athlete_gamification to another user'; end if;

  -- u2 MUST NOT be able to forge an already-accepted friend link with u3
  begin
    insert into public.friend_links(user_id, friend_user_id, status) values (u3, u2, 'accepted');
    raise exception 'Expected forged accepted friend_links insert to fail';
  exception when insufficient_privilege then
    null;
  end;

  -- u2 accepts u1's pending friend request: now u2 CAN see u1's friends-only post (still NOT private post)
  update public.friend_links set status = 'accepted' where id = friend_link_id;
  select count(*) into cnt from public.workout_posts where id = friends_post_id;
  if cnt <> 1 then raise exception 'Expected accepted friend to see friends-visibility post'; end if;
  select count(*) into cnt from public.workout_posts where id = private_post_id;
  if cnt <> 0 then raise exception 'RLS leaked private post to accepted friend'; end if;

  -- Feature requests are community readable
  select count(*) into cnt from public.feature_requests;
  if cnt < 1 then raise exception 'Expected community feature_requests to be readable'; end if;

  reset role;

  -- Promote verified operator account and verify admin_backend_summary() succeeds
  insert into auth.users(id, email, email_confirmed_at)
    values ('cccccccc-3333-4333-8333-333333333333', 'drahmedlr@gmail.com', now())
    on conflict do nothing;
  insert into private.usage_operators(user_id)
    values ('cccccccc-3333-4333-8333-333333333333')
    on conflict do nothing;
  perform set_config('request.jwt.claims', json_build_object('sub', 'cccccccc-3333-4333-8333-333333333333', 'role', 'authenticated')::text, true);
  set local role authenticated;

  if ((public.admin_backend_summary()->>'workoutPosts')::integer) < 1 then
    raise exception 'Expected admin_backend_summary() to report inserted workoutPosts';
  end if;

  reset role;
end $$;
