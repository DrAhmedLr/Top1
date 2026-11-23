begin;
create function public.is_usage_operator(p_owner uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists (
    select 1 from private.usage_operators
    where user_id = (select auth.uid()) and user_id = p_owner
      and (select private.has_active_session())
  );
$$;
revoke all on function public.is_usage_operator(uuid) from public, anon, authenticated;
grant execute on function public.is_usage_operator(uuid) to authenticated;
commit;
