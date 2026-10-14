import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
const db=new PGlite();
try {
 await db.exec(`create schema auth; create schema extensions; create role anon; create role authenticated;
 create table auth.users(id uuid primary key,email text);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id)on delete cascade,created_at timestamptz default now());
 create function auth.create_fixture_session()returns trigger language plpgsql as $$begin insert into auth.sessions(id,user_id)values(NEW.id,NEW.id);return NEW;end$$;
 create trigger fixture_session after insert on auth.users for each row execute function auth.create_fixture_session();
 create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}')||jsonb_build_object('session_id',coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id',nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')) $$;
 create function extensions.uuid_generate_v4() returns uuid language sql as $$select gen_random_uuid()$$;
 grant usage on schema auth,extensions,public to anon,authenticated;`);
 // Mirror hosted Supabase's grants on newly created public tables. RLS alone
 // does not protect whole-table privileges such as TRUNCATE.
 await db.exec('alter default privileges in schema public grant all on tables to anon,authenticated;');
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()) {
  const sql=(await readFile('supabase/migrations/'+file,'utf8')).replace('create extension if not exists "uuid-ossp" with schema extensions;','');
  await db.exec(sql);
 }
 await db.exec(await readFile('supabase/tests/rls.sql','utf8'));
 await db.exec(await readFile('supabase/tests/integrity.sql','utf8'));
 await db.exec(await readFile('supabase/tests/product.sql','utf8'));
 await db.exec(await readFile('supabase/tests/algorithm.sql','utf8'));
 await db.exec(await readFile('supabase/tests/privileges.sql','utf8'));
 await db.exec(await readFile('supabase/tests/remediation.sql','utf8'));
 console.log('PostgreSQL migrations, RLS, history, metadata, and revision conflict checks passed.');
} finally {await db.close();}
