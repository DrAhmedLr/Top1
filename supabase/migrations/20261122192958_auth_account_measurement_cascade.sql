begin;

create or replace function public.advance_measurement_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid;
begin
  -- Supabase Auth can delete an account without UPDATE on application tables.
  -- The profile being deleted owns these measurements through ON DELETE CASCADE.
  if tg_op = 'DELETE' and current_user = 'supabase_auth_admin' then
    return old;
  end if;

  owner_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text, 0));
  update public.profiles set updated_at = now() where id = owner_id;
  return coalesce(new, old);
end;
$$;

commit;
