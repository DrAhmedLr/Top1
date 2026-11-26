import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { USE_NATIVE_DRIVER } from '../../theme/animations';
import { hexToRgba, RADII } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { impactLight } from '../../utils/haptics';
import { playSound } from '../../utils/soundscape';
import { AppText, type TextTone } from './AppText';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'danger'
  | 'check'
  | 'gold';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface AppButtonProps {
  title?: string;
  label?: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * 3D Tactile Beveled Button modeled on mod_05553_GBButton.js
 * Features a darker bottom undertone bevel that physically compresses on press + spring bounce.
 */
export function AppButton({
  title,
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
}: AppButtonProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const resolvedLabel = title ?? label ?? '';

  const [pressed, setPressed] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;

  const height = size === 'sm' ? 42 : size === 'lg' ? 56 : 50;
  const paddingHorizontal = size === 'sm' ? 14 : size === 'lg' ? 24 : 18;
  const isBeveled = variant !== 'ghost';
  const bevelDepth = !isBeveled ? 0 : size === 'sm' ? 3 : 5;

  const gradientMap: Record<ButtonVariant, [string, string]> = {
    primary: [c.constantOvertone, c.constant],
    secondary: [c.thirdBg, c.secondBg],
    outline: ['transparent', 'transparent'],
    ghost: ['transparent', 'transparent'],
    destructive: ['#FF5A52', c.notificationBadge],
    danger: ['#FF5A52', c.danger],
    check: ['#89E881', c.check],
    gold: ['#FFE066', '#E6AE08'],
  };

  const undertoneMap: Record<ButtonVariant, string> = {
    primary: c.constantUndertone,
    secondary: theme.dark ? '#110D1B' : '#C8C8DF',
    outline: c.thirdBg,
    ghost: 'transparent',
    destructive: '#B2221B',
    danger: '#B2221B',
    check: c.checkUndertone,
    gold: '#A27D0A',
  };

  const textToneMap: Record<ButtonVariant, TextTone> = {
    primary: 'constantT',
    secondary: 'reg',
    outline: 'reg',
    ghost: 'constant',
    destructive: 'white',
    danger: 'white',
    check: 'black',
    gold: 'black',
  };

  const onPressIn = () => {
    if (disabled || loading) return;
    setPressed(true);
    impactLight();
    Animated.timing(translateY, {
      toValue: isBeveled ? bevelDepth - 1 : 0,
      duration: 60,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  const onPressOut = () => {
    setPressed(false);
    Animated.spring(translateY, {
      toValue: 0,
      friction: 5,
      tension: 260,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  const handlePress = () => {
    if (disabled || loading) return;
    playSound('tick', 0.4);
    onPress?.();
  };

  return (
    <View
      style={[
        {
          width: fullWidth ? '100%' : undefined,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
        style={{ width: '100%' }}
      >
        {/* Bottom 3D Bevel Lip */}
        {isBeveled ? (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: bevelDepth,
              height,
              borderRadius: RADII.card,
              backgroundColor: undertoneMap[variant],
            }}
          />
        ) : null}

        {/* Interactive Top Face */}
        <Animated.View
          style={{
            height,
            borderRadius: RADII.card,
            overflow: 'hidden',
            borderWidth: variant === 'outline' ? 1.5 : variant === 'ghost' ? 0 : 1,
            borderColor:
              variant === 'outline'
                ? c.thirdBg
                : variant === 'secondary'
                  ? hexToRgba('#FFFFFF', theme.dark ? 0.09 : 0.6)
                  : hexToRgba('#FFFFFF', 0.24),
            transform: [{ translateY }],
            marginBottom: isBeveled ? bevelDepth : 0,
          }}
        >
          <LinearGradient
            colors={gradientMap[variant]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              flex: 1,
              paddingHorizontal,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: pressed && !isBeveled ? 0.72 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator
                size="small"
                color={variant === 'primary' || variant === 'gold' ? c.constantText : c.text}
              />
            ) : (
              <>
                {leftIcon ? <View>{leftIcon}</View> : null}
                <AppText
                  size={size === 'sm' ? 'sm' : 'md'}
                  weight="xbold"
                  tone={textToneMap[variant]}
                  style={{ letterSpacing: 0.2 }}
                >
                  {resolvedLabel}
                </AppText>
                {rightIcon ? <View>{rightIcon}</View> : null}
              </>
            )}
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </View>
  );
}
