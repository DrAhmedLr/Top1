# TOP1 benchmark game and weekly routes

The dashboard is an entertainment and self-tracking layer. Its Top X% labels
are illustrative benchmark positions, not measured world percentiles or an
assertion that product choices have universal scientific agreement.

## What is published

Eligible treadmill CPET uses FRIEND 2022 and seated hydraulic maximum grip uses
iGRIPS 2025. Two additional independent references now use Hoffmann et al.,
2019, Canadian Health Measures Survey cycle 5 (2016–2017):

- Jump height: Table 4, adults 18–69. Leonardo Mechanograph force plate,
  arm swing, best of three valid jumps, following practice (at most five
  attempts). Wall marks, apps, hands-on-hips and other force plates do not match.
- Combined grip: Table 1, adults 18–79. Standing Smedley III, arm about 45°
  from body, alternating hands for two trials per hand, sum of each hand's best.
  NHANES three-trial and seated hydraulic maximum protocols do not match.

The first implementation deliberately loads P10/P50/P90, giving broad enclosing
bands and open tails; it does not interpolate finer percentiles. Date, compatible
method, test age, reference sex and explicit protocol must be supplied. Values
and published bands are independent of other measurements.

Source: https://www150.statcan.gc.ca/n1/pub/82-003-x/2019010/article/00002-eng.htm
Tables 1 and 4, Statistics Canada Open Licence Agreement:
https://www.statcan.gc.ca/en/reference/licence
Adapted data are TOP1's responsibility; Statistics Canada does not endorse TOP1.
The Canadian sample and test exclusions do not establish worldwide ranks.

## Game rules

`lib/benchmarkGame.ts` is separate from the scientific scoring engine. Every
valid recorded active metric gets a game estimate. The main anchors are the
registry's provisional means and deviations, with the existing demographic
lookup where available. Using study moments in a game formula does not establish
a representative percentile or waive a published test's compatibility criteria.

Explicit extra anchors (mean, deviation): combined grip 95/20 kg (56/20 for the
female option); 10m sprint 2.2/0.35 seconds. Other overrides are enumerated in the
module. These are product assumptions. They have not been externally validated.

The active protocol contains 35 optional metrics. Sauna duration, cold-plunge
duration and thermal HRV rebound have been retired from entry, standings,
coverage, routes and global scoring. Older raw observations remain stored and
exportable through the existing legacy-data paths; no records are deleted.

Health-related readings use disclosed broad product plateaus where implemented
instead of rewarding ever more extreme readings. Sleep plateaus at 420–540 min.
Body-fat game plateaus are sex dependent. These are game choices, not clinical
advice. Resting heart rate and useful recovery measures are retained.

Before aggregation, divide each raw metric z-score by its attainable positive
ceiling and multiply by 3, then clamp to [-3,+3]. A plateau's raw ceiling is 1;
a linear metric's ceiling is the smaller of 3 and its best valid endpoint's raw
z-score. Thus every active metric can earn full game credit at an attainable
value, including sleep and resting heart rate. This normalization fixes the
previous ceiling defect; it does **not** establish population rarity. The score
maps through a normal CDF into the same asymmetric game tiers. Published test
percentile bands stay separate and are never recalibrated to invent precision.

Each category averages its recorded metric z-scores. The overall game averages
populated category means equally. Missing and invalid values are excluded,
never filled as zero. Adding/removing metrics or categories changes the basis.

Every test card leads with its normalized game estimate. Compatible published
test bands appear separately, with their own source-resolution limit. Category/global rankings remain game estimates; published test percentiles
are not averaged. The pyramid uses equal-height display tiers, not population
areas. The current tier is highlighted, and reduced-motion settings are honored.

The downloadable calculation report keeps the previous stricter capacity-only,
protocol-gated model. The visual passport follows the game display and identifies
itself as illustrative. Neither artifact is a clinical health score.

## Your Potential

