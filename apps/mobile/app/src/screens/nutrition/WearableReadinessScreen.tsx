import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
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
import { useLocale } from '../../i18n/LocaleProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';

const SOURCES = [
  { id: 'apple_watch', label: 'Apple Watch' },
  { id: 'health_connect', label: 'Health Connect' },
  { id: 'garmin', label: 'Garmin' },
  { id: 'oura', label: 'Oura' },
  { id: 'whoop', label: 'WHOOP' },
] as const;

export function WearableReadinessScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { l } = useLocale();
  const { showAlert } = useAppAlert();
  const utils = trpc.useUtils();

  const query = trpc.wearable.getReadiness.useQuery();
  const upsert = trpc.wearable.upsertSnapshot.useMutation({
    onSuccess: (res) => {
      void utils.wearable.getReadiness.invalidate();
      void utils.physiology.getBodyReport.invalidate();
      void utils.top1.getOverview.invalidate();
      showAlert({
        title: l('Biometrics Synced', 'Biométrie synchronisée', 'تمت مزامنة القياسات الحيوية'),
        message: `Readiness multiplier: ${res.readiness.readinessMultiplier.toFixed(2)}× (${res.readiness.illnessOrOverreachingFlag ? 'Illness/Overreaching Flagged' : 'Clear to train'})`,
      });
    },
    onError: (err) => showAlert({ title: 'Validation Error', message: err.message }),
  });

  const [source, setSource] = useState<(typeof SOURCES)[number]['id']>('apple_watch');
  const [hrv, setHrv] = useState('76');
  const [rhr, setRhr] = useState('52');
  const [sleepHours, setSleepHours] = useState('7.6');
  const [tempDelta, setTempDelta] = useState('0.0');
  const [trimp, setTrimp] = useState('70');

  const readiness = query.data?.readiness;
  const snapshots = query.data?.snapshots ?? [];

  return (
    <ScreenContainer scroll>
      <StackHeader
        title={l('Smartwatch Readiness', 'Disponibilité biométrique', 'جاهزية الساعة الذكية')}
        subtitle={l(
          'Rolling 28-day personal RMSSD HRV, RHR, sleep debt & ACWR baselines',
          'Références personnelles sur 28 jours (VFC RMSSD, FC repos, sommeil)',
          'خطوط أساس شخصية لمدة 28 يوماً لنبض الراحة والنوم وتغير النبض'
        )}
      />

      {readiness ? (
        <AppCard
          glowColor={readiness.illnessOrOverreachingFlag ? c.danger : c.check}
          style={{ gap: 12 }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <AppText size="xxsm" weight="xbold" tone="constant">
                {l('AUTONOMIC READINESS', 'DISPONIBILITÉ AUTONOME', 'الجاهزية العصبية')}
              </AppText>
              <AppText size="xxl" weight="black">
                {Math.round(readiness.readinessMultiplier * 100)}%
              </AppText>
              <AppText size="xsm" tone="sub">
                {readiness.baselineDaysUsed}d rolling baseline • Recovery τ {readiness.recoveryTauModifier.toFixed(2)}×
              </AppText>
            </View>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                backgroundColor: hexToRgba(
                  readiness.illnessOrOverreachingFlag ? c.danger : c.check,
                  0.18
                ),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={readiness.illnessOrOverreachingFlag ? 'warning' : 'heart-circle'}
                size={28}
                color={readiness.illnessOrOverreachingFlag ? c.danger : c.check}
              />
            </View>
          </View>

          {readiness.illnessOrOverreachingFlag ? (
            <View
              style={{
                padding: 10,
                borderRadius: RADII.input,
                backgroundColor: hexToRgba(c.danger, 0.16),
                borderWidth: 1,
                borderColor: hexToRgba(c.danger, 0.45),
              }}
            >
              <AppText size="xsm" weight="bold" style={{ color: c.danger }}>
                Acute systemic strain or illness guardrail active — heavy workout generation is automatically paused.
              </AppText>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[
              {
                label: 'HRV Z-Score',
                val:
                  readiness.deltas.hrvZScore !== null
                    ? `${readiness.deltas.hrvZScore >= 0 ? '+' : ''}${readiness.deltas.hrvZScore} SD`
                    : '—',
              },
              {
                label: 'RHR Delta',
                val:
                  readiness.deltas.rhrDeltaBpm !== null
                    ? `${readiness.deltas.rhrDeltaBpm >= 0 ? '+' : ''}${readiness.deltas.rhrDeltaBpm} bpm`
                    : '—',
              },
              {
                label: '3d Sleep Debt',
                val:
                  readiness.deltas.sleepDebtMinutes3d !== null
                    ? `${readiness.deltas.sleepDebtMinutes3d} min`
                    : '—',
              },
              {
                label: 'Cardio ACWR',
                val: readiness.deltas.cardioAcwr !== null ? `${readiness.deltas.cardioAcwr}×` : '—',
              },
            ].map((stat) => (
              <View
                key={stat.label}
                style={{
                  width: '48%',
                  padding: 10,
                  borderRadius: RADII.input,
                  backgroundColor: c.thirdBg,
                }}
              >
                <AppText size="xxsm" tone="sub">
                  {stat.label}
                </AppText>
                <AppText size="md" weight="black">
                  {stat.val}
                </AppText>
              </View>
            ))}
          </View>

          {readiness.signals.length > 0 ? (
            <View style={{ gap: 4 }}>
              {readiness.signals.map((sig, i) => (
                <AppText key={i} size="xsm" tone="sub">
                  • {sig}
                </AppText>
              ))}
            </View>
          ) : null}
        </AppCard>
      ) : null}

      {/* Daily Sync Form */}
      <AppCard style={{ gap: 12 }}>
        <AppText size="md" weight="black">
          {l('Sync Today’s Morning Snapshot', 'Synchroniser les données du matin', 'مزامنة قياسات الصباح')}
        </AppText>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {SOURCES.map((s) => {
            const active = source === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSource(s.id)}
                style={{
                  paddingHorizontal: 11,
                  paddingVertical: 6,
                  borderRadius: RADII.pill,
                  backgroundColor: active ? hexToRgba(c.constant, 0.22) : c.thirdBg,
                  borderWidth: 1,
                  borderColor: active ? c.constant : 'transparent',
                }}
              >
                <AppText size="xsm" weight="bold" tone={active ? 'constant' : 'sub'}>
                  {s.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <AppInput
            label="HRV RMSSD (ms)"
            keyboardType="decimal-pad"
            value={hrv}
            onChangeText={setHrv}
            containerStyle={{ flex: 1 }}
          />
          <AppInput
            label="Resting HR (bpm)"
            keyboardType="decimal-pad"
            value={rhr}
            onChangeText={setRhr}
            containerStyle={{ flex: 1 }}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <AppInput
            label="Sleep (hours)"
            keyboardType="decimal-pad"
            value={sleepHours}
            onChangeText={setSleepHours}
            containerStyle={{ flex: 1 }}
          />
          <AppInput
            label="Wrist Temp Δ (°C)"
            keyboardType="decimal-pad"
            value={tempDelta}
            onChangeText={setTempDelta}
            containerStyle={{ flex: 1 }}
          />
        </View>

        <AppInput
          label="Cardio Load TRIMP (0–400)"
          keyboardType="decimal-pad"
          value={trimp}
          onChangeText={setTrimp}
        />

        <AppButton
          label={l('Save Biometric Snapshot', 'Enregistrer la biométrie', 'حفظ القياسات الحيوية')}
          loading={upsert.isPending}
          onPress={() =>
            upsert.mutate({
              date: query.data?.today ?? new Date().toISOString().slice(0, 10),
              source,
              hrvRmssdMs: parseFloat(hrv) || undefined,
              hrvStatistic: 'rmssd',
              restingHeartRateBpm: parseFloat(rhr) || undefined,
              totalSleepMinutes: Math.round((parseFloat(sleepHours) || 7.5) * 60),
              wristTempDeviationC: Number.isFinite(parseFloat(tempDelta))
                ? parseFloat(tempDelta)
                : 0,
              cardioLoadTrimp: parseFloat(trimp) || undefined,
            })
          }
          fullWidth
        />
      </AppCard>

      {/* Recent Snapshots */}
      {snapshots.length > 0 ? (
        <AppCard style={{ gap: 8 }}>
          <AppText size="sm" weight="black">
            {l('Recent 7-Day Telemetry', 'Télémétrie 7 jours', 'قياسات آخر 7 أيام')}
          </AppText>
          {snapshots.slice(0, 7).map((s) => (
            <View
              key={s.date}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 6,
                borderBottomWidth: 1,
                borderBottomColor: hexToRgba('#FFFFFF', 0.06),
              }}
            >
              <AppText size="xsm" weight="bold">
                {s.date}
              </AppText>
              <AppText size="xsm" tone="sub">
                HRV {s.hrvRmssdMs ?? '—'}ms • RHR {s.restingHeartRateBpm ?? '—'} •{' '}
                {s.totalSleepMinutes ? `${(s.totalSleepMinutes / 60).toFixed(1)}h` : '—'}
              </AppText>
            </View>
          ))}
        </AppCard>
      ) : null}
    </ScreenContainer>
  );
}
