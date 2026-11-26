import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatWeight } from '@apexlift/shared';
import { trpc } from '../../api/trpc';
import { STREAK_IMAGES } from '../../assets/assetRegistry';
import { TreasureChestModal } from '../../components/fx';
import { JymboDialogue } from '../../components/mascot';
import {
  AppButton,
  AppCard,
  AppInput,
  AppModal,
  AppText,
  ScreenContainer,
  StackHeader,
} from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';

const METRIC_TYPES = ['Bodyweight', 'Chest', 'Arms', 'Waist', 'Quads', 'Body Fat %'];

export function StreaksAndReportsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const user = useAuthStore((s) => s.user);
  const unit = user?.unitWeight ?? 'lbs';
  const measureUnit = user?.unitMeasure ?? 'in';
  const utils = trpc.useUtils();

  const reportQuery = trpc.gamification.getWeeklyReport.useQuery();
  const measurementsQuery = trpc.gamification.listMeasurements.useQuery();

  const [logModalOpen, setLogModalOpen] = useState(false);
  const [chestOpen, setChestOpen] = useState(false);
  const [metricType, setMetricType] = useState('Bodyweight');
  const [metricValue, setMetricValue] = useState('');

  const logMutation = trpc.gamification.logMeasurement.useMutation({
    onSuccess: () => {
      utils.gamification.listMeasurements.invalidate();
      setMetricValue('');
      setLogModalOpen(false);
    },
  });

  const report = reportQuery.data;
  const measurements = measurementsQuery.data ?? [];

  return (
    <ScreenContainer scroll>
      <StackHeader
        title="Streaks & Weekly Report"
        subtitle="Consistency calendar, training volume & body metrics"
      />

      {/* Live Jymbo Check-In */}
      <JymboDialogue
        mascotPose={(report?.streak ?? user?.streaks ?? 0) >= 3 ? 'Congrats' : 'Reminder'}
        mascotSize={84}
        mascotText={
          (report?.streak ?? user?.streaks ?? 0) >= 3
            ? `You're on a ${report?.streak ?? user?.streaks ?? 0}-day streak! Tap your Gold Chest below to crack open bonus Eggs!`
            : 'Keep your weekly workout target alive to unlock Bronze, Silver & Gold Streak Chests!'
        }
      />

      {/* Streak Banner */}
      <AppCard style={{ gap: 14, borderColor: hexToRgba('#F59E0B', 0.5) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => setChestOpen(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            {STREAK_IMAGES.chest_goldtop ? (
              <Image
                source={STREAK_IMAGES.chest_goldtop}
                resizeMode="contain"
                style={{ width: 56, height: 56 }}
              />
            ) : null}
            <View>
              <AppText size="xsm" weight="bold" style={{ color: '#F59E0B' }}>
                ACTIVE STREAK • TAP CHEST
              </AppText>
              <AppText size="xxl" weight="black" tabular>
                {report?.streak ?? user?.streaks ?? 0} Days 🔥
              </AppText>
              <AppText size="xsm" tone="sub">
                Longest streak: {report?.longestStreak ?? user?.longestStreak ?? 0} days
              </AppText>
            </View>
          </Pressable>
          <View style={{ alignItems: 'flex-end' }}>
            <AppText size="lg" weight="black" tone="constant">
              {report?.workoutsCount ?? 0}/{report?.weeklyGoal ?? 4}
            </AppText>
            <AppText size="xsm" tone="sub">
              Weekly Goal
            </AppText>
          </View>
        </View>

        {/* 7-Day Calendar Dots */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {(report?.days ?? []).map((d) => (
            <View key={d.iso} style={{ alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: d.workedOut ? c.check : c.thirdBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={d.workedOut ? 'checkmark' : 'ellipse-outline'}
                  size={18}
                  color={d.workedOut ? '#0F0A18' : c.subText}
                />
              </View>
              <AppText size="xsm" tone="sub">
                {d.label}
              </AppText>
            </View>
          ))}
        </View>
      </AppCard>

      {/* Weekly Totals */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <AppCard style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <AppText size="lg" weight="black" tone="constant">
            {formatWeight(report?.totalVolumeKg ?? 0, unit)}
          </AppText>
          <AppText size="xsm" tone="sub">
            7d Volume
          </AppText>
        </AppCard>
        <AppCard style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <AppText size="lg" weight="black" tone="check">
            {report?.totalSets ?? 0}
          </AppText>
          <AppText size="xsm" tone="sub">
            Sets Done
          </AppText>
        </AppCard>
        <AppCard style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <AppText size="lg" weight="black">
            {report?.totalMinutes ?? 0}m
          </AppText>
          <AppText size="xsm" tone="sub">
            Gym Time
          </AppText>
        </AppCard>
      </View>

      {/* Body Measurements */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText size="md" weight="bold">
            Body Measurements ({measurements.length})
          </AppText>
          <AppButton
            label="+ Log Metric"
            size="sm"
            variant="secondary"
            onPress={() => setLogModalOpen(true)}
          />
        </View>

        {measurements.length === 0 ? (
          <AppCard>
            <AppText size="sm" tone="sub">
              Log bodyweight, waist, arms, or chest measurements to track physique trends.
            </AppText>
          </AppCard>
        ) : (
          measurements.map((m) => (
            <AppCard
              key={m.id}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }}
            >
              <View>
                <AppText size="sm" weight="bold">
                  {m.metricType}
                </AppText>
                <AppText size="xsm" tone="sub">
                  {m.recordedAt.slice(0, 10)}
                </AppText>
              </View>
              <AppText size="md" weight="black" tone="constant">
                {m.value} {m.unit}
              </AppText>
            </AppCard>
          ))
        )}
      </View>

      <AppModal
        visible={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        title="Log Body Measurement"
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {METRIC_TYPES.map((mt) => {
            const active = metricType === mt;
            return (
              <Pressable
                key={mt}
                onPress={() => setMetricType(mt)}
                style={{
                  paddingHorizontal: 11,
                  paddingVertical: 7,
                  borderRadius: RADII.pill,
                  backgroundColor: active ? hexToRgba(c.constant, 0.2) : c.thirdBg,
                  borderWidth: 1,
                  borderColor: active ? c.constant : 'transparent',
                }}
              >
                <AppText size="xsm" weight="bold" tone={active ? 'constant' : 'default'}>
                  {mt}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <AppInput
          label={`Value (${metricType === 'Bodyweight' ? unit : metricType === 'Body Fat %' ? '%' : measureUnit})`}
          keyboardType="decimal-pad"
          placeholder="e.g. 175"
          value={metricValue}
          onChangeText={setMetricValue}
        />

        <AppButton
          label="Save Measurement"
          loading={logMutation.isPending}
          onPress={() => {
            const num = parseFloat(metricValue);
            if (!Number.isFinite(num) || num <= 0) return;
            const u =
              metricType === 'Bodyweight'
                ? unit
                : metricType === 'Body Fat %'
                  ? '%'
                  : measureUnit;
            logMutation.mutate({ metricType, value: num, unit: u });
          }}
          fullWidth
        />
      </AppModal>

      <TreasureChestModal
        visible={chestOpen}
        onClose={() => setChestOpen(false)}
        tier="gold"
        rewardEggs={120}
        rewardLabel="Weekly Streak Chest"
      />
    </ScreenContainer>
  );
}
