# Fire & Ice triad upgrade

The supplied brief enumerates 36 active metrics, despite saying 34. All listed metrics are implemented. The two previous measurements omitted from the brief—systolic blood pressure and ankle dorsiflexion—retain their stored IDs and values as archived observations. They contribute neither to triad scores nor active coverage. Saving an existing profile preserves them.

## Architecture

- BodyMarkers: 12 inputs, base weight 0.38.
- Strength: 15 inputs, base weight 0.38.
- Recovery: 9 inputs, base weight 0.24.

Metric weights sum to one per active pillar. Base weights are renormalized over pillars containing eligible scored observations. Tier filters only change visible fields; they do not delete data or change aggregation. Counts and coverage use the full active registry, independent of filters.

Three panels replace the five-point radar in the dashboard, passport and public profile. OpenGraph previews use three score bars. Tailwind v4's `@theme` declarations define the requested slate/red/blue tokens directly in CSS; an unused v3 configuration file is not introduced. Animated bars honor reduced-motion settings.

## Audit safeguards retained

The index remains experimental. No world percentile, P99 threshold, fitted correlation matrix or weekly adaptation rate is asserted. The continuous bounded utility is retained rather than restoring the brief's discontinuity (which jumps from 2.326 to approximately zero outside its boundary and is not parabolic).

The requested sauna 60–90 min/week and cold 11–15 min/week bands are stored as unvalidated model metadata and disclosed in their evidence panels. They are not clinical recommendations and do not enter the index or optimizer. Thermal rebound has no calibrated reference. Exposure can be logged as zero and is never treated as proof of benefit or safety.

The [Finnish KIHD study](https://pubmed.ncbi.nlm.nih.gov/25705824/) evaluated observational associations in 2,315 middle-aged Finnish men; it does not establish a universal optimal weekly duration. The [winter-swimming study](https://pubmed.ncbi.nlm.nih.gov/34755128/) concerns thermogenesis in experienced male swimmers; it does not validate an 11–15 minute weekly optimum for everyone. No heat-shock or cold-shock protein measurement is inferred from minutes of exposure.

Choice reaction time is a different test from the former simple visual reaction input. Existing values retain their ID, but reaction time is now tracking-only and the evidence panel explicitly requires the correct choice protocol for new measurements. No old observation is silently reinterpreted as a verified choice test.

Waist-to-height ratio and fasting glucose are contextual measurements. Push-ups use a provisional performance anchor with strict technique guidance. Overnight HRV is explicitly RMSSD; SDNN is not interchangeable. Cooper-run VO₂ remains an estimate and does not acquire a direct-CPET population comparison.

The model version changes to `5.0-triad-experimental`. Old signed public summaries require a new save before they can be shown under the triad model. History, timestamps, ownership rules, stale-write rejection, and signed aggregate integrity are preserved.

## Verification

Application tests include exact tier assignments, 36 unique active metrics, retained legacy data, normalized weights, dynamic pillar aggregation, and exclusion of contextual and thermal observations from scoring. PostgreSQL checks cover all six migrations, the six new measurement IDs, valid zero exposure, invalid thermal range rejection, prior RLS policies, metadata, history, and revision conflicts.

The triad migration only replaces the measurement-range constraint with a superset of supported IDs; it does not delete rows, tables, or RPCs. All 46 application tests, TypeScript and the production build passed. Desktop and 390-pixel mobile layouts, tier switching without value loss, the thermal evidence panel, and the 1200×630 Edge OpenGraph image were verified locally. The production migration is applied and live SQL integrity checks passed; security and performance advisors returned no notices. Deployment status will be recorded after release. Google OAuth still needs provider credentials before a full hosted signed-in test can be performed.
