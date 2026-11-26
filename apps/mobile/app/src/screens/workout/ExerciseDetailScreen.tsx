import React from 'react';
import { Image, ScrollView, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatWeight, ratingToRank, type RankTier } from '@apexlift/shared';
import { trpc } from '../../api/trpc';
import { getEquipmentImage, getExerciseFullImage } from '../../assets/assetRegistry';
import { getExerciseFullUrl, getMuscleGraphicUrl } from '../../assets/v4MediaManifest';
import {
  AppButton,
  AppCard,
  AppText,
  RankBadge,
  ScreenContainer,
  StackHeader,
} from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import { RANK_BG_GRADIENTS, RANK_SOLID_ACCENT } from '../../theme/rankGradients';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import type { MainStackParamList } from '../../navigation/types';

export function ExerciseDetailScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, 'ExerciseDetail'>>();
  const { exerciseId } = route.params;

  const user = useAuthStore((s) => s.user);
  const unit = user?.unitWeight ?? 'lbs';
  const sex = user?.rankingSex === 'Female' ? 'Female' : 'Male';
  const addExercise = useWorkoutStore((s) => s.addExercise);
  const openSheet = useWorkoutStore((s) => s.openSheet);

  const exQuery = trpc.exercise.getById.useQuery({ id: exerciseId });
  const historyQuery = trpc.exercise.getHistory.useQuery({ exerciseId });
  const myRanksQuery = trpc.rank.getMyRanks.useQuery();

  const ex = exQuery.data;
  const rankEntry = myRanksQuery.data?.find((r) => r.exerciseId === exerciseId);
  const rankInfo = ratingToRank(rankEntry?.peakRating ?? 0);
  const tier = rankInfo.tier as RankTier;
  const accent = RANK_SOLID_ACCENT[tier] ?? c.constant;
  const history = historyQuery.data ?? [];

  const localFullImg = getExerciseFullImage(exerciseId);
  const webFullUrl = getExerciseFullUrl(exerciseId);
  const eqImg = ex ? getEquipmentImage(ex.equipment) : null;

  return (
    <ScreenContainer scroll>
      <StackHeader
        title={ex?.name ?? 'Exercise'}
        subtitle={ex ? `${ex.equipment} • ${ex.isRankable ? 'Ranked Lift' : 'Accessory'}` : undefined}
      />

      {ex ? (
        <>
          {/* Full Form Illustration Showcase (supports both V2 bundled + all 630 V4 APK diagrams) */}
          {localFullImg || webFullUrl ? (
            <AppCard style={{ padding: 0, overflow: 'hidden', alignItems: 'center' }}>
              <View
                style={{
                  width: '100%',
                  height: 220,
                  backgroundColor: 'rgba(12, 8, 22, 0.72)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Image
                  source={localFullImg ?? { uri: webFullUrl! }}
                  resizeMode="contain"
                  style={{ width: '100%', height: '100%' }}
                />
              </View>
            </AppCard>
          ) : null}

          <AppCard
            gradientColors={RANK_BG_GRADIENTS[tier]}
            glowColor={rankEntry ? accent : undefined}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}
          >
            <RankBadge
              tier={tier}
              division={rankInfo.division}
              size={82}
              showShine={Boolean(rankEntry)}
            />
            <View style={{ flex: 1, gap: 4 }}>
              <AppText size="xsm" weight="bold" style={{ color: accent }}>
                YOUR PEAK RANK
              </AppText>
              <AppText size="xl" weight="black">
                {rankInfo.label}
              </AppText>
              <AppText size="sm" tone="sub">
                {rankEntry
                  ? `${rankEntry.peakRating} SR • Est 1RM ${formatWeight(rankEntry.peakE1rmKg, unit)}`
                  : 'Log a working set to unlock your rank'}
              </AppText>
            </View>
          </AppCard>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <AppButton
              label="Add to Workout"
              onPress={() => {
                addExercise({
                  exerciseId: ex.id,
                  exerciseName: ex.name,
                  equipment: ex.equipment,
                  primaryMuscles: ex.primaryMuscles,
                });
                openSheet();
              }}
              style={{ flex: 1.4 }}
            />
            <AppButton
              label="Simulate Rank"
              variant="secondary"
              onPress={() => navigation.navigate('RankCalculator', { exerciseId: ex.id })}
              style={{ flex: 1 }}
            />
          </View>

          <AppCard style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText size="md" weight="bold">
                Target Muscles & Equipment
              </AppText>
              {eqImg ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: RADII.pill,
                    backgroundColor: c.thirdBg,
                  }}
                >
                  <Image source={eqImg} resizeMode="contain" style={{ width: 18, height: 18 }} />
                  <AppText size="xsm" weight="bold">
                    {ex.equipment}
                  </AppText>
                </View>
              ) : null}
            </View>

            {/* Isolated APK Male/Female Muscle Graphics */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {[...ex.primaryMuscles.map((m) => ({ m, primary: true })), ...ex.secondaryMuscles.map((m) => ({ m, primary: false }))].map(
                ({ m, primary }) => {
                  const gUrl = getMuscleGraphicUrl(m, sex);
                  return (
                    <View
                      key={`${primary ? 'p' : 's'}_${m}`}
                      style={{
                        width: 96,
                        padding: 8,
                        borderRadius: RADII.input,
                        backgroundColor: primary ? hexToRgba(c.constant, 0.14) : c.thirdBg,
                        borderWidth: 1,
                        borderColor: primary ? hexToRgba(c.constant, 0.45) : 'transparent',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {gUrl ? (
                        <Image source={{ uri: gUrl }} resizeMode="contain" style={{ width: 58, height: 64 }} />
                      ) : null}
                      <AppText size="xxsm" weight="black" tone={primary ? 'constant' : 'sub'}>
                        {primary ? 'PRIMARY' : 'SECONDARY'}
                      </AppText>
                      <AppText size="xsm" weight="bold" align="center" numberOfLines={1}>
                        {m}
                      </AppText>
                    </View>
                  );
                }
              )}
            </ScrollView>

            {ex.instructions ? (
              <AppText size="sm" tone="sub">
                {ex.instructions}
              </AppText>
            ) : null}
          </AppCard>

          <View style={{ gap: 10 }}>
            <AppText size="md" weight="bold">
              Logged History ({history.length})
            </AppText>
            {history.length === 0 ? (
              <AppCard>
                <AppText size="sm" tone="sub">
                  No logged sessions yet for this movement.
                </AppText>
              </AppCard>
            ) : (
              history.map((h) => (
                <AppCard key={h.postId} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText size="sm" weight="bold">
                      {h.postTitle}
                    </AppText>
                    <AppText size="xsm" tone="sub">
                      {h.completedAt.slice(0, 10)}
                    </AppText>
                  </View>
                  <AppText size="xsm" tone="constant">
                    Best 1RM: {formatWeight(h.bestE1rmKg, unit)} • {h.bestRating} SR
                  </AppText>
                  {h.sets.map((s, idx) => (
                    <AppText key={s.id} size="xsm" tone="sub">
                      Set {idx + 1}: {formatWeight(s.weightKg, unit)} × {s.reps} reps
                      {s.isPr ? '  🏆 PR' : ''}
                    </AppText>
                  ))}
                </AppCard>
              ))
            )}
          </View>
        </>
      ) : null}
    </ScreenContainer>
  );
}
