import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LEAGUE_TIERS, type RankTier } from '@apexlift/shared';
import { trpc } from '../../api/trpc';
import { getLeagueBannerUrl, getSeasonCardUrl, VS_GLOW_URLS } from '../../assets/v4MediaManifest';
import {
  AppCard,
  AppText,
  AvatarView,
  RankBadge,
  ScreenContainer,
  StackHeader,
} from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import type { MainStackParamList } from '../../navigation/types';

const TIER_INDEX_TO_RANK: RankTier[] = [
  'Rookie',
  'Novice',
  'Intermediate',
  'Enthusiast',
  'Veteran',
  'Elite',
  'Champion',
  'Titan',
  'Olympian',
];

export function RankLeaguesScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  const leagueQuery = trpc.rank.getMyLeague.useQuery();
  const data = leagueQuery.data;

  const tierRank = TIER_INDEX_TO_RANK[Math.min(TIER_INDEX_TO_RANK.length - 1, data?.league.tier ?? 0)] ?? 'Rookie';
  const bannerUrl = getLeagueBannerUrl(tierRank);
  const seasonCardUrl = getSeasonCardUrl(tierRank);
  const vsGlowUrl = VS_GLOW_URLS[tierRank.toLowerCase()];

  return (
    <ScreenContainer scroll>
      <StackHeader
        title={data?.league.name ?? 'Weekly League'}
        subtitle="Top athletes promote every Sunday at midnight"
      />

      {data ? (
        <>
          {/* Sculpted APK League Banner + Season Card Showcase */}
          <AppCard
            style={{
              gap: 10,
              borderColor: hexToRgba(data.league.color, 0.65),
              alignItems: 'center',
              overflow: 'hidden',
              paddingTop: 0,
            }}
          >
            {bannerUrl ? (
              <View style={{ width: '112%', height: 112, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {vsGlowUrl ? (
                  <Image
                    source={{ uri: vsGlowUrl }}
                    resizeMode="cover"
                    style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.45 }}
                  />
                ) : null}
                <Image
                  source={{ uri: bannerUrl }}
                  resizeMode="cover"
                  style={{ width: '100%', height: '100%' }}
                />
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: -24 }}>
              <RankBadge tier={tierRank} division={1} size={66} showShine />
              <View>
                <AppText size="xsm" weight="bold" style={{ color: data.league.color }}>
                  TIER {data.league.tier + 1} OF {LEAGUE_TIERS.length}
                </AppText>
                <AppText size="xxl" weight="black">
                  {data.league.name}
                </AppText>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 16 }}>
              <AppText size="xsm" weight="bold" tone="check">
                ▲ Top {data.promoteCount} Promote
              </AppText>
              <AppText size="xsm" weight="bold" tone="danger">
                ▼ Bottom {data.demoteCount} Demote
              </AppText>
            </View>

            {/* Season Card Artwork Strip */}
            {seasonCardUrl ? (
              <View
                style={{
                  width: '100%',
                  height: 76,
                  borderRadius: RADII.input,
                  overflow: 'hidden',
                  backgroundColor: hexToRgba('#0F0A18', 0.65),
                  borderWidth: 1,
                  borderColor: hexToRgba(data.league.color, 0.4),
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  gap: 12,
                }}
              >
                <Image
                  source={{ uri: seasonCardUrl }}
                  resizeMode="contain"
                  style={{ width: 92, height: 64 }}
                />
                <View style={{ flex: 1 }}>
                  <AppText size="xsm" weight="black" style={{ color: data.league.color }}>
                    SEASON REWARD CARD
                  </AppText>
                  <AppText size="xsm" tone="sub">
                    Finish in the promotion zone to unlock the {tierRank} Season Banner & bonus Eggs!
                  </AppText>
                </View>
              </View>
            ) : null}
          </AppCard>

          <View style={{ gap: 8 }}>
            {data.standings.map((row) => {
              const zoneColor =
                row.zone === 'promote'
                  ? c.check
                  : row.zone === 'demote'
                    ? c.danger
                    : c.subText;
              return (
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
                      borderLeftWidth: 4,
                      borderLeftColor: zoneColor,
                    }}
                  >
                    <AppText size="md" weight="black" style={{ width: 26, textAlign: 'center', color: zoneColor }}>
                      #{row.position}
                    </AppText>
                    <AvatarView config={row.avatarConfig} size={40} />
                    <View style={{ flex: 1 }}>
                      <AppText size="sm" weight="bold">
                        {row.displayName} {row.isSelf ? '(You)' : ''}
                      </AppText>
                      <AppText size="xsm" tone="sub">
                        @{row.username} • {row.peakAverageRank}
                      </AppText>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <AppText size="sm" weight="black" tone="constant">
                        {row.weeklyXp} XP
                      </AppText>
                      <View
                        style={{
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: RADII.pill,
                          backgroundColor: hexToRgba(zoneColor, 0.16),
                        }}
                      >
                        <AppText size="xsm" weight="bold" style={{ color: zoneColor, fontSize: 10 }}>
                          {row.zone.toUpperCase()}
                        </AppText>
                      </View>
                    </View>
                  </AppCard>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </ScreenContainer>
  );
}
