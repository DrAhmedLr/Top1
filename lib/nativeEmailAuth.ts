import type { SupabaseClient } from '@supabase/supabase-js';
import {
  submitEmailAuth as submit,
  resendConfirmation as resend,
  type EmailAuthMode,
} from './emailAuth';
export * from './emailAuth';

// Email links from native mobile clients always point to the owned HTTPS site, never local native origins.
export const submitEmailAuth = (
  auth: SupabaseClient['auth'],
  mode: EmailAuthMode,
  email: string,
  password: string,
  confirmation: string,
  _origin: string,
  next = '/',
) => submit(auth, mode, email, password, confirmation, 'https://top1.fit', next);

export const resendConfirmation = (
  auth: SupabaseClient['auth'],
  email: string,
  _origin: string,
  next = '/',
) => resend(auth, email, 'https://top1.fit', next);
