import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Platform, Pressable, Switch, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { buildRankPredictionCurve, ratingToRank, type RankTier } from '@apexlift/shared';
import { ONBOARDING_ASSETS } from '../../assets/v3AssetRegistry';
import { WIDGET_VIDEOS } from '../../assets/v4MediaManifest';
import { CustomAvatarRive, JymboDialogue } from '../../components/mascot';
import {
  AppButton,
  AppCard,
  AppText,
  RankBadge,
  ScreenContainer,
  StackHeader,
} from '../../components/ui';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import { USE_NATIVE_DRIVER } from '../../theme/animations';
import { RANK_SOLID_ACCENT } from '../../theme/rankGradients';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import { impactHeavy, impactLight, notifySuccess } from '../../utils/haptics';
import { playSound } from '../../utils/soundscape';

type Props = NativeStackScreenProps<AuthStackParamList, 'OnboardingPlanAndGoal'>;

const EVOLUTION_STAGES: Array<{
  label: string;
  tier: RankTier;
  weeks: string;
  bodyType: string;
  muscles: Partial<Record<string, RankTier>>;
}> = [
  {
    label: 'Week 1 • Rookie',
    tier: 'Rookie',
    weeks: 'Day 1',
    bodyType: 'body_C',
    muscles: { 'Upper Chest': 'Rookie', Biceps: 'Rookie', Quadriceps: 'Rookie' },
  },
  {
    label: 'Week 6 • Enthusiast',
    tier: 'Enthusiast',
    weeks: '6 Weeks',
    bodyType: 'body_A',
    muscles: {
      'Upper Chest': 'Enthusiast',
      'Lower Chest': 'Intermediate',
      Biceps: 'Enthusiast',
      Abdominals: 'Enthusiast',
      Quadriceps: 'Enthusiast',
    },
  },
  {
    label: 'Week 12 • Champion',
    tier: 'Champion',
    weeks: '12 Weeks',
    bodyType: 'body_B',
    muscles: {
      'Upper Chest': 'Champion',
      'Lower Chest': 'Elite',
      Biceps: 'Champion',
      Triceps: 'Elite',
      'Front Delt': 'Champion',
      Abdominals: 'Elite',
      Quadriceps: 'Champion',
    },
  },
  {
    label: 'Year 1 • Olympian',
    tier: 'Olympian',
    weeks: '1 Year',
    bodyType: 'body_F',
    muscles: {
      'Upper Chest': 'Olympian',
      'Lower Chest': 'Olympian',
      Biceps: 'Olympian',
      Triceps: 'Titan',
      'Front Delt': 'Olympian',
      'Middle Delt': 'Olympian',
      Abdominals: 'Olympian',
      Quadriceps: 'Olympian',
      Calves: 'Titan',
    },
  },
];

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const VIDEO_TABS = [
  { id: 'widget_video_1' as const, label: 'Streak' },
  { id: 'widget_video_2' as const, label: 'BodyRank' },
  { id: 'widget_video_3' as const, label: 'Live Sets' },
  { id: 'widget_video_4' as const, label: 'Jymbo' },
];

export function OnboardingPlanAndGoalScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const draft = useAuthStore((s) => s.onboardingDraft);
  const patchDraft = useAuthStore((s) => s.patchOnboardingDraft);

  // 4 dedicated full-screen Liftoff moments:
  // 0 = OnboardingFibChart, 1 = OnboardingStreakBump, 2 = OQ_AvatarLevelsUp, 3 = OQ_WidgetPreview
  const [stage, setStage] = useState<0 | 1 | 2 | 3>(0);
  const [streakIgnited, setStreakIgnited] = useState(false);
  const [evoIdx, setEvoIdx] = useState(2);
  const [activeVideo, setActiveVideo] = useState<keyof typeof WIDGET_VIDEOS>('widget_video_1');

  const slideX = useRef(new Animated.Value(0)).current;
  const flameScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    slideX.setValue(32);
    Animated.spring(slideX, {
      toValue: 0,
      friction: 9,
      tension: 120,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [stage, slideX]);

  const curve = useMemo(
    () => buildRankPredictionCurve(draft.demoRating || 350, draft.weeklyWorkoutGoal, 12),
    [draft.demoRating, draft.weeklyWorkoutGoal]
  );

  const startPt = curve[0];
  const endPt = curve[curve.length - 1];
  const projectedRank = ratingToRank(endPt.rating);

  const chartW = 300;
  const chartH = 92;
  const minR = startPt.rating - 15;
  const maxR = Math.max(endPt.rating + 15, minR + 50);
  const polyPoints = curve
    .map((pt, i) => {
      const x = (i / (curve.length - 1)) * (chartW - 24) + 12;
      const y = chartH - 14 - ((pt.rating - minR) / (maxR - minR)) * (chartH - 28);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const fibKey =
    draft.fitnessGoal === 'lose_fat'
      ? 'fibchart_bodyfat'
      : draft.fitnessGoal === 'get_stronger'
        ? 'fibchart_strength'
        : 'fibchart_musclemass';
  const fibChartImg = ONBOARDING_ASSETS[fibKey];

  const handleIgniteStreak = () => {
    if (streakIgnited) return;
    setStreakIgnited(true);
    impactHeavy();
    notifySuccess();
    playSound('streak_bump_2');
    flameScale.setValue(0.65);
    Animated.spring(flameScale, {
      toValue: 1.12,
      friction: 4,
      tension: 140,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(() => {
      Animated.spring(flameScale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    });
  };

  const handleContinue = () => {
    if (stage < 3) {
      playSound('next_step');
      impactLight();
      setStage((s) => (s + 1) as 0 | 1 | 2 | 3);
      return;
    }
    playSound('flow_complete');
    navigation.navigate('OnboardingAvatar');
  };

  const handleBack = () => {
    playSound('tick', 0.35);
    if (stage > 0) setStage((s) => (s - 1) as 0 | 1 | 2 | 3);
    else navigation.goBack();
  };

  const currentEvo = EVOLUTION_STAGES[evoIdx];
  const stageTitles = ['12-Week Projection', 'Ignite Your Streak', 'Your Lifter Evolves', 'Widgets & Reminders'];

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title={stageTitles[stage]} onBack={handleBack} />
      <ScreenContainer scroll safeTop={false} contentStyle={{ justifyContent: 'space-between', paddingTop: 8 }}>
        <Animated.View style={{ gap: 14, transform: [{ translateX: slideX }] }}>
          {/* Stage Dots */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            {[0, 1, 2, 3].map((i) => (
              <Pressable
                key={i}
                onPress={() => {
                  playSound('tick', 0.35);
                  setStage(i as 0 | 1 | 2 | 3);
                }}
                style={{
                  width: stage === i ? 26 : 8,
                  height: 7,
                  borderRadius: 99,
                  backgroundColor: stage === i ? c.constant : c.thirdBg,
                }}
              />
            ))}
          </View>

          {/* STAGE 0: Dedicated OnboardingFibChart */}
          {stage === 0 ? (
            <>
              <JymboDialogue
                mascotPose="Confident"
                mascotSize={86}
                mascotText={`At ${draft.weeklyWorkoutGoal}x/week, here is your projected strength leap over the next 12 weeks!`}
              />
              <AppCard variant="gradient" style={{ alignItems: 'center', gap: 10 }}>
                <AppText size="xsm" weight="bold" tone="constant">
                  PROJECTED IN 12 WEEKS AT {draft.weeklyWorkoutGoal}x / WEEK
                </AppText>
                <RankBadge
                  tier={projectedRank.tier}
                  division={projectedRank.division}
                  size={96}
                  showLabel
                  showShine
                  floating
                />
                <AppText size="sm" tone="sub" align="center">
                  {startPt.label} ({startPt.rating} SR) →{' '}
                  <AppText size="sm" weight="bold" tone="check">
                    {endPt.label} ({endPt.rating} SR)
                  </AppText>
                </AppText>

                <Svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
                  <Polyline
                    points={polyPoints}
                    fill="none"
                    stroke={c.constant}
                    strokeWidth={3.5}
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Circle cx={12} cy={chartH - 22} r={5} fill={c.subText} />
                  <Circle cx={chartW - 12} cy={18} r={6} fill={c.check} />
                </Svg>

                {fibChartImg ? (
                  <Image source={fibChartImg} resizeMode="contain" style={{ width: '100%', height: 118 }} />
                ) : null}
              </AppCard>
            </>
          ) : null}

          {/* STAGE 1: Dedicated OnboardingStreakBump */}
          {stage === 1 ? (
            <>
              <JymboDialogue
                mascotPose={streakIgnited ? 'Congrats' : 'Salute'}
                mascotSize={88}
                mascotText={
                  streakIgnited
                    ? 'BOOM! Day 1 Streak lit! Keep training weekly to crack Bronze, Silver & Gold Streak Chests!'
                    : 'Tap the flame below to ignite your Day-1 Streak and kick off your momentum!'
                }
              />
              <Pressable onPress={handleIgniteStreak}>
                <AppCard
                  variant="gradient"
                  glowColor={streakIgnited ? '#F59E0B' : undefined}
                  style={{
                    alignItems: 'center',
                    gap: 16,
                    paddingVertical: 26,
                    borderColor: streakIgnited ? '#F59E0B' : hexToRgba(c.constant, 0.35),
                  }}
                >
                  <Animated.View
                    style={{
                      width: 112,
                      height: 112,
                      borderRadius: 56,
                      backgroundColor: streakIgnited ? hexToRgba('#F59E0B', 0.26) : c.thirdBg,
                      borderWidth: 2.5,
                      borderColor: streakIgnited ? '#F59E0B' : c.ghostText,
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: [{ scale: flameScale }],
                    }}
                  >
                    <Ionicons name="flame" size={58} color={streakIgnited ? '#F59E0B' : c.subText} />
                  </Animated.View>

                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <AppText size="xxl" weight="black" style={{ color: streakIgnited ? '#F59E0B' : c.text }} tabular>
                      {streakIgnited ? '1 DAY STREAK' : 'TAP TO IGNITE'}
                    </AppText>
                    <AppText size="xsm" tone="sub" align="center">
                      {streakIgnited
                        ? 'Your weekly streak shield is active — every session fills your Treasure Chest.'
                        : 'Light your first flame to unlock weekly streak rewards.'}
                    </AppText>
                  </View>

                  {/* 7-Day Calendar Pop Strip */}
                  <View style={{ flexDirection: 'row', gap: 8, width: '100%', justifyContent: 'center' }}>
                    {WEEK_DAYS.map((d, idx) => {
                      const lit = streakIgnited && idx === 0;
                      return (
                        <View key={`${d}_${idx}`} style={{ alignItems: 'center', gap: 4 }}>
                          <View
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 17,
                              backgroundColor: lit ? '#F59E0B' : c.thirdBg,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Ionicons
                              name={lit ? 'checkmark' : 'flame-outline'}
                              size={16}
                              color={lit ? '#0F0A18' : c.ghostText}
                            />
                          </View>
                          <AppText size="xxsm" weight="bold" tone={lit ? 'default' : 'sub'}>
                            {d}
                          </AppText>
                        </View>
                      );
                    })}
                  </View>
                </AppCard>
              </Pressable>
            </>
          ) : null}

          {/* STAGE 2: OQ_AvatarLevelsUp (Live CustomAvatarRive Evolving Rookie -> Olympian) */}
          {stage === 2 ? (
            <>
              <JymboDialogue
                mascotPose="Cool"
                mascotSize={84}
                mascotText="Watch your live Rive character evolve and light up with higher rank tiers as you get stronger!"
              />
              <AppCard variant="gradient" style={{ alignItems: 'center', gap: 12, paddingVertical: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <RankBadge tier={currentEvo.tier} division={1} size={36} />
                  <AppText
                    size="md"
                    weight="black"
                    style={{ color: RANK_SOLID_ACCENT[currentEvo.tier] ?? c.constant }}
                  >
                    {currentEvo.label}
                  </AppText>
                </View>

                <CustomAvatarRive
                  width={220}
                  height={220}
                  avatarDisplay="display_bodygraphFront"
                  bodyType={currentEvo.bodyType}
                  muscleTiers={currentEvo.muscles}
                />

                <View style={{ flexDirection: 'row', gap: 6, width: '100%' }}>
                  {EVOLUTION_STAGES.map((st, idx) => {
                    const active = idx === evoIdx;
                    return (
                      <Pressable
                        key={st.tier}
                        onPress={() => {
                          impactLight();
                          playSound('tick', 0.45);
                          setEvoIdx(idx);
                        }}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
                          borderRadius: 10,
                          alignItems: 'center',
                          backgroundColor: active ? hexToRgba(RANK_SOLID_ACCENT[st.tier], 0.24) : c.thirdBg,
                          borderWidth: 1.5,
                          borderColor: active ? RANK_SOLID_ACCENT[st.tier] : 'transparent',
                        }}
                      >
                        <AppText size="xxsm" weight="black" style={{ color: active ? RANK_SOLID_ACCENT[st.tier] : c.subText }}>
                          {st.weeks}
                        </AppText>
                        <AppText size="xxsm" weight="bold" tone={active ? 'default' : 'sub'}>
                          {st.tier}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </AppCard>
            </>
          ) : null}

          {/* STAGE 3: OQ_WidgetPreview (Real Extracted MP4 Widget Videos + Reminders) */}
          {stage === 3 ? (
            <>
              <JymboDialogue
                mascotPose="Reminder"
                mascotSize={82}
                mascotText="Preview Liftoff's live home-screen widgets & toggle Jymbo streak reminders so you never miss a day!"
              />
              <AppCard variant="second_outlined" style={{ alignItems: 'center', gap: 12 }}>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {VIDEO_TABS.map((vt) => {
                    const active = activeVideo === vt.id;
                    return (
                      <Pressable
                        key={vt.id}
                        onPress={() => {
                          impactLight();
                          playSound('tick', 0.4);
                          setActiveVideo(vt.id);
                        }}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 99,
                          backgroundColor: active ? c.constant : c.thirdBg,
                        }}
                      >
                        <AppText size="xsm" weight="bold" tone={active ? 'constantT' : 'sub'}>
                          {vt.label}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>

                <View
                  style={{
                    width: '100%',
                    maxWidth: 260,
                    height: 220,
                    borderRadius: RADII.cardLarge,
                    overflow: 'hidden',
                    backgroundColor: '#090612',
                    borderWidth: 2,
                    borderColor: hexToRgba(c.constant, 0.45),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {Platform.OS === 'web' ? (
                    // Native HTML5 video playing extracted local APK widget_video_1..4.mp4
                    React.createElement('video', {
                      key: activeVideo,
                      src: WIDGET_VIDEOS[activeVideo],
                      autoPlay: true,
                      loop: true,
                      muted: true,
                      playsInline: true,
                      style: {
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block',
                      },
                    })
                  ) : (
                    <AppText size="xsm" tone="sub">
                      Widget Preview ({activeVideo})
                    </AppText>
                  )}
                </View>
              </AppCard>

              <AppCard
                variant="second_outlined"
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText size="sm" weight="bold">
                    Workout & Streak Reminders
                  </AppText>
                  <AppText size="xsm" tone="sub">
                    Jymbo nudges you to protect your {draft.weeklyWorkoutGoal}x/week consistency goal.
                  </AppText>
                </View>
                <Switch
                  value={draft.notificationsEnabled}
                  onValueChange={(notificationsEnabled) => patchDraft({ notificationsEnabled })}
                  trackColor={{ false: c.thirdBg, true: c.constant }}
                />
              </AppCard>
            </>
          ) : null}
        </Animated.View>

        <View style={{ paddingTop: 12 }}>
          <AppButton
            title={
              stage === 1 && !streakIgnited
                ? 'Ignite My Day-1 Streak'
                : stage === 3
                  ? 'Customize Your Lifter Avatar'
                  : 'Continue'
            }
            variant={stage === 1 && streakIgnited ? 'gold' : 'primary'}
            size="lg"
            fullWidth
            onPress={() => {
              if (stage === 1 && !streakIgnited) {
                handleIgniteStreak();
                return;
              }
              handleContinue();
            }}
          />
        </View>
      </ScreenContainer>
    </View>
  );
}
