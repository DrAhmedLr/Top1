import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { cooper, epley, skinfold, weightedPullupRatio } from '@top1/engine';
import { AppButton, AppCard, AppInput, AppText } from '../ui';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';

type CalcKind = 'cooper' | 'epley' | 'skinfold' | 'pullup';

/**
 * Interactive Field Calculators backed directly by Top1.Fit's canonical engine formulas:
 * - Cooper 12-min run distance (m) → VO2 max (mL/kg/min)
 * - Epley submax lift (weight kg × reps / bodyweight) → 1RM × BW
 * - Jackson-Pollock 3-site skinfold (mm) → Body Fat %
 * - Weighted Pull-Up added load (kg / bodyweight) → × BW added
 */
export function FieldCalculatorsCard({
  onApply,
}: {
  onApply?: (metricId: string, value: number, method: 'cooper_estimate' | 'epley_estimate' | 'skinfold_estimate' | 'direct_1rm') => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const user = useAuthStore((s) => s.user);
  const bwKg = user?.bodyweightKg ?? 80;
  const age = user?.age ?? 27;
  const sex: 'male' | 'female' = user?.rankingSex === 'Female' ? 'female' : 'male';

  const [kind, setKind] = useState<CalcKind>('epley');
  const [a, setA] = useState('100');
  const [b, setB] = useState('5');
  const [cVal, setCVal] = useState('12');

  const nA = parseFloat(a) || 0;
  const nB = parseFloat(b) || 0;
  const nC = parseFloat(cVal) || 0;

  let result: number | null = null;
  let resultUnit = '';
  let targetMetricId = 'bench_1rm';
  let targetMethod: 'cooper_estimate' | 'epley_estimate' | 'skinfold_estimate' | 'direct_1rm' = 'epley_estimate';

  if (kind === 'cooper') {
    const val = cooper(nA);
    result = Number.isFinite(val) && val > 10 ? Number(val.toFixed(1)) : null;
    resultUnit = 'mL/kg/min';
    targetMetricId = 'vo2_max';
    targetMethod = 'cooper_estimate';
  } else if (kind === 'epley') {
    const estKg = epley(nA, Math.max(1, Math.round(nB)));
    result = estKg > 0 && bwKg > 0 ? Number((estKg / bwKg).toFixed(2)) : null;
    resultUnit = `× BW (${estKg.toFixed(1)} kg)`;
    targetMetricId = 'bench_1rm';
    targetMethod = 'epley_estimate';
  } else if (kind === 'skinfold') {
    const bf = nA > 2 && nB > 2 && nC > 2 ? skinfold(nA, nB, nC, age) : NaN;
    result = Number.isFinite(bf) && bf > 2 && bf < 60 ? Number(bf.toFixed(1)) : null;
    resultUnit = '% body fat';
    targetMetricId = 'body_fat';
    targetMethod = 'skinfold_estimate';
  } else {
    const reps = Math.max(1, Math.round(nB || 1));
    const ratio = nA >= 0 && bwKg > 0 ? weightedPullupRatio(nA, reps, bwKg) : NaN;
    result = Number.isFinite(ratio) && ratio > 0 ? Number(ratio.toFixed(2)) : null;
    resultUnit = '× BW added';
    targetMetricId = 'pullup_1rm';
    targetMethod = 'direct_1rm';
  }

  return (
    <AppCard style={{ gap: 10 }}>
      <View>
        <AppText size="xxsm" weight="xbold" tone="constant">
          TOP1.FIT FIELD CALCULATORS
        </AppText>
        <AppText size="sm" weight="black">
          Convert Field Tests to Canonical Benchmarks
        </AppText>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {(
          [
            { id: 'epley', label: 'Epley 1RM' },
            { id: 'cooper', label: 'Cooper VO₂' },
            { id: 'skinfold', label: 'Skinfold BF%' },
            { id: 'pullup', label: 'Weighted Pull-up' },
          ] as const
        ).map((item) => {
          const active = kind === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => {
                setKind(item.id);
                if (item.id === 'cooper') {
                  setA('2850');
                } else if (item.id === 'epley') {
                  setA('100');
                  setB('5');
                } else if (item.id === 'skinfold') {
                  setA('10');
                  setB('16');
                  setCVal('12');
                } else {
                  setA('30');
                  setB('3');
                }
              }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: RADII.pill,
                backgroundColor: active ? hexToRgba(c.constant, 0.22) : c.thirdBg,
                borderWidth: 1,
                borderColor: active ? c.constant : 'transparent',
              }}
            >
              <AppText size="xxsm" weight="bold" tone={active ? 'constant' : 'sub'}>
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {kind === 'cooper' ? (
        <AppInput label="12-Minute Run Distance (meters)" keyboardType="decimal-pad" value={a} onChangeText={setA} />
      ) : kind === 'epley' ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <AppInput label="Weight (kg)" keyboardType="decimal-pad" value={a} onChangeText={setA} />
          </View>
          <View style={{ flex: 1 }}>
            <AppInput label="Reps (1–12)" keyboardType="number-pad" value={b} onChangeText={setB} />
          </View>
        </View>
      ) : kind === 'skinfold' ? (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={{ flex: 1 }}>
            <AppInput label={sex === 'male' ? 'Chest (mm)' : 'Tricep'} keyboardType="decimal-pad" value={a} onChangeText={setA} />
          </View>
          <View style={{ flex: 1 }}>
            <AppInput label={sex === 'male' ? 'Abdomen' : 'Suprailiac'} keyboardType="decimal-pad" value={b} onChangeText={setB} />
          </View>
          <View style={{ flex: 1 }}>
            <AppInput label="Thigh (mm)" keyboardType="decimal-pad" value={cVal} onChangeText={setCVal} />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <AppInput label={`Added Load (kg)`} keyboardType="decimal-pad" value={a} onChangeText={setA} />
          </View>
          <View style={{ flex: 1 }}>
            <AppInput label={`Reps (BW ${bwKg}kg)`} keyboardType="number-pad" value={b} onChangeText={setB} />
          </View>
        </View>
      )}

      <View
        style={{
          padding: 12,
          borderRadius: RADII.input,
          backgroundColor: hexToRgba(c.constant, 0.14),
          borderWidth: 1,
          borderColor: hexToRgba(c.constant, 0.35),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <View style={{ flex: 1 }}>
          <AppText size="xxsm" tone="sub">
            CALCULATED RESULT
          </AppText>
          <AppText size="lg" weight="black" tone="constant">
            {result !== null ? `${result} ${resultUnit}` : 'Enter valid values'}
          </AppText>
        </View>
        {onApply && result !== null ? (
          <AppButton
            label="Log Value"
            size="sm"
            onPress={() => onApply(targetMetricId, result!, targetMethod)}
          />
        ) : null}
      </View>
    </AppCard>
  );
}
