-- Anonymous Supabase sign-ins receive the authenticated role too. Require a
-- registered session for owner access; anonymous visitors may read public cards.
alter policy "Read profile" on public.profiles using (
  ((select auth.uid())=id and coalesce((select auth.jwt())->>'is_anonymous','false')='false') or is_public
);
alter policy "Insert own profile" on public.profiles with check (
  (select auth.uid())=id and coalesce((select auth.jwt())->>'is_anonymous','false')='false'
);
alter policy "Update own profile" on public.profiles using (
  (select auth.uid())=id and coalesce((select auth.jwt())->>'is_anonymous','false')='false'
) with check (
  (select auth.uid())=id and coalesce((select auth.jwt())->>'is_anonymous','false')='false'
);
alter policy "Manage own metric logs" on public.metric_logs using (
  (select auth.uid())=user_id and coalesce((select auth.jwt())->>'is_anonymous','false')='false'
) with check (
  (select auth.uid())=user_id and coalesce((select auth.jwt())->>'is_anonymous','false')='false'
);
alter policy "Manage own imports" on public.profile_imports using (
  (select auth.uid())=user_id and coalesce((select auth.jwt())->>'is_anonymous','false')='false'
) with check (
  (select auth.uid())=user_id and coalesce((select auth.jwt())->>'is_anonymous','false')='false'
);
