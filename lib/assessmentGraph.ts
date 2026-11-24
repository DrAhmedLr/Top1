import {
  DEFAULT_DELEGATION,
  normalizeTrainingContext,
  type CoachingPreferences,
  type DelegationGrant,
  type EquipmentOption,
  type IsoWeekday,
  type PersonalWorkspace,
} from './personalWorkspace';
import {buildAthleteDossier, type AthleteDossier} from './athleteDossier';
import {selectNextSessionDecision, type CoachDecision} from './coachDecision';
import {activePlan, buildProgram, type GoalUnit} from './adaptiveProgram';
import {planGoalPortfolio} from './programPortfolio';
import {appendTraining, type TrainingEvent} from './training';

export const ASSESSMENT_GRAPH_VERSION = 'assessment-graph-v1';

export type AssessmentStage = 'you' | 'goals' | 'commitment' | 'reveal';
export type GoalDirection = 'strength' | 'bodyweight' | 'running' | 'explore';
export type TrainingRecency = 'regular' | 'occasional' | 'returning' | 'new';
export type BaselineMethod = 'recent_tested_max' | 'old_test' | 'estimate' | 'none_yet';
export type RestrictionStatus = 'confirmed_none' | 'restricted' | 'unknown';
export type CommitmentMode = 'fixed_target' | 'fixed_time';
export type BarbellAccessMode = 'always' | 'occasional' | 'absent';
export type RunningVolumeBand = 'under_10k' | '10k_to_25k' | 'over_25k' | 'unknown';

export type QuestionNodeId =
  | 'reference_sex'
  | 'age'
  | 'adult_scope_notice'
  | 'starting_context'
  | 'body_mass'
  | 'goal_direction'
  | 'baseline_evidence'
  | 'recent_working_set'
  | 'running_volume'
  | 'goal_choice'
  | 'real_commitment'
  | 'barbell_access'
  | 'preferences_authority'
  | 'reveal';

export type QuestionNodeSpec = {
  id: QuestionNodeId;
  stage: AssessmentStage;
  title: [string, string, string];
  prompt: [string, string, string];
  whoSeesIt: string;
  decisionAffected: string;
  answerEffects: Record<string, string>;
  staleAfterDays: number | null;
  unknownHandling: string;
  sensitivity: 'standard' | 'optional_sensitive';
  evidenceBasis: string;
  storageTarget: 'profile' | 'measurements' | 'workspace.context' | 'ephemeral';
};

/**
 * Versioned question catalogue documenting every node in TOP1's first-visit and returning assessment.
 * Deterministic rules choose the next unanswered question most likely to change a real decision.
 */
