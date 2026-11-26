import { create } from 'zustand';

export type ServerStatusCode = 'OK' | 'MAINTENANCE' | 'DEPRECATED' | 'OFFLINE';

interface AppState {
  serverStatus: ServerStatusCode;
  isWorkoutActive: boolean;
  activeWorkoutTitle: string;
  activeWorkoutStartedAt: number | null;
  setServerStatus: (status: ServerStatusCode) => void;
  startQuickWorkoutDemo: (title: string) => void;
  stopQuickWorkoutDemo: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  serverStatus: 'OK',
  isWorkoutActive: false,
  activeWorkoutTitle: '',
  activeWorkoutStartedAt: null,
  setServerStatus: (serverStatus) => set({ serverStatus }),
  startQuickWorkoutDemo: (title) =>
    set({
      isWorkoutActive: true,
      activeWorkoutTitle: title,
      activeWorkoutStartedAt: Date.now(),
    }),
  stopQuickWorkoutDemo: () =>
    set({
      isWorkoutActive: false,
      activeWorkoutTitle: '',
      activeWorkoutStartedAt: null,
    }),
}));
