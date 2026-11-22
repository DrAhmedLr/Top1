import type {SupabaseClient} from '@supabase/supabase-js';
import {submitEmailAuth as submit,resendConfirmation as resend} from '../../../lib/emailAuth';
export * from '../../../lib/emailAuth';
// Email links always point to the owned HTTPS site, never capacitor://localhost.
export const submitEmailAuth=(auth:SupabaseClient['auth'],mode:import('../../../lib/emailAuth').EmailAuthMode,email:string,password:string,confirmation:string,_origin:string,next='/')=>submit(auth,mode,email,password,confirmation,'https://top1.fit',next);
export const resendConfirmation=(auth:SupabaseClient['auth'],email:string,_origin:string,next='/')=>resend(auth,email,'https://top1.fit',next);
