import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppButton, AppCard, AppInput, AppText } from '../ui';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';

const CONVERSIONS = [
  { id: 'glucose', label: 'Glucose', fromUnit: 'mmol/L', toUnit: 'mg/dL', factor: 18.0182 },
  { id: 'lipids', label: 'LDL / HDL / TC', fromUnit: 'mmol/L', toUnit: 'mg/dL', factor: 38.67 },
  { id: 'tg', label: 'Triglycerides', fromUnit: 'mmol/L', toUnit: 'mg/dL', factor: 88.57 },
  { id: 'apob', label: 'ApoB', fromUnit: 'g/L', toUnit: 'mg/dL', factor: 100 },
  { id: 'hba1c', label: 'HbA1c (IFCC→%)', fromUnit: 'mmol/mol', toUnit: '%', factor: 0.09148, offset: 2.152 },
] as const;

/**
 * Clinical Lab Unit Helper (ported from Top1.Fit LabUnitHelper.tsx).
 * Converts European/SI bloodwork units (mmol/L, g/L, mmol/mol) into
 * TOP1% canonical units (mg/dL, %).
 */
export function LabUnitHelperCard({
  onUseValue,
}: {
  onUseValue?: (convertedValue: number) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [selected, setSelected] = useState(0);
  const [rawInput, setRawInput] = useState('5.0');

  const conv = CONVERSIONS[selected];
  const parsed = parseFloat(rawInput);
  const offset = 'offset' in conv ? conv.offset : 0;
  const converted = Number.isFinite(parsed)
    ? Number((parsed * conv.factor + offset).toFixed(1))
    : null;

  return (
    <AppCard style={{ gap: 10 }}>
      <View>
        <AppText size="xxsm" weight="xbold" tone="constant">
          LAB UNIT CONVERTER (SI → TOP1%)
        </AppText>
        <AppText size="sm" weight="black">
          Convert Bloodwork Units
        </AppText>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {CONVERSIONS.map((item, idx) => {
          const active = idx === selected;
          return (
            <Pressable
              key={item.id}
              onPress={() => setSelected(idx)}
              style={{
                paddingHorizontal: 9,
                paddingVertical: 5,
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

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <AppInput
            label={`Lab value (${conv.fromUnit})`}
            keyboardType="decimal-pad"
            value={rawInput}
            onChangeText={setRawInput}
          />
        </View>
        <View
          style={{
            paddingHorizontal: 14,
            paddingVertical: 11,
            borderRadius: RADII.input,
            backgroundColor: hexToRgba(c.constant, 0.16),
            borderWidth: 1,
            borderColor: hexToRgba(c.constant, 0.4),
            alignItems: 'center',
          }}
        >
          <AppText size="xxsm" tone="sub">
            {conv.toUnit}
          </AppText>
          <AppText size="md" weight="black" tone="constant">
            {converted !== null ? converted : '—'}
          </AppText>
        </View>
      </View>

      {onUseValue && converted !== null ? (
        <AppButton
          label={`Apply ${converted} ${conv.toUnit}`}
          size="sm"
          variant="secondary"
          onPress={() => onUseValue(converted)}
        />
      ) : null}
    </AppCard>
  );
}
