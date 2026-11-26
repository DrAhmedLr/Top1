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
      void utils.food.getHealthLog.invalidate({ dateIso });
      void utils.wearable.getReadiness.invalidate();
      void utils.physiology.getBodyReport.invalidate();
      void utils.top1.getOverview.invalidate();
      showAlert({ title: 'Health Metrics Saved', message: `Updated recovery stats for ${dateIso}.` });
    },
  });

  const [steps, setSteps] = useState('');
  const [activeCalories, setActiveCalories] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [waterMl, setWaterMl] = useState(0);
  const [restingHr, setRestingHr] = useState('');

  useEffect(() => {
    if (logQuery.data) {
      setSteps(logQuery.data.steps ? String(logQuery.data.steps) : '');
      setActiveCalories(logQuery.data.activeCalories ? String(logQuery.data.activeCalories) : '');
      setSleepHours(
        logQuery.data.sleepMinutes
          ? String(Number((logQuery.data.sleepMinutes / 60).toFixed(1)))
          : ''
      );
      setWaterMl(logQuery.data.waterMl ?? 0);
      setRestingHr(logQuery.data.restingHr ? String(logQuery.data.restingHr) : '');
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
        <AppInput
          label="Daily Steps"
          placeholder="e.g. 8500"
          keyboardType="number-pad"
          value={steps}
          onChangeText={setSteps}
        />
        <AppInput
          label="Active Calories Burned (kcal)"
          placeholder="e.g. 450"
          keyboardType="number-pad"
          value={activeCalories}
          onChangeText={setActiveCalories}
        />
        <AppInput
          label="Sleep Duration (hours)"
          placeholder="e.g. 7.5"
          keyboardType="decimal-pad"
          value={sleepHours}
          onChangeText={setSleepHours}
        />
        <AppInput
          label="Resting Heart Rate (bpm)"
          placeholder="e.g. 58"
          keyboardType="number-pad"
          value={restingHr}
          onChangeText={setRestingHr}
        />
      </AppCard>

      <AppButton
        label="Save Daily Health Metrics"
        loading={upsert.isPending}
        onPress={() => {
          const parsedRhr = parseInt(restingHr, 10);
          upsert.mutate({
            dateIso,
            steps: Math.max(0, parseInt(steps, 10) || 0),
            activeCalories: Math.max(0, parseInt(activeCalories, 10) || 0),
            sleepMinutes: Math.max(0, Math.round((parseFloat(sleepHours) || 0) * 60)),
            waterMl,
            restingHr: Number.isFinite(parsedRhr) && parsedRhr > 0 ? parsedRhr : null,
          });
        }}
        fullWidth
      />
    </ScreenContainer>
  );
}
