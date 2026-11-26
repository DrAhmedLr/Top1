import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeProvider';
import { LandingScreen } from '../screens/auth/LandingScreen';
import { NewPasswordScreen } from '../screens/auth/NewPasswordScreen';
import { OnboardingAvatarScreen } from '../screens/auth/OnboardingAvatarScreen';
import { OnboardingCredentialsScreen } from '../screens/auth/OnboardingCredentialsScreen';
import { OnboardingPlanAndGoalScreen } from '../screens/auth/OnboardingPlanAndGoalScreen';
import { OnboardingQuestionnaireScreen } from '../screens/auth/OnboardingQuestionnaireScreen';
import { OnboardingRankDemoScreen } from '../screens/auth/OnboardingRankDemoScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';
import { SignInScreen } from '../screens/auth/SignInScreen';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="Landing"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="NewPassword" component={NewPasswordScreen} />
      <Stack.Screen name="OnboardingQuestionnaire" component={OnboardingQuestionnaireScreen} />
      <Stack.Screen name="OnboardingRankDemo" component={OnboardingRankDemoScreen} />
      <Stack.Screen name="OnboardingPlanAndGoal" component={OnboardingPlanAndGoalScreen} />
      <Stack.Screen name="OnboardingAvatar" component={OnboardingAvatarScreen} />
      <Stack.Screen name="OnboardingCredentials" component={OnboardingCredentialsScreen} />
    </Stack.Navigator>
  );
}
