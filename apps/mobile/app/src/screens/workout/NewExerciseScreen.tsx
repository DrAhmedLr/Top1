import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { EQUIPMENT_TYPES, RANKED_MUSCLE_GROUPS } from '@apexlift/shared';
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

export function NewExerciseScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation();
  const { showAlert } = useAppAlert();
  const utils = trpc.useUtils();

  const [name, setName] = useState('');
  const [equipment, setEquipment] = useState<string>('Barbell');
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>(['Upper Chest']);
  const [instructions, setInstructions] = useState('');

  const createMutation = trpc.exercise.create.useMutation({
    onSuccess: () => {
      utils.exercise.list.invalidate();
      navigation.goBack();
    },
    onError: (err) => {
      showAlert({ title: 'Could not create exercise', message: err.message });
    },
  });

  const toggleMuscle = (m: string) => {
    setSelectedMuscles((prev) =>
      prev.includes(m)
        ? prev.length > 1
          ? prev.filter((x) => x !== m)
          : prev
        : [...prev, m]
    );
  };

  return (
    <ScreenContainer scroll>
      <StackHeader title="Create Custom Exercise" subtitle="Available in all workouts & templates" />

      <AppCard style={{ gap: 14 }}>
        <AppInput
          label="Exercise Name"
          placeholder="e.g. Deficit Pendlay Row"
          value={name}
          onChangeText={setName}
        />

        <View style={{ gap: 6 }}>
          <AppText size="sm" weight="medium" tone="sub">
            Equipment
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {EQUIPMENT_TYPES.map((eq) => {
              const active = equipment === eq;
              return (
                <Pressable
                  key={eq}
                  onPress={() => setEquipment(eq)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: RADII.pill,
                    backgroundColor: active ? hexToRgba(c.constant, 0.2) : c.thirdBg,
                    borderWidth: 1,
                    borderColor: active ? c.constant : 'transparent',
                  }}
                >
                  <AppText size="xsm" weight="bold" tone={active ? 'constant' : 'default'}>
                    {eq}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ gap: 6 }}>
          <AppText size="sm" weight="medium" tone="sub">
            Primary Muscles ({selectedMuscles.length})
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {RANKED_MUSCLE_GROUPS.map((m) => {
              const active = selectedMuscles.includes(m);
              return (
                <Pressable
                  key={m}
                  onPress={() => toggleMuscle(m)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    borderRadius: RADII.pill,
                    backgroundColor: active ? hexToRgba(c.constant, 0.2) : c.thirdBg,
                    borderWidth: 1,
                    borderColor: active ? c.constant : 'transparent',
                  }}
                >
                  <AppText size="xsm" weight="bold" tone={active ? 'constant' : 'default'}>
                    {m}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <AppInput
          label="Form Cues / Notes"
          placeholder="Optional setup or execution cues"
          multiline
          value={instructions}
          onChangeText={setInstructions}
        />
      </AppCard>

      <AppButton
        label="Save Custom Exercise"
        loading={createMutation.isPending}
        onPress={() => {
          if (name.trim().length < 2) {
            showAlert({ title: 'Name required', message: 'Enter at least 2 characters.' });
            return;
          }
          createMutation.mutate({
            name: name.trim(),
            equipment,
            inputType: equipment === 'Bodyweight' ? 'bodyweight_reps' : 'weight_reps',
            primaryMuscles: selectedMuscles,
            secondaryMuscles: [],
            instructions: instructions.trim(),
          });
        }}
        fullWidth
      />
    </ScreenContainer>
  );
}
