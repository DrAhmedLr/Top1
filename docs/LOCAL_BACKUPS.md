# Encrypted local database backups

This is an operator workflow for a free Supabase plan. It does not enable provider backups, PITR or leaked-password protection. A successful encryption test is not evidence that production recovery works.

## Prerequisites

- Node.js 24 and PostgreSQL client tools compatible with the source server (currently PostgreSQL 17). `pg_dump` must be available, or set `TOP1_PG_DUMP` to its absolute path.
- An owner-entered database connection in a private libpq service/password file outside this repository. Use a direct connection or the **session** pooler, not the transaction pooler. Set `PGSERVICE`/`PGSERVICEFILE`, or `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, and `PGPASSFILE`. Do not put a password in shell arguments, source, this document, chat or logs. Password and service files should have mode 600. The tool requires TLS certificate/hostname verification.
- A protected backup directory outside source control and cloud-synced public folders. The operator supplies absolute file paths. No backups or keys belong in GitHub, Vercel, CI artifacts or support mail.

## Create and verify

Generate a 32-byte key once, with an absolute private path you choose:

```sh
node scripts/encrypted-backup.mjs init-key /absolute/private/key
node scripts/encrypted-backup.mjs backup /absolute/private/key /absolute/private/daily.top1bak
node scripts/encrypted-backup.mjs verify /absolute/private/key /absolute/private/daily.top1bak
```

The tool makes one consistent PostgreSQL custom-format archive, streams it directly through AES-256-GCM, requires `pg_dump` to finish successfully, and verifies the resulting authentication tag. The key, nonce and tag use Node's standard cryptography. Files are created with mode 600; existing archives are never overwritten. Failed output is removed. No plaintext database dump is written during backup. Error output is deliberately generic to avoid leaking connection details.

Keep a separately protected copy of the key. Backups are unrecoverable if that key is lost. A backup and its key on one unprotected disk do not protect against theft or disk loss. Choose retention and a separate private/offline copy before relying on this process; no automatic deletion or recurring job is installed.

## Isolated recovery drill

1. Select a particular verified backup and an explicitly approved isolated destination with compatible PostgreSQL/Supabase roles and extensions. Restrict its access and disable outbound mail/webhooks/jobs. Never restore over production. A free hosted project may not have capacity for an extra project; a local Supabase environment also requires its supported Docker/CLI runtime.
2. Re-verify the archive. Decrypt only into a private temporary directory outside the repository:

   ```sh
   node scripts/encrypted-backup.mjs decrypt /absolute/private/key /absolute/private/daily.top1bak /absolute/private/recovery.dump
   pg_restore --list /absolute/private/recovery.dump
   ```

   Plaintext is committed only after authentication succeeds. Treat the result as highly sensitive and remove it after the drill.
3. Review the archive and destination roles, managed schemas, extensions, ownership and privileges before using `pg_restore`. This generic full-database archive is **not** a one-command import into an existing Supabase project: Auth/Storage managed objects may already exist and need a reviewed migration plan. Use the provider's [backup/restore guidance](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Do not use `--clean` or restore into the live database.
4. Compare migrations, schema, sequences, grants/RLS, function definitions, aggregate table counts and owner-isolation behavior. Exercise the application using synthetic records in the isolated copy. Record source snapshot time, restoration time, mismatches and recovery limits without including personal records.
5. Reconcile Auth users and revoke restored sessions; inspect triggers and schedules before reopening access. Storage database rows do not include the underlying uploaded files. Database roles/passwords, Vault encryption roots, provider settings, service secrets, Edge Functions, DNS and application artifacts require their own restricted recovery inventory. Do not extract platform encryption keys or credentials into this repository.
6. Remove the isolated copy and temporary plaintext through the approved cleanup process. Only an observed successful restoration closes recovery acceptance.

Current acceptance: the cryptographic workflow and failure paths are tested with synthetic archives. A production dump and actual isolated restore still require the private database connection, client tools and approved destination.
