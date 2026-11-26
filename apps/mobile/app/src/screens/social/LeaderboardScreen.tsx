import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RankTier } from '@apexlift/shared';
import { trpc } from '../../api/trpc';
import {
  AppCard,
  AppText,
  AvatarView,
  RankBadge,
  ScreenContainer,
  SegmentedControl,
  StackHeader,
} from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import type { MainStackParamList } from '../../navigation/types';

export function LeaderboardScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, 'Leaderboard'>>();

  const [category, setCategory] = useState<'ranks' | 'streaks' | 'levels' | 'exercise'>(
    route.params?.initialCategory ?? 'ranks'
  );
  const [scope, setScope] = useState<'global' | 'friends'>('global');
  const [exerciseId, setExerciseId] = useState('ex_bench_press');

  const demoExQuery = trpc.rank.listDemoExercises.useQuery();
  const boardQuery = trpc.leaderboard.getBoard.useQuery({
    category,
    scope,
    exerciseId: category === 'exercise' ? exerciseId : undefined,
  });

  const rows = boardQuery.data?.rows ?? [];
  const selfRow = boardQuery.data?.selfRow ?? null;

  return (
    <ScreenContainer scroll>
      <StackHeader title="Leaderboards" subtitle="Compete globally or against your gym crew" />

      <SegmentedControl
        value={category}
        onChange={setCategory}
        options={[
          { label: 'Ranks', value: 'ranks' },
          { label: 'Streaks', value: 'streaks' },
          { label: 'Levels', value: 'levels' },
          { label: 'Lift', value: 'exercise' },
        ]}
      />

      <SegmentedControl
        value={scope}
        onChange={setScope}
        options={[
          { label: 'Global', value: 'global' },
          { label: 'Friends', value: 'friends' },
        ]}
      />

      {category === 'exercise' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(demoExQuery.data ?? []).map((ex) => {
            const active = ex.id === exerciseId;
            return (
              <Pressable
                key={ex.id}
                onPress={() => setExerciseId(ex.id)}
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
                  {ex.name}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {/* Top 3 Podium */}
      {rows.length >= 3 ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 6 }}>
          {[rows[1], rows[0], rows[2]].map((r, idx) => {
            const isFirst = idx === 1;
            const medalColor = isFirst ? '#F59E0B' : idx === 0 ? '#CBD5E1' : '#D3834B';
            return (
              <Pressable
                key={r.userId}
                onPress={() =>
                  navigation.navigate('PublicProfile', { userIdOrUsername: r.userId })
                }
                style={{
                  flex: 1,
                  alignItems: 'center',
                  backgroundColor: c.secondBg,
                  borderRadius: RADII.card,
                  paddingVertical: isFirst ? 18 : 12,
                  paddingHorizontal: 8,
                  borderWidth: 1.5,
                  borderColor: medalColor,
                  gap: 5,
                }}
              >
                <AppText size="sm" weight="black" style={{ color: medalColor }}>
                  #{r.position}
                </AppText>
                <AvatarView config={r.avatarConfig} size={isFirst ? 56 : 46} borderColor={medalColor} />
                <AppText size="xsm" weight="bold" numberOfLines={1}>
                  {r.displayName}
                </AppText>
                <AppText size="sm" weight="black" tone="constant">
                  {r.scoreLabel}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Standings List */}
      <View style={{ gap: 8 }}>
        {rows.map((row) => (
          <Pressable
            key={row.userId}
            onPress={() =>
              navigation.navigate('PublicProfile', { userIdOrUsername: row.userId })
            }
          >
            <AppCard
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
                borderColor: row.isSelf ? c.constant : c.thirdBg,
              }}
            >
              <AppText size="md" weight="black" style={{ width: 28, textAlign: 'center' }}>
                #{row.position}
              </AppText>
              <AvatarView config={row.avatarConfig} size={40} />
              <View style={{ flex: 1 }}>
                <AppText size="sm" weight="bold">
                  {row.displayName} {row.isSelf ? '(You)' : ''}
                </AppText>
                <AppText size="xsm" tone="sub">
                  @{row.username} • {row.rankLabel}
                </AppText>
              </View>
              <RankBadge
                tier={row.rankTier as RankTier}
                division={row.rankDivision as 0 | 1 | 2 | 3}
                size={34}
              />
              <AppText size="sm" weight="black" tone="constant">
                {row.scoreLabel}
              </AppText>
            </AppCard>
          </Pressable>
        ))}
      </View>

      {/* Self Standing Card */}
      {selfRow ? (
        <AppCard
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderColor: c.constant,
            backgroundColor: hexToRgba(c.constant, 0.14),
          }}
        >
          <AppText size="sm" weight="bold">
            Your Position: #{selfRow.position}
          </AppText>
          <AppText size="sm" weight="black" tone="constant">
            {selfRow.scoreLabel}
          </AppText>
        </AppCard>
      ) : null}
    </ScreenContainer>
  );
}
