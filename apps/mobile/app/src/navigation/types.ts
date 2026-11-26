import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Landing: undefined;
  SignIn: undefined;
  ResetPassword: undefined;
  NewPassword: { token?: string } | undefined;
  OnboardingQuestionnaire: undefined;
  OnboardingRankDemo: undefined;
  OnboardingPlanAndGoal: undefined;
  OnboardingAvatar: undefined;
  OnboardingCredentials: undefined;
};

export type BottomTabParamList = {
  HomeTab: undefined;
  WorkoutsTab: undefined;
  RanksTab: undefined;
  NutritionTab: undefined;
  ProfileTab: undefined;
};

export type MainStackParamList = {
  BottomNavTabs: NavigatorScreenParams<BottomTabParamList> | undefined;
  Themes: undefined;

  // Phase 3 — Core Workout Engine
  ExerciseLibrary: { mode?: 'browse' | 'addToWorkout' } | undefined;
  ExerciseDetail: { exerciseId: string };
  NewExercise: undefined;
  NewPreset: undefined;
  PresetDetail: { presetId: string };
  SaveWorkout: undefined;
  WorkoutSchedule: undefined;
  WorkoutGenerator: undefined;

  // Phase 4 — TOP1% Ranking, Body Graph, Benchmarks & Adaptive Coaching
  Bodygraph: { userId?: string; displayName?: string } | undefined;
  BenchmarkLab: { initialPillar?: 'all' | 'bodymarkers' | 'strength' | 'recovery'; metricId?: string } | undefined;
  CoachHub: { initialTab?: 'today' | 'goals' | 'calendar' | 'learning' } | undefined;
  WearableReadiness: undefined;
  RankGallery: undefined;
  RankCalculator: { exerciseId?: string } | undefined;
  RankPrediction: undefined;
  RankLeagues: undefined;
  StreaksAndReports: undefined;
  GoalsQuestsMedals: { initialTab?: 'goals' | 'quests' | 'medals' } | undefined;
  RecapStories: undefined;

  // Phase 5 — Nutrition & Health
  FoodSearch: {
    dateIso: string;
    mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    initialTab?: 'search' | 'custom' | 'bundles';
  };
  HealthMetrics: { dateIso: string };

  // Phase 6 — Social, Friends & Leaderboards
  PostDetail: { postId: string };
  EditPost: { postId: string };
  Friends: undefined;
  PublicProfile: { userIdOrUsername: string };
  Leaderboard: { initialCategory?: 'ranks' | 'streaks' | 'levels' | 'exercise' } | undefined;
  FeatureRequests: undefined;

  // Phase 7 — Customization & Settings
  EditProfile: undefined;
  EditAvatar: undefined;
  ShopAndInventory: undefined;
  NotificationCenter: undefined;
  NotificationSettings: undefined;
};
