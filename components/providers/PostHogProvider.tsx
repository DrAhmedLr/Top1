'use client';
import { createContext,useEffect,useState,type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { PostHog } from 'posthog-js';
import { setAnalyticsClient } from '@/lib/analytics';
export const AnalyticsContext=createContext<PostHog|null>(null);
export default function PostHogProvider({children}:{children:ReactNode}) {
  const path=usePathname();const [client,setClient]=useState<PostHog|null>(null);
  useEffect(()=>{
    const key=process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if(!key)return;
    let active=true;let instance:PostHog|null=null;
    void import('posthog-js').then(({default:posthog})=>{
      if(!active)return;
      instance=posthog;
      posthog.init(key,{
        api_host:process.env.NEXT_PUBLIC_POSTHOG_HOST||'https://us.i.posthog.com',
        capture_pageview:false,capture_pageleave:false,autocapture:false,
        disable_session_recording:true,persistence:'memory',person_profiles:'never',
        advanced_disable_feature_flags:true,
        sanitize_properties: properties => {
          delete properties.$current_url;delete properties.$referrer;
          delete properties.$pathname;delete properties.$initial_current_url;delete properties.$initial_referrer;
          return properties;
        },
      });
      setAnalyticsClient(posthog);setClient(posthog);
    }).catch(()=>{/* Analytics must never block the health dashboard. */});
    return()=>{active=false;setAnalyticsClient(null);instance?.reset();};
  },[]);
  useEffect(()=>{client?.capture('$pageview',{route:path.startsWith('/share/')?'/share/[username]':path});},[path,client]);
  return <AnalyticsContext.Provider value={client}>{children}</AnalyticsContext.Provider>;
}
