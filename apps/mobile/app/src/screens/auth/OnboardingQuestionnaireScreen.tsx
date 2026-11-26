import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { EQUIPMENT_TYPES, kgToLbs, lbsToKg, RANKED_MUSCLE_GROUPS } from '@apexlift/shared';
import { EQUIPMENT_IMAGES } from '../../assets/assetRegistry';
import { ONBOARDING_ASSETS } from '../../assets/v3AssetRegistry';
import { JymboDialogue, type JymboPose } from '../../components/mascot';
import { MuscleBodygraphSvg, type MuscleRankEntry } from '../../components/rank/MuscleBodygraphSvg';
import {
  AppButton,
  AppCard,
  AppInput,
  AppText,
  ScreenContainer,
  SegmentedControl,
  StackHeader,
  WheelPicker,
} from '../../components/ui';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import { USE_NATIVE_DRIVER } from '../../theme/animations';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import { impactLight } from '../../utils/haptics';
import { playSound } from '../../utils/soundscape';

type Props = NativeStackScreenProps<AuthStackParamList, 'OnboardingQuestionnaire'>;

const GOALS = [
  {
    id: 'build_muscle' as const,
    label: 'Build Muscle Mass',
    desc: 'Hypertrophy splits, progressive volume & muscle ranks',
    artKey: 'icon_persona_musclemass',
  },
  {
    id: 'get_stronger' as const,
    label: 'Maximize Strength & Ranks',
    desc: 'Push 1RM benchmarks & climb toward TOP 1%',
    artKey: 'icon_persona_stronger1',
  },
  {
    id: 'lose_fat' as const,
    label: 'Lean Out & Get Defined',
    desc: 'Preserve strength while locking in nutrition & body composition',
    artKey: 'icon_persona_weightloss2',
  },
  {
    id: 'athletic' as const,
    label: 'Athletic Hybrid Build',
    desc: 'Balance strength, conditioning, recovery & weekly consistency',
    artKey: 'icon_persona_consistency',
  },
];

const LEVELS = [
  { id: 'beginner' as const, label: 'Beginner', desc: '0–1 yr lifting' },
  { id: 'intermediate' as const, label: 'Intermediate', desc: '1–3 yrs' },
  { id: 'advanced' as const, label: 'Advanced', desc: '3+ yrs' },
];

const WEIGHT_LBS_OPTIONS = Array.from({ length: 241 }, (_, i) => 90 + i);
const WEIGHT_KG_OPTIONS = Array.from({ length: 121 }, (_, i) => 40 + i);
const AGE_OPTIONS = Array.from({ length: 68 }, (_, i) => 14 + i);

const TOTAL_STEPS = 4;

export function OnboardingQuestionnaireScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const draft = useAuthStore((s) => s.onboardingDraft);
  const patchDraft = useAuthStore((s) => s.patchOnboardingDraft);

  const [step, setStep] = useState(0);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const [nameInput, setNameInput] = useState(draft.displayName ?? '');
  const [focusMuscles, setFocusMuscles] = useState<string[]>([
    'Upper Chest',
    'Lats',
    'Quadriceps',
  ]);
  const [bodygraphSide, setBodygraphSide] = useState<'front' | 'back'>('front');

  const weightOptions = draft.unitWeight === 'lbs' ? WEIGHT_LBS_OPTIONS : WEIGHT_KG_OPTIONS;
  const initialWeight =
    draft.unitWeight === 'lbs'
      ? Math.round(kgToLbs(draft.bodyweightKg))
      : Math.round(draft.bodyweightKg);
  const [weightIdx, setWeightIdx] = useState(() =>
    Math.max(0, weightOptions.findIndex((v) => v >= initialWeight))
  );
  const [ageIdx, setAgeIdx] = useState(() =>
    Math.max(0, AGE_OPTIONS.findIndex((v) => v >= (draft.age || 24)))
  );

  const slideX = useRef(new Animated.Value(0)).current;
  const slideOpacity = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (step + 1) / TOTAL_STEPS,
      duration: 240,
      useNativeDriver: false,
    }).start();

    slideX.setValue(slideDir * 28);
    slideOpacity.setValue(0.2);
    Animated.parallel([
      Animated.spring(slideX, {
        toValue: 0,
        friction: 9,
        tension: 130,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(slideOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [step, slideDir, progressAnim, slideX, slideOpacity]);

  const jymboHeader = useMemo<{ pose: JymboPose; text: string }>(() => {
    const greeting = nameInput.trim() ? `, ${nameInput.trim()}` : '';
    switch (step) {
      case 0:
        return {
          pose: 'Salute',
          text: 'Tell me your name, training mission, and experience so I can tailor your starter plan.',
        };
      case 1:
        return {
          pose: 'Notes',
          text: `Great${greeting}! Pick your available equipment and weekly training frequency.`,
        };
      case 2:
        return {
          pose: 'Path',
          text: 'Calibrate your sex standard, bodyweight, and age for fair peer-reviewed percentiles.',
        };
      default:
        return {
          pose: 'Confident',
          text: 'Tap any muscle groups you want to prioritize — then test your live Strength Rank!',
        };
    }
  }, [step, nameInput]);

  const focusBodygraphData = useMemo(() => {
    const out: Record<string, MuscleRankEntry> = {};
    for (const m of RANKED_MUSCLE_GROUPS) {
      const selected = focusMuscles.includes(m);
      out[m] = {
        muscle: m,
        rating: selected ? 580 : 0,
        tier: selected ? 'Elite' : 'Unranked',
        division: 1,
        label: selected ? 'Priority' : 'Unranked',
        topExerciseName: null,
        topExerciseId: null,
        exerciseCount: 0,
      };
    }
    return out;
  }, [focusMuscles]);

  const handleUnitChange = (nextUnit: 'lbs' | 'kg') => {
    if (nextUnit === draft.unitWeight) return;
    const currentVal = weightOptions[weightIdx] ?? initialWeight;
    const converted = nextUnit === 'lbs' ? Math.round(kgToLbs(currentVal)) : Math.round(lbsToKg(currentVal));
    const nextOptions = nextUnit === 'lbs' ? WEIGHT_LBS_OPTIONS : WEIGHT_KG_OPTIONS;
    const nextIdx = Math.max(0, nextOptions.findIndex((v) => v >= converted));
    patchDraft({ unitWeight: nextUnit, unitMeasure: nextUnit === 'lbs' ? 'in' : 'cm' });
    setWeightIdx(nextIdx);
  };

  const handleNext = () => {
    if (step === 0 && nameInput.trim()) {
      patchDraft({ displayName: nameInput.trim() });
    }
    if (step === 2) {
      const selectedWeight = weightOptions[weightIdx] ?? initialWeight;
      const bwKg = draft.unitWeight === 'lbs' ? lbsToKg(selectedWeight) : selectedWeight;
      const selectedAge = AGE_OPTIONS[ageIdx] ?? 24;
      patchDraft({
        bodyweightKg: Math.max(35, Math.min(250, bwKg)),
        age: Math.max(13, Math.min(99, selectedAge)),
      });
    }
    if (step === TOTAL_STEPS - 1) {
      playSound('flow_complete');
      navigation.navigate('OnboardingRankDemo');
      return;
    }
    setSlideDir(1);
    playSound('next_step');
    impactLight();
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    playSound('tick', 0.35);
    if (step > 0) {
      setSlideDir(-1);
      setStep((s) => s - 1);
    } else {
      navigation.goBack();
    }
  };

  const toggleEquipment = (eq: string) => {
    impactLight();
    const exists = draft.selectedEquipment.includes(eq);
    const next = exists
      ? draft.selectedEquipment.filter((e) => e !== eq)
      : [...draft.selectedEquipment, eq];
    patchDraft({ selectedEquipment: next.length ? next : ['Bodyweight'] });
  };

  const toggleMuscle = (m: string) => {
    impactLight();
    playSound('tick', 0.45);
    setFocusMuscles((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  return (
    <View style={{ flex: 1 }}>
      <StackHeader
        title={`Setup ${step + 1} of ${TOTAL_STEPS}`}
        onBack={handleBack}
        showBorder={false}
      />

      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <View style={{ height: 6, borderRadius: 99, backgroundColor: c.thirdBg, overflow: 'hidden' }}>
          <Animated.View
            style={{
              height: '100%',
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['10%', '100%'],
              }),
              backgroundColor: c.constant,
              borderRadius: 99,
            }}
          />
        </View>
      </View>

      <ScreenContainer
        scroll
        safeTop={false}
        contentStyle={{
          justifyContent: 'space-between',
          paddingTop: 4,
          maxWidth: 560,
          alignSelf: 'center',
          width: '100%',
        }}
      >
        <Animated.View
          style={{
            gap: 14,
            opacity: slideOpacity,
            transform: [{ translateX: slideX }],
          }}
        >
          <JymboDialogue
            mascotText={jymboHeader.text}
            mascotPose={jymboHeader.pose}
            mascotSize={86}
          />

          {/* STEP 0: Name, Goal & Experience */}
          {step === 0 ? (
            <View style={{ gap: 12 }}>
              <AppInput
                label="Your Name"
                placeholder="e.g. Alex"
                value={nameInput}
                onChangeText={setNameInput}
              />

              <View style={{ gap: 8 }}>
                {GOALS.map((g) => {
                  const selected = draft.fitnessGoal === g.id;
                  const iconSrc = ONBOARDING_ASSETS[g.artKey];
                  return (
                    <AppCard
                      key={g.id}
                      selected={selected}
                      onPress={() => {
                        impactLight();
                        playSound('tick', 0.45);
                        patchDraft({ fitnessGoal: g.id });
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}
                    >
                      {iconSrc ? (
                        <Image source={iconSrc} resizeMode="contain" style={{ width: 40, height: 40 }} />
                      ) : null}
                      <View style={{ flex: 1 }}>
                        <AppText size="sm" weight="black">
                          {g.label}
                        </AppText>
                        <AppText size="xsm" tone="sub">
                          {g.desc}
                        </AppText>
                      </View>
                      {selected ? <Ionicons name="checkmark-circle" size={22} color={c.constant} /> : null}
                    </AppCard>
                  );
                })}
              </View>

              <View style={{ gap: 6 }}>
                <AppText size="xxsm" weight="bold" tone="sub">
                  EXPERIENCE LEVEL
                </AppText>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {LEVELS.map((lvl) => {
                    const active = draft.experienceLevel === lvl.id;
                    return (
                      <Pressable
                        key={lvl.id}
                        onPress={() => {
                          impactLight();
                          patchDraft({ experienceLevel: lvl.id });
                        }}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          paddingHorizontal: 8,
                          borderRadius: RADII.input,
                          alignItems: 'center',
                          backgroundColor: active ? hexToRgba(c.constant, 0.2) : c.secondBg,
                          borderWidth: 1.5,
                          borderColor: active ? c.constant : c.thirdBg,
                        }}
                      >
                        <AppText size="xsm" weight="black" tone={active ? 'constant' : 'default'}>
                          {lvl.label}
                        </AppText>
                        <AppText size="xxsm" tone="sub">
                          {lvl.desc}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : null}

          {/* STEP 1: Equipment + Weekly Days */}
          {step === 1 ? (
            <View style={{ gap: 14 }}>
              <AppCard style={{ gap: 10 }}>
                <AppText size="sm" weight="black">
                  Weekly Workout Target ({draft.weeklyWorkoutGoal} days / week)
                </AppText>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[2, 3, 4, 5, 6].map((days) => {
                    const active = draft.weeklyWorkoutGoal === days;
                    return (
                      <Pressable
                        key={days}
                        onPress={() => {
                          impactLight();
                          patchDraft({ weeklyWorkoutGoal: days });
                        }}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: RADII.input,
                          alignItems: 'center',
                          backgroundColor: active ? hexToRgba(c.constant, 0.22) : c.thirdBg,
                          borderWidth: 1.5,
                          borderColor: active ? c.constant : 'transparent',
                        }}
                      >
                        <AppText size="md" weight="black" tone={active ? 'constant' : 'default'}>
                          {days}d
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </AppCard>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {EQUIPMENT_TYPES.map((eq) => {
                  const active = draft.selectedEquipment.includes(eq);
                  const eqImg = EQUIPMENT_IMAGES[eq];
                  return (
                    <Pressable
                      key={eq}
                      onPress={() => toggleEquipment(eq)}
                      style={{
                        width: '47%',
                        flexGrow: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        padding: 12,
                        borderRadius: RADII.card,
                        backgroundColor: active ? hexToRgba(c.constant, 0.16) : c.secondBg,
                        borderWidth: 1.5,
                        borderColor: active ? c.constant : c.thirdBg,
                      }}
                    >
                      {eqImg ? (
                        <Image source={eqImg} resizeMode="contain" style={{ width: 30, height: 30 }} />
                      ) : (
                        <Ionicons name="barbell-outline" size={22} color={active ? c.constant : c.subText} />
                      )}
                      <AppText size="xsm" weight="bold" tone={active ? 'constant' : 'reg'} style={{ flex: 1 }}>
                        {eq}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* STEP 2: Biometric Calibration */}
          {step === 2 ? (
            <AppCard style={{ gap: 14 }}>
              <SegmentedControl
                value={draft.rankingSex}
                onChange={(rankingSex) => patchDraft({ rankingSex })}
                options={[
                  { label: 'Male Standards', value: 'Male' },
                  { label: 'Female Standards', value: 'Female' },
                ]}
              />
              <SegmentedControl
                value={draft.unitWeight}
                onChange={handleUnitChange}
                options={[
                  { label: 'Pounds (lbs)', value: 'lbs' },
                  { label: 'Kilograms (kg)', value: 'kg' },
                ]}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <WheelPicker
                    label={`BODYWEIGHT (${draft.unitWeight.toUpperCase()})`}
                    values={weightOptions}
                    unit={draft.unitWeight}
                    selectedIndex={weightIdx}
                    onChange={(idx) => setWeightIdx(idx)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <WheelPicker
                    label="AGE (YRS)"
                    values={AGE_OPTIONS}
                    unit="yrs"
                    selectedIndex={ageIdx}
                    onChange={(idx) => setAgeIdx(idx)}
                  />
                </View>
              </View>
            </AppCard>
          ) : null}

          {/* STEP 3: Muscle Priorities */}
          {step === 3 ? (
            <AppCard style={{ alignItems: 'center', gap: 12 }}>
              <SegmentedControl
                value={bodygraphSide}
                onChange={setBodygraphSide}
                options={[
                  { label: 'Front Anatomy', value: 'front' },
                  { label: 'Back Anatomy', value: 'back' },
                ]}
              />
              <MuscleBodygraphSvg
                muscles={focusBodygraphData}
                side={bodygraphSide}
                isFemale={draft.rankingSex === 'Female'}
                onSelectMuscle={toggleMuscle}
                height={260}
              />
              <AppText size="xsm" tone="sub" align="center">
                {focusMuscles.length > 0
                  ? `Focused: ${focusMuscles.slice(0, 5).join(', ')}${focusMuscles.length > 5 ? ` +${focusMuscles.length - 5}` : ''}`
                  : 'Tap any muscle group to highlight your top priorities'}
              </AppText>
            </AppCard>
          ) : null}
        </Animated.View>

        <View style={{ paddingTop: 14 }}>
          <AppButton
            title={step === TOTAL_STEPS - 1 ? 'Test My Live Strength Rank' : 'Continue'}
            size="lg"
            fullWidth
            onPress={handleNext}
          />
        </View>
      </ScreenContainer>
    </View>
  );
}
