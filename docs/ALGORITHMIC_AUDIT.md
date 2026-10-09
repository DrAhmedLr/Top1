# Algorithmic and data audit · 9 October 2026

## Conclusion

The previous implementation could compute numbers consistently, but could not substantiate a global TOP-percent or clinical ranking. It lacked representative joint distributions, verified reference tables for 31 of 32 metrics, empirical correlation estimates, comparable protocols, and calibrated adaptation rates. These are missing research inputs, not parameters that can responsibly be invented in code.

The revised product reports a clearly labeled experimental performance index and contextual measurements. It withdraws the unsupported statistical and medical implications.

## Findings and corrections

| Finding | Correction |
|---|---|
| CDF of an unvalidated composite presented as population rank | Remove percentile/TOP-percent claims throughout dashboard, exports, public pages and OG cards |
| Unverified correlations inflated means as metric count changed | Use normalized weighted means within and across active pillars |
| P99 targets used to manufacture lifting SDs | Keep lifting anchors explicitly provisional; no P99 claim |
| Artificial VO₂ age decay and arbitrary adult cohort cells | Use published FRIEND decade mean/SD only for direct treadmill CPET, recorded test age 20–79 |
| Wearable/Cooper VO₂ treated as laboratory equivalents | Store estimate method; exclude from direct-CPET scoring |
| Clinical biomarkers and vital signs rewarded “lower always better” | Track 14 contextual metrics without scoring or scenario optimization |
| Sleep score jumped at the optimum boundary | Continuous quadratic approach to a seven-hour plateau; no extra gain or penalty above plateau |
| Body-fat targets applied without individual context | Tracking-only; no universal optimum |
| Grip citation used combined-hand sums for a single-hand input | Mark model provisional and disclose citation protocol mismatch |
| Arbitrary LMS parameters presented as fitted distributions | No clinical LMS scoring; retain numerical utility with stable Box–Cox and explicit assumptions |
| Correlation-free or sparse-subset score interpreted as confidence | Label weighted coverage as availability; minimum three scored inputs across two pillars |
| Simulator assumed unvalidated weekly adaptation and inconsistent unreachable endpoint | Arbitrary model steps; preserve initial values; consistent terminal state and unreachable status |
| Epley inflated measured one-rep lift; pull-up calculated added load alone | One rep equals actual load; pull-up estimate uses total system weight, then subtracts bodyweight |
| Male skinfold equation used outside calibration age | Restrict calculator to men 18–61 and supported site ranges; label estimate |
| Health HRV mixed SDNN and RMSSD | Require explicit RMSSD; reject unknown/SDNN rather than silently convert |
| No observation date, method, source, or test-age information | Validate and persist metadata; keep unknown dates unknown; adapter avoids older dated replacements |
| Clearing input destroyed measurement history | Add tombstone records; latest-record reads exclude cleared metrics |
| Concurrent devices could silently overwrite snapshots | Revision-based stale-write rejection; direct writers advance revision too |
| Owner-editable public JSON could forge displayed calculation | Server HMAC-bound versioned, dated public snapshots; legacy/altered summaries fail closed |
| Local migration discarded other keys or concurrent edits | Import each key independently; clear only unchanged successfully imported data |
| Floating precision differed between local/cloud snapshots | Normalize input precision to database numeric precision |

## Evidence boundaries

[FRIEND 2015 Table 4](https://pmc.ncbi.nlm.nih.gov/articles/PMC4919021/) reports 7,783 treadmill CPET tests from US adults without cardiovascular disease: 4,611 men and 3,172 women, ages 20–79. These means and SDs are reference values for that sample/protocol, not a current worldwide distribution. Decade bins have abrupt boundaries and do not imply continuous age adjustment or measured Gaussian percentiles.

[NHANES grip research](https://pmc.ncbi.nlm.nih.gov/articles/PMC7197498/) uses the combined maximum from both hands. It does not validate the app's single-hand model anchors.

[AASM/SRS sleep consensus](https://pmc.ncbi.nlm.nih.gov/articles/PMC4434546/) supports regular adult sleep of at least seven hours and allows individual needs, including longer sleep. It does not validate this app's score curve or a universal nine-hour ceiling.

[CDC A1c guidance](https://www.cdc.gov/diabetes/diabetes-testing/prediabetes-a1c-test.html) describes interpretation limitations including conditions that affect results. [AHA hypotension guidance](https://www.heart.org/en/health-topics/high-blood-pressure/low-blood-pressure-when-blood-pressure-is-too-low) reinforces that low pressure cannot universally be treated as better performance. These are contextual sources, not distributions for ranking.

## Remaining gray areas

- Seventeen scored metrics still use provisional reference parameters, weights, and scenario increments. Their index values have no demonstrated outcome validity.
- Self-reported methods, measurements, dates, and test ages cannot be independently verified by the app. A server signature does not solve that problem.
- Stale observations and mixtures of methods remain visible; there is no empirically justified expiration policy or uncertainty propagation.
- Device latency affects reaction time; sleep regularity indices and Zone 2 definitions differ across providers. Measurement instructions cannot establish cross-device equivalence.
- Missing data changes the measured subset and normalized pillar weights. The score can change when measurements are added, even without physical change. Between-person comparisons and mixed-subset longitudinal comparisons remain unreliable.
- The reference models use binary recorded sex as supplied by the source; no validated adjustment exists for pregnancy, hormone therapy, illness, medications, ancestry, or other clinical contexts.
- Registry input bounds protect supported storage/calculation ranges; they are not clinical normal ranges. Valid input does not imply safe or healthy.
- Google OAuth is not configured, and full hosted authenticated save/share/revoke verification has not been completed.

## Verification

43 automated application tests passed. Production build passed. Isolated PostgreSQL applied all five migrations and passed RLS, idempotency, anonymous-session isolation, visibility revocation, transactional rollback, metadata retention, tombstone history, and revision-conflict checks.

Production migration is not yet applied. The release is pending that operational step and corresponding hosted verification. Calibration work requires actual licensed cohorts, reproducible protocol definitions, external validation, and outcome studies before population or health ranking claims can return.
