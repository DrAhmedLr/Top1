import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../api/trpc';
import { AppCard, AppText, ScreenContainer, StackHeader } from '../../components/ui';
import type { MainStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import { type ThemeCategory } from '../../theme/themes';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import { impactLight } from '../../utils/haptics';
import { playSound } from '../../utils/soundscape';

type Props = NativeStackScreenProps<MainStackParamList, 'Themes'>;

const CATEGORIES: Array<'All' | ThemeCategory> = ['All', 'Default', 'Seasonal', 'Special', 'Color', 'Prismatic'];

export function ThemesScreen({ navigation }: Props) {
  const { theme, themes, setThemeById } = useTheme();
  const c = theme.colors;
  const updateUser = useAuthStore((s) => s.updateUser);
  const updateProfile = trpc.user.updateProfile.useMutation();
  const [cat, setCat] = useState<'All' | ThemeCategory>('All');

  const visibleThemes = useMemo(
    () => (cat === 'All' ? themes : themes.filter((t) => t.category === cat)),
    [cat, themes]
  );

  const handleSelect = async (themeId: string) => {
    impactLight();
    playSound('tick', 0.45);
    await setThemeById(themeId);
    updateUser({ themeId });
    updateProfile.mutate({ themeId });
  };

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title={`Themes (${themes.length})`} onBack={() => navigation.goBack()} />
      <ScreenContainer scroll safeTop={false} contentStyle={{ paddingTop: 12 }}>
        <AppText size="sm" tone="sub">
          Switch instantly across all {themes.length} exact APK palettes — including Seasonal, Classic GymBros (Poppins), and Prismatic themes.
        </AppText>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {CATEGORIES.map((category) => {
            const active = cat === category;
            return (
              <Pressable
                key={category}
                onPress={() => {
                  playSound('tick', 0.35);
                  setCat(category);
                }}
                style={{
                  paddingHorizontal: 13,
                  paddingVertical: 7,
                  borderRadius: RADII.pill,
                  backgroundColor: active ? c.constant : c.secondBg,
                  borderWidth: 1,
                  borderColor: active ? c.constantOvertone : c.thirdBg,
                }}
              >
                <AppText size="xsm" weight="bold" tone={active ? 'constantT' : 'sub'}>
                  {category}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ gap: 10 }}>
          {visibleThemes.map((t) => {
            const active = t.id === theme.id;
            return (
              <AppCard
                key={t.id}
                selected={active}
                onPress={() => void handleSelect(t.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: t.colors.background,
                      borderWidth: 2,
                      borderColor: t.colors.constant,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 3,
                    }}
                  >
                    <View style={{ flexDirection: 'row', gap: 3 }}>
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.colors.constant }} />
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.colors.baseTint }} />
                    </View>
                    <View
                      style={{
                        width: 26,
                        height: 5,
                        borderRadius: 99,
                        backgroundColor: hexToRgba(t.colors.text, 0.75),
                      }}
                    />
                  </View>
                  <View>
                    <AppText size="reg" weight="bold">
                      {t.name}
                    </AppText>
                    <AppText size="xsm" tone="sub">
                      {t.category} • {t.dark ? 'Dark' : 'Light'}
                      {t.id === 'theme_classicDark' ? ' • Poppins' : ''}
                    </AppText>
                  </View>
                </View>

                {active ? (
                  <Ionicons name="checkmark-circle" size={24} color={theme.colors.check} />
                ) : null}
              </AppCard>
            );
          })}
        </View>
      </ScreenContainer>
    </View>
  );
}
