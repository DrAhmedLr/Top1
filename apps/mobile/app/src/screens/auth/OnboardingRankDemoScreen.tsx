import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  calculateExerciseRank,
  calculateTargetWeightForRating,
  formatWeight,
  kgToLbs,
  lbsToKg,
  RANKED_MUSCLE_GROUPS,
} from '@apexlift/shared';
import { JymboDialogue } from '../../components/mascot';
import { MuscleBodygraphSvg, type MuscleRankEntry } from '../../components/rank/MuscleBodygraphSvg';
import {
  AppButton,
  AppCard,
  AppInput,
  AppText,
  RankBadge,
  ScreenContainer,
  StackHeader,
} from '../../components/ui';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { impactMedium } from '../../utils/haptics';
import { playRankTierSting, playSound } from '../../utils/soundscape';

type Props = NativeStackScreenProps<AuthStackParamList, 'OnboardingRankDemo'>;

const DEMO_LIFTS = [
  { id: 'ex_bench_press', name: 'Bench Press', m: 4.9, f: 3.0, bw: false, muscles: ['Upper Chest', 'Lower Chest', 'Triceps', 'Front Delt'] },
  { id: 'ex_squat', name: 'Back Squat', m: 6.4, f: 4.5, bw: false, muscles: ['Quadriceps', 'Glutes', 'Hamstrings', 'Lower Back'] },
  { id: 'ex_deadlift', name: 'Deadlift', m: 7.6, f: 5.4, bw: false, muscles: ['Hamstrings', 'Glutes', 'Lower Back', 'Traps'] },
  { id: 'ex_overhead_press', name: 'Overhead Press', m: 3.2, f: 2.0, bw: false, muscles: ['Front Delt', 'Middle Delt', 'Triceps'] },
  { id: 'ex_pull_ups', name: 'Pull-Ups', m: 5.0, f: 3.6, bw: true, muscles: ['Lats', 'Upper Back', 'Biceps', 'Forearms'] },
] as const;

