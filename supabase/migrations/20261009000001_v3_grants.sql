-- Supabase may grant new public tables to anon through default privileges.
-- Narrow table grants explicitly in addition to enforcing row policies.
revoke all on public.profiles,public.metric_logs,public.profile_imports from anon,authenticated;
grant select on public.profiles to anon;
grant select,insert,update on public.profiles to authenticated;
grant select,insert,update,delete on public.metric_logs,public.profile_imports to authenticated;
