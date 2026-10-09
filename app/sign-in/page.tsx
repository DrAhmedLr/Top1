'use client';
import { useEffect,useState,type FormEvent } from 'react';
import Link from 'next/link';
import { Activity,ArrowRight,ShieldCheck,Eye,EyeOff } from 'lucide-react';
import { motion,useReducedMotion } from 'framer-motion';
import { authErrorMessage,MIN_PASSWORD_LENGTH,resendConfirmation,submitEmailAuth,type EmailAuthMode } from '@/lib/emailAuth';
import { safeNextPath } from '@/lib/profile';
import { getSupabaseClient } from '@/lib/supabaseClient';
export default function SignIn(){
 const [mode,setMode]=useState<EmailAuthMode>('sign-in'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[visible,setVisible]=useState(false),[resendAfter,setResendAfter]=useState(0),[now,setNow]=useState(0);
 const client=getSupabaseClient(),reduced=useReducedMotion();
 useEffect(()=>{const params=new URLSearchParams(window.location.search);if(params.has('error'))setError('The confirmation or recovery link could not be completed. Request a new email.');if(params.has('passwordUpdated'))setMessage('Your password has been updated. Sign in with your new password.');},[]);
 useEffect(()=>{if(!resendAfter)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[resendAfter]);
 const next=()=>safeNextPath(new URLSearchParams(window.location.search).get('next'));
 function changeMode(value:EmailAuthMode){setMode(value);setPassword('');setConfirmation('');setError('');setMessage('');setVisible(false);}
 async function submit(event:FormEvent){
  event.preventDefault();if(!client||busy)return;setBusy(true);setError('');setMessage('');
  try{const result=await submitEmailAuth(client.auth,mode,email,password,confirmation,window.location.origin,next());setPassword('');setConfirmation('');if(result.signedIn){window.location.assign(next());return;}setMessage(result.message);if(mode==='sign-up'){setNow(Date.now());setResendAfter(Date.now()+60000);}}
  catch(error){setError(authErrorMessage(error));}finally{setBusy(false);}
 }
 async function resend(){
  if(!client||busy||Date.now()<resendAfter)return;setBusy(true);setError('');setMessage('');
  try{setMessage(await resendConfirmation(client.auth,email,window.location.origin,next()));setNow(Date.now());setResendAfter(Date.now()+60000);}catch(error){setError(authErrorMessage(error));}finally{setBusy(false);}
 }
 const remaining=Math.max(0,Math.ceil((resendAfter-now)/1000));
 return <main className="auth-page"><motion.section className="auth-card" initial={reduced?false:{opacity:0,y:14}} animate={{opacity:1,y:0}}>
  <Link href="/" className="brand"><span className="brand-symbol"><Activity/></span>TOP1</Link>
  <span className="eyebrow">YOUR PROGRESS, CONNECTED</span><h1>{mode==='sign-up'?'Make it yours.':mode==='forgot-password'?'Find your way back.':'Welcome back.'}</h1>
  <p>{mode==='sign-up'?'Create your account to keep measurements across devices.':mode==='forgot-password'?'We’ll email a secure link to reset your password.':'Sign in to your private measurement workspace.'}</p>
  {mode!=='forgot-password'&&<div className="auth-tabs" role="group" aria-label="Account action"><button aria-pressed={mode==='sign-in'} disabled={busy} onClick={()=>changeMode('sign-in')}>Sign in</button><button aria-pressed={mode==='sign-up'} disabled={busy} onClick={()=>changeMode('sign-up')}>Create account</button></div>}
  <form className="email-auth-form" onSubmit={event=>void submit(event)}>
   <label htmlFor="auth-email">Email<input id="auth-email" type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={event=>setEmail(event.target.value)} autoCapitalize="none" spellCheck={false}/></label>
   {mode!=='forgot-password'&&<><label htmlFor="auth-password">Password<div className="password-input"><input id="auth-password" type={visible?'text':'password'} autoComplete={mode==='sign-up'?'new-password':'current-password'} required minLength={mode==='sign-up'?MIN_PASSWORD_LENGTH:undefined} maxLength={mode==='sign-up'?128:undefined} value={password} disabled={busy} onChange={event=>setPassword(event.target.value)}/><button type="button" aria-label={visible?'Hide password':'Show password'} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>{mode==='sign-up'&&<><label htmlFor="auth-confirm">Confirm password<input id="auth-confirm" type={visible?'text':'password'} autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} maxLength={128} value={confirmation} disabled={busy} onChange={event=>setConfirmation(event.target.value)}/></label><small>Use at least {MIN_PASSWORD_LENGTH} characters. A password manager can help.</small></>}</>}
   {error&&<p className="field-error" role="alert">{error}</p>}{message&&<p className="auth-success" role="status">{message}</p>}
   <button className="primary-button auth-submit" type="submit" disabled={!client||busy}>{busy?'Please wait…':mode==='sign-up'?'Create account':mode==='forgot-password'?'Send recovery email':'Sign in'}<ArrowRight size={18}/></button>
  </form>
  {!client&&<p role="status">Account access is temporarily unavailable. Your local measurements remain on this device.</p>}
  <div className="auth-links">{mode==='sign-in'?<button disabled={busy} onClick={()=>changeMode('forgot-password')}>Forgot password?</button>:<button disabled={busy} onClick={()=>changeMode('sign-in')}>Back to sign in</button>}{mode!=='forgot-password'&&<button disabled={!client||busy||remaining>0} onClick={()=>void resend()}>{remaining>0?`Resend confirmation in ${remaining}s`:'Resend confirmation email'}</button>}</div>
  <div className="auth-privacy"><ShieldCheck size={17}/><span>Private by default. Personal measurements saved on this device move into your account after sign-in. Demo measurements are excluded. <Link href="/privacy">Data &amp; privacy</Link></span></div>
  <Link href="/" className="text-link">Explore the dashboard <ArrowRight size={14}/></Link>
 </motion.section></main>;
}
