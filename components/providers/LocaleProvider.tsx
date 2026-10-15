'use client';
import {createContext,useCallback,useContext,useMemo,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {LOCALE_COOKIE,localeDirection,translate,type Locale} from '@/lib/i18n';
const LocaleContext=createContext({locale:'en' as Locale,t:(message:string|undefined|null)=>message??'',setLocale:(_locale:Locale)=>{}});
export default function LocaleProvider({initialLocale,children}:{initialLocale:Locale;children:ReactNode}){
 const [locale,updateLocale]=useState(initialLocale),router=useRouter();
 const setLocale=useCallback((next:Locale)=>{
  updateLocale(next);document.documentElement.lang=next;document.documentElement.dir=localeDirection(next);
  document.cookie=`${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;
  router.refresh();
 },[router]);
 const value=useMemo(()=>({locale,t:(message:string|undefined|null)=>translate(locale,message),setLocale}),[locale,setLocale]);
 return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
export const useTranslations=()=>useContext(LocaleContext);
