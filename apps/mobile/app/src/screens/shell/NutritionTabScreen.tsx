import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../api/trpc';
import { BarcodeScannerModal } from '../../components/nutrition/BarcodeScannerModal';
import { EditMacroGoalsModal } from '../../components/nutrition/EditMacroGoalsModal';
import {
  AppButton,
  AppCard,
  AppText,
  ProgressRing,
  ScreenContainer,
} from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import type { MainStackParamList } from '../../navigation/types';

const MEALS: Array<{ key: 'breakfast' | 'lunch' | 'dinner' | 'snack'; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
  { key: 'lunch', label: 'Lunch', icon: 'restaurant-outline' },
  { key: 'dinner', label: 'Dinner', icon: 'moon-outline' },
  { key: 'snack', label: 'Snacks', icon: 'cafe-outline' },
];

function shiftDateIso(dateIso: string, deltaDays: number): string {
  const dt = new Date(`${dateIso}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

export function NutritionTabScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const utils = trpc.useUtils();

  const [dateIso, setDateIso] = useState(new Date().toISOString().slice(0, 10));
  const [macroModalOpen, setMacroModalOpen] = useState(false);
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);

  const goalsQuery = trpc.food.getMacroGoals.useQuery();
  const logsQuery = trpc.food.getLogsByDate.useQuery({ dateIso });
  const healthQuery = trpc.food.getHealthLog.useQuery({ dateIso });

  const deleteLog = trpc.food.deleteLog.useMutation({
    onSuccess: () => utils.food.getLogsByDate.invalidate({ dateIso }),
  });

  const goals = goalsQuery.data ?? {
    dailyCaloriesGoal: 2500,
    dailyProteinGoal: 185,
    dailyCarbsGoal: 270,
    dailyFatGoal: 70,
  };
  const totals = logsQuery.data?.totals ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const logs = logsQuery.data?.logs ?? [];
  const health = healthQuery.data;

  const calProgress = Math.min(1, totals.calories / Math.max(1, goals.dailyCaloriesGoal));
  const calRemaining = Math.max(0, goals.dailyCaloriesGoal - totals.calories);

  const macroBars = [
    { label: 'Protein', val: totals.proteinG, goal: goals.dailyProteinGoal, color: c.constant },
    { label: 'Carbs', val: totals.carbsG, goal: goals.dailyCarbsGoal, color: c.check },
    { label: 'Fat', val: totals.fatG, goal: goals.dailyFatGoal, color: c.warning },
  ];

  return (
    <ScreenContainer scroll>
      {/* Header & Date Switcher */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <AppText size="xxl" weight="black">
            Nutrition
          </AppText>
          <AppText size="sm" tone="sub">
            Fuel recovery, hit protein & track daily health
          </AppText>
        </View>
        <Pressable
          onPress={() => setMacroModalOpen(true)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: RADII.pill,
            backgroundColor: c.secondBg,
            borderWidth: 1,
            borderColor: c.thirdBg,
          }}
        >
          <AppText size="xsm" weight="bold" tone="constant">
            Edit Goals
          </AppText>
        </Pressable>
      </View>

      {/* Date Bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: c.secondBg,
          borderRadius: RADII.card,
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: c.thirdBg,
        }}
      >
        <Pressable onPress={() => setDateIso((d) => shiftDateIso(d, -1))} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </Pressable>
        <AppText size="sm" weight="bold">
          {dateIso === new Date().toISOString().slice(0, 10) ? `Today • ${dateIso}` : dateIso}
        </AppText>
        <Pressable onPress={() => setDateIso((d) => shiftDateIso(d, 1))} hitSlop={10}>
          <Ionicons name="chevron-forward" size={22} color={c.text} />
        </Pressable>
      </View>

      {/* Calorie Ring + Macro Bars */}
      <AppCard style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <ProgressRing
            size={112}
            strokeWidth={11}
            progress={calProgress}
            color={totals.calories > goals.dailyCaloriesGoal ? c.warning : c.constant}
            centerText={`${totals.calories}`}
            centerSubText={`/${goals.dailyCaloriesGoal}`}
          />
          <View style={{ flex: 1, gap: 10 }}>
            <View>
              <AppText size="xsm" tone="sub">
                REMAINING CALORIES
              </AppText>
              <AppText size="xl" weight="black">
                {calRemaining} kcal left
              </AppText>
            </View>
            {macroBars.map((m) => {
              const pct = Math.min(100, Math.round((m.val / Math.max(1, m.goal)) * 100));
              return (
                <View key={m.label} style={{ gap: 3 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText size="xsm" weight="bold">
                      {m.label}
                    </AppText>
                    <AppText size="xsm" tone="sub">
                      {m.val}g / {m.goal}g
                    </AppText>
                  </View>
                  <View style={{ height: 6, borderRadius: 99, backgroundColor: c.thirdBg, overflow: 'hidden' }}>
                    <View style={{ width: `${pct}%`, height: '100%', backgroundColor: m.color }} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Action Row */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <AppButton
            label="+ Log Food"
            size="sm"
            onPress={() => navigation.navigate('FoodSearch', { dateIso, mealType: 'lunch', initialTab: 'search' })}
            style={{ flex: 1.2 }}
          />
          <AppButton
            label="Scan UPC"
            size="sm"
            variant="secondary"
            onPress={() => setBarcodeModalOpen(true)}
            style={{ flex: 1 }}
          />
          <AppButton
            label="Bundles"
            size="sm"
            variant="secondary"
            onPress={() => navigation.navigate('FoodSearch', { dateIso, mealType: 'lunch', initialTab: 'bundles' })}
            style={{ flex: 1 }}
          />
        </View>
      </AppCard>

      {/* Smartwatch Biometric Readiness Row */}
      <Pressable onPress={() => navigation.navigate('WearableReadiness')}>
        <AppCard
          glowColor={c.constant}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: hexToRgba(c.constant, 0.18),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="watch-outline" size={22} color={c.constant} />
            </View>
            <View>
              <AppText size="md" weight="bold">
                Smartwatch Readiness (HRV / ACWR)
              </AppText>
              <AppText size="xsm" tone="sub">
                28-day personal RMSSD baseline, sleep debt & illness guardrail
              </AppText>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.constant} />
        </AppCard>
      </Pressable>

      {/* Health Snapshot Row */}
      <Pressable onPress={() => navigation.navigate('HealthMetrics', { dateIso })}>
        <AppCard style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: hexToRgba(c.check, 0.16),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="heart-outline" size={22} color={c.check} />
            </View>
            <View>
              <AppText size="md" weight="bold">
                Daily Health Metrics
              </AppText>
              <AppText size="xsm" tone="sub">
                {(health?.steps ?? 0).toLocaleString()} steps •{' '}
                {((health?.waterMl ?? 0) / 1000).toFixed(1)}L water •{' '}
                {((health?.sleepMinutes ?? 0) / 60).toFixed(1)}h sleep
              </AppText>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.subText} />
        </AppCard>
      </Pressable>

      {/* Meal Sections */}
      <View style={{ gap: 10 }}>
        {MEALS.map((meal) => {
          const mealLogs = logs.filter((l) => l.mealType === meal.key);
          const mealKcal = Math.round(mealLogs.reduce((s, l) => s + l.calories, 0));
          return (
            <AppCard key={meal.key} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name={meal.icon} size={18} color={c.constant} />
                  <AppText size="md" weight="bold">
                    {meal.label}
                  </AppText>
                  <AppText size="xsm" tone="sub">
                    ({mealKcal} kcal)
                  </AppText>
                </View>
                <Pressable
                  onPress={() =>
                    navigation.navigate('FoodSearch', {
                      dateIso,
                      mealType: meal.key,
                      initialTab: 'search',
                    })
                  }
                >
                  <AppText size="xsm" weight="bold" tone="constant">
                    + Add
                  </AppText>
                </Pressable>
              </View>

              {mealLogs.length === 0 ? (
                <AppText size="xsm" tone="sub">
                  Nothing logged yet
                </AppText>
              ) : (
                mealLogs.map((item) => (
                  <View
                    key={item.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: 6,
                      borderTopWidth: 1,
                      borderTopColor: c.thirdBg,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText size="sm" weight="bold">
                        {item.foodName} ({item.servings}×)
                      </AppText>
                      <AppText size="xsm" tone="sub">
                        {Math.round(item.calories)} kcal • P {Math.round(item.proteinG)}g • C{' '}
                        {Math.round(item.carbsG)}g • F {Math.round(item.fatG)}g
                      </AppText>
                    </View>
                    <Pressable onPress={() => deleteLog.mutate({ id: item.id })} hitSlop={8}>
                      <Ionicons name="trash-outline" size={16} color={c.subText} />
                    </Pressable>
                  </View>
                ))
              )}
            </AppCard>
          );
        })}
      </View>

      <EditMacroGoalsModal
        visible={macroModalOpen}
        onClose={() => setMacroModalOpen(false)}
        initial={goals}
      />

      <BarcodeScannerModal
        visible={barcodeModalOpen}
        onClose={() => setBarcodeModalOpen(false)}
        dateIso={dateIso}
        mealType="lunch"
      />
    </ScreenContainer>
  );
}
