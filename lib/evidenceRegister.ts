export type EvidenceEntry = {
  id: string;
  citation: string;
  year: number;
  url: string;
  studiedPopulation: string;
  protocol: string;
  outcome: string;
  supportedDecision: string;
  limitations: string;
  falsificationOutcome: string;
};

/**
 * Versioned sports-science evidence register.
 * Every product rule tied to exercise science records its source, studied population,
 * supported decision, limitations, and the prospective outcome that would falsify it.
 */
export const EVIDENCE_REGISTER_VERSION = 'evidence-register-v1';

export const EVIDENCE_REGISTER: readonly EvidenceEntry[] = [
  {
    id: 'kikuchi-nakazato-2017',
    citation: 'Kikuchi N, Nakazato K. Low-load bench press and push-up induce similar muscle hypertrophy and strength gain. J Exerc Sci Fit.',
    year: 2017,
    url: 'https://doi.org/10.1016/j.jesf.2017.06.003',
    studiedPopulation: '18 moderately trained young men (mean age ~20 y).',
    protocol: '8 weeks, twice weekly: 40% 1RM bench press vs biomechanically matched push-ups to failure.',
    outcome: 'Similar bench-press 1RM and pectoralis thickness gains across both groups.',
    supportedDecision:
      'Propose strict push-ups as a compatible supporting win or no-barbell substitute alongside a bench press goal, without fabricating a numerical bench transfer coefficient.',
    limitations:
      'Small sample of young men at 40% 1RM; does not establish high-load (>80% 1RM) transfer or older/female athlete transfer magnitudes.',
    falsificationOutcome:
      'Paired retests on consenting TOP1 athletes showing that push-up-only blocks fail to improve or preserve subsequent comparable barbell bench 1RM.',
  },
  {
    id: 'bickel-cross-bamman-2011',
    citation: 'Bickel CS, Cross JM, Bamman MM. Exercise dosing to retain resistance training adaptations in young and older adults. Med Sci Sports Exerc.',
    year: 2011,
    url: 'https://pubmed.ncbi.nlm.nih.gov/21131862/',
    studiedPopulation: '70 adults stratified into younger (20–35 y) and older (60–75 y) cohorts.',
    protocol: '16-week progressive resistance training followed by 32-week detraining or reduced-dose maintenance (1/3 or 1/9 of original volume).',
    outcome:
      'Younger adults retained strength on 1/9 dose (1 session/wk, 1 set) and muscle mass on 1/3 dose; older adults needed 1/3 dose to maintain strength and still saw partial hypertrophy loss on 1/9.',
    supportedDecision:
      'Set initial post-achievement strength maintenance doses conservatively by age band (1 brief session/week under age 60; 2 brief sessions/week at age 60+), treated as an estimate to verify with retests.',
    limitations:
      'Knee-extensor lab protocol; upper-body barbell 1RM and real-world unsupervised adherence may require individual adjustment.',
    falsificationOutcome:
      'Retests after 4–8 weeks of maintenance showing >5% strength loss on 1 session/week in under-60 athletes (requiring upward dose revision).',
  },
  {
    id: 'spiering-2021',
    citation: 'Spiering BA, Mujika I, Sharp MA, Foulis SA. Maintaining Physical Performance: The Minimal Dose of Exercise Needed to Preserve Endurance and Strength Over Time. J Strength Cond Res.',
    year: 2021,
    url: 'https://pubmed.ncbi.nlm.nih.gov/33629972/',
    studiedPopulation: 'Review of trained and recreationally active adult cohorts across strength and endurance trials.',
    protocol: 'Systematic synthesis of frequency, volume, and intensity reductions over 4–32 weeks.',
    outcome:
      'Preserving exercise intensity is critical: strength can be maintained with 1 session/wk and 1 set/exercise (younger adults), while endurance requires maintaining intensity with ~2 sessions/wk and 33–66% volume reduction.',
    supportedDecision:
      'Separate maintenance schedules by domain: keep intensity/load on fewer sets for strength vs 2 shorter quality sessions/week for 5 km / aerobic goals.',
    limitations:
      'Narrative/scoping synthesis across heterogeneous protocols; individual minimum effective dose varies.',
    falsificationOutcome:
      'Consenting TOP1 athletes losing >3% 5 km performance over 6 weeks on 2 shorter weekly sessions despite full adherence.',
  },
  {
    id: 'kotarsky-2018',
    citation: 'Kotarsky CJ et al. Effect of progressive calisthenic push-up training on muscle strength and thickness. J Strength Cond Res.',
    year: 2018,
    url: 'https://pubmed.ncbi.nlm.nih.gov/29466268/',
    studiedPopulation: '23 moderately trained young men.',
    protocol: '4-week progressive push-up variations vs matched bench press, 3 sessions/week.',
    outcome: 'Progressive push-up variations produced measurable pressing strength gains comparable to bench press over 4 weeks.',
    supportedDecision:
      'Support progressive bodyweight pressing regressions/progressions (wall → incline → strict push-ups) for athletes without barbell access.',
    limitations: 'Short 4-week duration and small male sample.',
    falsificationOutcome:
      'Controlled retests showing no push-up repetition or pressing progression after 4+ adherent weeks.',
  },
  {
    id: 'hartmann-2012',
    citation: 'Hartmann H et al. Influence of squatting depth on jumping performance. J Strength Cond Res.',
    year: 2012,
    url: 'https://pubmed.ncbi.nlm.nih.gov/22344055/',
    studiedPopulation: '59 physical-education students.',
    protocol: '10-week deep squat training vs quarter squat and control.',
    outcome: 'Deep squat training significantly improved countermovement jump (CMJ) height alongside squat 1RM.',
    supportedDecision:
      'Suggest CMJ as a supporting win alongside a barbell squat goal using the same lower-body sessions.',
    limitations: 'Young athletic student sample; CMJ still requires its own measured test to verify progress.',
    falsificationOutcome:
      'Paired squat + CMJ retests showing no concurrent CMJ gain or increased fatigue/drop-off.',
  },
  {
    id: 'step-up-2019',
    citation: 'Patel MS et al. Effectiveness of Behaviorally Designed Gamification Interventions With Social Incentives for Increasing Physical Activity (STEP UP). JAMA Intern Med.',
    year: 2019,
    url: 'https://pubmed.ncbi.nlm.nih.gov/31498375/',
    studiedPopulation: '602 adults with overweight or obesity across a 24-week randomized clinical trial + 12-week follow-up.',
    protocol: 'Control vs support, collaboration, and competition gamification arms.',
    outcome: 'All social arms increased daily steps vs control, with competition showing the largest sustained gain during intervention.',
    supportedDecision:
      'Test opt-in cooperative and friendly retest challenges one mechanism at a time in Phase 3, measuring actual week-4 return and training outcomes.',
    limitations: 'Step-count endpoint rather than strength/5 km training; effects attenuated partially post-intervention.',
    falsificationOutcome:
      'A/B cohort comparison in TOP1 showing social challenges fail to improve week-4 purposeful return or retest completion.',
  },
  {
    id: 'bmj-validation-2024',
    citation: 'Collins GS et al. Evaluation of clinical prediction models (part 1 & 2): from development to external validation. BMJ.',
    year: 2024,
    url: 'https://www.bmj.com/content/384/bmj-2023-074820',
    studiedPopulation: 'Methodological standard for prospective prediction model evaluation.',
    protocol: 'Prospective pre-outcome forecast logging, temporal/external validation, calibration + Brier score + missing-outcome accounting.',
    outcome: 'Prevents optimistic overclaiming and detects miscalibration before deploying model adjustments.',
    supportedDecision:
      'Log every forecast before outcome, require independent later-cohort Brier score improvement before promoting empirical corrections, and report missing follow-up explicitly.',
    limitations: 'Requires sufficient matured outcomes per metric/stage before empirical calibration activates.',
    falsificationOutcome:
      'Held-out Brier score worsening or calibration error increasing after a model update (triggers automatic rollback).',
  },
];

export function evidenceById(id: string): EvidenceEntry | undefined {
  return EVIDENCE_REGISTER.find(entry => entry.id === id);
}
