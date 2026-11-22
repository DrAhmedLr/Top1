import {normalizeTimestamp} from './timestamp';
import {parseMeasurementInput} from './measurementInput';

export const BODYWEIGHT_PAGE_SIZE=30;
export const bodyweightKey=(owner:string)=>`top1-bodyweight-v1:${owner}`;
export const bodyweightQueueKey=(owner:string)=>`top1-bodyweight-pending-v1:${owner}`;
export type WeightUnit='kg'|'lb';
export type WeightMutation={id:string;requestId:string;expectedRevision:number;epoch?:number;action:'save'|'delete'|'restore';value?:number;unit?:WeightUnit;measuredAt?:string;timeZone?:string};
export type WeightEvent={id:string;requestId:string;revision:number;kg:number;value:number;unit:WeightUnit;measuredAt:string;timeZone:string;recordedAt:string;deleted:boolean;action:WeightMutation['action'];source:'manual'|'guest_import'};
export type WeightCursor={date:string;id:string};
export type WeightPage={entries:WeightEvent[];latest:WeightEvent[];total:number;next:WeightCursor|null;epoch?:number};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validWeightId(value:unknown):value is string{return typeof value==='string'&&uuid.test(value);}
export function toKg(value:number,unit:WeightUnit){return Number((unit==='lb'?value*0.45359237:value).toFixed(3));}
export function fromKg(kg:number,unit:WeightUnit){return unit==='lb'?kg/0.45359237:kg;}
export function parseWeight(raw:string,unit:WeightUnit){
 const parsed=parseMeasurementInput(raw);
 if(!parsed||!Number.isFinite(Number(parsed)))throw new Error('Enter a valid weight.');
 const value=Number(Number(parsed).toFixed(6)),kg=toKg(value,unit);
 if(kg<25||kg>350)throw new Error('Weight must be 25–350 kg or its equivalent in pounds.');
 return {value,kg};
}
export function weightMutation(input:unknown,now=Date.now()):WeightMutation{
 if(!input||typeof input!=='object')throw new Error('Invalid weight entry.');
 const data=input as WeightMutation;
 if(!validWeightId(data.id)||!validWeightId(data.requestId)||!Number.isSafeInteger(data.expectedRevision)||data.expectedRevision<0||!['save','delete','restore'].includes(data.action))throw new Error('Invalid weight request.');
 if(data.epoch!==undefined&&(!Number.isSafeInteger(data.epoch)||data.epoch<0))throw new Error('Invalid weight history version.');
 if(data.action!=='save')return {id:data.id,requestId:data.requestId,expectedRevision:data.expectedRevision,epoch:data.epoch??0,action:data.action};
 if(typeof data.value!=='number'||!['kg','lb'].includes(data.unit!))throw new Error('Enter a value and unit.');
 const {value}=parseWeight(String(data.value),data.unit!);
 const measuredAt=normalizeTimestamp(data.measuredAt);
 if(Date.parse(measuredAt)>now+300000)throw new Error('Measurement dates cannot be in the future.');
 if(typeof data.timeZone!=='string'||data.timeZone.length>64)throw new Error('Choose a valid time zone.');
 try{new Intl.DateTimeFormat('en',{timeZone:data.timeZone});}catch{throw new Error('Choose a valid time zone.');}
 return {id:data.id,requestId:data.requestId,expectedRevision:data.expectedRevision,epoch:data.epoch??0,action:'save',value,unit:data.unit,measuredAt,timeZone:data.timeZone};
}
export function latestWeights(events:WeightEvent[],includeDeleted=false){
 const entries=new Map<string,WeightEvent>();
 for(const event of events){const old=entries.get(event.id);if(!old||event.revision>old.revision)entries.set(event.id,event);}
 return [...entries.values()].filter(event=>includeDeleted||!event.deleted).sort((a,b)=>Date.parse(b.measuredAt)-Date.parse(a.measuredAt)||b.id.localeCompare(a.id));
}
export function weightPage(events:WeightEvent[],cursor:WeightCursor|null=null,includeDeleted=false,limit=BODYWEIGHT_PAGE_SIZE):WeightPage{
 const all=latestWeights(events,includeDeleted);
 const filtered=cursor?all.filter(row=>Date.parse(row.measuredAt)<Date.parse(cursor.date)||row.measuredAt===cursor.date&&row.id<cursor.id):all;
 const entries=filtered.slice(0,limit),last=entries.at(-1);
 return {entries,latest:latestWeights(events).slice(0,2),total:all.length,next:filtered.length>limit&&last?{date:last.measuredAt,id:last.id}:null};
}
export function appendWeight(events:WeightEvent[],input:WeightMutation,now=Date.now(),source:WeightEvent['source']='manual'){
 const mutation=weightMutation(input,now),old=latestWeights(events,true).find(row=>row.id===mutation.id);
 const duplicate=events.find(row=>row.requestId===mutation.requestId);
 if(duplicate){
  if(duplicate.id!==mutation.id||duplicate.revision!==mutation.expectedRevision+1||duplicate.action!==mutation.action||mutation.action==='save'&&(duplicate.value!==mutation.value||duplicate.unit!==mutation.unit||duplicate.measuredAt!==mutation.measuredAt||duplicate.timeZone!==mutation.timeZone))throw new Error('This request ID was already used for another change.');
  return {events,event:duplicate};
 }
 if((old?.revision??0)!==mutation.expectedRevision)throw new Error('This entry changed. Reload it before editing.');
 if(mutation.action!=='save'&&!old)throw new Error('This entry no longer exists.');
 if(mutation.action==='restore'&&!old?.deleted)throw new Error('This entry is already active.');
 const event:WeightEvent={
  id:mutation.id,requestId:mutation.requestId,revision:mutation.expectedRevision+1,
  kg:mutation.action==='save'?toKg(mutation.value!,mutation.unit!):old!.kg,
  value:mutation.action==='save'?mutation.value!:old!.value,
  unit:mutation.action==='save'?mutation.unit!:old!.unit,
  measuredAt:mutation.action==='save'?mutation.measuredAt!:old!.measuredAt,
  timeZone:mutation.action==='save'?mutation.timeZone!:old!.timeZone,
  recordedAt:new Date(now).toISOString(),deleted:mutation.action==='delete',action:mutation.action,source,
 };
 return {events:[...events,event],event};
}
export function weightEvent(input:unknown):WeightEvent{
 const data=input as WeightEvent;
 if(!data||!validWeightId(data.id)||!validWeightId(data.requestId)||!Number.isInteger(data.revision)||data.revision<1||typeof data.deleted!=='boolean'||!['manual','guest_import'].includes(data.source))throw new Error('Stored weight history needs review.');
 const normalized=weightMutation({id:data.id,requestId:data.requestId,expectedRevision:data.revision-1,action:'save',value:Number(data.value),unit:data.unit,measuredAt:data.measuredAt,timeZone:data.timeZone});
 if(typeof data.kg!=='number'||Math.abs(toKg(normalized.value!,normalized.unit!)-data.kg)>.001||!['save','delete','restore'].includes(data.action))throw new Error('Stored weight units do not match.');
 return {...data,value:normalized.value!,measuredAt:normalized.measuredAt!,recordedAt:normalizeTimestamp(data.recordedAt)};
}
export function readWeightHistory(raw:string|null):WeightEvent[]{
 if(raw===null)return [];
 const stored=JSON.parse(raw);
 if(stored?.version!==1||!Array.isArray(stored.events))throw new Error('Stored weight history could not be read. It has been retained.');
 return stored.events.map(weightEvent);
}
export function readWeightQueue(raw:string|null):WeightMutation[]{
 if(raw===null)return [];
 const stored=JSON.parse(raw);
 if(stored?.version!==1||!Array.isArray(stored.pending))throw new Error('Pending weights could not be read. They have been retained.');
 return stored.pending.map((row:unknown)=>weightMutation(row));
}
export function formatWeight(value:number,unit:WeightUnit,locale:string){return `${new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(value)} ${unit}`;}
export function localWeightDate(date=new Date()){return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
