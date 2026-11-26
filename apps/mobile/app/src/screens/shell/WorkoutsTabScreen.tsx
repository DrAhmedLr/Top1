import React, { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../api/trpc';
import { getExerciseAvatarImage } from '../../assets/assetRegistry';
import { getExerciseAvatarUrl, getRoutineRankUrl, V4_UI_URLS } from '../../assets/v4MediaManifest';
import { JymboDialogue } from '../../components/mascot';
import {
  AppButton,
  AppCard,
  AppInput,
  AppModal,
  AppText,
  ScreenContainer,
  useAppAlert,
} from '../../components/ui';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useResponsiveLayout } from '../../theme/useResponsiveLayout';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII, SPACING } from '../../theme/tokens';
import { impactLight } from '../../utils/haptics';
import { playSound } from '../../utils/soundscape';
import type { MainStackParamList } from '../../navigation/types';

const DAY_ZERO_MODES = [
  {
    id: 'gym',
    label: 'Commercial Gym',
    subtitle: 'Full racks, cables & machines',
    art: V4_UI_URLS.day_zero_gym,
  },
  {
    id: 'garage',
    label: 'Garage Gym',
    subtitle: 'Barbell, bench & squat stand',
    art: V4_UI_URLS.day_zero_garage,
  },
  {
    id: 'home',
    label: 'Home Dumbbells',
    subtitle: 'Compact progressive overload',
    art: V4_UI_URLS.day_zero_home,
  },
  {
    id: 'cardio',
    label: 'Conditioning',
    subtitle: 'Engine & metabolic finishers',
    art: V4_UI_URLS.day_zero_cardio,
  },
];

const FEATURED_PLANS = [
  { id: 'iron', title: 'Iron Protocol', tag: 'STRENGTH', art: V4_UI_URLS.plan_strength_iron_protocol },
  { id: 'mass', title: 'Mass Overdrive', tag: 'HYPERTROPHY', art: V4_UI_URLS.plan_muscle_mass_overdrive },
  { id: 'shred', title: 'Steady Shred', tag: 'LEAN CUT', art: V4_UI_URLS.plan_lean_steady_shred },
  { id: 'defined', title: 'Getting Defined', tag: 'TONED', art: V4_UI_URLS.plan_toned_getting_defined },
  { id: 'elevated', title: 'Elevated Build', tag: 'MUSCLE', art: V4_UI_URLS.plan_muscle_elevated_build },
  { id: 'curves', title: 'Strong Curves', tag: 'GLUTES', art: V4_UI_URLS.plan_toned_strong_curves },
  { id: 'abs', title: 'Abs of Steel', tag: 'CORE', art: V4_UI_URLS.plan_lean_abs_of_steel },
  { id: 'linear', title: 'Linear Strength', tag: 'POWER', art: V4_UI_URLS.plan_strength_linear_progression },
];

const PRESET_RANK_TIERS = ['Champion', 'Elite', 'Veteran', 'Enthusiast', 'Intermediate', 'Novice'];

