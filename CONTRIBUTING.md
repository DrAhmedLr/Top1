# Contributing to TOP1

TOP1 is a guest-first performance tracker available in English, French and Arabic. The application code is MIT licensed. See LICENSE; third-party packages and scientific sources retain their own terms.

## Run locally

Use Node.js 24 and the pnpm version in package.json. Install with `pnpm install --frozen-lockfile`, configure your own `.env.local` from `.env.example`, then run `pnpm dev`. Never commit credentials, real account exports, personal measurements or private test fixtures.

Run `pnpm check:release` before submitting a pull request. This checks the application, encrypted-backup helper, isolated database migrations, types and production build without modifying the live database.

## Product principles

- Every measurement is optional. Missing values never count as zero.
- Keep the main experience simple and usable without an account.
- Translate UI labels, instructions and validation messages in both French and Arabic. Preserve dynamic placeholders, Arabic RTL and keyboard access. Keep user-written content and stored measurement identifiers intact.
- Check narrow mobile layouts as well as desktop. Switching languages must not reset a measurement.
- Keep scientific comparisons tied to named populations and compatible protocols. Product display brackets do not create statistical precision.
- A proposed reference needs its original source, population, inclusion criteria, protocol, units, age/sex coverage and quantile resolution. Do not turn an unvalidated composite into a world rank.

Use synthetic guest data for routine UI tests. Real account tests require the account owner's permission. Report reproducible bugs through repository issues; use the listed support email for private account requests.
