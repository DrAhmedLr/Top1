# TOP1 · audited experimental beta

Next.js / TypeScript measurement dashboard with local persistence, Supabase accounts, optional public snapshots, and hypothetical performance scenarios.

## Scientific status

The index is experimental. It is not a population percentile, health score, diagnosis, or validated composite. The audit withdrew the previous TOP-percent claims and unverified correlation adjustment. See [the audit](docs/ALGORITHMIC_AUDIT.md) and [metric inventory](docs/METRIC_INVENTORY.md).

Of 32 inputs, 14 are tracking-only because interpretation requires clinical or measurement context. Direct treadmill CPET VO₂ comparisons use FRIEND 2015 decade means and SDs only with an explicitly recorded test age of 20–79. Wearable and Cooper estimates remain tracking-only. All other scored references are disclosed product assumptions.

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

Apply migrations in order. The audited migration adds measured date, method, source, test age, revision protection, and append-only clearing via tombstones. It replaces the save/import RPC signatures; deploy the corresponding code together. A clearing action preserves history. Owners retain table permissions to manage their own records; this is not an immutable medical record.

Private is the default. Raw measurements and import receipts are owner-only under RLS. Public snapshots expose demographics and aggregate index information. Server signatures bind those snapshots to the account, demographics, model version, and signing date. Signatures attest calculation by the app, not independently verified measurements. Legacy unsigned snapshots are hidden until resaved. Previously cached third-party images cannot be revoked remotely.

Google OAuth is currently disabled. Configure Google credentials in Supabase and allow the deployed `/auth/callback` URL before enabling account sign-in. Full hosted signed-in verification remains pending. No credential-bearing disposable test account was created.

The audited beta is live at https://top1.fit and https://top1body-beta.vercel.app. Deployment `dpl_3zXqwwxoQmhJsBNza2WZoXKeFsc5` serves application commit `96da8483da1b309a9a0d7f86bd6c134770754640`. The audited migration is applied; live transactional RLS and integrity checks passed. Both Supabase security and performance advisors returned no notices.
