import React from 'react';
import { Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { hexToRgba, RADII } from '../../theme/tokens';
import { useResponsiveLayout } from '../../theme/useResponsiveLayout';
import { useTheme } from '../../theme/ThemeProvider';

export interface AppCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'second' | 'second_outlined' | 'third' | 'gradient';
  gradientColors?: [string, string];
  elevated?: boolean;
  bordered?: boolean;
  padding?: number;
  glowColor?: string;
  selected?: boolean;
  onPress?: () => void;
}

/**
 * Layered Surface Card modeled on mod_02982_getOverlaySurfaceStyle.js (cardShadow + subtle gradient + hairline)
 */
export function AppCard({
  children,
  style,
  gradientColors,
  elevated = true,
  bordered = true,
  padding,
  glowColor,
  selected = false,
  onPress,
}: AppCardProps) {
  const { theme } = useTheme();
  const { cardPad } = useResponsiveLayout();
  const resolvedPadding = padding ?? cardPad;
  const c = theme.colors;
  const colors = gradientColors ?? c.cardGradient;
  const resolvedGlow = glowColor ?? (selected ? c.constant : undefined);

  const shadowStyle: ViewStyle = elevated
    ? Platform.select<ViewStyle>({
        web: {
          boxShadow: resolvedGlow
            ? `0px 8px 26px ${hexToRgba(resolvedGlow, 0.24)}, 0px 2px 8px rgba(0,0,0,0.35)`
            : theme.dark
              ? '0px 8px 22px rgba(0, 0, 0, 0.36)'
              : '0px 6px 18px rgba(20, 16, 40, 0.08)',
        } as ViewStyle,
        default: {
          shadowColor: resolvedGlow ?? '#000000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: resolvedGlow ? 0.28 : theme.dark ? 0.35 : 0.1,
          shadowRadius: 12,
          elevation: 5,
        },
      }) ?? {}
    : {};

  const containerStyle: StyleProp<ViewStyle> = [
    {
      borderRadius: RADII.card,
      overflow: 'hidden',
      borderWidth: selected ? 1.8 : bordered ? 1 : 0,
      borderColor: resolvedGlow
        ? hexToRgba(resolvedGlow, selected ? 0.9 : 0.55)
        : theme.dark
          ? hexToRgba('#FFFFFF', 0.08)
          : c.thirdBg,
    },
    shadowStyle,
  ];

  const inner = (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.4, y: 1 }}
      style={[{ padding: resolvedPadding }, style]}
    >
      {children}
    </LinearGradient>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          containerStyle,
          { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
        ]}
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{inner}</View>;
}
