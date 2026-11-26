import React from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from './AppText';

export interface StackHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  right?: React.ReactNode;
  showBorder?: boolean;
  transparent?: boolean;
}

export function StackHeader({
  title,
  subtitle,
  onBack,
  rightSlot,
  right,
  showBorder = false,
  transparent = true,
}: StackHeaderProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation();

  const handleBack = onBack ?? (navigation.canGoBack() ? () => navigation.goBack() : undefined);
  const resolvedRight = rightSlot ?? right;

  return (
    <View
      style={{
        backgroundColor: transparent ? 'transparent' : c.background,
        paddingBottom: 6,
        borderBottomWidth: showBorder && !transparent ? 1 : 0,
        borderBottomColor: c.thirdBg,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 42,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          {handleBack ? (
            <Pressable
              onPress={handleBack}
              hitSlop={12}
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: c.secondBg,
                borderWidth: 1,
                borderColor: c.thirdBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="chevron-back" size={20} color={c.text} />
            </Pressable>
          ) : null}

          <View style={{ flex: 1 }}>
            <AppText size="lg" weight="black" numberOfLines={1}>
              {title}
            </AppText>
            {subtitle ? (
              <AppText size="xsm" tone="sub" numberOfLines={1}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
        </View>

        {resolvedRight ? <View>{resolvedRight}</View> : null}
      </View>
    </View>
  );
}
