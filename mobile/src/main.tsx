import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import Dashboard from '@/components/Dashboard';
import SignInForm from '@/components/SignInForm';
import PasswordForm from '@/components/PasswordForm';
import AuthProvider from '@/components/providers/AuthProvider';
import LocaleProvider from '@/components/providers/LocaleProvider';
import InteractionProvider from '@/components/providers/InteractionProvider';
import {localePreference,NATIVE_LOCALE_KEY,normalizeLocale} from '@/lib/i18n';
import UsageAnalyticsProvider from '@/components/providers/UsageAnalyticsProvider';
import {appView} from '@/lib/appViews';
import {authModeFromQuery} from '@/lib/emailAuth';
import {nativeApiFetch} from '@/lib/nativeTransport';
import {getSupabaseClient} from './platform/client';
import {installNativeDownloads} from './platform/downloads';
import {useLocation,navigate} from './next/navigation';
import '@/app/globals.css';import '@/app/glass.css';import '@/app/personal.css';import '@/app/focus.css';import './mobile.css';import '@/app/training-shell.css';
const originalFetch=window.fetch.bind(window);
window.fetch=nativeApiFetch(originalFetch,'https://top1.fit',async()=>{const result=await getSupabaseClient()?.auth.getSession();if(result?.error)throw result.error;return result?.data.session?.access_token??null;});
function Screens(){
 const path=useLocation(),url=new URL(path,location.href);
 if(url.pathname==='/sign-in')return <SignInForm key={path} initialMode={authModeFromQuery(url.searchParams.get('mode'))} initialNext={url.searchParams.get('next')??'/'}/>;
 if(url.pathname==='/account/password')return <PasswordForm requireCurrent/>;
 if(url.pathname==='/reset-password')return <PasswordForm/>;
 return <Dashboard initialView={appView(url.searchParams)} initialMetric={url.searchParams.get('metric')}/>;
}
function MobileApp(){
 const [error,setError]=useState('');
 useEffect(()=>{
  const restoreDownloads=installNativeDownloads(setError);
  const click=(event:MouseEvent)=>{const link=(event.target as Element).closest('a');if(!link||link.download)return;const url=new URL(link.href,location.href);if(url.protocol==='https:'&&url.origin!==location.origin){event.preventDefault();void Browser.open({url:url.toString()}).catch(()=>setError('Unable to open this link.'));}};
  document.addEventListener('click',click);const handles:Promise<{remove:()=>Promise<void>}>[]=[];
  if(Capacitor.isNativePlatform()){
   handles.push(App.addListener('appStateChange',({isActive})=>{window.dispatchEvent(new Event(isActive?'top1-native-active':'top1-native-inactive'));const client=getSupabaseClient();if(isActive){client?.auth.startAutoRefresh();window.dispatchEvent(new Event('focus'));}else client?.auth.stopAutoRefresh();}));
   handles.push(App.addListener('backButton',({canGoBack})=>{if(canGoBack)history.back();else if(location.pathname!=='/'||location.search)navigate('/');else void App.exitApp();}));
  }
  return()=>{restoreDownloads();document.removeEventListener('click',click);handles.forEach(async h=>(await h).remove());};
 },[]);
 const [preference]=useState(()=>{
  try{return localePreference(localStorage.getItem(NATIVE_LOCALE_KEY));}
  catch{return 'device' as const;}
 });
 const locale=preference==='device'?normalizeLocale(navigator.language):preference;
 return <LocaleProvider initialLocale={locale} initialPreference={preference}><InteractionProvider><AuthProvider>{error&&<p role="alert">{error}</p>}<UsageAnalyticsProvider><Screens/></UsageAnalyticsProvider></AuthProvider></InteractionProvider></LocaleProvider>;
}
createRoot(document.getElementById('root')!).render(<MobileApp/>);
