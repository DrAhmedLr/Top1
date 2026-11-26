import React, { useEffect, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import { selectionHaptic } from '../../utils/haptics';
import { playSound } from '../../utils/soundscape';
import { AppText } from './AppText';

export interface WheelPickerProps {
  values: Array<string | number>;
  selectedIndex: number;
  onChange: (index: number, value: string | number) => void;
  unit?: string;
  label?: string;
  itemHeight?: number;
  visibleCount?: 3 | 5;
  style?: StyleProp<ViewStyle>;
}

/**
 * Tactile vertical snap drum/wheel picker with center highlight lens,
 * haptic detent feedback, and tick.mp3 soundscape on every stop.
 */
export function WheelPicker({
  values,
  selectedIndex,
  onChange,
  unit,
  label,
  itemHeight = 42,
  visibleCount = 3,
  style,
}: WheelPickerProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const scrollRef = useRef<ScrollView>(null);
  const lastIdxRef = useRef(selectedIndex);
  const padCount = Math.floor(visibleCount / 2);
  const containerHeight = itemHeight * visibleCount;

  useEffect(() => {
    const safeIdx = Math.max(0, Math.min(values.length - 1, selectedIndex));
    lastIdxRef.current = safeIdx;
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: safeIdx * itemHeight, animated: false });
    }, 30);
    return () => clearTimeout(id);
  }, [selectedIndex, itemHeight, values.length]);

  const commitIndex = (idx: number, smooth = true) => {
    const clamped = Math.max(0, Math.min(values.length - 1, idx));
    if (clamped !== lastIdxRef.current) {
      lastIdxRef.current = clamped;
      selectionHaptic();
      playSound('tick', 0.35);
      onChange(clamped, values[clamped]);
    }
    scrollRef.current?.scrollTo({ y: clamped * itemHeight, animated: smooth });
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / itemHeight);
    commitIndex(idx, true);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(values.length - 1, Math.round(y / itemHeight)));
    if (idx !== lastIdxRef.current) {
      lastIdxRef.current = idx;
      selectionHaptic();
      playSound('tick', 0.25);
      onChange(idx, values[idx]);
    }
  };

  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? (
        <AppText size="xsm" weight="bold" tone="sub" align="center">
          {label.toUpperCase()}
        </AppText>
      ) : null}
      <View
        style={{
          height: containerHeight,
          borderRadius: RADII.card,
          backgroundColor: c.thirdBg,
          borderWidth: 1,
          borderColor: hexToRgba(c.constant, 0.28),
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Center Highlight Lens */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 6,
            right: 6,
            top: padCount * itemHeight,
            height: itemHeight,
            borderRadius: 10,
            backgroundColor: hexToRgba(c.constant, 0.18),
            borderWidth: 1.5,
            borderColor: hexToRgba(c.constant, 0.65),
          }}
        />

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={itemHeight}
          decelerationRate="fast"
          scrollEventThrottle={32}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          contentContainerStyle={{
            paddingVertical: padCount * itemHeight,
          }}
        >
          {values.map((val, i) => {
            const active = i === selectedIndex;
            return (
              <Pressable
                key={`${val}_${i}`}
                onPress={() => commitIndex(i, true)}
                style={{
                  height: itemHeight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 4,
                }}
              >
                <AppText
                  size={active ? 'lg' : 'sm'}
                  weight={active ? 'black' : 'semibold'}
                  tone={active ? 'constant' : 'sub'}
                  style={{ opacity: active ? 1 : 0.48 }}
                  tabular
                >
                  {String(val)}
                </AppText>
                {unit && active ? (
                  <AppText size="xsm" weight="bold" tone="constant">
                    {unit}
                  </AppText>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Quick +/- steppers for desktop / mouse precision */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
        <Pressable
          onPress={() => commitIndex(selectedIndex - 1, true)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 4,
            borderRadius: 99,
            backgroundColor: c.secondBg,
            borderWidth: 1,
            borderColor: c.thirdBg,
          }}
        >
          <AppText size="xsm" weight="black" tone="sub">
            −
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => commitIndex(selectedIndex + 1, true)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 4,
            borderRadius: 99,
            backgroundColor: c.secondBg,
            borderWidth: 1,
            borderColor: c.thirdBg,
          }}
        >
          <AppText size="xsm" weight="black" tone="sub">
            +
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}
