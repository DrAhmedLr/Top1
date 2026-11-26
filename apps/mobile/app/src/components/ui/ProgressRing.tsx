import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from './AppText';

export interface ProgressRingProps {
  progress: number; // 0..1
  size?: number;
  strokeWidth?: number;
  color?: string;
  centerText?: string;
  centerSubText?: string;
  children?: React.ReactNode;
}

export function ProgressRing({
  progress,
  size = 96,
  strokeWidth = 8,
  color,
  centerText,
  centerSubText,
  children,
}: ProgressRingProps) {
  const { theme } = useTheme();
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.thirdBg}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color ?? theme.colors.constant}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        {children ??
          (centerText ? (
            <View style={{ alignItems: 'center' }}>
              <AppText size={size >= 130 ? 'xl' : 'lg'} weight="black" tabular>
                {centerText}
              </AppText>
              {centerSubText ? (
                <AppText size="xsm" tone="sub">
                  {centerSubText}
                </AppText>
              ) : null}
            </View>
          ) : null)}
      </View>
    </View>
  );
}
