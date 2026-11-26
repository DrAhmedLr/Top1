import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../api/trpc';
import { JymboDialogue } from '../../components/mascot';
import {
  AppButton,
  AppCard,
  AppInput,
  AppModal,
  AppText,
  ScreenContainer,
  SegmentedControl,
  StackHeader,
  useAppAlert,
} from '../../components/ui';
import { useLocale } from '../../i18n/LocaleProvider';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import type { MainStackParamList } from '../../navigation/types';

type CoachTab = 'today' | 'goals' | 'calendar' | 'learning';

const ACTION_COLORS: Record<string, string> = {
  keep: '#22C55E',
  shorten: '#38BDF8',
  substitute: '#F59E0B',
  move: '#A855F7',
  rest: '#EF4444',
  retest: '#0BC4FF',
};

const DISCOMFORT_AREAS = [
  { id: 'shoulder', label: 'Shoulder' },
  { id: 'lower_back', label: 'Lower Back' },
  { id: 'knee', label: 'Knee' },
  { id: 'elbow_wrist', label: 'Elbow / Wrist' },
  { id: 'hip', label: 'Hip' },
] as const;

const GOAL_EXERCISE_MAP: Record<string, { exerciseId: string; primaryMuscles: string[] }> = {
  bench_1rm: { exerciseId: 'ex_bench_press', primaryMuscles: ['Upper Chest', 'Lower Chest', 'Triceps'] },
  squat_1rm: { exerciseId: 'ex_squat', primaryMuscles: ['Quadriceps', 'Glutes', 'Hamstrings'] },
  deadlift_1rm: { exerciseId: 'ex_deadlift', primaryMuscles: ['Hamstrings', 'Glutes', 'Lower Back'] },
  pullups: { exerciseId: 'ex_pull_ups', primaryMuscles: ['Lats', 'Upper Back', 'Biceps'] },
  pullup_1rm: { exerciseId: 'ex_pull_ups', primaryMuscles: ['Lats', 'Upper Back', 'Biceps'] },
  dips: { exerciseId: 'ex_dips', primaryMuscles: ['Lower Chest', 'Triceps', 'Front Delt'] },
  dead_hang: { exerciseId: 'ex_pull_ups', primaryMuscles: ['Forearms', 'Lats'] },
  pushups: { exerciseId: 'ex_push_ups', primaryMuscles: ['Upper Chest', 'Lower Chest', 'Triceps'] },
};

const GOAL_CANDIDATES = [
  { id: 'pushups', label: 'Strict Push-ups', unit: 'metric' as const, defaultBase: 35, defaultTarget: 60 },
  { id: 'pullups', label: 'Strict Pull-ups', unit: 'metric' as const, defaultBase: 14, defaultTarget: 22 },
  { id: 'dips', label: 'Parallel-Bar Dips', unit: 'metric' as const, defaultBase: 18, defaultTarget: 30 },
  { id: 'bench_1rm', label: 'Bench Press 1RM (kg)', unit: 'kg' as const, defaultBase: 105, defaultTarget: 125 },
  { id: 'squat_1rm', label: 'Back Squat 1RM (kg)', unit: 'kg' as const, defaultBase: 140, defaultTarget: 165 },
  { id: 'dead_hang', label: 'Dead Hang (sec)', unit: 'metric' as const, defaultBase: 90, defaultTarget: 150 },
];

