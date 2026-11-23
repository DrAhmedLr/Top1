# Proposed skill goals for TOP1

**Decision for this release.** The existing strength and conditioning tests can be combined into programmes now. The following skill catalogue is a proposal for review. A movement can be worth training even before TOP1 has enough observations to estimate its population rank or completion date.

## What an athlete could choose

**Calisthenics control** could offer a strict bar muscle-up repetition goal and a parallel-bar L-sit duration goal. Five clean repetitions and a 20-second hold are example challenge targets. Show the two results separately and award the programme milestone when both have been demonstrated within the agreed window. Offer individual goals to athletes who prefer one discipline. Suggest the collection from the athlete’s explicit preferences, equipment, comparable measurements and recent choices. Allow them to change or decline it.

**Gymnastics skills** could list a first verified backflip and a first verified frontflip as independent goals. **Split mobility** could offer left front, right front and middle split goals. Each collection should explain the constituent skills before someone joins. A user can add a second collection without resetting an earlier goal.

## Measurement contract to review with coaches

| Proposed metric | What to record | What belongs in a different series |
|---|---|---|
| Strict bar muscle-up | Count consecutive valid unassisted repetitions under a fixed judging rubric. Define start, finish, motion permitted, failed repetitions and how rest ends a set. Record apparatus, attempt date and verification level. | Rings, kipping and assisted attempts each need their own protocol. Pull-up and dip results remain candidate predictors. |
| Parallel-bar L-sit | Duration of a continuous valid hold in seconds. Define apparatus height, elbow and leg position, timing start and stop, allowed timing uncertainty and number of attempts. | Floor, rings, tuck holds and one-leg variants get distinct records. |
| Backflip and frontflip | A separate dated first successful unassisted demonstration per skill, with an agreed completion rubric, apparatus/surface and qualified coach confirmation in a suitable facility. Record unsuccessful assessed attempts and interrupted follow-up separately. | Spotted, trampoline, apparatus-specific and other assisted demonstrations are separate milestones. Keep acrobatic instruction with the qualified coach. |
| Splits | Choose one repeatable measurement such as remaining vertical distance in centimetres, with fixed positioning, support, measurement location, surface, warm-up conditions and measurement tolerance. Keep side and split type. | Left, right and middle splits use different series. A changed protocol starts a separate baseline. A zero gap can be recorded only under the reviewed completion definition. |

Every result should carry metric and protocol versions, units, test date, relevant context, recording date and evidence level. Store corrections as revisions. Track time spent training and actual exercise separately from testing. An absence of tests means the outcome is unknown. Retain the prior definition on historical results when a rubric changes. Coach attestation can be stored as a result and verification level without requiring permanent customer video.

## Where these skills fit in the algorithm

1. **Catalogue and prerequisites.** Use a graph with separate relationships for prerequisites, common training movements and acceptable test variants. A pull-up or dip can help suggest a muscle-up programme. Only a tested muscle-up can unlock that milestone. A graph edge should never silently convert a logged exercise into mastered ability.
2. **One target, one type of forecast.** Use repeat-test changes for repetition and duration goals only after checking comparable protocols, measurement error, and ceiling effects. Splits need a bounded distance model that handles measurement noise near zero. First-time acrobatic skills need a time-to-first-confirmed-demonstration model with dated exposure and opportunities for assessment. People who stop reporting are censored at their last adequate assessment. The athlete should see the missing prerequisite or next assessment while evidence is insufficient.
3. **Combined programmes.** Reserve shared time, equipment and recovery across all active goals. Evaluate each skill separately against its deadline. A combined probability would require joint outcomes for the same people under the same programme. Do not multiply separate chances or infer transfer percentages from movement similarity.
4. **Product tiers and population claims.** Publish transparent named difficulty challenges first. For a statement such as “Top 1% of calisthenics practitioners,” define the population, sampling method, inclusion criteria, fixed battery, scoring rule, test window and missing-test treatment in advance. Collect all components on the same participants. Estimate the joint score distribution and its upper tail with uncertainty, accounting for recruitment and sampling weights where appropriate. Use age or reference-sex adjustments only where supported. App volunteers can establish a labelled TOP1 participant comparison. A broader population claim needs a corresponding sample.
5. **Validation and admin visibility.** Freeze forecasts at issue time and separate future users or later cohorts for evaluation. Review outcome coverage, judging agreement, error in repeat scores, calibration by probability band and time horizon, Brier score and finish-window coverage. Compare with a simple baseline and inspect sparse and equipment-specific groups. Admin should show protocol version, sample size, uncertainty, outcome sources and the highest supported rank. Keep a fallback to tracking when evidence weakens.

## Suggested order

| Stage | Deliverable | Decision before proceeding |
|---|---|---|
| 1. Protocol review | A coach-reviewed rubric and example scored attempts for each candidate, starting with strict bar muscle-up and parallel-bar L-sit. | Can two reviewers consistently count or time the same attempt? |
| 2. Consenting pilot | Dated assessments and workout check-ins, paired repeat tests and explicit reasons for missing final assessments. | Are comparable repeat results and follow-up reliable enough for personal progress? |
| 3. Named challenges | Launch individually verified milestones and a combined badge under a product-defined name. | Is the unlock rule understandable and reproducible? |
| 4. Forecast evaluation | Evaluate individual skill models on later, independent athletes, including finish-window coverage. | Which skills, if any, support a personal probability and estimated finish date? |
| 5. Population ranking review | Obtain or collect a documented joint reference cohort for the precise claim. | Publish the supported tail and uncertainty, or retain the named challenge. |

No new runtime package is required for protocol design or a pilot. Coach review, repeatability data and prospective athlete outcomes are the next inputs. Existing evidence and held-out checks are in the [programme validation plan](PROGRAMME_EVIDENCE_AND_VALIDATION.md).
