import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { View } from 'react-native';
import { AppButton, type ButtonVariant } from './AppButton';
import { AppModal } from './AppModal';

export interface AlertAction {
  text?: string;
  label?: string;
  variant?: ButtonVariant;
  onPress?: () => void;
}

interface AlertPayload {
  title: string;
  message?: string;
  actions?: AlertAction[];
  cancelable?: boolean;
}

interface AlertContextValue {
  showAlert: (payload: AlertPayload) => void;
  dismissAlert: () => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<AlertPayload | null>(null);

  const showAlert = useCallback((next: AlertPayload) => {
    setPayload(next);
  }, []);

  const dismissAlert = useCallback(() => {
    setPayload(null);
  }, []);

  const value = useMemo(() => ({ showAlert, dismissAlert }), [showAlert, dismissAlert]);

  const actions = payload?.actions ?? [{ text: 'OK', variant: 'primary' as const }];

  return (
    <AlertContext.Provider value={value}>
      {children}
      <AppModal
        visible={payload !== null}
        onClose={dismissAlert}
        title={payload?.title}
        subtitle={payload?.message}
        cancelable={payload?.cancelable ?? true}
      >
        <View style={{ gap: 10 }}>
          {actions.map((act, idx) => {
            const btnText = act.text ?? act.label ?? 'OK';
            return (
              <AppButton
                key={`${btnText}-${idx}`}
                title={btnText}
                fullWidth
                variant={act.variant ?? (idx === 0 ? 'primary' : 'secondary')}
                onPress={() => {
                  dismissAlert();
                  act.onPress?.();
                }}
              />
            );
          })}
        </View>
      </AppModal>
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used inside AlertProvider');
  return ctx;
}

export const useAppAlert = useAlert;
