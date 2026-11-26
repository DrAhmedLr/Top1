import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { cooper, epley, skinfold, weightedPullupRatio } from '@top1/engine';
import { AppButton, AppCard, AppInput, AppText } from '../ui';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';

type CalcKind = 'cooper' | 'epley' | 'skinfold' | 'pullup';
type LiftMetricId = 'bench_1rm' | 'squat_1rm' | 'deadlift_1rm';

/**
 * Jackson-Pollock 3-site female body-fat equation (Tricep, Suprailiac, Thigh + age) + Siri equation.
 */
function femaleSkinfold3Site(tricepMm: number, suprailiacMm: number, thighMm: number, age: number): number {
  const sum = tricepMm + suprailiacMm + thighMm;
  if (sum <= 5 || age < 18 || age > 80) return NaN;
  const density = 1.0994921 - 0.0009929 * sum + 0.0000023 * sum * sum - 0.0001392 * age;
  return 495 / density - 450;
}

/**
 * Interactive Field Calculators backed directly by Top1.Fit's canonical engine formulas
 * with safe bounds validation (zero uncaught RangeErrors).
 */
export function FieldCalculatorsCard({
  onApply,
}: {
  onApply?: (
    metricId: string,
    value: number,
    method: 'cooper_estimate' | 'epley_estimate' | 'skinfold_estimate' | 'direct_1rm'
  ) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const user = useAuthStore((s) => s.user);
  const bwKg = user?.bodyweightKg ?? 80;
  const age = user?.age ?? 27;
  const sex: 'male' | 'female' = user?.rankingSex === 'Female' ? 'female' : 'male';

  const [kind, setKind] = useState<CalcKind>('epley');
  const [liftTarget, setLiftTarget] = useState<LiftMetricId>('bench_1rm');
  const [a, setA] = useState('100');
  const [b, setB] = useState('5');
  const [cVal, setCVal] = useState('12');

  const nA = parseFloat(a);
  const nB = parseFloat(b);
  const nC = parseFloat(cVal);

  let result: number | null = null;
  let resultUnit = '';
  let targetMetricId: string = liftTarget;
  let targetMethod: 'cooper_estimate' | 'epley_estimate' | 'skinfold_estimate' | 'direct_1rm' = 'epley_estimate';
  let hintText = 'Enter valid values';

  try {
    if (kind === 'cooper') {
      targetMetricId = 'vo2_max';
      targetMethod = 'cooper_estimate';
      hintText = 'Enter distance between 510 and 5000 m';
      if (Number.isFinite(nA) && nA >= 510 && nA <= 5000) {
        const val = cooper(nA);
        if (Number.isFinite(val) && val > 10) {
          result = Number(val.toFixed(1));
          resultUnit = 'mL/kg/min';
        }
      }
    } else if (kind === 'epley') {
      targetMetricId = liftTarget;
      targetMethod = 'epley_estimate';
      hintText = 'Enter weight > 0 kg and 1–10 reps';
      if (Number.isFinite(nA) && nA > 0 && Number.isFinite(nB) && nB >= 1 && nB <= 10 && bwKg > 0) {
        const estKg = epley(nA, Math.round(nB));
        if (Number.isFinite(estKg) && estKg > 0) {
          result = Number((estKg / bwKg).toFixed(2));
          resultUnit = `× BW (${estKg.toFixed(1)} kg)`;
        }
      }
    } else if (kind === 'skinfold') {
      targetMetricId = 'body_fat';
      targetMethod = 'skinfold_estimate';
      hintText = 'Enter 3 skinfold sites (3–80 mm each)';
      if (
        Number.isFinite(nA) && nA >= 3 && nA <= 80 &&
        Number.isFinite(nB) && nB >= 3 && nB <= 80 &&
        Number.isFinite(nC) && nC >= 3 && nC <= 80
      ) {
        const clampedAge = Math.max(18, Math.min(61, age));
        const bf =
          sex === 'female'
            ? femaleSkinfold3Site(nA, nB, nC, clampedAge)
            : skinfold(nA, nB, nC, clampedAge);
        if (Number.isFinite(bf) && bf > 2 && bf < 60) {
          result = Number(bf.toFixed(1));
          resultUnit = '% body fat';
        }
      }
    } else {
      targetMetricId = 'pullup_1rm';
      targetMethod = 'direct_1rm';
      hintText = 'Enter added load ≥ 0 kg and 1–10 reps';
      if (Number.isFinite(nA) && nA >= 0 && Number.isFinite(nB) && nB >= 1 && nB <= 10 && bwKg > 0) {
        const ratio = weightedPullupRatio(nA, Math.round(nB), bwKg);
        if (Number.isFinite(ratio) && ratio >= 0) {
          result = Number(ratio.toFixed(2));
          resultUnit = '× BW added';
        }
      }
    }
  } catch {
    result = null;
  }

  return (
    <AppCard style={{ gap: 10 }}>
      <View>
        <AppText size="xxsm" weight="xbold" tone="constant">
          TOP1% FIELD CALCULATORS
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

      {kind === 'epley' ? (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(
            [
              { id: 'bench_1rm', label: 'Bench Press' },
              { id: 'squat_1rm', label: 'Back Squat' },
              { id: 'deadlift_1rm', label: 'Deadlift' },
            ] as const
          ).map((lift) => {
            const active = liftTarget === lift.id;
            return (
              <Pressable
                key={lift.id}
                onPress={() => setLiftTarget(lift.id)}
                style={{
                  flex: 1,
                  paddingVertical: 6,
                  borderRadius: RADII.input,
                  alignItems: 'center',
                  backgroundColor: active ? hexToRgba(c.check, 0.18) : c.thirdBg,
                  borderWidth: 1,
                  borderColor: active ? c.check : 'transparent',
                }}
              >
                <AppText size="xxsm" weight="bold" tone={active ? 'check' : 'sub'}>
                  {lift.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {kind === 'cooper' ? (
        <AppInput label="12-Minute Run Distance (meters)" keyboardType="decimal-pad" value={a} onChangeText={setA} />
      ) : kind === 'epley' ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <AppInput label="Weight (kg)" keyboardType="decimal-pad" value={a} onChangeText={setA} />
          </View>
          <View style={{ flex: 1 }}>
            <AppInput label="Reps (1–10)" keyboardType="number-pad" value={b} onChangeText={setB} />
          </View>
        </View>
      ) : kind === 'skinfold' ? (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={{ flex: 1 }}>
            <AppInput label={sex === 'male' ? 'Chest (mm)' : 'Tricep (mm)'} keyboardType="decimal-pad" value={a} onChangeText={setA} />
          </View>
          <View style={{ flex: 1 }}>
            <AppInput label={sex === 'male' ? 'Abdomen (mm)' : 'Suprailiac (mm)'} keyboardType="decimal-pad" value={b} onChangeText={setB} />
          </View>
          <View style={{ flex: 1 }}>
            <AppInput label="Thigh (mm)" keyboardType="decimal-pad" value={cVal} onChangeText={setCVal} />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <AppInput label="Added Load (kg)" keyboardType="decimal-pad" value={a} onChangeText={setA} />
          </View>
          <View style={{ flex: 1 }}>
            <AppInput label={`Reps 1–10 (BW ${bwKg}kg)`} keyboardType="number-pad" value={b} onChangeText={setB} />
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
            {result !== null ? `${result} ${resultUnit}` : hintText}
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