export const QUESTION_CATALOGUE: readonly QuestionNodeSpec[] = [
  {
    id: 'reference_sex',
    stage: 'you',
    title: ['Reference cohort', 'Cohorte de référence', 'مجموعة المقارنة'],
    prompt: [
      'Which sex reference should TOP1 use for comparisons?',
      'Quelle référence de sexe TOP1 doit-il utiliser pour les comparaisons ?',
      'ما مرجع الجنس الذي يجب أن يستخدمه TOP1 للمقارنات؟',
    ],
    whoSeesIt: 'New athletes or returning athletes with no saved sex reference choice.',
    decisionAffected: 'Selects published cohort reference group and full-page theme accent.',
    answerEffects: {
      male: 'Enables male reference comparisons and cool azure-slate theme.',
      female: 'Enables female reference comparisons and warm rose-coral theme.',
      skip: 'Keeps neutral theme and marks sex-specific published comparisons unavailable.',
    },
    staleAfterDays: null,
    unknownHandling: 'Explicitly stores skipped; never defaults silently to male.',
    sensitivity: 'optional_sensitive',
    evidenceBasis: 'Published population references (e.g. grip strength, VO2 max, jump norms) are sex-stratified.',
    storageTarget: 'profile',
  },
  {
    id: 'age',
    stage: 'you',
    title: ['Age', 'Âge', 'العمر'],
    prompt: ['How old are you?', 'Quel âge as-tu ?', 'كم عمرك؟'],
    whoSeesIt: 'Athletes without a saved age or whose recorded age is older than 365 days.',
    decisionAffected: 'Selects age-stratified cohort and enforces the adult (18+) coaching scope.',
    answerEffects: {
      '18..100': 'Selects adult age cohort and updates ageing illustration.',
      under_18: 'Triggers adult_scope_notice before allowing continuation.',
    },
    staleAfterDays: 365,
    unknownHandling: 'Required for adult scope verification; never persists placeholder age 32.',
    sensitivity: 'standard',
    evidenceBasis: 'Age brackets govern reference cohorts and adult product eligibility.',
    storageTarget: 'profile',
  },
  {
    id: 'adult_scope_notice',
    stage: 'you',
    title: ['Adult coaching scope', 'Cadre adulte', 'نطاق التدريب للبالغين'],
    prompt: [
      'TOP1’s training models are built for adults (18+). Confirm whether you want to explore benchmarks only.',
      'Les modèles TOP1 sont conçus pour les adultes (18 ans et plus). Confirme si tu souhaites uniquement explorer les repères.',
      'نماذج التدريب في TOP1 مصممة للبالغين (18 عامًا فأكثر). أكّد رغبتك في استكشاف المعايير فقط.',
    ],
    whoSeesIt: 'Only athletes who entered age < 18.',
    decisionAffected: 'Prevents unsupervised adult strength/load prescriptions for minors.',
    answerEffects: {
      acknowledge_explore: 'Proceeds in read-only benchmark exploration mode without maximal adult prescriptions.',
      edit_age: 'Returns to age entry to correct mistyped age.',
    },
    staleAfterDays: null,
    unknownHandling: 'Blocks adult coaching prescription until resolved.',
    sensitivity: 'standard',
    evidenceBasis: 'Product safety scope: adult resistance guidelines (ACSM) do not generalize unsupervised to minors.',
    storageTarget: 'ephemeral',
  },
  {
    id: 'starting_context',
    stage: 'you',
    title: ['Starting context', 'Point de départ', 'سياق البداية'],
    prompt: [
      'What has training looked like recently?',
      'À quoi ressemblait ton entraînement récemment ?',
      'كيف كان تدريبك في الفترة الأخيرة؟',
    ],
    whoSeesIt: 'Athletes without a saved experience level or readiness check.',
    decisionAffected: 'Selects starting set volume and flags functional movement restrictions for exercise selection.',
    answerEffects: {
      regular: 'Supports 3 working sets when session time >= 30 min.',
      occasional: 'Starts with conservative 2-set volume.',
      returning: 'Starts with conservative 2-set re-entry dose.',
      new: 'Starts with conservative 2-set novice progression.',
      restricted: 'Stores functional limitation privately; never applies an arbitrary odds penalty.',
    },
    staleAfterDays: 90,
    unknownHandling: 'Skipped restriction is recorded as unknown, distinct from confirmed_none.',
    sensitivity: 'optional_sensitive',
    evidenceBasis: 'ACSM resistance training guidance scales starting volume by training status.',
    storageTarget: 'workspace.context',
  },
  {
    id: 'body_mass',
    stage: 'you',
    title: ['Body mass', 'Masse corporelle', 'وزن الجسم'],
    prompt: [
      'What is your current body weight (optional)?',
      'Quel est ton poids actuel (facultatif) ?',
      'ما وزن جسمك الحالي (اختياري)؟',
    ],
    whoSeesIt: 'Athletes choosing strength goals or wanting bodyweight-ratio comparisons without a recent weight.',
    decisionAffected: 'Computes displayed × BW ratio and supports kg↔ratio display without altering historical kg lifts.',
    answerEffects: {
      weight_kg: 'Updates displayed bodyweight ratio; leaves saved absolute kg lifts unchanged.',
      skip: 'Keeps absolute kg measurements without fabricating a ratio.',
    },
    staleAfterDays: 90,
    unknownHandling: 'Optional; skipping leaves ratio comparisons unavailable without blocking kg goals.',
    sensitivity: 'optional_sensitive',
    evidenceBasis: 'Strength-to-bodyweight norms require test-day body mass in kg.',
    storageTarget: 'profile',
  },
  {
    id: 'goal_direction',
    stage: 'goals',
    title: ['Goal direction', 'Cap d’objectif', 'اتجاه الهدف'],
    prompt: [
      'Which achievement would you be proud to keep?',
      'Quel accomplissement serais-tu fier de conserver ?',
      'ما الإنجاز الذي تفتخر بتحقيقه والحفاظ عليه؟',
    ],
    whoSeesIt: 'Athletes without an active pinned goal.',
    decisionAffected: 'Selects primary discipline, metric shortlist, polarity, and optional second pin (max 2).',
    answerEffects: {
      strength: 'Routes to barbell lift baseline (bench press / squat / deadlift).',
      bodyweight: 'Routes to strict push-ups / pull-ups / dips baseline.',
      running: 'Routes to 5 km run baseline and weekly running volume branch.',
      explore: 'Lets the athlete pick one easy first win or baseline test.',
    },
    staleAfterDays: null,
    unknownHandling: 'Defaults to explore if undecided.',
    sensitivity: 'standard',
    evidenceBasis: 'Focuses weekly time budget on at most two main pinned goals.',
    storageTarget: 'workspace.context',
  },
  {
    id: 'baseline_evidence',
    stage: 'goals',
    title: ['Evidence of level', 'Niveau actuel', 'مستواك الحالي'],
    prompt: [
      'What is your most recent result for this test?',
      'Quel est ton résultat le plus récent pour ce test ?',
      'ما أحدث نتيجة مسجلة لديك في هذا الاختبار؟',
    ],
    whoSeesIt: 'Athletes with a selected goal metric whose baseline is missing or stale (> 35 days).',
    decisionAffected: 'Sets starting baseline, classifies confidence (measured vs estimate vs unknown), and proposes baseline test when missing.',
    answerEffects: {
      recent_tested_max: 'High-confidence measured baseline; proceeds directly to goal target.',
      old_test: 'Triggers recent_working_set branch and lowers baseline confidence.',
      estimate: 'Marks standing as provisional estimate (changes confidence only, preserves numeric entry).',
      none_yet: 'Leaves performance visibly unmeasured and schedules a baseline test.',
    },
    staleAfterDays: 35,
    unknownHandling: 'Missing result stays unmeasured; never fabricates a baseline.',
    sensitivity: 'standard',
    evidenceBasis: 'Separating tested maxima from old results or estimates prevents unsafe starting loads.',
    storageTarget: 'measurements',
  },
  {
    id: 'recent_working_set',
    stage: 'goals',
    title: ['Recent working set', 'Série de travail récente', 'آخر مجموعة تدريب'],
    prompt: [
      'Since that test is older, what weight and reps have you lifted comfortably recently?',
      'Comme ce test est ancien, quelle charge et combien de répétitions as-tu réalisées récemment ?',
      'بما أن هذا الاختبار قديم، ما الوزن والتكرارات التي رفعتها براحة مؤخرًا؟',
    ],
    whoSeesIt: 'Strength athletes whose baseline method is old_test.',
    decisionAffected: 'Prevents prescribing working loads from an outdated peak; anchors conservative starting load.',
    answerEffects: {
      working_load: 'Anchors safe conservative starting session load without erasing the historical peak.',
      skip: 'Uses conservative 45% starting load and recommends an early retest.',
    },
    staleAfterDays: 35,
    unknownHandling: 'Uses conservative starting load and flags baseline confidence as low.',
    sensitivity: 'standard',
    evidenceBasis: 'Detraining reduces peak strength over months; recent working loads protect safety.',
    storageTarget: 'ephemeral',
  },
  {
    id: 'running_volume',
    stage: 'goals',
    title: ['Weekly running volume', 'Volume hebdomadaire de course', 'حجم الجري الأسبوعي'],
    prompt: [
      'Roughly how many kilometres do you run in a typical week?',
      'Environ combien de kilomètres cours-tu par semaine ?',
      'كم كيلومترًا تجري تقريبًا في الأسبوع العادي؟',
    ],
    whoSeesIt: 'Athletes whose primary or secondary goal is running (run_5k).',
    decisionAffected: 'Selects starting run–walk vs continuous aerobic interval progression.',
    answerEffects: {
      under_10k: 'Starts with gentle run–walk intervals to build durability.',
      '10k_to_25k': 'Starts with steady easy aerobic intervals.',
      over_25k: 'Supports fuller aerobic session volume within weekly budget.',
      unknown: 'Defaults to conservative run–walk start.',
    },
    staleAfterDays: 60,
    unknownHandling: 'Treats unknown as under_10k conservative start.',
    sensitivity: 'standard',
    evidenceBasis: 'Gradual aerobic volume progression lowers overuse risk.',
    storageTarget: 'workspace.context',
  },
  {
    id: 'goal_choice',
    stage: 'goals',
    title: ['Target and priority', 'Cible et priorité', 'الهدف والأولوية'],
    prompt: [
      'Is the achievement fixed, or is your weekly time budget fixed?',
      'La cible est-elle fixe, ou ton budget temps hebdomadaire est-il fixe ?',
      'هل الهدف الرقمي ثابت أم وقتك الأسبوعي هو الثابت؟',
    ],
    whoSeesIt: 'Athletes who chose a measurable goal metric.',
    decisionAffected: 'Defines target value, priority ordering between up to 2 pinned goals, and planning trade-off.',
    answerEffects: {
      fixed_target: 'Holds the target fixed and adjusts deadline to fit available weekly time.',
      fixed_time: 'Holds the weekly time budget fixed and proposes an achievable target/date.',
    },
    staleAfterDays: null,
    unknownHandling: 'Defaults to fixed_time with a realistic first-win target.',
    sensitivity: 'standard',
    evidenceBasis: 'Aligns schedule and forecast trade-offs with what the athlete actually wants.',
    storageTarget: 'workspace.context',
  },
  {
    id: 'real_commitment',
    stage: 'commitment',
    title: ['Real commitment & equipment', 'Disponibilités et matériel', 'الالتزام والمعدات'],
    prompt: [
      'In a normal week, which days and minutes can you reliably train, and what equipment do you have?',
      'Dans une semaine normale, quels jours et combien de minutes peux-tu t’entraîner, et avec quel matériel ?',
      'في الأسبوع العادي، ما الأيام والدقائق المتاحة لديك وما المعدات المتوفرة؟',
    ],
    whoSeesIt: 'Athletes without declared days, minutes, or equipment.',
    decisionAffected: 'Directly changes weekly calendar, session duration, exercise feasibility, and one-week overrides.',
    answerEffects: {
      days_and_minutes: 'Builds feasible schedule including warm-up, rests, and transitions.',
      equipment: 'Determines whether barbell/bar exercises are feasible or substituted.',
      one_week_minutes: 'Applies an expiring override for this week only without changing standing schedule.',
    },
    staleAfterDays: 90,
    unknownHandling: 'Offers a low-commitment flexible start (2 days × 20 min).',
    sensitivity: 'standard',
    evidenceBasis: 'Plans built around real calendar time and equipment improve adherence.',
    storageTarget: 'workspace.context',
  },
  {
    id: 'barbell_access',
    stage: 'commitment',
    title: ['Barbell access', 'Accès à une barre', 'توفر البار'],
    prompt: [
      'You chose a barbell lift without barbell access listed — is a barbell occasional or absent?',
      'Tu vises un mouvement à la barre sans barre sélectionnée — y as-tu accès occasionnellement ou pas du tout ?',
      'اخترت تمرينًا بالبار دون تحديد توفر بار — هل يتوفر أحيانًا أم غير متاح إطلاقًا؟',
    ],
    whoSeesIt: 'Strength lift athletes whose selected equipment excludes barbell.',
    decisionAffected: 'Changes exercise prescription to dumbbells/bodyweight and flags whether a barbell retest is feasible.',
    answerEffects: {
      occasional: 'Uses dumbbell/bodyweight training sessions and schedules barbell retests on gym days.',
      absent: 'Substitutes compatible dumbbell/bodyweight sessions and warns that a barbell 1RM deadline is not directly testable.',
    },
    staleAfterDays: 60,
    unknownHandling: 'Treats unknown as absent (safe substitute exercise).',
    sensitivity: 'standard',
    evidenceBasis: 'Training specificity and comparable retests require matching equipment.',
    storageTarget: 'workspace.context',
  },
  {
    id: 'preferences_authority',
    stage: 'commitment',
    title: ['Coaching style & authority', 'Style et autonomie du coach', 'أسلوب التدريب والصلاحيات'],
    prompt: [
      'How should TOP1 communicate, and what may it adjust automatically?',
      'Comment TOP1 doit-il communiquer, et que peut-il ajuster automatiquement ?',
      'كيف تفضّل تواصل TOP1، وما التعديلات التي يمكنه إجراؤها تلقائيًا؟',
    ],
    whoSeesIt: 'Optional final step before Reveal.',
    decisionAffected: 'Personalizes tone and stores individual delegation grants; style alone never alters the numerical forecast.',
    answerEffects: {
      style: 'Personalizes coaching copy only; leaves numerical forecast untouched.',
      delegation: 'Stores scoped automatic permissions (exercises, schedule, target, deadline, priority, commitment).',
    },
    staleAfterDays: null,
    unknownHandling: 'Safe default: exercises & within-day schedule automatic; target/deadline/priority/commitment require confirmation.',
    sensitivity: 'standard',
    evidenceBasis: 'Explicit autonomy boundaries preserve athlete trust and original commitments.',
    storageTarget: 'workspace.context',
  },
  {
    id: 'reveal',
    stage: 'reveal',
    title: ['Your assessment', 'Ton bilan', 'تقييمك الشخصي'],
    prompt: [
      'Where you stand, what looks achievable in your time, and your next session.',
      'Où tu en es, ce qui semble atteignable dans ton temps, et ta prochaine séance.',
      'أين تقف الآن، وما يمكن تحقيقه في وقتك، وحصتك القادمة.',
    ],
    whoSeesIt: 'All athletes completing the required branch.',
    decisionAffected: 'Commits confirmed facts to dossier and becomes the first personalized Home view.',
    answerEffects: {confirm: 'Saves profile, measurements, workspace, and starting programme.'},
    staleAfterDays: null,
    unknownHandling: 'Missing baselines remain visibly unmeasured with a baseline task.',
    sensitivity: 'standard',
    evidenceBasis: 'Delivers immediate standing, realistic outlook, and next action in under two minutes.',
    storageTarget: 'ephemeral',
  },
];

