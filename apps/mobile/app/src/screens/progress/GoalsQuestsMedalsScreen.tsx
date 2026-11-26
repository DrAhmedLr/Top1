import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../api/trpc';
import { MEDAL_URLS, V4_UI_URLS } from '../../assets/v4MediaManifest';
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
import { useAuthStore } from '../../stores/authStore';
import { useResponsiveLayout } from '../../theme/useResponsiveLayout';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import { notifySuccess } from '../../utils/haptics';
import { playSound } from '../../utils/soundscape';
import type { MainStackParamList } from '../../navigation/types';

const STRENGTH_GOAL_EXERCISES = [
  { id: 'ex_bench_press', label: 'Bench Press' },
  { id: 'ex_squat', label: 'Back Squat' },
  { id: 'ex_deadlift', label: 'Deadlift' },
  { id: 'ex_pull_up', label: 'Pull-Ups' },
  { id: 'ex_ohp', label: 'Overhead Press' },
] as const;

function resolveMedalArt(name: string, description: string, unlocked: boolean, progress: number, target: number): string {
  const hay = `${name} ${description}`.toLowerCase();
  const ratio = target > 0 ? progress / target : 0;
  const tier = unlocked ? 4 : Math.min(3, Math.max(0, Math.floor(ratio * 4)));

  if (hay.includes('onboard') || hay.includes('welcome') || hay.includes('first')) {
    return MEDAL_URLS.onboardingmedalv2 ?? MEDAL_URLS.totalworkouts1;
  }
  if (hay.includes('streak') || hay.includes('week') || hay.includes('flame')) {
    return MEDAL_URLS[`streaks${tier}`] ?? MEDAL_URLS.streaks2;
  }
  if (hay.includes('volume') || hay.includes('ton') || hay.includes('kg') || hay.includes('lb')) {
    return MEDAL_URLS[`totalvolume${tier}`] ?? MEDAL_URLS.totalvolume2;
  }
  if (hay.includes('quest')) {
    return MEDAL_URLS[`completedquests${tier}`] ?? MEDAL_URLS.completedquests2;
  }
  if (hay.includes('level') || hay.includes('xp')) {
    return MEDAL_URLS[`level${tier}`] ?? MEDAL_URLS.level2;
  }
  if (hay.includes('egg') || hay.includes('shop') || hay.includes('spend') || hay.includes('credit')) {
    return MEDAL_URLS[`totaleggsspent${tier}`] ?? MEDAL_URLS.totaleggsspent2;
  }
  if (hay.includes('react') || hay.includes('like') || hay.includes('social') || hay.includes('friend')) {
    return MEDAL_URLS[`totalreactions${tier}`] ?? MEDAL_URLS.totalreactions2;
  }
  if (hay.includes('theme') || hay.includes('color')) {
    return MEDAL_URLS.allcolorthemesunlocked ?? MEDAL_URLS.level3;
  }
  if (hay.includes('push') || hay.includes('punch') || hay.includes('pr') || hay.includes('record')) {
    return MEDAL_URLS.onepunchman ?? MEDAL_URLS.totalworkouts4;
  }
  return MEDAL_URLS[`totalworkouts${tier}`] ?? MEDAL_URLS.totalworkouts1;
}

function resolveQuestArt(category: string, idx: number): string {
  const low = category.toLowerCase();
  if (low.includes('daily')) return V4_UI_URLS.quest_questbell;
  if (low.includes('weekly')) return V4_UI_URLS.quest_questchest;
  if (low.includes('social')) return V4_UI_URLS.quest_questsync;
  const fallback = [
    V4_UI_URLS.quest_questchest,
    V4_UI_URLS.quest_questbell,
    V4_UI_URLS.quest_questsync,
    V4_UI_URLS.quest_questwidget,
  ];
  return fallback[idx % fallback.length];
}

const SHOWCASE_MEDAL_TIERS = [
  { key: 'onboardingmedalv2', label: 'Day-Zero Pioneer' },
  { key: 'totalworkouts4', label: 'Iron Legend (V)' },
  { key: 'streaks4', label: 'Unbreakable Flame (V)' },
  { key: 'totalvolume4', label: 'Million-Pound Club (V)' },
  { key: 'level4', label: 'Olympian Level (V)' },
  { key: 'completedquests4', label: 'Quest Master (V)' },
  { key: 'totaleggsspent4', label: 'Vault Collector (V)' },
  { key: 'totalreactions4', label: 'Gym Community Icon (V)' },
  { key: 'onepunchman', label: 'One-Punch PR' },
  { key: 'allcolorthemesunlocked', label: 'Chromatic Collector' },
  { key: 'allseasonalthemesunlocked', label: 'Four Seasons' },
];

