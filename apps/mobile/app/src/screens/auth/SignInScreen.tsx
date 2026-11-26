import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
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

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

const DEMO_AUTH_ENABLED =
  (typeof __DEV__ !== 'undefined' && __DEV__) || process.env.EXPO_PUBLIC_ENABLE_DEMO_AUTH === 'true';

export function SignInScreen({ navigation }: Props) {
  const setSession = useAuthStore((s) => s.setSession);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const signInMutation = trpc.auth.signIn.useMutation({
    onSuccess: async (data) => {
      setErrorMsg(null);
      await setSession(data);
    },
    onError: (err) => {
      setErrorMsg(err.message);
    },
  });

  const handleSubmit = () => {
    if (!identifier.trim() || !password) {
      setErrorMsg('Please enter your email/username and password.');
      return;
    }
    setErrorMsg(null);
    signInMutation.mutate({ identifier: identifier.trim(), password });
  };

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="Sign In" onBack={() => navigation.goBack()} />
      <ScreenContainer scroll safeTop={false} contentStyle={{ paddingTop: 28, maxWidth: 480, alignSelf: 'center', width: '100%' }}>
        <View style={{ gap: 6 }}>
          <AppText size="lg" weight="black">
            Welcome back, lifter
          </AppText>
          <AppText size="sm" tone="sub">
            Sign in to sync your ranks, streaks, presets, and friends.
          </AppText>
        </View>

        <AppCard variant="second_outlined" style={{ gap: 14 }}>
          <AppInput
            label="Email or Username"
            placeholder="athlete@top1.fit"
            autoCapitalize="none"
            autoCorrect={false}
            leftIconName="person-outline"
            value={identifier}
            onChangeText={setIdentifier}
          />

          <AppInput
            label="Password"
            placeholder="Enter password"
            isPassword
            leftIconName="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleSubmit}
          />

          {errorMsg ? (
            <AppText size="sm" weight="semibold" tone="negative">
              {errorMsg}
            </AppText>
          ) : null}

          <Pressable
            onPress={() => navigation.navigate('ResetPassword')}
            style={{ alignSelf: 'flex-end' }}
          >
            <AppText size="sm" weight="bold" tone="constant">
              Forgot Password?
            </AppText>
          </Pressable>

          <AppButton
            title="Sign In"
            size="lg"
            loading={signInMutation.isPending}
            onPress={handleSubmit}
          />
        </AppCard>

        {DEMO_AUTH_ENABLED ? (
          <AppCard variant="third" style={{ gap: 8 }}>
            <AppText size="sm" weight="bold">
              Local Seed Account
            </AppText>
            <AppText size="xsm" tone="sub">
              Email: demo@apexlift.app • Password: demo1234
            </AppText>
            <AppButton
              title="Fill Demo Credentials"
              size="sm"
              variant="outline"
              onPress={() => {
                setIdentifier('demo@apexlift.app');
                setPassword('demo1234');
              }}
            />
          </AppCard>
        ) : null}
      </ScreenContainer>
    </View>
  );
}
