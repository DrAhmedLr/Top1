import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Ionicons } from '@expo/vector-icons';
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
import { hexToRgba } from './theme/tokens';
import { useSoundscape } from './utils/soundscape';

void SplashScreen.preventAutoHideAsync().catch(() => {});

function InnerApp() {
  const { theme, setThemeById } = useTheme();
  const { setLocale } = useLocale();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const setUser = useAuthStore((s) => s.setUser);
  const serverStatus = useAppStore((s) => s.serverStatus);
  const { width } = useWindowDimensions();
  const [wideMode, setWideMode] = useState(false);
  const { muted, toggleMute, play } = useSoundscape();

  const isDesktopWeb = Platform.OS === 'web' && width > 560;

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

  const appContent = (
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

  if (!isDesktopWeb) {
    return appContent;
  }

  // Fluid desktop web frame with docked non-overlapping controls bar
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#07040D',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingHorizontal: wideMode ? 0 : 12,
        paddingBottom: wideMode ? 0 : 14,
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: wideMode ? 960 : 430,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: wideMode ? 16 : 4,
          paddingVertical: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              backgroundColor: theme.colors.check,
            }}
          />
          <AppText size="xsm" weight="xbold" tone="sub">
            TOP1% OS
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => {
              toggleMute();
              if (muted) play('tick');
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 99,
              backgroundColor: hexToRgba('#1A1524', 0.9),
              borderWidth: 1,
              borderColor: hexToRgba('#FFFFFF', 0.12),
            }}
          >
            <Ionicons
              name={muted ? 'volume-mute-outline' : 'volume-high-outline'}
              size={14}
              color={muted ? theme.colors.subText : theme.colors.constant}
            />
            <AppText size="xsm" weight="bold" tone={muted ? 'sub' : 'constant'}>
              {muted ? 'Muted' : 'SFX On'}
            </AppText>
          </Pressable>

          <Pressable
            onPress={() => setWideMode((v) => !v)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 11,
              paddingVertical: 6,
              borderRadius: 99,
              backgroundColor: hexToRgba('#1A1524', 0.9),
              borderWidth: 1,
              borderColor: hexToRgba('#FFFFFF', 0.12),
            }}
          >
            <Ionicons
              name={wideMode ? 'phone-portrait-outline' : 'expand-outline'}
              size={14}
              color={theme.colors.constant}
            />
            <AppText size="xsm" weight="bold" tone="constant">
              {wideMode ? 'Mobile Frame' : 'Responsive Wide'}
            </AppText>
          </Pressable>
        </View>
      </View>

      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: wideMode ? 960 : 430,
          borderRadius: wideMode ? 0 : 28,
          overflow: 'hidden',
          borderWidth: wideMode ? 0 : 1.5,
          borderColor: hexToRgba('#FFFFFF', 0.12),
          ...(wideMode
            ? {}
            : ({
                boxShadow: `0px 24px 72px rgba(0, 0, 0, 0.72), 0px 0px 44px ${hexToRgba(theme.colors.constant, 0.12)}`,
              } as object)),
        }}
      >
        {appContent}
      </View>
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
