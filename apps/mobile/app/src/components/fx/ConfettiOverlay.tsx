import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { USE_NATIVE_DRIVER } from '../../theme/animations';

const CONFETTI_COLORS = [
  '#59B9F9',
  '#FFE066',
  '#71D769',
  '#F472B6',
  '#B465D0',
  '#FF6B6B',
  '#5EDED6',
  '#FFFFFF',
];

interface ConfettiOverlayProps {
  visible: boolean;
  count?: number;
  burstKey?: number;
}

/**
 * 60fps Particle Confetti Burst modeled on mod_06216_Confetti.js
 */
export function ConfettiOverlay({ visible, count = 34, burstKey = 0 }: ConfettiOverlayProps) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, idx) => {
        const angle = (idx / count) * Math.PI * 2 + (idx % 3) * 0.2;
        const speed = 95 + (idx % 7) * 32;
        return {
          id: idx,
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed - 70,
          rot: ((idx % 2 === 0 ? 1 : -1) * (180 + (idx % 5) * 90)),
          size: 7 + (idx % 4) * 3,
          color: CONFETTI_COLORS[idx % CONFETTI_COLORS.length],
          isCircle: idx % 3 === 0,
        };
      }),
    [count]
  );

  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 1550,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [visible, burstKey, progress]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {particles.map((p) => {
          const translateX = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, p.dx],
          });
          const translateY = progress.interpolate({
            inputRange: [0, 0.35, 1],
            outputRange: [0, p.dy * 0.85, p.dy + 210],
          });
          const opacity = progress.interpolate({
            inputRange: [0, 0.12, 0.72, 1],
            outputRange: [0, 1, 1, 0],
          });
          const rotate = progress.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', `${p.rot}deg`],
          });
          const scale = progress.interpolate({
            inputRange: [0, 0.2, 1],
            outputRange: [0.3, 1.15, 0.7],
          });

          return (
            <Animated.View
              key={p.id}
              style={{
                position: 'absolute',
                width: p.size,
                height: p.isCircle ? p.size : p.size * 0.55,
                borderRadius: p.isCircle ? p.size / 2 : 2,
                backgroundColor: p.color,
                opacity,
                transform: [{ translateX }, { translateY }, { rotate }, { scale }],
              }}
            />
          );
        })}
      </View>
    </View>
  );
}
