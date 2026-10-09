# TOP1 · Fire & Ice triad

Next.js / TypeScript measurement dashboard with local persistence, Supabase accounts, optional public snapshots, and hypothetical performance scenarios.

## Scientific status

The index is experimental. It is not a population percentile, health score, diagnosis, or validated composite. The audit withdrew the previous TOP-percent claims and unverified correlation adjustment. See [the audit](docs/ALGORITHMIC_AUDIT.md) and [metric inventory](docs/METRIC_INVENTORY.md).

The current triad has 36 active inputs sorted into three accessibility tiers: BodyMarkers (38%), Strength (38%), and Recovery (24%). Nineteen inputs are tracking-only because interpretation requires clinical or protocol context. Blood pressure and ankle mobility remain preserved legacy observations outside active scores and coverage. Direct treadmill CPET VO₂ comparisons use FRIEND 2015 decade means and SDs only with an explicitly recorded test age of 20–79. Wearable and Cooper estimates remain tracking-only. All other scored references are disclosed product assumptions.

Scores are capped at ±3 model units, averaged within measured pillars, then averaged across active pillars using normalized weights. The displayed index is `50 + 15 × composite`, bounded to 0–100 (the current ±3 caps yield 5–95). At least three eligible inputs across two pillars are needed. Coverage reports available data, not confidence. Scores from different measured subsets should not be compared.

Scenarios use arbitrary model steps, without a weeks or clinical adaptation claim. Biomarkers and contextual vital signs are not optimized. Sleep uses a continuous plateau starting at seven hours; additional sleep gives no gain.

## Development

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm test:database
pnpm build
pnpm typecheck
pnpm dev
```

Run build and typecheck sequentially because Next regenerates route types. The database test applies every migration to isolated PGlite PostgreSQL with minimal Supabase role/auth fixtures, then checks RLS, transaction rollback, history, metadata, and stale-write rejection. It substitutes a UUID function for the unavailable uuid-ossp extension; it does not emulate hosted OAuth or network concurrency.

## Configuration

Copy `.env.example` to `.env.local`. Set public Supabase connection variables and canonical `NEXT_PUBLIC_SITE_URL`. Set a random server-only `PUBLIC_SUMMARY_SIGNING_KEY` of at least 32 characters, shared across production instances. Never prefix that secret with `NEXT_PUBLIC_` or commit it. PostHog is optional and remains inactive without a key.

Confirmed database: **drahmedlr**, project `uyivfmmiwehfkcemjvmh`. Vercel project: **top1body-beta**. Repository: https://github.com/DrAhmedLr/Top1.

Apply all seven migrations in order. The audited migration adds measured date, method, source, test age, revision protection, and append-only clearing via tombstones. It replaces the save/import RPC signatures; deploy the corresponding code together. A clearing action preserves history. Owners retain table permissions to manage their own records; this is not an immutable medical record.

Private is the default. Raw measurements and import receipts are owner-only under RLS. Public snapshots expose demographics and aggregate index information. Server signatures bind those snapshots to the account, demographics, model version, and signing date. Signatures attest calculation by the app, not independently verified measurements. Legacy unsigned snapshots are hidden until resaved. Previously cached third-party images cannot be revoked remotely.

Email-and-password access is implemented with sign-up, confirmation resend, sign-in, recovery and signed-in password changes. Google is not offered in the interface. New-password forms require 12 characters; signed-in changes explicitly verify current credentials. A user-authorized account was confirmed and used for real save/load, sharing and privacy checks. Production SMTP is intentionally deferred by the owner, so confirmation and recovery delivery to arbitrary public addresses remains pending. See [launch status](docs/LAUNCH_STATUS.md).

TOP1 is live at https://top1.fit and https://top1body-beta.vercel.app. The Fire & Ice triad release is READY on Vercel, deployment `dpl_3WLzCA5kiMcM1hH8jmkzk7Pa3JoZ`, serving application commit `ee481de0f8ab3450d0224f160388724a0b321a05`. All seven database migrations are applied. See [triad release notes](docs/TRIAD_RELEASE.md).