1. See the current game tier on the pyramid and choose a better tier.
2. Compare focused (one metric), balanced (up to two) and broader (up to three)
   routes. The deterministic what-if search considers only already-recorded,
   trainable physical capacity measurements (including explicitly enabled game-only combined grip, zone-2 power and sprint time) or short-sleep / regularity habit measures; other values stay fixed.
3. Inspect raw target measurements and generate an editable weekly program.

Route increments and the 50%-or-five-increments cap are product choices, not
estimates of biological feasibility. A route that cannot reach a tier explicitly
shows the closest result. More effort does not imply a shorter verified time.

## Weekly program

Preferences: 1–3 available days, 10/20/30/45 min, starting/returning versus regular
practice, and normal versus lighter week. Adjacent demanding days are removed,
including Sunday/Monday. The first two unfinished goals are prioritized by
measurement progress. New measurement values—not checked boxes—determine
progress from the saved baseline to the hypothetical target. Missing/invalid or
reached goals do not trigger further training tasks.

Previous fourteen **completed calendar days** are compared against their dated
schedules and latest completion states. Unknown schedules are excluded. At least
four due actions and under 60% adherence, or choosing a lighter week, caps the
session at 20 min. Good adherence never automatically raises load.

Templates include comfortable push-up repetitions, familiar submaximal lifting,
light grip practice, controlled jump technique, chair rises, supported balance /
mobility, and conversational walking/cycling. These are editable suggestions,
not individualized clinical prescriptions or predictions. The default starts
conservatively. The weekly review does not require a maximal retest.

General activity guidance:
https://www.canada.ca/en/public-health/services/publications/healthy-living/physical-activity-tips-adults-18-64-years.html

Generating/updating a program replaces only `coach-` generated actions; manual
actions remain. Stable generated action IDs retain check-in links. Saving uses
the existing versioned routine flow; historical schedules remain intact. The
scenario and preferences remain scoped to the current account on this device.
Clinical markers and thermal exposure never become automated optimization tasks.

## Detailed session prescriptions

The generated session preview now specifies exercises, sets, repetitions or
duration/distance, rest, effort, form cues, an easier alternative, progression
conditions and reassessment guidance. Work + inter-set rest + transitions +
warm-up + cool-down fit within the chosen time budget. The routine stores concise
matching dose/rest labels; full guidance is displayed in the program preview.

Choose home/gym equipment and standard/gentle movement. Gentle mode replaces
jumps/sprints with preparation exercises and labels them as alternatives, not
equivalent test practice. Working weights for barbell lifts are optional values
entered by the user, never inferred from a percentile or an unverified bodyweight.
At low push-up capacity the program uses an incline regression. Progression is
conditional on two comfortable sessions and does not happen merely from checking
boxes. The program is focused practice, not a claim of a perfect personalized
or comprehensive clinical training prescription.

Training principles: https://acsm.org/resistance-training-guidelines-update-2026/
The specific template choices, conservative starting doses and time budgets are
TOP1 product rules, not directly validated individualized study prescriptions.

When the selected tier or measurement goals are already reached, the planner can
generate a maintenance week. Equal baseline/target values use finite achieved
progress; a later drop is not treated as continued success. No above-Top-1%
target is introduced.

Short sleep duration and sleep regularity can also generate daily, five-minute
habits, separate from the physical-session budget: consistent sleep opportunity,
wake time, wind-down and a matched diary/device. These actions follow general
CDC sleep-habit guidance, not a guaranteed numerical response. Routes never
increase sleep past its plateau, advise forced sleep or automatically prescribe
less sleep for a long-sleep observation. Habit tasks are scheduled daily, not
just on workout days. Source: https://www.cdc.gov/sleep/about/

Game display version: `2-attainable-35`. Older saved scenarios retain raw targets
and routines, but their stale projected rank is hidden and a refresh notice is
shown. The user reselects a tier to regenerate under the current rules.
