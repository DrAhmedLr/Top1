# TOP1.Fit

This source tree implements a mobile performance journal and adaptive training planner. Home opens the next action. Measurements keeps 36 tests and observations in six categories. Program connects a target and deadline with scheduled sessions, actual exercise and a conditional forecast. Ranking shows the basis of each comparison. See the [product scope](docs/PRODUCT_FOCUS.md).

A guest journal stays on the device. Account data uses owner-scoped measurement and training APIs. Each observation preserves its entered value, available protocol and dates. A result without a known test date displays the save date. The interface supports English, French and Arabic.

The [mobile player journey](docs/TOP1_PLAYER_JOURNEY.md) follows a 5 km and a dead hang through the first two saves. Each of the [13 performance tests](docs/PERFORMANCE_GAME_RULES.md) has its own age, bodyweight and reference-sex rules. The overall game percentage updates as new tests are logged and shows how many areas it covers. Functional and personal observations have separate places in the [36-measure inventory](docs/RANKING_METRIC_DECISIONS.md).

## Development

Use Node.js 24 and the pnpm version in `package.json`. Install with `pnpm install --frozen-lockfile`, configure `.env.local` from `.env.example`, then run `pnpm dev`. See the [contribution guide](CONTRIBUTING.md) for checks appropriate to each change.

The published website uses the Vercel project `top1body-beta` and Supabase project `uyivfmmiwehfkcemjvmh`. The [21 November production audit](docs/AUDIT_2026_11_21.md) records the exact deployment and journeys verified on that date. Use the [operations runbook](docs/OPERATIONS_RUNBOOK.md) to match a later deployment to its source.

The [benchmark contract](docs/BENCHMARK_CONTRACT.md) defines the ranking calculation. The [published references](docs/PERFORMANCE_TEST_REFERENCES.md) document which tests support a cohort comparison. See also [training storage](docs/TRAINING_CONTRACT.md) and [localization](docs/LOCALIZATION.md).

## Native mobile client

Android/iOS source and packaged shared screens live in [mobile/](mobile/README.md). Native build/signing and device acceptance remain pending. See [mobile release status](docs/MOBILE_RELEASE.md) and [sync/account verification](docs/SYNC_AND_ACCOUNT_VERIFICATION.md).
