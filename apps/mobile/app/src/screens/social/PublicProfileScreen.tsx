import React from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ratingToRank, type RankTier } from '@apexlift/shared';
import { trpc } from '../../api/trpc';
import { MuscleBodygraphSvg } from '../../components/rank/MuscleBodygraphSvg';
import {
  AppButton,
  AppCard,
  AppText,
  AvatarView,
  RankBadge,
  ScreenContainer,
  StackHeader,
  useAppAlert,
} from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import type { MainStackParamList } from '../../navigation/types';

export function PublicProfileScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, 'PublicProfile'>>();
  const { userIdOrUsername } = route.params;
  const { showAlert } = useAppAlert();
  const utils = trpc.useUtils();

  const profileQuery = trpc.friends.getPublicProfile.useQuery({ userIdOrUsername });
  const profile = profileQuery.data;

  const muscleMapQuery = trpc.rank.getMuscleMap.useQuery(
    { userId: profile?.id },
    { enabled: Boolean(profile?.id) }
  );

  const sendReq = trpc.friends.sendRequest.useMutation({
    onSuccess: () => showAlert({ title: 'Request Sent', message: 'Friend request delivered!' }),
  });

  const removeFriend = trpc.friends.removeFriend.useMutation({
    onSuccess: () => {
      utils.friends.getPublicProfile.invalidate({ userIdOrUsername });
      utils.friends.list.invalidate();
    },
  });

  const rankInfo = ratingToRank(profile?.peakAverageRating ?? 0);

  return (
    <ScreenContainer scroll>
      <StackHeader
        title={profile?.displayName ?? 'Athlete Profile'}
        subtitle={profile ? `@${profile.username}` : undefined}
      />

      {profile ? (
        <>
          <AppCard
            style={{
              alignItems: 'center',
              gap: 10,
              borderColor: hexToRgba(c.constant, 0.5),
            }}
          >
            <AvatarView config={profile.avatarConfig} size={86} borderColor={c.constant} />
            <AppText size="xl" weight="black">
              {profile.displayName}
            </AppText>
            <AppText size="sm" tone="sub">
              @{profile.username} • {profile.peakAverageRank}
            </AppText>
            {profile.bio ? (
              <AppText size="sm" tone="sub" align="center">
                {profile.bio}
              </AppText>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 18, marginTop: 4 }}>
              <View style={{ alignItems: 'center' }}>
                <AppText size="md" weight="black" tone="constant">
                  {profile.totalWorkouts}
                </AppText>
                <AppText size="xsm" tone="sub">
                  Workouts
                </AppText>
              </View>
              <View style={{ alignItems: 'center' }}>
                <AppText size="md" weight="black" style={{ color: '#F59E0B' }}>
                  {profile.streaks}d
                </AppText>
                <AppText size="xsm" tone="sub">
                  Streak
                </AppText>
              </View>
              <View style={{ alignItems: 'center' }}>
                <AppText size="md" weight="black" tone="check">
                  {profile.peakAverageRating} SR
                </AppText>
                <AppText size="xsm" tone="sub">
                  Rating
                </AppText>
              </View>
            </View>

            {!profile.isSelf ? (
              <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginTop: 6 }}>
                {profile.isFriend ? (
                  <AppButton
                    label="Remove Friend"
                    variant="secondary"
                    size="sm"
                    onPress={() => removeFriend.mutate({ friendId: profile.id })}
                    style={{ flex: 1 }}
                  />
                ) : (
                  <AppButton
                    label="Add Friend"
                    size="sm"
                    onPress={() => sendReq.mutate({ targetUserId: profile.id })}
                    style={{ flex: 1 }}
                  />
                )}
                <AppButton
                  label="Inspect Bodygraph"
                  variant="secondary"
                  size="sm"
                  onPress={() =>
                    navigation.navigate('Bodygraph', {
                      userId: profile.id,
                      displayName: profile.displayName,
                    })
                  }
                  style={{ flex: 1 }}
                />
              </View>
            ) : null}
          </AppCard>

          <AppCard style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText size="md" weight="bold">
                Muscle Mastery
              </AppText>
              <RankBadge tier={rankInfo.tier as RankTier} division={rankInfo.division} size={40} />
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-around',
                backgroundColor: c.thirdBg,
                borderRadius: RADII.card,
                paddingVertical: 10,
              }}
            >
              <MuscleBodygraphSvg
                muscles={muscleMapQuery.data?.muscles ?? {}}
                side="front"
                height={170}
              />
              <MuscleBodygraphSvg
                muscles={muscleMapQuery.data?.muscles ?? {}}
                side="back"
                height={170}
              />
            </View>
          </AppCard>
        </>
      ) : null}
    </ScreenContainer>
  );
}
