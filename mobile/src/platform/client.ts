import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {Capacitor} from '@capacitor/core';
import {SecureStorage,KeychainAccess} from '@aparajita/capacitor-secure-storage';
import {getSupabaseConfig} from '../../../lib/supabaseConfig';
let client:SupabaseClient|null=null;
let ready:Promise<void>|undefined;
const initialize=()=>ready??=(async()=>{await SecureStorage.setSynchronize(false);await SecureStorage.setDefaultKeychainAccess(KeychainAccess.afterFirstUnlockThisDeviceOnly);})();
const memory=new Map<string,string>();
// Browser previews keep sessions in memory; native releases use Keychain/Keystore only.
const storage={
 getItem:async(key:string)=>{if(!Capacitor.isNativePlatform())return memory.get(key)??null;await initialize();const value=await SecureStorage.get(key,false,false);if(value===null)return null;if(typeof value!=='string')throw Error('Invalid secure session.');return value;},
 setItem:async(key:string,value:string)=>{if(!Capacitor.isNativePlatform()){memory.set(key,value);return;}await initialize();await SecureStorage.set(key,value,false);},
 removeItem:async(key:string)=>{if(!Capacitor.isNativePlatform()){memory.delete(key);return;}await initialize();await SecureStorage.remove(key,false);}
};
export function getSupabaseClient(){const config=getSupabaseConfig();if(!config)return null;return client??=createClient(config.url,config.key,{auth:{storage,storageKey:'top1-native-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce'}});}
