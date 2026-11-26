import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { trpc } from '../../api/trpc';
import { AppButton, AppInput, AppModal, AppText } from '../ui';

interface EditMacroGoalsModalProps {
  visible: boolean;
  onClose: () => void;
  initial: {
    dailyCaloriesGoal: number;
    dailyProteinGoal: number;
    dailyCarbsGoal: number;
    dailyFatGoal: number;
  };
}

export function EditMacroGoalsModal({ visible, onClose, initial }: EditMacroGoalsModalProps) {
  const utils = trpc.useUtils();
  const [calories, setCalories] = useState(String(initial.dailyCaloriesGoal));
  const [protein, setProtein] = useState(String(initial.dailyProteinGoal));
  const [carbs, setCarbs] = useState(String(initial.dailyCarbsGoal));
  const [fat, setFat] = useState(String(initial.dailyFatGoal));

  useEffect(() => {
    if (visible) {
      setCalories(String(initial.dailyCaloriesGoal));
      setProtein(String(initial.dailyProteinGoal));
      setCarbs(String(initial.dailyCarbsGoal));
      setFat(String(initial.dailyFatGoal));
    }
  }, [visible, initial]);

  const updateMutation = trpc.food.updateMacroGoals.useMutation({
    onSuccess: () => {
      utils.food.getMacroGoals.invalidate();
      onClose();
    },
  });

  const p = parseInt(protein, 10) || 0;
  const ch = parseInt(carbs, 10) || 0;
  const f = parseInt(fat, 10) || 0;
  const computedKcal = p * 4 + ch * 4 + f * 9;

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      title="Edit Daily Macro Goals"
      subtitle={`Macro sum ≈ ${computedKcal} kcal`}
    >
      <AppInput
        label="Daily Calories (kcal)"
        keyboardType="number-pad"
        value={calories}
        onChangeText={setCalories}
      />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <AppInput
          label="Protein (g)"
          keyboardType="number-pad"
          value={protein}
          onChangeText={setProtein}
          containerStyle={{ flex: 1 }}
        />
        <AppInput
          label="Carbs (g)"
          keyboardType="number-pad"
          value={carbs}
          onChangeText={setCarbs}
          containerStyle={{ flex: 1 }}
        />
        <AppInput
          label="Fat (g)"
          keyboardType="number-pad"
          value={fat}
          onChangeText={setFat}
          containerStyle={{ flex: 1 }}
        />
      </View>

      <AppText size="xsm" tone="sub" align="center">
        Tip: 4 kcal/g protein & carbs, 9 kcal/g fat.
      </AppText>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <AppButton
          label="Auto-Calc Kcal"
          variant="secondary"
          size="sm"
          onPress={() => setCalories(String(Math.max(800, computedKcal)))}
          style={{ flex: 1 }}
        />
        <AppButton
          label="Save Goals"
          size="sm"
          loading={updateMutation.isPending}
          onPress={() => {
            updateMutation.mutate({
              dailyCaloriesGoal: Math.max(800, Math.min(8000, parseInt(calories, 10) || 2400)),
              dailyProteinGoal: Math.max(20, Math.min(500, p || 160)),
              dailyCarbsGoal: Math.max(0, Math.min(1000, ch || 240)),
              dailyFatGoal: Math.max(10, Math.min(300, f || 65)),
            });
          }}
          style={{ flex: 1.3 }}
        />
      </View>
    </AppModal>
  );
}
