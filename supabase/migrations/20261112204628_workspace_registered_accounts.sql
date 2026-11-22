-- Make the registered-account restriction visible to the policy advisor too.
alter policy personal_workspaces_owner on public.personal_workspaces
 using(user_id=(select auth.uid()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false' and (select private.has_active_session()))
 with check(user_id=(select auth.uid()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false' and (select private.has_active_session()));
