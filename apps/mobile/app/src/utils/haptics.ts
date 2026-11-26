import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface HapticsStoreState {
  enabled: boolean;
  toggleHaptics: () => void;
  setEnabled: (v: boolean) => void;
}

export const useHapticsStore = create<HapticsStoreState>()(
  persist(
    (set) => ({
      enabled: true,
      toggleHaptics: () => set((s) => ({ enabled: !s.enabled })),
      setEnabled: (enabled) => set({ enabled }),
    }),
    {
      name: 'apexlift-haptics-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

function webVibrate(ms: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch {
    // ignore unsupported browsers
  }
}

export function impactLight() {
  if (!useHapticsStore.getState().enabled) return;
  if (Platform.OS === 'web') {
    webVibrate(8);
    return;
  }
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function impactMedium() {
  if (!useHapticsStore.getState().enabled) return;
  if (Platform.OS === 'web') {
    webVibrate(16);
    return;
  }
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function impactHeavy() {
  if (!useHapticsStore.getState().enabled) return;
  if (Platform.OS === 'web') {
    webVibrate([20, 30, 20]);
    return;
  }
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

export function selectionHaptic() {
  if (!useHapticsStore.getState().enabled) return;
  if (Platform.OS === 'web') {
    webVibrate(5);
    return;
  }
  Haptics.selectionAsync().catch(() => {});
}

export function notifySuccess() {
  if (!useHapticsStore.getState().enabled) return;
  if (Platform.OS === 'web') {
    webVibrate([15, 35, 25]);
    return;
  }
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