export type AssessmentAnswers = {
  referenceSex?: 'male' | 'female' | 'skip';
  age?: number;
  adultScopeAcknowledged?: boolean;
  recency?: TrainingRecency;
  restrictionStatus?: RestrictionStatus;
  restrictionNote?: string;
  bodyWeightKg?: number | null; // null = explicitly skipped
  goalDirection?: GoalDirection;
  primaryMetric?: string;
  secondaryMetric?: string | null; // optional 2nd pin (max 2 total)
  baselineValue?: number | null; // null = none_yet (unmeasured)
  baselineUnit?: GoalUnit;
  baselineMethod?: BaselineMethod;
  baselineConfirmCurrent?: boolean;
  recentWorkingLoadKg?: number | null;
  runningVolume?: RunningVolumeBand;
  commitmentMode?: CommitmentMode;
  targetValue?: number;
  daysPerWeek?: number;
  weekdays?: IsoWeekday[];
  minutesPerSession?: number;
  oneWeekMinutesOverride?: {date: string; minutes: number} | null;
  equipment?: EquipmentOption[];
  barbellAccess?: BarbellAccessMode;
  coachingStyle?: CoachingPreferences['style'];
  delegation?: DelegationGrant;
  archivedAnswers?: Record<string, unknown>;
};

export type AssessmentStandingSummary = {
  metric: string | null;
  measuredValue: number | null;
  unit: string;
  bodyweightRatio: number | null;
  confidence: 'measured' | 'provisional' | 'unmeasured';
  referenceAvailable: boolean;
  referenceLabel: string;
};

