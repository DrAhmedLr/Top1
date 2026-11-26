import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BottomTabBar } from '../components/ui';
import { HomeTabScreen } from '../screens/shell/HomeTabScreen';
import { NutritionTabScreen } from '../screens/shell/NutritionTabScreen';
import { ProfileTabScreen } from '../screens/shell/ProfileTabScreen';
import { RanksTabScreen } from '../screens/shell/RanksTabScreen';
import { WorkoutsTabScreen } from '../screens/shell/WorkoutsTabScreen';
import type { BottomTabParamList } from './types';

const Tab = createBottomTabNavigator<BottomTabParamList>();

export function BottomNavTabs() {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeTabScreen} />
      <Tab.Screen name="WorkoutsTab" component={WorkoutsTabScreen} />
      <Tab.Screen name="RanksTab" component={RanksTabScreen} />
      <Tab.Screen name="NutritionTab" component={NutritionTabScreen} />
      <Tab.Screen name="ProfileTab" component={ProfileTabScreen} />
    </Tab.Navigator>
  );
}
