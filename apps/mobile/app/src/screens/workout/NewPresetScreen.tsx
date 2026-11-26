import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../api/trpc';
import {
  AppButton,
  AppCard,
  AppInput,
  AppText,
  ScreenContainer,
  StackHeader,
  useAppAlert,
} from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';

interface DraftPresetExercise {
  exerciseId: string;
  exerciseName: string;
  setsCount: number;
  reps: number;
  weightKg: number;
  restSeconds: number;
}

export function NewPresetScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation();
  const { showAlert } = useAppAlert();
  const utils = trpc.useUtils();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<DraftPresetExercise[]>([]);

  const exercisesQuery = trpc.exercise.list.useQuery({ search });
  const createMutation = trpc.preset.create.useMutation({
    onSuccess: () => {
      utils.preset.list.invalidate();
      navigation.goBack();
    },
    onError: (err) => showAlert({ title: 'Error', message: err.message }),
  });

  const addEx = (ex: { id: string; name: string }) => {
    if (picked.some((p) => p.exerciseId === ex.id)) return;
    setPicked((prev) => [
      ...prev,
      {
        exerciseId: ex.id,
        exerciseName: ex.name,
        setsCount: 3,
        reps: 8,
        weightKg: 50,
        restSeconds: 90,
      },
    ]);
  };

  return (
    <ScreenContainer scroll>
      <StackHeader title="Create Workout Preset" subtitle="Save a repeatable template" />

      <AppCard style={{ gap: 12 }}>
        <AppInput
          label="Template Name"
          placeholder="e.g. Heavy Upper Power"
          value={name}
          onChangeText={setName}
        />
        <AppInput
          label="Description"
          placeholder="Focus, split notes, or tempo"
          value={description}
          onChangeText={setDescription}
        />
      </AppCard>

      {/* Selected Exercises */}
      <View style={{ gap: 8 }}>
        <AppText size="md" weight="bold">
          Selected Exercises ({picked.length})
        </AppText>
        {picked.map((item, idx) => (
          <AppCard key={item.exerciseId} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText size="sm" weight="bold">
                {idx + 1}. {item.exerciseName}
              </AppText>
              <Pressable
                onPress={() => setPicked((prev) => prev.filter((p) => p.exerciseId !== item.exerciseId))}
              >
                <Ionicons name="close-circle" size={20} color={c.danger} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <AppButton
                label={`Sets: ${item.setsCount}`}
                size="sm"
                variant="secondary"
                onPress={() =>
                  setPicked((prev) =>
                    prev.map((p) =>
                      p.exerciseId === item.exerciseId
                        ? { ...p, setsCount: p.setsCount >= 6 ? 1 : p.setsCount + 1 }
                        : p
                    )
                  )
                }
                style={{ flex: 1 }}
              />
              <AppButton
                label={`Reps: ${item.reps}`}
                size="sm"
                variant="secondary"
                onPress={() =>
                  setPicked((prev) =>
                    prev.map((p) =>
                      p.exerciseId === item.exerciseId
                        ? { ...p, reps: p.reps >= 15 ? 5 : p.reps + 2 }
                        : p
                    )
                  )
                }
                style={{ flex: 1 }}
              />
            </View>
          </AppCard>
        ))}
      </View>

      {/* Exercise Picker */}
      <AppCard style={{ gap: 10 }}>
        <AppText size="md" weight="bold">
          Add Exercises
        </AppText>
        <AppInput
          placeholder="Filter library..."
          value={search}
          onChangeText={setSearch}
        />
        <View style={{ gap: 6 }}>
          {(exercisesQuery.data ?? []).slice(0, 14).map((ex) => {
            const isAdded = picked.some((p) => p.exerciseId === ex.id);
            return (
              <Pressable
                key={ex.id}
                onPress={() => addEx(ex)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 9,
                  paddingHorizontal: 10,
                  borderRadius: RADII.input,
                  backgroundColor: isAdded ? hexToRgba(c.check, 0.14) : c.thirdBg,
                }}
              >
                <View style={{ flex: 1 }}>
                  <AppText size="sm" weight="bold">
                    {ex.name}
                  </AppText>
                  <AppText size="xsm" tone="sub">
                    {ex.equipment} • {ex.primaryMuscles[0]}
                  </AppText>
                </View>
                <Ionicons
                  name={isAdded ? 'checkmark-circle' : 'add-circle-outline'}
                  size={22}
                  color={isAdded ? c.check : c.constant}
                />
              </Pressable>
            );
          })}
        </View>
      </AppCard>

      <AppButton
        label="Save Preset"
        loading={createMutation.isPending}
        onPress={() => {
          if (!name.trim() || picked.length === 0) {
            showAlert({
              title: 'Incomplete preset',
              message: 'Enter a name and select at least one exercise.',
            });
            return;
          }
          createMutation.mutate({
            name: name.trim(),
            description: description.trim(),
            isPublic: true,
            exercises: picked.map((p) => ({
              exerciseId: p.exerciseId,
              restSeconds: p.restSeconds,
              notes: '',
              targetSets: Array.from({ length: p.setsCount }, () => ({
                weightKg: p.weightKg,
                reps: p.reps,
                setType: 'normal' as const,
              })),
            })),
          });
        }}
        fullWidth
      />
    </ScreenContainer>
  );
}
