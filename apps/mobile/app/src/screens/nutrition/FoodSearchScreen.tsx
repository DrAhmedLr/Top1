import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { trpc } from '../../api/trpc';
import {
  AppButton,
  AppCard,
  AppInput,
  AppText,
  ScreenContainer,
  SegmentedControl,
  StackHeader,
  useAppAlert,
} from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import type { MainStackParamList } from '../../navigation/types';

export function FoodSearchScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation();
  const route = useRoute<RouteProp<MainStackParamList, 'FoodSearch'>>();
  const { dateIso } = route.params;
  const { showAlert } = useAppAlert();
  const utils = trpc.useUtils();

  const [tab, setTab] = useState<'search' | 'custom' | 'bundles'>(
    route.params.initialTab ?? 'search'
  );
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(
    route.params.mealType ?? 'lunch'
  );
  const [query, setQuery] = useState('');

  // Custom food form
  const [cName, setCName] = useState('');
  const [cBrand, setCBrand] = useState('Custom');
  const [cCalories, setCCalories] = useState('250');
  const [cProtein, setCProtein] = useState('25');
  const [cCarbs, setCCarbs] = useState('20');
  const [cFat, setCFat] = useState('8');

  const searchQuery = trpc.food.search.useQuery({ query });
  const bundlesQuery = trpc.food.listBundles.useQuery();

  const logFood = trpc.food.logFood.useMutation({
    onSuccess: () => {
      utils.food.getLogsByDate.invalidate({ dateIso });
      showAlert({ title: 'Food Logged', message: `Added to ${mealType} on ${dateIso}.` });
    },
  });

  const createCustom = trpc.food.createCustom.useMutation({
    onSuccess: () => {
      utils.food.search.invalidate();
      setCName('');
      setTab('search');
      showAlert({ title: 'Custom Food Saved', message: 'You can now search and log it anytime.' });
    },
  });

  return (
    <ScreenContainer scroll>
      <StackHeader title="Add Nutrition" subtitle={`Logging for ${dateIso}`} />

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { label: 'Food Search', value: 'search' },
          { label: 'Bundles', value: 'bundles' },
          { label: 'Custom Food', value: 'custom' },
        ]}
      />

      {/* Meal Selector */}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((m) => {
          const active = mealType === m;
          return (
            <Pressable
              key={m}
              onPress={() => setMealType(m)}
              style={{
                flex: 1,
                paddingVertical: 7,
                borderRadius: RADII.pill,
                alignItems: 'center',
                backgroundColor: active ? hexToRgba(c.constant, 0.2) : c.secondBg,
                borderWidth: 1,
                borderColor: active ? c.constant : c.thirdBg,
              }}
            >
              <AppText size="xsm" weight="bold" tone={active ? 'constant' : 'sub'}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {tab === 'search' ? (
        <View style={{ gap: 10 }}>
          <AppInput
            placeholder="Search chicken, oats, whey, rice..."
            value={query}
            onChangeText={setQuery}
          />
          {(searchQuery.data ?? []).map((food) => (
            <AppCard
              key={food.id}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <AppText size="sm" weight="bold">
                  {food.name}
                </AppText>
                <AppText size="xsm" tone="sub">
                  {food.brand} • {food.servingSize}
                  {food.servingUnit} • {food.calories} kcal
                </AppText>
                <AppText size="xsm" tone="constant">
                  P {food.proteinG}g • C {food.carbsG}g • F {food.fatG}g
                </AppText>
              </View>
              <AppButton
                label="+ Log"
                size="sm"
                loading={logFood.isPending}
                onPress={() =>
                  logFood.mutate({
                    dateIso,
                    mealType,
                    foodId: food.id,
                    foodName: food.name,
                    servings: 1,
                    calories: food.calories,
                    proteinG: food.proteinG,
                    carbsG: food.carbsG,
                    fatG: food.fatG,
                  })
                }
              />
            </AppCard>
          ))}
        </View>
      ) : null}

      {tab === 'bundles' ? (
        <View style={{ gap: 10 }}>
          {(bundlesQuery.data ?? []).length === 0 ? (
            <AppCard>
              <AppText size="sm" tone="sub">
                No meal bundles saved yet.
              </AppText>
            </AppCard>
          ) : (
            (bundlesQuery.data ?? []).map((b) => (
              <AppCard key={b.id} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <AppText size="md" weight="bold">
                      {b.name}
                    </AppText>
                    <AppText size="xsm" tone="sub">
                      {Math.round(b.totalCalories)} kcal • P {Math.round(b.totalProteinG)}g • C{' '}
                      {Math.round(b.totalCarbsG)}g • F {Math.round(b.totalFatG)}g
                    </AppText>
                  </View>
                  <AppButton
                    label="Log Bundle"
                    size="sm"
                    onPress={() =>
                      logFood.mutate({
                        dateIso,
                        mealType,
                        foodId: null,
                        foodName: b.name,
                        servings: 1,
                        calories: b.totalCalories,
                        proteinG: b.totalProteinG,
                        carbsG: b.totalCarbsG,
                        fatG: b.totalFatG,
                      })
                    }
                  />
                </View>
                <AppText size="xsm" tone="sub">
                  Includes: {b.items.map((i) => `${i.foodName} (${i.servings}×)`).join(', ')}
                </AppText>
              </AppCard>
            ))
          )}
        </View>
      ) : null}

      {tab === 'custom' ? (
        <AppCard style={{ gap: 12 }}>
          <AppInput label="Food Name" placeholder="e.g. Homemade Protein Pancakes" value={cName} onChangeText={setCName} />
          <AppInput label="Brand / Label" value={cBrand} onChangeText={setCBrand} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <AppInput label="Calories" keyboardType="decimal-pad" value={cCalories} onChangeText={setCCalories} containerStyle={{ flex: 1 }} />
            <AppInput label="Protein (g)" keyboardType="decimal-pad" value={cProtein} onChangeText={setCProtein} containerStyle={{ flex: 1 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <AppInput label="Carbs (g)" keyboardType="decimal-pad" value={cCarbs} onChangeText={setCCarbs} containerStyle={{ flex: 1 }} />
            <AppInput label="Fat (g)" keyboardType="decimal-pad" value={cFat} onChangeText={setCFat} containerStyle={{ flex: 1 }} />
          </View>
          <AppButton
            label="Save Custom Food"
            loading={createCustom.isPending}
            onPress={() => {
              if (!cName.trim()) return;
              createCustom.mutate({
                name: cName.trim(),
                brand: cBrand.trim() || 'Custom',
                servingSize: 100,
                servingUnit: 'g',
                calories: parseFloat(cCalories) || 0,
                proteinG: parseFloat(cProtein) || 0,
                carbsG: parseFloat(cCarbs) || 0,
                fatG: parseFloat(cFat) || 0,
              });
            }}
            fullWidth
          />
        </AppCard>
      ) : null}

      <AppButton label="Done" variant="secondary" onPress={() => navigation.goBack()} fullWidth />
    </ScreenContainer>
  );
}
