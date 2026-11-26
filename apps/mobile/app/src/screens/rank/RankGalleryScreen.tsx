import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatWeight, RANK_COLORS, RANK_DISPLAY_NAMES, RANK_TIERS, type RankTier } from '@apexlift/shared';
import { trpc } from '../../api/trpc';
import { RankProgressBar } from '../../components/rank/RankProgressBar';
import { AppCard, AppText, RankBadge, ScreenContainer, StackHeader } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import type { MainStackParamList } from '../../navigation/types';

export function RankGalleryScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const unit = user?.unitWeight ?? 'lbs';

  const [tierFilter, setTierFilter] = useState<string>('All');
  const ranksQuery = trpc.rank.getMyRanks.useQuery();
  const ranks = ranksQuery.data ?? [];

  const filtered =
    tierFilter === 'All' ? ranks : ranks.filter((r) => r.rankTier === tierFilter);

  return (
    <ScreenContainer scroll>
      <StackHeader
        title="Rank Gallery"
        subtitle={`${ranks.length} ranked exercises unlocked`}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {['All', ...RANK_TIERS.filter((t) => t !== 'Unranked')].map((t) => {
          const active = tierFilter === t;
          const display = t === 'All' ? 'All' : RANK_DISPLAY_NAMES[t as RankTier];
          return (
            <Pressable
              key={t}
              onPress={() => setTierFilter(t)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: RADII.pill,
                backgroundColor: active ? hexToRgba(c.constant, 0.2) : c.secondBg,
                borderWidth: 1,
                borderColor: active ? c.constant : c.thirdBg,
              }}
            >
              <AppText size="xsm" weight="bold" tone={active ? 'constant' : 'default'}>
                {display}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ gap: 10 }}>
        {filtered.length === 0 ? (
          <AppCard>
            <AppText size="sm" tone="sub">
              No exercises in this tier yet. Log heavy sets to climb!
            </AppText>
          </AppCard>
        ) : (
          filtered.map((item) => {
            const tierColor = RANK_COLORS[item.rankTier as RankTier]?.primary ?? c.constant;
            return (
              <Pressable
                key={item.id}
                onPress={() =>
                  navigation.navigate('ExerciseDetail', { exerciseId: item.exerciseId })
                }
              >
                <AppCard style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <RankBadge
                      tier={item.rankTier as RankTier}
                      division={item.rankDivision as 0 | 1 | 2 | 3}
                      size={54}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText size="md" weight="bold">
                        {item.exerciseName}
                      </AppText>
                      <AppText size="sm" weight="bold" style={{ color: tierColor }}>
                        {item.rankLabel} • {item.peakRating} SR
                      </AppText>
                      <AppText size="xsm" tone="sub">
                        Peak 1RM: {formatWeight(item.peakE1rmKg, unit)} • Next rank 5RM:{' '}
                        {formatWeight(item.nextTarget5RepKg, unit)}
                      </AppText>
                    </View>
                  </View>

                  <RankProgressBar
                    tier={item.rankTier as RankTier}
                    progress={item.progressToNext}
                    height={8}
                  />
                </AppCard>
              </Pressable>
            );
          })
        )}
      </View>
    </ScreenContainer>
  );
}
