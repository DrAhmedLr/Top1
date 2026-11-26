import React from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatWeight } from '@apexlift/shared';
import { trpc } from '../../api/trpc';
import {
  AppButton,
  AppCard,
  AppText,
  ScreenContainer,
  StackHeader,
  useAppAlert,
} from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import type { MainStackParamList } from '../../navigation/types';

export function PresetDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, 'PresetDetail'>>();
  const { presetId } = route.params;
  const { showAlert } = useAppAlert();
  const utils = trpc.useUtils();

  const user = useAuthStore((s) => s.user);
  const unit = user?.unitWeight ?? 'lbs';
  const startFromPreset = useWorkoutStore((s) => s.startFromPreset);

  const presetQuery = trpc.preset.getById.useQuery({ id: presetId });
  const copyMutation = trpc.preset.copyFromUser.useMutation({
    onSuccess: () => {
      utils.preset.list.invalidate();
      showAlert({ title: 'Template Saved', message: 'A copy was added to your Workouts library.' });
    },
  });

  const preset = presetQuery.data;

  return (
    <ScreenContainer scroll>
      <StackHeader
        title={preset?.name ?? 'Workout Preset'}
        subtitle={preset ? `${preset.exercises.length} exercises` : undefined}
      />

      {preset ? (
        <>
          {preset.description ? (
            <AppCard>
              <AppText size="sm" tone="sub">
                {preset.description}
              </AppText>
            </AppCard>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <AppButton
              label="Start This Workout"
              onPress={() => {
                startFromPreset(preset);
                navigation.goBack();
              }}
              style={{ flex: 1.5 }}
            />
            <AppButton
              label="Duplicate"
              variant="secondary"
              loading={copyMutation.isPending}
              onPress={() => copyMutation.mutate({ presetId: preset.id })}
              style={{ flex: 1 }}
            />
          </View>

          <View style={{ gap: 10 }}>
            {preset.exercises.map((ex, idx) => (
              <AppCard key={ex.id} style={{ gap: 6 }}>
                <AppText size="md" weight="bold">
                  {idx + 1}. {ex.exerciseName}
                </AppText>
                <AppText size="xsm" tone="sub">
                  {ex.equipment} • {ex.primaryMuscles.join(', ')} • Rest {ex.restSeconds}s
                </AppText>
                {ex.targetSets.map((s, si) => (
                  <AppText key={si} size="sm" tone="sub">
                    Set {si + 1}: {formatWeight(s.weightKg, unit)} × {s.reps} reps
                  </AppText>
                ))}
              </AppCard>
            ))}
          </View>
        </>
      ) : null}
    </ScreenContainer>
  );
}
