begin;
do $$begin
 if has_table_privilege('anon','public.programs','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'Anonymous program privileges remain';end if;
 if has_table_privilege('authenticated','public.programs','DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'Excess authenticated program privileges remain';end if;
 if not has_table_privilege('authenticated','public.programs','SELECT') or not has_table_privilege('authenticated','public.programs','INSERT') or not has_table_privilege('authenticated','public.programs','UPDATE') then raise exception 'Required program privileges removed';end if;
end $$;
set local role anon;
do $$begin begin truncate public.programs;raise exception 'Anonymous truncate succeeded';exception when insufficient_privilege then null;end;end $$;
set local role authenticated;
do $$begin begin truncate public.programs;raise exception 'Authenticated truncate succeeded';exception when insufficient_privilege then null;end;end $$;
reset role;
rollback;
select 'Hosted default-grant and whole-table privilege regression passed' as result;
