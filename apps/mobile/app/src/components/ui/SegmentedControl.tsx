import React from 'react';
import { Pressable, View } from 'react-native';
import { RADII } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from './AppText';

export interface SegmentedOption<T extends string> {
  label: string;
  value: T;
}

export interface SegmentedControlProps<T extends string> {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: c.secondBg,
        borderRadius: RADII.card,
        borderWidth: 1,
        borderColor: c.thirdBg,
        padding: 4,
        gap: 4,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: active ? c.constant : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText
              size="sm"
              weight="bold"
              tone={active ? 'constantT' : 'sub'}
            >
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
