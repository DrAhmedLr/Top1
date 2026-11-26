import React, { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { trpc } from '../../api/trpc';
import {
  AppButton,
  AppCard,
  AppInput,
  AppText,
  ScreenContainer,
  StackHeader,
} from '../../components/ui';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'OnboardingCredentials'>;

export function OnboardingCredentialsScreen({ navigation }: Props) {
  const draft = useAuthStore((s) => s.onboardingDraft);
  const setSession = useAuthStore((s) => s.setSession);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cleanUsername = username.trim().toLowerCase();
  const availability = trpc.user.checkUsernameAvailable.useQuery(
    { username: cleanUsername },
    { enabled: cleanUsername.length >= 3 && /^[a-z0-9_.]+$/.test(cleanUsername) }
  );

  const signUpMutation = trpc.auth.signUp.useMutation({
    onSuccess: async (data) => {
      setErrorMsg(null);
      await setSession(data);
    },
    onError: (err) => {
      setErrorMsg(err.message);
    },
  });

  const handleCreate = () => {
    if (!displayName.trim() || !cleanUsername || !email.trim() || password.length < 6) {
      setErrorMsg('Fill all fields (password must be at least 6 characters).');
      return;
    }
    setErrorMsg(null);
    signUpMutation.mutate({
      displayName: displayName.trim(),
      username: cleanUsername,
      email: email.trim().toLowerCase(),
      password,
      rankingSex: draft.rankingSex,
      age: draft.age,
      heightCm: draft.heightCm,
      bodyweightKg: draft.bodyweightKg,
      unitWeight: draft.unitWeight,
      unitMeasure: draft.unitMeasure,
      fitnessGoal: draft.fitnessGoal,
      experienceLevel: draft.experienceLevel,
      weeklyWorkoutGoal: draft.weeklyWorkoutGoal,
      avatarConfig: draft.avatarConfig,
      onboardingBenchmarks:
        draft.benchmarkWeightKg > 0
          ? [
              {
                exerciseId: draft.benchmarkExerciseId,
                weightKg: draft.benchmarkWeightKg,
                reps: draft.benchmarkReps,
              },
            ]
          : undefined,
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="Finish Sign Up" onBack={() => navigation.goBack()} />
      <ScreenContainer scroll safeTop={false} contentStyle={{ paddingTop: 16 }}>
        <View style={{ gap: 4 }}>
          <AppText size="lg" weight="black">
            Lock in your profile
          </AppText>
          <AppText size="sm" tone="sub">
            Your starting rank ({draft.demoRankLabel}) and starter goals will be saved right away.
          </AppText>
        </View>

        <AppCard variant="second_outlined" style={{ gap: 14 }}>
          <AppInput
            label="Display Name"
            placeholder="Alex Mercer"
            leftIconName="person-outline"
            value={displayName}
            onChangeText={setDisplayName}
          />
          <View style={{ gap: 4 }}>
            <AppInput
              label="Username"
              placeholder="alex_lifts"
              autoCapitalize="none"
              autoCorrect={false}
              leftIconName="at"
              value={username}
              onChangeText={setUsername}
            />
            {availability.data ? (
              <AppText
                size="xsm"
                weight="semibold"
                tone={availability.data.available ? 'check' : 'negative'}
              >
                {availability.data.available ? 'Username is available' : 'Username is taken'}
              </AppText>
            ) : null}
          </View>
          <AppInput
            label="Email"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            leftIconName="mail-outline"
            value={email}
            onChangeText={setEmail}
          />
          <AppInput
            label="Password"
            placeholder="At least 6 characters"
            isPassword
            leftIconName="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
          />

          {errorMsg ? (
            <AppText size="sm" tone="negative">
              {errorMsg}
            </AppText>
          ) : null}

          <AppButton
            title="Launch ApexLift"
            size="lg"
            loading={signUpMutation.isPending}
            onPress={handleCreate}
          />
        </AppCard>
      </ScreenContainer>
    </View>
  );
}
