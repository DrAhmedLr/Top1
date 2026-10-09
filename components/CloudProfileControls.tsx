'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Copy,Lock,Globe,ArrowUpRight,LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from './providers/AuthProvider';
import { captureEvent } from '@/lib/analytics';
export default function CloudProfileControls({username,onUsernameChange,isPublic,shareUsername,onVisibilityChange,canShare,onNotice}:{
  username:string;shareUsername?:string;onUsernameChange:(value:string)=>void;isPublic:boolean;onVisibilityChange:(value:boolean)=>Promise<void>;canShare:boolean;onNotice:(message:string)=>void;
}){
  const auth=useAuth();const [busy,setBusy]=useState(false),[error,setError]=useState('');
  if(!auth.user)return <div className="cloud-profile-box"><Lock size={20}/><div><h3>Keep your progress with you.</h3><p>Sign in to save across devices and choose a public profile link.</p></div><Link href="/sign-in" className="primary-button">Sign in with email</Link></div>;
  async function toggle(){setBusy(true);setError('');try{await onVisibilityChange(!isPublic);}catch(error){setError(error instanceof Error?error.message:'Unable to change visibility.');}finally{setBusy(false);}}
  const link=typeof window==='undefined'?'':`${window.location.origin}/share/${shareUsername??username}`;
  async function copy(){try{await navigator.clipboard.writeText(link);captureEvent('public_link_shared',{channel:'clipboard'});onNotice('Public profile link copied.');}catch{setError('Clipboard unavailable. Select the link below to copy it.');}}
  return <div className="privacy-panel">
    <div className="privacy-heading"><span className="privacy-icon">{isPublic?<Globe size={20}/>:<Lock size={20}/>}</span><div><h3>Your profile, your choice.</h3><p>{isPublic?'Your cohort, body size, and score summary are public.':'Your profile and measurements are private.'}</p></div><motion.button type="button" className={`privacy-switch ${isPublic?'on':''}`} role="switch" aria-label="Public profile visibility" aria-checked={isPublic} disabled={busy||!canShare} whileTap={{scale:.94}} onClick={()=>void toggle()}><motion.span layout transition={{type:'spring',stiffness:450,damping:32}}/></motion.button></div>
    <label className="username-field">Public username<div><span>@</span><input value={username} placeholder="your-name" maxLength={30} autoCapitalize="none" autoComplete="off" spellCheck={false} onChange={event=>onUsernameChange(event.target.value.toLowerCase())}/></div></label>
    <small>3–30 characters. Your raw metric logs always stay private.</small>
    {!canShare&&<p className="drawer-description">Finish loading your personal profile to enable sharing. Demo measurements cannot be published.</p>}
    {isPublic&&shareUsername&&<div className="share-actions"><a href={link} target="_blank" rel="noreferrer">{link}</a><button className="primary-button" disabled={busy} onClick={()=>void copy()}><Copy size={15}/>Copy Public Profile Link</button><a className="secondary-button" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('My three-pillar performance profile on TOP1')}&url=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer" onClick={()=>captureEvent('public_link_shared',{channel:'x'})}>Share on X <ArrowUpRight size={15}/></a></div>}
    {error&&<p className="field-error" role="alert">{error}</p>}
    <Link href="/account/password" className="text-link account-signout">Change password</Link><button className="text-link account-signout" onClick={()=>void auth.signOut().catch(error=>setError(error.message))}><LogOut size={14}/> Sign out</button>
  </div>;
}
