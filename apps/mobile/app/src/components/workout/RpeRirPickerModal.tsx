import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import { AppButton, AppModal, AppText, SegmentedControl } from '../ui';

const RPE_OPTIONS = [
  { value: 6, desc: 'Very light, 4+ reps left' },
  { value: 6.5, desc: 'Light-moderate, ~3-4 reps left' },
  { value: 7, desc: 'Moderate, 3 reps in reserve' },
  { value: 7.5, desc: 'Challenging, 2-3 reps left' },
  { value: 8, desc: 'Hard, 2 reps in reserve' },
  { value: 8.5, desc: 'Very hard, 1-2 reps left' },
  { value: 9, desc: 'Near maximal, 1 rep left' },
  { value: 9.5, desc: 'Could maybe add weight, 0-1 rep' },
  { value: 10, desc: 'Maximum effort, 0 reps left' },
];

const RIR_OPTIONS = [
  { value: 0, desc: 'Failure — 0 reps left' },
  { value: 1, desc: '1 rep left in the tank' },
  { value: 2, desc: '2 reps left (hypertrophy sweet spot)' },
  { value: 3, desc: '3 reps left (controlled volume)' },
  { value: 4, desc: '4 reps left (light / technique)' },
  { value: 5, desc: '5+ reps left (warmup / speed)' },
];

interface RpeRirPickerModalProps {
  visible: boolean;
  onClose: () => void;
  initialRpe: number | null;
  initialRir: number | null;
  onSave: (rpe: number | null, rir: number | null) => void;
}

export function RpeRirPickerModal({
  visible,
  onClose,
  initialRpe,
  initialRir,
  onSave,
}: RpeRirPickerModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [mode, setMode] = useState<'rpe' | 'rir'>(initialRir !== null && initialRpe === null ? 'rir' : 'rpe');
  const [rpe, setRpe] = useState<number | null>(initialRpe);
  const [rir, setRir] = useState<number | null>(initialRir);

  const selectedDesc =
    mode === 'rpe'
      ? RPE_OPTIONS.find((o) => o.value === rpe)?.desc ?? 'Select perceived exertion (6–10)'
      : RIR_OPTIONS.find((o) => o.value === rir)?.desc ?? 'Select reps in reserve (0–5)';

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      title="Effort Rating (RPE / RIR)"
      subtitle={selectedDesc}
    >
      <SegmentedControl
        value={mode}
        onChange={setMode}
        options={[
          { label: 'RPE (6–10)', value: 'rpe' },
          { label: 'RIR (0–5)', value: 'rir' },
        ]}
      />

      {mode === 'rpe' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {RPE_OPTIONS.map((opt) => {
            const active = rpe === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  setRpe(opt.value);
                  setRir(Math.max(0, Math.round(10 - opt.value)));
                }}
                style={{
                  width: '30%',
                  paddingVertical: 12,
                  borderRadius: RADII.input,
                  alignItems: 'center',
                  backgroundColor: active ? hexToRgba(c.constant, 0.22) : c.thirdBg,
                  borderWidth: 1.5,
                  borderColor: active ? c.constant : 'transparent',
                }}
              >
                <AppText size="md" weight="black" tone={active ? 'constant' : 'default'}>
                  {opt.value}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {RIR_OPTIONS.map((opt) => {
            const active = rir === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  setRir(opt.value);
                  setRpe(Math.min(10, Math.max(6, 10 - opt.value)));
                }}
                style={{
                  width: '30%',
                  paddingVertical: 14,
                  borderRadius: RADII.input,
                  alignItems: 'center',
                  backgroundColor: active ? hexToRgba(c.constant, 0.22) : c.thirdBg,
                  borderWidth: 1.5,
                  borderColor: active ? c.constant : 'transparent',
                }}
              >
                <AppText size="md" weight="black" tone={active ? 'constant' : 'default'}>
                  {opt.value} RIR
                </AppText>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <AppButton
          label="Clear"
          variant="ghost"
          onPress={() => {
            onSave(null, null);
            onClose();
          }}
          style={{ flex: 1 }}
        />
        <AppButton
          label="Save"
          onPress={() => {
            onSave(rpe, rir);
            onClose();
          }}
          style={{ flex: 1.5 }}
        />
      </View>
    </AppModal>
  );
}
