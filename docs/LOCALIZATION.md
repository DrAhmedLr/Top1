# Languages and reference bands

TOP1 supports English, French and Arabic. The language control sits beside account access on desktop and mobile; sign-in and information pages also expose it. Arabic uses an RTL layout. Scientific identifiers, source titles, units in exported records and user-created text retain their original meaning.

The `top1-locale` first-party cookie stores only `en`, `fr` or `ar` for one year. Server rendering reads it so language and direction match the first rendered page. Changing language updates the page without resetting measurement inputs. Nothing is sent to an external translation service.

UI translations live in `lib/locales/catalog.json`; parameterized sentences live in `lib/locales/patterns.json`. Both translations must preserve every numbered placeholder. Use `useTranslations` in client components and `getTranslations` in server pages. Translate UI labels at presentation, never stored observations or user-written routine names. Original research titles remain in their publication language.

The default experience is guest-first: visitors choose when to start and accounts are optional for saving across devices. Existing account and privacy protections remain in effect.

## Brackets

The requested display boundaries are 1, 2.5, 5, 7.5, 10, 15, 20, 25, 30, 35, 45, 55 and 65 percent, followed by 65%+. No sub-1% label is displayed. Boundaries define display categories, not a new statistical model.

Eligible VO2 treadmill, international-protocol grip, Canadian combined-grip and Canadian jump tests have separate published individual-test comparisons. Each can display with just one measurement. FRIEND 2022 publishes decile thresholds. The display encloses the entire source interval within product boundaries: P60–P70 is top 30–40% in the study cohort, shown as Top 30–45%. Rounded threshold ties conservatively span both neighboring intervals. Open tails remain open: above P90 is Top 10% or better, never a fabricated Top 1% assignment. A source interval crossing the final boundary spans the 65%+ group.

VO2 uses a named US laboratory cohort; grip uses published international smoothed norms for matching age/sex groups. Neither is a universally agreed whole-person rank. Missing measurements never become zero. The unvalidated composite cannot produce an empirical population rank. With the owner’s explicit approval, the dashboard presents a separate, visibly labeled illustrative game estimate. It applies a mathematical normal CDF to explicit game anchors and uses the product brackets. Each populated category has equal weight globally. This distribution is an assumption, not observed population data. The current dashboard includes every valid recorded active metric; missing entries are excluded. See BENCHMARK_GAME.md for the separate display model and its plateau/neutral policies. The scientific report still has stricter capacity-only eligibility. Adding or removing eligible inputs can change the estimate. Source-backed per-test bands remain separate inside the section details.

## Public source

The owner selected the MIT license. The application source is available under the root LICENSE file. Research papers, reference data and third-party dependencies retain their own terms; the application license does not relicense those materials.

## Stitch-inspired experience and potential planning

The dashboard uses a fire/ice/emerald animated hierarchy pyramid and gradients adapted to the original Stitch direction. Its highlighted tier reflects the current illustrative game estimate and respects reduced-motion settings. Icons share one mapping across categories and metrics.

Your Potential shows the scenario sandbox before the weekly plan. One eligible performance input can be explored with `allowPartial` in the sandbox; this does not change the three-input requirement for a saved experimental assessment. Model steps are not weeks or an expected training rate. An explicit action chooses a scenario, another appends editable routine suggestions, and the existing Save action persists the reviewed plan. Existing actions are never overwritten; the eight-action limit remains. Chosen scenario context is stored on this device, scoped to the guest/account, while saved routine actions use the existing storage contract. Guest-data deletion includes guest scenario context, and account deletion cleans up account-scoped scenario context.
