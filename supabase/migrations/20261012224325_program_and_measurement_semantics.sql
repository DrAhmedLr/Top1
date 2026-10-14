begin;
create function private.valid_program(p jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare t jsonb; d jsonb; ids text[]:='{}';
begin
 if p->>'version' is distinct from '1' or coalesce(p->>'focus','') not in('consistency','strength','recovery') or coalesce(jsonb_typeof(p->'tasks'),'')<>'array' or jsonb_array_length(p->'tasks')>8 then return false;end if;
 for t in select value from jsonb_array_elements(p->'tasks') loop
  if coalesce(jsonb_typeof(t),'')<>'object' or coalesce(t->>'id','')!~'^[a-zA-Z0-9_-]{1,50}$' or t->>'id'=any(ids) or coalesce(jsonb_typeof(t->'label'),'')<>'string' or length(trim(t->>'label'))=0 or length(t->>'label')>160 or coalesce(jsonb_typeof(t->'days'),'')<>'array' or jsonb_array_length(t->'days')=0 or jsonb_array_length(t->'days')>7 or coalesce(jsonb_typeof(t->'completed'),'')<>'array' or jsonb_array_length(t->'completed')>366 then return false;end if;
  ids:=array_append(ids,t->>'id');for d in select value from jsonb_array_elements(t->'days') loop if d::text!~'^[1-7]$' then return false;end if;end loop;
  for d in select value from jsonb_array_elements(t->'completed') loop if coalesce(jsonb_typeof(d),'')<>'string' or (d#>>'{}')!~'^\d{4}-\d{2}-\d{2}$' then return false;end if;perform (d#>>'{}')::date;end loop;
 end loop;return coalesce(p->>'version'='1',false);
exception when others then return false;
end $$;
revoke all on function private.valid_program(jsonb) from public,anon;
grant execute on function private.valid_program(jsonb) to authenticated;
create table public.programs(user_id uuid primary key references auth.users(id) on delete cascade,plan jsonb not null,revision bigint not null default 1,updated_at timestamptz not null default now(),check(private.valid_program(plan)),check(octet_length(plan::text)<=65536));
alter table public.programs enable row level security;
create policy "Own program" on public.programs for all to authenticated using((select auth.uid())=user_id and coalesce((select auth.jwt())->>'is_anonymous','false')='false') with check((select auth.uid())=user_id and coalesce((select auth.jwt())->>'is_anonymous','false')='false');
grant select,insert,update on public.programs to authenticated;
create function public.save_program(p_plan jsonb,p_expected_revision bigint) returns bigint language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); r bigint;
begin
 if uid is null then raise exception 'Sign in' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('program:'||uid::text,0));
 select revision into r from public.programs where user_id=uid;
 if coalesce(r,0) is distinct from p_expected_revision then raise exception 'Program revision conflict' using errcode='PT409';end if;
 r:=coalesce(r,0)+1;
 insert into public.programs(user_id,plan,revision) values(uid,p_plan,r) on conflict(user_id) do update set plan=excluded.plan,revision=excluded.revision,updated_at=now();return r;
end $$;
revoke all on function public.save_program(jsonb,bigint) from public,anon;
grant execute on function public.save_program(jsonb,bigint) to authenticated;

-- NOT VALID keeps legacy records intact while enforcing every new write.
alter table public.metric_logs add constraint whole_repetition_counts check(is_deleted or metric_id not in('pushups','sit_to_stand') or metric_value=trunc(metric_value)) not valid;
alter table public.metric_logs add constraint observation_not_future check(is_deleted or measured_at is null or measured_at<=now()+interval '5 minutes') not valid;
alter table public.metric_logs add constraint compatible_measurement_method check(is_deleted or method is null or case
 when metric_id in('apob','lpa','fasting_insulin','hscrp','hba1c','homocysteine','cystatin_c','ggt','fasting_glucose') then method='lab'
 when metric_id='vo2_max' then method in('direct_cpet','cooper_estimate','wearable_estimate')
 when metric_id='body_fat' then method in('dexa','skinfold_estimate','device')
 when metric_id='visceral_fat' then method in('dexa','device')
 when metric_id='grip_strength' then method in('dynamometer_single_hand','manual','device')
 when metric_id in('squat_1rm','deadlift_1rm','bench_1rm','pullup_1rm') then method in('direct_1rm','epley_estimate','manual')
 else method in('manual','device') end) not valid;

alter table public.profiles alter column weight_kg drop not null, alter column weight_kg drop default, alter column height_cm drop not null, alter column height_cm drop default;
commit;