export type AssessmentReveal = {
  standing: AssessmentStandingSummary;
  achievable: {
    target: number | null;
    unit: string;
    suggestedDate: string | null;
    dayOneProbability: number | null;
    isIllustrative: boolean;
    personalOddsRequirement: string;
    feasibilityNote: string | null;
  };
  nextAction: {
    kind: 'session' | 'baseline_test' | 'explore_only';
    decision: CoachDecision | null;
    headline: [string, string, string];
    detail: [string, string, string];
  };
  pinnedMetrics: string[];
  returningSkippedNodes: QuestionNodeId[];
};

export type AssessmentEvaluation = {
  graphVersion: typeof ASSESSMENT_GRAPH_VERSION;
  activeNodes: QuestionNodeId[];
  currentNode: QuestionNodeId;
  stage: AssessmentStage;
  progressFraction: number;
  prunedAnswers: AssessmentAnswers;
  staleInvalidatedKeys: string[];
  reveal: AssessmentReveal;
};

const LIFT_METRICS = new Set(['bench_1rm', 'squat_1rm', 'deadlift_1rm']);

export function defaultMetricForDirection(direction?: GoalDirection): string {
  if (direction === 'running') return 'run_5k';
  if (direction === 'bodyweight') return 'pushups';
  if (direction === 'explore') return 'pushups';
  return 'bench_1rm';
}

