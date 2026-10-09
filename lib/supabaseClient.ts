'use client';
import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseConfig } from './supabaseConfig';
export function getSupabaseClient() {
  const config = getSupabaseConfig();
  return config ? createBrowserClient(config.url, config.key) : null;
}
