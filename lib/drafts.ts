import {normalizeDemographics,normalizeValues,normalizeUsername,type ProfileState} from './profile';
import {normalizePublicFields} from './sharing';
import {normalizeMeasurementMetadata} from './measurementMetadata';
export const draftKey=(owner:string)=>`top1-unsaved-${owner}`;
export function discardAcknowledgedDraft(storage:Pick<Storage,'getItem'|'removeItem'>,key:string,acknowledged:string){
 if(storage.getItem(key)!==acknowledged)return false;
 storage.removeItem(key);return true;
}
export function profileFingerprint(p:ProfileState){return JSON.stringify([normalizeDemographics(p.demographics),normalizeValues(p.values),normalizeMeasurementMetadata(p.measurementDetails,{legacy:true}),normalizeUsername(p.username),p.isPublic,normalizePublicFields(p.publicFields)]);}
export function parseDraft(raw:string|null,owner:string):ProfileState|null{
 try{if(!raw)return null;const d=JSON.parse(raw);if(d.owner!==owner||d.version!==1||!Number.isSafeInteger(d.profile.revision)||d.profile.revision<0||typeof d.profile.isPublic!=='boolean')return null;
 return {...d.profile,demographics:normalizeDemographics(d.profile.demographics),values:normalizeValues(d.profile.values,true),measurementDetails:normalizeMeasurementMetadata(d.profile.measurementDetails,{legacy:true}),username:normalizeUsername(d.profile.username)};}catch{return null;}
}
export function serializeDraft(profile:ProfileState,owner:string){return JSON.stringify({version:1,owner,profile:{...profile,values:normalizeValues(profile.values)}});}
