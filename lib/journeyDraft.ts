import {normalizeMeasurementMetadata,type MeasurementMetadata} from './measurementMetadata';
import {normalizeValues} from './profile';
import {activeMetrics,type Demographics,type Values} from './registry';
import {baselineAreas,baselineTests,type BaselineArea} from './balancedBaseline';
import type {ProfileDraft} from './onboarding';

export type BaselinePlan=Partial<Record<BaselineArea,string>>;
export type JourneyDraft={
 version:2;updatedAt:number;baseline:string;metric:string;collection:number;guided:boolean;
 screen:'choose'|'basics'|'profile'|'record';profile:ProfileDraft;values:Values;details:MeasurementMetadata;
 plan:BaselinePlan;skipped:BaselineArea[];mode?:'existing'|'today';confirmed?:boolean;useForBaseline?:boolean;
 rawInput?:string;testWeight?:string;liftInputs?:{load:string;reps:string};
};
export const journeyDraftKey=(owner:string)=>`top1-session-draft:${owner}`;
function sorted(value:unknown):unknown{
 if(Array.isArray(value))return value.map(sorted);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,sorted(v)]));
 return value;
}
function canonical(raw:string){try{return JSON.stringify(sorted(JSON.parse(raw)));}catch{return raw;}}
export function journeyBaseline(profile:Demographics|undefined,values:Values,details:MeasurementMetadata){
 return JSON.stringify(sorted({profile,values,details}));
}
export function readJourneyDraft(raw:string|null,baseline:string,now=Date.now()):JourneyDraft|null{
 try{
  const d=JSON.parse(raw??'null');
  if(![1,2].includes(d?.version)||typeof d.baseline!=='string'||canonical(d.baseline)!==canonical(baseline)||!Number.isFinite(d.updatedAt)||d.updatedAt>now||now-d.updatedAt>7*86400000)return null;
  if(!['choose','basics','profile','record'].includes(d.screen)||!(activeMetrics.some(m=>m.id===d.metric)||(d.metric==='basics'&&d.screen==='basics'))||!Number.isInteger(d.collection)||d.collection<0||d.collection>2||typeof d.guided!=='boolean')return null;
  if(!d.profile||!['age','sex','height','weight'].every(k=>typeof d.profile[k]==='string'&&d.profile[k].length<100))return null;
  const plan:BaselinePlan={};
  for(const area of baselineAreas){const id=d.plan?.[area];if(id!==undefined){if(!(baselineTests[area] as readonly string[]).includes(id))return null;plan[area]=id;}}
  const skipped=d.skipped??[];
  if(!Array.isArray(skipped)||skipped.some(area=>!baselineAreas.includes(area))||skipped.some(area=>plan[area as BaselineArea]))return null;
  if(d.mode!==undefined&&!['existing','today'].includes(d.mode))return null;
  if(d.rawInput!==undefined&&(typeof d.rawInput!=='string'||d.rawInput.length>100))return null;
  if(d.testWeight!==undefined&&(typeof d.testWeight!=='string'||d.testWeight.length>100))return null;
  if(d.liftInputs!==undefined&&(!d.liftInputs||!['load','reps'].every(k=>typeof d.liftInputs[k]==='string'&&d.liftInputs[k].length<100)))return null;
  return {version:2,updatedAt:d.updatedAt,baseline,metric:d.metric,collection:d.collection,guided:d.guided,screen:d.screen,profile:d.profile,values:normalizeValues(d.values),details:normalizeMeasurementMetadata(d.details??{}),plan,skipped:[...new Set(skipped)] as BaselineArea[],mode:d.mode,confirmed:d.confirmed===true,useForBaseline:d.useForBaseline!==false,rawInput:d.rawInput,testWeight:d.testWeight,liftInputs:d.liftInputs};
 }catch{return null;}
}

/** Invalid, unfinished input stays in rawInput, never in the saved measurements. */
export function draftValues(values:Values):Values{return Object.fromEntries(Object.entries(values).filter(([,value])=>value!==undefined&&Number.isFinite(value)));}
