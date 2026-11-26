import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { EQUIPMENT_TYPES, kgToLbs, lbsToKg, RANKED_MUSCLE_GROUPS } from '@apexlift/shared';
import { EQUIPMENT_IMAGES } from '../../assets/assetRegistry';
import { ONBOARDING_ASSETS } from '../../assets/v3AssetRegistry';
import { V4_UI_URLS } from '../../assets/v4MediaManifest';
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
import { impactHeavy, impactLight, impactMedium, notifySuccess } from '../../utils/haptics';
import { playSound } from '../../utils/soundscape';

type Props = NativeStackScreenProps<AuthStackParamList, 'OnboardingQuestionnaire'>;

const GOALS = [
  {
    id: 'build_muscle' as const,
    label: 'Build Muscle Mass',
    desc: 'Hypertrophy splits, progressive volume & muscle ranks',
    artKey: 'icon_persona_musclemass',
    reassurance: 'Stacking lean mass is our specialty — athletes on this plan add +2.4 rank divisions in 12 weeks!',
  },
  {
    id: 'get_stronger' as const,
    label: 'Maximize Strength & Ranks',
    desc: 'Push 1RM benchmarks & climb toward Olympian',
    artKey: 'icon_persona_stronger1',
    reassurance: 'Chasing big numbers! We will calibrate your exact 5RM and 1RM targets every single session.',
  },
  {
    id: 'lose_fat' as const,
    label: 'Lean Out & Get Defined',
    desc: 'Preserve strength while locking in macro goals',
    artKey: 'icon_persona_weightloss2',
    reassurance: 'Smart move — keeping your strength ratings high while cutting preserves hard-earned muscle!',
  },
  {
    id: 'athletic' as const,
    label: 'Consistency & Athletic Build',
    desc: 'Balanced power, streaks & weekly momentum',
    artKey: 'icon_persona_consistency',
    reassurance: 'Consistency beats everything. Streak chests and weekly leagues will keep you locked in!',
  },
];

const PROBLEMS = [
  {
    id: 'motivation',
    title: 'Losing Motivation',
    desc: 'Starting strong for 2 weeks then fading out without clear milestones',
    maleKey: 'problem_problemmotivation_male_avatar',
    femaleKey: 'problem_problemmotivation_female_avatar',
  },
  {
    id: 'focus',
    title: 'No Structured Plan',
    desc: 'Walking into the gym unsure what weight, reps, or split to hit next',
    maleKey: 'problem_problemfocus_male_avatar',
    femaleKey: 'problem_problemfocus_female_avatar',
  },
  {
    id: 'results',
    title: 'Plateaued Results',
    desc: 'Training hard but not seeing measurable strength or physique leaps',
    maleKey: 'problem_problemresults_male_avatar',
    femaleKey: 'problem_problemresults_female_avatar',
  },
];

const SOCIAL_REVIEWS = [
  {
    name: 'Marcus T.',
    handle: 'Champion II • 142 Day Streak',
    quote: 'Turning every lift into a ranked climb made me stop skipping leg day. Hit a 315 lb squat in 11 weeks!',
    pfpKey: 'review_review_pfp_001',
  },
  {
    name: 'Hannah K.',
    handle: 'Elite I • +185 SR in 90 Days',
    quote: 'Seeing my BodyRank light up from Bronze to Diamond after every workout is ridiculously motivating.',
    pfpKey: 'review_review_pfp_002',
  },
  {
    name: 'Devon R.',
    handle: 'Titan III • Weekly League #1',
    quote: 'Best gym tracker UI by miles. Jymbo, streak chests, and instant PR badges make logging effortless.',
    pfpKey: 'review_review_pfp_003',
  },
  {
    name: 'Sofia M.',
    handle: 'Veteran I • Home & Gym Split',
    quote: 'I used to wander between machines. The personalized split and rest timer cut my workouts to 45 sharp minutes.',
    pfpKey: 'review_review_pfp_004',
  },
];

const LEVELS = [
  { id: 'beginner' as const, label: 'Just Starting Out', desc: '0–1 year lifting consistently', artKey: 'icon_persona_firsttime' },
  { id: 'intermediate' as const, label: 'Regular Lifter', desc: '1–3 years tracking progressive overload', artKey: 'icon_persona_workout' },
  { id: 'advanced' as const, label: 'Experienced / Competitive', desc: '3+ years chasing elite strength numbers', artKey: 'icon_persona_breakthrough' },
];

