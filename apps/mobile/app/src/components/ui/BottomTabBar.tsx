import React, { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { formatDuration } from '@apexlift/shared';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useBumpSpring, usePulseEffect } from '../../theme/animations';
import { hexToRgba, LAYOUT, RADII } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { selectionHaptic } from '../../utils/haptics';
import { playSound } from '../../utils/soundscape';
import { ActiveWorkoutSheet } from '../workout/ActiveWorkoutSheet';
import { AppText } from './AppText';

/**
 * Custom sculpted SVG tab icons matching Liftoff's chunky rounded nav icon geometry.
 */
function SculptedTabIcon({
  routeName,
  focused,
  color,
}: {
  routeName: string;
  focused: boolean;
  color: string;
}) {
  const fill = focused ? color : 'none';
  const stroke = color;
  const sw = focused ? 1.8 : 2;

  switch (routeName) {
    case 'HomeTab':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path
            d="M3.5 10.5L12 3.5L20.5 10.5V19.5C20.5 20.6 19.6 21.5 18.5 21.5H14.5V15.5C14.5 14.4 13.6 13.5 12.5 13.5H11.5C10.4 13.5 9.5 14.4 9.5 15.5V21.5H5.5C4.4 21.5 3.5 20.6 3.5 19.5V10.5Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'WorkoutsTab':
      return (
        <Svg width={24} height={22} viewBox="0 0 26 24">
          <Rect x={2} y={8} width={3.5} height={8} rx={1.5} fill={fill} stroke={stroke} strokeWidth={sw} />
          <Rect x={5.5} y={5.5} width={3.5} height={13} rx={1.5} fill={fill} stroke={stroke} strokeWidth={sw} />
          <Rect x={17} y={5.5} width={3.5} height={13} rx={1.5} fill={fill} stroke={stroke} strokeWidth={sw} />
          <Rect x={20.5} y={8} width={3.5} height={8} rx={1.5} fill={fill} stroke={stroke} strokeWidth={sw} />
          <Path d="M9 12H17" stroke={stroke} strokeWidth={2.6} strokeLinecap="round" />
        </Svg>
      );
    case 'RanksTab':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path
            d="M12 2.5L19.5 5.5V11.5C19.5 16.2 16.3 19.9 12 21.5C7.7 19.9 4.5 16.2 4.5 11.5V5.5L12 2.5Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          <Path
            d="M12 7.5L13.4 10.4L16.5 10.8L14.2 13L14.8 16.1L12 14.6L9.2 16.1L9.8 13L7.5 10.8L10.6 10.4L12 7.5Z"
            fill={focused ? '#0F0A18' : 'none'}
            stroke={focused ? '#0F0A18' : stroke}
            strokeWidth={1.3}
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'NutritionTab':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path
            d="M12 3C8.5 3 6.5 6.8 6.5 11.5C6.5 16.5 9 20.5 12 20.5C15 20.5 17.5 16.5 17.5 11.5C17.5 6.8 15.5 3 12 3Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
          <Path
            d="M12 13.5C13.8 13.5 15 11.5 15 9.5"
            stroke={focused ? '#0F0A18' : stroke}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </Svg>
      );
    default:
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Circle cx={12} cy={8.2} r={4} fill={fill} stroke={stroke} strokeWidth={sw} />
          <Path
            d="M4.5 20C4.5 16.2 7.8 14 12 14C16.2 14 19.5 16.2 19.5 20"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );
  }
}

const TAB_LABELS: Record<string, string> = {
  HomeTab: 'Home',
  WorkoutsTab: 'Workouts',
  RanksTab: 'Ranks',
  NutritionTab: 'Nutrition',
  ProfileTab: 'Profile',
};

function TabBarButton({
  routeName,
  focused,
  label,
  onPress,
}: {
  routeName: string;
  focused: boolean;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { scale, bump } = useBumpSpring();

  useEffect(() => {
    if (focused) bump(1.16);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);

  return (
    <Pressable
      onPress={() => {
        bump(1.18);
        selectionHaptic();
        playSound('tick', 0.35);
        onPress();
      }}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        borderRadius: 14,
        gap: 3,
      }}
    >
      {focused ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            width: 28,
            height: 3,
            borderRadius: 99,
            backgroundColor: c.constant,
          }}
        />
      ) : null}
      <Animated.View
        style={{
          width: 42,
          height: 30,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: focused ? hexToRgba(c.constant, 0.18) : 'transparent',
          transform: [{ scale }],
        }}
      >
        <SculptedTabIcon
          routeName={routeName}
          focused={focused}
          color={focused ? c.constant : c.subText}
        />
      </Animated.View>
      <AppText
        size="xsm"
        weight={focused ? 'xbold' : 'medium'}
        tone={focused ? 'constant' : 'sub'}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function BottomTabBar({ state, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const session = useWorkoutStore((s) => s.session);
  const restTimerEndAt = useWorkoutStore((s) => s.restTimerEndAt);
  const openSheet = useWorkoutStore((s) => s.openSheet);
  const pulseDot = usePulseEffect(0.75, 1.35, 1400);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session]);

  const elapsedSec = session ? Math.max(0, Math.floor((now - session.startedAt) / 1000)) : 0;
  const restSec = restTimerEndAt ? Math.max(0, Math.ceil((restTimerEndAt - now) / 1000)) : 0;
  const completedSets = session
    ? session.exercises.reduce(
        (sum, ex) => sum + ex.sets.filter((s) => s.isCompleted).length,
        0
      )
    : 0;

  return (
    <View
      style={{
        backgroundColor: theme.dark ? 'rgba(17, 12, 28, 0.88)' : 'rgba(255, 255, 255, 0.92)',
        borderTopWidth: 1,
        borderTopColor: theme.dark ? hexToRgba('#FFFFFF', 0.1) : c.thirdBg,
        paddingBottom: Math.max(10, insets.bottom),
        ...(Platform.OS === 'web'
          ? ({
              boxShadow: '0px -10px 28px rgba(0, 0, 0, 0.38)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            } as object)
          : {}),
      }}
    >
      {session ? (
        <Pressable onPress={openSheet} style={{ marginHorizontal: 12, marginTop: 8, marginBottom: 4 }}>
          <LinearGradient
            colors={[hexToRgba(c.constant, 0.22), c.secondBg]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 11,
              borderRadius: RADII.card,
              borderWidth: 1.2,
              borderColor: hexToRgba(c.constant, 0.65),
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Animated.View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 99,
                  backgroundColor: c.check,
                  transform: [{ scale: pulseDot }],
                }}
              />
              <View style={{ flex: 1 }}>
                <AppText size="sm" weight="xbold" numberOfLines={1}>
                  {session.title || 'Active Workout'}
                </AppText>
                <AppText size="xsm" tone="sub" tabular>
                  {formatDuration(elapsedSec)} • {completedSets} sets done
                  {restSec > 0 ? ` • Rest ${formatDuration(restSec)}` : ''}
                </AppText>
              </View>
            </View>
            <View
              style={{
                paddingHorizontal: 11,
                paddingVertical: 6,
                borderRadius: 10,
                backgroundColor: c.constant,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <AppText size="xsm" weight="xbold" tone="constantT">
                Resume
              </AppText>
              <Ionicons name="chevron-up" size={14} color={c.constantText} />
            </View>
          </LinearGradient>
        </Pressable>
      ) : null}

      <ActiveWorkoutSheet />

      <View
        style={{
          height: LAYOUT.navbarHeight,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingHorizontal: 6,
        }}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const label = TAB_LABELS[route.name] ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TabBarButton
              key={route.key}
              routeName={route.name}
              focused={focused}
              label={label}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}
