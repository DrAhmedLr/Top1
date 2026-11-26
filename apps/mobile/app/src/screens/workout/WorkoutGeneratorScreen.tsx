import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { formatWeight } from '@apexlift/shared';
import { trpc } from '../../api/trpc';
import {
  AppButton,
  AppCard,
  AppText,
  ScreenContainer,
  SegmentedControl,
  StackHeader,
  useAppAlert,
} from '../../components/ui';
import { useLocale } from '../../i18n/LocaleProvider';
import type { MainStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';

const DISCOMFORT_AREAS = [
  { id: 'shoulder', label: 'Shoulder' },
  { id: 'lower_back', label: 'Lower Back' },
  { id: 'knee', label: 'Knee' },
  { id: 'elbow_wrist', label: 'Elbow / Wrist' },
  { id: 'hip', label: 'Hip' },
] as const;

const PRESETS = [
  { id: 'gym', label: 'Full Gym' },
  { id: 'at_home', label: 'At Home' },
  { id: 'dumbbells_only', label: 'Dumbbells' },
  { id: 'bodyweight', label: 'Bodyweight' },
  { id: 'travel', label: 'Travel' },
  { id: 'cardio', label: 'Cardio' },
] as const;

const SPLITS = [
  { id: 'push', label: 'Push' },
  { id: 'pull', label: 'Pull' },
  { id: 'legs', label: 'Legs' },
  { id: 'upper', label: 'Upper' },
  { id: 'lower', label: 'Lower' },
  { id: 'full_body', label: 'Full Body' },
] as const;

const DURATIONS = [20, 30, 45, 60, 75];
const EQUIPMENT_CHOICES = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight'];

export function WorkoutGeneratorScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { l } = useLocale();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<MainStackParamList, 'WorkoutGenerator'>>();
  const { showAlert } = useAppAlert();
  const utils = trpc.useUtils();

  const user = useAuthStore((s) => s.user);
  const unit = user?.unitWeight ?? 'lbs';
  const startFromPreset = useWorkoutStore((s) => s.startFromPreset);

  const [mode, setMode] = useState<'smart_next' | 'target_muscles' | 'preset'>(
    route.params?.initialMode ?? 'smart_next'
  );
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['id']>(
    route.params?.initialPreset ?? 'gym'
  );
  const [split, setSplit] = useState<(typeof SPLITS)[number]['id']>('push');
  const [durationMin, setDurationMin] = useState(45);
  const [intensity, setIntensity] = useState<'strength' | 'hypertrophy' | 'endurance'>(
    route.params?.initialIntensity ?? 'hypertrophy'
  );
  const [equipment, setEquipment] = useState<string[]>(EQUIPMENT_CHOICES);
  const [discomfort, setDiscomfort] = useState<'none' | 'mild' | 'concerning'>('none');
  const [discomfortArea, setDiscomfortArea] = useState<string>('shoulder');

  const genMutation = trpc.workoutGeneration.generateWorkout.useMutation();
  const savePreset = trpc.preset.create.useMutation({
    onSuccess: () => {
      void utils.preset.list.invalidate();
      showAlert({ title: 'Saved as Preset', message: 'You can launch this session anytime from Workouts.' });
    },
  });

  const toggleEq = (eq: string) => {
    setEquipment((prev) =>
      prev.includes(eq)
        ? prev.length > 1
          ? prev.filter((x) => x !== eq)
          : prev
        : [...prev, eq]
    );
  };

  const generated = genMutation.data;

  return (
    <ScreenContainer scroll>
      <StackHeader
        title={l('TOP1% Adaptive Generator', 'Générateur adaptatif TOP1%', 'مولد التمارين التكيّفي')}
        subtitle={l(
          'Recovery-aware, goal-protecting, strictly time-budgeted sessions',
          'Séances adaptées à votre récupération, objectifs et temps exact',
          'جلسات ذكية تراعي التعافي وحماية الأهداف والوقت المتاح'
        )}
      />

      <AppCard style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <AppText size="sm" weight="bold" tone="sub">
            {l('GENERATION MODE', 'MODE DE GÉNÉRATION', 'وضع التوليد')}
          </AppText>
          <SegmentedControl
            value={mode}
            onChange={setMode}
            options={[
              { label: l('Smart Next', 'Auto-Physio', 'تلقائي ذكي'), value: 'smart_next' },
              { label: l('Target Split', 'Split ciblé', 'تقسيم محدد'), value: 'target_muscles' },
              { label: l('Preset', 'Préréglage', 'قالب جاهز'), value: 'preset' },
            ]}
          />
        </View>

        {mode === 'preset' ? (
          <View style={{ gap: 6 }}>
            <AppText size="sm" weight="bold" tone="sub">
              ENVIRONMENT PRESET
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PRESETS.map((p) => {
                const active = preset === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setPreset(p.id)}
                    style={{
                      paddingHorizontal: 13,
                      paddingVertical: 8,
                      borderRadius: RADII.pill,
                      backgroundColor: active ? hexToRgba(c.constant, 0.2) : c.thirdBg,
                      borderWidth: 1,
                      borderColor: active ? c.constant : 'transparent',
                    }}
                  >
                    <AppText size="sm" weight="bold" tone={active ? 'constant' : 'default'}>
                      {p.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {mode === 'target_muscles' ? (
          <View style={{ gap: 6 }}>
            <AppText size="sm" weight="bold" tone="sub">
              TARGET SPLIT
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SPLITS.map((s) => {
                const active = split === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setSplit(s.id)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: RADII.pill,
                      backgroundColor: active ? hexToRgba(c.constant, 0.2) : c.thirdBg,
                      borderWidth: 1,
                      borderColor: active ? c.constant : 'transparent',
                    }}
                  >
                    <AppText size="sm" weight="bold" tone={active ? 'constant' : 'default'}>
                      {s.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={{ gap: 6 }}>
          <AppText size="sm" weight="bold" tone="sub">
            STRICT TIME BUDGET (MIN)
          </AppText>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {DURATIONS.map((d) => {
              const active = durationMin === d;
              return (
                <Pressable
                  key={d}
                  onPress={() => setDurationMin(d)}
                  style={{
                    flex: 1,
                    paddingVertical: 9,
                    borderRadius: RADII.input,
                    alignItems: 'center',
                    backgroundColor: active ? hexToRgba(c.constant, 0.2) : c.thirdBg,
                    borderWidth: 1,
                    borderColor: active ? c.constant : 'transparent',
                  }}
                >
                  <AppText size="sm" weight="bold" tone={active ? 'constant' : 'default'}>
                    {d}m
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <AppText size="sm" weight="bold" tone="sub">
            TRAINING STYLE
          </AppText>
          <SegmentedControl
            value={intensity}
            onChange={setIntensity}
            options={[
              { label: 'Strength', value: 'strength' },
              { label: 'Hypertrophy', value: 'hypertrophy' },
              { label: 'Endurance', value: 'endurance' },
            ]}
          />
        </View>

        <View style={{ gap: 6 }}>
          <AppText size="sm" weight="bold" tone="sub">
            JOINT CHECK-IN (SAFETY GUARDRAIL)
          </AppText>
          <SegmentedControl
            value={discomfort}
            onChange={setDiscomfort}
            options={[
              { label: 'All Clear', value: 'none' },
              { label: 'Mild Soreness', value: 'mild' },
              { label: 'Sharp Pain', value: 'concerning' },
            ]}
          />
          {discomfort !== 'none' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {DISCOMFORT_AREAS.map((area) => {
                const active = discomfortArea === area.id;
                return (
                  <Pressable
                    key={area.id}
                    onPress={() => setDiscomfortArea(area.id)}
                    style={{
                      paddingHorizontal: 11,
                      paddingVertical: 6,
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
        </View>

        {mode !== 'preset' ? (
          <View style={{ gap: 6 }}>
            <AppText size="sm" weight="bold" tone="sub">
              AVAILABLE EQUIPMENT
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {EQUIPMENT_CHOICES.map((eq) => {
                const active = equipment.includes(eq);
                return (
                  <Pressable
                    key={eq}
                    onPress={() => toggleEq(eq)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: RADII.pill,
                      backgroundColor: active ? hexToRgba(c.check, 0.18) : c.thirdBg,
                      borderWidth: 1,
                      borderColor: active ? c.check : 'transparent',
                    }}
                  >
                    <AppText size="xsm" weight="bold" tone={active ? 'check' : 'sub'}>
                      {eq}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <AppButton
          label={l('Generate Recovery-Aware Session', 'Générer la séance adaptative', 'توليد جلسة ذكية')}
          loading={genMutation.isPending}
          onPress={() =>
            genMutation.mutate({
              mode,
              preset: mode === 'preset' ? preset : undefined,
              split: mode === 'target_muscles' ? split : undefined,
              durationMin,
              intensity,
              equipment: mode === 'preset' ? undefined : equipment,
              discomfort:
                discomfort !== 'none'
                  ? { severity: discomfort, area: discomfortArea }
                  : undefined,
            })
          }
          fullWidth
        />
      </AppCard>

      {generated ? (
        <AppCard
          glowColor={generated.status === 'rest_recommended' ? c.danger : c.constant}
          style={{ gap: 12 }}
        >
          <View style={{ gap: 4 }}>
            <AppText size="lg" weight="black">
              {generated.title}
            </AppText>
            {generated.status === 'generated' ? (
              <AppText size="xsm" tone="constant" weight="bold">
                {generated.timeBreakdown.totalMinutes}m total (Warmup {generated.timeBreakdown.warmupMinutes}m • Work/Rest {generated.timeBreakdown.workAndRestMinutes}m • Cooldown {generated.timeBreakdown.cooldownMinutes}m) • {generated.totalSets} sets
              </AppText>
            ) : null}
            {generated.targetMuscles.length > 0 ? (
              <AppText size="xsm" tone="sub">
                Muscles: {generated.targetMuscles.join(', ')}
              </AppText>
            ) : null}
          </View>

          {generated.safetyGuidance ? (
            <View
              style={{
                padding: 10,
                borderRadius: RADII.input,
                backgroundColor: hexToRgba(c.danger, 0.16),
                borderWidth: 1,
                borderColor: hexToRgba(c.danger, 0.45),
                flexDirection: 'row',
                gap: 8,
              }}
            >
              <Ionicons name="shield-outline" size={18} color={c.danger} />
              <AppText size="xsm" style={{ flex: 1 }}>
                {generated.safetyGuidance}
              </AppText>
            </View>
          ) : null}

          {generated.warnings.map((w, i) => (
            <AppText key={`w_${i}`} size="xsm" style={{ color: c.warning }}>
              ⚠ {w}
            </AppText>
          ))}

          {generated.scientificRationale.map((r, i) => (
            <AppText key={`r_${i}`} size="xsm" tone="sub">
              • {r}
            </AppText>
          ))}

          {generated.exercises.map((ex, idx) => (
            <View
              key={`${ex.exerciseId}_${idx}`}
              style={{
                padding: 11,
                borderRadius: RADII.input,
                backgroundColor: c.thirdBg,
                gap: 4,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <AppText size="sm" weight="black" style={{ flex: 1 }}>
                  {idx + 1}. {ex.exerciseName}
                </AppText>
                <AppText size="xsm" weight="bold" tone="constant">
                  {ex.sets.length} × {ex.sets[0]?.reps}
                  {ex.suggestedLoadKg ? ` @ ${formatWeight(ex.suggestedLoadKg, unit)}` : ''}
                </AppText>
              </View>
              <AppText size="xxsm" tone="sub">
                {ex.whyChosen} • {ex.effortCue} • ~{ex.estimatedMinutes}m
              </AppText>
              {ex.substitutes.length > 0 ? (
                <AppText size="xxsm" tone="sub">
                  Subs: {ex.substitutes.slice(0, 2).map((s) => s.name).join(' / ')}
                </AppText>
              ) : null}
            </View>
          ))}

          {generated.exercises.length > 0 ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <AppButton
                label="Save Preset"
                variant="secondary"
                loading={savePreset.isPending}
                onPress={() =>
                  savePreset.mutate({
                    name: generated.title,
                    description: 'Generated by TOP1% Adaptive Engine',
                    exercises: generated.exercises.map((ex) => ({
                      exerciseId: ex.exerciseId,
                      restSeconds: ex.restSeconds,
                      targetSets: ex.sets,
                    })),
                  })
                }
                style={{ flex: 1 }}
              />
              <AppButton
                label="Start Live Workout"
                onPress={() => {
                  startFromPreset({
                    name: generated.title,
                    exercises: generated.exercises.map((ex) => ({
                      exerciseId: ex.exerciseId,
                      exerciseName: ex.exerciseName,
                      equipment: ex.equipment,
                      primaryMuscles: ex.primaryMuscles,
                      restSeconds: ex.restSeconds,
                      targetSets: ex.sets,
                    })),
                  });
                  navigation.goBack();
                }}
                style={{ flex: 1.3 }}
              />
            </View>
          ) : null}
        </AppCard>
      ) : null}
    </ScreenContainer>
  );
}
