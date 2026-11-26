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

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

export function ResetPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [devToken, setDevToken] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const reqMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: (res) => {
      setSubmitted(true);
      setDevToken(res.devResetToken);
    },
  });

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="Forgot Password" onBack={() => navigation.goBack()} />
      <ScreenContainer scroll safeTop={false} contentStyle={{ paddingTop: 20 }}>
        <View style={{ gap: 6 }}>
          <AppText size="lg" weight="black">
            Reset your password
          </AppText>
          <AppText size="sm" tone="sub">
            Enter your account email and we will generate a reset link.
          </AppText>
        </View>

        <AppCard variant="second_outlined" style={{ gap: 14 }}>
          <AppInput
            label="Account Email"
            placeholder="athlete@top1.fit"
            autoCapitalize="none"
            keyboardType="email-address"
            leftIconName="mail-outline"
            value={email}
            onChangeText={setEmail}
          />
          <AppButton
            title="Send Reset Link"
            loading={reqMutation.isPending}
            onPress={() => {
              if (!email.trim()) return;
              reqMutation.mutate({ email: email.trim() });
            }}
          />
        </AppCard>

        {submitted ? (
          <AppCard variant="third" style={{ gap: 10 }}>
            <AppText size="sm" weight="bold" tone="check">
              Reset request processed
            </AppText>
            <AppText size="sm" tone="sub">
              {devToken
                ? 'Local dev token generated! Continue directly to set a new password.'
                : 'If an account matches that email, a reset link has been prepared.'}
            </AppText>
            {devToken ? (
              <AppButton
                title="Set New Password"
                variant="primary"
                size="sm"
                onPress={() => navigation.navigate('NewPassword', { token: devToken })}
              />
            ) : null}
          </AppCard>
        ) : null}
      </ScreenContainer>
    </View>
  );
}
