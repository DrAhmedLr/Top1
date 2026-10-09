import { LOCAL_PROFILE_KEYS, parseLocalProfile } from './profile';
export interface MigrationStorage { getItem(key:string):string|null; removeItem(key:string):void }
export interface MigrationClient { rpc(name:'migrate_local_profile',args:Record<string,unknown>):PromiseLike<{error:{message:string}|null}> }
export async function migrateLocalProfile(client:MigrationClient,storage:MigrationStorage,fingerprint:(raw:string)=>Promise<string>){
  let migrated=false;
  // Process each stored snapshot independently. A demo or invalid first key
  // must not cause a different personal snapshot to disappear.
  for(const key of LOCAL_PROFILE_KEYS){
    const raw=storage.getItem(key);if(raw===null)continue;
    const profile=parseLocalProfile(raw);if(!profile)continue;
    const {error}=await client.rpc('migrate_local_profile',{p_import_id:await fingerprint(raw),p_demographics:profile.demographics,p_metrics:profile.values,p_details:profile.measurementDetails??{}});
    if(error)throw new Error(`Migration failed: ${error.message}. Unmigrated local measurements are still saved.`);
    if(storage.getItem(key)!==raw)throw new Error('Local measurements changed during sync. The newer snapshot was retained.');
    storage.removeItem(key);migrated=true;
  }
  return migrated;
}
