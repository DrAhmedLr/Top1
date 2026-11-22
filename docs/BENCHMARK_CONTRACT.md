# TOP% benchmark contract

## Combined performance in Ranking

`overall-performance-v2` combines the 13 ranked performance tests. Pushing includes push-ups, bench press and dips. Pulling includes pull-ups, weighted pull-ups, grip and dead hang. Lower body includes squat, deadlift and both jumps. Running includes 400 m and 5 km. The first eligible test starts a provisional overall rank. The interface shows how many of the four areas have a result. When all four have a valid score, the provisional label goes away. Capped tests, health measurements and published cohort ranks have their own displays. [Overall rules](../lib/overallPerformance.ts)

Use the current saved result for each eligible test and its test-day profile. If its modeled percentage is `p`, it contributes `log10(100/p)` difficulty points. Each area averages its logged tests. The overall score averages the areas with data, giving each equal weight. Cap the score at one difficulty point above the weakest recorded area and convert it back with `100 × 10^(-points)`. Every extra test in an area improves the coverage of that area while keeping the area's weight equal to other covered areas.

For a player aged 25 using the male reference at 75 kg, 20 strict push-ups produce **Top 20%** across one area. A subsequent 25:00 result in the 5 km earns Top 10% on its own. Those two areas yield **provisional overall Top 14.1%**, the geometric mean of 20 and 10. The save confirmation shows the actual previous and updated percentage. An identical retest leaves the result unchanged. A slower time may move it down. Once a third area is logged, each covered area has one third of the weight. Four recorded areas each carry one quarter. [Regression examples](../lib/overallPerformance.test.ts)

A worldwide estimate requires a separately reviewed four-area test battery measured in the same people, representative global sampling, matched test protocols and independent validation of the joint score. The server-side comparison weights the empirical test distributions, combines within and between areas, and ranks the composite against the held-out participants with survey weights. It returns the conservative tie treatment, documented uncertainty and the supported reference precision. An empirical top fraction finer than one validation participant per effective sample is suppressed, even if the declared ceiling was more optimistic. The client accepts only a comparison summary. No approved worldwide reference is connected. [World comparison](../lib/worldwidePerformance.ts) · [Calibration rules](../lib/benchmarkCalibration.ts)

## What a TOP% describes

A recorded result should show the value, unit, test method and date, alongside its most useful available comparison. A comparison carries a kind, a reference ID/version, a cohort description, a direction of better performance and a precision limit.

| Kind | What can be shown | Rule |
| --- | --- | --- |
| Published cohort bound | `Top 10% or better · FRIEND treadmill cohort`, for example | Match the test protocol and cohort first. If the highest supported threshold is P90, retain the open bound. Preserve the source's uncertainty and handle ties explicitly. |
| Cohort estimate | A range or appropriately rounded estimate with sample and method | Requires a defined population and a documented estimation and uncertainty method. Avoid pooling repeated results from the same participant as separate people. |
| TOP1 challenge | `TOP1 challenge · Top 5% tier` | A product milestone. Keep the challenge label adjacent to the number wherever it appears, including exports. |
| Unavailable | A raw result with a short explanation | No compatible cohort, challenge scale, or valid result. Unknown and unmeasured are distinct from zero. |

General-adult and trained-person views are independent. Label actual source groups such as Canadian adults, US lab participants or competition lifters. Each view may be unavailable even when the other is supported. A dataset with a narrow occupation or self-selected sport population cannot fill the broad population view.

## Published bounds and measurement history

Use the quantiles, comparison group, protocol and precision published by the source. An observation beyond the last published threshold retains an open bound. A tie at a rounded threshold retains the wider adjacent interval. Lower-is-better tests use their own direction. Keep a qualifying published comparison separate from the individual's game tier. [Reference inventory](PERFORMANCE_TEST_REFERENCES.md) · [Published-band implementation](../lib/topBands.ts)

For example, the Canadian jump reference at ages 30–34 for males has a P95 threshold of 59.1 cm. A compatible result strictly above it earns the published Top 5% or better bound. A result exactly on that rounded threshold keeps the wider Top 10% or better bound. The sources and their attribution are in the [scientific reference notes](SCIENTIFIC_REFERENCES.md).

For a new empirical reference, document eligibility, participant deduplication, effective sample size, counts in the relevant tail, tie rules and held-out validation. Account for the survey design and repeated measurements. Choose display precision that the uncertainty supports. A source can support a fine bound only for its own matched population and protocol.

Keep the entered value, unit, method, protocol and known test date with each observation. Preserve recorded test-day bodyweight and reference inputs through later profile edits. Show current and best results separately when comparing similar attempts. A change of protocol starts a distinct comparison series. A completed attempt with zero repetitions remains distinct from an unmeasured test. [Measurement decisions](RANKING_METRIC_DECISIONS.md) · [History implementation](../lib/history.ts)

The retained `balanced-challenge-v1` adapter reproduces the earlier four-area pilot for compatible historical data. Its qualifying protocol and coverage rules apply to that version. The combined game result displayed by Ranking uses `overall-performance-v2` above. [Historical adapter](../lib/balancedBaseline.ts)
