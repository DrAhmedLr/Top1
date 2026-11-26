import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { RankTier } from '@apexlift/shared';
import { RANK_METALLIC_GRADIENTS, RANK_SOLID_ACCENT } from '../../theme/rankGradients';
import { hexToRgba } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';

interface RankProgressBarProps {
  tier: RankTier;
  progress: number; // 0..1
  height?: number;
}

/**
 * Metallic Gradient Rank Progress Bar modeled on mod_06768_RankProgressBar.js
 */
export function RankProgressBar({ tier, progress, height = 10 }: RankProgressBarProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const pct = Math.max(5, Math.min(100, Math.round(progress * 100)));
  const colors = RANK_METALLIC_GRADIENTS[tier] ?? ['#59B9F9', '#97D6FF'];
  const accent = RANK_SOLID_ACCENT[tier] ?? c.constant;

  return (
    <View
      style={{
        height,
        width: '100%',
        borderRadius: 99,
        backgroundColor: hexToRgba(accent, 0.14),
        borderWidth: 1.5,
        borderColor: hexToRgba(accent, 0.55),
        overflow: 'hidden',
      }}
    >
      <LinearGradient
        colors={colors as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: 99,
        }}
      />
    </View>
  );
}
