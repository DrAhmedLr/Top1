import React, { useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { formatDuration, formatWeight, type RankTier } from '@apexlift/shared';
import { trpc } from '../../api/trpc';
import { V4_UI_URLS } from '../../assets/v4MediaManifest';
import { ConfettiOverlay, RankUpCinematicModal } from '../../components/fx';
import { JymboRive } from '../../components/mascot';
import {
  AppButton,
  AppCard,
  AppInput,
  AppModal,
  AppText,
  RankBadge,
  ScreenContainer,
  SegmentedControl,
  StackHeader,
  useAppAlert,
} from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { useWorkoutPhotosStore } from '../../stores/workoutPhotosStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import { impactLight } from '../../utils/haptics';
import { playSound } from '../../utils/soundscape';
import type { MainStackParamList } from '../../navigation/types';

const QUICK_GYM_PHOTOS = [
  { label: 'Gym Floor', uri: V4_UI_URLS.day_zero_gym },
  { label: 'Iron Protocol', uri: V4_UI_URLS.plan_strength_iron_protocol },
  { label: 'Mass Session', uri: V4_UI_URLS.plan_muscle_mass_overdrive },
  { label: 'Garage PR', uri: V4_UI_URLS.day_zero_garage },
];

export function SaveWorkoutScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { showAlert } = useAppAlert();
  const utils = trpc.useUtils();

  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const unit = user?.unitWeight ?? 'lbs';

  const session = useWorkoutStore((s) => s.session);
  const resetSession = useWorkoutStore((s) => s.resetSession);
  const setPostPhotos = useWorkoutPhotosStore((s) => s.setPostPhotos);

  const [title, setTitle] = useState(session?.title ?? 'Workout Session');
  const [caption, setCaption] = useState('');
  const [notes, setNotes] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>('public');
  const [photos, setPhotos] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileInputRef = useRef<any>(null);

  const [recap, setRecap] = useState<{
    postId: string;
    totalVolumeKg: number;
    totalSets: number;
    xpEarned: number;
    creditsEarned: number;
    prCount: number;
    newStreak: number;
    newOverallRank: string;
    newOverallRating: number;
    rankUps: Array<{
      exerciseId: string;
      exerciseName: string;
      oldLabel: string;
      newLabel: string;
      newTier: string;
      newDivision: number;
    }>;
  } | null>(null);

  const [rankUpCinematic, setRankUpCinematic] = useState<{
    exerciseName: string;
    oldLabel: string;
    newLabel: string;
    tier: RankTier;
    division: number;
  } | null>(null);

  const createPost = trpc.post.create.useMutation({
    onSuccess: async (res) => {
      if (photos.length > 0) {
        setPostPhotos(res.postId, photos);
      }
      setRecap(res);
      playSound('eggs_gained');
      if (res.rankUps.length > 0) {
        const top = res.rankUps[0];
        setRankUpCinematic({
          exerciseName: top.exerciseName,
          oldLabel: top.oldLabel,
          newLabel: top.newLabel,
          tier: top.newTier as RankTier,
          division: top.newDivision,
        });
      }
      resetSession();
      utils.post.feed.invalidate();
      utils.rank.getMyRanks.invalidate();
      utils.rank.getMuscleMap.invalidate();
      utils.gamification.getWeeklyReport.invalidate();
      utils.gamification.getQuests.invalidate();
      utils.gamification.listGoals.invalidate();
      try {
        const fresh = await utils.user.me.fetch();
        setUser(fresh);
      } catch {
        // non-blocking refresh
      }
    },
    onError: (err) => {
      showAlert({ title: 'Could not save workout', message: err.message });
    },
  });

  const addPhotoUri = (uri: string) => {
    impactLight();
    playSound('tick', 0.4);
    setPhotos((prev) => (prev.length >= 4 || prev.includes(uri) ? prev : [...prev, uri]));
  };

  const removePhoto = (idx: number) => {
    impactLight();
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFileChange = (event: any) => {
    const files: FileList | undefined = event?.target?.files;
    if (!files || files.length === 0) return;
    const remaining = Math.max(0, 4 - photos.length);
    const chosen = Array.from(files).slice(0, remaining);
    for (const file of chosen) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          addPhotoUri(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
    if (event.target) event.target.value = '';
  };

  if (!session && !recap) {
    return (
      <ScreenContainer>
        <StackHeader title="Save Workout" />
        <AppCard style={{ gap: 12 }}>
          <AppText size="md" weight="bold">
            No active workout to save
          </AppText>
          <AppButton label="Back to Workouts" onPress={() => navigation.goBack()} />
        </AppCard>
      </ScreenContainer>
    );
  }

  const durationSeconds = session
    ? Math.max(60, Math.floor((Date.now() - session.startedAt) / 1000))
    : 0;

  const totalCompletedSets =
    session?.exercises.reduce(
      (sum, ex) => sum + ex.sets.filter((s) => s.isCompleted).length,
      0
    ) ?? 0;

  const totalVolumeKg =
    session?.exercises.reduce(
      (sum, ex) =>
        sum +
        ex.sets
          .filter((s) => s.isCompleted)
          .reduce((acc, s) => acc + s.weightKg * s.reps, 0),
      0
    ) ?? 0;

  const handlePublish = () => {
    if (!session) return;
    const formatted = session.exercises
      .filter((ex) => ex.sets.length > 0)
      .map((ex) => ({
        exerciseId: ex.exerciseId,
        supersetGroup: ex.supersetGroup,
        notes: ex.notes,
        sets: ex.sets.map((s) => ({
          setType: s.setType,
          weightKg: s.weightKg,
          reps: s.reps,
          rpe: s.rpe,
          rir: s.rir,
          isCompleted: totalCompletedSets > 0 ? s.isCompleted : true,
        })),
      }));

    if (formatted.length === 0) {
      showAlert({ title: 'No exercises logged', message: 'Add at least one exercise first.' });
      return;
    }

    createPost.mutate({
      title: title.trim() || 'Workout Session',
      caption: caption.trim(),
      notes: notes.trim(),
      presetId: session.presetId,
      durationSeconds,
      visibility,
      startedAt: new Date(session.startedAt).toISOString(),
      exercises: formatted,
    });
  };

  return (
    <ScreenContainer scroll>
      <StackHeader title="Finish & Publish" subtitle="Compute ranks, PRs, XP & attach photos" />

      {session ? (
        <>
          <AppCard style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <AppText size="lg" weight="black" tone="constant">
                {formatDuration(durationSeconds)}
              </AppText>
              <AppText size="xsm" tone="sub">
                Duration
              </AppText>
            </View>
            <View style={{ alignItems: 'center' }}>
              <AppText size="lg" weight="black">
                {session.exercises.length}
              </AppText>
              <AppText size="xsm" tone="sub">
                Exercises
              </AppText>
            </View>
            <View style={{ alignItems: 'center' }}>
              <AppText size="lg" weight="black" tone="check">
                {formatWeight(totalVolumeKg, unit)}
              </AppText>
              <AppText size="xsm" tone="sub">
                Volume
              </AppText>
            </View>
          </AppCard>

          {/* Workout Photos Attachment Strip (up to 4 photos, ImageAndCaption style) */}
          <AppCard style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText size="sm" weight="bold">
                Workout Photos ({photos.length}/4)
              </AppText>
              {Platform.OS === 'web' && photos.length < 4 ? (
                <Pressable
                  onPress={() => fileInputRef.current?.click()}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 99,
                    backgroundColor: hexToRgba(c.constant, 0.18),
                  }}
                >
                  <Ionicons name="camera-outline" size={15} color={c.constant} />
                  <AppText size="xsm" weight="bold" tone="constant">
                    Upload Photo
                  </AppText>
                </Pressable>
              ) : null}
            </View>

            {Platform.OS === 'web'
              ? React.createElement('input', {
                  ref: fileInputRef,
                  type: 'file',
                  accept: 'image/*',
                  multiple: true,
                  onChange: handleFileChange,
                  style: { display: 'none' },
                })
              : null}

            {photos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {photos.map((uri, idx) => (
                  <View
                    key={`${uri.slice(0, 24)}_${idx}`}
                    style={{
                      width: 86,
                      height: 86,
                      borderRadius: RADII.input,
                      overflow: 'hidden',
                      position: 'relative',
                      borderWidth: 1.5,
                      borderColor: c.constant,
                    }}
                  >
                    <Image source={{ uri }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
                    <Pressable
                      onPress={() => removePhoto(idx)}
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: 'rgba(15,10,24,0.85)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="close" size={14} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <AppText size="xsm" tone="sub">
                Attach up to 4 gym snapshots or pick a quick card below to showcase on your feed post.
              </AppText>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {QUICK_GYM_PHOTOS.map((preset) => {
                const added = photos.includes(preset.uri);
                return (
                  <Pressable
                    key={preset.label}
                    onPress={() => addPhotoUri(preset.uri)}
                    disabled={added || photos.length >= 4}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingRight: 10,
                      padding: 4,
                      borderRadius: 10,
                      backgroundColor: added ? hexToRgba(c.check, 0.2) : c.thirdBg,
                      opacity: added ? 0.65 : 1,
                    }}
                  >
                    <Image source={{ uri: preset.uri }} resizeMode="cover" style={{ width: 28, height: 28, borderRadius: 7 }} />
                    <AppText size="xxsm" weight="bold" tone={added ? 'check' : 'sub'}>
                      {added ? '✓ Added' : `+ ${preset.label}`}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </AppCard>

          <AppCard style={{ gap: 12 }}>
            <AppInput
              label="Workout Title"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Heavy Push PR Session"
            />
            <AppInput
              label="Feed Caption (optional)"
              value={caption}
              onChangeText={setCaption}
              placeholder="How did the session feel?"
            />
            <AppInput
              label="Private Training Notes"
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Sleep, cues, next week's target..."
            />

            <View style={{ gap: 6 }}>
              <AppText size="sm" weight="medium" tone="sub">
                Post Visibility
              </AppText>
              <SegmentedControl
                value={visibility}
                onChange={setVisibility}
                options={[
                  { label: 'Public', value: 'public' },
                  { label: 'Friends', value: 'friends' },
                  { label: 'Private', value: 'private' },
                ]}
              />
            </View>
          </AppCard>

          <AppButton
            label="Save Workout & Claim XP"
            loading={createPost.isPending}
            onPress={handlePublish}
            fullWidth
          />
        </>
      ) : null}

      {/* Celebration Recap Modal */}
      <AppModal
        visible={Boolean(recap)}
        cancelable={false}
        onClose={() => {
          setRecap(null);
          navigation.navigate('BottomNavTabs', { screen: 'HomeTab' });
        }}
        title="Workout Complete!"
        subtitle={`Overall Bodyrank: ${recap?.newOverallRank ?? ''} (${recap?.newOverallRating ?? 0} SR)`}
      >
        {recap ? (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center' }}>
                <AppText size="xl" weight="black" tone="constant">
                  +{recap.xpEarned}
                </AppText>
                <AppText size="xsm" tone="sub">
                  XP Earned
                </AppText>
              </View>
              <View style={{ alignItems: 'center' }}>
                <AppText size="xl" weight="black" style={{ color: c.warning }}>
                  +{recap.creditsEarned}
                </AppText>
                <AppText size="xsm" tone="sub">
                  Credits
                </AppText>
              </View>
              <View style={{ alignItems: 'center' }}>
                <AppText size="xl" weight="black" tone="check">
                  {recap.newStreak}d
                </AppText>
                <AppText size="xsm" tone="sub">
                  Streak
                </AppText>
              </View>
            </View>

            <View
              style={{
                backgroundColor: c.thirdBg,
                borderRadius: 14,
                padding: 12,
                gap: 4,
              }}
            >
              <AppText size="sm" weight="bold">
                Session Highlights
              </AppText>
              <AppText size="xsm" tone="sub">
                {recap.totalSets} sets • {formatWeight(recap.totalVolumeKg, unit)} total volume •{' '}
                {recap.prCount} Personal Records
              </AppText>
            </View>

            {recap.rankUps.length > 0 ? (
              <View style={{ gap: 8 }}>
                <AppText size="sm" weight="bold" tone="constant">
                  RANK UPS UNLOCKED!
                </AppText>
                {recap.rankUps.map((ru) => (
                  <View
                    key={ru.exerciseId}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: 10,
                      borderRadius: 12,
                      backgroundColor: c.thirdBg,
                    }}
                  >
                    <RankBadge
                      tier={ru.newTier as RankTier}
                      division={ru.newDivision as 0 | 1 | 2 | 3}
                      size={56}
                      showShine
                      floating
                    />
                    <View style={{ flex: 1 }}>
                      <AppText size="sm" weight="bold">
                        {ru.exerciseName}
                      </AppText>
                      <AppText size="xsm" tone="check">
                        {ru.oldLabel} → {ru.newLabel}
                      </AppText>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={{ alignItems: 'center' }}>
              <JymboRive pose="Congrats" size={92} showShadow={false} />
            </View>
            <ConfettiOverlay visible={Boolean(recap)} count={28} />
            <AppButton
              label="View in Feed"
              onPress={() => {
                setRecap(null);
                navigation.navigate('BottomNavTabs', { screen: 'HomeTab' });
              }}
              fullWidth
            />
          </View>
        ) : null}
      </AppModal>

      <RankUpCinematicModal
        visible={Boolean(rankUpCinematic)}
        onClose={() => setRankUpCinematic(null)}
        title="EXERCISE RANK UP!"
        subtitle={
          rankUpCinematic
            ? `${rankUpCinematic.exerciseName}: ${rankUpCinematic.oldLabel} → ${rankUpCinematic.newLabel}`
            : undefined
        }
        tier={rankUpCinematic?.tier ?? 'Veteran'}
        division={(rankUpCinematic?.division ?? 1) as 0 | 1 | 2 | 3}
        mode="muscle"
      />
    </ScreenContainer>
  );
}
