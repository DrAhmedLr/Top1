'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {LOCALE_COOKIE,NATIVE_LOCALE_KEY,localeDirection,normalizeLocale,translate,type Locale,type LocalePreference} from '@/lib/i18n';

const LocaleContext=createContext({
 locale:'en' as Locale,
 preference:'device' as LocalePreference,
 t:(message:string|undefined|null)=>message??'',
 setLocale:(_locale:LocalePreference)=>{},
});

export default function LocaleProvider({initialLocale,initialPreference='device',children}:{
 initialLocale:Locale;initialPreference?:LocalePreference;children:ReactNode;
}) {
 const [locale,updateLocale]=useState(initialLocale);
 const [preference,updatePreference]=useState(initialPreference);
 const router=useRouter();

 useEffect(()=>{
  document.documentElement.lang=locale;
  document.documentElement.dir=localeDirection(locale);
 },[locale]);

 useEffect(()=>{
  if(preference!=='device')return;
  const detect=()=>{updateLocale(normalizeLocale(navigator.language));router.refresh();};
  window.addEventListener('languagechange',detect);
  return ()=>window.removeEventListener('languagechange',detect);
 },[preference,router]);

 const setLocale=useCallback((next:LocalePreference)=>{
  updatePreference(next);
  updateLocale(next==='device'?normalizeLocale(navigator.language):next);
  if(process.env.NEXT_PUBLIC_NATIVE_APP==='1'){
   try {
    if(next==='device')localStorage.removeItem(NATIVE_LOCALE_KEY);
    else localStorage.setItem(NATIVE_LOCALE_KEY,next);
   } catch { /* The choice still applies to this session. */ }
  } else {
   document.cookie=`${LOCALE_COOKIE}=${next==='device'?'':next}; Path=/; Max-Age=${next==='device'?0:31536000}; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;
  }
  router.refresh();
 },[router]);
 const value=useMemo(()=>({locale,preference,t:(message:string|undefined|null)=>translate(locale,message),setLocale}),[locale,preference,setLocale]);
 return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
export const useTranslations=()=>useContext(LocaleContext);
