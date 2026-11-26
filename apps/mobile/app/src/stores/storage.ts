import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const ACCESS_TOKEN_KEY = 'top1_access_token';
export const REFRESH_TOKEN_KEY = 'top1_refresh_token';
export const TOKEN_EXPIRY_KEY = 'top1_token_expiry';
export const LOGOUT_PENDING_KEY = 'top1_logout_pending';

export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.removeItem(key);
    } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