export function WorkoutsTabScreen() {
  const { theme } = useTheme();
  const layout = useResponsiveLayout();
  const c = theme.colors;
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { showAlert } = useAppAlert();

  const session = useWorkoutStore((s) => s.session);
  const startEmpty = useWorkoutStore((s) => s.startEmpty);
  const startFromPreset = useWorkoutStore((s) => s.startFromPreset);
  const openSheet = useWorkoutStore((s) => s.openSheet);

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [dayZeroIdx, setDayZeroIdx] = useState(0);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const utils = trpc.useUtils();
  const foldersQuery = trpc.preset.listFolders.useQuery();
  const presetsQuery = trpc.preset.list.useQuery();
  const createFolder = trpc.preset.createFolder.useMutation({
    onSuccess: () => {
      utils.preset.listFolders.invalidate();
      setNewFolderName('');
      setFolderModalOpen(false);
    },
  });
  const deletePreset = trpc.preset.delete.useMutation({
    onSuccess: () => utils.preset.list.invalidate(),
  });

  const folders = foldersQuery.data ?? [];
  const allPresets = presetsQuery.data ?? [];
  const visiblePresets = selectedFolderId
    ? allPresets.filter((p) => p.folderId === selectedFolderId)
    : allPresets;
  const activeDayZero = DAY_ZERO_MODES[dayZeroIdx];

  return (
    <ScreenContainer scroll>
      <View>
        <AppText size="xxl" weight="black">
          Workouts
        </AppText>
        <AppText size="sm" tone="sub">
          Day-Zero Plan Hub, ranked splits & 630 illustrated exercises
        </AppText>
      </View>

      {/* Top Responsive Hero Split: Day-Zero Banner + Coach & Quick Tools */}
      <View
        style={
          layout.isDesktop
            ? { flexDirection: 'row-reverse', alignItems: 'stretch', gap: 18 }
            : { gap: layout.sectionGap }
        }
      >
        <View style={layout.isDesktop ? { flex: 1, gap: 12, justifyContent: 'space-between' } : { gap: layout.sectionGap }}>
          {/* Day-Zero Jymbo Coach Check-In */}
          <JymboDialogue
            mascotPose={session ? 'Curling' : 'Salute'}
            curlIntense={Boolean(session)}
            mascotSize={82}
            mascotText={
              session
                ? `Session live! Crush your remaining sets on ${session.title} to boost your TOP1% muscle ranks!`
                : 'Welcome to TOP1% Training! Open Adaptive Coach for today’s deterministic plan or generate a recovery-aware session below.'
            }
          />

          {/* TOP1% Adaptive Coach Shortcut Card */}
          <Pressable onPress={() => navigation.navigate('CoachHub')}>
            <AppCard
              glowColor={c.check}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: hexToRgba(c.check, 0.18),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="compass-outline" size={22} color={c.check} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText size="md" weight="black">
                    TOP1% Adaptive Coach & Goals
                  </AppText>
                  <AppText size="xsm" tone="sub">
                    Time/discomfort adaptation, guided calendar & Monte Carlo forecast
                  </AppText>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={c.check} />
            </AppCard>
          </Pressable>

          {/* Quick Tools Row */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              {
                title: 'Generator',
                sub: 'Smart split',
                icon: 'sparkles-outline' as const,
                color: c.constant,
                onPress: () => navigation.navigate('WorkoutGenerator'),
              },
              {
                title: 'Schedule',
                sub: 'Plans & week',
                icon: 'calendar-outline' as const,
                color: c.check,
                onPress: () => navigation.navigate('WorkoutSchedule'),
              },
              {
                title: 'Exercises',
                sub: '630 Illustrated',
                icon: 'library-outline' as const,
                color: c.warning,
                onPress: () => navigation.navigate('ExerciseLibrary', { mode: 'browse' }),
              },
            ].map((tool) => (
              <Pressable key={tool.title} onPress={tool.onPress} style={{ flex: 1 }}>
                <AppCard style={{ padding: 13, gap: 6 }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: hexToRgba(tool.color, 0.16),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={tool.icon} size={19} color={tool.color} />
                  </View>
                  <AppText size="sm" weight="bold">
                    {tool.title}
                  </AppText>
                  <AppText size="xsm" tone="sub">
                    {tool.sub}
                  </AppText>
                </AppCard>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Day-Zero Environment Hero Banner */}
        <AppCard
          glowColor={c.constant}
          style={{
            flex: layout.isDesktop ? 1.25 : undefined,
            gap: 12,
            paddingTop: 0,
            overflow: 'hidden',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ width: '112%', alignSelf: 'center', height: layout.isDesktop ? 168 : 118, backgroundColor: '#120C1E' }}>
            <Image
              source={{ uri: activeDayZero.art }}
              resizeMode="cover"
              style={{ width: '100%', height: '100%' }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: 8,
                left: 14,
                right: 14,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
              }}
            >
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 99,
                  backgroundColor: 'rgba(15, 10, 24, 0.85)',
                  borderWidth: 1,
                  borderColor: hexToRgba(c.constant, 0.55),
                }}
              >
                <AppText size="xxsm" weight="black" tone="constant">
                  DAY-ZERO HUB • {activeDayZero.label.toUpperCase()}
                </AppText>
              </View>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {DAY_ZERO_MODES.map((m, idx) => {
              const active = idx === dayZeroIdx;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    impactLight();
                    playSound('tick', 0.35);
                    setDayZeroIdx(idx);
                  }}
                  style={{
                    paddingHorizontal: 11,
                    paddingVertical: 5,
                    borderRadius: 99,
                    backgroundColor: active ? c.constant : c.thirdBg,
                  }}
                >
                  <AppText size="xxsm" weight="bold" tone={active ? 'constantT' : 'sub'}>
                    {m.label}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: hexToRgba(c.constant, 0.2),
                borderWidth: 1,
                borderColor: hexToRgba(c.constant, 0.5),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="flash" size={22} color={c.constant} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText size="md" weight="black">
                {session ? 'Session In Progress' : `Quick Start (${activeDayZero.label})`}
              </AppText>
              <AppText size="xsm" tone="sub">
                {session
                  ? `${session.title} • ${session.exercises.length} exercises active`
                  : activeDayZero.subtitle}
              </AppText>
            </View>
          </View>

          <AppButton
            label={session ? 'Resume Active Workout' : 'Start Empty Workout'}
            variant={session ? 'check' : 'primary'}
            onPress={() => (session ? openSheet() : startEmpty(`${activeDayZero.label} Session`))}
            fullWidth
          />
        </AppCard>
      </View>

      {/* Featured TOP1% Workout Plans */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText size="md" weight="xbold">
            Featured Ranked Plans
          </AppText>
          <Pressable onPress={() => navigation.navigate('WorkoutSchedule')}>
            <AppText size="xsm" weight="bold" tone="constant">
              View All →
            </AppText>
          </Pressable>
        </View>
        {layout.isDesktop ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {FEATURED_PLANS.map((pl) => (
              <Pressable
                key={pl.id}
                onPress={() => {
                  impactLight();
                  playSound('tick', 0.4);
                  navigation.navigate('WorkoutSchedule');
                }}
                style={{
                  flexBasis: '23.5%',
                  flexGrow: 1,
                  minWidth: 180,
                  borderRadius: RADII.card,
                  overflow: 'hidden',
                  backgroundColor: c.secondBg,
                  borderWidth: 1,
                  borderColor: c.thirdBg,
                }}
              >
                <Image source={{ uri: pl.art }} resizeMode="cover" style={{ width: '100%', height: 106 }} />
                <View style={{ padding: 10, gap: 2 }}>
                  <AppText size="xxsm" weight="black" tone="constant">
                    {pl.tag}
                  </AppText>
                  <AppText size="sm" weight="bold" numberOfLines={1}>
                    {pl.title}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {FEATURED_PLANS.map((pl) => (
              <Pressable
                key={pl.id}
                onPress={() => {
                  impactLight();
                  playSound('tick', 0.4);
                  navigation.navigate('WorkoutSchedule');
                }}
                style={{
                  width: 152,
                  borderRadius: RADII.card,
                  overflow: 'hidden',
                  backgroundColor: c.secondBg,
                  borderWidth: 1,
                  borderColor: c.thirdBg,
                }}
              >
                <Image source={{ uri: pl.art }} resizeMode="cover" style={{ width: 152, height: 92 }} />
                <View style={{ padding: 9, gap: 2 }}>
                  <AppText size="xxsm" weight="black" tone="constant">
                    {pl.tag}
                  </AppText>
                  <AppText size="sm" weight="bold" numberOfLines={1}>
                    {pl.title}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Folders Filter */}
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText size="md" weight="xbold">
            My Templates ({visiblePresets.length})
          </AppText>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable onPress={() => setFolderModalOpen(true)}>
              <AppText size="xsm" weight="bold" tone="sub">
                + Folder
              </AppText>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('NewPreset')}>
              <AppText size="xsm" weight="bold" tone="constant">
                + New Preset
              </AppText>
            </Pressable>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Pressable
            onPress={() => setSelectedFolderId(null)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: RADII.pill,
              backgroundColor: selectedFolderId === null ? hexToRgba(c.constant, 0.2) : c.secondBg,
              borderWidth: 1,
              borderColor: selectedFolderId === null ? c.constant : c.thirdBg,
            }}
          >
            <AppText size="xsm" weight="bold" tone={selectedFolderId === null ? 'constant' : 'default'}>
              All ({allPresets.length})
            </AppText>
          </Pressable>
          {folders.map((f) => {
            const active = selectedFolderId === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setSelectedFolderId(active ? null : f.id)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: RADII.pill,
                  backgroundColor: active ? hexToRgba(c.constant, 0.2) : c.secondBg,
                  borderWidth: 1,
                  borderColor: active ? c.constant : c.thirdBg,
                }}
              >
                <AppText size="xsm" weight="bold" tone={active ? 'constant' : 'default'}>
                  {f.name}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Presets List — 2-Column Grid on Desktop, Vertical Stack on Mobile */}
      <View
        style={
          layout.isDesktop
            ? { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }
            : { gap: SPACING.std }
        }
      >
        {visiblePresets.length === 0 ? (
          <AppCard style={{ width: '100%', alignItems: 'center', paddingVertical: 24, gap: 10 }}>
            <AppText size="md" weight="bold">
              No presets in this folder
            </AppText>
            <AppButton
              label="Create First Preset"
              size="sm"
              onPress={() => navigation.navigate('NewPreset')}
            />
          </AppCard>
        ) : (
          visiblePresets.map((preset, idx) => {
            const rankBadgeUrl = getRoutineRankUrl(PRESET_RANK_TIERS[idx % PRESET_RANK_TIERS.length]);
            return (
              <AppCard
                key={preset.id}
                style={{
                  gap: 12,
                  ...(layout.isDesktop ? { flexBasis: '48.5%', flexGrow: 1, minWidth: 320 } : {}),
                }}
              >
                <Pressable
                  onPress={() => navigation.navigate('PresetDetail', { presetId: preset.id })}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
                >
                  {rankBadgeUrl ? (
                    <Image
                      source={{ uri: rankBadgeUrl }}
                      resizeMode="contain"
                      style={{ width: 42, height: 42 }}
                    />
                  ) : null}
                  <View style={{ flex: 1, gap: 3 }}>
                    <AppText size="lg" weight="xbold">
                      {preset.name}
                    </AppText>
                    {preset.description ? (
                      <AppText size="sm" tone="sub" numberOfLines={2}>
                        {preset.description}
                      </AppText>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() =>
                      showAlert({
                        title: `Delete "${preset.name}"?`,
                        message: 'This removes the template from your library.',
                        actions: [
                          { label: 'Cancel', variant: 'secondary' },
                          {
                            label: 'Delete',
                            variant: 'danger',
                            onPress: () => deletePreset.mutate({ id: preset.id }),
                          },
                        ],
                      })
                    }
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={18} color={c.subText} />
                  </Pressable>
                </Pressable>

                {/* Illustrated Exercise Avatar Strip */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {preset.exercises.map((ex) => {
                    const localThumb = getExerciseAvatarImage(ex.exerciseId);
                    const webThumbUrl = getExerciseAvatarUrl(ex.exerciseId);
                    return (
                      <View
                        key={ex.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          paddingRight: 10,
                          padding: 4,
                          borderRadius: 12,
                          backgroundColor: c.thirdBg,
                        }}
                      >
                        {localThumb ? (
                          <Image
                            source={localThumb}
                            resizeMode="cover"
                            style={{ width: 34, height: 34, borderRadius: 9 }}
                          />
                        ) : webThumbUrl ? (
                          <Image
                            source={{ uri: webThumbUrl }}
                            resizeMode="cover"
                            style={{ width: 34, height: 34, borderRadius: 9 }}
                          />
                        ) : null}
                        <AppText size="xsm" weight="bold">
                          {ex.exerciseName}
                        </AppText>
                      </View>
                    );
                  })}
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <AppButton
                    label="Inspect"
                    variant="secondary"
                    size="sm"
                    onPress={() => navigation.navigate('PresetDetail', { presetId: preset.id })}
                    style={{ flex: 1 }}
                  />
                  <AppButton
                    label="Start Workout"
                    size="sm"
                    onPress={() => startFromPreset(preset)}
                    style={{ flex: 1.5 }}
                  />
                </View>
              </AppCard>
            );
          })
        )}
      </View>

      <AppModal
        visible={folderModalOpen}
        onClose={() => setFolderModalOpen(false)}
        title="New Routine Folder"
      >
        <AppInput
          label="Folder Name"
          placeholder="e.g. Hypertrophy Block"
          value={newFolderName}
          onChangeText={setNewFolderName}
        />
        <AppButton
          label="Create Folder"
          loading={createFolder.isPending}
          onPress={() => {
            if (newFolderName.trim()) {
              createFolder.mutate({ name: newFolderName.trim() });
            }
          }}
          fullWidth
        />
      </AppModal>
    </ScreenContainer>
  );
}
