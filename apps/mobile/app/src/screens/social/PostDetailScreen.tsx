import React from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { formatDuration, formatWeight, type RankTier } from '@apexlift/shared';
import { trpc } from '../../api/trpc';
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
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';

export function PostDetailScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, 'PostDetail'>>();
  const { postId } = route.params;
  const { showAlert } = useAppAlert();
  const utils = trpc.useUtils();

  const user = useAuthStore((s) => s.user);
  const unit = user?.unitWeight ?? 'lbs';

  const postQuery = trpc.post.getById.useQuery({ id: postId });
  const deletePost = trpc.post.delete.useMutation({
    onSuccess: () => {
      utils.post.feed.invalidate();
      navigation.goBack();
    },
  });

  const post = postQuery.data;
  const isOwner = post?.userId === user?.id;

  return (
    <ScreenContainer scroll>
      <StackHeader
        title="Workout Summary"
        subtitle={post?.completedAt.slice(0, 10)}
      />

      {post ? (
        <>
          {/* Shareable Workout Card */}
          <AppCard
            style={{
              gap: 12,
              borderColor: hexToRgba(c.constant, 0.55),
              backgroundColor: c.secondBg,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <AvatarView config={post.author?.avatarConfig} size={46} />
              <View style={{ flex: 1 }}>
                <AppText size="md" weight="bold">
                  {post.author?.displayName ?? 'Athlete'}
                </AppText>
                <AppText size="xsm" tone="sub">
                  @{post.author?.username} • {post.author?.peakAverageRank}
                </AppText>
              </View>
              <AppText size="xsm" weight="black" tone="constant">
                TOP1%
              </AppText>
            </View>

            <AppText size="xl" weight="black">
              {post.title}
            </AppText>
            {post.caption ? (
              <AppText size="sm" tone="sub">
                {post.caption}
              </AppText>
            ) : null}

            <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 6 }}>
              <View style={{ alignItems: 'center' }}>
                <AppText size="md" weight="black" tone="constant">
                  {formatDuration(post.durationSeconds)}
                </AppText>
                <AppText size="xsm" tone="sub">
                  Duration
                </AppText>
              </View>
              <View style={{ alignItems: 'center' }}>
                <AppText size="md" weight="black">
                  {formatWeight(post.totalVolumeKg, unit)}
                </AppText>
                <AppText size="xsm" tone="sub">
                  Volume
                </AppText>
              </View>
              <View style={{ alignItems: 'center' }}>
                <AppText size="md" weight="black" tone="check">
                  {post.totalSets} sets
                </AppText>
                <AppText size="xsm" tone="sub">
                  Completed
                </AppText>
              </View>
            </View>
          </AppCard>

          {/* Exercise Breakdown */}
          <View style={{ gap: 10 }}>
            <AppText size="md" weight="bold">
              Logged Exercises ({post.exercises.length})
            </AppText>
            {post.exercises.map((ex) => (
              <AppCard key={ex.id} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <AppText size="md" weight="bold">
                      {ex.exerciseName}
                    </AppText>
                    <AppText size="xsm" tone="sub">
                      Best 1RM: {formatWeight(ex.bestE1rmKg, unit)} • {ex.bestRating} SR
                    </AppText>
                  </View>
                  {ex.bestRating > 0 ? (
                    <RankBadge
                      tier={ex.bestRankTier as RankTier}
                      division={ex.bestRankDivision as 0 | 1 | 2 | 3}
                      size={42}
                    />
                  ) : null}
                </View>

                {ex.sets.map((s, idx) => (
                  <View
                    key={s.id}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: RADII.input,
                      backgroundColor: c.thirdBg,
                    }}
                  >
                    <AppText size="xsm" weight="bold" tone="sub">
                      Set {idx + 1} ({s.setType})
                    </AppText>
                    <AppText size="sm" weight="bold">
                      {formatWeight(s.weightKg, unit)} × {s.reps}
                      {s.rpe ? `  @${s.rpe}` : ''}
                      {s.isPr ? '  🏆 PR' : ''}
                    </AppText>
                  </View>
                ))}
              </AppCard>
            ))}
          </View>

          {isOwner ? (
            <View style={{ gap: 10 }}>
              <AppButton
                label="Edit Past Workout & Strava Sync"
                variant="secondary"
                onPress={() => navigation.navigate('EditPost', { postId: post.id })}
                fullWidth
              />
              <AppButton
                label="Delete Workout Post"
                variant="danger"
                onPress={() =>
                  showAlert({
                    title: 'Delete workout post?',
                    message: 'This removes the post from your feed.',
                    actions: [
                      { label: 'Cancel', variant: 'secondary' },
                      {
                        label: 'Delete',
                        variant: 'danger',
                        onPress: () => deletePost.mutate({ id: post.id }),
                      },
                    ],
                  })
                }
                fullWidth
              />
            </View>
          ) : null}
        </>
      ) : null}
    </ScreenContainer>
  );
}