export function OnboardingRankDemoScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const draft = useAuthStore((s) => s.onboardingDraft);
  const patchDraft = useAuthStore((s) => s.patchOnboardingDraft);

  const [selectedId, setSelectedId] = useState(draft.benchmarkExerciseId || 'ex_bench_press');
  const [weightStr, setWeightStr] = useState(
    draft.unitWeight === 'lbs'
      ? String(Math.round(kgToLbs(draft.benchmarkWeightKg)))
      : String(Math.round(draft.benchmarkWeightKg))
  );
  const [repsStr, setRepsStr] = useState(String(draft.benchmarkReps || 5));

  const lift = DEMO_LIFTS.find((l) => l.id === selectedId) ?? DEMO_LIFTS[0];

  const weightKg = useMemo(() => {
    const val = parseFloat(weightStr) || 0;
    return draft.unitWeight === 'lbs' ? lbsToKg(val) : val;
  }, [weightStr, draft.unitWeight]);

  const reps = Math.max(1, Math.min(30, parseInt(repsStr, 10) || 1));

  const rankResult = useMemo(() => {
    return calculateExerciseRank({
      weightKg,
      reps,
      bodyweightKg: draft.bodyweightKg,
      sex: draft.rankingSex,
      standard: {
        maleBaseFactor: lift.m,
        femaleBaseFactor: lift.f,
        includesBodyweight: lift.bw,
      },
    });
  }, [weightKg, reps, draft.bodyweightKg, draft.rankingSex, lift]);

  const prevTierRef = useRef(rankResult.tier);
  useEffect(() => {
    if (rankResult.tier !== prevTierRef.current) {
      prevTierRef.current = rankResult.tier;
      impactMedium();
      playRankTierSting(rankResult.tier);
    }
  }, [rankResult.tier]);

  const liveBodygraphData = useMemo(() => {
    const map: Record<string, MuscleRankEntry> = {};
    for (const m of RANKED_MUSCLE_GROUPS) {
      const hit = (lift.muscles as readonly string[]).includes(m);
      map[m] = {
        muscle: m,
        rating: hit ? rankResult.rating : 0,
        tier: hit ? rankResult.tier : 'Unranked',
        division: hit ? rankResult.division : 1,
        label: hit ? rankResult.label : 'Unranked',
        topExerciseName: hit ? lift.name : null,
        topExerciseId: hit ? lift.id : null,
        exerciseCount: hit ? 1 : 0,
      };
    }
    return map;
  }, [lift, rankResult]);

  const nextTargetKg = useMemo(() => {
    return calculateTargetWeightForRating({
      targetRating: rankResult.nextThresholdRating,
      reps,
      bodyweightKg: draft.bodyweightKg,
      sex: draft.rankingSex,
      standard: {
        maleBaseFactor: lift.m,
        femaleBaseFactor: lift.f,
        includesBodyweight: lift.bw,
      },
    });
  }, [rankResult.nextThresholdRating, reps, draft.bodyweightKg, draft.rankingSex, lift]);

  const handleContinue = () => {
    playSound('summary_rank_bump');
    patchDraft({
      benchmarkExerciseId: lift.id,
      benchmarkWeightKg: weightKg,
      benchmarkReps: reps,
      demoRating: rankResult.rating,
      demoRankLabel: rankResult.label,
    });
    navigation.navigate('OnboardingPlanAndGoal');
  };

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="Live BodyRank Demo" onBack={() => navigation.goBack()} />
      <ScreenContainer scroll safeTop={false} contentStyle={{ paddingTop: 10 }}>
        <JymboDialogue
          mascotPose="Congrats"
          mascotSize={88}
          mascotText={`Enter one working set of ${lift.name} — watch your sculpted rank badge & muscle graph ignite live!`}
        />

        {/* Lift Selector Pills */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {DEMO_LIFTS.map((item) => {
            const active = item.id === selectedId;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  playSound('tick', 0.45);
                  setSelectedId(item.id);
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
                  {item.name}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* Live Sculpted Rank + Anatomical Muscle Graph Card */}
        <AppCard variant="gradient" style={{ alignItems: 'center', gap: 12, paddingVertical: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', width: '100%' }}>
            <RankBadge
              tier={rankResult.tier}
              division={rankResult.division}
              size={104}
              showLabel
              showShine
              floating
            />
            <MuscleBodygraphSvg
              muscles={liveBodygraphData}
              side={lift.id === 'ex_pull_ups' || lift.id === 'ex_deadlift' ? 'back' : 'front'}
              isFemale={draft.rankingSex === 'Female'}
              height={176}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 24, marginTop: 4 }}>
            <View style={{ alignItems: 'center' }}>
              <AppText size="xsm" tone="sub">
                STRENGTH RATING
              </AppText>
              <AppText size="lg" weight="black" tone="constant" tabular>
                {rankResult.rating} SR
              </AppText>
            </View>
            <View style={{ alignItems: 'center' }}>
              <AppText size="xsm" tone="sub">
                EST. 1RM
              </AppText>
              <AppText size="lg" weight="black" tabular>
                {formatWeight(rankResult.estimatedOneRmKg, draft.unitWeight)}
              </AppText>
            </View>
          </View>

          <AppText size="xsm" tone="sub" align="center">
            Next rank target ({reps} reps):{' '}
            <AppText size="xsm" weight="bold" tone="check">
              {formatWeight(nextTargetKg, draft.unitWeight)}
            </AppText>
          </AppText>
        </AppCard>

        {/* Inputs */}
        <AppCard variant="second_outlined" style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <AppInput
              label="Weight"
              keyboardType="numeric"
              suffix={draft.unitWeight}
              value={weightStr}
              onChangeText={setWeightStr}
            />
          </View>
          <View style={{ flex: 1 }}>
            <AppInput
              label="Reps"
              keyboardType="numeric"
              suffix="reps"
              value={repsStr}
              onChangeText={setRepsStr}
            />
          </View>
        </AppCard>

        <AppButton title="See My 12-Week Projection" size="lg" onPress={handleContinue} />
      </ScreenContainer>
    </View>
  );
}
