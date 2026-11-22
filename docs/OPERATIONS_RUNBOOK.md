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

PostHog events remain disabled without the owner's project key. A moderated task-completion study can proceed without collecting physiological values. When a collector is connected, preserve the allowlist, disable session recording/autocapture and verify that values, identity, demographics, URLs and tokens do not enter events.
