import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
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
import type { MainStackParamList } from '../../navigation/types';

export function HealthMetricsScreen() {
  const route = useRoute<RouteProp<MainStackParamList, 'HealthMetrics'>>();
  const { dateIso } = route.params;
  const { showAlert } = useAppAlert();
  const utils = trpc.useUtils();

  const logQuery = trpc.food.getHealthLog.useQuery({ dateIso });
  const upsert = trpc.food.upsertHealthLog.useMutation({
    onSuccess: () => {
      utils.food.getHealthLog.invalidate({ dateIso });
      showAlert({ title: 'Health Metrics Saved', message: `Updated recovery stats for ${dateIso}.` });
    },
  });

  const [steps, setSteps] = useState('8500');
  const [activeCalories, setActiveCalories] = useState('450');
  const [sleepHours, setSleepHours] = useState('7.5');
  const [waterMl, setWaterMl] = useState(2500);
  const [restingHr, setRestingHr] = useState('58');

  useEffect(() => {
    if (logQuery.data) {
      setSteps(String(logQuery.data.steps));
      setActiveCalories(String(logQuery.data.activeCalories));
      setSleepHours(String(Number((logQuery.data.sleepMinutes / 60).toFixed(1))));
      setWaterMl(logQuery.data.waterMl);
      setRestingHr(String(logQuery.data.restingHr ?? 60));
    }
  }, [logQuery.data]);

  return (
    <ScreenContainer scroll>
      <StackHeader title="Health & Recovery" subtitle={`Daily vitals for ${dateIso}`} />

      {/* Water Quick Stepper */}
      <AppCard style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <AppText size="xsm" tone="sub">
              HYDRATION
            </AppText>
            <AppText size="xxl" weight="black" tone="constant">
              {(waterMl / 1000).toFixed(2)} L
            </AppText>
          </View>
          <AppText size="sm" tone="sub">
            {waterMl} ml / 3000 ml goal
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <AppButton
            label="-250 ml"
            variant="secondary"
            size="sm"
            onPress={() => setWaterMl((w) => Math.max(0, w - 250))}
            style={{ flex: 1 }}
          />
          <AppButton
            label="+250 ml"
            size="sm"
            onPress={() => setWaterMl((w) => Math.min(15000, w + 250))}
            style={{ flex: 1 }}
          />
          <AppButton
            label="+500 ml"
            size="sm"
            onPress={() => setWaterMl((w) => Math.min(15000, w + 500))}
            style={{ flex: 1 }}
          />
        </View>
      </AppCard>

      <AppCard style={{ gap: 12 }}>
        <AppInput label="Daily Steps" keyboardType="number-pad" value={steps} onChangeText={setSteps} />
        <AppInput
          label="Active Calories Burned (kcal)"
          keyboardType="number-pad"
          value={activeCalories}
          onChangeText={setActiveCalories}
        />
        <AppInput
          label="Sleep Duration (hours)"
          keyboardType="decimal-pad"
          value={sleepHours}
          onChangeText={setSleepHours}
        />
        <AppInput
          label="Resting Heart Rate (bpm)"
          keyboardType="number-pad"
          value={restingHr}
          onChangeText={setRestingHr}
        />
      </AppCard>

      <AppButton
        label="Save Daily Health Metrics"
        loading={upsert.isPending}
        onPress={() =>
          upsert.mutate({
            dateIso,
            steps: Math.max(0, parseInt(steps, 10) || 0),
            activeCalories: Math.max(0, parseInt(activeCalories, 10) || 0),
            sleepMinutes: Math.max(0, Math.round((parseFloat(sleepHours) || 0) * 60)),
            waterMl,
            restingHr: parseInt(restingHr, 10) || 60,
          })
        }
        fullWidth
      />
    </ScreenContainer>
  );
}
