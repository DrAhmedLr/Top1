import React, { useState } from 'react';
import {
  Pressable,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADII } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from './AppText';

export interface AppInputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  suffix?: string;
  leftIconName?: keyof typeof Ionicons.glyphMap;
  isPassword?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function AppInput({
  label,
  error,
  suffix,
  leftIconName,
  isPassword = false,
  containerStyle,
  style,
  ...rest
}: AppInputProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(isPassword);

  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? (
        <AppText size="sm" weight="semibold" tone="sub">
          {label}
        </AppText>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: c.secondBg,
          borderRadius: RADII.card,
          borderWidth: 1.5,
          borderColor: error
            ? c.negative
            : focused
              ? c.constant
              : c.thirdBg,
          paddingHorizontal: 14,
          minHeight: 50,
          gap: 10,
        }}
      >
        {leftIconName ? (
          <Ionicons
            name={leftIconName}
            size={18}
            color={focused ? c.constant : c.subText}
          />
        ) : null}

        <TextInput
          placeholderTextColor={c.ghostText}
          secureTextEntry={hidden}
          keyboardAppearance={theme.dark ? 'dark' : 'light'}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[
            {
              flex: 1,
              color: c.text,
              fontFamily: theme.fonts.medium,
              fontSize: 16,
              paddingVertical: 12,
            },
            style,
          ]}
          {...rest}
        />

        {suffix ? (
          <AppText size="sm" weight="bold" tone="sub">
            {suffix}
          </AppText>
        ) : null}

        {isPassword ? (
          <Pressable onPress={() => setHidden((prev) => !prev)} hitSlop={10}>
            <Ionicons
              name={hidden ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={c.subText}
            />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <AppText size="xsm" weight="semibold" tone="negative">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