export function defaultTargetFor(metric: string, baseline: number, unit: GoalUnit): number {
  if (metric === 'run_5k') return Math.max(12, Number((baseline * 0.92).toFixed(2)));
  if (metric === 'bench_1rm' && unit === 'kg') return Math.round(baseline * 1.25);
  if (LIFT_METRICS.has(metric) && unit === 'kg') return Math.round(baseline * 1.2);
  if (metric === 'pushups' || metric === 'pullups' || metric === 'dips') {
    return Math.max(baseline + 5, Math.round(baseline * 1.25));
  }
  return Number((baseline * 1.15).toFixed(2));
}

/**
 * Removes branch answers that became irrelevant after the user went back and changed
 * an earlier choice, while archiving prior values in `archivedAnswers` for auditability.
 */
export function pruneIrrelevantAnswers(raw: AssessmentAnswers): {
  pruned: AssessmentAnswers;
  invalidated: string[];
} {
  const next: AssessmentAnswers = {...raw};
  const archived: Record<string, unknown> = {...(raw.archivedAnswers ?? {})};
  const invalidated: string[] = [];

  const drop = <K extends keyof AssessmentAnswers>(key: K) => {
    if (next[key] !== undefined) {
      archived[key] = next[key];
      delete next[key];
      invalidated.push(key);
    }
  };

  const metric = next.primaryMetric ?? defaultMetricForDirection(next.goalDirection);
  const isLift = LIFT_METRICS.has(metric);
  const isRunner = metric === 'run_5k' || next.secondaryMetric === 'run_5k' || next.goalDirection === 'running';

  if (next.age !== undefined && next.age >= 18) drop('adultScopeAcknowledged');
  if (next.baselineMethod !== 'old_test') drop('recentWorkingLoadKg');
  if (!isRunner) drop('runningVolume');
  if (!isLift || (next.equipment && next.equipment.includes('barbell'))) drop('barbellAccess');
  if (next.restrictionStatus !== 'restricted') drop('restrictionNote');

  if (Object.keys(archived).length) next.archivedAnswers = archived;
  return {pruned: next, invalidated};
}

/**
 * Deterministic server+client question graph evaluator.
 * Reuses confirmed facts from an existing dossier for returning athletes and skips
 * questions whose answers cannot change any decision.
 */