export function GoalsQuestsMedalsScreen() {
  const { theme } = useTheme();
  const layout = useResponsiveLayout();
  const c = theme.colors;
  const route = useRoute<RouteProp<MainStackParamList, 'GoalsQuestsMedals'>>();
  const { showAlert } = useAppAlert();
  const setUser = useAuthStore((s) => s.setUser);
  const utils = trpc.useUtils();

  const [tab, setTab] = useState<'goals' | 'quests' | 'medals'>(
    route.params?.initialTab ?? 'quests'
  );
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('120');
  const [goalType, setGoalType] = useState<'strength' | 'consistency'>('strength');
  const [goalExerciseId, setGoalExerciseId] = useState<string>(STRENGTH_GOAL_EXERCISES[0].id);

  const goalsQuery = trpc.gamification.listGoals.useQuery();
  const questsQuery = trpc.gamification.getQuests.useQuery();
  const medalsQuery = trpc.gamification.getMedals.useQuery();

  const createGoal = trpc.gamification.createGoal.useMutation({
    onSuccess: () => {
      utils.gamification.listGoals.invalidate();
      setGoalTitle('');
      setGoalModalOpen(false);
    },
  });

  const deleteGoal = trpc.gamification.deleteGoal.useMutation({
    onSuccess: () => utils.gamification.listGoals.invalidate(),
  });

  const claimQuest = trpc.gamification.claimQuest.useMutation({
    onSuccess: async (res) => {
      if (res.ok) {
        playSound('challenge_claim');
        notifySuccess();
        utils.gamification.getQuests.invalidate();
        try {
          const fresh = await utils.user.me.fetch();
          setUser(fresh);
        } catch {
          // ignore
        }
        showAlert({
          title: 'Quest Claimed!',
          message: `Earned +${res.rewardXp} XP and +${res.rewardCredits} Credits.`,
        });
      }
    },
  });

  return (
    <ScreenContainer scroll>
      <StackHeader
        title="Goals, Quests & Medals"
        subtitle="Earn XP, Credits, and sculpted profile medals"
        right={
          tab === 'goals' ? (
            <AppButton
              label="+ Goal"
              size="sm"
              variant="secondary"
              onPress={() => setGoalModalOpen(true)}
            />
          ) : undefined
        }
      />

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { label: 'Quests', value: 'quests' },
          { label: 'Goals', value: 'goals' },
          { label: 'Medals', value: 'medals' },
        ]}
      />

      {tab === 'quests' ? (
        <View style={{ gap: 10 }}>
          {(questsQuery.data ?? []).map((q, idx) => {
            const pct = Math.min(100, Math.round((q.progress / Math.max(1, q.targetCount)) * 100));
            const questArt = resolveQuestArt(q.category, idx);
            return (
              <AppCard key={q.id} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <Image
                    source={{ uri: questArt }}
                    resizeMode="contain"
                    style={{ width: 48, height: 48 }}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText size="xsm" weight="bold" tone="constant">
                      {q.category.toUpperCase()} QUEST
                    </AppText>
                    <AppText size="md" weight="bold">
                      {q.title}
                    </AppText>
                    <AppText size="xsm" tone="sub">
                      {q.description}
                    </AppText>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <AppText size="xsm" weight="bold" tone="constant">
                      +{q.rewardXp} XP
                    </AppText>
                    <AppText size="xsm" weight="bold" style={{ color: c.warning }}>
                      +{q.rewardCredits} CR
                    </AppText>
                  </View>
                </View>

                <View style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText size="xsm" tone="sub">
                      Progress
                    </AppText>
                    <AppText size="xsm" weight="bold">
                      {q.progress}/{q.targetCount}
                    </AppText>
                  </View>
                  <View style={{ height: 7, borderRadius: 99, backgroundColor: c.thirdBg, overflow: 'hidden' }}>
                    <View
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor: q.isCompleted ? c.check : c.constant,
                      }}
                    />
                  </View>
                </View>

                {q.isClaimed ? (
                  <AppText size="xsm" weight="bold" tone="check">
                    ✓ Reward Claimed
                  </AppText>
                ) : q.isCompleted ? (
                  <AppButton
                    label="Claim Reward"
                    variant="gold"
                    size="sm"
                    loading={claimQuest.isPending}
                    onPress={() => claimQuest.mutate({ questId: q.id })}
                  />
                ) : null}
              </AppCard>
            );
          })}
        </View>
      ) : null}

      {tab === 'goals' ? (
        <View style={{ gap: 10 }}>
          {(goalsQuery.data ?? []).map((g) => {
            const pct = Math.min(100, Math.round((g.currentValue / Math.max(1, g.targetValue)) * 100));
            return (
              <AppCard key={g.id} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <AppText size="md" weight="bold">
                      {g.title}
                    </AppText>
                    <AppText size="xsm" tone="sub">
                      {g.currentValue} / {g.targetValue} {g.unit} ({pct}%)
                    </AppText>
                  </View>
                  <Pressable onPress={() => deleteGoal.mutate({ id: g.id })} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={c.subText} />
                  </Pressable>
                </View>
                <View style={{ height: 7, borderRadius: 99, backgroundColor: c.thirdBg, overflow: 'hidden' }}>
                  <View
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      backgroundColor: g.completedAt ? c.check : c.constant,
                    }}
                  />
                </View>
              </AppCard>
            );
          })}
          <AppButton
            label="+ Create New Goal"
            variant="secondary"
            onPress={() => setGoalModalOpen(true)}
            fullWidth
          />
        </View>
      ) : null}

      {tab === 'medals' ? (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {(medalsQuery.data ?? []).map((m) => {
              const medalUrl = resolveMedalArt(m.name, m.description, m.unlocked, m.progress, m.targetValue);
              return (
                <AppCard
                  key={m.id}
                  style={{
                    width: layout.isDesktop ? '23.8%' : layout.isWide ? '31.5%' : '48.2%',
                    alignItems: 'center',
                    gap: 6,
                    borderColor: m.unlocked ? hexToRgba(c.warning, 0.7) : c.thirdBg,
                    opacity: m.unlocked ? 1 : 0.78,
                  }}
                >
                  <View
                    style={{
                      width: 70,
                      height: 70,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Image
                      source={{ uri: medalUrl }}
                      resizeMode="contain"
                      style={{ width: 68, height: 68, opacity: m.unlocked ? 1 : 0.6 }}
                    />
                  </View>
                  <AppText size="sm" weight="bold" align="center">
                    {m.name}
                  </AppText>
                  <AppText size="xsm" tone="sub" align="center">
                    {m.description}
                  </AppText>
                  <AppText size="xsm" weight="bold" tone={m.unlocked ? 'check' : 'sub'}>
                    {m.unlocked ? 'UNLOCKED' : `${m.progress}/${m.targetValue}`}
                  </AppText>
                </AppCard>
              );
            })}
          </View>

          {/* Sculpted Prestige Medal Vault Showcase */}
          <AppCard variant="second_outlined" style={{ gap: 10 }}>
            <AppText size="sm" weight="black" tone="constant">
              SCULPTED MEDAL VAULT (39 TIERS)
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
              {SHOWCASE_MEDAL_TIERS.map((item) => (
                <View key={item.key} style={{ width: '30%', alignItems: 'center', gap: 4 }}>
                  <Image
                    source={{ uri: MEDAL_URLS[item.key] }}
                    resizeMode="contain"
                    style={{ width: 54, height: 54 }}
                  />
                  <AppText size="xxsm" weight="bold" tone="sub" align="center" numberOfLines={2}>
                    {item.label}
                  </AppText>
                </View>
              ))}
            </View>
          </AppCard>
        </View>
      ) : null}

      <AppModal
        visible={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        title="New Personal Goal"
      >
        <SegmentedControl
          value={goalType}
          onChange={setGoalType}
          options={[
            { label: 'Strength (1RM)', value: 'strength' },
            { label: 'Consistency', value: 'consistency' },
          ]}
        />
        {goalType === 'strength' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {STRENGTH_GOAL_EXERCISES.map((ex) => {
              const active = goalExerciseId === ex.id;
              return (
                <Pressable
                  key={ex.id}
                  onPress={() => setGoalExerciseId(ex.id)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: RADII.pill,
                    backgroundColor: active ? hexToRgba(c.constant, 0.2) : c.thirdBg,
                    borderWidth: 1,
                    borderColor: active ? c.constant : 'transparent',
                  }}
                >
                  <AppText size="xxsm" weight="bold" tone={active ? 'constant' : 'sub'}>
                    {ex.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <AppInput
          label="Goal Title"
          placeholder={goalType === 'strength' ? 'e.g. Bench 225 lbs' : 'e.g. 20 Workouts this Month'}
          value={goalTitle}
          onChangeText={setGoalTitle}
        />
        <AppInput
          label={goalType === 'strength' ? 'Target Weight (kg)' : 'Target Workouts'}
          keyboardType="decimal-pad"
          value={goalTarget}
          onChangeText={setGoalTarget}
        />
        <AppButton
          label="Create Goal"
          loading={createGoal.isPending}
          onPress={() => {
            const targetValue = parseFloat(goalTarget);
            if (!goalTitle.trim() || !Number.isFinite(targetValue) || targetValue <= 0) return;
            createGoal.mutate({
              goalType,
              title: goalTitle.trim(),
              exerciseId: goalType === 'strength' ? goalExerciseId : null,
              startingValue: 0,
              targetValue,
              unit: goalType === 'strength' ? 'kg' : 'workouts',
            });
          }}
          fullWidth
        />
      </AppModal>
    </ScreenContainer>
  );
}
