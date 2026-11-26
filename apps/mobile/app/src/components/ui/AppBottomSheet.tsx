import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useResponsiveLayout } from '../../theme/useResponsiveLayout';
import { RADII, SPACING } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from './AppText';

export interface AppBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  maxHeightPct?: number;
  children: React.ReactNode;
}

export function AppBottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  maxHeightPct = 85,
  children,
}: AppBottomSheetProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const { isWide } = useResponsiveLayout();

  return (
    <Modal visible={visible} transparent animationType={isWide ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: isWide ? 'center' : 'flex-end',
          alignItems: isWide ? 'center' : 'stretch',
          padding: isWide ? 24 : 0,
          backgroundColor: 'rgba(0,0,0,0.68)',
        }}
      >
        <Pressable
          style={isWide ? { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 } : { flex: 1 }}
          onPress={onClose}
        />
        <View
          style={{
            width: '100%',
            maxWidth: isWide ? 620 : undefined,
            backgroundColor: c.secondBg,
            borderTopLeftRadius: isWide ? RADII.cardLarge : RADII.sheet,
            borderTopRightRadius: isWide ? RADII.cardLarge : RADII.sheet,
            borderBottomLeftRadius: isWide ? RADII.cardLarge : 0,
            borderBottomRightRadius: isWide ? RADII.cardLarge : 0,
            borderWidth: 1,
            borderBottomWidth: isWide ? 1 : 0,
            borderColor: c.thirdBg,
            maxHeight: `${maxHeightPct}%`,
            paddingBottom: isWide ? SPACING.std : Math.max(SPACING.top, insets.bottom + 12),
          }}
        >
          {!isWide ? (
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
              <View
                style={{
                  width: 44,
                  height: 4,
                  borderRadius: 99,
                  backgroundColor: c.ghostText,
                }}
              />
            </View>
          ) : (
            <View style={{ height: 14 }} />
          )}

          {title ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: SPACING.std,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: c.thirdBg,
              }}
            >
              <View style={{ flex: 1 }}>
                <AppText size="reg" weight="bold">
                  {title}
                </AppText>
                {subtitle ? (
                  <AppText size="xsm" tone="sub">
                    {subtitle}
                  </AppText>
                ) : null}
              </View>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons name="close-circle" size={26} color={c.subText} />
              </Pressable>
            </View>
          ) : null}

          <ScrollView
            contentContainerStyle={{ padding: SPACING.std, gap: SPACING.std }}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
