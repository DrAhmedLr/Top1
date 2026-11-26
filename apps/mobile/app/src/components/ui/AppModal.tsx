import React from 'react';
import { Modal, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useResponsiveLayout } from '../../theme/useResponsiveLayout';
import { RADII, SPACING } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from './AppText';

export interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  cancelable?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function AppModal({
  visible,
  onClose,
  title,
  subtitle,
  cancelable = true,
  contentStyle,
  children,
}: AppModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { isWide } = useResponsiveLayout();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (cancelable) onClose();
      }}
    >
      <Pressable
        onPress={() => {
          if (cancelable) onClose();
        }}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.72)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: SPACING.top,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            {
              width: '100%',
              maxWidth: isWide ? 520 : 420,
              backgroundColor: c.secondBg,
              borderRadius: RADII.cardLarge,
              borderWidth: 1,
              borderColor: c.thirdBg,
              padding: SPACING.top,
              gap: SPACING.std,
            },
            contentStyle,
          ]}
        >
          {title ? (
            <View style={{ gap: 4 }}>
              <AppText size="lg" weight="bold" align="center">
                {title}
              </AppText>
              {subtitle ? (
                <AppText size="sm" tone="sub" align="center">
                  {subtitle}
                </AppText>
              ) : null}
            </View>
          ) : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
