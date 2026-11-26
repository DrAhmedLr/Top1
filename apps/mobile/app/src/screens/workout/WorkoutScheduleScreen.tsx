import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../api/trpc';
import { PLAN_COVER_IMAGES } from '../../assets/assetRegistry';
import {
  AppButton,
  AppCard,
  AppInput,
  AppModal,
  AppText,
  ScreenContainer,
  StackHeader,
  useAppAlert,
} from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CURATED_PLANS = [
  {
    name: '8-Week Upper / Lower Strength',
    goal: 'get_stronger',
    daysPerWeek: 4,
    durationWeeks: 8,
    coverKey: 'strength_iron_protocol',
    split: [
      { day: 'Mon', focus: 'Upper Strength' },
      { day: 'Tue', focus: 'Lower Strength' },
      { day: 'Thu', focus: 'Upper Hypertrophy' },
      { day: 'Fri', focus: 'Lower Hypertrophy' },
    ],
  },
  {
    name: '6-Week Push / Pull / Legs',
    goal: 'build_muscle',
    daysPerWeek: 6,
    durationWeeks: 6,
    coverKey: 'muscle_mass_overdrive',
    split: [
      { day: 'Mon', focus: 'Push' },
      { day: 'Tue', focus: 'Pull' },
      { day: 'Wed', focus: 'Legs' },
      { day: 'Thu', focus: 'Push' },
      { day: 'Fri', focus: 'Pull' },
      { day: 'Sat', focus: 'Legs' },
    ],
  },
  {
    name: '12-Week Athletic Full Body',
    goal: 'athletic',
    daysPerWeek: 3,
    durationWeeks: 12,
    coverKey: 'lean_steady_shred',
    split: [
      { day: 'Mon', focus: 'Full Body A (Squat + Bench)' },
      { day: 'Wed', focus: 'Full Body B (Deadlift + OHP)' },
      { day: 'Fri', focus: 'Full Body C (Hypertrophy)' },
    ],
  },
];

export function WorkoutScheduleScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { showAlert } = useAppAlert();
  const utils = trpc.useUtils();

  const scheduleQuery = trpc.workoutSchedule.getSchedule.useQuery();
  const plansQuery = trpc.workoutSchedule.listPlans.useQuery();

  const updateRule = trpc.workoutSchedule.updateRule.useMutation({
    onSuccess: () => {
      utils.workoutSchedule.getSchedule.invalidate();
      setEditingDay(null);
    },
  });

  const startPlan = trpc.workoutSchedule.startPlan.useMutation({
    onSuccess: () => {
      utils.workoutSchedule.listPlans.invalidate();
      showAlert({ title: 'Plan Activated', message: 'Your new training block is now live.' });
    },
  });

  const [editingDay, setEditingDay] = useState<{
    weekday: number;
    title: string;
    isRestDay: boolean;
  } | null>(null);

  const rules = scheduleQuery.data ?? [];
  const plans = plansQuery.data ?? [];
  const activePlan = plans.find((p) => p.isActive);

  return (
    <ScreenContainer scroll>
      <StackHeader title="Schedule & Plans" subtitle="Weekly rhythm & multi-week training blocks" />

      {activePlan ? (
        <AppCard glowColor={c.constant} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText size="xsm" weight="bold" tone="constant">
              ACTIVE TRAINING PLAN
            </AppText>
            <AppText size="xsm" tone="sub">
              Week {activePlan.currentWeek} of {activePlan.durationWeeks}
            </AppText>
          </View>
          <AppText size="lg" weight="black">
            {activePlan.name}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {activePlan.split.map((s, i) => (
              <View
                key={i}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: RADII.pill,
                  backgroundColor: c.thirdBg,
                }}
              >
                <AppText size="xsm" tone="sub">
                  {s.day}: {s.focus}
                </AppText>
              </View>
            ))}
          </View>
        </AppCard>
      ) : null}

      <View style={{ gap: 8 }}>
        <AppText size="md" weight="bold">
          Weekly Schedule (Tap day to edit)
        </AppText>
        {rules.map((r) => (
          <Pressable
            key={r.weekday}
            onPress={() =>
              setEditingDay({
                weekday: r.weekday,
                title: r.title,
                isRestDay: r.isRestDay,
              })
            }
          >
            <AppCard
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 44,
                    paddingVertical: 6,
                    borderRadius: 10,
                    backgroundColor: r.isRestDay ? c.thirdBg : hexToRgba(c.constant, 0.2),
                    alignItems: 'center',
                  }}
                >
                  <AppText size="xsm" weight="bold" tone={r.isRestDay ? 'sub' : 'constant'}>
                    {DAY_NAMES[r.weekday].slice(0, 3)}
                  </AppText>
                </View>
                <View>
                  <AppText size="sm" weight="bold">
                    {r.title}
                  </AppText>
                  <AppText size="xsm" tone="sub">
                    {r.isRestDay ? 'Recovery Day' : 'Training Day'}
                  </AppText>
                </View>
              </View>
              <Ionicons name="create-outline" size={18} color={c.subText} />
            </AppCard>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: 12 }}>
        <AppText size="md" weight="bold">
          Curated Multi-Week Plans
        </AppText>
        {CURATED_PLANS.map((plan) => {
          const cover = PLAN_COVER_IMAGES[plan.coverKey];
          return (
            <AppCard key={plan.name} padding={0} style={{ overflow: 'hidden' }}>
              {cover ? (
                <Image
                  source={cover}
                  resizeMode="cover"
                  style={{ width: '100%', height: 118 }}
                />
              ) : null}
              <View style={{ padding: 14, gap: 8 }}>
                <AppText size="md" weight="black">
                  {plan.name}
                </AppText>
                <AppText size="xsm" tone="sub">
                  {plan.daysPerWeek} days/week • {plan.durationWeeks} weeks
                </AppText>
                <AppButton
                  label={activePlan?.name === plan.name ? 'Active Plan' : 'Start This Plan'}
                  size="sm"
                  variant={activePlan?.name === plan.name ? 'secondary' : 'primary'}
                  loading={startPlan.isPending}
                  onPress={() => startPlan.mutate(plan)}
                />
              </View>
            </AppCard>
          );
        })}
      </View>

      <AppModal
        visible={Boolean(editingDay)}
        onClose={() => setEditingDay(null)}
        title={editingDay ? `Edit ${DAY_NAMES[editingDay.weekday]}` : ''}
      >
        {editingDay ? (
          <View style={{ gap: 12 }}>
            <AppInput
              label="Day Focus"
              value={editingDay.title}
              onChangeText={(title) => setEditingDay({ ...editingDay, title })}
            />
            <Pressable
              onPress={() => setEditingDay({ ...editingDay, isRestDay: !editingDay.isRestDay })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                borderRadius: RADII.input,
                backgroundColor: c.thirdBg,
              }}
            >
              <AppText size="sm" weight="bold">
                Mark as Rest Day
              </AppText>
              <Ionicons
                name={editingDay.isRestDay ? 'checkbox' : 'square-outline'}
                size={22}
                color={editingDay.isRestDay ? c.constant : c.subText}
              />
            </Pressable>
            <AppButton
              label="Save Day"
              loading={updateRule.isPending}
              onPress={() => updateRule.mutate(editingDay)}
              fullWidth
            />
          </View>
        ) : null}
      </AppModal>
    </ScreenContainer>
  );
}
