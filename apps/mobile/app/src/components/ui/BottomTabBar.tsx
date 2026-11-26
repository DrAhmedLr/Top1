import React, { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { formatDuration } from '@apexlift/shared';
import { useLocale } from '../../i18n/LocaleProvider';
import { useAuthStore } from '../../stores/authStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useBumpSpring, usePulseEffect } from '../../theme/animations';
import { useResponsiveLayout } from '../../theme/useResponsiveLayout';
import { hexToRgba, LAYOUT, RADII } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { selectionHaptic } from '../../utils/haptics';
import { playSound, useSoundscape } from '../../utils/soundscape';
import { AppText } from './AppText';
import { AvatarView } from './AvatarView';

/**
 * Custom sculpted SVG tab icons matching TOP1%'s chunky rounded nav icon geometry.
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

const TAB_LABELS: Record<string, [string, string, string]> = {
  HomeTab: ['Home', 'Accueil', 'الرئيسية'],
  WorkoutsTab: ['Workouts', 'Séances', 'التمارين'],
  RanksTab: ['Ranks', 'Rangs', 'التصنيف'],
  NutritionTab: ['Nutrition', 'Nutrition', 'التغذية'],
  ProfileTab: ['Profile', 'Profil', 'الملف'],
};

function TabBarButton({
  routeName,
  focused,
  label,
  sidebar,
  onPress,
}: {
  routeName: string;
  focused: boolean;
  label: string;
  sidebar?: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { scale, bump } = useBumpSpring();

  useEffect(() => {
    if (focused) bump(sidebar ? 1.06 : 1.16);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);

  if (sidebar) {
    return (
      <Pressable
        onPress={() => {
          bump(1.06);
          selectionHaptic();
          playSound('tick', 0.35);
          onPress();
        }}
        style={(state) => {
          const hovered = Boolean((state as { hovered?: boolean }).hovered);
          return {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 11,
            paddingHorizontal: 14,
            borderRadius: 14,
            backgroundColor: focused
              ? hexToRgba(c.constant, 0.16)
              : hovered || state.pressed
                ? hexToRgba(c.text, 0.06)
                : 'transparent',
            borderWidth: 1,
            borderColor: focused ? hexToRgba(c.constant, 0.38) : 'transparent',
          };
        }}
      >
        {focused ? (
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 10,
              bottom: 10,
              width: 3.5,
              borderRadius: 99,
              backgroundColor: c.constant,
            }}
          />
        ) : null}
        <Animated.View
          style={{
            width: 34,
            height: 30,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
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
          size="sm"
          weight={focused ? 'xbold' : 'semibold'}
          tone={focused ? 'constant' : 'sub'}
        >
          {label}
        </AppText>
      </Pressable>
    );
  }

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
  const { l } = useLocale();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsiveLayout();
  const user = useAuthStore((s) => s.user);
  const session = useWorkoutStore((s) => s.session);
  const restTimerEndAt = useWorkoutStore((s) => s.restTimerEndAt);
  const openSheet = useWorkoutStore((s) => s.openSheet);
  const { muted, toggleMute, play } = useSoundscape();
  const pulseDot = usePulseEffect(0.75, 1.35, 1400);

  const getTabLabel = (name: string) => {
    const entry = TAB_LABELS[name];
    return entry ? l(...entry) : name;
  };

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

  const activeDock = session ? (
    <Pressable onPress={openSheet} style={isDesktop ? { marginTop: 8 } : { marginHorizontal: 12, marginTop: 8, marginBottom: 4 }}>
      <LinearGradient
        colors={[hexToRgba(c.constant, 0.22), c.secondBg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 11,
          borderRadius: RADII.card,
          borderWidth: 1.2,
          borderColor: hexToRgba(c.constant, 0.65),
          flexDirection: isDesktop ? 'column' : 'row',
          alignItems: isDesktop ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: isDesktop ? 8 : 0,
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
              {formatDuration(elapsedSec)} • {completedSets} sets
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
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <AppText size="xsm" weight="xbold" tone="constantT">
            Resume Session
          </AppText>
          <Ionicons name={isDesktop ? 'arrow-forward' : 'chevron-up'} size={14} color={c.constantText} />
        </View>
      </LinearGradient>
    </Pressable>
  ) : null;

  if (isDesktop) {
    return (
      <View
        style={{
          width: 244,
          height: '100%',
          backgroundColor: theme.dark ? '#110C1D' : c.secondBg,
          borderRightWidth: 1,
          borderRightColor: theme.dark ? hexToRgba('#FFFFFF', 0.08) : c.thirdBg,
          paddingHorizontal: 14,
          paddingTop: 20,
          paddingBottom: 18,
          justifyContent: 'space-between',
        }}
      >
        <View style={{ gap: 22 }}>
          {/* Desktop Brand Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <LinearGradient
                colors={[c.constantOvertone, c.constant]}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="flash" size={18} color="#0F0A18" />
              </LinearGradient>
              <View>
                <AppText size="md" weight="black" style={{ letterSpacing: 0.6 }}>
                  TOP1%
                </AppText>
                <AppText size="xxsm" weight="bold" tone="constant">
                  PERFORMANCE OS
                </AppText>
              </View>
            </View>

            <Pressable
              onPress={() => {
                toggleMute();
                if (muted) play('tick');
              }}
              hitSlop={8}
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: hexToRgba(c.text, 0.06),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={muted ? 'volume-mute-outline' : 'volume-high-outline'}
                size={16}
                color={muted ? c.subText : c.constant}
              />
            </Pressable>
          </View>

          {/* Sculpted Sidebar Navigation Items */}
          <View style={{ gap: 6 }}>
            {state.routes.map((route, index) => {
              const focused = state.index === index;
              const label = getTabLabel(route.name);

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
                  sidebar
                  onPress={onPress}
                />
              );
            })}
          </View>

          {activeDock}
        </View>

        {/* Athlete Quick Status Footer */}
        <Pressable
          onPress={() => navigation.navigate('ProfileTab')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 10,
            borderRadius: 14,
            backgroundColor: hexToRgba(c.text, 0.04),
            borderWidth: 1,
            borderColor: hexToRgba(c.text, 0.08),
          }}
        >
          <AvatarView
            config={user?.avatarConfig}
            borderId={user?.equippedBorderId}
            presetKey={user?.rankingSex === 'Female' ? 'femalev31' : 'malev31'}
            size={36}
          />
          <View style={{ flex: 1 }}>
            <AppText size="sm" weight="xbold" numberOfLines={1}>
              {user?.displayName ?? 'Athlete'}
            </AppText>
            <AppText size="xxsm" tone="sub" numberOfLines={1}>
              LV {user?.level ?? 1} • {user?.streaks ?? 0}d 🔥 • {user?.credits ?? 0} cr
            </AppText>
          </View>
        </Pressable>
      </View>
    );
  }

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
      {activeDock}

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
          const label = getTabLabel(route.name);

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
