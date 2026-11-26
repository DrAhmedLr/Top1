import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  calculateExerciseRank,
  formatDuration,
  kgToLbs,
  lbsToKg,
  SUPERSET_COLORS,
  type RankingSex,
  type RankTier,
  type WeightUnit,
} from '@apexlift/shared';
import { getExerciseAvatarImage } from '../../assets/assetRegistry';
import { getExerciseAvatarUrl } from '../../assets/v4MediaManifest';
import { useAuthStore } from '../../stores/authStore';
import { useWorkoutStore, type WorkoutSetType } from '../../stores/workoutStore';
import { useBumpSpring } from '../../theme/animations';
import { RANK_SOLID_ACCENT } from '../../theme/rankGradients';
import { useResponsiveLayout } from '../../theme/useResponsiveLayout';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII, SPACING } from '../../theme/tokens';
import { impactLight, impactMedium, notifySuccess } from '../../utils/haptics';
import { playSound } from '../../utils/soundscape';
import type { MainStackParamList } from '../../navigation/types';
import { AppButton, AppCard, AppModal, AppText, RankBadge, useAppAlert } from '../ui';
import { AnimatedCheckFillBackground } from './AnimatedCheckFillBackground';
import { CableStackGuideModal } from './CableStackGuideModal';
import { PlateCalcModal } from './PlateCalcModal';
import { RestTimerModal } from './RestTimerModal';
import { RpeRirPickerModal } from './RpeRirPickerModal';
import { MuscleBodygraphSvg, type MuscleRankEntry } from '../rank/MuscleBodygraphSvg';

const SET_TYPE_CYCLE: WorkoutSetType[] = ['normal', 'warmup', 'drop', 'failure'];
const SUPERSET_GROUPS = ['A', 'B', 'C', 'D'];

function CheckmarkButton({
  checked,
  onPress,
  onLongPress,
}: {
  checked: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { scale, bump } = useBumpSpring();

  return (
    <Pressable
      onPress={() => {
        bump(1.24);
        if (!checked) {
          impactMedium();
          playSound('set_complete_1');
        } else {
          playSound('tick', 0.35);
        }
        onPress();
      }}
      onLongPress={onLongPress}
    >
      <Animated.View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: checked ? c.check : c.thirdBg,
          borderBottomWidth: checked ? 3 : 2,
          borderBottomColor: checked ? c.checkUndertone : 'rgba(0,0,0,0.35)',
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale }],
        }}
      >
        <Ionicons name="checkmark" size={20} color={checked ? '#0F0A18' : c.subText} />
      </Animated.View>
    </Pressable>
  );
}

