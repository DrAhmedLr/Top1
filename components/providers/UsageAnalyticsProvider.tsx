'use client';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {getSupabaseClient} from '@/lib/supabaseClient';
import {recordView,setAnalyticsClient,type AnalyticsView} from '@/lib/analytics';
import {useCustomerJourney} from '@/lib/hooks/useCustomerJourney';
import {appView} from '@/lib/appViews';
import {useAuth} from './AuthProvider';

type Preference = {owner: string; enabled: boolean};
type UsageSettings = {journey: ReturnType<typeof useCustomerJourney>; signedIn: boolean; enabled: boolean; busy: boolean; failed: boolean; change: (value?:boolean)=>Promise<void>};
const Context = createContext<UsageSettings | null>(null);
export function useUsageSettings() {return useContext(Context);}

function currentScreen(): AnalyticsView | undefined {
  const {pathname,search} = window.location;
  if (pathname === '/') {
    const view = appView(new URLSearchParams(search));
    return view === 'performance' ? 'measurements' : view === 'potential' ? 'program' : view;
  }
  if (pathname.startsWith('/share/')) return 'share';
  if (pathname === '/privacy') return 'privacy';
  if (pathname === '/reset-password') return 'reset-password';
  if (pathname === '/account/password') return 'account-password';
}

export default function UsageAnalyticsProvider({children}:{children:ReactNode}) {
  const {user} = useAuth(), owner = user?.id, path = usePathname();
  const journey = useCustomerJourney(owner, path ?? '', currentScreen);
  const [preference,setPreference] = useState<Preference | null>(null);
  const [busy,setBusy] = useState(false), [failed,setFailed] = useState(false);
  const generation = useRef(0);
  const enabled = !!owner && preference?.owner === owner && preference.enabled;

  async function change(value?: boolean) {
    const ticket = ++generation.current;
    const client = getSupabaseClient();
    setFailed(false);
    setBusy(!!owner && !!client);
    if (!client || !owner) return;
    if (value === false) setAnalyticsClient(null);
    try {
      const {data,error} = await client.rpc('usage_preference', {p_owner:owner,p_enabled:value ?? null});
      if (error || typeof data !== 'boolean') throw new Error();
      if (generation.current === ticket) setPreference({owner,enabled:data});
    } catch {
      if (generation.current === ticket) {setPreference(null);setFailed(true);}
    } finally {
      if (generation.current === ticket) setBusy(false);
    }
  }

  useEffect(() => {
    setPreference(null);
    void change();
    return () => {generation.current++;setAnalyticsClient(null);};
  }, [owner]);

  useEffect(() => {
    if (!owner || !enabled) return;
    const client = getSupabaseClient();
    if (!client) return;
    setAnalyticsClient({capture(event,{view}) {
      // The database checks the current owner, active session and consent on each write.
      void Promise.resolve(client.rpc('record_usage_event',{p_owner:owner,p_event:event,p_view:view ?? ''})).catch(()=>{});
    }});
    const screen = currentScreen();
    if (screen) recordView(screen);
    return () => setAnalyticsClient(null);
  }, [owner,enabled]);
  useEffect(() => {
    const screen = currentScreen();
    if (screen) recordView(screen);
  }, [path]);

  return <Context.Provider value={{journey,signedIn:!!owner,enabled,busy,failed,change}}>{children}</Context.Provider>;
}
