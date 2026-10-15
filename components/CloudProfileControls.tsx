'use client';
import {useTranslations} from '@/components/providers/LocaleProvider';
import type {PublicFields} from '@/lib/sharing';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Copy,Lock,Globe,ArrowUpRight,LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from './providers/AuthProvider';
import { normalizeUsername } from '@/lib/profile';
import { captureEvent } from '@/lib/analytics';
export default function CloudProfileControls({publicFields,onPublicFields,username,onUsernameChange,isPublic,shareUsername,onVisibilityChange,canShare,canWithdraw,onNotice}:{
  publicFields:PublicFields;onPublicFields:(fields:PublicFields)=>void;username:string;shareUsername?:string;onUsernameChange:(value:string)=>void;isPublic:boolean;onVisibilityChange:(value:boolean)=>Promise<void>;canShare:boolean;canWithdraw:boolean;onNotice:(message:string)=>void;
}){
 const {t:tr}=useTranslations();

  const auth=useAuth();const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [draft, setDraft] = useState(username);
  useEffect(() => { setDraft(username); setError(''); }, [username, auth.user?.id]);
  function saveUsername() { try { const next = normalizeUsername(draft); if (isPublic && !next) throw new Error('Keep a username while your profile is public, or make it private first.'); onUsernameChange(next); setDraft(next); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Check your username.'); } }
  if(!auth.user)return <div className="cloud-profile-box"><Lock size={20}/><div><h3>{tr("Keep your progress.")}</h3><p>{tr("Access your measurements across devices.")}</p></div><Link href="/sign-in?mode=sign-up" className="primary-button">{tr("Join TOP1")}</Link></div>;
  async function toggle(){setBusy(true);setError('');try{await onVisibilityChange(!isPublic);}catch(error){setError(error instanceof Error?error.message:'Unable to change visibility.');}finally{setBusy(false);}}
  const link=typeof window==='undefined'?'':`${window.location.origin}/share/${shareUsername??username}`;
  async function copy(){try{await navigator.clipboard.writeText(link);captureEvent('public_link_shared',{channel:'clipboard'});onNotice('Public profile link copied.');}catch{setError('Clipboard unavailable. Select the link below to copy it.');}}
  return <div className="privacy-panel">
    <div className="privacy-heading"><span className="privacy-icon">{isPublic?<Globe size={20}/>:<Lock size={20}/>}</span><div><h3>{tr("Profile visibility")}</h3><p>{tr(isPublic?'Your reviewed summary fields are public.':'Your profile and measurements are private.')}</p></div><motion.button type="button" className={`privacy-switch ${isPublic?'on':''}`} role="switch" aria-label={tr("Public profile visibility")} aria-checked={isPublic} disabled={busy||(isPublic?!canWithdraw:!canShare)} whileTap={{scale:.94}} onClick={()=>void toggle()}><motion.span layout transition={{type:'spring',stiffness:450,damping:32}}/></motion.button></div>
    <p className="sharing-preview">{tr("Public summary preview: username, age cohort, recording coverage and experimental capacity points")}{tr(publicFields.referenceSex?", reference sex":"")}{tr(publicFields.bodySize?", body size":"")}{tr(". Raw observations and exact age stay private.")}</p><fieldset disabled={busy||!canShare}><legend>{tr("Optional public fields")}</legend><label><input type="checkbox" checked={publicFields.referenceSex} onChange={e=>onPublicFields({...publicFields,referenceSex:e.target.checked})}/>{tr("Include reference sex")}</label><label><input type="checkbox" checked={publicFields.bodySize} onChange={e=>onPublicFields({...publicFields,bodySize:e.target.checked})}/>{tr("Include weight and height")}</label></fieldset><label className="username-field">{tr("Public username")}<div><span>@</span><input value={draft} placeholder={tr("your-name")} maxLength={30} autoCapitalize="none" autoComplete="off" spellCheck={false} onChange={event=>setDraft(event.target.value.toLowerCase())}/></div></label>
    <small>{tr("3–30 letters, numbers, underscores or hyphens. Start with a letter or number. Raw metric logs stay private.")}</small><button className="secondary-button username-save" disabled={busy || !canShare || draft === username} onClick={saveUsername}>{tr("Save username")}</button>
    {!canShare&&!isPublic&&<p className="drawer-description">{tr("Complete your profile before sharing.")}</p>}
    {isPublic&&shareUsername&&<div className="share-actions"><a href={link} target="_blank" rel="noreferrer">{tr(link)}</a><button className="primary-button" disabled={busy} onClick={()=>void copy()}><Copy size={15}/>{tr("Copy profile link")}</button><a className="secondary-button" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('My personal progress summary on TOP1')}&url=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer" onClick={()=>captureEvent('public_link_shared',{channel:'x'})}>{tr("Share on X ")}<ArrowUpRight size={15}/></a></div>}
    {error&&<p className="field-error" role="alert">{tr(error)}</p>}
    <Link href="/account/password" className="text-link account-signout">{tr("Change password")}</Link><button className="text-link account-signout" onClick={()=>void auth.signOut().catch(error=>setError(error.message))}><LogOut size={14}/> {tr("Sign out")}</button>
  </div>;
}
