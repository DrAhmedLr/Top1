import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, Switch, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { buildRankPredictionCurve, ratingToRank, type RankTier } from '@apexlift/shared';
import { ONBOARDING_ASSETS } from '../../assets/v3AssetRegistry';
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
import { hexToRgba } from '../../theme/tokens';
import { impactLight } from '../../utils/haptics';
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

export function OnboardingPlanAndGoalScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const draft = useAuthStore((s) => s.onboardingDraft);
  const patchDraft = useAuthStore((s) => s.patchOnboardingDraft);

  // Streamlined 2-stage preview: 0 = 12-Week Projection & Reminders, 1 = Athlete Evolution Preview
  const [stage, setStage] = useState<0 | 1>(0);
  const [evoIdx, setEvoIdx] = useState(2);

  const slideX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    slideX.setValue(28);
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

  const handleContinue = () => {
    if (stage === 0) {
      playSound('next_step');
      impactLight();
      setStage(1);
      return;
    }
    playSound('flow_complete');
    navigation.navigate('OnboardingCredentials');
  };

  const handleBack = () => {
    playSound('tick', 0.35);
    if (stage > 0) setStage(0);
    else navigation.goBack();
  };

  const currentEvo = EVOLUTION_STAGES[evoIdx];
  const stageTitles = ['12-Week Projection', 'Your Lifter Evolves'];

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title={stageTitles[stage]} onBack={handleBack} />
      <ScreenContainer
        scroll
        safeTop={false}
        contentStyle={{
          justifyContent: 'space-between',
          paddingTop: 8,
          maxWidth: 560,
          alignSelf: 'center',
          width: '100%',
        }}
      >
        <Animated.View style={{ gap: 14, transform: [{ translateX: slideX }] }}>
          {/* Stage Dots */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            {([0, 1] as const).map((i) => (
              <Pressable
                key={i}
                onPress={() => {
                  playSound('tick', 0.35);
                  setStage(i);
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

          {/* STAGE 0: 12-Week Strength Projection + Reminders */}
          {stage === 0 ? (
            <>
              <JymboDialogue
                mascotPose="Confident"
                mascotSize={86}
                mascotText={`At ${draft.weeklyWorkoutGoal}x/week, here is your projected strength trajectory over the next 12 weeks!`}
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

              <AppCard
                variant="second_outlined"
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText size="sm" weight="bold">
                    Workout &amp; Streak Reminders
                  </AppText>
                  <AppText size="xsm" tone="sub">
                    Stay consistent with your {draft.weeklyWorkoutGoal}x/week training goal.
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

          {/* STAGE 1: Athlete Evolution Preview */}
          {stage === 1 ? (
            <>
              <JymboDialogue
                mascotPose="Cool"
                mascotSize={84}
                mascotText="Watch your athlete profile light up with higher rank tiers as your verified lifts climb!"
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
        </Animated.View>

        <View style={{ paddingTop: 12, gap: 8 }}>
          <AppButton
            title={stage === 0 ? 'Continue' : 'Create My TOP1% Account'}
            size="lg"
            fullWidth
            onPress={handleContinue}
          />
          {stage === 1 ? (
            <AppButton
              title="Customize Avatar First"
              variant="secondary"
              size="sm"
              fullWidth
              onPress={() => navigation.navigate('OnboardingAvatar')}
            />
          ) : null}
        </View>
      </ScreenContainer>
    </View>
  );
}
