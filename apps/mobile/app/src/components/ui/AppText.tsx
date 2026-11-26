import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { TEXT_SIZES, type TextSizeKey } from '../../theme/tokens';
import { useResponsiveLayout } from '../../theme/useResponsiveLayout';
import { useTheme } from '../../theme/ThemeProvider';

export type TextTone =
  | 'default'
  | 'reg'
  | 'sub'
  | 'ghost'
  | 'base'
  | 'constant'
  | 'constantT'
  | 'check'
  | 'positive'
  | 'negative'
  | 'danger'
  | 'white'
  | 'black';

export type TextWeight = 'reg' | 'medium' | 'semibold' | 'bold' | 'xbold' | 'black';

export interface AppTextProps extends TextProps {
  size?: TextSizeKey;
  weight?: TextWeight;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
  tabular?: boolean;
}

export function AppText({
  size = 'sm',
  weight = 'medium',
  tone = 'reg',
  align,
  tabular = false,
  style,
  children,
  ...rest
}: AppTextProps) {
  const { theme } = useTheme();
  const { fontScale } = useResponsiveLayout();
  const c = theme.colors;
  const computedSize = Math.round(TEXT_SIZES[size] * fontScale * 10) / 10;
  const computedLineHeight = Math.round(computedSize * 1.36);

  const colorMap: Record<TextTone, string> = {
    default: c.text,
    reg: c.text,
    sub: c.subText,
    ghost: c.ghostText,
    base: c.baseTint,
    constant: c.constant,
    constantT: c.constantText,
    check: c.check,
    positive: c.positive,
    negative: c.negative,
    danger: c.danger,
    white: '#FFFFFF',
    black: '#000000',
  };

  const resolvedFontFamily = tabular
    ? weight === 'bold' || weight === 'xbold' || weight === 'black'
      ? 'RobotoMonoBold'
      : 'RobotoMonoMedium'
    : theme.fonts[weight];

  return (
    <Text
      style={[
        {
          color: colorMap[tone],
          fontSize: computedSize,
          lineHeight: computedLineHeight,
          fontFamily: resolvedFontFamily,
          textAlign: align,
          fontVariant: tabular ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
