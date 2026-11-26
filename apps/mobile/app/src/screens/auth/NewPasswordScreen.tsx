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
  useAlert,
} from '../../components/ui';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'NewPassword'>;

export function NewPasswordScreen({ navigation, route }: Props) {
  const { showAlert } = useAlert();
  const [token, setToken] = useState(route.params?.token ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const resetMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      showAlert({
        title: 'Password Updated',
        message: 'You can now sign in with your new password.',
        actions: [
          {
            text: 'Go to Sign In',
            onPress: () => navigation.navigate('SignIn'),
          },
        ],
      });
    },
    onError: (err) => setErrorMsg(err.message),
  });

  const handleSave = () => {
    if (!token.trim()) {
      setErrorMsg('Reset token is required.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setErrorMsg(null);
    resetMutation.mutate({ token: token.trim(), newPassword });
  };

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="New Password" onBack={() => navigation.goBack()} />
      <ScreenContainer scroll safeTop={false} contentStyle={{ paddingTop: 20 }}>
        <AppCard variant="second_outlined" style={{ gap: 14 }}>
          <AppInput
            label="Reset Token"
            placeholder="Paste reset token"
            value={token}
            onChangeText={setToken}
          />
          <AppInput
            label="New Password"
            placeholder="At least 6 characters"
            isPassword
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <AppInput
            label="Confirm Password"
            placeholder="Re-enter password"
            isPassword
            value={confirm}
            onChangeText={setConfirm}
          />
          {errorMsg ? (
            <AppText size="sm" tone="negative">
              {errorMsg}
            </AppText>
          ) : null}
          <AppButton
            title="Update Password"
            loading={resetMutation.isPending}
            onPress={handleSave}
          />
        </AppCard>
      </ScreenContainer>
    </View>
  );
}
