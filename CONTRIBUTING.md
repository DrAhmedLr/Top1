# Contributing to TOP1

TOP1 is a guest-first performance tracker available in English, French and Arabic. The application code is MIT licensed. See LICENSE; third-party packages and scientific sources retain their own terms.

## Run locally

Use Node.js 24 and the pnpm version in package.json. Install with `pnpm install --frozen-lockfile`, configure your own `.env.local` from `.env.example`, then run `pnpm dev`. Never commit credentials, real account exports, personal measurements or private test fixtures.

For documentation-only changes, check the changed links, commands and product claims against their owning files. For code changes, run the tests for the affected behavior. When changing shared screens or mobile code, also follow the [mobile client checks](mobile/README.md).

Before a web release, run `pnpm check:release`. It checks the application, encrypted-backup helper, isolated database migrations, types and production build.

The [GitHub workflow](.github/workflows/checks.yml) runs on pull requests, merge queues, pushes to `main` and release tags. Documentation-only changes complete the `verify` check without installing dependencies. Mobile-only changes run `pnpm check:client` using placeholder public settings. Shared screens, libraries and assets trigger both the web and mobile checks.

## Product principles

- Every measurement is optional. Missing values never count as zero.
- Keep the main experience simple and usable without an account.
- Translate UI labels, instructions and validation messages in both French and Arabic. Preserve dynamic placeholders, Arabic RTL and keyboard access. Keep user-written content and stored measurement identifiers intact.
- Check narrow mobile layouts as well as desktop. Switching languages must not reset a measurement.
- Keep scientific comparisons tied to named populations and compatible protocols. Product display brackets do not create statistical precision.
- A proposed reference needs its original source, population, inclusion criteria, protocol, units, age/sex coverage and quantile resolution. Do not turn an unvalidated composite into a world rank.

Use synthetic guest data for routine UI tests. Real account tests require the account owner's permission. Report reproducible bugs through repository issues; use the listed support email for private account requests.
