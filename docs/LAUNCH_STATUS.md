# TOP1 release 5.1.0

The application uses release labeling rather than beta labeling. Scientific model disclosures stay experimental; releasing the software does not validate population rankings or clinical interpretations.

## Included

- Email/password sign-in and registration forms, confirmation resend, PKCE callback handling, token-hash confirmation, password recovery, and signed-in password changes.
- Password visibility controls, matching new-password checks, 12-character new-password minimum, native autocomplete, readable errors, and resend cooldown.
- Signed-in password changes verify current credentials explicitly. Provider enforcement is optional and cannot be assumed from accepting the `current_password` attribute alone.
- Three pillars, accessibility filters, all 36 active metrics, thermal tracking, preserved legacy observations, scenarios, passports and signed public sharing.
- Private defaults, owner-scoped data access, observation history, revision conflicts, safe local import and sign-out, and a factual Data & privacy page.
- General error recovery and basic response security headers.

## Production bug found and fixed

The full authenticated launch test exposed a stale-save HTTP 500. The previous `40001` serialization exception caused the API layer to retry a deliberate conflict. Migration `20261009142548_profile_conflict_http_status.sql` changes only that function's error code to `PT409`; the application returns a conflict response without retrying. No records or RPC signatures were removed.

[Supabase documents this PostgREST retry behavior and fix](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b). Direct HTTP verification returned 409 immediately, and no matching active loop remained in the database.

## Verification

The owner explicitly authorized an email/password test account and confirmed its email. Generated credentials are in a permission-restricted fixture outside this repository and never appear in source or public logs.

Real checks passed against Supabase for sign-in, current-password verification, incorrect-password rejection, password replacement, old-password rejection and new-password acceptance. The deployed release also passed authenticated save/load, metadata retention, account/origin checks, invalid-input rejection, revision conflicts, signed public page/card rendering, visibility revocation, sign-out and API denial. Synthetic observations were tagged and removed; the test profile was restored private with no measurements.

All 58 automated application tests and the full seven-migration PostgreSQL checks passed, along with TypeScript and the production build. Account forms were inspected in the browser. Production deployment `dpl_CGfb8jfAMs3SKVGUmkaxVjGUq6mF` is READY at https://top1.fit, serving application commit `70e8815bc8488a4dafe258092b01cef1e3a78333`. Live email account pages, private API denial, social cards, non-beta labeling and response security headers passed smoke checks. Build/runtime log access through the connector remains restricted; CLI request-log reads work with the authorized scope.

## Explicitly deferred by the owner

Production email delivery is deferred. The owner currently has a Gmail inbox and plans to set up an email service later. Supabase's default sender reached the authorized project-team test inbox, but it is not general public email delivery. Do not describe public registration or password-recovery delivery as unrestricted until production SMTP is configured and tested.

When email delivery is configured, set Supabase Site URL to `https://top1.fit`, allow `https://top1.fit/auth/callback` with the recovery `next` query, and review confirmation/recovery templates. The token-hash confirmation route supports templates that link to `/auth/confirm`; its token type is verified by Supabase before redirecting.

[Supabase's SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp) explains default-recipient restrictions and production SMTP configuration. Email confirmation remains enabled; no security protection was disabled to work around delivery.

The security advisor reports leaked-password protection disabled. [Supabase makes this available on Pro and higher plans](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No paid upgrade was purchased. Database performance advisors reported no notices.

Optional PostHog analytics remains inactive without a project key. Health-provider adapters remain normalization interfaces rather than live OAuth connections; no provider connection is falsely represented as active. Scientific calibration remains a data/research requirement.
