# Programme design and validation

## What informs a programme

TOP1 starts with the athlete’s saved measurements, test units, equipment, availability and targets. When weekly availability is unspecified, the builder can infer a starting schedule from at least four completed training days across three weeks within the preceding eight weeks. Overlapping training logs contribute their elapsed time once. Explicit choices take precedence. Where comparable measurements cover three or more intervals, the builder can also consider the athlete’s measured pace. These inputs support planning without asking the athlete to repeat a personal record.

The movement suggestions help an athlete train several related goals in the same weekly time budget. Push-ups and bench press can share a pressing stimulus. A small eight-week study in men found bench-press strength improvements after matched low-load pressing or push-up training. Squat and countermovement jump are another studied pairing. Other recommendations, such as pull-ups with dead hang, identify shared movements or demands. TOP1 requires the appropriate test to confirm improvement in each metric. [Push-up and bench-press trial](https://pubmed.ncbi.nlm.nih.gov/29541130/) · [Squat and jump study](https://pubmed.ncbi.nlm.nih.gov/22344055/) · [ACSM position stand for healthy adults](https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/)

The as-prescribed percentage estimates one metric’s chance of reaching its target by the selected deadline if its remaining sessions are completed as prescribed. Initial probabilities use model assumptions. Once there are at least three comparable intervals with the required workout evidence, a personal simulation uses the athlete’s observed responses. Shared forecasting uses prospectively issued probabilities, explicit sharing, dated retests and held-out evaluation. Single-goal and grouped-plan forecasts carry separate model versions. TOP1 has no validated probability of achieving every goal in a bundle.

## Progress and recent pace

The progress bar follows the latest comparable test in the goal’s units, in either direction. The dated goal outcome separately preserves a verified on-time achievement. An athlete can start with a named collection, add another measured goal later and stop a goal while retaining its history. The calendar allocates the available training time across the active goals. A changed prescription keeps its prior revision, check-ins and original forecast.

The recent-pace model draws 1,024 simulated paths from the athlete’s measured training intervals and short sequences of documented attendance. It distinguishes completed, modified and skipped sessions. It needs at least three comparable intervals containing performed training, a recent retest, and at least three documented workout slots covering 70% of recent due slots. An unlogged slot after the last test can leave post-test progress unknown. The trajectory can include declines and plateaus. It reports the fraction reaching the target by the chosen date. The median finish date and middle-half range are shown only when enough paths reach the target within the supported horizon. A finish after the deadline assumes the same training pattern continues.

The signed-in service preserves the first eligible recent-pace estimate for each goal opening under a distinct model version. Admin shows its performance against all measured outcomes, including modified and missed workouts. This model uses personal history. Future empirical adjustments for it should be evaluated on attendance-inclusive cohorts. The page also gives the fully adherent subset for comparison. Sample sizes and missing final tests are essential when interpreting early results.

Proposed movement skills, measurement protocols and cohort requirements are detailed in the [skill goals design](SKILL_GOALS_DESIGN.md).

## Next validation steps

| Step | Decision the results support |
|---|---|
| Follow the first consenting groups through their deadlines. Count observed, unobserved, replaced and late results for each metric, and review which scheduled retests athletes actually complete. | Identify goals for which there is enough follow-up to evaluate predictions. |
| Compare the probability issued at the time with the measured on-time result on later, independent athletes. Report calibration by metric, model stage, plan type and attendance alongside sample sizes, Brier scores and the observed-minus-predicted gap. | Apply an empirical correction only where it improves held-out performance. |
| Once enough comparable paired measurements exist, test whether including a related exercise improves forecasts beyond an athlete’s own metric history. Examine linked training load and recovery time as well as completion. | Add transfer coefficients only for pairings with a reproducible improvement on later athletes. |
| Review consented journeys from goal selection through first workout and final retest. Compare where athletes stop across screens and how often they adjust or skip a prescription. | Test changes to the interface where users repeatedly have trouble. |

The account training ledger retains prior versions of prescriptions and actual workouts. An exercise substitution preserves the exercise that was prescribed and the exercise actually reported. The existing export, withdrawal and erasure controls apply. IP address and time spent using the interface are product-usage data. The fitness models use training and test evidence.