export function ActiveWorkoutSheet() {
  const { theme } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { showAlert } = useAppAlert();

  const user = useAuthStore((s) => s.user);
  const unit: WeightUnit = user?.unitWeight ?? 'lbs';
  const bwKg = user?.bodyweightKg ?? 78;
  const sex: RankingSex = user?.rankingSex ?? 'Male';

  const session = useWorkoutStore((s) => s.session);
  const isSheetOpen = useWorkoutStore((s) => s.isSheetOpen);
  const restTimerEndAt = useWorkoutStore((s) => s.restTimerEndAt);
  const closeSheet = useWorkoutStore((s) => s.closeSheet);
  const setTitle = useWorkoutStore((s) => s.setTitle);
  const removeExercise = useWorkoutStore((s) => s.removeExercise);
  const moveExercise = useWorkoutStore((s) => s.moveExercise);
  const setExerciseSuperset = useWorkoutStore((s) => s.setExerciseSuperset);
  const addSet = useWorkoutStore((s) => s.addSet);
  const updateSet = useWorkoutStore((s) => s.updateSet);
  const toggleSetComplete = useWorkoutStore((s) => s.toggleSetComplete);
  const deleteSet = useWorkoutStore((s) => s.deleteSet);
  const resetSession = useWorkoutStore((s) => s.resetSession);

  const [now, setNow] = useState(Date.now());
  const [restModalVisible, setRestModalVisible] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [cableGuideOpen, setCableGuideOpen] = useState(false);
  const [showLiveBodygraph, setShowLiveBodygraph] = useState(true);
  const [plateTarget, setPlateTarget] = useState<{
    localExId: string;
    setId: string;
    weightKg: number;
  } | null>(null);
  const [effortTarget, setEffortTarget] = useState<{
    localExId: string;
    setId: string;
    rpe: number | null;
    rir: number | null;
  } | null>(null);

  useEffect(() => {
    if (!isSheetOpen || !session) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isSheetOpen, session]);

  const elapsedSec = session ? Math.max(0, Math.floor((now - session.startedAt) / 1000)) : 0;
  const restRemainingSec = restTimerEndAt
    ? Math.max(0, Math.ceil((restTimerEndAt - now) / 1000))
    : 0;

  const stats = useMemo(() => {
    if (!session) return { setsDone: 0, totalSets: 0, volumeKg: 0 };
    let setsDone = 0;
    let totalSets = 0;
    let volumeKg = 0;
    for (const ex of session.exercises) {
      for (const s of ex.sets) {
        totalSets += 1;
        if (s.isCompleted) {
          setsDone += 1;
          volumeKg += s.weightKg * s.reps;
        }
      }
    }
    return { setsDone, totalSets, volumeKg };
  }, [session]);

  const liveMuscles = useMemo(() => {
    if (!session) return {};
    const map: Record<string, MuscleRankEntry> = {};
    for (const ex of session.exercises) {
      const completedSets = ex.sets.filter((s) => s.isCompleted).length;
      const tier: RankTier =
        completedSets >= 4
          ? 'Champion'
          : completedSets >= 2
            ? 'Elite'
            : completedSets >= 1
              ? 'Intermediate'
              : 'Novice';
      for (const m of ex.primaryMuscles) {
        const key = m.toLowerCase();
        map[key] = {
          muscle: key,
          tier,
          division: 1,
          rating: completedSets * 200,
          label: `${tier} I`,
          topExerciseName: ex.exerciseName,
          topExerciseId: ex.exerciseId,
          exerciseCount: 1,
        };
      }
    }
    return map;
  }, [session]);

  if (!session) return null;

  const displayVol =
    unit === 'lbs'
      ? `${Math.round(kgToLbs(stats.volumeKg)).toLocaleString()} lbs`
      : `${Math.round(stats.volumeKg).toLocaleString()} kg`;

  const handleFinish = () => {
    if (session.exercises.length === 0) {
      showAlert({
        title: 'Add at least one exercise',
        message: 'Log at least one exercise before saving your workout.',
      });
      return;
    }
    notifySuccess();
    playSound('workout_complete');
    closeSheet();
    navigation.navigate('SaveWorkout');
  };

  const handleDiscard = () => {
    showAlert({
      title: 'Discard active workout?',
      message: 'All logged sets in this session will be removed.',
      actions: [
        { label: 'Keep Lifting', variant: 'secondary' },
        { label: 'Discard', variant: 'danger', onPress: () => resetSession() },
      ],
    });
  };

  return (
    <Modal
      visible={isSheetOpen}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={closeSheet}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: '#07040D',
          alignItems: 'center',
          paddingVertical: layout.isDesktop ? 20 : 0,
          paddingHorizontal: layout.isDesktop ? 24 : 0,
        }}
      >
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: layout.isDesktop ? 900 : layout.isWide ? 680 : undefined,
            backgroundColor: c.background,
            borderRadius: layout.isDesktop ? RADII.cardLarge : 0,
            borderWidth: layout.isDesktop ? 1 : 0,
            borderColor: hexToRgba('#FFFFFF', 0.1),
            overflow: 'hidden',
            paddingTop: Math.max(14, insets.top),
          }}
        >
        {/* Top Bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: SPACING.std,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: hexToRgba('#FFFFFF', 0.08),
            gap: 10,
          }}
        >
          <Pressable
            onPress={closeSheet}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: c.secondBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-down" size={22} color={c.text} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <TextInput
              value={session.title}
              onChangeText={setTitle}
              placeholder="Workout Title"
              placeholderTextColor={c.subText}
              style={{
                color: c.text,
                fontSize: 17,
                fontWeight: '800',
                paddingVertical: 2,
              }}
            />
            <AppText size="xsm" tone="sub" tabular>
              {formatDuration(elapsedSec)} • {stats.setsDone}/{stats.totalSets} sets • {displayVol}
            </AppText>
          </View>

          <Pressable
            onPress={() => setRestModalVisible(true)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor: restRemainingSec > 0 ? hexToRgba(c.constant, 0.2) : c.secondBg,
              borderWidth: 1,
              borderColor: restRemainingSec > 0 ? c.constant : c.thirdBg,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Ionicons
              name="timer-outline"
              size={16}
              color={restRemainingSec > 0 ? c.constant : c.subText}
            />
            <AppText
              size="xsm"
              weight="bold"
              tone={restRemainingSec > 0 ? 'constant' : 'default'}
              tabular
            >
              {restRemainingSec > 0 ? formatDuration(restRemainingSec) : 'Rest'}
            </AppText>
          </Pressable>

          <AppButton label="Finish" size="sm" variant="check" onPress={handleFinish} />
        </View>

        {/* Body */}
        <ScrollView
          contentContainerStyle={{
            padding: SPACING.std,
            paddingBottom: Math.max(44, insets.bottom + 24),
            gap: SPACING.std,
          }}
        >
          {/* Live Ongoing Workout Bodygraph & Cable Guide Strip (Liftoff 2.18.1) */}
          {session.exercises.length > 0 ? (
            <AppCard style={{ gap: 10, padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Pressable
                  onPress={() => setShowLiveBodygraph((v) => !v)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Ionicons name="body-outline" size={16} color={c.constant} />
                  <AppText size="xsm" weight="black" tone="constant">
                    LIVE SESSION BODYGRAPH ({Object.keys(liveMuscles).length} muscles)
                  </AppText>
                </Pressable>
                <Pressable
                  onPress={() => setCableGuideOpen(true)}
                  style={{
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                    borderRadius: 99,
                    backgroundColor: c.thirdBg,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Ionicons name="hardware-chip-outline" size={13} color={c.constant} />
                  <AppText size="xxsm" weight="bold" tone="constant">
                    Cable Guide
                  </AppText>
                </Pressable>
              </View>
              {showLiveBodygraph ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
                  <MuscleBodygraphSvg
                    muscles={liveMuscles}
                    side="front"
                    isFemale={sex === 'Female'}
                    height={118}
                  />
                  <MuscleBodygraphSvg
                    muscles={liveMuscles}
                    side="back"
                    isFemale={sex === 'Female'}
                    height={118}
                  />
                </View>
              ) : null}
            </AppCard>
          ) : null}

          {session.exercises.length === 0 ? (
            <AppCard style={{ alignItems: 'center', paddingVertical: 30, gap: 10 }}>
              <Ionicons name="barbell-outline" size={40} color={c.constant} />
              <AppText size="lg" weight="black">
                Ready to Lift
              </AppText>
              <AppText size="sm" tone="sub" align="center">
                Tap "Add Exercise" below to pick lifts and watch your live strength rank climb.
              </AppText>
            </AppCard>
          ) : (
            session.exercises.map((ex, exIdx) => {
              const supIdx = ex.supersetGroup ? SUPERSET_GROUPS.indexOf(ex.supersetGroup) : -1;
              const supColor = supIdx >= 0 ? SUPERSET_COLORS[supIdx % SUPERSET_COLORS.length] : null;
              const localExAvatar = getExerciseAvatarImage(ex.exerciseId);
              const webExAvatarUrl = getExerciseAvatarUrl(ex.exerciseId);
              const exAvatar = localExAvatar ?? (webExAvatarUrl ? { uri: webExAvatarUrl } : null);

              let bestRank = calculateExerciseRank({
                weightKg: 0,
                reps: 0,
                bodyweightKg: bwKg,
                sex,
              });
              for (const s of ex.sets) {
                if (s.setType !== 'warmup' && s.weightKg > 0 && s.reps > 0) {
                  const r = calculateExerciseRank({
                    weightKg: s.weightKg,
                    reps: s.reps,
                    bodyweightKg: bwKg,
                    sex,
                  });
                  if (r.rating > bestRank.rating) bestRank = r;
                }
              }
              const rankColor = RANK_SOLID_ACCENT[bestRank.tier as RankTier] ?? c.constant;

              return (
                <AppCard
                  key={ex.id}
                  glowColor={supColor ?? undefined}
                  style={{ gap: 10 }}
                >
                  {/* Exercise Header with Illustrated Avatar + Live Sculpted Rank Badge */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {exAvatar ? (
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          overflow: 'hidden',
                          backgroundColor: c.thirdBg,
                          borderWidth: 1,
                          borderColor: hexToRgba('#FFFFFF', 0.1),
                        }}
                      >
                        <Image
                          source={exAvatar}
                          resizeMode="cover"
                          style={{ width: '100%', height: '100%' }}
                        />
                      </View>
                    ) : null}

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <AppText size="md" weight="xbold" numberOfLines={1}>
                          {ex.exerciseName}
                        </AppText>
                        {ex.supersetGroup ? (
                          <View
                            style={{
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              borderRadius: 6,
                              backgroundColor: hexToRgba(supColor ?? c.constant, 0.25),
                            }}
                          >
                            <AppText size="xsm" weight="bold" style={{ color: supColor ?? c.constant }}>
                              SS {ex.supersetGroup}
                            </AppText>
                          </View>
                        ) : null}
                      </View>
                      <AppText size="xsm" tone="sub">
                        {ex.equipment} •{' '}
                        {bestRank.rating > 0 ? (
                          <AppText size="xsm" weight="bold" style={{ color: rankColor }}>
                            {bestRank.label} ({bestRank.rating} SR)
                          </AppText>
                        ) : (
                          ex.primaryMuscles[0] ?? 'Full Body'
                        )}
                      </AppText>
                    </View>

                    {bestRank.rating > 0 ? (
                      <RankBadge
                        tier={bestRank.tier as RankTier}
                        division={bestRank.division}
                        size={36}
                      />
                    ) : null}

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Pressable
                        onPress={() => {
                          const nextIdx = (supIdx + 1) % (SUPERSET_GROUPS.length + 1);
                          setExerciseSuperset(
                            ex.id,
                            nextIdx === SUPERSET_GROUPS.length ? null : SUPERSET_GROUPS[nextIdx]
                          );
                        }}
                        style={{
                          paddingHorizontal: 7,
                          paddingVertical: 4,
                          borderRadius: 8,
                          backgroundColor: c.thirdBg,
                        }}
                      >
                        <AppText size="xsm" weight="bold" tone="sub">
                          SS
                        </AppText>
                      </Pressable>
                      {exIdx > 0 ? (
                        <Pressable onPress={() => moveExercise(ex.id, -1)} hitSlop={6}>
                          <Ionicons name="arrow-up" size={15} color={c.subText} />
                        </Pressable>
                      ) : null}
                      {exIdx < session.exercises.length - 1 ? (
                        <Pressable onPress={() => moveExercise(ex.id, 1)} hitSlop={6}>
                          <Ionicons name="arrow-down" size={15} color={c.subText} />
                        </Pressable>
                      ) : null}
                      <Pressable onPress={() => removeExercise(ex.id)} hitSlop={6}>
                        <Ionicons name="trash-outline" size={16} color={c.danger} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Set Column Headers */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
                    <AppText size="xsm" weight="bold" tone="sub" style={{ width: 32, textAlign: 'center' }}>
                      SET
                    </AppText>
                    <AppText size="xsm" weight="bold" tone="sub" style={{ flex: 1, textAlign: 'center' }}>
                      {unit.toUpperCase()}
                    </AppText>
                    <AppText size="xsm" weight="bold" tone="sub" style={{ width: 58, textAlign: 'center' }}>
                      REPS
                    </AppText>
                    <AppText size="xsm" weight="bold" tone="sub" style={{ width: 48, textAlign: 'center' }}>
                      RPE
                    </AppText>
                    <AppText size="xsm" weight="bold" tone="sub" style={{ width: 36, textAlign: 'center' }}>
                      ✓
                    </AppText>
                  </View>

                  {/* Set Rows with 250ms Fluid Green Wave Fill */}
                  {ex.sets.map((s, sIdx) => {
                    const displayWeight =
                      unit === 'lbs'
                        ? String(Math.round(kgToLbs(s.weightKg) * 2) / 2)
                        : String(Number(s.weightKg.toFixed(1)));
                    const typeBadge =
                      s.setType === 'warmup'
                        ? 'W'
                        : s.setType === 'drop'
                          ? 'D'
                          : s.setType === 'failure'
                            ? 'F'
                            : String(sIdx + 1);
                    const typeColor =
                      s.setType === 'warmup'
                        ? c.warning
                        : s.setType === 'drop'
                          ? c.constant
                          : s.setType === 'failure'
                            ? c.danger
                            : c.text;

                    return (
                      <View
                        key={s.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingVertical: 6,
                          paddingHorizontal: 4,
                          borderRadius: 12,
                          overflow: 'hidden',
                          backgroundColor: hexToRgba(c.thirdBg, 0.38),
                        }}
                      >
                        <AnimatedCheckFillBackground
                          checked={s.isCompleted}
                          backgroundColor={hexToRgba(c.check, 0.22)}
                        />

                        <Pressable
                          onPress={() => {
                            const next =
                              SET_TYPE_CYCLE[
                                (SET_TYPE_CYCLE.indexOf(s.setType) + 1) % SET_TYPE_CYCLE.length
                              ];
                            updateSet(ex.id, s.id, { setType: next });
                          }}
                          style={{
                            width: 32,
                            height: 36,
                            borderRadius: 9,
                            backgroundColor: c.thirdBg,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <AppText size="xsm" weight="black" style={{ color: typeColor }}>
                            {typeBadge}
                          </AppText>
                        </Pressable>

                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <TextInput
                            keyboardType="decimal-pad"
                            value={displayWeight}
                            onChangeText={(txt) => {
                              const parsed = parseFloat(txt);
                              const num = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
                              updateSet(ex.id, s.id, {
                                weightKg: unit === 'lbs' ? lbsToKg(num) : num,
                              });
                            }}
                            style={{
                              flex: 1,
                              height: 36,
                              borderRadius: 9,
                              backgroundColor: c.thirdBg,
                              color: c.text,
                              textAlign: 'center',
                              fontWeight: '700',
                              fontSize: 14,
                            }}
                          />
                          <Pressable
                            onPress={() =>
                              setPlateTarget({
                                localExId: ex.id,
                                setId: s.id,
                                weightKg: s.weightKg,
                              })
                            }
                            style={{
                              width: 28,
                              height: 36,
                              borderRadius: 8,
                              backgroundColor: c.thirdBg,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Ionicons name="disc-outline" size={15} color={c.constant} />
                          </Pressable>
                        </View>

                        <TextInput
                          keyboardType="number-pad"
                          value={String(s.reps)}
                          onChangeText={(txt) => {
                            const parsed = parseInt(txt, 10);
                            updateSet(ex.id, s.id, {
                              reps: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
                            });
                          }}
                          style={{
                            width: 58,
                            height: 36,
                            borderRadius: 9,
                            backgroundColor: c.thirdBg,
                            color: c.text,
                            textAlign: 'center',
                            fontWeight: '700',
                            fontSize: 14,
                          }}
                        />

                        <Pressable
                          onPress={() =>
                            setEffortTarget({
                              localExId: ex.id,
                              setId: s.id,
                              rpe: s.rpe,
                              rir: s.rir,
                            })
                          }
                          style={{
                            width: 48,
                            height: 36,
                            borderRadius: 9,
                            backgroundColor: c.thirdBg,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <AppText size="xsm" weight="bold" tone={s.rpe !== null ? 'constant' : 'sub'}>
                            {s.rpe !== null ? `@${s.rpe}` : '—'}
                          </AppText>
                        </Pressable>

                        <CheckmarkButton
                          checked={s.isCompleted}
                          onPress={() => toggleSetComplete(ex.id, s.id)}
                          onLongPress={() => deleteSet(ex.id, s.id)}
                        />
                      </View>
                    );
                  })}

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <AppButton
                      label="+ Add Set"
                      variant="secondary"
                      size="sm"
                      onPress={() => addSet(ex.id)}
                      style={{ flex: 1 }}
                    />
                    {ex.sets.length > 1 ? (
                      <AppButton
                        label="Remove Last"
                        variant="ghost"
                        size="sm"
                        onPress={() => deleteSet(ex.id, ex.sets[ex.sets.length - 1].id)}
                      />
                    ) : null}
                  </View>
                </AppCard>
              );
            })
          )}

          {/* Action buttons */}
          <View style={{ gap: 10, marginTop: 4 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <AppButton
                label="+ Add Exercise"
                variant="secondary"
                onPress={() => {
                  closeSheet();
                  navigation.navigate('ExerciseLibrary', { mode: 'addToWorkout' });
                }}
                style={{ flex: 1.4 }}
              />
              {session.exercises.length > 1 ? (
                <AppButton
                  label="Reorder"
                  variant="secondary"
                  onPress={() => {
                    impactLight();
                    playSound('tick', 0.4);
                    setReorderOpen(true);
                  }}
                  style={{ flex: 1 }}
                />
              ) : null}
            </View>
            <AppButton
              label="Discard Workout"
              variant="ghost"
              onPress={handleDiscard}
              fullWidth
            />
          </View>
        </ScrollView>

        {/* Reorder Exercises Modal */}
        <AppModal
          visible={reorderOpen}
          onClose={() => setReorderOpen(false)}
          title="Reorder Exercises"
          subtitle="Move exercises up or down in your active session"
        >
          <View style={{ gap: 8 }}>
            {session.exercises.map((ex, idx) => (
              <View
                key={ex.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: c.thirdBg,
                }}
              >
                <AppText size="sm" weight="black" tone="constant" style={{ width: 22 }} tabular>
                  {idx + 1}.
                </AppText>
                <View style={{ flex: 1 }}>
                  <AppText size="sm" weight="bold" numberOfLines={1}>
                    {ex.exerciseName}
                  </AppText>
                  <AppText size="xxsm" tone="sub">
                    {ex.sets.length} sets • {ex.equipment}
                  </AppText>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Pressable
                    disabled={idx === 0}
                    onPress={() => {
                      impactLight();
                      playSound('tick', 0.4);
                      moveExercise(ex.id, -1);
                    }}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      backgroundColor: c.secondBg,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: idx === 0 ? 0.35 : 1,
                    }}
                  >
                    <Ionicons name="arrow-up" size={16} color={c.text} />
                  </Pressable>
                  <Pressable
                    disabled={idx === session.exercises.length - 1}
                    onPress={() => {
                      impactLight();
                      playSound('tick', 0.4);
                      moveExercise(ex.id, 1);
                    }}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      backgroundColor: c.secondBg,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: idx === session.exercises.length - 1 ? 0.35 : 1,
                    }}
                  >
                    <Ionicons name="arrow-down" size={16} color={c.text} />
                  </Pressable>
                </View>
              </View>
            ))}
            <AppButton label="Done Reordering" onPress={() => setReorderOpen(false)} fullWidth />
          </View>
        </AppModal>

        <RestTimerModal
          visible={restModalVisible}
          onClose={() => setRestModalVisible(false)}
        />

        <CableStackGuideModal
          visible={cableGuideOpen}
          onClose={() => setCableGuideOpen(false)}
          unit={unit}
        />

        {plateTarget ? (
          <PlateCalcModal
            visible
            onClose={() => setPlateTarget(null)}
            initialWeightKg={plateTarget.weightKg}
            defaultUnit={unit}
            onApplyWeightKg={(weightKg) =>
              updateSet(plateTarget.localExId, plateTarget.setId, { weightKg })
            }
          />
        ) : null}

        {effortTarget ? (
          <RpeRirPickerModal
            visible
            onClose={() => setEffortTarget(null)}
            initialRpe={effortTarget.rpe}
            initialRir={effortTarget.rir}
            onSave={(rpe, rir) =>
              updateSet(effortTarget.localExId, effortTarget.setId, { rpe, rir })
            }
          />
        ) : null}
        </View>
      </View>
    </Modal>
  );
}
