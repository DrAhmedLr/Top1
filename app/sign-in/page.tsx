'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { Activity,ArrowRight,ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { checkGoogleProvider } from '@/lib/auth';
import { getSupabaseConfig } from '@/lib/supabaseConfig';
import { getSupabaseClient } from '@/lib/supabaseClient';
export default function SignIn(){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const client=getSupabaseClient();
  useEffect(()=>{if(new URLSearchParams(window.location.search).has('error'))setError('Google sign-in could not be completed. Please try again.');},[]);
  async function signIn(){
    if(!client)return;
    setBusy(true);setError('');
    try{
      await checkGoogleProvider(getSupabaseConfig()!);
      const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:`${window.location.origin}/auth/callback`}});
      if(error)throw error;
    }catch(error){setError(error instanceof Error?error.message:'Sign-in failed. Please try again.');setBusy(false);}
  }
  return <main className="auth-page"><motion.section className="auth-card" initial={{opacity:0,y:14}} animate={{opacity:1,y:0}}>
    <Link href="/" className="brand"><span className="brand-symbol"><Activity/></span>TOP1 <span className="beta-tag">LIVE BETA</span></Link>
    <span className="eyebrow">YOUR NEXT CHAPTER</span><h1>Your progress.<br/>A place to keep it.</h1>
    <p>Save your measurements, return on any device, and choose what you share.</p>
    <button className="google-button" disabled={!client||busy} onClick={()=>void signIn()}><span className="google-mark">G</span>{busy?'Connecting…':'Continue with Google'}<ArrowRight size={18}/></button>
    {!client&&<p role="status">Cloud sign-in is being configured. You can still explore the local dashboard.</p>}
    {error&&<p className="field-error" role="alert">{error}</p>}
    <div className="auth-privacy"><ShieldCheck size={17}/><span>Private by default. Your existing personal measurements move into your account after sign-in.</span></div>
    <Link href="/" className="text-link">Explore the dashboard <ArrowRight size={14}/></Link>
  </motion.section></main>;
}
