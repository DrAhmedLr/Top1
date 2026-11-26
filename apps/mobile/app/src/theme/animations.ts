import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';

export const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * Exact easing curves modeled on mod_03043_animationUtilTs.js
 */
export const MOTION_EASING = {
  smooth: Easing.bezier(0.25, 0.1, 0.25, 1),
  speedUp: Easing.bezier(0.35, 0, 0.15, 1),
  slowDown: Easing.bezier(0.16, 1, 0.3, 1),
  overshoot: Easing.bezier(0.34, 1.56, 0.64, 1),
  anticipate: Easing.bezier(0.68, -0.55, 0.265, 1.55),
  punch: Easing.bezier(0.22, 1.25, 0.36, 1),
};

/**
 * Continuous 360-degree rotation loop (used for AnimatedRankShine & rotating cosmetic borders)
 */
export function useRotationLoop(durationMs = 10000, reverse = false) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: durationMs,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE_DRIVER,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [anim, durationMs]);

  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: reverse ? ['360deg', '0deg'] : ['0deg', '360deg'],
  });

  return { rotate };
}

/**
 * Gentle breathing scale pulse (used for rank glows, sunburst shine, live session badges)
 */
export function usePulseEffect(minScale = 0.96, maxScale = 1.08, durationMs = 2000) {
  const anim = useRef(new Animated.Value(minScale)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: maxScale,
          duration: durationMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(anim, {
          toValue: minScale,
          duration: durationMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, minScale, maxScale, durationMs]);

  return anim;
}

/**
 * Floating vertical bobbing effect for hero badges and streak icons
 */
export function useFloatEffect(amplitude = 5, durationMs = 2800) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: -amplitude,
          duration: durationMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(anim, {
          toValue: amplitude,
          duration: durationMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, amplitude, durationMs]);

  return anim;
}

/**
 * Staggered entrance fade + slide-up animation
 */
export function useFadeFromBottom(delayMs = 0, distance = 14) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;

  useEffect(() => {
    const parallel = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay: delayMs,
        easing: MOTION_EASING.slowDown,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 360,
        delay: delayMs,
        easing: MOTION_EASING.slowDown,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);
    parallel.start();
    return () => parallel.stop();
  }, [opacity, translateY, delayMs]);

  return { opacity, transform: [{ translateY }] };
}

/**
 * Triggerable spring pop (for reactions, checkmarks, tab icons)
 */
export function useBumpSpring() {
  const scale = useRef(new Animated.Value(1)).current;

  const bump = (peak = 1.22) => {
    scale.setValue(0.86);
    Animated.sequence([
      Animated.spring(scale, {
        toValue: peak,
        friction: 4,
        tension: 260,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 180,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  };

  return { scale, bump };
}
