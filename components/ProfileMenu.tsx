'use client';

import Link from 'next/link';
import {useEffect, useState} from 'react';
import {getSupabaseClient} from '@/lib/supabaseClient';
import {ArrowRight, ChartNoAxesCombined, History, LayoutDashboard, LogIn, Settings} from 'lucide-react';
import type {LocalePreference} from '@/lib/i18n';
import {useTranslations} from './providers/LocaleProvider';

type Props = {
 owner?:string;
 onSettings:()=>void;
 onHistory:()=>void;
 onRanking:()=>void;
};

export default function ProfileMenu({owner,onSettings,onHistory,onRanking}:Props) {
 const {locale,preference,t,setLocale} = useTranslations();
 const l = (en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const [grantedOwner,setGrantedOwner] = useState<string>();
 useEffect(() => {
   const client = getSupabaseClient();
   if (!owner || !client) return;
   let controller:AbortController;
   async function check() {
     controller?.abort();
     const request = new AbortController();
     controller = request;
     try {
       const result = await client!.rpc('is_usage_operator', {p_owner:owner}).abortSignal(request.signal);
       if (!request.signal.aborted) setGrantedOwner(!result.error && result.data === true ? owner : undefined);
     } catch {
       if (!request.signal.aborted) setGrantedOwner(undefined);
     }
   }
   void check();
   window.addEventListener('focus', check);
   return () => {controller.abort();window.removeEventListener('focus', check);};
 }, [owner]);
 return <section className="card profile-menu" aria-label={l('Profile options','Options du profil','خيارات الملف الشخصي')}>
  {!owner&&<Link href="/sign-in?next=%2F%3Fview%3Dprofile"><LogIn size={18}/>{t('Log in')}<ArrowRight size={16}/></Link>}
  <button type="button" onClick={onHistory}><History size={18}/>{l('Measurement history','Historique des mesures','سجل القياسات')}<ArrowRight size={16}/></button>
  <button type="button" onClick={onRanking}><ChartNoAxesCombined size={18}/>{l('My ranking','Mon classement','ترتيبي')}<ArrowRight size={16}/></button>
  <button type="button" onClick={onSettings}><Settings size={18}/>{l('Settings and privacy','Paramètres et confidentialité','الإعدادات والخصوصية')}<ArrowRight size={16}/></button>
  {owner && grantedOwner === owner && <a href={process.env.NEXT_PUBLIC_NATIVE_APP === '1' ? 'https://top1.fit/admin' : '/admin'}>
    <LayoutDashboard size={18}/>{l('Admin panel','Administration','لوحة الإدارة')}<ArrowRight size={16}/>
  </a>}
  <label>{t('Language')}
   <select value={preference} onChange={event=>setLocale(event.target.value as LocalePreference)}>
    <option value="device">{l('Device language','Langue de l’appareil','لغة الجهاز')}</option>
    <option value="en" lang="en">English</option><option value="fr" lang="fr">Français</option><option value="ar" lang="ar">العربية</option>
   </select>
  </label>
 </section>;
}
