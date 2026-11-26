import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: c.secondBg,
            borderTopLeftRadius: RADII.sheet,
            borderTopRightRadius: RADII.sheet,
            borderTopWidth: 1,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: c.thirdBg,
            maxHeight: `${maxHeightPct}%`,
            paddingBottom: Math.max(SPACING.top, insets.bottom + 12),
          }}
        >
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