export function CoachHubScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { locale, l } = useLocale();
  const localeIdx = locale === 'fr' ? 1 : locale === 'ar' ? 2 : 0;
  const { showAlert } = useAppAlert();
  const utils = trpc.useUtils();
  const route = useRoute<RouteProp<MainStackParamList, 'CoachHub'>>();

  const startFromPreset = useWorkoutStore((s) => s.startFromPreset);

  const [tab, setTab] = useState<CoachTab>(route.params?.initialTab ?? 'today');
  const [minutesCap, setMinutesCap] = useState<number | undefined>(undefined);
  const [discomfortSev, setDiscomfortSev] = useState<'none' | 'mild' | 'concerning'>('none');
  const [discomfortArea, setDiscomfortArea] = useState('shoulder');
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [newGoalMetric, setNewGoalMetric] = useState(GOAL_CANDIDATES[0]);
  const [baselineStr, setBaselineStr] = useState(String(GOAL_CANDIDATES[0].defaultBase));
  const [targetStr, setTargetStr] = useState(String(GOAL_CANDIDATES[0].defaultTarget));
  const [weeksStr, setWeeksStr] = useState('8');
  const [daysPerWeek, setDaysPerWeek] = useState<1 | 2 | 3>(3);

  const previewProbQuery = trpc.top1.previewGoalProbability.useQuery(
    {
      metricId: newGoalMetric.id,
      goalUnit: newGoalMetric.unit,
      baseline: parseFloat(baselineStr) || newGoalMetric.defaultBase,
      target: parseFloat(targetStr) || newGoalMetric.defaultTarget,
      weeks: Math.max(4, Math.min(24, parseInt(weeksStr, 10) || 8)),
      daysPerWeek,
      minutesPerSession: 40,
    },
    { enabled: goalModalOpen },
  );

  const decisionQuery = trpc.coach.getTodayDecision.useQuery({
    availableMinutes: minutesCap,
    discomfort:
      discomfortSev !== 'none'
        ? { severity: discomfortSev, area: discomfortArea }
        : undefined,
  });
  const programsQuery = trpc.coach.listPrograms.useQuery();
  const optQuery = trpc.coach.getSelfOptimization.useQuery();

  const acceptMutation = trpc.coach.acceptDecision.useMutation({
    onSuccess: () => {
      void utils.coach.getTodayDecision.invalidate();
      void utils.coach.getSelfOptimization.invalidate();
      showAlert({
        title: l('Coach Plan Accepted', 'Plan accepté', 'تم اعتماد خطة المدرب'),
        message: l(
          'Your adapted session has been saved to the coaching ledger.',
          'Votre séance adaptée a été enregistrée.',
          'تم حفظ جلستك المعدّلة في سجل التدريب.'
        ),
      });
    },
  });

  const createGoalMutation = trpc.coach.createGoalProgram.useMutation({
    onSuccess: () => {
      void utils.coach.listPrograms.invalidate();
      void utils.coach.getTodayDecision.invalidate();
      void utils.top1.getOverview.invalidate();
      setGoalModalOpen(false);
      showAlert({
        title: l('Adaptive Goal Created', 'Objectif créé', 'تم إنشاء الهدف التكيّفي'),
        message: l(
          'Your guided calendar and Monte Carlo forecast are now active.',
          'Votre calendrier guidé et prévision sont actifs.',
          'تم تفعيل جدولك الإرشادي وتوقعات التقدم بنجاح.'
        ),
      });
    },
    onError: (err) => showAlert({ title: 'Could not create goal', message: err.message }),
  });

  const decision = decisionQuery.data?.decision ?? null;
  const actionColor = decision ? ACTION_COLORS[decision.action] ?? c.constant : c.constant;
  const programs = programsQuery.data?.programs ?? [];

  const launchDecisionInWorkoutSheet = () => {
    if (!decision?.recommended) return;
    const rec = decision.recommended;
    const mapped = GOAL_EXERCISE_MAP[decision.affectedGoal.metric] ?? {
      exerciseId: 'ex_push_ups',
      primaryMuscles: ['Upper Chest'],
    };
    startFromPreset({
      name: `TOP1 Coach: ${rec.exercise[localeIdx]}`,
      exercises: [
        {
          exerciseId: mapped.exerciseId,
          exerciseName: rec.exercise[localeIdx],
          equipment: rec.loadKg > 0 ? 'Barbell' : 'Bodyweight',
          primaryMuscles: mapped.primaryMuscles,
          restSeconds: rec.restSeconds,
          targetSets: Array.from({ length: rec.sets }, () => ({
            weightKg: rec.loadKg,
            reps: rec.amount,
            setType: 'normal' as const,
          })),
        },
      ],
    });
  };

  return (
    <ScreenContainer
      scroll
      refreshing={decisionQuery.isRefetching || programsQuery.isRefetching}
      onRefresh={() => {
        void decisionQuery.refetch();
        void programsQuery.refetch();
        void optQuery.refetch();
      }}
    >
      <StackHeader
        title={l('TOP1% Adaptive Coach', 'Coach adaptatif TOP1%', 'المدرب التكيّفي TOP1%')}
        subtitle={l(
          'Deterministic decisions, pinned goals, guided calendar & self-optimization',
          'Décisions déterministes, objectifs épinglés & auto-optimisation',
          'قرارات تدريبية دقيقة، أهداف مثبتة وتعلم ذاتي'
        )}
      />

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { label: l('Today', 'Aujourd’hui', 'اليوم'), value: 'today' },
          { label: l('Goals', 'Objectifs', 'الأهداف'), value: 'goals' },
          { label: l('Calendar', 'Calendrier', 'الجدول'), value: 'calendar' },
          { label: l('AI Learn', 'Apprentissage', 'التعلم'), value: 'learning' },
        ]}
      />

      {tab === 'today' ? (
        <View style={{ gap: 12 }}>
          <JymboDialogue
            mascotPose={decision?.action === 'rest' ? 'Salute' : 'Curling'}
            mascotSize={80}
            mascotText={
              decision
                ? decision.athleteSentence[localeIdx]
                : l(
                    'Create your first pinned TOP1% benchmark goal to unlock daily deterministic coaching!',
                    'Créez votre premier objectif TOP1% pour activer le coaching quotidien !',
                    'أنشئ هدفك الأول في TOP1% لتفعيل التوجيه اليومي الذكي!'
                  )
            }
          />

          {/* Live Constraint Simulator (What-If Today) */}
          <AppCard style={{ gap: 10 }}>
            <AppText size="xsm" weight="xbold" tone="sub">
              {l('LIVE TODAY CONSTRAINTS', 'CONTRAINTES DU JOUR', 'ظروف اليوم')}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {[
                { label: l('Full Slot', 'Normal', 'وقت كامل'), val: undefined },
                { label: '15m', val: 15 },
                { label: '25m', val: 25 },
                { label: '45m', val: 45 },
              ].map((opt) => {
                const active = minutesCap === opt.val;
                return (
                  <Pressable
                    key={opt.label}
                    onPress={() => setMinutesCap(opt.val)}
                    style={{
                      paddingHorizontal: 11,
                      paddingVertical: 6,
                      borderRadius: RADII.pill,
                      backgroundColor: active ? hexToRgba(c.constant, 0.22) : c.thirdBg,
                      borderWidth: 1,
                      borderColor: active ? c.constant : 'transparent',
                    }}
                  >
                    <AppText size="xsm" weight="bold" tone={active ? 'constant' : 'sub'}>
                      {opt.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(
                [
                  { id: 'none', label: l('Feeling Good', 'En forme', 'بحالة ممتازة') },
                  { id: 'mild', label: l('Mild Soreness', 'Gêne légère', 'ألم خفيف') },
                  { id: 'concerning', label: l('Sharp Pain', 'Douleur vive', 'ألم حاد') },
                ] as const
              ).map((item) => {
                const active = discomfortSev === item.id;
                const col =
                  item.id === 'concerning' ? c.danger : item.id === 'mild' ? c.warning : c.check;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setDiscomfortSev(item.id)}
                    style={{
                      flex: 1,
                      paddingVertical: 7,
                      borderRadius: RADII.input,
                      alignItems: 'center',
                      backgroundColor: active ? hexToRgba(col, 0.2) : c.thirdBg,
                      borderWidth: 1,
                      borderColor: active ? col : 'transparent',
                    }}
                  >
                    <AppText size="xxsm" weight="bold" style={{ color: active ? col : c.subText }}>
                      {item.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            {discomfortSev !== 'none' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {DISCOMFORT_AREAS.map((area) => {
                  const active = discomfortArea === area.id;
                  return (
                    <Pressable
                      key={area.id}
                      onPress={() => setDiscomfortArea(area.id)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: RADII.pill,
                        backgroundColor: active ? hexToRgba(c.warning, 0.2) : c.thirdBg,
                        borderWidth: 1,
                        borderColor: active ? c.warning : 'transparent',
                      }}
                    >
                      <AppText size="xxsm" weight="bold" style={{ color: active ? c.warning : c.subText }}>
                        {area.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </AppCard>

          {/* Decision Breakdown Card */}
          {decision ? (
            <AppCard glowColor={actionColor} style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ gap: 2 }}>
                  <AppText size="xxsm" weight="xbold" style={{ color: actionColor }}>
                    {l('COACH DECISION', 'DÉCISION DU COACH', 'قرار المدرب')} • {decision.targetDay}
                  </AppText>
                  <AppText size="xl" weight="black" style={{ textTransform: 'uppercase', color: actionColor }}>
                    {decision.action}
                  </AppText>
                </View>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: RADII.pill,
                    backgroundColor: hexToRgba(actionColor, 0.18),
                  }}
                >
                  <AppText size="xxsm" weight="black" style={{ color: actionColor }}>
                    {decision.reasonCode}
                  </AppText>
                </View>
              </View>

              <AppText size="sm">{decision.athleteSentence[localeIdx]}</AppText>

              {decision.clinicalNotice ? (
                <View
                  style={{
                    padding: 10,
                    borderRadius: RADII.input,
                    backgroundColor: hexToRgba(c.danger, 0.16),
                    borderWidth: 1,
                    borderColor: hexToRgba(c.danger, 0.45),
                    flexDirection: 'row',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name="medkit-outline" size={18} color={c.danger} />
                  <AppText size="xsm" style={{ flex: 1 }}>
                    {decision.clinicalNotice[localeIdx]}
                  </AppText>
                </View>
              ) : null}

              {decision.recommended ? (
                <View style={{ padding: 12, borderRadius: RADII.input, backgroundColor: c.thirdBg, gap: 4 }}>
                  <AppText size="sm" weight="black">
                    {decision.recommended.exercise[localeIdx]}
                  </AppText>
                  <AppText size="xsm" tone="constant" weight="bold">
                    {decision.recommended.sets} × {decision.recommended.amount}{' '}
                    {decision.recommended.mode}
                    {decision.recommended.loadKg > 0 ? ` @ ${decision.recommended.loadKg} kg` : ''} •{' '}
                    {decision.recommended.totalMinutes} min
                  </AppText>
                  <AppText size="xxsm" tone="sub">
                    Warmup {decision.recommended.warmupMinutes}m • Rest {decision.recommended.restSeconds}s • Cooldown {decision.recommended.cooldownMinutes}m
                  </AppText>
                </View>
              ) : null}

              {/* Evaluated Candidates Audit */}
              <View style={{ gap: 4 }}>
                <AppText size="xxsm" weight="bold" tone="sub">
                  {l('CANDIDATES EVALUATED', 'OPTIONS ÉVALUÉES', 'الخيارات المقيمة')}
                </AppText>
                {decision.candidatesEvaluated.slice(0, 4).map((cand) => (
                  <View key={cand.action} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText size="xsm" weight={cand.action === decision.action ? 'black' : 'reg'}>
                      {cand.action.toUpperCase()} {cand.feasible ? '✓' : '✕'}
                    </AppText>
                    <AppText size="xsm" tone="sub">
                      {cand.feasible ? `Score ${cand.score.toFixed(0)}` : cand.eliminatedReason ?? 'Blocked'}
                    </AppText>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <AppButton
                  label={l('Accept Decision', 'Accepter', 'اعتماد القرار')}
                  variant="secondary"
                  loading={acceptMutation.isPending}
                  onPress={() =>
                    acceptMutation.mutate({
                      planId: decision.affectedGoal.planId,
                      targetDay: decision.targetDay,
                      action: decision.action,
                      reasonCode: decision.reasonCode,
                      decisionJson: JSON.stringify(decision),
                    })
                  }
                  style={{ flex: 1 }}
                />
                {decision.recommended ? (
                  <AppButton
                    label={l('Launch Session', 'Lancer', 'ابدأ الجلسة')}
                    onPress={launchDecisionInWorkoutSheet}
                    style={{ flex: 1 }}
                  />
                ) : null}
              </View>
            </AppCard>
          ) : null}
        </View>
      ) : null}

      {tab === 'goals' ? (
        <View style={{ gap: 12 }}>
          <AppButton
            label={l('+ Pin New TOP1% Goal Program', '+ Nouvel objectif TOP1%', '+ إضافة هدف جديد')}
            onPress={() => setGoalModalOpen(true)}
            fullWidth
          />
          {programs.map((p) => {
            const probPct =
              p.forecast.kind === 'ready' ? Math.round(p.forecast.probability * 100) : null;
            const probColor =
              probPct === null
                ? c.constant
                : probPct >= 70
                  ? c.check
                  : probPct >= 40
                    ? c.warning
                    : c.danger;
            return (
              <AppCard key={p.planId} glowColor={probColor} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <AppText size="xxsm" weight="xbold" style={{ color: probColor }}>
                      ADAPTIVE GOAL PROGRAM
                    </AppText>
                    <AppText size="md" weight="black">
                      {p.metricName}
                    </AppText>
                  </View>
                  {probPct !== null ? (
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: RADII.pill,
                        backgroundColor: hexToRgba(probColor, 0.2),
                        borderWidth: 1,
                        borderColor: hexToRgba(probColor, 0.5),
                        alignItems: 'center',
                      }}
                    >
                      <AppText size="sm" weight="black" style={{ color: probColor }}>
                        {probPct}% Reach
                      </AppText>
                    </View>
                  ) : null}
                </View>

                <AppText size="sm" tone="sub">
                  {p.baseline} → {p.current} →{' '}
                  <AppText size="sm" weight="black" tone="check">
                    {p.target} {p.unit}
                  </AppText>
                </AppText>

                {probPct !== null ? (
                  <View style={{ gap: 4 }}>
                    <View style={{ height: 8, borderRadius: 99, backgroundColor: c.thirdBg, overflow: 'hidden' }}>
                      <View
                        style={{
                          width: `${Math.max(6, Math.min(100, probPct))}%`,
                          height: '100%',
                          backgroundColor: probColor,
                        }}
                      />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <AppText size="xxsm" tone="sub">
                        Probability of Reach by {p.deadline}
                      </AppText>
                      <AppText size="xxsm" weight="bold" style={{ color: probColor }}>
                        {probPct}% (adapts with logged sessions)
                      </AppText>
                    </View>
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 2 }}>
                  <AppText size="xsm" tone="sub">
                    {p.daysPerWeek}d/wk • {p.minutesPerSession}m/session
                  </AppText>
                  <AppText size="xsm" weight="bold" tone="constant">
                    Next: {p.prescription.sets}×{p.prescription.amount}
                  </AppText>
                </View>
              </AppCard>
            );
          })}
        </View>
      ) : null}

      {tab === 'calendar' ? (
        <View style={{ gap: 12 }}>
          {programs[0]?.calendar ? (
            programs[0].calendar.weeks.slice(0, 4).map((week) => (
              <AppCard key={week.number} style={{ gap: 8 }}>
                <AppText size="sm" weight="black" tone="constant">
                  Week {week.number} • {programs[0].metricName}
                </AppText>
                {week.sessions.map((sess) => (
                  <View
                    key={sess.date}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 8,
                      borderRadius: RADII.input,
                      backgroundColor: c.thirdBg,
                    }}
                  >
                    <View>
                      <AppText size="sm" weight="bold">
                        {sess.date} • {sess.kind === 'retest' ? 'RETEST DAY' : 'Training'}
                      </AppText>
                      <AppText size="xsm" tone="sub">
                        {sess.kind === 'training'
                          ? `${sess.sets} × ${sess.amount} ${sess.mode} (~${sess.estimatedMinutes}m)`
                          : `${sess.exercise[localeIdx]} (~${sess.estimatedMinutes}m)`}
                      </AppText>
                    </View>
                    <Ionicons
                      name={sess.kind === 'retest' ? 'trophy-outline' : 'barbell-outline'}
                      size={18}
                      color={sess.kind === 'retest' ? '#F2BC1B' : c.constant}
                    />
                  </View>
                ))}
              </AppCard>
            ))
          ) : (
            <AppCard>
              <AppText size="sm" tone="sub">
                Create a guided goal program to view your dated training & retest calendar.
              </AppText>
            </AppCard>
          )}
        </View>
      ) : null}

      {tab === 'learning' ? (
        <View style={{ gap: 12 }}>
          {optQuery.data ? (
            <>
              <AppCard style={{ gap: 8 }}>
                <AppText size="sm" weight="xbold" tone="constant">
                  {l('EMPIRICAL BAYES POLICY OPTIMIZER', 'OPTIMISEUR BAYÉSIEN', 'التحسين الذاتي البايزي')}
                </AppText>
                <AppText size="sm">{optQuery.data.policy.explanation}</AppText>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['shorten', 'move', 'substitute'] as const).map((act) => {
                    const st = optQuery.data!.policy.actions[act];
                    return (
                      <View
                        key={act}
                        style={{
                          flex: 1,
                          padding: 10,
                          borderRadius: RADII.input,
                          backgroundColor: c.thirdBg,
                          alignItems: 'center',
                        }}
                      >
                        <AppText size="xxsm" weight="bold" tone="sub" style={{ textTransform: 'uppercase' }}>
                          {act}
                        </AppText>
                        <AppText size="md" weight="black" tone="constant">
                          {Math.round(st.posteriorCompletionRate * 100)}%
                        </AppText>
                        <AppText size="xxsm" tone="sub">
                          {st.trials} trials
                        </AppText>
                      </View>
                    );
                  })}
                </View>
              </AppCard>

              <AppCard style={{ gap: 8 }}>
                <AppText size="sm" weight="xbold" tone="check">
                  {l('PERSONAL PHYSIOLOGY CALIBRATION', 'CALIBRATION PHYSIOLOGIQUE', 'معايرة التعافي الشخصي')}
                </AppText>
                <AppText size="sm">{optQuery.data.physiology.explanation}</AppText>
                <AppText size="xsm" tone="sub">
                  Paired sessions analyzed: {optQuery.data.physiology.recoveryPairsObserved} • Recovery τ {optQuery.data.physiology.recoveryTauMultiplier.toFixed(2)}× • MRV {optQuery.data.physiology.mrvMultiplier.toFixed(2)}×
                </AppText>
              </AppCard>
            </>
          ) : null}
        </View>
      ) : null}

      {/* Create Goal Program Modal */}
      <AppModal
        visible={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        title={l('Pin New TOP1% Goal', 'Nouvel objectif TOP1%', 'هدف TOP1% جديد')}
      >
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {GOAL_CANDIDATES.map((cand) => {
              const active = newGoalMetric.id === cand.id;
              return (
                <Pressable
                  key={cand.id}
                  onPress={() => {
                    setNewGoalMetric(cand);
                    setBaselineStr(String(cand.defaultBase));
                    setTargetStr(String(cand.defaultTarget));
                  }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: RADII.pill,
                    backgroundColor: active ? hexToRgba(c.constant, 0.22) : c.thirdBg,
                    borderWidth: 1,
                    borderColor: active ? c.constant : 'transparent',
                  }}
                >
                  <AppText size="xsm" weight="bold" tone={active ? 'constant' : 'sub'}>
                    {cand.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <AppInput
              label="Current Baseline"
              keyboardType="decimal-pad"
              value={baselineStr}
              onChangeText={setBaselineStr}
              containerStyle={{ flex: 1 }}
            />
            <AppInput
              label="Target Goal"
              keyboardType="decimal-pad"
              value={targetStr}
              onChangeText={setTargetStr}
              containerStyle={{ flex: 1 }}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <AppInput
              label="Horizon (weeks: 4–24)"
              keyboardType="number-pad"
              value={weeksStr}
              onChangeText={setWeeksStr}
              containerStyle={{ flex: 1 }}
            />
            <View style={{ flex: 1, gap: 6 }}>
              <AppText size="xxsm" weight="bold" tone="sub">
                DAYS / WEEK
              </AppText>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {([1, 2, 3] as const).map((d) => {
                  const active = daysPerWeek === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => setDaysPerWeek(d)}
                      style={{
                        flex: 1,
                        paddingVertical: 11,
                        borderRadius: RADII.input,
                        alignItems: 'center',
                        backgroundColor: active ? hexToRgba(c.constant, 0.22) : c.thirdBg,
                        borderWidth: 1,
                        borderColor: active ? c.constant : 'transparent',
                      }}
                    >
                      <AppText size="sm" weight="black" tone={active ? 'constant' : 'default'}>
                        {d}d
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Live Binomial Probability of Reach Preview */}
          {previewProbQuery.data?.available && previewProbQuery.data.probability !== null ? (() => {
            const pct = Math.round(previewProbQuery.data.probability * 100);
            const low = Math.round((previewProbQuery.data.low ?? 0) * 100);
            const high = Math.round((previewProbQuery.data.high ?? 0) * 100);
            const col = pct >= 70 ? c.check : pct >= 40 ? c.warning : c.danger;
            return (
              <View
                style={{
                  padding: 12,
                  borderRadius: RADII.input,
                  backgroundColor: hexToRgba(col, 0.14),
                  borderWidth: 1,
                  borderColor: hexToRgba(col, 0.45),
                  gap: 6,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <AppText size="xxsm" weight="xbold" style={{ color: col }}>
                    LIVE PROBABILITY OF REACH
                  </AppText>
                  <AppText size="lg" weight="black" style={{ color: col }} tabular>
                    {pct}%
                  </AppText>
                </View>
                <View style={{ height: 7, borderRadius: 99, backgroundColor: c.thirdBg, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.max(5, Math.min(100, pct))}%`, height: '100%', backgroundColor: col }} />
                </View>
                <AppText size="xxsm" tone="sub">
                  Band: {low}%–{high}% • {previewProbQuery.data.sessions} sessions scheduled ({previewProbQuery.data.required} gains needed)
                </AppText>
              </View>
            );
          })() : null}

          <AppButton
            label="Build Adaptive Program"
            loading={createGoalMutation.isPending}
            onPress={() =>
              createGoalMutation.mutate({
                metricId: newGoalMetric.id,
                goalUnit: newGoalMetric.unit,
                baseline: parseFloat(baselineStr) || newGoalMetric.defaultBase,
                target: parseFloat(targetStr) || newGoalMetric.defaultTarget,
                weeks: Math.max(4, Math.min(24, parseInt(weeksStr, 10) || 8)),
                daysPerWeek,
                minutesPerSession: 40,
              })
            }
            fullWidth
          />
        </View>
      </AppModal>
    </ScreenContainer>
  );
}