export function evaluateAssessmentStep(
  rawAnswers: AssessmentAnswers,
  options: {
    existingDossier?: AthleteDossier | null;
    today?: string;
    timeZone?: string;
    cursorNode?: QuestionNodeId;
  } = {},
): AssessmentEvaluation {
  const {pruned, invalidated} = pruneIrrelevantAnswers(rawAnswers);
  const dossier = options.existingDossier ?? null;
  const today = options.today ?? dossier?.today ?? new Date().toISOString().slice(0, 10);
  const timeZone = options.timeZone ?? dossier?.identity.timeZone ?? 'UTC';

  const hasSavedSex = Boolean(dossier?.identity.profile.sex);
  const hasSavedAge = Boolean(dossier?.identity.profile.age);
  const hasSavedWeight = Boolean(dossier?.identity.profile.weightKg);
  const hasSavedExperience = Boolean(dossier?.constraints.experience);
  const hasSavedSchedule =
    dossier?.constraints.weeklyDays.source === 'declared' &&
    dossier?.constraints.defaultMinutes.source === 'declared' &&
    dossier?.constraints.equipment.source === 'declared';

  const effAge = pruned.age ?? dossier?.identity.profile.age?.value;
  const effSex = pruned.referenceSex ?? dossier?.identity.profile.sex?.value;
  const effWeight =
    pruned.bodyWeightKg === null
      ? undefined
      : pruned.bodyWeightKg ?? dossier?.identity.profile.weightKg?.value;
  const effMetric =
    pruned.primaryMetric ??
    (pruned.goalDirection ? defaultMetricForDirection(pruned.goalDirection) : dossier?.pinnedMetrics[0]);

  const savedResult = effMetric ? dossier?.measuredResults[effMetric] : undefined;
  const savedFresh = savedResult?.freshness === 'recent';

  const returningSkippedNodes: QuestionNodeId[] = [];
  const activeNodes: QuestionNodeId[] = [];

  if (!hasSavedSex || pruned.referenceSex !== undefined) activeNodes.push('reference_sex');
  else returningSkippedNodes.push('reference_sex');

  if (!hasSavedAge || pruned.age !== undefined) activeNodes.push('age');
  else returningSkippedNodes.push('age');

  if (effAge !== undefined && effAge < 18) activeNodes.push('adult_scope_notice');

  if (!hasSavedExperience || pruned.recency !== undefined) activeNodes.push('starting_context');
  else returningSkippedNodes.push('starting_context');

  if (!hasSavedWeight || pruned.bodyWeightKg !== undefined) activeNodes.push('body_mass');
  else returningSkippedNodes.push('body_mass');

  if (!dossier?.goals.length || pruned.goalDirection !== undefined) activeNodes.push('goal_direction');
  else returningSkippedNodes.push('goal_direction');

  if (!savedFresh || pruned.baselineMethod !== undefined || pruned.baselineValue !== undefined) {
    activeNodes.push('baseline_evidence');
  } else {
    returningSkippedNodes.push('baseline_evidence');
  }

  if (pruned.baselineMethod === 'old_test' && effMetric && LIFT_METRICS.has(effMetric)) {
    activeNodes.push('recent_working_set');
  }

  if (
    pruned.goalDirection === 'running' ||
    effMetric === 'run_5k' ||
    pruned.secondaryMetric === 'run_5k'
  ) {
    activeNodes.push('running_volume');
  }

  if (effAge === undefined || effAge >= 18) {
    activeNodes.push('goal_choice');

    if (!hasSavedSchedule || pruned.daysPerWeek !== undefined || pruned.equipment !== undefined) {
      activeNodes.push('real_commitment');
    } else {
      returningSkippedNodes.push('real_commitment');
    }

    const eq = pruned.equipment ?? dossier?.constraints.equipment.value ?? [];
    if (effMetric && LIFT_METRICS.has(effMetric) && eq.length > 0 && !eq.includes('barbell')) {
      activeNodes.push('barbell_access');
    }

    activeNodes.push('preferences_authority');
  }

  activeNodes.push('reveal');

  const isAnswered = (id: QuestionNodeId): boolean => {
    switch (id) {
      case 'reference_sex':
        return pruned.referenceSex !== undefined;
      case 'age':
        return typeof pruned.age === 'number' && pruned.age >= 10 && pruned.age <= 105;
      case 'adult_scope_notice':
        return pruned.adultScopeAcknowledged === true;
      case 'starting_context':
        return pruned.recency !== undefined;
      case 'body_mass':
        return pruned.bodyWeightKg !== undefined;
      case 'goal_direction':
        return pruned.goalDirection !== undefined;
      case 'baseline_evidence':
        return pruned.baselineMethod !== undefined && (pruned.baselineMethod === 'none_yet' || typeof pruned.baselineValue === 'number');
      case 'recent_working_set':
        return pruned.recentWorkingLoadKg !== undefined;
      case 'running_volume':
        return pruned.runningVolume !== undefined;
      case 'goal_choice':
        return pruned.commitmentMode !== undefined;
      case 'real_commitment':
        return (
          typeof pruned.daysPerWeek === 'number' &&
          typeof pruned.minutesPerSession === 'number' &&
          Array.isArray(pruned.equipment) &&
          pruned.equipment.length > 0
        );
      case 'barbell_access':
        return pruned.barbellAccess !== undefined;
      case 'preferences_authority':
        return pruned.coachingStyle !== undefined;
      case 'reveal':
        return false;
    }
  };

  const firstUnanswered = activeNodes.find(id => !isAnswered(id)) ?? 'reveal';
  const currentNode =
    options.cursorNode && activeNodes.includes(options.cursorNode)
      ? options.cursorNode
      : firstUnanswered;

  const spec = QUESTION_CATALOGUE.find(n => n.id === currentNode)!;
  const idx = activeNodes.indexOf(currentNode);
  const progressFraction = activeNodes.length > 1 ? idx / (activeNodes.length - 1) : 1;

  const reveal = buildAssessmentReveal(pruned, {
    dossier,
    today,
    timeZone,
    effAge,
    effSex,
    effWeight,
    effMetric: effMetric ?? defaultMetricForDirection(pruned.goalDirection),
    returningSkippedNodes,
  });

  return {
    graphVersion: ASSESSMENT_GRAPH_VERSION,
    activeNodes,
    currentNode,
    stage: spec.stage,
    progressFraction,
    prunedAnswers: pruned,
    staleInvalidatedKeys: invalidated,
    reveal,
  };
}

