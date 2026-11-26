import React, { useEffect, useRef } from 'react';
import { Animated, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';

/**
 * Smooth pulsing shimmer skeleton placeholder to eliminate layout flashes while queries hydrate.
 */
export function SkeletonCard({
  height = 92,
  lines = 2,
  style,
}: {
  height?: number;
  lines?: number;
  style?: ViewStyle;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.72, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          minHeight: height,
          borderRadius: RADII.card,
          backgroundColor: c.secondBg,
          borderWidth: 1,
          borderColor: hexToRgba('#FFFFFF', 0.06),
          padding: 15,
          justifyContent: 'center',
          gap: 10,
          opacity,
        },
        style,
      ]}
    >
      <View
        style={{
          height: 14,
          width: '48%',
          borderRadius: 8,
          backgroundColor: c.thirdBg,
        }}
      />
      {Array.from({ length: Math.max(1, lines - 1) }).map((_, i) => (
        <View
          key={i}
          style={{
            height: 11,
            width: i % 2 === 0 ? '82%' : '64%',
            borderRadius: 8,
            backgroundColor: c.thirdBg,
          }}
        />
      ))}
    </Animated.View>
  );
}
