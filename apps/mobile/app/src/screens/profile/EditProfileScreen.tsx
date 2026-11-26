import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { kgToLbs, lbsToKg, type MeasureUnit, type RankingSex, type WeightUnit } from '@apexlift/shared';
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
import { useAuthStore } from '../../stores/authStore';

export function EditProfileScreen() {
  const navigation = useNavigation();
  const { showAlert } = useAppAlert();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [unitWeight, setUnitWeight] = useState<WeightUnit>(user?.unitWeight ?? 'lbs');
  const [unitMeasure, setUnitMeasure] = useState<MeasureUnit>(user?.unitMeasure ?? 'in');
  const [rankingSex, setRankingSex] = useState<RankingSex>(user?.rankingSex ?? 'Male');
  const [bwInput, setBwInput] = useState(
    String(
      Math.round(
        (user?.unitWeight ?? 'lbs') === 'lbs'
          ? kgToLbs(user?.bodyweightKg ?? 78)
          : (user?.bodyweightKg ?? 78)
      )
    )
  );
  const [weeklyGoal, setWeeklyGoal] = useState(String(user?.weeklyWorkoutGoal ?? 4));

  const updateMutation = trpc.user.updateProfile.useMutation({
    onSuccess: (updated) => {
      setUser(updated);
      showAlert({ title: 'Profile Updated', message: 'Your preferences have been saved.' });
      navigation.goBack();
    },
    onError: (err) => showAlert({ title: 'Save failed', message: err.message }),
  });

  return (
    <ScreenContainer scroll>
      <StackHeader title="Edit Profile & Units" subtitle="Bodyweight & sex calibrate strength ranks" />

      <AppCard style={{ gap: 12 }}>
        <AppInput label="Display Name" value={displayName} onChangeText={setDisplayName} />
        <AppInput label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
        <AppInput label="Bio" value={bio} onChangeText={setBio} multiline placeholder="Your lifting motto..." />
      </AppCard>

      <AppCard style={{ gap: 12 }}>
        <AppText size="sm" weight="bold" tone="sub">
          UNITS & RANKING CALIBRATION
        </AppText>
        <SegmentedControl
          value={unitWeight}
          onChange={setUnitWeight}
          options={[
            { label: 'Pounds (lbs)', value: 'lbs' },
            { label: 'Kilograms (kg)', value: 'kg' },
          ]}
        />
        <SegmentedControl
          value={unitMeasure}
          onChange={setUnitMeasure}
          options={[
            { label: 'Inches (in)', value: 'in' },
            { label: 'Centimeters (cm)', value: 'cm' },
          ]}
        />
        <SegmentedControl
          value={rankingSex}
          onChange={setRankingSex}
          options={[
            { label: 'Male Standards', value: 'Male' },
            { label: 'Female Standards', value: 'Female' },
          ]}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <AppInput
            label={`Bodyweight (${unitWeight})`}
            keyboardType="decimal-pad"
            value={bwInput}
            onChangeText={setBwInput}
            containerStyle={{ flex: 1 }}
          />
          <AppInput
            label="Weekly Goal (days)"
            keyboardType="number-pad"
            value={weeklyGoal}
            onChangeText={setWeeklyGoal}
            containerStyle={{ flex: 1 }}
          />
        </View>
      </AppCard>

      <AppButton
        label="Save Changes"
        loading={updateMutation.isPending}
        onPress={() => {
          const parsedBw = parseFloat(bwInput) || 75;
          const bwKg = unitWeight === 'lbs' ? lbsToKg(parsedBw) : parsedBw;
          updateMutation.mutate({
            displayName: displayName.trim() || undefined,
            username: username.trim().toLowerCase() || undefined,
            bio: bio.trim(),
            unitWeight,
            unitMeasure,
            rankingSex,
            bodyweightKg: Math.max(30, Math.min(250, bwKg)),
            weeklyWorkoutGoal: Math.max(1, Math.min(7, parseInt(weeklyGoal, 10) || 4)),
          });
        }}
        fullWidth
      />
    </ScreenContainer>
  );
}
