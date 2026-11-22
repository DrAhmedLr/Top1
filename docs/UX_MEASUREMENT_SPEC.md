# Privacy-safe UX measurement

The owner deferred connecting PostHog. The collector requires the configured public project key and host. A moderated pilot can observe whether a participant can save a first result, understand its comparison, log a second test and complete a comparable retest. [Player journey](TOP1_PLAYER_JOURNEY.md)

## Observable events

The dashboard records an `app_viewed` event when a distinct view opens. Measurements emits `measurements`, and the active Program screen emits `program`. Guest and account persistence emit `measurement_saved` or `measurement_cleared` for saved changes. A within-session sequence of views and successful saves can describe progress through those steps. Anonymous memory-only identity limits retention analysis across visits. [Dashboard navigation](../components/Dashboard.tsx) · [Guest history](../lib/hooks/useGuestHistory.ts) · [Account saves](../lib/hooks/useCloudSave.ts)

The adaptive planner lets users save plans and log sessions. Its view event measures visits. Measuring completed plans or sessions requires instrumenting successful writes and verifying those events with a synthetic journey. Signup requests and confirmations may occur in separate browsers. Their counts describe aggregate operations. [Adaptive planner](../components/AdaptiveProgram.tsx)

## Data minimization

The event allowlist accepts enumerated views, sharing channels and known metric IDs as appropriate to each event. Measurement values, demographics, account identifiers, free text, URLs, queries and tokens stay outside event properties. Autocapture, session recording and person profiles stay disabled. Pending events are bounded and kept in memory. Analytics failures must leave saving available. [Event contract](../lib/analytics.ts) · [Allowlist tests](../lib/analytics.test.ts)
