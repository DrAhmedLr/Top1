import {activeMetrics,type Values} from './registry';
import {valid} from './engine';
export const adaptiveCandidates=['total_sleep','single_leg_balance','sit_to_stand','pushups'] as const;
export type JourneySignals=Partial<Record<typeof adaptiveCandidates[number],number>>;
export const adaptiveKey=(owner:string)=>`top1-adaptive-v1:${owner}`;
export function parseSignals(raw:string|null):JourneySignals{try{const p=JSON.parse(raw??'{}');return Object.fromEntries(adaptiveCandidates.filter(id=>Number.isFinite(p?.[id])&&p[id]>=0).map(id=>[id,Math.min(20,Math.floor(p[id]))]));}catch{return {};}}
/** Explainable local ordering: easy first, completed tasks removed, repeated skips lower priority. */
export function recommendNext(values:Values,signals:JourneySignals){return adaptiveCandidates.filter(id=>!valid(activeMetrics.find(m=>m.id===id)!,values[id])).map((id,index)=>({id,cost:adaptiveCandidates.indexOf(id)+(signals[id]??0)*3,index})).sort((a,b)=>a.cost-b.cost||a.index-b.index)[0]?.id;}
