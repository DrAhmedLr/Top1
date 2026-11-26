import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  localeDirection,
  normalizeLocale,
  translate,
  type Locale,
} from '@top1/engine';

const STORAGE_KEY = 'top1_mobile_locale_v1';

interface LocaleContextValue {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  isRtl: boolean;
  setLocale: (next: Locale) => Promise<void>;
  t: (text: string) => string;
  l: (en: string, fr: string, ar: string) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  dir: 'ltr',
  isRtl: false,
  setLocale: async () => {},
  t: (s) => s,
  l: (en) => en,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        setLocaleState(normalizeLocale(stored));
      }
    });
  }, []);

  const dir: 'ltr' | 'rtl' = localeDirection(locale);
  const isRtl = dir === 'rtl';

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.dir = dir;
      document.documentElement.lang = locale;
    }
  }, [dir, locale]);

  const setLocale = useCallback(async (next: Locale) => {
    const clean = normalizeLocale(next);
    setLocaleState(clean);
    await AsyncStorage.setItem(STORAGE_KEY, clean);
  }, []);

  const t = useCallback((text: string) => translate(locale, text), [locale]);
  const l = useCallback(
    (en: string, fr: string, ar: string) => (locale === 'fr' ? fr : locale === 'ar' ? ar : en),
    [locale]
  );

  const value = useMemo(
    () => ({ locale, dir, isRtl, setLocale, t, l }),
    [locale, dir, isRtl, setLocale, t, l]
  );

  return (
    <LocaleContext.Provider value={value}>
      <View style={{ flex: 1, direction: dir }}>{children}</View>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
