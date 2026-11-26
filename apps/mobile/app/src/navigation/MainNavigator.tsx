import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActiveWorkoutSheet } from '../components/workout/ActiveWorkoutSheet';
import { useTheme } from '../theme/ThemeProvider';
import { ThemesScreen } from '../screens/shell/ThemesScreen';
import { ExerciseDetailScreen } from '../screens/workout/ExerciseDetailScreen';
import { ExerciseLibraryScreen } from '../screens/workout/ExerciseLibraryScreen';
import { NewExerciseScreen } from '../screens/workout/NewExerciseScreen';
import { NewPresetScreen } from '../screens/workout/NewPresetScreen';
import { PresetDetailScreen } from '../screens/workout/PresetDetailScreen';
import { SaveWorkoutScreen } from '../screens/workout/SaveWorkoutScreen';
import { WorkoutGeneratorScreen } from '../screens/workout/WorkoutGeneratorScreen';
import { WorkoutScheduleScreen } from '../screens/workout/WorkoutScheduleScreen';
import { CoachHubScreen } from '../screens/workout/CoachHubScreen';
import { BenchmarkLabScreen } from '../screens/rank/BenchmarkLabScreen';
import { BodygraphScreen } from '../screens/rank/BodygraphScreen';
import { RankCalculatorScreen } from '../screens/rank/RankCalculatorScreen';
import { RankGalleryScreen } from '../screens/rank/RankGalleryScreen';
import { RankLeaguesScreen } from '../screens/rank/RankLeaguesScreen';
import { RankPredictionScreen } from '../screens/rank/RankPredictionScreen';
import { GoalsQuestsMedalsScreen } from '../screens/progress/GoalsQuestsMedalsScreen';
import { RecapStoriesScreen } from '../screens/progress/RecapStoriesScreen';
import { StreaksAndReportsScreen } from '../screens/progress/StreaksAndReportsScreen';
import { FoodSearchScreen } from '../screens/nutrition/FoodSearchScreen';
import { HealthMetricsScreen } from '../screens/nutrition/HealthMetricsScreen';
import { WearableReadinessScreen } from '../screens/nutrition/WearableReadinessScreen';
import { FriendsScreen } from '../screens/social/FriendsScreen';
import { FeatureRequestsScreen } from '../screens/social/FeatureRequestsScreen';
import { LeaderboardScreen } from '../screens/social/LeaderboardScreen';
import { PostDetailScreen } from '../screens/social/PostDetailScreen';
import { PublicProfileScreen } from '../screens/social/PublicProfileScreen';
import { EditPostScreen } from '../screens/workout/EditPostScreen';
import { EditAvatarScreen } from '../screens/profile/EditAvatarScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { NotificationCenterScreen } from '../screens/profile/NotificationCenterScreen';
import { NotificationSettingsScreen } from '../screens/profile/NotificationSettingsScreen';
import { ShopAndInventoryScreen } from '../screens/profile/ShopAndInventoryScreen';
import { BottomNavTabs } from './BottomNavTabs';
import type { MainStackParamList } from './types';

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainNavigator() {
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1 }}>
    <Stack.Navigator
      initialRouteName="BottomNavTabs"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="BottomNavTabs" component={BottomNavTabs} />
      <Stack.Screen name="Themes" component={ThemesScreen} />

      {/* Phase 3 — Workouts */}
      <Stack.Screen name="ExerciseLibrary" component={ExerciseLibraryScreen} />
      <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} />
      <Stack.Screen name="NewExercise" component={NewExerciseScreen} />
      <Stack.Screen name="NewPreset" component={NewPresetScreen} />
      <Stack.Screen name="PresetDetail" component={PresetDetailScreen} />
      <Stack.Screen name="SaveWorkout" component={SaveWorkoutScreen} />
      <Stack.Screen name="WorkoutSchedule" component={WorkoutScheduleScreen} />
      <Stack.Screen name="WorkoutGenerator" component={WorkoutGeneratorScreen} />

      {/* Phase 4 — TOP1% Ranking, Body Graph, Benchmarks & Adaptive Coach */}
      <Stack.Screen name="Bodygraph" component={BodygraphScreen} />
      <Stack.Screen name="BenchmarkLab" component={BenchmarkLabScreen} />
      <Stack.Screen name="CoachHub" component={CoachHubScreen} />
      <Stack.Screen name="WearableReadiness" component={WearableReadinessScreen} />
      <Stack.Screen name="RankGallery" component={RankGalleryScreen} />
      <Stack.Screen name="RankCalculator" component={RankCalculatorScreen} />
      <Stack.Screen name="RankPrediction" component={RankPredictionScreen} />
      <Stack.Screen name="RankLeagues" component={RankLeaguesScreen} />
      <Stack.Screen name="StreaksAndReports" component={StreaksAndReportsScreen} />
      <Stack.Screen name="GoalsQuestsMedals" component={GoalsQuestsMedalsScreen} />
      <Stack.Screen name="RecapStories" component={RecapStoriesScreen} />

      {/* Phase 5 — Nutrition & Health */}
      <Stack.Screen name="FoodSearch" component={FoodSearchScreen} />
      <Stack.Screen name="HealthMetrics" component={HealthMetricsScreen} />

      {/* Phase 6 — Social, Friends & Leaderboards */}
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="EditPost" component={EditPostScreen} />
      <Stack.Screen name="Friends" component={FriendsScreen} />
      <Stack.Screen name="PublicProfile" component={PublicProfileScreen} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Stack.Screen name="FeatureRequests" component={FeatureRequestsScreen} />

      {/* Phase 7 — Customization & Settings */}
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="EditAvatar" component={EditAvatarScreen} />
      <Stack.Screen name="ShopAndInventory" component={ShopAndInventoryScreen} />
      <Stack.Screen name="NotificationCenter" component={NotificationCenterScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
    </Stack.Navigator>
    <ActiveWorkoutSheet />
    </View>
  );
}
