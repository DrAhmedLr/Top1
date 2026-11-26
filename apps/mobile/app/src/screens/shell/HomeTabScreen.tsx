import React, { useState } from 'react';
import { Animated, Image, Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { formatDuration, formatWeight, ratingToRank, type RankTier } from '@apexlift/shared';
import { trpc } from '../../api/trpc';
import { MuscleBodygraphSvg, type MuscleRankEntry } from '../../components/rank/MuscleBodygraphSvg';
import { CommentModal } from '../../components/social/CommentModal';
import { ShareCardModal } from '../../components/social/ShareCardModal';
import {
  AppButton,
  AppCard,
  AppText,
  AvatarView,
  RankBadge,
  ScreenContainer,
  SegmentedControl,
} from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { useLocale } from '../../i18n/LocaleProvider';
import { useWorkoutPhotosStore } from '../../stores/workoutPhotosStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useBumpSpring } from '../../theme/animations';
import { RANK_BG_GRADIENTS, RANK_SOLID_ACCENT } from '../../theme/rankGradients';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import { impactLight } from '../../utils/haptics';
import { playSound } from '../../utils/soundscape';
import type { MainStackParamList } from '../../navigation/types';

const REACTIONS = ['🔥', '💪', '🏆', '👏'];

function ReactionPill({
  emoji,
  count,
  active,
  onPress,
}: {
  emoji: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { scale, bump } = useBumpSpring();

  return (
    <Pressable
      onPress={() => {
        bump(1.3);
        onPress();
      }}
    >
      <Animated.View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: RADII.pill,
          backgroundColor: active ? hexToRgba(c.constant, 0.24) : c.thirdBg,
          borderWidth: 1,
          borderColor: active ? c.constant : 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          transform: [{ scale }],
        }}
      >
        <AppText size="xsm">{emoji}</AppText>
        {count > 0 ? (
          <AppText size="xsm" weight="bold" tone={active ? 'constant' : 'sub'}>
            {count}
          </AppText>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

function buildHeatmapMap(heatmap: Record<string, number>): Record<string, MuscleRankEntry> {
  const out: Record<string, MuscleRankEntry> = {};
  for (const [muscle, rating] of Object.entries(heatmap)) {
    const info = ratingToRank(rating);
    out[muscle] = {
      muscle,
      rating,
      tier: info.tier,
      division: info.division,
      label: info.label,
      topExerciseName: null,
      topExerciseId: null,
      exerciseCount: 1,
    };
  }
  return out;
}

export function HomeTabScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { locale, l } = useLocale();
  const localeIdx = locale === 'fr' ? 1 : locale === 'ar' ? 2 : 0;
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const utils = trpc.useUtils();

  const user = useAuthStore((s) => s.user);
  const unit = user?.unitWeight ?? 'lbs';
  const session = useWorkoutStore((s) => s.session);
  const startEmpty = useWorkoutStore((s) => s.startEmpty);
  const openSheet = useWorkoutStore((s) => s.openSheet);
  const photosByPostId = useWorkoutPhotosStore((s) => s.photosByPostId);

  const [scope, setScope] = useState<'all' | 'friends' | 'mine'>('all');
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [sharePost, setSharePost] = useState<{
    title: string;
    authorName: string;
    durationSeconds: number;
    totalVolumeKg: number;
    totalSets: number;
    prCount: number;
    workedMuscles: string[];
  } | null>(null);

  const top1Query = trpc.top1.getOverview.useQuery();
  const coachProgramsQuery = trpc.coach.listPrograms.useQuery();
  const feedQuery = trpc.post.feed.useQuery({ scope, limit: 25 });
  const notifQuery = trpc.notifications.list.useQuery();
  const reactMutation = trpc.postInteractions.upsertReaction.useMutation({
    onSuccess: () => utils.post.feed.invalidate(),
  });

  const unreadCount = notifQuery.data?.unreadCount ?? 0;
  const posts = feedQuery.data ?? [];
  const top1 = top1Query.data;
  const selfRank = ratingToRank(user?.peakAverageRating ?? 0);
  const selfTier = (top1?.badge.badgeTier ?? selfRank.tier) as RankTier;
  const selfDivision = top1?.badge.division ?? selfRank.division;
  const selfAccent = RANK_SOLID_ACCENT[selfTier] ?? c.constant;

  return (
    <ScreenContainer
      scroll
      refreshing={top1Query.isRefetching || feedQuery.isRefetching}
      onRefresh={() => {
        void top1Query.refetch();
        void coachProgramsQuery.refetch();
        void feedQuery.refetch();
      }}
    >
      {/* Top Bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => navigation.navigate('BottomNavTabs', { screen: 'ProfileTab' })}>
            <AvatarView
              config={user?.avatarConfig}
              borderId={user?.equippedBorderId}
              presetKey={user?.rankingSex === 'Female' ? 'femalev31' : 'malev31'}
              size={40}
            />
          </Pressable>
          <View>
            <AppText size="xsm" weight="xbold" tone="constant" style={{ letterSpacing: 1 }}>
              TOP1%
            </AppText>
            <AppText size="lg" weight="black">
              {user?.displayName ?? 'Athlete'}
            </AppText>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => navigation.navigate('Friends')}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: c.secondBg,
              borderWidth: 1,
              borderColor: hexToRgba('#FFFFFF', 0.08),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="people-outline" size={20} color={c.text} />
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Leaderboard', { initialCategory: 'ranks' })}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: c.secondBg,
              borderWidth: 1,
              borderColor: hexToRgba('#FFFFFF', 0.08),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="podium-outline" size={20} color={c.constant} />
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('NotificationCenter')}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: c.secondBg,
              borderWidth: 1,
              borderColor: hexToRgba('#FFFFFF', 0.08),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="notifications-outline" size={20} color={c.text} />
            {unreadCount > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 9,
                  height: 9,
                  borderRadius: 99,
                  backgroundColor: c.danger,
                }}
              />
            ) : null}
          </Pressable>
        </View>
      </View>

      {/* Flagship TOP1% Overall Performance & Readiness Hero Card */}
      <AppCard
        gradientColors={RANK_BG_GRADIENTS[selfTier]}
        glowColor={selfAccent}
        style={{ gap: 14 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <Pressable
            onPress={() => navigation.navigate('BottomNavTabs', { screen: 'RanksTab' })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 190 }}
          >
            <RankBadge tier={selfTier} division={selfDivision} size={58} showShine />
            <View>
              <AppText size="xsm" weight="bold" style={{ color: selfAccent }}>
                {l('OVERALL TOP1% STANDING', 'CLASSEMENT TOP1%', 'ترتيب TOP1% العام')}
              </AppText>
              <AppText size="lg" weight="black">
                {top1?.overall.overall
                  ? `${top1.badge.topLabel} • ${top1.badge.tierName}`
                  : selfRank.label}
              </AppText>
              <AppText size="xsm" tone="sub">
                {top1?.scientific.ready
                  ? `${l('Model Score', 'Score scientifique', 'النتيجة العلمية')}: ${top1.scientific.modelScore}/100 • ${top1.overall.coverage}/4 areas`
                  : `${user?.peakAverageRating ?? 0} SR`}
              </AppText>
            </View>
          </Pressable>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={() => navigation.navigate('WearableReadiness')}
              style={{ alignItems: 'center', gap: 2 }}
            >
              <Ionicons
                name={top1?.wearable.illnessOrOverreachingFlag ? 'warning' : 'heart-circle-outline'}
                size={22}
                color={top1?.wearable.illnessOrOverreachingFlag ? c.danger : c.check}
              />
              <AppText size="xsm" weight="black">
                {top1 ? `${top1.physiology.systemicReadiness.score}%` : '—'}
              </AppText>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('StreaksAndReports')}
              style={{
                paddingHorizontal: 11,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: 'rgba(15,10,24,0.55)',
                borderWidth: 1,
                borderColor: hexToRgba('#F59E0B', 0.4),
                alignItems: 'center',
              }}
            >
              <AppText size="md" weight="black" style={{ color: '#F59E0B' }}>
                {user?.streaks ?? 0}d 🔥
              </AppText>
              <AppText size="xsm" tone="sub">
                Streak
              </AppText>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('ShopAndInventory')}
              style={{
                paddingHorizontal: 11,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: 'rgba(15,10,24,0.55)',
                borderWidth: 1,
                borderColor: hexToRgba(c.check, 0.35),
                alignItems: 'center',
              }}
            >
              <AppText size="md" weight="black" tone="check">
                {user?.credits ?? 0}
              </AppText>
              <AppText size="xsm" tone="sub">
                Credits
              </AppText>
            </Pressable>
          </View>
        </View>

        {/* 4 Competitive Areas Quick Bar */}
        {top1 ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {top1.areas.map((a) => (
              <Pressable
                key={a.area}
                onPress={() => navigation.navigate('BenchmarkLab', { initialPillar: 'strength' })}
                style={{
                  flex: 1,
                  paddingVertical: 6,
                  paddingHorizontal: 6,
                  borderRadius: 10,
                  backgroundColor: 'rgba(15,10,24,0.55)',
                  borderWidth: 1,
                  borderColor: hexToRgba(a.meta.color, 0.35),
                  alignItems: 'center',
                }}
              >
                <AppText size="xxsm" tone="sub">
                  {a.meta.label[localeIdx]}
                </AppText>
                <AppText size="xsm" weight="black" style={{ color: a.meta.color }}>
                  {a.tier ? `Top ${a.tier}` : '—'}
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Active Adaptive Program — Live Probability of Reach % */}
        {coachProgramsQuery.data?.programs?.[0] ? (() => {
          const prog = coachProgramsQuery.data!.programs[0];
          const prob =
            prog.forecast.kind === 'ready' ? Math.round(prog.forecast.probability * 100) : null;
          return (
            <Pressable
              onPress={() => navigation.navigate('CoachHub', { initialTab: 'goals' })}
              style={{
                padding: 10,
                borderRadius: 12,
                backgroundColor: 'rgba(15,10,24,0.62)',
                borderWidth: 1,
                borderColor: hexToRgba(c.constant, 0.4),
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <AppText size="xxsm" weight="xbold" tone="constant">
                  ADAPTIVE PROGRAM • {prog.metricName.toUpperCase()}
                </AppText>
                <AppText size="xsm" tone="sub">
                  {prog.current} → {prog.target} {prog.unit} by {prog.deadline}
                </AppText>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <AppText size="md" weight="black" style={{ color: c.check }}>
                  {prob !== null ? `${prob}%` : `${prog.prescription.sets}×${prog.prescription.amount}`}
                </AppText>
                <AppText size="xxsm" tone="sub">
                  {prob !== null ? 'Reach Prob.' : 'Next Session'}
                </AppText>
              </View>
            </Pressable>
          );
        })() : null}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <AppButton
            label={session ? 'Resume Workout' : 'Start Workout'}
            variant={session ? 'check' : 'primary'}
            size="sm"
            onPress={() => (session ? openSheet() : startEmpty('Daily Training'))}
            style={{ flex: 1.5 }}
          />
          <AppButton
            label="Recap"
            size="sm"
            variant="gold"
            onPress={() => navigation.navigate('RecapStories')}
            style={{ flex: 0.85 }}
          />
        </View>
      </AppCard>

      {/* Live TOP1% Adaptive Coach Decision Card */}
      {top1?.coachDecision ? (
        <Pressable onPress={() => navigation.navigate('CoachHub')}>
          <AppCard glowColor={c.constant} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="compass" size={18} color={c.constant} />
                <AppText size="xsm" weight="xbold" tone="constant">
                  {l('TODAY’S TOP1% COACH', 'COACH TOP1% DU JOUR', 'مدرب TOP1% اليوم')}
                </AppText>
              </View>
              <View
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 3,
                  borderRadius: 99,
                  backgroundColor: hexToRgba(c.constant, 0.2),
                }}
              >
                <AppText size="xxsm" weight="black" tone="constant" style={{ textTransform: 'uppercase' }}>
                  {top1.coachDecision.action}
                </AppText>
              </View>
            </View>
            <AppText size="sm" weight="bold">
              {top1.coachDecision.athleteSentence[localeIdx]}
            </AppText>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText size="xsm" tone="sub">
                {top1.coachDecision.recommended
                  ? `${top1.coachDecision.recommended.exercise[localeIdx]} • ${top1.coachDecision.recommended.sets}×${top1.coachDecision.recommended.amount} (${top1.coachDecision.recommended.totalMinutes}m)`
                  : l('Tap to adjust time, equipment or discomfort', 'Touchez pour ajuster', 'اضغط للتعديل')}
              </AppText>
              <Ionicons name="chevron-forward" size={18} color={c.constant} />
            </View>
          </AppCard>
        </Pressable>
      ) : null}

      {/* Feed Scope Filter */}
      <SegmentedControl
        value={scope}
        onChange={setScope}
        options={[
          { label: 'All Feed', value: 'all' },
          { label: 'Friends', value: 'friends' },
          { label: 'My Logs', value: 'mine' },
        ]}
      />

      {/* Social Feed Cards */}
      <View style={{ gap: 14 }}>
        {posts.length === 0 ? (
          <AppCard style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
            <AppText size="md" weight="bold">
              No workouts in this feed yet
            </AppText>
            <AppText size="sm" tone="sub" align="center">
              Log your first session or add friends to see ranked workouts here.
            </AppText>
          </AppCard>
        ) : (
          posts.map((post) => {
            const heatmapMap = buildHeatmapMap(post.muscleHeatmap ?? {});
            const hasHeatmap = Object.keys(heatmapMap).length > 0;
            const authorPreset =
              post.author?.username === 'maya_strong'
                ? 'femalev32'
                : post.author?.username === 'marcus_pr'
                  ? 'malev33'
                  : post.author?.username === 'elena_fit'
                    ? 'femalev34'
                    : 'malev31';

            return (
              <AppCard key={post.id} style={{ gap: 12 }}>
                {/* Author Row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Pressable
                    onPress={() => {
                      if (post.author) {
                        navigation.navigate('PublicProfile', {
                          userIdOrUsername: post.author.id,
                        });
                      }
                    }}
                  >
                    <AvatarView
                      config={post.author?.avatarConfig}
                      borderId={post.author?.equippedBorderId}
                      presetKey={authorPreset}
                      size={40}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (post.author) {
                        navigation.navigate('PublicProfile', {
                          userIdOrUsername: post.author.id,
                        });
                      }
                    }}
                    style={{ flex: 1 }}
                  >
                    <AppText size="sm" weight="xbold">
                      {post.author?.displayName ?? 'Lifter'}{' '}
                      <AppText size="xsm" tone="sub">
                        @{post.author?.username ?? 'athlete'}
                      </AppText>
                    </AppText>
                    <AppText size="xsm" tone="sub">
                      {post.author?.peakAverageRank ?? 'Ranked'} • {post.completedAt.slice(0, 10)}
                    </AppText>
                  </Pressable>
                  <View
                    style={{
                      paddingHorizontal: 9,
                      paddingVertical: 4,
                      borderRadius: RADII.pill,
                      backgroundColor: hexToRgba(c.constant, 0.16),
                      borderWidth: 1,
                      borderColor: hexToRgba(c.constant, 0.35),
                    }}
                  >
                    <AppText size="xsm" weight="xbold" tone="constant">
                      +{post.xpEarned} XP
                    </AppText>
                  </View>
                </View>

                {/* Post Body + Embedded Anatomical Mini Bodygraph */}
                <Pressable
                  onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                  style={{ gap: 10 }}
                >
                  <View>
                    <AppText size="lg" weight="black">
                      {post.title}
                    </AppText>
                    {post.caption ? (
                      <AppText size="sm" tone="sub" style={{ marginTop: 2 }}>
                        {post.caption}
                      </AppText>
                    ) : null}
                  </View>

                  {(photosByPostId[post.id]?.length ?? 0) > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {(photosByPostId[post.id] ?? []).map((uri, idx) => (
                        <Image
                          key={`${post.id}_ph_${idx}`}
                          source={{ uri }}
                          resizeMode="cover"
                          style={{
                            width: 140,
                            height: 105,
                            borderRadius: RADII.input,
                            borderWidth: 1,
                            borderColor: hexToRgba('#FFFFFF', 0.14),
                          }}
                        />
                      ))}
                    </ScrollView>
                  ) : null}

                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-around',
                      paddingVertical: 9,
                      paddingHorizontal: 10,
                      borderRadius: RADII.input,
                      backgroundColor: 'rgba(10, 7, 20, 0.45)',
                      borderWidth: 1,
                      borderColor: hexToRgba('#FFFFFF', 0.06),
                    }}
                  >
                    <AppText size="xsm" weight="bold">
                      ⏱ {formatDuration(post.durationSeconds)}
                    </AppText>
                    <AppText size="xsm" weight="bold" tone="constant">
                      🏋️ {formatWeight(post.totalVolumeKg, unit)}
                    </AppText>
                    <AppText size="xsm" weight="bold" tone="check">
                      ✓ {post.totalSets} sets
                    </AppText>
                  </View>

                  {/* Exercises + Mini Anatomical Muscle Heatmap Side-by-Side */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      {post.exercises.slice(0, 3).map((ex) => {
                        const tier = (ex.bestRankTier || 'Unranked') as RankTier;
                        const tierColor = RANK_SOLID_ACCENT[tier] ?? c.subText;
                        return (
                          <View
                            key={ex.id}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8,
                              paddingVertical: 4,
                              paddingHorizontal: 8,
                              borderRadius: 10,
                              backgroundColor: hexToRgba(c.thirdBg, 0.55),
                            }}
                          >
                            {ex.bestRating > 0 ? (
                              <RankBadge
                                tier={tier}
                                division={ex.bestRankDivision as 0 | 1 | 2 | 3}
                                size={24}
                              />
                            ) : null}
                            <View style={{ flex: 1 }}>
                              <AppText size="xsm" weight="bold" numberOfLines={1}>
                                {ex.exerciseName}
                              </AppText>
                              <AppText size="xsm" style={{ color: tierColor, fontSize: 10 }}>
                                {ex.sets.length} sets
                                {ex.bestRating > 0 ? ` • ${ex.bestRating} SR` : ''}
                              </AppText>
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    {hasHeatmap ? (
                      <View
                        style={{
                          padding: 6,
                          borderRadius: 12,
                          backgroundColor: 'rgba(10, 7, 20, 0.45)',
                          borderWidth: 1,
                          borderColor: hexToRgba('#FFFFFF', 0.06),
                        }}
                      >
                        <MuscleBodygraphSvg muscles={heatmapMap} side="front" height={106} />
                      </View>
                    ) : null}
                  </View>
                </Pressable>

                {/* Spring-Pop Reactions + Comment Bar */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: hexToRgba('#FFFFFF', 0.07),
                  }}
                >
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {REACTIONS.map((emoji) => (
                      <ReactionPill
                        key={emoji}
                        emoji={emoji}
                        active={post.myReaction === emoji}
                        count={post.reactionCounts[emoji] ?? 0}
                        onPress={() => {
                          impactLight();
                          playSound('tick', 0.45);
                          reactMutation.mutate({ postId: post.id, reactionKey: emoji });
                        }}
                      />
                    ))}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable
                      onPress={() => {
                        playSound('stat_card_1', 0.6);
                        setSharePost({
                          title: post.title,
                          authorName: post.author?.username ?? 'athlete',
                          durationSeconds: post.durationSeconds,
                          totalVolumeKg: post.totalVolumeKg,
                          totalSets: post.totalSets,
                          prCount: post.exercises.filter((e) => e.bestRating > 0).length,
                          workedMuscles: Object.keys(post.muscleHeatmap ?? {}),
                        });
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: 9,
                        paddingVertical: 5,
                        borderRadius: RADII.pill,
                        backgroundColor: c.thirdBg,
                      }}
                    >
                      <Ionicons name="share-outline" size={14} color={c.constant} />
                    </Pressable>

                    <Pressable
                      onPress={() => setActiveCommentPostId(post.id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: RADII.pill,
                        backgroundColor: c.thirdBg,
                      }}
                    >
                      <Ionicons name="chatbubble-outline" size={14} color={c.subText} />
                      <AppText size="xsm" weight="bold" tone="sub">
                        {post.commentCount}
                      </AppText>
                    </Pressable>
                  </View>
                </View>
              </AppCard>
            );
          })
        )}
      </View>

      <CommentModal
        postId={activeCommentPostId}
        onClose={() => setActiveCommentPostId(null)}
      />

      {sharePost ? (
        <ShareCardModal
          visible={Boolean(sharePost)}
          onClose={() => setSharePost(null)}
          title={sharePost.title}
          authorName={sharePost.authorName}
          durationSeconds={sharePost.durationSeconds}
          totalVolumeKg={sharePost.totalVolumeKg}
          totalSets={sharePost.totalSets}
          prCount={sharePost.prCount}
          unit={unit}
          workedMuscles={
            sharePost.workedMuscles.length > 0
              ? sharePost.workedMuscles
              : ['Upper Chest', 'Lower Chest', 'Triceps', 'Front Delt']
          }
        />
      ) : null}
    </ScreenContainer>
  );
}
