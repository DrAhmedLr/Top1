'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'framer-motion';
import {
  ArrowLeft,
  Check,
  Dumbbell,
  Flame,
  Footprints,
  Pencil,
  Sparkles,
  Trophy,
} from 'lucide-react';
import {
  defaultMetricForDirection,
  defaultTargetFor,
  evaluateAssessmentStep,
  type AssessmentAnswers,
  type BarbellAccessMode,
  type BaselineMethod,
  type GoalDirection,
  type RunningVolumeBand,
  type TrainingRecency,
} from '@/lib/assessmentGraph';
import type {AthleteDossier} from '@/lib/athleteDossier';
import {
  DEFAULT_DELEGATION,
  normalizeTrainingContext,
  type EquipmentOption,
  type PersonalWorkspace,
} from '@/lib/personalWorkspace';
import type {Demographics, Values} from '@/lib/registry';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
import {Top1AthleteAvatar, Top1CoachMascot} from './Top1CoachMascot';
import {useTranslations} from './providers/LocaleProvider';
import s from './FirstVisitAssessment.module.css';

export type AssessmentCommitPayload = {
  profile: Demographics;
  values: Values;
  details: MeasurementMetadata;
  workspace: PersonalWorkspace;
  startGoal?: {
    metric: string;
    unit: 'metric' | 'kg';
    baseline: number;
    target: number;
    deadline: string;
    bodyWeightKg?: number;
  };
};

type Props = {
  owner: string;
  existingDossier?: AthleteDossier | null;
  existingWorkspace: PersonalWorkspace;
  existingValues: Values;
  existingDetails: MeasurementMetadata;
  onComplete: (payload: AssessmentCommitPayload) => Promise<void> | void;
  onSkipToHome: () => void;
};

type InteractiveStep =
  | 'welcome'
  | 'name'
  | 'reference_sex'
  | 'age'
  | 'adult_scope_notice'
  | 'body_mass'
  | 'height'
  | 'avatar_intro'
  | 'starting_context'
  | 'goal_direction'
  | 'baseline_evidence'
  | 'recent_working_set'
  | 'running_volume'
  | 'goal_choice'
  | 'real_commitment'
  | 'barbell_access'
  | 'commit_pledge'
  | 'reveal';

const draftKey = (owner: string) => `top1-assessment-draft-v1:${owner}`;

function SignalBars({level}: {level: number}) {
  return (
    <span className={s.signalBars} aria-hidden="true">
      {[1, 2, 3, 4].map(bar => (
        <i key={bar} data-on={bar <= level} style={{height: `${bar * 4 + 4}px`}} />
      ))}
    </span>
  );
}

