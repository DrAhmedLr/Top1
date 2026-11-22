# TOP1% mobile training loop

## Product

Pick a measurable target and date, build a feasible weekly schedule, log what happened, and retest. The four main screens are Home, Measurements, Program and Ranking. The measurement journal supports 36 active metrics. The program accepts the 16 physical performance tests in the strength catalog. Goals can use an absolute 1RM in kg when the original lift has a recorded bodyweight. A manual baseline can also start a program.

Home offers direct test entry and an optional game preview. The library groups active registry metrics and opens their real editors. On return, Home shows the current target or last saved result, with the demo available separately. The main shortcut can follow the last action or be pinned with a favorite measurement on this device. The user's profile holds their availability, experience and equipment.

## Training and scenarios

The starting session uses the selected test and starting value, time budget, experience and available equipment. Each suggested field is editable. Saved prescriptions retain a dated workout snapshot. The next session uses the actual work recorded. A missed session can reduce the set count. Two consecutive completed prescriptions can add one repetition or five seconds within the plan's limits. Test results and training volume are separate data.

A personal simulation becomes available after at least three usable intervals between comparable tests. It samples recorded intervals under compatible training conditions, including stagnation, declines and logged absences. The panel displays the interval count, completed sessions and remaining scheduled sessions. Its percentage is the share of simulated paths reaching the target by the deadline.

The editable scenario works backward from the target and remaining scheduled sessions. It counts how many positive responses of an assumed size would close the gap and computes a binomial tail using completion probability and conditional response probability. The user can vary these assumptions. A changed prescription calls for new assumptions. The model assumes independent sessions and a fixed gain per effective session. Its output is conditional. Estimating a calibrated individual probability requires prospective outcomes for comparable goals, doses and horizons, with held-out evaluation. Preserve each forecast before its outcome and evaluate calibration by person and time, accounting for missing follow-up and subgroup coverage. Report uncertainty on an independent cohort before making a claim about success rates. [External-validation guidance](https://www.bmj.com/content/384/bmj-2023-074820)

## Comparing performance

Published comparisons require a matching test, protocol and cohort and report the precision supported by the source. The 13 open tests have individual TOP1 game scales and a displayed upper bound of Top 0.01% or better. The provisional overall percentage updates with the visible area count after each performance test. [Rules by test](PERFORMANCE_GAME_RULES.md) All 36 metrics support an empirical personal comparison after repeated entries. Dated, comparable tests take priority. A comparison of quick entries describes the numerical position among the user's logged values. A high numeric percentile for a lab or recovery measurement has no implied health benefit.

The rank visualization names its comparison group. Its schematic curve does not estimate the observed shape of a population. The history view preserves recorded values, dates and provenance. See the [benchmark contract](BENCHMARK_CONTRACT.md) and the [training storage contract](TRAINING_CONTRACT.md).
