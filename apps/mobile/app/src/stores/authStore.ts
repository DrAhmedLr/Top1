import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AvatarConfig, MeasureUnit, RankingSex, WeightUnit } from '@apexlift/shared';
import {
  ACCESS_TOKEN_KEY,
  deleteSecureItem,
  REFRESH_TOKEN_KEY,
  setSecureItem,
  TOKEN_EXPIRY_KEY,
} from './storage';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  avatarConfig: AvatarConfig;
  rankingSex: RankingSex;
  age: number;
  heightCm: number;
  bodyweightKg: number;
  unitWeight: WeightUnit;
  unitMeasure: MeasureUnit;
  themeId: string;
  language: string;
  fitnessGoal: string;
  experienceLevel: string;
  experiencePoints: number;
  level: number;
  levelProgress: number;
  credits: number;
  streaks: number;
  longestStreak: number;
  weeklyWorkoutGoal: number;
  lastWorkoutAt: string | null;
  peakAverageRank: string;
  peakAverageRating: number;
  overallTopPercent?: number | null;
  overallTierLabel?: string;
  scientificModelScore?: number | null;
  timeZone?: string;
  totalWorkouts: number;
  totalVolumeKg: number;
  equippedTitleId: string;
  equippedBorderId: string;
  equippedBannerId: string;
  equippedMedalIds: string[];
  referralCode: string;
  isProDemo: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
}

export interface OnboardingDraft {
  fitnessGoal: 'build_muscle' | 'get_stronger' | 'lose_fat' | 'athletic';
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  weeklyWorkoutGoal: number;
  rankingSex: RankingSex;
  age: number;
  heightCm: number;
  bodyweightKg: number;
  unitWeight: WeightUnit;
  unitMeasure: MeasureUnit;
  selectedEquipment: string[];
  benchmarkExerciseId: string;
  benchmarkWeightKg: number;
  benchmarkReps: number;
  demoRating: number;
  demoRankLabel: string;
  avatarConfig: AvatarConfig;
  notificationsEnabled: boolean;
}

const DEFAULT_ONBOARDING_DRAFT: OnboardingDraft = {
  fitnessGoal: 'build_muscle',
  experienceLevel: 'intermediate',
  weeklyWorkoutGoal: 4,
  rankingSex: 'Male',
  age: 24,
  heightCm: 178,
  bodyweightKg: 78,
  unitWeight: 'lbs',
  unitMeasure: 'in',
  selectedEquipment: ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight'],
  benchmarkExerciseId: 'ex_bench_press',
  benchmarkWeightKg: 85,
  benchmarkReps: 5,
  demoRating: 410,
  demoRankLabel: 'Gold I',
  avatarConfig: {
    skinTone: '#E0AC69',
    hairStyle: 'fade',
    hairColor: '#1F1A17',
    outfitColor: '#59B9F9',
    accessory: 'headphones',
    backgroundColor: '#1A1524',
  },
  notificationsEnabled: true,
};

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  onboardingDraft: OnboardingDraft;
  setHydrated: (hydrated: boolean) => void;
  setSession: (payload: {
    accessToken: string;
    accessTokenExpiresAt: number;
    refreshToken: string;
    user: UserProfile;
  }) => Promise<void>;
  updateUser: (partial: Partial<UserProfile>) => void;
  setUser: (user: UserProfile) => void;
  clearSession: () => Promise<void>;
  patchOnboardingDraft: (partial: Partial<OnboardingDraft>) => void;
  resetOnboardingDraft: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isHydrated: false,
      onboardingDraft: DEFAULT_ONBOARDING_DRAFT,
      setHydrated: (isHydrated) => set({ isHydrated }),
      setSession: async ({ accessToken, accessTokenExpiresAt, refreshToken, user }) => {
        await setSecureItem(ACCESS_TOKEN_KEY, accessToken);
        await setSecureItem(REFRESH_TOKEN_KEY, refreshToken);
        await setSecureItem(TOKEN_EXPIRY_KEY, String(accessTokenExpiresAt));
        set({ user, isAuthenticated: true });
      },
      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),
      setUser: (user) => set({ user, isAuthenticated: true }),
      clearSession: async () => {
        await deleteSecureItem(ACCESS_TOKEN_KEY);
        await deleteSecureItem(REFRESH_TOKEN_KEY);
        await deleteSecureItem(TOKEN_EXPIRY_KEY);
        set({ user: null, isAuthenticated: false });
      },
      patchOnboardingDraft: (partial) =>
        set((state) => ({
          onboardingDraft: { ...state.onboardingDraft, ...partial },
        })),
      resetOnboardingDraft: () => set({ onboardingDraft: DEFAULT_ONBOARDING_DRAFT }),
    }),
    {
      name: 'apexlift-auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        onboardingDraft: state.onboardingDraft,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
