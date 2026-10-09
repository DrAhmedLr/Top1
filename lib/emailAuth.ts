import type { SupabaseClient } from '@supabase/supabase-js';
import { safeNextPath } from './profile';
export type EmailAuthMode='sign-in'|'sign-up'|'forgot-password';
export const MIN_PASSWORD_LENGTH=12;
export function normalizeEmail(input:string){
 const email=input.trim();
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid email address.');
 return email;
}
export function validatePassword(password:string,confirmation:string){
 if(password.length<MIN_PASSWORD_LENGTH)throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
 if(password.length>128)throw new Error('Use a password of 128 characters or fewer.');
 if(password!==confirmation)throw new Error('The passwords do not match.');
}
export function authCallbackUrl(origin:string,next='/'){
 const url=new URL('/auth/callback',origin);url.searchParams.set('next',safeNextPath(next));return url.toString();
}
export function authErrorMessage(error:unknown){
 const code=error&&typeof error==='object'&&'code' in error?String(error.code):'';
 if(code==='invalid_credentials')return 'The email or password is incorrect.';
 if(code==='email_not_confirmed')return 'Confirm your email before signing in. You can resend the confirmation below.';
 if(code==='over_email_send_rate_limit'||code==='over_request_rate_limit')return 'Too many attempts. Wait a moment before trying again.';
 if(code==='email_address_not_authorized'||code==='email_address_invalid')return 'Email delivery is unavailable for this address. Please contact support.';
 if(code==='weak_password')return 'Choose a longer, stronger password.';
 if(code==='same_password')return 'Choose a different password from the current one.';
 if(code==='signup_disabled')return 'New account registration is temporarily unavailable.';
 if(code==='session_not_found'||code==='otp_expired')return 'The confirmation or recovery link has expired. Request a new one.';
 return error instanceof Error&&error.name==='Error'?error.message:'Unable to complete this request. Please try again.';
}
export async function submitEmailAuth(auth:SupabaseClient['auth'],mode:EmailAuthMode,emailInput:string,password:string,confirmation:string,origin:string,next='/'){
 const email=normalizeEmail(emailInput);
 if(mode==='forgot-password'){
  const {error}=await auth.resetPasswordForEmail(email,{redirectTo:authCallbackUrl(origin,'/reset-password')});if(error)throw error;
  return {signedIn:false,message:'If this address has an account, a password recovery email has been sent. Check your inbox and spam folder.'};
 }
 if(mode==='sign-up'){
  validatePassword(password,confirmation);
  const {data,error}=await auth.signUp({email,password,options:{emailRedirectTo:authCallbackUrl(origin,next)}});if(error)throw error;
  return {signedIn:!!data.session,message:data.session?'Your account is ready.':'Check your inbox to confirm your email before signing in. If you already have an account, sign in instead.'};
 }
 if(!password)throw new Error('Enter your password.');
 const {error}=await auth.signInWithPassword({email,password});if(error)throw error;
 return {signedIn:true,message:'Signed in.'};
}
export async function resendConfirmation(auth:SupabaseClient['auth'],emailInput:string,origin:string,next='/'){
 const {error}=await auth.resend({type:'signup',email:normalizeEmail(emailInput),options:{emailRedirectTo:authCallbackUrl(origin,next)}});if(error)throw error;
 return 'If confirmation is needed, a new email has been sent. Check your inbox and spam folder.';
}
export async function replacePassword(auth:SupabaseClient['auth'],password:string,confirmation:string,currentPassword?:string){
 validatePassword(password,confirmation);
 if(currentPassword!==undefined){
  if(!currentPassword)throw new Error('Enter your current password.');
  const {data:current,error:userError}=await auth.getUser();
  if(userError||!current.user?.email)throw new Error('Sign in before changing your password.');
  // Provider enforcement is optional: verify credentials explicitly before
  // changing a signed-in account password, even when that setting is disabled.
  const {data:verified,error:passwordError}=await auth.signInWithPassword({email:current.user.email,password:currentPassword});
  if(passwordError)throw new Error('Your current password is incorrect.');
  if(verified.user?.id!==current.user.id){await auth.signOut({scope:'local'});throw new Error('Your session changed. Sign in again.');}
 }
 const {error}=await auth.updateUser({password,...(currentPassword!==undefined?{current_password:currentPassword}:{})});if(error)throw error;
 const {error:signOutError}=await auth.signOut({scope:'global'});
 return {signedOut:!signOutError};
}
