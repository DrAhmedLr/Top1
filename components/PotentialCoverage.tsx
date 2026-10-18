'use client';
import {useState} from 'react';
import {ArrowUpRight,Check} from 'lucide-react';
import {CategoryIcon,MetricIcon} from './MetricIcon';
import {useTranslations} from './providers/LocaleProvider';
import {activeMetrics,type Values,type Demographics,type PillarId} from '@/lib/registry';
import {benchmarkGame} from '@/lib/benchmarkGame';
const categories:Record<PillarId,string>={bodymarkers:'Body markers',strength:'Strength & fitness',recovery:'Recovery'};
const priority=['total_sleep','rhr','waist_height_ratio','pushups','single_leg_balance','sit_to_stand'];
export default function PotentialCoverage({values,demographics,onRecord}:{values:Values;demographics:Demographics;onRecord:(id:string)=>void}){
 const {t}=useTranslations(),[category,setCategory]=useState<PillarId|null>(null),standing=benchmarkGame(values,demographics);
 const recorded=new Set(standing.rows.map(m=>m.id)),count=recorded.size,complete=count===activeMetrics.length;
 const missing=activeMetrics.filter(m=>!recorded.has(m.id));
 // Favor an unrepresented category, then approachable home observations.
 const suggested=missing.filter(m=>!category||m.pillar===category).sort((a,b)=>{
  const score=(m:typeof a)=>(standing.sections[m.pillar]?100:0)+(priority.includes(m.id)?priority.indexOf(m.id):20+activeMetrics.indexOf(m));
  return score(a)-score(b);
 }).slice(0,3);
 return <section className="card potential-coverage" aria-labelledby="potential-coverage-title">
  <div className="coverage-heading"><div><h2 id="potential-coverage-title">{t(complete?'Your full picture':'Build your full picture')}</h2><p>{t(complete?'All current metrics are recorded. Keep them up to date.':'Add measurements for a more complete picture. Your score may move up or down.')}</p></div><strong aria-live="polite"><bdi>{count}/{activeMetrics.length}</bdi><small>{t('metrics recorded')}</small></strong></div>
  <div className="coverage-categories" role="group" aria-label={t('Choose an area to complete')}>{(Object.keys(categories) as PillarId[]).map(id=>{const total=activeMetrics.filter(m=>m.pillar===id).length,n=standing.rows.filter(m=>m.pillar===id).length;return <button type="button" key={id} className={`coverage-category ${id}`} aria-pressed={category===id} onClick={()=>setCategory(category===id?null:id)}><span><CategoryIcon id={id}/>{t(categories[id])}<bdi>{n}/{total}</bdi>{n===total&&<Check size={14} aria-hidden="true"/>}</span><progress max={total} value={n} aria-label={t(categories[id])}/></button>;})}</div>
  {!complete&&<div className="coverage-suggestions">{suggested.map(m=><button type="button" key={m.id} className={m.pillar} data-suggested-metric={m.id} onClick={()=>onRecord(m.id)}><MetricIcon id={m.id}/><span><strong>{t(m.name)}</strong><small>{t('Add a measurement')}</small></span><ArrowUpRight size={17} aria-hidden="true"/></button>)}{suggested.length===0&&<p>{t('This area is complete. Choose another area to add a measurement.')}</p>}</div>}
 </section>;
}
