import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { EQUIPMENT_TYPES, RANKED_MUSCLE_GROUPS } from '@apexlift/shared';
import { trpc } from '../../api/trpc';
import { getEquipmentImage, getExerciseAvatarImage } from '../../assets/assetRegistry';
import { EQUIPMENT_ICON_URLS, getExerciseAvatarUrl } from '../../assets/v4MediaManifest';
import {
  AppButton,
  AppCard,
  AppInput,
  AppText,
  ScreenContainer,
  StackHeader,
} from '../../components/ui';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import type { MainStackParamList } from '../../navigation/types';

const MUSCLE_FILTERS = ['All', ...RANKED_MUSCLE_GROUPS];
const EQUIPMENT_FILTERS = ['All', ...EQUIPMENT_TYPES];
const PAGE_SIZE = 48;

export function ExerciseLibraryScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, 'ExerciseLibrary'>>();
  const mode = route.params?.mode ?? 'browse';

  const addExercise = useWorkoutStore((s) => s.addExercise);
  const openSheet = useWorkoutStore((s) => s.openSheet);

  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState('All');
  const [equipment, setEquipment] = useState('All');
  const [customOnly, setCustomOnly] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
  }, [search, muscle, equipment, customOnly]);

  const listQuery = trpc.exercise.list.useQuery({
    search,
    muscle,
    equipment,
    customOnly,
  });

  const exercises = listQuery.data ?? [];
  const visibleExercises = exercises.slice(0, visibleLimit);
  const hasMore = exercises.length > visibleLimit;
  const equipmentIconCount = Object.keys(EQUIPMENT_ICON_URLS).length;

  return (
    <ScreenContainer scroll>
      <StackHeader
        title={mode === 'addToWorkout' ? 'Add Exercise' : 'Exercise Library'}
        subtitle={`${exercises.length} illustrated movements • ${equipmentIconCount} equipment icons`}
        right={
          <AppButton
            label="+ Custom"
            size="sm"
            variant="secondary"
            onPress={() => navigation.navigate('NewExercise')}
          />
        }
      />

      <AppInput
        placeholder="Search 630+ lifts (bench, kettlebell, cable, lats...)"
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
        {MUSCLE_FILTERS.map((m) => {
          const active = muscle === m;
          return (
            <Pressable
              key={m}
              onPress={() => setMuscle(m)}
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
                {m}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
        <Pressable
          onPress={() => setCustomOnly((v) => !v)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: RADII.pill,
            backgroundColor: customOnly ? hexToRgba(c.warning, 0.2) : c.secondBg,
            borderWidth: 1,
            borderColor: customOnly ? c.warning : c.thirdBg,
          }}
        >
          <AppText size="xsm" weight="bold" style={{ color: customOnly ? c.warning : c.subText }}>
            Custom Only
          </AppText>
        </Pressable>
        {EQUIPMENT_FILTERS.map((eq) => {
          const active = equipment === eq;
          const eqImg = getEquipmentImage(eq);
          return (
            <Pressable
              key={eq}
              onPress={() => setEquipment(eq)}
              style={{
                paddingHorizontal: 11,
                paddingVertical: 6,
                borderRadius: RADII.pill,
                backgroundColor: active ? hexToRgba(c.constant, 0.18) : c.secondBg,
                borderWidth: 1,
                borderColor: active ? c.constant : c.thirdBg,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {eqImg ? (
                <Image source={eqImg} resizeMode="contain" style={{ width: 16, height: 16 }} />
              ) : null}
              <AppText size="xsm" weight="medium" tone={active ? 'constant' : 'sub'}>
                {eq}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ gap: 10 }}>
        {visibleExercises.map((ex) => {
          const localAvatar = getExerciseAvatarImage(ex.id);
          const webAvatarUrl = getExerciseAvatarUrl(ex.id);
          return (
            <AppCard key={ex.id} style={{ paddingVertical: 11 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Pressable
                  onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: ex.id })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 14,
                      overflow: 'hidden',
                      backgroundColor: c.thirdBg,
                      borderWidth: 1,
                      borderColor: hexToRgba('#FFFFFF', 0.1),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {localAvatar ? (
                      <Image
                        source={localAvatar}
                        resizeMode="cover"
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : webAvatarUrl ? (
                      <Image
                        source={{ uri: webAvatarUrl }}
                        resizeMode="cover"
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
                      <Ionicons name="barbell-outline" size={24} color={c.constant} />
                    )}
                  </View>

                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <AppText size="md" weight="bold" numberOfLines={1}>
                        {ex.name}
                      </AppText>
                      {ex.isCustom ? (
                        <View
                          style={{
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 6,
                            backgroundColor: hexToRgba(c.warning, 0.2),
                          }}
                        >
                          <AppText size="xsm" weight="bold" style={{ color: c.warning, fontSize: 10 }}>
                            CUSTOM
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                    <AppText size="xsm" tone="sub" numberOfLines={1}>
                      {ex.equipment} • {ex.primaryMuscles.join(', ')}
                    </AppText>
                  </View>
                </Pressable>

                {mode === 'addToWorkout' ? (
                  <AppButton
                    label="Add"
                    size="sm"
                    onPress={() => {
                      addExercise({
                        exerciseId: ex.id,
                        exerciseName: ex.name,
                        equipment: ex.equipment,
                        primaryMuscles: ex.primaryMuscles,
                        defaultWeightKg: ex.includesBodyweight ? 0 : 40,
                      });
                      navigation.goBack();
                      openSheet();
                    }}
                  />
                ) : (
                  <Pressable
                    onPress={() => navigation.navigate('ExerciseDetail', { exerciseId: ex.id })}
                    hitSlop={8}
                  >
                    <Ionicons name="chevron-forward" size={20} color={c.subText} />
                  </Pressable>
                )}
              </View>
            </AppCard>
          );
        })}

        {hasMore ? (
          <AppButton
            label={`Load More (${exercises.length - visibleLimit} remaining)`}
            variant="secondary"
            fullWidth
            onPress={() => setVisibleLimit((n) => n + PAGE_SIZE)}
          />
        ) : null}
      </View>
    </ScreenContainer>
  );
}
