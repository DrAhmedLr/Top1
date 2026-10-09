'use client';
import { createContext,useContext,useEffect,useState,type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useAuthMigration } from '@/lib/hooks/useAuthMigration';
import type { ProfileState } from '@/lib/profile';
type AuthState={user:User|null;ready:boolean;configured:boolean;cloud:ProfileState|null;loading:boolean;error:string;retry:()=>void;signOut:()=>Promise<void>};
const Context=createContext<AuthState|null>(null);
export function useAuth(){const context=useContext(Context);if(!context)throw new Error('AuthProvider missing');return context;}
export default function AuthProvider({children}:{children:ReactNode}){
  const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false);
  const client=getSupabaseClient();
  const migration=useAuthMigration(user?.id);
  useEffect(()=>{
    if(!client){setReady(true);return;}
    const {data}=client.auth.onAuthStateChange((_event,session)=>{setUser(session?.user??null);setReady(true);});
    return()=>data.subscription.unsubscribe();
  },[client]);
  async function signOut(){const {error}=await client!.auth.signOut();if(error)throw error;setUser(null);}
  return <Context.Provider value={{user,ready,configured:!!client,cloud:migration.userId===user?.id?migration.profile:null,loading:!!user&&(migration.userId!==user.id||migration.loading),error:migration.userId===user?.id?migration.error:'',retry:migration.retry,signOut}}>{children}</Context.Provider>;
}