const LOCATIONS = [
  { id: 'commercial', label: 'Commercial Gym', desc: 'Full racks, cables & machines', artKey: 'icon_location_commercial' },
  { id: 'smallgym', label: 'Small / Studio Gym', desc: 'Free weights & core machines', artKey: 'icon_location_smallgym' },
  { id: 'garage', label: 'Garage Gym', desc: 'Barbell, rack & dumbbells', artKey: 'icon_location_garage' },
  { id: 'athome', label: 'Home Setup', desc: 'Dumbbells, bands & bench', artKey: 'icon_location_athome' },
  { id: 'bodyweight', label: 'Bodyweight Only', desc: 'Zero equipment needed', artKey: 'icon_location_bodyweight' },
];

const STRUGGLES = [
  { id: 'none', label: 'No Joint Issues — 100% Ready', artKey: 'icon_energy_high' },
  { id: 'shoulder', label: 'Sensitive Shoulders', artKey: 'icon_struggle_shoulderpain' },
  { id: 'back', label: 'Lower Back Tightness', artKey: 'icon_struggle_backpain' },
  { id: 'knee', label: 'Knee Discomfort', artKey: 'icon_struggle_kneepain' },
  { id: 'wrist', label: 'Wrist / Elbow Strain', artKey: 'icon_struggle_wristpain' },
];

const DIETS = [
  { id: 'classic', label: 'Classic Balanced', artKey: 'icon_diet_classic' },
  { id: 'high_protein', label: 'High Protein', artKey: 'icon_diet_paleo' },
  { id: 'mediterranean', label: 'Mediterranean', artKey: 'icon_diet_mediterranean' },
  { id: 'keto', label: 'Low Carb / Keto', artKey: 'icon_diet_keto' },
  { id: 'vegetarian', label: 'Vegetarian', artKey: 'icon_diet_vegetarian' },
  { id: 'vegan', label: 'Plant-Based', artKey: 'icon_diet_vegan' },
];

const ENERGY_LEVELS = [
  { id: 'high', label: 'Locked In & Fired Up', artKey: 'icon_energy_high' },
  { id: 'med_high', label: 'Solid Most Days', artKey: 'icon_energy_mediumhigh' },
  { id: 'med_low', label: 'Need Structure & Momentum', artKey: 'icon_energy_mediumlow' },
  { id: 'low', label: 'Running Low — Need a Kickstart', artKey: 'icon_energy_low' },
];

const SPLITS = [
  { id: 'ppl', label: 'Push / Pull / Legs', days: ['Mon', 'Tue', 'Thu', 'Fri', 'Sat'] },
  { id: 'upper_lower', label: 'Upper / Lower', days: ['Mon', 'Tue', 'Thu', 'Fri'] },
  { id: 'full_body', label: 'Full Body Ranked', days: ['Mon', 'Wed', 'Fri'] },
  { id: 'bro', label: 'Classic Body-Part Split', days: ['Mon', 'Tue', 'Wed', 'Fri', 'Sat'] },
];

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const WEIGHT_LBS_OPTIONS = Array.from({ length: 241 }, (_, i) => 90 + i); // 90..330 lbs
const WEIGHT_KG_OPTIONS = Array.from({ length: 121 }, (_, i) => 40 + i); // 40..160 kg
const HEIGHT_CM_OPTIONS = Array.from({ length: 76 }, (_, i) => 140 + i); // 140..215 cm
const AGE_OPTIONS = Array.from({ length: 68 }, (_, i) => 14 + i); // 14..81 yrs

const TOTAL_STEPS = 13;

function curveOnboardingProgress(stepIndex: number, total: number): number {
  const linear = (stepIndex + 1) / total;
  return Math.min(1, Math.pow(linear, 0.78));
}

export function OnboardingQuestionnaireScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const draft = useAuthStore((s) => s.onboardingDraft);
  const patchDraft = useAuthStore((s) => s.patchOnboardingDraft);

  const [step, setStep] = useState(0);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const [nameInput, setNameInput] = useState('');
  const [problemId, setProblemId] = useState('motivation');
  const [location, setLocation] = useState('commercial');
  const [struggles, setStruggles] = useState<string[]>(['none']);
  const [diet, setDiet] = useState('classic');
  const [energy, setEnergy] = useState('high');
  const [focusMuscles, setFocusMuscles] = useState<string[]>(['Upper Chest', 'Biceps', 'Quadriceps']);
  const [splitId, setSplitId] = useState('upper_lower');
  const [scheduledDays, setScheduledDays] = useState<string[]>(['Mon', 'Tue', 'Thu', 'Fri']);

  // Wheel Picker indices
  const weightOptions = draft.unitWeight === 'lbs' ? WEIGHT_LBS_OPTIONS : WEIGHT_KG_OPTIONS;
  const initialWeight =
    draft.unitWeight === 'lbs' ? Math.round(kgToLbs(draft.bodyweightKg)) : Math.round(draft.bodyweightKg);
  const [weightIdx, setWeightIdx] = useState(() =>
    Math.max(0, weightOptions.findIndex((v) => v >= initialWeight))
  );
  const [heightIdx, setHeightIdx] = useState(() =>
    Math.max(0, HEIGHT_CM_OPTIONS.findIndex((v) => v >= 178))
  );
  const [ageIdx, setAgeIdx] = useState(() =>
    Math.max(0, AGE_OPTIONS.findIndex((v) => v >= (draft.age || 24)))
  );

  // Hold-to-Commit state (OQ_HoldButton)
  const [holdCommitted, setHoldCommitted] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const holdAnim = useRef(new Animated.Value(0)).current;
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Plan Loading progress state (OQ_JourneyV4PlanLoading)
  const [planStage, setPlanStage] = useState(0);

  // Horizontal slide + fade transition between moments
  const slideX = useRef(new Animated.Value(0)).current;
  const slideOpacity = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(curveOnboardingProgress(0, TOTAL_STEPS))).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: curveOnboardingProgress(step, TOTAL_STEPS),
      duration: 300,
      useNativeDriver: false,
    }).start();

    slideX.setValue(slideDir * 36);
    slideOpacity.setValue(0.15);
    Animated.parallel([
      Animated.spring(slideX, {
        toValue: 0,
        friction: 9,
        tension: 120,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(slideOpacity, {
        toValue: 1,
        duration: 210,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [step, slideDir, progressAnim, slideX, slideOpacity]);

  // Auto-advance Plan Loading stages on Step 11
  useEffect(() => {
    if (step !== 11) return;
    setPlanStage(0);
    const timers = [
      setTimeout(() => {
        playSound('stat_card_1');
        setPlanStage(1);
      }, 420),
      setTimeout(() => {
        playSound('stat_card_2');
        setPlanStage(2);
      }, 880),
      setTimeout(() => {
        playSound('stat_card_3');
        setPlanStage(3);
      }, 1340),
      setTimeout(() => {
        playSound('flow_complete');
        notifySuccess();
        setPlanStage(4);
      }, 1780),
    ];
    return () => timers.forEach(clearTimeout);
  }, [step]);

  const activeGoal = GOALS.find((g) => g.id === draft.fitnessGoal) ?? GOALS[0];

  const jymboHeader = useMemo<{ pose: JymboPose; text: string; intense?: boolean }>(() => {
    const greetingName = nameInput.trim() ? `, ${nameInput.trim()}` : '';
    switch (step) {
      case 0:
        return {
          pose: 'Salute',
          text: "First up — what should I call you, and what's your main mission in the gym?",
        };
      case 1:
        return {
          pose: 'Path',
          text: `What has held you back the most before${greetingName}? We will crush it together.`,
        };
      case 2:
        return {
          pose: 'Congrats',
          text: `You're in great company${greetingName}! ${activeGoal.reassurance}`,
        };
      case 3:
        return {
          pose: 'Notes',
          text: 'How long have you been lifting? I will tune your starting volume & rank benchmarks.',
        };
      case 4:
        return {
          pose: 'Path',
          text: 'Where do you usually train? I will match your plan to your gym environment.',
        };
      case 5:
        return {
          pose: 'Notes',
          text: 'Tap every piece of equipment you have access to — we will filter your library automatically.',
        };
      case 6:
        return {
          pose: 'Reminder',
          text: 'Any sensitive joints or pain points I should watch out for when programming lifts?',
        };
      case 7:
        return {
          pose: 'Chilling',
          text: 'How is your training energy right now, and how do you prefer to fuel up?',
        };
      case 8:
        return {
          pose: 'Confident',
          text: 'Tap any muscle groups on your anatomy graph that you want to prioritize first!',
        };
      case 9:
        return {
          pose: 'Notes',
          text: 'Spin the wheels below — your bodyweight & standard calibrate fair allometric Strength Ratings.',
        };
      case 10:
        return {
          pose: 'Curling',
          text: holdCommitted
            ? `LOCKED IN${greetingName.toUpperCase()}! Your Day-Zero commitment is official!`
            : 'Press and HOLD the emblem below to lock in your ranked fitness commitment!',
          intense: isHolding || holdCommitted,
        };
      case 11:
        return {
          pose: planStage >= 4 ? 'Congrats' : 'Pushups',
          text:
            planStage >= 4
              ? 'Your ranked training plan is forged! Tap continue to inspect your weekly split.'
              : 'Crunching your biometrics, muscle priorities, and rank targets...',
        };
      default:
        return {
          pose: 'Salute',
          text: `Here is your ${scheduledDays.length}x/week starter split — tap any day to customize your schedule!`,
        };
    }
  }, [step, nameInput, activeGoal, holdCommitted, isHolding, planStage, scheduledDays.length]);

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

  const handleNext = () => {
    if (step === 9) {
      const selectedWeight = weightOptions[weightIdx] ?? initialWeight;
      const bwKg = draft.unitWeight === 'lbs' ? lbsToKg(selectedWeight) : selectedWeight;
      const selectedAge = AGE_OPTIONS[ageIdx] ?? 24;
      patchDraft({
        bodyweightKg: Math.max(35, Math.min(250, bwKg)),
        age: Math.max(13, Math.min(99, selectedAge)),
      });
    }
    if (step === TOTAL_STEPS - 1) {
      patchDraft({ weeklyWorkoutGoal: Math.max(1, scheduledDays.length) });
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

  const startHoldCommit = () => {
    if (holdCommitted) return;
    setIsHolding(true);
    impactMedium();
    playSound('tick');
    Animated.timing(holdAnim, {
      toValue: 1,
      duration: 1100,
      useNativeDriver: false,
    }).start();
    holdTimerRef.current = setTimeout(() => {
      setIsHolding(false);
      setHoldCommitted(true);
      impactHeavy();
      notifySuccess();
      playSound('fanfare');
    }, 1100);
  };

  const cancelHoldCommit = () => {
    if (holdCommitted) return;
    setIsHolding(false);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    Animated.timing(holdAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const memoryPrefix = draft.rankingSex === 'Female' ? 'demo_female_onboardingmemory' : 'demo_male_onboardingmemory';

  return (
    <View style={{ flex: 1 }}>
      <StackHeader
        title={`Step ${step + 1} of ${TOTAL_STEPS}`}
        onBack={handleBack}
        showBorder={false}
      />

      {/* Curved Animated Progress Bar */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <View style={{ height: 7, borderRadius: 99, backgroundColor: c.thirdBg, overflow: 'hidden' }}>
          <Animated.View
            style={{
              height: '100%',
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['6%', '100%'],
              }),
              backgroundColor: c.constant,
              borderRadius: 99,
            }}
          />
        </View>
      </View>

      <ScreenContainer scroll safeTop={false} contentStyle={{ justifyContent: 'space-between', paddingTop: 4 }}>
        <Animated.View
          style={{
            gap: 14,
            opacity: slideOpacity,
            transform: [{ translateX: slideX }],
          }}
        >
          {/* Live Rive Jymbo Dialogue Header */}
          <JymboDialogue
            mascotText={jymboHeader.text}
            mascotPose={jymboHeader.pose}
            curlIntense={jymboHeader.intense}
            mascotSize={92}
          />

          {/* STEP 0: Display Name + Goal */}
          {step === 0 ? (
            <View style={{ gap: 12 }}>
              <AppInput
                label="Your Name (optional)"
                placeholder="e.g. Alex"
                value={nameInput}
                onChangeText={setNameInput}
              />
              <View style={{ gap: 9 }}>
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
                        <Image source={iconSrc} resizeMode="contain" style={{ width: 42, height: 42 }} />
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
            </View>
          ) : null}

          {/* STEP 1: OQ_ProblemStatement (Extracted Mountain Graphic + Problem Avatars) */}
          {step === 1 ? (
            <View style={{ gap: 10 }}>
              <View
                style={{
                  width: '100%',
                  height: 112,
                  borderRadius: RADII.card,
                  overflow: 'hidden',
                  backgroundColor: c.secondBg,
                  borderWidth: 1,
                  borderColor: hexToRgba(c.constant, 0.25),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Image
                  source={{ uri: V4_UI_URLS.problem_rankmountaingraphic }}
                  resizeMode="contain"
                  style={{ width: '94%', height: '94%' }}
                />
              </View>
              {PROBLEMS.map((p) => {
                const selected = problemId === p.id;
                const avatarUri =
                  V4_UI_URLS[draft.rankingSex === 'Female' ? p.femaleKey : p.maleKey];
                return (
                  <AppCard
                    key={p.id}
                    selected={selected}
                    onPress={() => {
                      impactLight();
                      playSound('tick', 0.45);
                      setProblemId(p.id);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}
                  >
                    <Image
                      source={{ uri: avatarUri }}
                      resizeMode="contain"
                      style={{ width: 48, height: 48, borderRadius: 12 }}
                    />
                    <View style={{ flex: 1 }}>
                      <AppText size="sm" weight="black">
                        {p.title}
                      </AppText>
                      <AppText size="xsm" tone="sub">
                        {p.desc}
                      </AppText>
                    </View>
                    {selected ? <Ionicons name="checkmark-circle" size={22} color={c.constant} /> : null}
                  </AppCard>
                );
              })}
            </View>
          ) : null}

          {/* STEP 2: OQ_IntermissionSocialProof (5-Star Lifter Reviews + Real PFP Avatars + Memories) */}
          {step === 2 ? (
            <View style={{ gap: 12 }}>
              <AppCard variant="gradient" style={{ gap: 10, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Ionicons key={i} name="star" size={16} color="#F59E0B" />
                  ))}
                  <AppText size="xsm" weight="black" style={{ color: '#F59E0B', marginLeft: 4 }}>
                    4.9 • 2M+ RANKED LIFTERS
                  </AppText>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
                  {[1, 2, 3].map((n) => {
                    const img = ONBOARDING_ASSETS[`${memoryPrefix}${n}`];
                    return (
                      <View
                        key={n}
                        style={{
                          flex: 1,
                          height: 98,
                          borderRadius: 12,
                          backgroundColor: hexToRgba('#0F0A18', 0.65),
                          borderWidth: 1,
                          borderColor: hexToRgba(c.constant, 0.3),
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 6,
                        }}
                      >
                        {img ? (
                          <Image source={img} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </AppCard>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {SOCIAL_REVIEWS.map((rev) => (
                  <AppCard
                    key={rev.name}
                    variant="second_outlined"
                    style={{ width: 270, gap: 8, padding: 14 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Image
                        source={{ uri: V4_UI_URLS[rev.pfpKey] }}
                        resizeMode="cover"
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          borderWidth: 1.5,
                          borderColor: c.constant,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <AppText size="sm" weight="black">
                          {rev.name}
                        </AppText>
                        <AppText size="xxsm" weight="bold" tone="constant">
                          {rev.handle}
                        </AppText>
                      </View>
                    </View>
                    <AppText size="xsm" tone="sub" style={{ lineHeight: 18 }}>
                      &quot;{rev.quote}&quot;
                    </AppText>
                  </AppCard>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* STEP 3: Experience Level */}
          {step === 3 ? (
            <View style={{ gap: 10 }}>
              {LEVELS.map((lvl) => {
                const selected = draft.experienceLevel === lvl.id;
                const iconSrc = ONBOARDING_ASSETS[lvl.artKey];
                return (
                  <AppCard
                    key={lvl.id}
                    selected={selected}
                    onPress={() => {
                      impactLight();
                      playSound('tick', 0.45);
                      patchDraft({ experienceLevel: lvl.id });
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                  >
                    {iconSrc ? (
                      <Image source={iconSrc} resizeMode="contain" style={{ width: 42, height: 42 }} />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <AppText size="sm" weight="black">
                        {lvl.label}
                      </AppText>
                      <AppText size="xsm" tone="sub">
                        {lvl.desc}
                      </AppText>
                    </View>
                    {selected ? <Ionicons name="checkmark-circle" size={22} color={c.constant} /> : null}
                  </AppCard>
                );
              })}
            </View>
          ) : null}

          {/* STEP 4: Training Location */}
          {step === 4 ? (
            <View style={{ gap: 9 }}>
              {LOCATIONS.map((loc) => {
                const selected = location === loc.id;
                const iconSrc = ONBOARDING_ASSETS[loc.artKey];
                return (
                  <AppCard
                    key={loc.id}
                    selected={selected}
                    onPress={() => {
                      impactLight();
                      playSound('tick', 0.45);
                      setLocation(loc.id);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}
                  >
                    {iconSrc ? (
                      <Image source={iconSrc} resizeMode="contain" style={{ width: 40, height: 40 }} />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <AppText size="sm" weight="black">
                        {loc.label}
                      </AppText>
                      <AppText size="xsm" tone="sub">
                        {loc.desc}
                      </AppText>
                    </View>
                    {selected ? <Ionicons name="checkmark-circle" size={22} color={c.constant} /> : null}
                  </AppCard>
                );
              })}
            </View>
          ) : null}

          {/* STEP 5: Equipment Grid with Real Extracted Icons */}
          {step === 5 ? (
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
                      <Image source={eqImg} resizeMode="contain" style={{ width: 32, height: 32 }} />
                    ) : (
                      <Ionicons name="barbell-outline" size={24} color={active ? c.constant : c.subText} />
                    )}
                    <AppText size="xsm" weight="bold" tone={active ? 'constant' : 'reg'} style={{ flex: 1 }}>
                      {eq}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* STEP 6: Sensitive Joints / Struggles */}
          {step === 6 ? (
            <View style={{ gap: 9 }}>
              {STRUGGLES.map((item) => {
                const selected = struggles.includes(item.id);
                const iconSrc = ONBOARDING_ASSETS[item.artKey];
                return (
                  <AppCard
                    key={item.id}
                    selected={selected}
                    onPress={() => {
                      impactLight();
                      playSound('tick', 0.45);
                      if (item.id === 'none') {
                        setStruggles(['none']);
                      } else {
                        setStruggles((prev) => {
                          const cleaned = prev.filter((x) => x !== 'none');
                          const next = cleaned.includes(item.id)
                            ? cleaned.filter((x) => x !== item.id)
                            : [...cleaned, item.id];
                          return next.length ? next : ['none'];
                        });
                      }
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}
                  >
                    {iconSrc ? (
                      <Image source={iconSrc} resizeMode="contain" style={{ width: 38, height: 38 }} />
                    ) : null}
                    <AppText size="sm" weight="bold" style={{ flex: 1 }}>
                      {item.label}
                    </AppText>
                    {selected ? <Ionicons name="checkmark-circle" size={20} color={c.constant} /> : null}
                  </AppCard>
                );
              })}
            </View>
          ) : null}

          {/* STEP 7: Energy + Diet Preferences */}
          {step === 7 ? (
            <View style={{ gap: 12 }}>
              <AppText size="xsm" weight="black" tone="sub">
                CURRENT WORKOUT ENERGY
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {ENERGY_LEVELS.map((en) => {
                  const selected = energy === en.id;
                  const iconSrc = ONBOARDING_ASSETS[en.artKey];
                  return (
                    <AppCard
                      key={en.id}
                      selected={selected}
                      onPress={() => {
                        impactLight();
                        playSound('tick', 0.45);
                        setEnergy(en.id);
                      }}
                      style={{ width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 }}
                    >
                      {iconSrc ? <Image source={iconSrc} resizeMode="contain" style={{ width: 30, height: 30 }} /> : null}
                      <AppText size="xsm" weight="bold" style={{ flex: 1 }}>
                        {en.label}
                      </AppText>
                    </AppCard>
                  );
                })}
              </View>

              <AppText size="xsm" weight="black" tone="sub" style={{ marginTop: 4 }}>
                NUTRITION STYLE
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {DIETS.map((d) => {
                  const selected = diet === d.id;
                  const iconSrc = ONBOARDING_ASSETS[d.artKey];
                  return (
                    <AppCard
                      key={d.id}
                      selected={selected}
                      onPress={() => {
                        impactLight();
                        playSound('tick', 0.45);
                        setDiet(d.id);
                      }}
                      style={{ width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 }}
                    >
                      {iconSrc ? <Image source={iconSrc} resizeMode="contain" style={{ width: 28, height: 28 }} /> : null}
                      <AppText size="xsm" weight="bold" style={{ flex: 1 }}>
                        {d.label}
                      </AppText>
                    </AppCard>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* STEP 8: Focus Muscles Interactive Anatomical Bodygraph */}
          {step === 8 ? (
            <AppCard variant="second_outlined" style={{ alignItems: 'center', gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
                <MuscleBodygraphSvg
                  muscles={focusBodygraphData}
                  side="front"
                  isFemale={draft.rankingSex === 'Female'}
                  onSelectMuscle={toggleMuscle}
                  height={210}
                />
                <MuscleBodygraphSvg
                  muscles={focusBodygraphData}
                  side="back"
                  isFemale={draft.rankingSex === 'Female'}
                  onSelectMuscle={toggleMuscle}
                  height={210}
                />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                {focusMuscles.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => toggleMuscle(m)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 99,
                      backgroundColor: hexToRgba(c.constant, 0.2),
                      borderWidth: 1,
                      borderColor: c.constant,
                    }}
                  >
                    <AppText size="xsm" weight="bold" tone="constant">
                      {m} ×
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </AppCard>
          ) : null}

          {/* STEP 9: Biometrics with Tactile Snap WheelPickers */}
          {step === 9 ? (
            <AppCard variant="second_outlined" style={{ gap: 14 }}>
              <View style={{ gap: 6 }}>
                <AppText size="xsm" weight="bold" tone="sub">
                  RANKING STANDARD
                </AppText>
                <SegmentedControl
                  options={[
                    { value: 'Male', label: 'Male Standard' },
                    { value: 'Female', label: 'Female Standard' },
                  ]}
                  value={draft.rankingSex}
                  onChange={(rankingSex) => patchDraft({ rankingSex })}
                />
              </View>

              <View style={{ gap: 6 }}>
                <AppText size="xsm" weight="bold" tone="sub">
                  PREFERRED UNITS
                </AppText>
                <SegmentedControl
                  options={[
                    { value: 'lbs', label: 'Pounds (lbs)' },
                    { value: 'kg', label: 'Kilograms (kg)' },
                  ]}
                  value={draft.unitWeight}
                  onChange={(unitWeight) => {
                    const prevVal = weightOptions[weightIdx] ?? initialWeight;
                    const converted =
                      unitWeight === 'lbs' ? Math.round(kgToLbs(prevVal)) : Math.round(lbsToKg(prevVal));
                    const nextArr = unitWeight === 'lbs' ? WEIGHT_LBS_OPTIONS : WEIGHT_KG_OPTIONS;
                    const nextIdx = Math.max(0, nextArr.findIndex((v) => v >= converted));
                    patchDraft({ unitWeight });
                    setWeightIdx(nextIdx);
                  }}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <WheelPicker
                  label="Weight"
                  values={weightOptions}
                  selectedIndex={weightIdx}
                  onChange={(idx) => setWeightIdx(idx)}
                  unit={draft.unitWeight}
                  visibleCount={3}
                  style={{ flex: 1 }}
                />
                <WheelPicker
                  label="Height"
                  values={HEIGHT_CM_OPTIONS}
                  selectedIndex={heightIdx}
                  onChange={(idx) => setHeightIdx(idx)}
                  unit="cm"
                  visibleCount={3}
                  style={{ flex: 1 }}
                />
                <WheelPicker
                  label="Age"
                  values={AGE_OPTIONS}
                  selectedIndex={ageIdx}
                  onChange={(idx) => setAgeIdx(idx)}
                  unit="yr"
                  visibleCount={3}
                  style={{ flex: 1 }}
                />
              </View>
            </AppCard>
          ) : null}

          {/* STEP 10: OQ_HoldButton Commitment */}
          {step === 10 ? (
            <AppCard variant="gradient" style={{ alignItems: 'center', gap: 16, paddingVertical: 26 }}>
              <AppText size="md" weight="black" align="center">
                {holdCommitted ? 'Commitment Sealed!' : 'I Commit to Showing Up'}
              </AppText>
              <AppText size="xsm" tone="sub" align="center" style={{ maxWidth: 280 }}>
                {holdCommitted
                  ? 'Jymbo has locked in your Day-Zero pledge. Let us forge your custom plan.'
                  : 'Hold the emblem below until the power bar fills to 100%.'}
              </AppText>

              <Pressable
                onPressIn={startHoldCommit}
                onPressOut={cancelHoldCommit}
                style={{
                  width: 124,
                  height: 124,
                  borderRadius: 62,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: holdCommitted ? hexToRgba(c.check, 0.25) : hexToRgba(c.constant, 0.16),
                  borderWidth: 3,
                  borderColor: holdCommitted ? c.check : isHolding ? '#FFE066' : c.constant,
                }}
              >
                <Ionicons
                  name={holdCommitted ? 'checkmark-done' : 'finger-print'}
                  size={52}
                  color={holdCommitted ? c.check : isHolding ? '#FFE066' : c.constant}
                />
              </Pressable>

              <View style={{ width: '80%', height: 10, borderRadius: 99, backgroundColor: c.thirdBg, overflow: 'hidden' }}>
                <Animated.View
                  style={{
                    height: '100%',
                    width: holdAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                    backgroundColor: holdCommitted ? c.check : '#FFE066',
                    borderRadius: 99,
                  }}
                />
              </View>
            </AppCard>
          ) : null}

          {/* STEP 11: OQ_JourneyV4PlanLoading */}
          {step === 11 ? (
            <AppCard variant="second_outlined" style={{ gap: 12, paddingVertical: 18 }}>
              {[
                'Calibrating allometric strength benchmarks',
                `Targeting ${focusMuscles.slice(0, 3).join(', ') || 'full-body'} muscle ranks`,
                `Matching ${draft.selectedEquipment.length} equipment filters & joint profile`,
                'Forging Day-Zero kickoff workout & macro plan',
              ].map((label, idx) => {
                const done = planStage > idx;
                return (
                  <View
                    key={label}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      opacity: done ? 1 : 0.45,
                    }}
                  >
                    <Ionicons
                      name={done ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={done ? c.check : c.subText}
                    />
                    <AppText size="sm" weight={done ? 'bold' : 'medium'}>
                      {label}
                    </AppText>
                  </View>
                );
              })}
            </AppCard>
          ) : null}

          {/* STEP 12: OQ_JourneyV4Schedule Editable Preview */}
          {step === 12 ? (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SPLITS.map((sp) => {
                  const active = splitId === sp.id;
                  return (
                    <Pressable
                      key={sp.id}
                      onPress={() => {
                        impactLight();
                        playSound('tick', 0.45);
                        setSplitId(sp.id);
                        setScheduledDays(sp.days);
                        patchDraft({ weeklyWorkoutGoal: sp.days.length });
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 12,
                        backgroundColor: active ? c.constant : c.secondBg,
                        borderWidth: 1,
                        borderColor: active ? c.constant : c.thirdBg,
                      }}
                    >
                      <AppText size="xsm" weight="bold" tone={active ? 'constantT' : 'reg'}>
                        {sp.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>

              <AppCard variant="second_outlined" style={{ gap: 10 }}>
                <AppText size="xsm" weight="bold" tone="sub">
                  TAP DAYS TO EDIT YOUR WEEKLY SCHEDULE ({scheduledDays.length}x / WEEK)
                </AppText>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
                  {ALL_DAYS.map((day) => {
                    const active = scheduledDays.includes(day);
                    return (
                      <Pressable
                        key={day}
                        onPress={() => {
                          impactLight();
                          playSound('tick', 0.4);
                          setScheduledDays((prev) =>
                            prev.includes(day)
                              ? prev.length > 1
                                ? prev.filter((d) => d !== day)
                                : prev
                              : [...prev, day]
                          );
                        }}
                        style={{
                          flex: 1,
                          paddingVertical: 12,
                          borderRadius: 12,
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: active ? hexToRgba(c.constant, 0.22) : c.thirdBg,
                          borderWidth: 1.5,
                          borderColor: active ? c.constant : 'transparent',
                        }}
                      >
                        <AppText size="xsm" weight="black" tone={active ? 'constant' : 'sub'}>
                          {day}
                        </AppText>
                        <Ionicons
                          name={active ? 'barbell' : 'bed-outline'}
                          size={14}
                          color={active ? c.constant : c.subText}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </AppCard>
            </View>
          ) : null}
        </Animated.View>

        {/* Bottom Action CTA */}
        <View style={{ paddingTop: 14 }}>
          <AppButton
            title={
              step === TOTAL_STEPS - 1
                ? 'Looks Good — Test My Starting Rank'
                : step === 10 && !holdCommitted
                  ? 'Tap or Hold Above to Commit'
                  : 'Continue'
            }
            variant={step === 10 && holdCommitted ? 'check' : 'primary'}
            size="lg"
            fullWidth
            disabled={step === 11 && planStage < 4}
            onPress={() => {
              if (step === 10 && !holdCommitted) {
                setHoldCommitted(true);
                holdAnim.setValue(1);
                playSound('fanfare');
                notifySuccess();
                return;
              }
              handleNext();
            }}
          />
        </View>
      </ScreenContainer>
    </View>
  );
}
