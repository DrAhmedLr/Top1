import React, { useEffect, useState } from 'react';
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
import { AlertProvider, AppButton, AppText } from './components/ui';
import { LocaleProvider, useLocale } from './i18n/LocaleProvider';
import { AuthNavigator } from './navigation/AuthNavigator';
import { linkingConfig } from './navigation/linking';
import { MainNavigator } from './navigation/MainNavigator';
import { useAppStore } from './stores/appStore';
import { useAuthStore } from './stores/authStore';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync().catch(() => {});

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Unexpected rendering error.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: '#0F0A18',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            gap: 14,
          }}
        >
          <AppText size="xl" weight="black" tone="constant">
            TOP1% Recovery Mode
          </AppText>
          <AppText size="sm" tone="sub" align="center">
            {this.state.message}
          </AppText>
          <AppButton
            label="Reload App"
            onPress={() => this.setState({ hasError: false, message: '' })}
          />
        </View>
      );
    }
    return this.props.children;
  }
}

function InnerApp() {
  const { theme, setThemeById } = useTheme();
  const { setLocale } = useLocale();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const setUser = useAuthStore((s) => s.setUser);
  const serverStatus = useAppStore((s) => s.serverStatus);
  const [bootTimedOut, setBootTimedOut] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
    Figtree_900Black,
    PoppinsSemiBold: CUSTOM_FONT_ASSETS.PoppinsSemiBold,
    PoppinsBold: CUSTOM_FONT_ASSETS.PoppinsBold,
    RobotoMonoMedium: CUSTOM_FONT_ASSETS.RobotoMonoMedium,
    RobotoMonoBold: CUSTOM_FONT_ASSETS.RobotoMonoBold,
  });

  // Never trap the user on an infinite spinner if fonts or storage fail to load
  useEffect(() => {
    const t = setTimeout(() => {
      setBootTimedOut(true);
      if (!useAuthStore.getState().isHydrated) {
        useAuthStore.getState().setHydrated(true);
      }
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  const fontsReady = fontsLoaded || Boolean(fontError) || bootTimedOut;

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
    if (fontsReady && isHydrated) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady, isHydrated]);

  if (!fontsReady || !isHydrated) {
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
                <AppErrorBoundary>
                  <InnerApp />
                </AppErrorBoundary>
              </AlertProvider>
            </LocaleProvider>
          </ThemeProvider>
        </TRPCProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
