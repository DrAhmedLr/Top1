'use client';
import LanguageToggle from './LanguageToggle';
import {useTranslations} from '@/components/providers/LocaleProvider';
import { useEffect,useState,type FormEvent } from 'react';
import Link from 'next/link';
import { Activity,ArrowRight,ShieldCheck,Eye,EyeOff } from 'lucide-react';
import { motion,useReducedMotion } from 'framer-motion';
import { authErrorMessage,MIN_PASSWORD_LENGTH,resendConfirmation,submitEmailAuth,type EmailAuthMode } from '@/lib/emailAuth';
import {captureEvent,recordView} from '@/lib/analytics';
import { safeNextPath } from '@/lib/profile';
import { useAuth } from '@/components/providers/AuthProvider';
import { getSupabaseClient } from '@/lib/supabaseClient';
export default function SignInForm({initialMode,initialNext}:{initialMode:EmailAuthMode;initialNext:string}){
 const {t:tr}=useTranslations();

 const [mode,setMode]=useState<EmailAuthMode>(initialMode),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[visible,setVisible]=useState(false),[resendAfter,setResendAfter]=useState(0),[now,setNow]=useState(0);
 const client=getSupabaseClient(),reduced=useReducedMotion(),auth=useAuth();
 useEffect(()=>{const params=new URLSearchParams(window.location.search);if(params.has('error'))setError('The confirmation or recovery link could not be completed. Request a new email.');if(params.has('passwordUpdated'))setMessage('Your password has been updated. Sign in with your new password.');},[]);
 useEffect(()=>{if(!resendAfter)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[resendAfter]);
 useEffect(()=>{if(auth.ready&&auth.user)window.location.assign(safeNextPath(new URLSearchParams(window.location.search).get('next')));},[auth.ready,auth.user]);
 useEffect(()=>{recordView(mode);},[mode]);
 const next=()=>initialNext;
 function changeMode(value:EmailAuthMode){setMode(value);setPassword('');setConfirmation('');setError('');setMessage('');setVisible(false);const url=new URL(window.location.href);url.searchParams.set('mode',value);window.history.replaceState(null,'',url);}
 async function submit(event:FormEvent){
  event.preventDefault();if(!client||busy||(mode==='forgot-password'&&Date.now()<resendAfter))return;setBusy(true);setError('');setMessage('');
  try{const result=await submitEmailAuth(client.auth,mode,email,password,confirmation,window.location.origin,next());setPassword('');setConfirmation('');captureEvent(mode==='sign-up'?'signup_requested':mode==='forgot-password'?'recovery_requested':'login_succeeded');if(result.signedIn){window.location.assign(next());return;}setMessage(result.message);if(mode==='sign-up'||mode==='forgot-password'){setNow(Date.now());setResendAfter(Date.now()+60000);}}
  catch(error){setError(authErrorMessage(error));}finally{setBusy(false);}
 }
 async function resend(){
  if(!client||busy||Date.now()<resendAfter)return;setBusy(true);setError('');setMessage('');
  try{setMessage(await resendConfirmation(client.auth,email,window.location.origin,next()));setNow(Date.now());setResendAfter(Date.now()+60000);}catch(error){setError(authErrorMessage(error));}finally{setBusy(false);}
 }
 const remaining=Math.max(0,Math.ceil((resendAfter-now)/1000));
 return <main className="auth-page"><div className="auth-language"><LanguageToggle/></div><motion.section className="auth-card" initial={reduced?false:{opacity:0,y:14}} animate={{opacity:1,y:0}}>
  <Link href="/" className="brand"><span className="brand-symbol"><Activity/></span>{tr("TOP1")}</Link>
  <h1>{tr(mode==='sign-up'?'Join TOP1.':mode==='forgot-password'?'Reset your password.':'Welcome back.')}</h1>
  <p>{tr(mode==='sign-up'?'Your progress. Always with you.':mode==='forgot-password'?'We’ll email a secure link to reset your password.':'Log in to your account.')}</p>
  {mode!=='forgot-password'&&<div className="auth-tabs" role="group" aria-label={tr("Account action")}><button aria-pressed={mode==='sign-in'} disabled={busy} onClick={()=>changeMode('sign-in')}>{tr("Log in")}</button><button aria-pressed={mode==='sign-up'} disabled={busy} onClick={()=>changeMode('sign-up')}>{tr("Join TOP1")}</button></div>}
  <form className="email-auth-form" onSubmit={event=>void submit(event)}>
   <label htmlFor="auth-email">{tr("Email")}<input id="auth-email" type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={event=>setEmail(event.target.value)} autoCapitalize="none" spellCheck={false}/></label>
   {mode!=='forgot-password'&&<><label htmlFor="auth-password">{tr("Password")}<div className="password-input"><input id="auth-password" type={visible?'text':'password'} autoComplete={mode==='sign-up'?'new-password':'current-password'} required minLength={mode==='sign-up'?MIN_PASSWORD_LENGTH:undefined} maxLength={mode==='sign-up'?128:undefined} value={password} disabled={busy} onChange={event=>setPassword(event.target.value)}/><button type="button" aria-label={tr(visible?'Hide password':'Show password')} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>{mode==='sign-up'&&<><label htmlFor="auth-confirm">{tr("Confirm password")}<input id="auth-confirm" type={visible?'text':'password'} autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} maxLength={128} value={confirmation} disabled={busy} onChange={event=>setConfirmation(event.target.value)}/></label><small>{tr("At least ")}{MIN_PASSWORD_LENGTH} {tr("characters.")}</small></>}</>}
   {error&&<p className="field-error" role="alert">{tr(error)}</p>}{message&&<p className="auth-success" role="status">{tr(message)}</p>}
   <button className="primary-button auth-submit" type="submit" disabled={!client||busy||(mode==='forgot-password'&&remaining>0)}>{tr(busy?'Please wait…':mode==='sign-up'?'Join TOP1':mode==='forgot-password'?remaining>0?`Send again in ${remaining}s`:'Send reset link':'Log in')}<ArrowRight size={18}/></button>
  </form>
  {!client&&<p role="status">{tr("Account access is temporarily unavailable. Your local measurements remain on this device.")}</p>}
  <div className="auth-links">{mode==='sign-in'?<button disabled={busy} onClick={()=>changeMode('forgot-password')}>{tr("Forgot password?")}</button>:<button disabled={busy} onClick={()=>changeMode('sign-in')}>{tr("Back to log in")}</button>}{mode!=='forgot-password'&&<button disabled={!client||busy||remaining>0} onClick={()=>void resend()}>{tr(remaining>0?`Resend confirmation in ${remaining}s`:'Resend confirmation email')}</button>}</div>
  <div className="auth-privacy"><ShieldCheck size={17}/><span>{tr("Private by default. ")}<Link href="/privacy">{tr("Data & privacy")}</Link></span></div>
  <Link href="/" className="text-link">{tr("Back to TOP1 ")}<ArrowRight size={14}/></Link>
 </motion.section></main>;
}
