import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';
import type { AuthStackParamList, MainStackParamList } from './types';

export const linkingConfig: LinkingOptions<AuthStackParamList & MainStackParamList> = {
  prefixes: [Linking.createURL('/'), 'top1://', 'https://top1.fit'],
  config: {
    screens: {
      NewPassword: 'reset-password',
      BottomNavTabs: {
        screens: {
          HomeTab: 'home',
          WorkoutsTab: 'workouts',
          RanksTab: 'ranks',
          NutritionTab: 'nutrition',
          ProfileTab: 'profile',
        },
      },
      Themes: 'themes',
      ExerciseLibrary: 'exercises',
      ExerciseDetail: 'exercise/:exerciseId',
      PresetDetail: 'preset/:presetId',
      WorkoutSchedule: 'schedule',
      WorkoutGenerator: 'generator',
      Bodygraph: 'rank/bodygraph',
      RankGallery: 'rank/gallery',
      RankCalculator: 'rank/calculator',
      RankPrediction: 'rank/prediction',
      RankLeagues: 'rank/leagues',
      StreaksAndReports: 'progress/streaks',
      GoalsQuestsMedals: 'progress/quests',
      RecapStories: 'recap',
      PostDetail: 'post/:postId',
      Friends: 'friends',
      PublicProfile: 'u/:userIdOrUsername',
      Leaderboard: 'leaderboard',
      EditProfile: 'settings/profile',
      EditAvatar: 'settings/avatar',
      ShopAndInventory: 'shop',
      NotificationCenter: 'notifications',
      NotificationSettings: 'settings/notifications',
    },
  },
};
