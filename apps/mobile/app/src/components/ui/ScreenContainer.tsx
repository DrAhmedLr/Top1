import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useResponsiveLayout } from '../../theme/useResponsiveLayout';
import { useTheme } from '../../theme/ThemeProvider';

export interface ScreenContainerProps {
  scroll?: boolean;
  safeTop?: boolean;
  safeBottom?: boolean;
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function ScreenContainer({
  scroll = false,
  safeTop = true,
  safeBottom = true,
  padded = true,
  refreshing = false,
  onRefresh,
  contentStyle,
  children,
}: ScreenContainerProps) {
  const { theme } = useTheme();
  const layout = useResponsiveLayout();
  const hasActiveSession = useWorkoutStore((s) => Boolean(s.session));

  const extraBottomForDock = hasActiveSession ? 28 : 0;
  const innerStyle: ViewStyle = {
    paddingTop: safeTop ? layout.insets.top + (layout.isCompact ? 8 : 12) : 0,
    paddingBottom: safeBottom
      ? Math.max(24, layout.insets.bottom + 18) + extraBottomForDock
      : 0,
    paddingHorizontal: padded ? layout.gutter : 0,
    width: '100%',
    maxWidth: layout.isWide ? layout.maxContentWidth : undefined,
    alignSelf: 'center',
  };

  return (
    <LinearGradient colors={theme.colors.linearBackground} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      >
        {scroll ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[{ flexGrow: 1, gap: layout.sectionGap }, innerStyle, contentStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={theme.colors.constant}
                  colors={[theme.colors.constant]}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, innerStyle, contentStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
