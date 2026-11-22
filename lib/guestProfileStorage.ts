import {readGuestHistory,validGuestHistory,type Observation} from './history';
import {normalizeMeasurementMetadata} from './measurementMetadata';
import type {Demographics} from './registry';
import {LOCAL_PROFILE_KEYS,parseLocalProfile,type ProfileState} from './profile';

type GuestSnapshot=Pick<ProfileState,'demographics'|'values'|'measurementDetails'>;
export class GuestProfileReadError extends Error {}
export class GuestProfileConflictError extends Error {}

export function readGuestProfile(read:(key:string)=>string|null) {
  try {
    for(const key of LOCAL_PROFILE_KEYS) {
      const raw=read(key);
      if(raw===null)continue;
      const profile=parseLocalProfile(raw);
      if(profile)return profile;
    }
    return null;
  } catch {
    throw new GuestProfileReadError('The guest profile could not be read.');
  }
}

export function writeGuestProfile(storage:Pick<Storage,'getItem'|'setItem'>,profile:GuestSnapshot,expected?:ProfileState|null) {
  // Another tab may have changed storage since this editor opened.
  const current=readGuestProfile(key=>storage.getItem(key));
  if(expected!==undefined&&JSON.stringify(current)!==JSON.stringify(expected)){
    throw new GuestProfileConflictError('Your guest profile changed in another tab. Reload before saving.');
  }
  const raw=JSON.stringify({...profile,setupComplete:true});
  const next=parseLocalProfile(raw);
  storage.setItem(LOCAL_PROFILE_KEYS[0],raw);
  return next;
}

export function readStoredGuestHistory(storage:Pick<Storage,'getItem'>) {
  const raw=storage.getItem('top1-history-guest');
  const entries=readGuestHistory(raw);
  const invalid=raw!==null&&(!raw||!validGuestHistory(raw)||entries.some(entry=>{
    if(typeof entry.cleared!=='boolean'||entry.cleared!==(entry.value===null))return true;
    const context=normalizeMeasurementMetadata({[entry.metricId]:entry},{legacy:true});
    return !!context[entry.metricId]?.invalidContext;
  }));
  if(invalid)throw new Error('Stored history could not be read. Your records have been retained.');
  return {raw,entries};
}

/** Validate the journal before changing either copy. Restore it if the profile write fails. */
export function commitGuestHistory(
  storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,
  changes:Omit<Observation,'id'>[],
  demographics:Demographics|undefined,
  writeProfile?:()=>void,
) {
  const {raw,entries}=readStoredGuestHistory(storage);
  if(!changes.length){writeProfile?.();return entries;}
  const referenceContext=demographics?{profileAgeAtEntry:demographics.age,referenceSexAtEntry:demographics.sex}:undefined;
  const lastSequence=entries.reduce((highest,row)=>Math.max(highest,row.sequence??0),0);
  const next=[...entries,...changes.map((entry,index)=>({...entry,id:crypto.randomUUID(),sequence:lastSequence+index+1,referenceContext}))];
  storage.setItem('top1-history-guest',JSON.stringify({version:1,entries:next}));
  try { writeProfile?.(); }
  catch(error) {
    if(raw===null)storage.removeItem('top1-history-guest');
    else storage.setItem('top1-history-guest',raw);
    throw error;
  }
  return next;
}
