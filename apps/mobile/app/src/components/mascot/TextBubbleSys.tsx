import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { USE_NATIVE_DRIVER } from '../../theme/animations';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import { AppText } from '../ui/AppText';

export interface TextBubbleSysProps {
  value: string;
  tailPlacement?: 'left' | 'right' | 'bottom';
  withTail?: boolean;
  animated?: boolean;
  interval?: number;
  textAlign?: 'left' | 'center' | 'right';
  onFinish?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Animated Mascot Speech Bubble modeled on mod_07998_TextBubbleSys.js
 * Renders typewriter dialogue reveal with directional SVG tail and crisp border.
 */
export function TextBubbleSys({
  value,
  tailPlacement = 'left',
  withTail = true,
  animated = true,
  interval = 16,
  textAlign = 'left',
  onFinish,
  style,
}: TextBubbleSysProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [visibleLen, setVisibleLen] = useState(animated ? 0 : value.length);
  const popScale = useRef(new Animated.Value(0.94)).current;
  const popOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    popScale.setValue(0.95);
    popOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(popScale, {
        toValue: 1,
        friction: 7,
        tension: 210,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(popOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();

    if (!animated) {
      setVisibleLen(value.length);
      onFinish?.();
      return;
    }

    setVisibleLen(0);
    let idx = 0;
    const step = Math.max(1, Math.ceil(value.length / 42));
    const id = setInterval(() => {
      idx = Math.min(value.length, idx + step);
      setVisibleLen(idx);
      if (idx >= value.length) {
        clearInterval(id);
        onFinish?.();
      }
    }, interval);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, animated, interval]);

  const borderColor = hexToRgba(c.constant, 0.38);
  const bgColor = c.secondBg;

  return (
    <Animated.View
      style={[
        {
          position: 'relative',
          opacity: popOpacity,
          transform: [{ scale: popScale }],
        },
        style,
      ]}
    >
      <View
        style={{
          backgroundColor: bgColor,
          borderRadius: RADII.card,
          borderWidth: 1.5,
          borderColor,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <View style={{ position: 'relative' }}>
          {/* Invisible full-text placeholder reserves exact final height so layout below never shifts */}
          <AppText
            size="sm"
            weight="bold"
            align={textAlign}
            style={{ lineHeight: 20, opacity: 0 }}
            aria-hidden
          >
            {value}
          </AppText>
          <AppText
            size="sm"
            weight="bold"
            align={textAlign}
            style={{ lineHeight: 20, position: 'absolute', top: 0, left: 0, right: 0 }}
          >
            {value.slice(0, visibleLen)}
          </AppText>
        </View>
      </View>

      {withTail && tailPlacement === 'left' ? (
        <View style={{ position: 'absolute', left: -9, top: '42%' }} pointerEvents="none">
          <Svg width={10} height={16} viewBox="0 0 10 16">
            <Path d="M10 0 L0 8 L10 16 Z" fill={bgColor} stroke={borderColor} strokeWidth={1.5} />
          </Svg>
        </View>
      ) : null}

      {withTail && tailPlacement === 'right' ? (
        <View style={{ position: 'absolute', right: -9, top: '42%' }} pointerEvents="none">
          <Svg width={10} height={16} viewBox="0 0 10 16">
            <Path d="M0 0 L10 8 L0 16 Z" fill={bgColor} stroke={borderColor} strokeWidth={1.5} />
          </Svg>
        </View>
      ) : null}

      {withTail && tailPlacement === 'bottom' ? (
        <View style={{ alignSelf: 'center', marginTop: -1 }} pointerEvents="none">
          <Svg width={18} height={10} viewBox="0 0 18 10">
            <Path d="M0 0 L9 10 L18 0 Z" fill={bgColor} stroke={borderColor} strokeWidth={1.5} />
          </Svg>
        </View>
      ) : null}
    </Animated.View>
  );
}
