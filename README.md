# TOP1.Fit

Source for https://top1.fit — a Next.js/TypeScript measurement tracker with optional experimental capacity comparisons.

## Scientific interpretation

All measurements are optional. Missing entries never count as zero. Clinical markers and recovery habits remain tracking-only. Other capacity model parameters remain product assumptions; the composite has not been independently calibrated as a population rank.

The individual VO2 comparison uses a frozen FRIEND 2022 direct-treadmill CPET reference for supported sex/age cohorts, requiring documented test age/date, peak RER and a self-reported match to its inclusion criteria. Published threshold intervals are displayed without inventing exact percentiles or extrapolated top-one-percent claims. See [scientific references](docs/SCIENTIFIC_REFERENCES.md).

## Development and checks

Use Node.js 24 and the pnpm version pinned in package.json. Copy .env.example to .env.local and configure your own services. Keep credentials and environment files outside Git.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check:release
node scripts/smoke-live.mjs
```

The release gate runs application tests, isolated PostgreSQL ownership/migration checks, TypeScript and a production build. It does not modify production data or establish clinical validity. GitHub Actions runs release checks on pushes and pull requests. Public health checks run on a schedule after the workflow reaches the default branch.

Profiles are private by default. Public summaries require explicit owner publication. Current-session and recent-session checks protect sensitive actions. Account acceptance needs an owner-authorized disposable account; credentials, session material, health data and private test fixtures must not enter logs or GitHub artifacts.

Support: drahmedlr@gmail.com. Do not email passwords or laboratory reports.

## Languages and display bands

English, French and Arabic are available from the language control beside account access. Arabic uses a right-to-left layout. The default experience is guest-first; an account is optional for saving across devices.

Reference results use asymmetric display bands, constrained by the precision of the source data. No global composite rank or unsupported Top 1% claim is inferred. See [language and bracket behavior](docs/LOCALIZATION.md).

Application source is available under the [MIT license](LICENSE). Research sources, reference data and third-party packages retain their own terms. See [contribution guidance](CONTRIBUTING.md).
