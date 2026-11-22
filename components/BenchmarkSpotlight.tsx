'use client';
import {useId} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {activeMetrics,type Values,type Demographics} from '@/lib/registry';
import {valid} from '@/lib/engine';
import {metricGameEstimate} from '@/lib/benchmarkGame';
import {objectiveFor} from '@/lib/potentialGoals';
import {TOP_BAND_EDGES} from '@/lib/topBands';
import {formatRunTime} from '@/lib/run10kReference';
import {useTranslations} from './providers/LocaleProvider';

export default function BenchmarkSpotlight({metricId,values,demographics,onSelect,onEdit}:{metricId:string;values:Values;demographics:Demographics;onSelect:(id:string)=>void;onEdit:()=>void}){
 const {t}=useTranslations(),id=useId(),metric=activeMetrics.find(m=>m.id===metricId)??activeMetrics[0],value=values[metric.id];
 const measured=valid(metric,value),estimate=measured?metricGameEstimate(metric.id,value,demographics):null;
 const tier=estimate?.top,next=tier?([...TOP_BAND_EDGES].reverse().find(n=>tier==='65%+'||n<Number.parseFloat(tier))??1):1;
 const goal=objectiveFor(metric.id,values,demographics,next),target=goal?.target;
 const format=(n:number)=>['run_5k','run_10k'].includes(metric.id)?formatRunTime(n):String(Number((n/(metric.id==='total_sleep'?60:1)).toFixed(2)));
 const unit=t(metric.id==='total_sleep'?'h/night':['run_5k','run_10k'].includes(metric.id)?'min:sec':metric.unit);
 const progress=measured&&target!==undefined?Math.max(0,Math.min(100,Math.round((metric.polarity===-1?(value===0?1:target/value):(target===0?1:value/target))*100))):null;
 return <section className="benchmark-spotlight" aria-labelledby={`${id}-heading`}>
  <div className="spotlight-picker"><label htmlFor={`${id}-test`}>{t('Choose a test')}</label><select id={`${id}-test`} value={metric.id} onChange={e=>onSelect(e.target.value)}>{activeMetrics.map(m=><option key={m.id} value={m.id}>{t(m.name)}</option>)}</select></div>
  <div className="spotlight-heading"><h2 id={`${id}-heading`}>{t(metric.name)}</h2>{tier&&<span>{t('Top')} <bdi>{tier}</bdi></span>}</div>
  <div className="spotlight-value"><bdi>{measured?format(value):'—'}</bdi><span>{unit}</span></div>
  {measured&&target!==undefined?<div className="spotlight-target"><div><span>{t('Next target')}</span><strong><bdi>{format(target)}</bdi> <small>{unit}</small></strong></div>{progress!==null&&<><label htmlFor={`${id}-progress`}>{t('Toward this target')}</label><progress id={`${id}-progress`} max={100} value={progress}>{progress}%</progress></>}</div>:<p className="spotlight-empty">{t('Record baseline')}</p>}
  <button type="button" className="primary-button" onClick={onEdit}>{t(measured?'Update result':'Record baseline')}<ArrowUpRight size={18}/></button>
 </section>;
}
