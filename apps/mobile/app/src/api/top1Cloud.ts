import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://uyivfmmiwehfkcemjvmh.supabase.co';
const DEFAULT_API_ORIGIN = 'https://top1.fit';

export function getTop1ApiOrigin(): string {
  if (process.env.EXPO_PUBLIC_TOP1_API_ORIGIN) {
    return process.env.EXPO_PUBLIC_TOP1_API_ORIGIN.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return DEFAULT_API_ORIGIN;
}

export function getSupabaseConfig(): { url: string; key: string } | null {
  const url = (process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
  const key = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!url || !key) return null;
  return { url, key };
}

let cachedClient: SupabaseClient | null = null;

export function getTop1Supabase(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const cfg = getSupabaseConfig();
  if (!cfg) return null;
  cachedClient = createClient(cfg.url, cfg.key, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return cachedClient;
}

export async function getTop1CloudSession(): Promise<Session | null> {
  const client = getTop1Supabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session ?? null;
}

export async function signInTop1Cloud(email: string, password: string) {
  const client = getTop1Supabase();
  if (!client) throw new Error('Supabase publishable key not configured in EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message);
  return data.session;
}

export async function signUpTop1Cloud(email: string, password: string) {
  const client = getTop1Supabase();
  if (!client) throw new Error('Supabase publishable key not configured.');
  const { data, error } = await client.auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(error.message);
  return data;
}

export async function signOutTop1Cloud() {
  const client = getTop1Supabase();
  if (!client) return;
  await client.auth.signOut();
}

/**
 * Sends an authenticated Bearer request to Top1.Fit's Next.js API routes
 * using the exact native security headers validated by `lib/nativeApi.ts`.
 */
export async function top1CloudFetch<T = unknown>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  const session = await getTop1CloudSession();
  if (!session?.access_token || !session.user?.id) {
    throw new Error('Sign in with your Top1.Fit cloud account first.');
  }
  const url = `${getTop1ApiOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
  const isBrowser = typeof window !== 'undefined' && Boolean(window.location?.origin);
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      ...(!isBrowser ? { Origin: 'https://localhost' } : {}),
      Authorization: `Bearer ${session.access_token}`,
      'X-Profile-User': session.user.id,
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(payload?.error || `Cloud request failed (${res.status})`);
  }
  return payload;
}

export type CloudOverviewResponse = {
  owner: string;
  email: string;
  username: string;
  isPublic: boolean;
  isOperator: boolean;
  shareUrl: string | null;
  ogImageUrl: string | null;
  adminUrl: string | null;
  revision: number;
  gamification: {
    xp: number;
    credits: number;
    streak_days: number;
    longest_streak: number;
    owned_cosmetics: string[];
    claimed_levels: number[];
    strava_connected: boolean;
  };
};

export const top1CloudApi = {
  getOverview: () => top1CloudFetch<CloudOverviewResponse>('/api/mobile/overview'),
  getPosts: (scope: 'all' | 'mine' = 'all') =>
    top1CloudFetch<{ posts: Array<Record<string, unknown>> }>(`/api/mobile/posts?scope=${scope}`),
  createPost: (payload: Record<string, unknown>) =>
    top1CloudFetch('/api/mobile/posts', { method: 'POST', body: payload }),
  editPost: (payload: Record<string, unknown>) =>
    top1CloudFetch('/api/mobile/posts', { method: 'PATCH', body: payload }),
  deletePost: (id: string) =>
    top1CloudFetch(`/api/mobile/posts?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getSocial: () =>
    top1CloudFetch<{
      friends: Array<Record<string, unknown>>;
      featureRequests: Array<{
        id: string;
        title: string;
        description: string;
        status: 'open' | 'planned' | 'shipped';
        votes_count: number;
        created_at: string;
      }>;
    }>('/api/mobile/social'),
  submitFeatureRequest: (title: string, description: string) =>
    top1CloudFetch('/api/mobile/social', {
      method: 'POST',
      body: { action: 'feature_request', title, description },
    }),
  getGamification: () => top1CloudFetch('/api/mobile/gamification'),
  setStravaConnected: (connected: boolean) =>
    top1CloudFetch('/api/mobile/gamification', {
      method: 'POST',
      body: { action: 'set_strava', connected },
    }),
  rerollDailyDeals: () =>
    top1CloudFetch('/api/mobile/gamification', {
      method: 'POST',
      body: { action: 'reroll_deals' },
    }),
  exportAccountData: () => top1CloudFetch('/api/account/export'),
  getPublicShareUrl: (username: string) =>
    `${getTop1ApiOrigin()}/share/${encodeURIComponent(username.replace(/^@/, ''))}`,
  getAdminPanelUrl: () => `${getTop1ApiOrigin()}/admin?tab=backend`,
};
