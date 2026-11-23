begin;
-- The same account lock used by write_training serializes the expected-counter
-- check with the individual validated, versioned writes in this transaction.
create function public.write_training_batch(changes jsonb,p_counter bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  owner_id uuid := auth.uid();
  known_counter bigint;
  requests integer;
  existing integer;
  m jsonb;
  receipts jsonb := '[]'::jsonb;
begin
  if owner_id is null or not private.has_active_session() then
    raise exception 'Sign in to save training' using errcode='42501';
  end if;
  if changes is null or jsonb_typeof(changes)<>'array' or p_counter is null or p_counter<0
    or octet_length(changes::text)>2097152 then raise exception 'Invalid training batch' using errcode='22023'; end if;
  requests := jsonb_array_length(changes);
  if requests=0 or (select count(distinct e->>'requestId') from jsonb_array_elements(changes) e)<>requests then
    raise exception 'Missing or duplicate training request' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
  select counter into known_counter from public.training_state where user_id=owner_id;
  select count(*) into existing from jsonb_array_elements(changes) e join public.training_events t
    on t.user_id=owner_id and t.request_id=(e->>'requestId')::uuid;
  if existing<>requests and (existing>0 or coalesce(known_counter,0)<>p_counter) then
    raise exception 'Training changed elsewhere. Reload before saving.' using errcode='PT409';
  end if;
  for m in select value from jsonb_array_elements(changes) loop
    receipts := receipts || jsonb_build_array(private.write_training(m,false));
  end loop;
  return receipts;
end $$;
revoke all on function public.write_training_batch(jsonb,bigint) from public,anon,authenticated;
grant execute on function public.write_training_batch(jsonb,bigint) to authenticated;
commit;
