# TOP1 operations and recovery

The application release gate is `pnpm check:release`. It runs application tests, encrypted-backup tests, isolated PostgreSQL migration/ownership checks, TypeScript and the production build in sequence. Run `node scripts/smoke-live.mjs` against the canonical site after promotion. This checks public pages, CSP and signed-out private boundaries without credentials or health data.

The remote is [DrAhmedLr/Top1](https://github.com/DrAhmedLr/Top1). Its default branch contains the [release checks](https://github.com/DrAhmedLr/Top1/actions/workflows/checks.yml) and [public health workflow](https://github.com/DrAhmedLr/Top1/actions/workflows/live-health.yml). The latter requests a run every thirty minutes and supports manual dispatch. Check each run against its commit and compare that commit with the actual Vercel release, since the website has also been deployed directly from local sources.

## Release procedure

1. Verify the intended Vercel team `dr-669c`, project `top1body-beta`, source revision and production environment.
2. Run the complete local release gate. Inspect schema differences and reconcile migrations by name/content rather than blindly replaying timestamps.
3. Apply the reviewed migration only after isolated database checks. Check owner/session boundaries and advisors afterward. Do not run destructive SQL to test permissions.
4. Stage a production build with domain assignment disabled. Verify its artifact, public pages, CSP and private boundaries, then promote that same artifact.
5. For changes to account or sync flows, record which steps of the [real-account acceptance procedure](SYNC_AND_ACCOUNT_VERIFICATION.md) were verified. Use the owner's authorized test account for these checks. Keep credentials and session data out of logs and artifacts.
6. Record the released artifact and remaining acceptance gaps. If smoke checks fail, restore the previous reviewed application artifact; schema rollback needs a separate compatibility assessment.

### November 22, 2026 production release

Vercel promoted `dpl_HC298wjRqdUj6QUzmZZ1FEDnQuf9` to `top1.fit`. The previous live artifact was `dpl_HNZa6A4EGmPMJri5UvqybBwf7APR`. Supabase resumed the existing production project, applied `20261122164343_usage_analytics` and `20261122164350_profile_operator_access`, and confirmed a single verified operator account.

All 12 live HTTP checks passed. Mobile guest checks covered English fallback, French, Arabic RTL, fixed Quick log actions and a day-one forecast. Guest profiles hid the admin link, and `/admin` redirected to sign-in with a return path. The later account release verified the signed-in operator dashboard. [Account verification record](SYNC_AND_ACCOUNT_VERIFICATION.md)

The same-day guided Program release promoted `dpl_Bxmcyzw4uxZEAXMY6Q8P4muNEGcn` to `top1.fit`, using the existing training ledger. All 380 application tests passed, along with the backup, database, web build and mobile bundle checks. The preceding admin release remains available as the previous application artifact. The 12 canonical HTTP checks passed again after promotion.

`dpl_EJwVE1YYgnYG7uZEwiFYVNkPRdk1` shipped the signup, recovery and session refresh fixes. Supabase Email Auth and TOP1 both accepted eight-character passwords. The owner completed password recovery in their mailbox and signed in. A browser with the operator session opened Usage analytics and its reporting period controls.

`dpl_FF26x6XeT9sCz6YiziRDEwDgF14q` shipped the restyled guest import card and review dialog. All 385 application tests, the encrypted backup tests, the database suite, the production web build and the mobile bundle checks passed. The canonical site served the new component and stylesheet. The 12 HTTP checks passed, signup returned 200, and a signed-out admin request redirected to sign-in.

During test cleanup, accounts with saved measurements initially failed self-service deletion. Migration `20261122192958_auth_account_measurement_cascade` corrected the revision trigger for an Auth-managed account deletion while retaining its existing permissions. The regression test reproduced the permission error on the preceding schema. The corrected production endpoint removed the disposable account, revoked access and cleared its measurements, training and workspace. Both disposable accounts were removed. The [account verification record](SYNC_AND_ACCOUNT_VERIFICATION.md) covers the hosted sync and forecast checks.

### Goal outcome tracking release

Vercel promoted `dpl_EsjEmrJNPyi444ybuzNVyot6wMUj` to `top1.fit` on November 22, 2026. Supabase applied `20261122194552_prospective_goal_forecasts.sql` and `20261122195406_post_issue_adherence.sql`. The previous application deployment was `dpl_FF26x6XeT9sCz6YiziRDEwDgF14q`.

All 400 application tests passed, along with encrypted backup, isolated PostgreSQL, web build and mobile bundle checks. On the canonical domain, the signed-in Programme displayed the outcome-sharing control, signed-out requests to the tracking API returned 401, and the admin page redirected signed-out visitors to sign-in. At release, zero completed shared forecasts qualified for calibration. Production accuracy can be evaluated once enough consenting users supply comparable follow-up measurements.

### Customer journeys and per-metric reports

The admin release `dpl_8EGviTv4EF25zvdKTp4dQPecsSn6` succeeded the first goal-tracking release. Supabase applied `20261122220802_customer_journey_insights.sql` and `20261122221315_operator_goal_report.sql`. Production checks confirmed the hourly retention job, private table grants, signed-in customer directory and deadline report. A staged signed-out request to the journey API returned 401. The production report had no shared goals whose deadline had passed in the selected 30 days. All 406 application tests and the database fixtures passed. Synthetic browser checks covered search, customer timelines, forecast comparisons and journey consent in English, French and Arabic.

## Backup and restoration acceptance

For operator-managed database archives, use the [encrypted backup procedure](LOCAL_BACKUPS.md). Recovery acceptance requires an observed restore.

- Verify the provider's actual backup/PITR availability, retention, encryption and restore scope for the current plan. Do not purchase a plan automatically.
- Record the recovery point and recovery time the owner needs. Account deletion affects live records; provider backup retention must be disclosed accurately.
- Restore a provider backup to an explicitly approved isolated destination, never over production. Use access restricted to the recovery test; avoid public aliases and outbound email/webhooks.
- Compare schema, migrations, aggregate counts, ownership policies, functions and sequences. Use owner-authorized synthetic record checks; never put private values in the report.
- Reconcile Auth sessions/users, file storage, server secrets and application configuration. A database-only restore does not establish complete product recovery.
- Remove the isolated restored copy according to the approved retention policy, then document dates, backup identity, scope, measured recovery time and failures.

The restore drill remains open until that actual restoration is observed. Public health checks and local PGlite tests do not close it.

## Scientific and telemetry boundaries

No representative peer calibration dataset is connected. The published direct treadmill CPET reference is an individual cohort comparison; the provisional composite is not a worldwide or age-peer percentile. Research approval and independent validation are separate from software release.

The web and native apps send first-party usage counts to Supabase for signed-in accounts with analytics enabled. A database operator grants dashboard access to a specific registered account. [Operator setup and event definitions](UX_MEASUREMENT_SPEC.md)

### November 22 programme and algorithm guide

Vercel deployment `dpl_3ydjMHLkLqdTbLSCPWWVDmFXy5d8` was promoted to `top1.fit`. Supabase applied `20261122222729_concurrent_goal_forecasts.sql` and `20261122222919_training_batch_writes.sql`. The live database showed one operator grant belonging to the intended verified owner.

All 428 application tests passed, alongside backup and isolated database tests, TypeScript, and the web production build. The mobile build and both native asset copies passed. Fourteen canonical web and API checks returned their expected statuses. A disposable browser on the live site created two guest goals, changed a prescribed exercise and restored both goals and its workout after a reload. The test generated no account writes. In the signed-in operator’s live Algorithms tab, 20 strict push-ups gave Top 20% and 60 gave Top 1% for the default sample profile, matching the product rules. A signed-out browser was redirected to sign-in with the Algorithms return link.

### Supabase migration history on November 23, 2026

The migration ledger for the TOP1 production database contains all nine November 22 migrations. The recorded SQL matched each repository file byte for byte. Five entries use the same version in both places. For the following four, use the migration name and the recorded production version when checking what has already run.

| Migration | Repository version | Production version |
| --- | --- | --- |
| `customer_journey_insights` | `20261122220802` | `20261122222904` |
| `operator_goal_report` | `20261122221315` | `20261122222942` |
| `concurrent_goal_forecasts` | `20261122222729` | `20261122224323` |
| `training_batch_writes` | `20261122222919` | `20261122224330` |
