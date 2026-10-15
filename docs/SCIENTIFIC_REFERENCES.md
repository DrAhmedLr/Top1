# Scientific reference status

The composite remains an experimental product index. It has no validated population rank or clinical interpretation. Recorded coverage is not confidence. Other scored metric parameters remain product assumptions.

## Current individual-test reference

Version: `friend-2022-treadmill-rer1-v1`, introduced in model `6.2-friend2022-experimental`.

Primary source: Kaminsky and colleagues, *Mayo Clinic Proceedings* 97 (2022), 285–293, DOI [10.1016/j.mayocp.2021.08.020](https://doi.org/10.1016/j.mayocp.2021.08.020). [Full article and tables](https://www.mayoclinicproceedings.org/article/S0025-6196(21)00645-5/fulltext); [PubMed](https://pubmed.ncbi.nlm.nih.gov/34809986/).

The implementation uses **treadmill only**, with peak RER at least 1.0: Table 2 supplies means, SDs and sample sizes, and Table 3 supplies nine decile thresholds (10th through 90th). Fourteen sex/decade cells cover ages 20–89, with 9,564 tests in men and 6,714 in women. The 80–89 cell remains distinct from the interface's general 70+ age group. The larger study also contains cycle tests and a separate RER-1.1 analysis; these are not mixed into this reference.

Comparisons require a dated direct treadmill CPET report, test age in range, peak RER and a self-reported match to inclusion criteria (no known cardiovascular disease or COPD). Unknown context, cycle tests and estimates remain available for tracking. The US laboratory registry is not a worldwide probability sample. Older cohorts have relatively small samples; sample counts are shown.

Published rounded threshold matches and bands are reported without interpolation, exact ranks, extrapolated tails or invented confidence intervals. SD describes cohort spread, not measurement uncertainty. The available upper threshold does not support a top-1% claim.

## Version history and validation gap

The 2015 reference remains preserved in source for historical provenance. Signed 6.1 snapshots keep their model version; new calculations use 2022. These versions must not be compared as unchanged measurements under one model. The reference update does not validate the composite.

Composite calibration still requires a defined target population, permitted joint participant data for the same test battery, documented sampling design/weights, frozen normalization, disjoint independent validation and justified uncertainty. No such dataset is connected. Separate unrelated cohorts cannot be joined into fictitious participants. An individual source-backed VO₂ comparison does not validate other metrics or clinical outcomes.

## Individual grip-strength comparison

Tomkinson GR, Lang JJ, Rubin L, et al. International norms for adult handgrip strength. Journal of Sport and Health Science 2025;14:101014. DOI: https://doi.org/10.1016/j.jshs.2024.101014. Author repository full text: https://publikationen.bibliothek.kit.edu/1000183719/163164559.

Table 2 absolute kilogram quantiles P5, P10, P20, P30, P40, P50, P60, P70, P80, P90 and P95 are transcribed in lib/gripReference.ts for males and females, five-year groups 20–99 and the open 100+ group. The article is CC BY 4.0; attribution is retained here and in the source module. Display bands are TOP1's conservative grouping of the published quantiles. No interpolation or extreme-tail extrapolation is applied.

These are population-weighted, smoothed norms synthesized from studies using harmonized pseudo-data, not an individual-participant worldwide probability sample or a validated whole-body strength index. The reference protocol uses a hydraulic dynamometer, seated position, flexed elbow, neutral forearm, hand-adjusted handle, both hands, three attempts per hand, maximum single result. A summed combined-grip value and generic single-hand measurement cannot be substituted. Date, age at test, reference sex and compatible protocol must be documented; measurements and matching remain self-reported.

Per-test comparisons work with one eligible measurement. They do not change the experimental composite's parameters or validate its population distribution. Unranked observations remain recorded and never become zero.
