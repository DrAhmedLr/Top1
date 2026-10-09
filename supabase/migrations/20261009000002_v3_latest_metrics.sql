-- Return latest measurements without the REST API's row limit truncating history.
create function public.read_current_metrics()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_object_agg(metric_id,metric_value),'{}'::jsonb)
  from (select distinct on (metric_id) metric_id,metric_value
    from public.metric_logs where user_id=(select auth.uid())
    order by metric_id,recorded_at desc,id desc) latest;
$$;
revoke all on function public.read_current_metrics() from public,anon;
grant execute on function public.read_current_metrics() to authenticated;