export default function FirstVisitAssessment({
  owner,
  existingDossier,
  existingWorkspace,
  existingValues,
  existingDetails,
  onComplete,
  onSkipToHome,
}: Props) {
  const {locale} = useTranslations();
  const reducedMotion = useReducedMotion();
  const l = (en: string, fr: string, ar: string) => (locale === 'fr' ? fr : locale === 'ar' ? ar : en);
  const idx = locale === 'fr' ? 1 : locale === 'ar' ? 2 : 0;
  const timeZone =
    existingWorkspace.context.timezone ??
    (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC') ??
    'UTC';

  const [answers, setAnswers] = useState<AssessmentAnswers>(() => {
    try {
      const saved = localStorage.getItem(draftKey(owner));
      if (saved) return JSON.parse(saved) as AssessmentAnswers;
    } catch {
      // Ignore unreadable drafts.
    }
    return {};
  });
  const [athleteName, setAthleteName] = useState('');
  const [heightCm, setHeightCm] = useState<number | null>(
    existingDossier?.identity.profile.heightCm?.value ?? 180,
  );
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [step, setStep] = useState<InteractiveStep>(() =>
    existingDossier ? 'goal_direction' : 'welcome',
  );
  const [holdProgress, setHoldProgress] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const [saving, setSaving] = useState(false);
  const holdTimerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(owner), JSON.stringify(answers));
    } catch {
      // Best-effort draft save.
    }
  }, [owner, answers]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) window.clearInterval(holdTimerRef.current);
    };
  }, []);

  const evaluation = useMemo(
    () => evaluateAssessmentStep(answers, {existingDossier, timeZone}),
    [answers, existingDossier, timeZone],
  );

  // Build ordered interactive mobile sequence combining playful steps + deterministic graph nodes
  const steps = useMemo<InteractiveStep[]>(() => {
    const g = evaluation.activeNodes;
    const seq: InteractiveStep[] = [];
    if (!existingDossier) seq.push('welcome', 'name');
    if (g.includes('reference_sex')) seq.push('reference_sex');
    if (g.includes('age')) seq.push('age');
    if (g.includes('adult_scope_notice')) seq.push('adult_scope_notice');
    if (g.includes('body_mass')) seq.push('body_mass');
    if (!existingDossier?.identity.profile.heightCm) seq.push('height');
    if (!existingDossier) seq.push('avatar_intro');
    if (g.includes('starting_context')) seq.push('starting_context');
    if (g.includes('goal_direction')) seq.push('goal_direction');
    if (g.includes('baseline_evidence')) seq.push('baseline_evidence');
    if (g.includes('recent_working_set')) seq.push('recent_working_set');
    if (g.includes('running_volume')) seq.push('running_volume');
    if (g.includes('goal_choice')) seq.push('goal_choice');
    if (g.includes('real_commitment')) seq.push('real_commitment');
    if (g.includes('barbell_access')) seq.push('barbell_access');
    seq.push('commit_pledge', 'reveal');
    return seq;
  }, [evaluation.activeNodes, existingDossier]);

  const currentStep = steps.includes(step) ? step : steps[0];
  const stepIndex = steps.indexOf(currentStep);
  const progress = steps.length > 1 ? Math.max(0.06, stepIndex / (steps.length - 1)) : 1;

  const theme: 'male' | 'female' | 'neutral' =
    answers.referenceSex === 'male'
      ? 'male'
      : answers.referenceSex === 'female'
        ? 'female'
        : 'neutral';

  function update(patch: Partial<AssessmentAnswers>) {
    const merged: AssessmentAnswers = {...answers, ...patch};
    const nextEval = evaluateAssessmentStep(merged, {existingDossier, timeZone});
    setAnswers(nextEval.prunedAnswers);
  }

  function goNext(overrideSteps?: InteractiveStep[]) {
    const list = overrideSteps ?? steps;
    const i = list.indexOf(currentStep);
    if (i >= 0 && i + 1 < list.length) setStep(list[i + 1]);
  }

  function goBack() {
    if (stepIndex > 0) setStep(steps[stepIndex - 1]);
  }

  function triggerCommitmentComplete() {
    if (holdTimerRef.current !== null) {
      window.clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHoldProgress(1);
    setCelebrating(true);
    window.setTimeout(() => {
      setCelebrating(false);
      setStep('reveal');
    }, reducedMotion ? 120 : 950);
  }

  function startHold() {
    if (celebrating) return;
    if (reducedMotion) {
      triggerCommitmentComplete();
      return;
    }
    const start = Date.now();
    const duration = 950;
    if (holdTimerRef.current !== null) window.clearInterval(holdTimerRef.current);
    holdTimerRef.current = window.setInterval(() => {
      const pct = Math.min(1, (Date.now() - start) / duration);
      setHoldProgress(pct);
      if (pct >= 1) triggerCommitmentComplete();
    }, 30);
  }

  function cancelHold() {
    if (holdTimerRef.current !== null) {
      window.clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (!celebrating) setHoldProgress(0);
  }

  async function finishAssessment() {
    if (saving) return;
    setSaving(true);
    try {
      const a = evaluation.prunedAnswers;
      const reveal = evaluation.reveal;
      const metric = a.primaryMetric ?? defaultMetricForDirection(a.goalDirection);
      const isLift = ['bench_1rm', 'squat_1rm', 'deadlift_1rm'].includes(metric);
      const age = a.age ?? existingDossier?.identity.profile.age?.value ?? 30;
      const sex: 'male' | 'female' =
        a.referenceSex === 'female'
          ? 'female'
          : a.referenceSex === 'male'
            ? 'male'
            : existingDossier?.identity.profile.sex?.value ?? 'male';
      const weight =
        a.bodyWeightKg === null
          ? undefined
          : a.bodyWeightKg ?? existingDossier?.identity.profile.weightKg?.value;

      const profile: Demographics = {
        age,
        sex,
        ...(weight ? {weight} : {}),
        ...(heightCm ? {height: heightCm} : {}),
      };

      const nextValues: Values = {...existingValues};
      const nextDetails: MeasurementMetadata = {...existingDetails};
      const nowIso = new Date().toISOString();

      if (typeof a.baselineValue === 'number' && a.baselineMethod !== 'none_yet') {
        const unit = a.baselineUnit ?? (isLift ? 'kg' : 'metric');
        if (isLift && unit === 'kg' && weight && weight > 0) {
          nextValues[metric] = Number((a.baselineValue / weight).toFixed(3));
          nextDetails[metric] = {
            measuredAt: nowIso,
            method: 'manual',
            protocol: {
              id: metric === 'bench_1rm' ? 'bench_paused_v1' : 'squat_parallel_v1',
              bodyWeightKg: weight,
            },
            derivation: {formula: 'epley_ratio_v1', inputs: [a.baselineValue, 1], bodyWeightKg: weight},
          };
        } else {
          nextValues[metric] = a.baselineValue;
          nextDetails[metric] = {
            measuredAt: nowIso,
            method: 'manual',
            ...(metric === 'run_5k'
              ? {protocol: {id: 'run5k_outdoor_gps_v1'}}
              : metric === 'pushups'
                ? {protocol: {id: 'strict_pushups_v1'}}
                : {}),
          };
        }
      }

      const experience =
        a.recency === 'regular'
          ? 'one_to_three'
          : a.recency === 'occasional' || a.recency === 'returning'
            ? 'under_year'
            : a.recency === 'new'
              ? 'new'
              : existingWorkspace.context.experience;

      const nextContext = normalizeTrainingContext({
        ...existingWorkspace.context,
        ...(experience ? {experience} : {}),
        ...(a.daysPerWeek ? {days: a.daysPerWeek} : {}),
        ...(a.minutesPerSession ? {minutes: a.minutesPerSession} : {}),
        ...(a.equipment?.length ? {equipment: a.equipment} : {}),
        ...(a.restrictionNote ? {limitations: a.restrictionNote} : {}),
        timezone: timeZone,
        ...(reveal.pinnedMetrics.length ? {pinnedMetrics: reveal.pinnedMetrics} : {}),
        ...(a.coachingStyle ? {preferences: {...existingWorkspace.context.preferences, style: a.coachingStyle}} : {}),
        delegation: a.delegation ?? existingWorkspace.context.delegation ?? DEFAULT_DELEGATION,
      });

      const nextWorkspace: PersonalWorkspace = {
        ...existingWorkspace,
        context: nextContext,
      };

      const startGoal =
        reveal.standing.measuredValue !== null &&
        reveal.achievable.target !== null &&
        reveal.achievable.suggestedDate !== null &&
        age >= 18
          ? {
              metric,
              unit: (isLift && weight ? 'kg' : 'metric') as 'metric' | 'kg',
              baseline:
                isLift && weight
                  ? reveal.standing.measuredValue
                  : nextValues[metric] ?? reveal.standing.measuredValue,
              target:
                isLift && weight
                  ? reveal.achievable.target
                  : isLift
                    ? Number((reveal.achievable.target / (weight ?? 80)).toFixed(3))
                    : reveal.achievable.target,
              deadline: reveal.achievable.suggestedDate,
              ...(isLift && weight ? {bodyWeightKg: weight} : {}),
            }
          : undefined;

      try {
        localStorage.removeItem(draftKey(owner));
      } catch {
        // Ignore storage error.
      }
      await onComplete({
        profile,
        values: nextValues,
        details: nextDetails,
        workspace: nextWorkspace,
        startGoal,
      });
    } finally {
      setSaving(false);
    }
  }

  const displayName = athleteName.trim();
  const ageVal = answers.age ?? 28;
  const weightKgVal = typeof answers.bodyWeightKg === 'number' ? answers.bodyWeightKg : 75;
  const weightDisplay =
    weightUnit === 'kg'
      ? weightKgVal.toFixed(1)
      : (weightKgVal * 2.20462).toFixed(1);
  const heightDisplay =
    heightUnit === 'cm'
      ? `${heightCm ?? 180}`
      : `${Math.floor((heightCm ?? 180) / 30.48)}'${Math.round(((heightCm ?? 180) % 30.48) / 2.54)}"`;
  const selectedMetric = answers.primaryMetric ?? defaultMetricForDirection(answers.goalDirection);
  const isLift = ['bench_1rm', 'squat_1rm', 'deadlift_1rm'].includes(selectedMetric);
  const equipment = answers.equipment ?? [];

  const motionProps = reducedMotion
    ? {}
    : {
        initial: {opacity: 0, x: 18},
        animate: {opacity: 1, x: 0},
        exit: {opacity: 0, x: -18},
        transition: {duration: 0.22, ease: 'easeOut' as const},
      };

  const ringCircumference = 2 * Math.PI * 64;

  return (
    <section
      className={s.shell}
      data-theme={theme}
      data-node={currentStep}
      aria-labelledby="fva-heading"
    >
      {/* Top progress bar & back button */}
      <div className={s.topBar}>
        {stepIndex > 0 ? (
          <button
            type="button"
            className={s.backIcon}
            aria-label={l('Back', 'Retour', 'رجوع')}
            onClick={goBack}
          >
            <ArrowLeft size={20} className={s.flip} aria-hidden="true" />
          </button>
        ) : (
          <span style={{width: 40}} aria-hidden="true" />
        )}
        <div className={s.progressTrack} aria-hidden="true">
          <span className={s.progressFill} style={{transform: `scaleX(${progress})`}} />
        </div>
        <button type="button" className={s.skipTop} onClick={onSkipToHome}>
          {l('Later', 'Plus tard', 'لاحقًا')}
        </button>
      </div>

      {/* Celebration overlay after Tap-and-Hold Commit */}
      {celebrating && (
        <div className={s.celebrateOverlay} role="status">
          <strong>{l('Almost there…', 'Presque prêt…', 'أوشكنا على الانتهاء…')}</strong>
          <Top1CoachMascot mood="cheer" theme={theme} size={118} />
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div key={currentStep} className={s.body} {...motionProps}>
          {/* 1. WELCOME */}
          {currentStep === 'welcome' && (
            <div className={s.coachCenter}>
              <div className={s.speechBubble} id="fva-heading">
                {l(
                  'I just have a few quick questions for you and we can build your personal plan!',
                  'Quelques questions rapides et nous lançons ton programme sur mesure !',
                  'لدي بضعة أسئلة سريعة فقط لنبني خطتك الشخصية!',
                )}
              </div>
              <Top1CoachMascot mood="greet" theme={theme} size={136} />
              <p className={s.sub}>
                {l(
                  'Takes under 2 minutes. Everything stays private by default.',
                  'Moins de 2 minutes. Tout reste privé par défaut.',
                  'يستغرق أقل من دقيقتين. كل بياناتك خاصة افتراضيًا.',
                )}
              </p>
            </div>
          )}

          {/* 2. NAME */}
          {currentStep === 'name' && (
            <>
              <div className={s.coachRow}>
                <Top1CoachMascot mood="notes" theme={theme} size={76} />
                <div className={s.speechBubble}>
                  {l('What should we call you?', 'Comment dois-je t’appeler ?', 'ماذا نناديك؟')}
                </div>
              </div>
              <h1 id="fva-heading" className={s.heading}>
                {l('What’s your name?', 'Quel est ton prénom ?', 'ما اسمك؟')}
              </h1>
              <div className={s.iconInput}>
                <Pencil size={18} color="var(--fva-dim)" aria-hidden="true" />
                <input
                  type="text"
                  maxLength={40}
                  value={athleteName}
                  placeholder={l('Enter your first name', 'Entre ton prénom', 'أدخل اسمك الأول')}
                  onChange={e => setAthleteName(e.target.value)}
                />
              </div>
              <p className={s.sub}>
                {l('Optional — you can change this anytime in your profile.', 'Facultatif — modifiable à tout moment.', 'اختياري — يمكنك تغييره لاحقًا.')}
              </p>
            </>
          )}

          {/* 3. REFERENCE SEX (full-page color shift!) */}
          {currentStep === 'reference_sex' && (
            <>
              <div className={s.coachRow}>
                <Top1CoachMascot mood="notes" theme={theme} size={76} />
                <div className={s.speechBubble}>
                  {l(
                    'Alright! Let’s get your reference cohort set up.',
                    'Super ! Choisissons ta cohorte de référence.',
                    'رائع! لنضبط مجموعة المقارنة الخاصة بك.',
                  )}
                </div>
              </div>
              <h1 id="fva-heading" className={s.accentHeading}>
                {l('Reference cohort…', 'Cohorte de référence…', 'مرجع المقارنة…')}
              </h1>
              <div className={s.sexGrid} role="group" aria-label={l('Reference cohort', 'Cohorte de référence', 'مرجع المقارنة')}>
                <button
                  type="button"
                  className={s.sexCard}
                  aria-pressed={answers.referenceSex === 'male'}
                  onClick={() => update({referenceSex: 'male'})}
                >
                  <span className={s.sexGlyph} aria-hidden="true">♂</span>
                  <span>{l('MALE', 'HOMME', 'ذكر')}</span>
                </button>
                <button
                  type="button"
                  className={s.sexCard}
                  aria-pressed={answers.referenceSex === 'female'}
                  onClick={() => update({referenceSex: 'female'})}
                >
                  <span className={s.sexGlyph} aria-hidden="true">♀</span>
                  <span>{l('FEMALE', 'FEMME', 'أنثى')}</span>
                </button>
              </div>
              <button
                type="button"
                className={s.secondaryBtn}
                onClick={() => {
                  update({referenceSex: 'skip'});
                  goNext();
                }}
              >
                {l('Skip reference comparison (neutral theme)', 'Passer (thème neutre)', 'تخطي المقارنة (مظهر محايد)')}
              </button>
            </>
          )}

          {/* 4. INTERACTIVE WHEEL AGE PICKER + AGEING AVATAR */}
          {currentStep === 'age' && (
            <>
              <div className={s.coachRow}>
                <Top1CoachMascot mood="notes" theme={theme} size={74} />
                <div className={s.speechBubble} id="fva-heading">
                  {l('How old are you?', 'Quel âge as-tu ?', 'كم عمرك؟')}
                </div>
              </div>
              <div className={s.ageWrap}>
                <Top1AthleteAvatar age={ageVal} theme={theme} pose="ready" size={106} />
                <div className={s.wheel}>
                  <button
                    type="button"
                    className={`${s.wheelNeighbor} ${s.wheelNeighborFar}`}
                    onClick={() => update({age: Math.max(12, ageVal - 2)})}
                  >
                    {Math.max(12, ageVal - 2)}
                  </button>
                  <button
                    type="button"
                    className={s.wheelNeighbor}
                    onClick={() => update({age: Math.max(12, ageVal - 1)})}
                  >
                    {Math.max(12, ageVal - 1)}
                  </button>
                  <div className={s.wheelPill}>
                    <input
                      type="number"
                      className={s.wheelInput}
                      min={12}
                      max={100}
                      inputMode="numeric"
                      aria-label={l('Age', 'Âge', 'العمر')}
                      value={answers.age ?? ageVal}
                      onChange={e => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n) && n >= 10 && n <= 105) update({age: Math.round(n)});
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className={s.wheelNeighbor}
                    onClick={() => update({age: Math.min(100, ageVal + 1)})}
                  >
                    {Math.min(100, ageVal + 1)}
                  </button>
                  <button
                    type="button"
                    className={`${s.wheelNeighbor} ${s.wheelNeighborFar}`}
                    onClick={() => update({age: Math.min(100, ageVal + 2)})}
                  >
                    {Math.min(100, ageVal + 2)}
                  </button>
                </div>
              </div>
              <input
                type="range"
                className={s.rangeInput}
                min={14}
                max={80}
                value={ageVal}
                aria-label={l('Slide to choose age', 'Glisser pour choisir l’âge', 'اسحب لاختيار العمر')}
                onChange={e => update({age: Number(e.target.value)})}
              />
            </>
          )}

          {/* BRANCH: UNDER-18 SCOPE */}
          {currentStep === 'adult_scope_notice' && (
            <>
              <div className={s.coachRow}>
                <Top1CoachMascot mood="focus" theme={theme} size={76} />
                <div className={s.speechBubble} id="fva-heading">
                  {l('TOP1 coaching is built for adults (18+).', 'TOP1 est conçu pour les adultes (18+).', 'تدريب TOP1 مخصص للبالغين (18+).')}
                </div>
              </div>
              <div className={s.privacyCard}>
                <strong>{l('Safe exploration mode', 'Mode exploration sécurisé', 'وضع الاستكشاف الآمن')}</strong>
                {l(
                  'You can explore benchmarks safely without unsupervised adult load prescriptions, or go back to edit your age.',
                  'Tu peux explorer les repères sans prescription de charge adulte, ou revenir modifier ton âge.',
                  'يمكنك استكشاف المعايير بأمان دون وصفات أحمال للبالغين، أو الرجوع لتعديل عمرك.',
                )}
              </div>
            </>
          )}

          {/* 5. INTERACTIVE WEIGHT RULER */}
          {currentStep === 'body_mass' && (
            <>
              <div className={s.coachRow}>
                <Top1CoachMascot mood="notes" theme={theme} size={74} />
                <div className={s.speechBubble} id="fva-heading">
                  {l('What’s your current weight?', 'Quel est ton poids actuel ?', 'ما وزنك الحالي؟')}
                </div>
              </div>
              <div className={s.unitToggle} role="group" aria-label="Weight unit">
                <button type="button" aria-pressed={weightUnit === 'kg'} onClick={() => setWeightUnit('kg')}>
                  kg
                </button>
                <button type="button" aria-pressed={weightUnit === 'lb'} onClick={() => setWeightUnit('lb')}>
                  lbs
                </button>
              </div>
              <div className={s.giantValue}>
                <bdi>{weightDisplay}</bdi>
                <small>{weightUnit}</small>
              </div>
              <div className={s.rulerBox}>
                <div className={s.rulerTicks} aria-hidden="true">
                  {Array.from({length: 25}, (_, i) => (
                    <span key={i} data-major={i % 5 === 0} />
                  ))}
                  <div className={s.rulerNeedle} />
                </div>
                <input
                  type="range"
                  className={s.rangeInput}
                  min={40}
                  max={160}
                  step={0.5}
                  value={weightKgVal}
                  aria-label={l('Body weight', 'Poids corporel', 'وزن الجسم')}
                  onChange={e => update({bodyWeightKg: Number(e.target.value)})}
                />
              </div>
              <div className={s.privacyCard}>
                <strong>{l('Your information is private and never shared.', 'Tes données restent privées.', 'بياناتك خاصة ولن تُشارك مع أي طرف.')}</strong>
                {l('Bodyweight lets TOP1 calculate your strength-to-bodyweight ratio without changing your kg lifts.', 'Le poids permet de calculer ton ratio force/poids sans modifier tes charges en kg.', 'يتيح وزن الجسم حساب نسبة القوة إلى الوزن دون تغيير أوزانك بالكيلوغرام.')}
              </div>
            </>
          )}

          {/* 6. INTERACTIVE VERTICAL HEIGHT RULER */}
          {currentStep === 'height' && (
            <>
              <div className={s.coachRow}>
                <Top1CoachMascot mood="notes" theme={theme} size={74} />
                <div className={s.speechBubble} id="fva-heading">
                  {l('How tall are you?', 'Quelle est ta taille ?', 'كم طولك؟')}
                </div>
              </div>
              <div className={s.unitToggle} role="group" aria-label="Height unit">
                <button type="button" aria-pressed={heightUnit === 'ft'} onClick={() => setHeightUnit('ft')}>
                  ft/in
                </button>
                <button type="button" aria-pressed={heightUnit === 'cm'} onClick={() => setHeightUnit('cm')}>
                  cm
                </button>
              </div>
              <div className={s.heightStage}>
                <div className={s.giantValue}>
                  <bdi>{heightDisplay}</bdi>
                  {heightUnit === 'cm' && <small>cm</small>}
                </div>
                <div className={s.verticalRuler} aria-hidden="true">
                  {Array.from({length: 19}, (_, i) => (
                    <span key={i} data-major={i % 3 === 0} />
                  ))}
                  <div className={s.verticalNeedle} />
                </div>
              </div>
              <input
                type="range"
                className={s.rangeInput}
                min={140}
                max={215}
                step={1}
                value={heightCm ?? 180}
                aria-label={l('Height in cm', 'Taille en cm', 'الطول بالسنتيمتر')}
                onChange={e => setHeightCm(Number(e.target.value))}
              />
            </>
          )}

          {/* 7. MEET YOUR AVATAR */}
          {currentStep === 'avatar_intro' && (
            <div className={s.coachCenter}>
              <div className={s.coachRow} style={{width: '100%'}}>
                <Top1CoachMascot mood="cheer" theme={theme} size={74} />
                <div className={s.speechBubble}>
                  {displayName
                    ? l(`Say hello to your Avatar, ${displayName}!`, `Voici ton Avatar, ${displayName} !`, `رحّب بشخصيتك الرياضية يا ${displayName}!`)
                    : l('Say hello to your very own Avatar!', 'Voici ton Avatar sportif !', 'رحّب بشخصيتك الرياضية!')}
                </div>
              </div>
              <h1 id="fva-heading" className={s.accentHeading}>
                {l('Meet your Avatar', 'Découvre ton Avatar', 'تعرّف على شخصيتك')}
              </h1>
              <Top1AthleteAvatar age={ageVal} theme={theme} pose="wave" size={172} />
            </div>
          )}

          {/* 8. EXPERIENCE LEVEL (4 ascending signal-bar cards) */}
          {currentStep === 'starting_context' && (
            <>
              <div className={s.coachRow}>
                <Top1CoachMascot mood="notes" theme={theme} size={74} />
                <div className={s.speechBubble} id="fva-heading">
                  {displayName
                    ? l(`Nice to meet you, ${displayName}! How experienced are you with training?`, `Ravi de te rencontrer, ${displayName} ! Quelle est ton expérience ?`, `تشرّفنا يا ${displayName}! ما خبرتك في التدريب؟`)
                    : l('How experienced are you with working out?', 'Quelle est ton expérience en entraînement ?', 'ما مستوى خبرتك في التدريب؟')}
                </div>
              </div>
              <div className={s.tileList}>
                {(
                  [
                    ['new', 1, l('I’ve never worked out', 'Je débute totalement', 'لم أتدرّب من قبل'), l('Start simple and sustainable', 'Départ simple et progressif', 'بداية بسيطة ومستدامة')],
                    ['returning', 2, l('Returning after a break', 'Reprise après pause', 'عائد بعد توقف'), l('Rebuild momentum safely', 'Reprendre le rythme sans excès', 'استعادة الإيقاع بأمان')],
                    ['occasional', 3, l('Beginner · Tried it before', 'Occasionnel', 'أحيانًا'), l('A few sessions per month', 'Quelques séances par mois', 'بضع جلسات شهريًا')],
                    ['regular', 4, l('Regular · Consistent training', 'Régulier / confirmé', 'أتدرّب بانتظام'), l('Structured weekly routine', 'Routine hebdomadaire établie', 'روتين أسبوعي منتظم')],
                  ] as [TrainingRecency, number, string, string][]
                ).map(([val, bars, label, desc]) => (
                  <button
                    key={val}
                    type="button"
                    className={s.tile}
                    aria-pressed={answers.recency === val}
                    onClick={() => update({recency: val, restrictionStatus: answers.restrictionStatus ?? 'confirmed_none'})}
                  >
                    <SignalBars level={bars} />
                    <span className={s.tileText}>
                      <strong>{label}</strong>
                      <small>{desc}</small>
                    </span>
                    {answers.recency === val && <Check size={17} color="var(--fva-accent)" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 9. GOAL DIRECTION + OPTIONAL 2ND PIN */}
          {currentStep === 'goal_direction' && (
            <>
              <div className={s.coachRow}>
                <Top1CoachMascot mood="sparkle" theme={theme} size={74} />
                <div className={s.speechBubble} id="fva-heading">
                  {l('What is your top fitness goal?', 'Quel est ton objectif numéro 1 ?', 'ما هدفك الرياضي الأول؟')}
                </div>
              </div>
              <div className={s.tileList}>
                {(
                  [
                    ['strength', 'bench_1rm', Dumbbell, l('Become stronger (100 kg bench)', 'Devenir plus fort (100 kg couché)', 'قوة أكبر (100 كغ ضغط صدر)')],
                    ['running', 'run_5k', Footprints, l('Run a faster 5 km', 'Courir un 5 km plus vite', 'توقيت أسرع في 5 كم')],
                    ['bodyweight', 'pushups', Flame, l('Master bodyweight skills', 'Maîtriser le poids du corps', 'إتقان مهارات وزن الجسم')],
                    ['explore', 'pushups', Trophy, l('Just see my ranks & first win', 'Découvrir mon niveau', 'اكتشاف مستواي وأول إنجاز')],
                  ] as [GoalDirection, string, typeof Dumbbell, string][]
                ).map(([dir, metric, Icon, label]) => (
                  <button
                    key={dir}
                    type="button"
                    className={s.tile}
                    aria-pressed={answers.goalDirection === dir}
                    onClick={() =>
                      update({
                        goalDirection: dir,
                        primaryMetric: metric,
                        baselineUnit: metric === 'bench_1rm' ? 'kg' : 'metric',
                      })
                    }
                  >
                    <Icon size={21} color="var(--fva-accent)" aria-hidden="true" />
                    <span className={s.tileText}>
                      <strong>{label}</strong>
                    </span>
                    {answers.goalDirection === dir && <Check size={17} color="var(--fva-accent)" />}
                  </button>
                ))}
              </div>
              {answers.goalDirection && (
                <label className={s.field}>
                  {l('Optional 2nd pinned goal (max 2 main goals)', '2e objectif épinglé facultatif (max 2)', 'هدف رئيسي ثانٍ اختياري (بحد أقصى 2)')}
                  <select
                    value={answers.secondaryMetric ?? ''}
                    onChange={e => update({secondaryMetric: e.target.value || null})}
                  >
                    <option value="">{l('Focus on one main goal for now', 'Un seul objectif principal', 'هدف واحد فقط الآن')}</option>
                    {selectedMetric !== 'run_5k' && <option value="run_5k">{l('5 km run', 'Course 5 km', 'جري 5 كم')}</option>}
                    {selectedMetric !== 'bench_1rm' && <option value="bench_1rm">{l('Bench press', 'Développé couché', 'ضغط الصدر بالبار')}</option>}
                    {selectedMetric !== 'pushups' && <option value="pushups">{l('Strict push-ups', 'Pompes strictes', 'تمارين الضغط')}</option>}
                  </select>
                </label>
              )}
            </>
          )}

          {/* 10. BASELINE EVIDENCE */}
          {currentStep === 'baseline_evidence' && (
            <>
              <div className={s.coachRow}>
                <Top1CoachMascot mood="notes" theme={theme} size={74} />
                <div className={s.speechBubble} id="fva-heading">
                  {l('Do you already know your recent result?', 'Connais-tu déjà ton résultat récent ?', 'هل تعرف نتيجتك الأخيرة؟')}
                </div>
              </div>
              <div className={s.tileList}>
                {(
                  [
                    ['recent_tested_max', l('Recent tested result', 'Test récent mesuré', 'اختبار مقاس حديثًا'), l('Within the last 5 weeks', 'Ces 5 dernières semaines', 'خلال آخر 5 أسابيع')],
                    ['old_test', l('Older test (> 2 months ago)', 'Ancien test (> 2 mois)', 'اختبار قديم (> شهرين)'), l('We’ll keep your start conservative', 'Départ prudent adapté', 'سنبدأ بحذر وفق مستواك الحالي')],
                    ['estimate', l('Rough estimate', 'Estimation', 'تقدير تقريبي'), l('Marked provisional until tested', 'Provisoire jusqu’au test', 'أولي حتى إجراء اختبار')],
                    ['none_yet', l('No result yet', 'Pas encore de résultat', 'لا توجد نتيجة بعد'), l('Start with a quick baseline test', 'Commencer par un test de référence', 'البدء باختبار أساس سريع')],
                  ] as [BaselineMethod, string, string][]
                ).map(([method, label, desc]) => (
                  <button
                    key={method}
                    type="button"
                    className={s.tile}
                    aria-pressed={answers.baselineMethod === method}
                    onClick={() => update({baselineMethod: method, ...(method === 'none_yet' ? {baselineValue: null} : {})})}
                  >
                    <span className={s.tileText}>
                      <strong>{label}</strong>
                      <small>{desc}</small>
                    </span>
                    {answers.baselineMethod === method && <Check size={17} color="var(--fva-accent)" />}
                  </button>
                ))}
              </div>
              {answers.baselineMethod && answers.baselineMethod !== 'none_yet' && (
                <label className={s.field}>
                  {isLift
                    ? l('Bench press 1RM (kg)', '1RM Développé couché (kg)', 'أقصى تكرار ضغط الصدر (كغ)')
                    : selectedMetric === 'run_5k'
                      ? l('Recent 5 km time (minutes)', 'Temps 5 km (minutes)', 'توقيت 5 كم (بالدقائق)')
                      : l('Consecutive strict reps', 'Répétitions strictes', 'التكرارات المتتالية')}
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={400}
                    placeholder={isLift ? '80' : selectedMetric === 'run_5k' ? '25' : '20'}
                    value={typeof answers.baselineValue === 'number' ? answers.baselineValue : ''}
                    onChange={e => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n) && n > 0) {
                        update({
                          baselineValue: n,
                          baselineUnit: isLift ? 'kg' : 'metric',
                          targetValue: defaultTargetFor(selectedMetric, n, isLift ? 'kg' : 'metric'),
                        });
                      }
                    }}
                  />
                </label>
              )}
            </>
          )}

          {/* BRANCH: OLD STRENGTH TEST WORKING LOAD */}
          {currentStep === 'recent_working_set' && (
            <>
              <div className={s.coachRow}>
                <Top1CoachMascot mood="focus" theme={theme} size={74} />
                <div className={s.speechBubble} id="fva-heading">
                  {l('What weight have you lifted comfortably recently?', 'Quelle charge as-tu soulevée confortablement récemment ?', 'ما الوزن الذي رفعته براحة مؤخرًا؟')}
                </div>
              </div>
              <label className={s.field}>
                {l('Recent working weight (kg)', 'Charge récente (kg)', 'وزن التدريب الأخير (كغ)')}
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="50"
                  value={typeof answers.recentWorkingLoadKg === 'number' ? answers.recentWorkingLoadKg : ''}
                  onChange={e => {
                    const n = Number(e.target.value);
                    update({recentWorkingLoadKg: Number.isFinite(n) && n > 0 ? n : null});
                  }}
                />
              </label>
            </>
          )}

          {/* BRANCH: RUNNING VOLUME */}
          {currentStep === 'running_volume' && (
            <>
              <div className={s.coachRow}>
                <Top1CoachMascot mood="notes" theme={theme} size={74} />
                <div className={s.speechBubble} id="fva-heading">
                  {l('Roughly how much do you run per week?', 'Combien cours-tu par semaine ?', 'كم تجري أسبوعيًا تقريبًا؟')}
                </div>
              </div>
              <div className={s.tileList}>
                {(
                  [
                    ['under_10k', l('Under 10 km / week', 'Moins de 10 km / sem.', 'أقل من 10 كم / أسبوع')],
                    ['10k_to_25k', l('10–25 km / week', '10–25 km / sem.', '10–25 كم / أسبوع')],
                    ['over_25k', l('Over 25 km / week', 'Plus de 25 km / sem.', 'أكثر من 25 كم / أسبوع')],
                    ['unknown', l('Not sure', 'Je ne sais pas', 'غير متأكد')],
                  ] as [RunningVolumeBand, string][]
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    className={s.tile}
                    aria-pressed={answers.runningVolume === val}
                    onClick={() => update({runningVolume: val})}
                  >
                    <span className={s.tileText}>
                      <strong>{label}</strong>
                    </span>
                    {answers.runningVolume === val && <Check size={17} color="var(--fva-accent)" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 11. TARGET & PRIORITY */}
          {currentStep === 'goal_choice' && (
            <>
              <div className={s.coachRow}>
                <Top1CoachMascot mood="sparkle" theme={theme} size={74} />
                <div className={s.speechBubble} id="fva-heading">
                  {l('What milestone should we aim for?', 'Quel cap visons-nous ensemble ?', 'ما الإنجاز الذي نستهدفه معًا؟')}
                </div>
              </div>
              {typeof answers.baselineValue === 'number' && (
                <label className={s.field}>
                  {l('Target', 'Cible', 'الهدف')} ({isLift ? 'kg' : selectedMetric === 'run_5k' ? 'min' : 'reps'})
                  <input
                    type="number"
                    inputMode="decimal"
                    value={answers.targetValue ?? ''}
                    onChange={e => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n) && n > 0) update({targetValue: n});
                    }}
                  />
                </label>
              )}
              <div className={s.tileList}>
                <button
                  type="button"
                  className={s.tile}
                  aria-pressed={answers.commitmentMode === 'fixed_target'}
                  onClick={() => update({commitmentMode: 'fixed_target'})}
                >
                  <span className={s.tileText}>
                    <strong>{l('The target is fixed', 'La cible est fixe', 'الهدف الرقمي ثابت')}</strong>
                    <small>{l('Fit the timeline to my real weekly hours.', 'Adapter l’échéance à mon temps réel.', 'ضبط الموعد وفق وقتي الحقيقي.')}</small>
                  </span>
                </button>
                <button
                  type="button"
                  className={s.tile}
                  aria-pressed={answers.commitmentMode === 'fixed_time'}
                  onClick={() => update({commitmentMode: 'fixed_time'})}
                >
                  <span className={s.tileText}>
                    <strong>{l('My weekly time is fixed', 'Mon temps hebdo est fixe', 'وقتي الأسبوعي ثابت')}</strong>
                    <small>{l('Show what’s realistic in my schedule.', 'Montrer ce qui est réaliste dans mon agenda.', 'إظهار ما هو واقعي في جدولي.')}</small>
                  </span>
                </button>
              </div>
            </>
          )}

          {/* 12. REAL COMMITMENT & EQUIPMENT */}
          {currentStep === 'real_commitment' && (
            <>
              <div className={s.coachRow}>
                <Top1CoachMascot mood="notes" theme={theme} size={74} />
                <div className={s.speechBubble} id="fva-heading">
                  {l('How much real time and gear do you have?', 'De quel temps et matériel disposes-tu vraiment ?', 'ما الوقت والمعدات المتاحة لديك فعليًا؟')}
                </div>
              </div>
              <div className={s.fieldRow}>
                <label className={s.field}>
                  {l('Days / week', 'Jours / sem.', 'أيام / أسبوع')}
                  <select
                    value={answers.daysPerWeek ?? 2}
                    onChange={e => update({daysPerWeek: Number(e.target.value)})}
                  >
                    {[1, 2, 3, 4, 5].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <label className={s.field}>
                  {l('Min / session', 'Min / séance', 'دقائق / جلسة')}
                  <select
                    value={answers.minutesPerSession ?? 45}
                    onChange={e => update({minutesPerSession: Number(e.target.value)})}
                  >
                    {[20, 30, 45, 60].map(m => (
                      <option key={m} value={m}>{m} min</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={s.equipGrid} role="group" aria-label="Equipment">
                {(
                  [
                    ['barbell', l('Barbell', 'Barre', 'بار')],
                    ['dumbbells', l('Dumbbells', 'Haltères', 'دمبل')],
                    ['machines', l('Machines', 'Machines', 'أجهزة')],
                    ['pullup_bar', l('Pull-up bar', 'Barre traction', 'بار عقلة')],
                    ['outdoor', l('Outdoor run', 'Course ext.', 'جري خارجي')],
                    ['none', l('Bodyweight', 'Poids du corps', 'وزن الجسم')],
                  ] as [EquipmentOption, string][]
                ).map(([eq, label]) => {
                  const active = equipment.includes(eq);
                  return (
                    <button
                      key={eq}
                      type="button"
                      className={s.equipChip}
                      aria-pressed={active}
                      onClick={() =>
                        update({
                          daysPerWeek: answers.daysPerWeek ?? 2,
                          minutesPerSession: answers.minutesPerSession ?? 45,
                          equipment: active ? equipment.filter(i => i !== eq) : [...equipment, eq],
                        })
                      }
                    >
                      <span>{label}</span>
                      {active && <Check size={15} color="var(--fva-accent)" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* BRANCH: BARBELL ACCESS */}
          {currentStep === 'barbell_access' && (
            <>
              <div className={s.coachRow}>
                <Top1CoachMascot mood="focus" theme={theme} size={74} />
                <div className={s.speechBubble} id="fva-heading">
                  {l('No barbell selected — is a barbell occasional or absent?', 'Pas de barre sélectionnée — accès occasionnel ou absent ?', 'لم تحدد وجود بار — هل يتوفر أحيانًا أم لا؟')}
                </div>
              </div>
              <div className={s.tileList}>
                {(
                  [
                    ['occasional', l('Occasional gym access', 'Accès occasionnel en salle', 'توفر البار أحيانًا')],
                    ['absent', l('No barbell access', 'Aucun accès à une barre', 'لا يتوفر بار إطلاقًا')],
                  ] as [BarbellAccessMode, string][]
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    className={s.tile}
                    aria-pressed={answers.barbellAccess === val}
                    onClick={() => update({barbellAccess: val})}
                  >
                    <span className={s.tileText}>
                      <strong>{label}</strong>
                    </span>
                    {answers.barbellAccess === val && <Check size={17} color="var(--fva-accent)" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 13. TAP-AND-HOLD COMMITMENT RING */}
          {currentStep === 'commit_pledge' && (
            <div className={s.holdZone}>
              <h1 id="fva-heading" className={s.heading}>
                {l('I will use TOP1 to…', 'J’utiliserai TOP1 pour…', 'سأستخدم TOP1 من أجل…')}
              </h1>
              <p className={s.sub} style={{maxWidth: '22rem'}}>
                {l(
                  'train around my real schedule, reach my chosen milestone, and keep what I earn.',
                  'm’entraîner selon mon vrai emploi du temps, atteindre mon objectif et conserver mes acquis.',
                  'التدريب وفق جدولي الحقيقي، وتحقيق هدفي المختار، والحفاظ على ما أكتسبه.',
                )}
              </p>
              <button
                type="button"
                className={s.holdButton}
                aria-label={l('Hold to commit', 'Maintenir pour t’engager', 'اضغط مطولًا للتأكيد')}
                onPointerDown={startHold}
                onPointerUp={cancelHold}
                onPointerLeave={cancelHold}
                onPointerCancel={cancelHold}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    triggerCommitmentComplete();
                  }
                }}
              >
                <svg className={s.holdRingSvg} viewBox="0 0 146 146" aria-hidden="true">
                  <circle cx="73" cy="73" r="64" fill="none" stroke="#252c40" strokeWidth="10" />
                  <circle
                    cx="73"
                    cy="73"
                    r="64"
                    fill="none"
                    stroke="var(--fva-accent)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringCircumference * (1 - holdProgress)}
                  />
                </svg>
                <Top1CoachMascot mood={holdProgress > 0.2 ? 'cheer' : 'focus'} theme={theme} size={86} />
              </button>
              <span className={s.holdLabel}>
                {l('Tap and hold Coach Apex to commit', 'Maintiens appuyé sur Apex pour t’engager', 'اضغط مطولًا على المدرب للتأكيد')}
              </span>
            </div>
          )}

          {/* 14. REVEAL + CELEBRATING AVATAR */}
          {currentStep === 'reveal' && (
            <>
              <div className={s.coachRow}>
                <Top1CoachMascot mood="cheer" theme={theme} size={68} />
                <div className={s.speechBubble} id="fva-heading">
                  {displayName
                    ? l(`${displayName}, your personal plan is ready!`, `${displayName}, ton plan personnel est prêt !`, `يا ${displayName}، خطتك الشخصية جاهزة!`)
                    : l('Your Avatar is ready to celebrate every win with you!', 'Ton Avatar est prêt à célébrer chaque victoire !', 'شخصيتك الرياضية جاهزة للاحتفال بكل إنجاز!')}
                </div>
              </div>
              <Top1AthleteAvatar age={ageVal} theme={theme} pose="celebrate" size={130} />
              <div className={s.revealStack}>
                <div className={s.revealCard}>
                  <h3>{l('Where you stand', 'Où tu en es', 'أين تقف الآن')}</h3>
                  <span className={s.revealMetric}>
                    {evaluation.reveal.standing.measuredValue !== null
                      ? `${evaluation.reveal.standing.measuredValue} ${evaluation.reveal.standing.unit}`
                      : l('Unmeasured · baseline ready', 'Non mesuré · test prêt', 'غير مقاس · اختبار جاهز')}
                  </span>
                  <span className={s.sub}>
                    {evaluation.reveal.standing.bodyweightRatio !== null
                      ? `${evaluation.reveal.standing.bodyweightRatio} × BW · `
                      : ''}
                    {evaluation.reveal.standing.referenceLabel}
                  </span>
                </div>
                <div className={s.revealCard}>
                  <h3>{l('What looks achievable', 'Ce qui semble atteignable', 'ما يمكن تحقيقه')}</h3>
                  <span className={s.revealMetric}>
                    {evaluation.reveal.achievable.target !== null
                      ? `${evaluation.reveal.achievable.target} ${evaluation.reveal.achievable.unit}${evaluation.reveal.achievable.suggestedDate ? ` · ${evaluation.reveal.achievable.suggestedDate}` : ''}`
                      : l('First baseline win', 'Première victoire', 'أول إنجاز')}
                  </span>
                  <span className={s.sub}>
                    {evaluation.reveal.achievable.dayOneProbability !== null
                      ? `${Math.round(evaluation.reveal.achievable.dayOneProbability * 100)}% — `
                      : ''}
                    {evaluation.reveal.achievable.personalOddsRequirement}
                  </span>
                </div>
                <div className={s.revealCard}>
                  <h3>{l('Your next session', 'Ta prochaine séance', 'حصتك القادمة')}</h3>
                  <strong>{evaluation.reveal.nextAction.headline[idx]}</strong>
                  <span className={s.sub}>{evaluation.reveal.nextAction.detail[idx]}</span>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Bottom pinned tactile CTA */}
      {currentStep !== 'commit_pledge' && (
        <div className={s.ctaWrap}>
          {currentStep === 'welcome' && (
            <button type="button" className={s.primaryBtn} onClick={() => goNext()}>
              {l('SOUNDS GOOD!', 'C’EST PARTI !', 'هيا نبدأ!')}
            </button>
          )}
          {currentStep === 'name' && (
            <button
              type="button"
              className={displayName ? s.primaryBtn : s.secondaryBtn}
              onClick={() => goNext()}
            >
              {displayName ? l('NEXT', 'SUIVANT', 'التالي') : l('Skip', 'Passer', 'تخطي')}
            </button>
          )}
          {currentStep === 'body_mass' && (
            <>
              <button
                type="button"
                className={s.primaryBtn}
                onClick={() => {
                  if (answers.bodyWeightKg === undefined) update({bodyWeightKg: weightKgVal});
                  goNext();
                }}
              >
                {l('NEXT', 'SUIVANT', 'التالي')}
              </button>
              <button
                type="button"
                className={s.secondaryBtn}
                onClick={() => {
                  update({bodyWeightKg: null});
                  goNext();
                }}
              >
                {l('Skip weight', 'Passer le poids', 'تخطي الوزن')}
              </button>
            </>
          )}
          {currentStep === 'height' && (
            <>
              <button type="button" className={s.primaryBtn} onClick={() => goNext()}>
                {l('NEXT', 'SUIVANT', 'التالي')}
              </button>
              <button
                type="button"
                className={s.secondaryBtn}
                onClick={() => {
                  setHeightCm(null);
                  goNext();
                }}
              >
                {l('Skip height', 'Passer la taille', 'تخطي الطول')}
              </button>
            </>
          )}
          {currentStep === 'reveal' && (
            <button
              type="button"
              className={s.primaryBtn}
              disabled={saving}
              onClick={() => void finishAssessment()}
            >
              <Sparkles size={17} aria-hidden="true" />
              {l('LET’S GO!', 'OUVRIR MON ACCUEIL', 'افتح صفحتي')}
            </button>
          )}
          {!['welcome', 'name', 'body_mass', 'height', 'reveal'].includes(currentStep) && (
            <button
              type="button"
              className={s.primaryBtn}
              disabled={
                (currentStep === 'reference_sex' && !answers.referenceSex) ||
                (currentStep === 'starting_context' && !answers.recency) ||
                (currentStep === 'goal_direction' && !answers.goalDirection) ||
                (currentStep === 'baseline_evidence' &&
                  (!answers.baselineMethod ||
                    (answers.baselineMethod !== 'none_yet' && typeof answers.baselineValue !== 'number'))) ||
                (currentStep === 'real_commitment' && equipment.length === 0)
              }
              onClick={() => {
                if (currentStep === 'age' && answers.age === undefined) update({age: ageVal});
                if (currentStep === 'adult_scope_notice') update({adultScopeAcknowledged: true});
                if (currentStep === 'goal_choice' && !answers.commitmentMode) update({commitmentMode: 'fixed_time'});
                goNext();
              }}
            >
              {l('NEXT', 'SUIVANT', 'التالي')}
            </button>
          )}
        </div>
      )}

      {/* Accessible tap fallback under Hold-to-Commit */}
      {currentStep === 'commit_pledge' && (
        <div className={s.ctaWrap}>
          <button type="button" className={s.secondaryBtn} onClick={triggerCommitmentComplete}>
            {l('Tap to commit without holding', 'Appuyer pour valider', 'اضغط للتأكيد مباشرة')}
          </button>
        </div>
      )}
    </section>
  );
}
