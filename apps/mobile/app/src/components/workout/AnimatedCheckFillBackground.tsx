import React, { useEffect, useRef, useState } from 'react';
import { Animated, type LayoutChangeEvent } from 'react-native';
import { MOTION_EASING, USE_NATIVE_DRIVER } from '../../theme/animations';

interface AnimatedCheckFillBackgroundProps {
  checked: boolean;
  backgroundColor: string;
}

/**
 * Exact 250ms right-to-left fluid green sweep modeled on mod_07026_AnimatedCheckFillBackgroundTsx.js
 * Measures exact row width so unchecked rows stay 100% clean at every viewport width.
 */
export function AnimatedCheckFillBackground({
  checked,
  backgroundColor,
}: AnimatedCheckFillBackgroundProps) {
  const [rowWidth, setRowWidth] = useState(500);
  const progress = useRef(new Animated.Value(checked ? 1 : 0)).current;

  useEffect(() => {
    if (checked) {
      Animated.timing(progress, {
        toValue: 1,
        duration: 250,
        easing: MOTION_EASING.speedUp,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: 160,
        easing: MOTION_EASING.smooth,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    }
  }, [checked, progress]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - rowWidth) > 2) setRowWidth(w);
  };

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [rowWidth + 8, 0],
  });

  const opacity = progress.interpolate({
    inputRange: [0, 0.05, 1],
    outputRange: [0, 1, 1],
  });

  return (
    <Animated.View
      onLayout={onLayout}
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor,
        opacity,
        transform: [{ translateX }],
      }}
    />
  );
}
