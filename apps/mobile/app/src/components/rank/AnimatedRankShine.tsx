import React from 'react';
import { Animated } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { usePulseEffect, useRotationLoop } from '../../theme/animations';

interface AnimatedRankShineProps {
  size?: number;
  baseColor?: string;
}

/**
 * Exact radial sunburst SVG path from mod_06646_RankShine.js
 * Animated with 10s continuous 360deg rotation + 2s breathing scale (mod_06645_AnimatedRankShineTsx.js)
 */
export function AnimatedRankShine({ size = 140, baseColor = '#59B9F9' }: AnimatedRankShineProps) {
  const { rotate } = useRotationLoop(10000);
  const pulse = usePulseEffect(0.95, 1.18, 2200);
  const gradId = `rankShine_${baseColor.replace(/[^a-zA-Z0-9]/g, '')}_${size}`;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pulse }, { rotate }],
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 256 256" fill="none">
        <Defs>
          <RadialGradient
            id={gradId}
            cx="128"
            cy="128"
            r="128"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={baseColor} stopOpacity="0.6" />
            <Stop offset="0.65" stopColor={baseColor} stopOpacity="0.18" />
            <Stop offset="1" stopColor={baseColor} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Path
          d="M80.4075 0L48.0469 19.9981L110.108 117.272L0 108.832V148.828L110.108 139.136L48.0469 236.002L80.4075 256L128.125 150.068L176.048 256L208.408 236.002L146.143 139.136L256 148.324V108.327L146.143 117.272L208.407 19.9981L176.046 0L128.125 106.34L80.4075 0Z"
          fill={`url(#${gradId})`}
        />
      </Svg>
    </Animated.View>
  );
}
