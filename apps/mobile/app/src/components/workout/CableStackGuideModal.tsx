import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppButton, AppInput, AppModal, AppText } from '../ui';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';

const PULLEY_RATIOS = [
  { id: '1:1', label: '1:1 Direct', multiplier: 1.0, hint: 'Lat pulldown / direct single cable' },
  { id: '2:1', label: '2:1 Dual', multiplier: 0.5, hint: 'Functional trainer / standard cable fly' },
  { id: '4:1', label: '4:1 Compound', multiplier: 0.25, hint: 'Speed pulley / double-block stack' },
] as const;

/**
 * Cable Stack Weight Guide (ported from Liftoff 2.18.1 WeightGuideCableStacks)
 * Converts pin-selected cable stack weight into effective mechanical load
 * accounting for pulley ratio and bilateral vs unilateral handles.
 */
export function CableStackGuideModal({
  visible,
  onClose,
  unit = 'kg',
  onApplyEffectiveWeight,
}: {
  visible: boolean;
  onClose: () => void;
  unit?: 'kg' | 'lbs';
  onApplyEffectiveWeight?: (value: number) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [stackInput, setStackInput] = useState('40');
  const [ratioIdx, setRatioIdx] = useState(1); // default 2:1
  const [handles, setHandles] = useState<1 | 2>(1);

  const rawStack = parseFloat(stackInput);
  const stackNum = Number.isFinite(rawStack) ? Math.max(0, rawStack) : 0;
  const ratio = PULLEY_RATIOS[ratioIdx];
  const effectiveLoad = Number((stackNum * ratio.multiplier * handles).toFixed(1));

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      title="Cable Stack Weight Guide"
      subtitle="Convert machine pin weight to true effective resistance"
    >
      <View style={{ gap: 12 }}>
        <AppInput
          label={`Pin Stack Reading (${unit.toUpperCase()})`}
          keyboardType="decimal-pad"
          value={stackInput}
          onChangeText={setStackInput}
        />

        <View style={{ gap: 6 }}>
          <AppText size="xxsm" weight="bold" tone="sub">
            PULLEY RATIO
          </AppText>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {PULLEY_RATIOS.map((p, idx) => {
              const active = idx === ratioIdx;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setRatioIdx(idx)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: RADII.input,
                    alignItems: 'center',
                    backgroundColor: active ? hexToRgba(c.constant, 0.22) : c.thirdBg,
                    borderWidth: 1,
                    borderColor: active ? c.constant : 'transparent',
                  }}
                >
                  <AppText size="sm" weight="black" tone={active ? 'constant' : 'default'}>
                    {p.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <AppText size="xxsm" tone="sub">
            {ratio.hint}
          </AppText>
        </View>

        <View style={{ gap: 6 }}>
          <AppText size="xxsm" weight="bold" tone="sub">
            HANDLES USED
          </AppText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([1, 2] as const).map((h) => {
              const active = handles === h;
              return (
                <Pressable
                  key={h}
                  onPress={() => setHandles(h)}
                  style={{
                    flex: 1,
                    paddingVertical: 9,
                    borderRadius: RADII.input,
                    alignItems: 'center',
                    backgroundColor: active ? hexToRgba(c.constant, 0.22) : c.thirdBg,
                    borderWidth: 1,
                    borderColor: active ? c.constant : 'transparent',
                  }}
                >
                  <AppText size="sm" weight="bold" tone={active ? 'constant' : 'default'}>
                    {h === 1 ? 'Single Stack (1x)' : 'Dual Stacks (2x)'}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View
          style={{
            padding: 14,
            borderRadius: RADII.card,
            backgroundColor: hexToRgba(c.constant, 0.14),
            borderWidth: 1,
            borderColor: hexToRgba(c.constant, 0.4),
            alignItems: 'center',
            gap: 4,
          }}
        >
          <AppText size="xxsm" weight="bold" tone="constant">
            TRUE EFFECTIVE LOAD
          </AppText>
          <AppText size="xxl" weight="black">
            {effectiveLoad} {unit}
          </AppText>
          <AppText size="xxsm" tone="sub">
            {stackNum} {unit} × {ratio.id} pulley × {handles} stack{handles > 1 ? 's' : ''}
          </AppText>
        </View>

        {onApplyEffectiveWeight ? (
          <AppButton
            label={`Apply ${effectiveLoad} ${unit} to Active Set`}
            onPress={() => {
              onApplyEffectiveWeight(effectiveLoad);
              onClose();
            }}
            fullWidth
          />
        ) : (
          <AppButton label="Close Guide" variant="secondary" onPress={onClose} fullWidth />
        )}
      </View>
    </AppModal>
  );
}
