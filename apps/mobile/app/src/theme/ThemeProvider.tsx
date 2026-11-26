import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_THEMES, getThemeById, type AppTheme } from './themes';

const THEME_STORAGE_KEY = 'apexlift_theme_id';

interface ThemeContextValue {
  theme: AppTheme;
  themes: AppTheme[];
  loading: boolean;
  setThemeById: (id: string) => Promise<void>;
  resetTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>(APP_THEMES[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (active && stored) {
          setTheme(getThemeById(stored));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const setThemeById = useCallback(async (id: string) => {
    const found = getThemeById(id);
    setTheme(found);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, found.id);
    } catch {}
  }, []);

  const resetTheme = useCallback(async () => {
    setTheme(APP_THEMES[0]);
    try {
      await AsyncStorage.removeItem(THEME_STORAGE_KEY);
    } catch {}
  }, []);

  const value = useMemo(
    () => ({
      theme,
      themes: APP_THEMES,
      loading,
      setThemeById,
      resetTheme,
    }),
    [theme, loading, setThemeById, resetTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
