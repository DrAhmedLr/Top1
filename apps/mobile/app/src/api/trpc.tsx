import React, { useState } from 'react';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink, type TRPCLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { observable } from '@trpc/server/observable';
import superjson from 'superjson';
import type { AppRouter } from '@apexlift/server/src/routers/index';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import {
  ACCESS_TOKEN_KEY,
  getSecureItem,
  REFRESH_TOKEN_KEY,
  setSecureItem,
  TOKEN_EXPIRY_KEY,
} from '../stores/storage';

export const trpc = createTRPCReact<AppRouter>();

export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000';
  return 'http://localhost:4000';
}

const rawRefreshClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getApiBaseUrl()}/api/trpc`,
      transformer: superjson,
    }),
  ],
});

let inflightRefresh: Promise<string | null> | null = null;

async function refreshAccessTokenOnce(): Promise<string | null> {
  if (!inflightRefresh) {
    inflightRefresh = (async () => {
      const refreshToken = await getSecureItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) return null;
      const result = await rawRefreshClient.auth.refreshToken.mutate({ refreshToken });
      await setSecureItem(ACCESS_TOKEN_KEY, result.accessToken);
      await setSecureItem(TOKEN_EXPIRY_KEY, String(result.accessTokenExpiresAt));
      return result.accessToken;
    })().finally(() => {
      inflightRefresh = null;
    });
  }
  return inflightRefresh;
}

const LOGOUT_ERROR_STRINGS = [
  'Invalid token',
  'Session not found',
  'Invalid session',
  'User not found',
  'Refresh token expired',
];

let activeQueryClient: QueryClient | null = null;

export async function signOutAndRevokeSession(): Promise<void> {
  try {
    const refreshToken = await getSecureItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      await rawRefreshClient.auth.removeSession.mutate({ refreshToken }).catch(() => null);
    }
  } finally {
    activeQueryClient?.clear();
    await useAuthStore.getState().clearSession();
  }
}

function createAuthLink(): TRPCLink<AppRouter> {
  return () =>
    ({ next, op }) =>
      observable((observer) => {
        const sub = next(op).subscribe({
          next(val) {
            observer.next(val);
          },
          error(err) {
            const msg = err?.message ?? '';

            if (msg.includes('Token has expired')) {
              refreshAccessTokenOnce()
                .then((newToken) => {
                  if (!newToken) {
                    void useAuthStore.getState().clearSession();
                    observer.error(err);
                    return;
                  }
                  next(op).subscribe({
                    next: (v) => observer.next(v),
                    error: (retryErr) => observer.error(retryErr),
                    complete: () => observer.complete(),
                  });
                })
                .catch(() => {
                  void useAuthStore.getState().clearSession();
                  observer.error(err);
                });
              return;
            }

            if (LOGOUT_ERROR_STRINGS.some((s) => msg.includes(s))) {
              void useAuthStore.getState().clearSession();
            }

            observer.error(err);
          },
          complete() {
            observer.complete();
          },
        });

        return () => sub.unsubscribe();
      });
}

function createServerStatusLink(): TRPCLink<AppRouter> {
  return () =>
    ({ next, op }) =>
      observable((observer) => {
        const sub = next(op).subscribe({
          next(val) {
            if (useAppStore.getState().serverStatus !== 'OK') {
              useAppStore.getState().setServerStatus('OK');
            }
            observer.next(val);
          },
          error(err) {
            const msg = err?.message ?? '';
            if (msg.includes('maintenance')) {
              useAppStore.getState().setServerStatus('MAINTENANCE');
            } else if (msg.includes('deprecated')) {
              useAppStore.getState().setServerStatus('DEPRECATED');
            }
            observer.error(err);
          },
          complete() {
            observer.complete();
          },
        });
        return () => sub.unsubscribe();
      });
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          retry: 1,
          staleTime: 30_000,
        },
      },
    });
    activeQueryClient = qc;
    return qc;
  });

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        createAuthLink(),
        createServerStatusLink(),
        httpBatchLink({
          url: `${getApiBaseUrl()}/api/trpc`,
          transformer: superjson,
          async headers() {
            const token = await getSecureItem(ACCESS_TOKEN_KEY);
            return token ? { Authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
