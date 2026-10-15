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

Health-related readings use disclosed broad product plateaus where implemented
instead of rewarding ever more extreme readings. Sleep plateaus at 420–540 min.
Body-fat game plateaus are sex dependent. These ranges are game choices, not
clinical advice. Sauna minutes, cold exposure minutes and thermal HRV rebound
receive a **neutral z=0** for every valid value: no dose or exposure is rewarded.
That neutral position maps to the same illustrative Top 55% for every entry.

Scores are capped at -3/+3 and mapped through a normal CDF to enclosing tiers:
1, 2.5, 5, 7.5, 10, 15, 20, 25, 30, 35, 45, 55, 65, then 65%+.
Each category averages its recorded metric z-scores. The overall game averages
populated category means equally. Missing and invalid values are excluded,
never filled as zero. Adding/removing metrics or categories changes the basis.

Published test bands supersede the illustrative number on a compatible test
card. Category/global rankings remain game estimates; published test percentiles
are not averaged. The pyramid uses equal-height display tiers, not population
areas. The current tier is highlighted, and reduced-motion settings are honored.

The downloadable calculation report keeps the previous stricter capacity-only,
protocol-gated model. The visual passport follows the game display and identifies
itself as illustrative. Neither artifact is a clinical health score.

## Your Potential

1. See the current game tier on the pyramid and choose a better tier.
2. Compare focused (one metric), balanced (up to two) and broader (up to three)
   routes. The deterministic what-if search considers only already-recorded,
   trainable physical capacity measurements (including explicitly enabled game-only combined grip, zone-2 power and sprint time); other values stay fixed.
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
