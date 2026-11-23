# Language and layout

TOP1 supports English, French and Arabic. The page sets its language and reading direction on the first render. Arabic uses right-to-left layout. Switching languages should preserve the measurement in progress and keyboard focus.

On a first visit the web reads the primary language in the browser’s Accept-Language header. The native client reads the WebView’s device language. Regional variants such as fr-CA and ar-MA use French and Arabic. An unsupported primary language starts in English.

My profile → Language lets a user choose a language or return to Device language. A manual choice takes priority on the next visit. The web saves it in the first-party `top1-locale` cookie for one year. The native client saves it in local storage. Choosing Device language clears the override. [Locale provider](../components/providers/LocaleProvider.tsx) · [Server rendering](../app/layout.tsx)

Client components can access translations with `useTranslations`. Server pages use `getTranslations`. Shared messages live in the [catalog](../lib/locales/catalog.json) and [parameterized templates](../lib/locales/patterns.json). Some screens select three localized strings directly in their components. When editing copy, check the actual rendering path in all three languages. Preserve dynamic placeholders, entered values, stored identifiers and user-written text. Keep research titles in their publication language.

Translate the comparison label with its number, units, reference group and open bound where applicable. The [per-test game rules](PERFORMANCE_GAME_RULES.md) define game milestones. The [published comparisons](PERFORMANCE_TEST_REFERENCES.md) define the precision available for each cohort.
