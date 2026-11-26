import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  BAR_TYPES,
  kgToLbs,
  lbsToKg,
  solvePlatesPerSide,
  STANDARD_KG_PLATES,
  STANDARD_LBS_PLATES,
  type WeightUnit,
} from '@apexlift/shared';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import { AppButton, AppModal, AppText, SegmentedControl } from '../ui';

const PLATE_COLORS: Record<number, string> = {
  45: '#2F7BE6',
  35: '#D3A313',
  25: '#22A86B',
  20: '#2F7BE6',
  15: '#D3A313',
  10: '#E5E7EB',
  5: '#E24C4B',
  2.5: '#8B5CF6',
  1.25: '#94A3B8',
};

interface PlateCalcModalProps {
  visible: boolean;
  onClose: () => void;
  initialWeightKg: number;
  defaultUnit: WeightUnit;
  onApplyWeightKg?: (weightKg: number) => void;
}

export function PlateCalcModal({
  visible,
  onClose,
  initialWeightKg,
  defaultUnit,
  onApplyWeightKg,
}: PlateCalcModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [unit, setUnit] = useState<WeightUnit>(defaultUnit);
  const [barId, setBarId] = useState<string>('olympic');
  const [customPlates, setCustomPlates] = useState<number[] | null>(null);

  const selectedBar = BAR_TYPES.find((b) => b.id === barId) ?? BAR_TYPES[0];
  const barWeight = unit === 'lbs' ? selectedBar.weightLbs : selectedBar.weightKg;
  const availablePlates = unit === 'lbs' ? STANDARD_LBS_PLATES : STANDARD_KG_PLATES;

  const targetDisplayWeight = useMemo(() => {
    const raw = unit === 'lbs' ? kgToLbs(initialWeightKg) : initialWeightKg;
    return Math.max(barWeight, Math.round(raw * 2) / 2);
  }, [initialWeightKg, unit, barWeight]);

  const solved = useMemo(
    () => solvePlatesPerSide(targetDisplayWeight, barWeight, availablePlates),
    [targetDisplayWeight, barWeight, availablePlates]
  );

  const platesPerSide = customPlates ?? solved.platesPerSide;
  const sideSum = platesPerSide.reduce((sum, p) => sum + p, 0);
  const totalDisplay = Number((barWeight + sideSum * 2).toFixed(2));
  const totalKg = unit === 'lbs' ? lbsToKg(totalDisplay) : totalDisplay;

  const addPlate = (plate: number) => {
    setCustomPlates([...platesPerSide, plate].sort((a, b) => b - a));
  };

  const removePlateAt = (idx: number) => {
    setCustomPlates(platesPerSide.filter((_, i) => i !== idx));
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      title="Barbell Plate Calculator"
      subtitle="Tap plates to build your bar or auto-solve from set weight"
    >
      <SegmentedControl
        value={unit}
        onChange={(next) => {
          setUnit(next);
          setCustomPlates(null);
        }}
        options={[
          { label: 'Pounds (lbs)', value: 'lbs' },
          { label: 'Kilograms (kg)', value: 'kg' },
        ]}
      />

      {/* Bar Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {BAR_TYPES.map((bar) => {
          const active = bar.id === barId;
          const bw = unit === 'lbs' ? `${bar.weightLbs} lb` : `${bar.weightKg} kg`;
          return (
            <Pressable
              key={bar.id}
              onPress={() => {
                setBarId(bar.id);
                setCustomPlates(null);
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: RADII.pill,
                backgroundColor: active ? hexToRgba(c.constant, 0.2) : c.thirdBg,
                borderWidth: 1,
                borderColor: active ? c.constant : 'transparent',
              }}
            >
              <AppText size="xsm" weight="bold" tone={active ? 'constant' : 'default'}>
                {bar.name} ({bw})
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Total Display */}
      <View
        style={{
          backgroundColor: c.thirdBg,
          borderRadius: RADII.card,
          padding: 14,
          alignItems: 'center',
          gap: 6,
        }}
      >
        <AppText size="xsm" tone="sub">
          TOTAL LOADED WEIGHT
        </AppText>
        <AppText size="xxl" weight="black" tone="constant">
          {totalDisplay} {unit}
        </AppText>
        <AppText size="xsm" tone="sub">
          Bar {barWeight} {unit} + {sideSum} {unit} per side ({platesPerSide.length} plates/side)
        </AppText>

        {/* Visual Barbell Sleeve */}
        <View
          style={{
            marginTop: 8,
            height: 82,
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Shaft */}
          <View style={{ width: 52, height: 10, backgroundColor: '#94A3B8', borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }} />
          {/* Collar */}
          <View style={{ width: 10, height: 24, backgroundColor: '#CBD5E1', borderRadius: 2 }} />
          {/* Loaded Plates */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 4 }}>
            {platesPerSide.length === 0 ? (
              <AppText size="xsm" tone="sub" style={{ paddingHorizontal: 12 }}>
                Empty bar
              </AppText>
            ) : (
              platesPerSide.map((p, idx) => {
                const height = Math.max(30, Math.min(76, 26 + p * (unit === 'lbs' ? 1.1 : 2.0)));
                const bg = PLATE_COLORS[p] ?? c.constant;
                return (
                  <Pressable
                    key={`${p}_${idx}`}
                    onPress={() => removePlateAt(idx)}
                    style={{
                      width: 20,
                      height,
                      borderRadius: 4,
                      backgroundColor: bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: 'rgba(0,0,0,0.35)',
                    }}
                  >
                    <AppText
                      size="xsm"
                      weight="black"
                      style={{ color: p === 10 ? '#111827' : '#FFFFFF', fontSize: 9 }}
                    >
                      {p}
                    </AppText>
                  </Pressable>
                );
              })
            )}
          </View>
          {/* Sleeve end */}
          <View style={{ flex: 1, maxWidth: 42, height: 12, backgroundColor: '#94A3B8', borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
        </View>
      </View>

      {/* Tap to Add Plates */}
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText size="xsm" weight="bold" tone="sub">
            TAP TO ADD PLATE (PER SIDE)
          </AppText>
          <Pressable onPress={() => setCustomPlates([])}>
            <AppText size="xsm" weight="bold" tone="danger">
              Clear
            </AppText>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {availablePlates.map((p) => (
            <Pressable
              key={p}
              onPress={() => addPlate(p)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: hexToRgba(PLATE_COLORS[p] ?? c.constant, 0.2),
                borderWidth: 1,
                borderColor: PLATE_COLORS[p] ?? c.constant,
              }}
            >
              <AppText size="sm" weight="bold">
                +{p} {unit}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <AppButton label="Close" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        {onApplyWeightKg ? (
          <AppButton
            label={`Apply ${totalDisplay} ${unit}`}
            onPress={() => {
              onApplyWeightKg(totalKg);
              onClose();
            }}
            style={{ flex: 1.4 }}
          />
        ) : null}
      </View>
    </AppModal>
  );
}
