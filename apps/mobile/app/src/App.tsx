import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  Figtree_900Black,
  useFonts,
} from '@expo-google-fonts/figtree';
import { TRPCProvider, trpc } from './api/trpc';
import { CUSTOM_FONT_ASSETS } from './assets/v3AssetRegistry';
import { AlertProvider, AppText } from './components/ui';
import { LocaleProvider, useLocale } from './i18n/LocaleProvider';
import { AuthNavigator } from './navigation/AuthNavigator';
import { linkingConfig } from './navigation/linking';
import { MainNavigator } from './navigation/MainNavigator';
import { useAppStore } from './stores/appStore';
import { useAuthStore } from './stores/authStore';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync().catch(() => {});

function InnerApp() {
  const { theme, setThemeById } = useTheme();
  const { setLocale } = useLocale();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const setUser = useAuthStore((s) => s.setUser);
  const serverStatus = useAppStore((s) => s.serverStatus);

  const [fontsLoaded] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
    Figtree_900Black,
    ...CUSTOM_FONT_ASSETS,
  });

  // Refresh profile on boot when authenticated
  const meQuery = trpc.user.me.useQuery(undefined, {
    enabled: isHydrated && isAuthenticated,
    retry: false,
  });

  useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data);
      if (meQuery.data.themeId) {
        void setThemeById(meQuery.data.themeId);
      }
      if (meQuery.data.language === 'en' || meQuery.data.language === 'fr' || meQuery.data.language === 'ar') {
        void setLocale(meQuery.data.language);
      }
    }
  }, [meQuery.data, setUser, setThemeById, setLocale]);

  useEffect(() => {
    if (fontsLoaded && isHydrated) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, isHydrated]);

  if (!fontsLoaded || !isHydrated) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.constant} />
      </View>
    );
  }

  const navTheme = {
    ...(theme.dark ? DarkTheme : DefaultTheme),
    dark: theme.dark,
    colors: {
      ...(theme.dark ? DarkTheme.colors : DefaultTheme.colors),
      primary: theme.colors.constant,
      background: theme.colors.background,
      card: theme.colors.secondBg,
      text: theme.colors.text,
      border: theme.colors.thirdBg,
      notification: theme.colors.notificationBadge,
    },
  };

  // Full-bleed responsive app across mobile, tablet, and desktop web (no artificial phone shrink frame).
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {serverStatus !== 'OK' ? (
        <View
          style={{
            backgroundColor: theme.colors.notificationBadge,
            paddingVertical: 8,
            paddingHorizontal: 16,
            alignItems: 'center',
          }}
        >
          <AppText size="xsm" weight="bold" tone="white">
            Server status: {serverStatus}
          </AppText>
        </View>
      ) : null}
      <NavigationContainer theme={navTheme} linking={linkingConfig}>
        {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TRPCProvider>
          <ThemeProvider>
            <LocaleProvider>
              <AlertProvider>
                <InnerApp />
              </AlertProvider>
            </LocaleProvider>
          </ThemeProvider>
        </TRPCProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
