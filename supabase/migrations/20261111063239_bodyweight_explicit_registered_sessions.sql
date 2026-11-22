-- Make the registered-user gate explicit as well as checking the active session.
alter policy "Own dated bodyweight" on public.bodyweight_events using(
 user_id=(select auth.uid()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false' and(select private.has_active_session())
);
alter policy "Own weight history version" on public.bodyweight_state using(
 user_id=(select auth.uid()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false' and(select private.has_active_session())
);
