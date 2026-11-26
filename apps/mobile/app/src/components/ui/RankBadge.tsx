import React from 'react';
import { Animated, Image, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Polygon, Stop } from 'react-native-svg';
import { RANK_COLORS, RANK_DISPLAY_NAMES, type RankTier } from '@apexlift/shared';
import { getRankBadgeImage, getRankGlowImage } from '../../assets/assetRegistry';
import { useFloatEffect } from '../../theme/animations';
import { RANK_SOLID_ACCENT } from '../../theme/rankGradients';
import { AnimatedRankShine } from '../rank/AnimatedRankShine';
import { AppText } from './AppText';

export interface RankBadgeProps {
  tier: RankTier;
  division?: 0 | 1 | 2 | 3;
  size?: number;
  showLabel?: boolean;
  showShine?: boolean;
  floating?: boolean;
}

export function RankBadge({
  tier,
  division = 1,
  size = 64,
  showLabel = false,
  showShine = false,
  floating = false,
}: RankBadgeProps) {
  const palette = RANK_COLORS[tier] ?? RANK_COLORS.Unranked;
  const accent = RANK_SOLID_ACCENT[tier] ?? palette.primary;
  const roman = division === 3 ? 'III' : division === 2 ? 'II' : division === 1 ? 'I' : '';
  const display = RANK_DISPLAY_NAMES[tier] ?? 'Unranked';
  const badgeSource = getRankBadgeImage(tier, division);
  const glowSource = getRankGlowImage(tier);
  const floatY = useFloatEffect(floating ? 4 : 0, 2600);
  const gradId = `rankGrad_${tier}_${size}`;

  const innerBadge = badgeSource ? (
    <Image
      source={badgeSource}
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  ) : (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <SvgGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={palette.primary} />
            <Stop offset="100%" stopColor={palette.accent} />
          </SvgGradient>
        </Defs>
        <Polygon
          points="50,4 92,24 84,74 50,96 16,74 8,24"
          fill={`url(#${gradId})`}
          stroke={palette.primary}
          strokeWidth={4}
        />
        <Polygon
          points="50,15 80,30 74,68 50,84 26,68 20,30"
          fill="rgba(0,0,0,0.22)"
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        <AppText
          size={size >= 84 ? 'lg' : size >= 56 ? 'sm' : 'xsm'}
          weight="black"
          style={{ color: '#FFFFFF' }}
        >
          ?
        </AppText>
      </View>
    </View>
  );

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {showShine && tier !== 'Unranked' ? (
          <AnimatedRankShine size={Math.round(size * 1.9)} baseColor={accent} />
        ) : null}

        {glowSource && size >= 64 ? (
          <Image
            source={glowSource}
            resizeMode="contain"
            style={{
              position: 'absolute',
              width: size * 1.55,
              height: size * 1.55,
              opacity: showShine ? 0.5 : 0.25,
            }}
          />
        ) : null}

        {floating ? (
          <Animated.View style={{ transform: [{ translateY: floatY }] }}>
            {innerBadge}
          </Animated.View>
        ) : (
          innerBadge
        )}
      </View>

      {showLabel ? (
        <AppText size="sm" weight="xbold" style={{ color: accent }}>
          {tier === 'Unranked' ? display : `${display} ${roman}`}
        </AppText>
      ) : null}
    </View>
  );
}
