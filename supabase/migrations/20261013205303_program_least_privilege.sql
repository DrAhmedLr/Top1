begin;
-- Hosted default grants may predate this table's explicit GRANT statement.
-- Whole-table operations are not restricted by row-level security.
revoke all on public.programs from public,anon,authenticated;
grant select,insert,update on public.programs to authenticated;
commit;
