# Individual performance rules

The current game uses thirteen performance curves. It scores a comparable attempt in its original unit and suggests the first practically recordable result that reaches a better tier. Game percentages describe difficulty under these rules. Published comparisons, personal trends and goal probabilities use their own labels and calculations.

## Reference points

These are reference settings for an adult in their twenties, 75 kg, with the male reference selected. The table lists whole counts or practical units. Between two points, the game interpolates on the logarithm of the percentage. At the last point the player earns **Top 0.01% or better**. Subsequent improvements remain visible in the recorded value and personal history. The next goal never requires a manufactured smaller percentage.

| Test | Everyday reference | Top 5% | Top 1% | Top 0.01% | Goal increment |
| --- | --- | --- | --- | --- | --- |
| Strict push-ups | 20 reps · Top 20% | 40 | **60** | 90 | 1 rep |
| Strict pull-ups | 8 reps · Top 20% | 20 | 33 | 52 | 1 rep |
| Parallel-bar dips | 10 reps · Top 25% | 23 | 27 | 50 | 1 rep |
| Dead hang | 45 s · Top 50% | 120 s | 180 s | 300 s | 1 s |
| Standing broad jump | 2.00 m · Top 30% | 2.50 m | 2.65 m | 3.20 m | 1 cm |
| Countermovement jump | 40 cm · Top 25% | 55 cm | 60 cm | 90 cm | 0.1 cm |
| Single-hand grip | 48 kg · Top 25% | 60 kg | 65.5 kg | 90 kg | 0.1 kg |
| Bench press | 1.00 × BW · Top 25% | 1.40 | 1.50 | 2.10 | 0.01 × BW |
| Squat | 1.40 × BW · Top 25% | 1.95 | 2.15 | 3.00 | 0.01 × BW |
| Deadlift | 1.65 × BW · Top 25% | 2.25 | 2.50 | 3.60 | 0.01 × BW |
| Weighted pull-up | added 0.35 × BW · Top 25% | 0.65 | 0.80 | 1.25 | 0.01 × BW added |
| 5 km run | 25:00 · Top 10% | 22:30 | 20:00 | 15:00 | 1 s faster |
| 400 m | 75 s · Top 25% | 57 s | 50 s | 43 s | 0.1 s faster |

BW means bodyweight on test day. Weighted pull-ups use **added load** divided by bodyweight. Running uses total elapsed time. The model accepts additional precision already present in older entries while goals use the increments above. A displayed tier describes a range. For example, after 20 push-ups at the reference settings, 25 reps is the first whole number to enter Top 15%. After a 25:00 5 km, 23:57 enters Top 7.5%.

## Test-day adjustments

Each multiplier changes the difficulty credited to the same result. Multipliers are explicit game design choices. For reps, load ratios, grip, distance and hold duration, multiply the recorded value by the factors. For races, divide elapsed time by them. The adjusted value selects a position on the reference curve. Personal records retain the original measurement.

| Test | Age adjustment per year after stated age | Mass adjustment per kg outside neutral range | Female reference multiplier |
| --- | --- | --- | --- |
| Push-ups | +0.30% after 30 | +0.15% above 85 kg, neutral below | 1.20 |
| Pull-ups | +0.35% after 30 | +0.20% | 1.55 |
| Dips | +0.30% after 32 | +0.16% | 1.35 |
| Dead hang | +0.20% after 35 | +0.20% | 1.10 |
| Broad jump | +0.25% after 30 | +0.06% | 1.16 |
| Countermovement jump | +0.30% after 30 | +0.075% | 1.20 |
| Grip | +0.25% after 40 | −0.15% | 1.50 |
| Bench | +0.25% after 35 | Included in BW ratio | 1.55 |
| Squat | +0.30% after 35 | Included in BW ratio | 1.36 |
| Deadlift | +0.25% after 35 | Included in BW ratio | 1.30 |
| Weighted pull-up | +0.30% after 32 | Included in BW ratio | 1.30 |
| 5 km | +0.25% after 35 | +0.06% | 1.10 |
| 400 m | +0.20% after 30 | +0.04% | 1.10 |

The age effect accrues for up to 40 years after the listed age. The usual mass-neutral interval is 65–85 kg. Below the lower limit, each kg contributes in the opposite direction to a kg above the upper limit. The adjustment stops after 30 kg in either direction. Push-ups retain their reference threshold at any supported weight up to 85 kg. This is a convenient game reference and makes no assumption about height or body composition. Grip uses a small inverse mass adjustment because the reading is an absolute force measure. The four relative-strength events already use mass in the measurement itself. Unknown fields and unspecified reference sex each apply a unit multiplier.

## Coverage and versioning

Only the thirteen tests above enter this ladder. Chair stands and single-leg balance support functional or maintenance targets. Direct treadmill VO₂ can receive a compatible published comparison with a documented upper bound. Bloodwork, body composition, sleep, recovery and other private observations retain their own history and interpretation.

Current test versions use `performance-v3/<metric-id>`. The four-area `balanced-challenge-v1` pilot still calls its frozen v10 evaluator. The original personalized push-up curve remains reproducible with `pushupModelPercentV2`. Scientific comparison tables use their published protocol and cohort rules. [Curve definitions](../lib/performanceRules.ts) · [Next-tier search](../lib/challengeProgress.ts) · [Anchor and boundary tests](../lib/challengeProgress.test.ts)
