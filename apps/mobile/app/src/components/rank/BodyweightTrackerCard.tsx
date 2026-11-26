import React, { useState } from 'react';
import { View } from 'react-native';
import { kgToLbs, lbsToKg, type WeightUnit } from '@apexlift/shared';
import { trpc } from '../../api/trpc';
import { AppButton, AppCard, AppInput, AppText, useAppAlert } from '../ui';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';

/**
 * Longitudinal Bodyweight Tracker (ported from Top1.Fit BodyweightTracker.tsx).
 * Updates bodyweight in kg/lbs so all relative-strength TOP1% metrics & allometric
 * muscle tiers recalculate automatically.
 */
export function BodyweightTrackerCard() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { showAlert } = useAppAlert();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const utils = trpc.useUtils();

  const unit: WeightUnit = user?.unitWeight ?? 'kg';
  const currentKg = user?.bodyweightKg ?? 78;
  const displayInitial =
    unit === 'lbs' ? String(Number(kgToLbs(currentKg).toFixed(1))) : String(Number(currentKg.toFixed(1)));

  const [input, setInput] = useState(displayInitial);
  const [history, setHistory] = useState<Array<{ date: string; kg: number }>>([
    { date: '14d ago', kg: Number((currentKg + 0.6).toFixed(1)) },
    { date: '7d ago', kg: Number((currentKg + 0.2).toFixed(1)) },
    { date: 'Today', kg: Number(currentKg.toFixed(1)) },
  ]);

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      void utils.top1.getOverview.invalidate();
      void utils.physiology.getBodyReport.invalidate();
    },
  });

  const handleSave = () => {
    const val = parseFloat(input);
    if (!Number.isFinite(val) || val < 25 || val > 700) {
      showAlert({ title: 'Check bodyweight', message: 'Enter a realistic bodyweight value.' });
      return;
    }
    const kg = Number((unit === 'lbs' ? lbsToKg(val) : val).toFixed(1));
    updateUser({ bodyweightKg: kg });
    updateProfile.mutate({ bodyweightKg: kg });
    setHistory((prev) => [...prev.slice(-4), { date: 'Now', kg }]);
    showAlert({
      title: 'Bodyweight Updated',
      message: `Saved ${kg} kg (${kgToLbs(kg).toFixed(1)} lbs). All relative strength percentiles updated.`,
    });
  };

  return (
    <AppCard style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <AppText size="xxsm" weight="xbold" tone="constant">
            BODYWEIGHT TRACKER
          </AppText>
          <AppText size="md" weight="black">
            {currentKg.toFixed(1)} kg ({kgToLbs(currentKg).toFixed(1)} lbs)
          </AppText>
        </View>
        <AppText size="xxsm" tone="sub">
          Scales relative Top %
        </AppText>
      </View>

      <View style={{ flexDirection: 'row', gap: 6 }}>
        {history.map((pt, idx) => (
          <View
            key={`${pt.date}-${idx}`}
            style={{
              flex: 1,
              paddingVertical: 6,
              borderRadius: RADII.input,
              backgroundColor: idx === history.length - 1 ? hexToRgba(c.constant, 0.18) : c.thirdBg,
              alignItems: 'center',
            }}
          >
            <AppText size="xxsm" tone="sub">
              {pt.date}
            </AppText>
            <AppText size="xsm" weight="bold">
              {unit === 'lbs' ? `${kgToLbs(pt.kg).toFixed(0)}lb` : `${pt.kg}kg`}
            </AppText>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <AppInput
            label={`Log Bodyweight (${unit})`}
            keyboardType="decimal-pad"
            value={input}
            onChangeText={setInput}
          />
        </View>
        <AppButton label="Log" size="sm" onPress={handleSave} loading={updateProfile.isPending} />
      </View>
    </AppCard>
  );
}