function buildAssessmentReveal(
  answers: AssessmentAnswers,
  ctx: {
    dossier: AthleteDossier | null;
    today: string;
    timeZone: string;
    effAge?: number;
    effSex?: 'male' | 'female' | 'skip';
    effWeight?: number;
    effMetric: string;
    returningSkippedNodes: QuestionNodeId[];
  },
): AssessmentReveal {
  const {dossier, today, timeZone, effAge, effSex, effWeight, effMetric} = ctx;
  const saved = dossier?.measuredResults[effMetric];
  const isLift = LIFT_METRICS.has(effMetric);
  const unit: GoalUnit = answers.baselineUnit ?? (isLift ? 'kg' : 'metric');
  const displayUnit = unit === 'kg' ? 'kg' : effMetric === 'run_5k' ? 'min' : 'reps';

  const baselineVal =
    answers.baselineMethod === 'none_yet'
      ? null
      : typeof answers.baselineValue === 'number'
        ? answers.baselineValue
        : saved?.value ?? null;

  const confidence: AssessmentStandingSummary['confidence'] =
    baselineVal === null
      ? 'unmeasured'
      : answers.baselineMethod === 'estimate' || answers.baselineMethod === 'old_test'
        ? 'provisional'
        : saved && answers.baselineMethod === undefined && saved.freshness !== 'recent'
          ? 'provisional'
          : 'measured';

  const bodyweightRatio =
    isLift && baselineVal !== null && effWeight && effWeight > 0
      ? Number((baselineVal / effWeight).toFixed(2))
      : null;

  const referenceAvailable = Boolean(effSex && effSex !== 'skip' && effAge !== undefined && effAge >= 18);
  const referenceLabel = referenceAvailable
    ? `${effSex === 'female' ? 'Female' : 'Male'} · age ${effAge}`
    : 'Neutral (sex reference skipped)';

  const pins = [effMetric, ...(answers.secondaryMetric ? [answers.secondaryMetric] : [])]
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 2);

  if (effAge !== undefined && effAge < 18) {
    return {
      standing: {
        metric: effMetric,
        measuredValue: baselineVal,
        unit: displayUnit,
        bodyweightRatio,
        confidence,
        referenceAvailable: false,
        referenceLabel: 'Under 18 — adult coaching disabled',
      },
      achievable: {
        target: null,
        unit: displayUnit,
        suggestedDate: null,
        dayOneProbability: null,
        isIllustrative: true,
        personalOddsRequirement: 'Adult coaching forecasts require age 18+.',
        feasibilityNote: 'Explore benchmarks and log safe activities without unsupervised adult load prescriptions.',
      },
      nextAction: {
        kind: 'explore_only',
        decision: null,
        headline: ['Explore benchmarks safely', 'Explorer les repères', 'استكشف المعايير بأمان'],
        detail: [
          'Adult training prescriptions are paused because age is under 18.',
          'Les prescriptions adultes sont désactivées en dessous de 18 ans.',
          'تتوقف وصفات التدريب للبالغين لمن هم دون 18 عامًا.',
        ],
      },
      pinnedMetrics: pins,
      returningSkippedNodes: ctx.returningSkippedNodes,
    };
  }

  if (baselineVal === null) {
    return {
      standing: {
        metric: effMetric,
        measuredValue: null,
        unit: displayUnit,
        bodyweightRatio: null,
        confidence: 'unmeasured',
        referenceAvailable,
        referenceLabel,
      },
      achievable: {
        target: null,
        unit: displayUnit,
        suggestedDate: null,
        dayOneProbability: null,
        isIllustrative: true,
        personalOddsRequirement: 'Record one comparable baseline test first, then three trained intervals to unlock personal odds.',
        feasibilityNote: 'Your starting level is unmeasured — TOP1 will not invent a baseline or rank.',
      },
      nextAction: {
        kind: 'baseline_test',
        decision: null,
        headline: [
          `Complete your first ${effMetric.replace('_', ' ')} baseline test`,
          `Réalise ton premier test de référence (${effMetric.replace('_', ' ')})`,
          `أكمل اختبار الأساس الأول (${effMetric.replace('_', ' ')})`,
        ],
        detail: [
          'Log one controlled result using the standard protocol so TOP1 can set a realistic target date and first workout.',
          'Enregistre un premier résultat contrôlé selon le protocole standard pour calculer ta date cible et ta première séance.',
          'سجّل نتيجة أولى مضبوطة وفق الطريقة القياسية ليقترح TOP1 موعدًا واقعيًا وأول حصة.',
        ],
      },
      pinnedMetrics: pins,
      returningSkippedNodes: ctx.returningSkippedNodes,
    };
  }

  const targetVal = answers.targetValue ?? defaultTargetFor(effMetric, baselineVal, unit);
  const days = answers.daysPerWeek ?? dossier?.constraints.weeklyDays.value ?? 2;
  const minutes = answers.minutesPerSession ?? dossier?.constraints.defaultMinutes.value ?? 45;
  const equipment = answers.equipment ?? dossier?.constraints.equipment.value ?? ['none'];
  const experience =
    answers.recency === 'regular'
      ? 'one_to_three'
      : answers.recency === 'occasional' || answers.recency === 'returning'
        ? 'under_year'
        : 'new';

  const previewContext = normalizeTrainingContext({
    experience,
    days,
    minutes,
    equipment,
    timezone: timeZone,
    pinnedMetrics: pins,
    ...(answers.restrictionNote ? {limitations: answers.restrictionNote} : {}),
    ...(answers.oneWeekMinutesOverride
      ? {
          dayOverrides: [
            {
              date: answers.oneWeekMinutesOverride.date,
              minutes: answers.oneWeekMinutesOverride.minutes,
              recordedAt: new Date(today + 'T08:00:00Z').toISOString(),
              expiresOn: answers.oneWeekMinutesOverride.date,
              reason: 'One-week time restriction',
            },
          ],
        }
      : {}),
    ...(answers.coachingStyle ? {preferences: {style: answers.coachingStyle}} : {}),
    delegation: answers.delegation ?? DEFAULT_DELEGATION,
  });

  const previewWorkspace: PersonalWorkspace = {
    version: 1,
    goal: null,
    context: previewContext,
  };

  let suggestedDate: string | null = null;
  let dayOneProbability: number | null = null;
  let decision: CoachDecision | null = null;
  let feasibilityNote: string | null = null;

  try {
    const portfolio = planGoalPortfolio({
      goals: [
        {
          metric: effMetric,
          unit,
          current: baselineVal,
          target: targetVal,
          ...(isLift && effWeight ? {bodyWeightKg: effWeight} : {}),
        },
      ],
      startDay: today,
      timeZone,
      context: previewContext,
      now: new Date(today + 'T08:00:00Z'),
    });

    const item = portfolio.items[0];
    suggestedDate = item.suggestedDate;
    dayOneProbability = item.estimate?.probability ?? null;

    const previewConfig = {
      ...item.config,
      ...(answers.baselineMethod === 'old_test' &&
      typeof answers.recentWorkingLoadKg === 'number' &&
      answers.recentWorkingLoadKg > 0
        ? {dose: {...item.config.dose, loadKg: Math.min(item.config.dose.loadKg, answers.recentWorkingLoadKg)}}
        : {}),
    };
    const programDoc = buildProgram(previewConfig, timeZone);
    const events: TrainingEvent[] = appendTraining(
      [],
      {
        version: 1,
        id: '10000000-0000-4000-8000-000000000099',
        requestId: '10000000-0000-4000-8000-000000000098',
        kind: 'program',
        expectedRevision: 0,
        epoch: 0,
        data: programDoc,
        deleted: false,
        reason: '',
      },
      0,
      Date.parse(today + 'T08:00:00Z'),
    );
    const plan = activePlan(events)!;
    const previewDossier = buildAthleteDossier({
      owner: dossier?.identity.owner ?? 'preview',
      workspace: previewWorkspace,
      trainingEvents: events,
      asOf: new Date(today + 'T08:00:00Z'),
      timeZone,
    });
    const targetDay = answers.oneWeekMinutesOverride?.date ?? today;
    decision = selectNextSessionDecision(previewDossier, {plan, targetDay});

    if (isLift && !equipment.includes('barbell')) {
      feasibilityNote =
        answers.barbellAccess === 'occasional'
          ? 'Training uses compatible non-barbell exercises; schedule barbell retests on gym-access days.'
          : 'No barbell access: training substitutes compatible pressing/lifting movements, and a barbell 1RM deadline requires barbell access to verify.';
    } else if (confidence === 'provisional') {
      feasibilityNote =
        answers.baselineMethod === 'estimate'
          ? 'Standing is marked provisional because this entry is an estimate — confirm with a tested result.'
          : 'Starting load is kept conservative because your last test was older.';
    }
  } catch {
    feasibilityNote = 'Adjust target or weekly availability to calculate a feasible schedule.';
  }

  return {
    standing: {
      metric: effMetric,
      measuredValue: baselineVal,
      unit: displayUnit,
      bodyweightRatio,
      confidence,
      referenceAvailable,
      referenceLabel,
    },
    achievable: {
      target: targetVal,
      unit: displayUnit,
      suggestedDate,
      dayOneProbability,
      isIllustrative: true,
      personalOddsRequirement:
        'Illustrative day-one outlook. Personal odds unlock after 3 comparable trained intervals and logged attendance.',
      feasibilityNote,
    },
    nextAction: {
      kind: 'session',
      decision,
      headline: decision?.recommended
        ? decision.recommended.exercise
        : ['Start your first session', 'Démarre ta première séance', 'ابدأ حصتك الأولى'],
      detail: decision?.athleteSentence ?? [
        'Your first workout fits your weekly time and equipment.',
        'Ta première séance s’adapte à ton temps et ton matériel.',
        'حصتك الأولى مناسبة لوقتك ومعداتك.',
      ],
    },
    pinnedMetrics: pins,
    returningSkippedNodes: ctx.returningSkippedNodes,
  };
}
