'use client';
import StandingHero from './StandingHero';
import {CategoryIcon,MetricIcon} from './MetricIcon';
import {useTranslations} from './providers/LocaleProvider';
import {benchmarkGame} from '@/lib/benchmarkGame';
import {activeMetrics,type Values,type Demographics,type PillarId} from '@/lib/registry';
import {TOP_BAND_EDGES} from '@/lib/topBands';
import type {ScenarioSelection} from '@/lib/scenarioPlan';

const categories:Record<PillarId,string>={bodymarkers:'Body markers',strength:'Strength & fitness',recovery:'Recovery'};
export default function PotentialHero({values,demographics,targetTop,targets=[],onTargetChange,onAction,actionLabel,onOtherTargets}:{values:Values;demographics:Demographics;targetTop?:number;targets?:ScenarioSelection['targets'];onTargetChange?:(tier:number)=>void;onAction:()=>void;actionLabel:string;onOtherTargets?:()=>void}){
 const {t}=useTranslations(),standing=benchmarkGame(values,demographics),current=standing.total;
 const display=(id:string,n:number)=>Number((id==='total_sleep'?n/60:n).toFixed(2));
 const unit=(id:string)=>t(id==='total_sleep'?'h/night':activeMetrics.find(m=>m.id===id)?.unit??'');
 return <div className="dashboard-summary stitch-dashboard potential-dashboard">
  <StandingHero top={current} empty={!current} selectedTier={targetTop} onAction={onAction} actionLabel={actionLabel}/>
  <div className="dashboard-right"><section className="recorded-data-card stitch-recorded potential-data-card">
   <div className="card-heading"><h2>{t('Your target')}</h2><strong className="potential-target-top">{t('Top')} <bdi>{targetTop!==undefined?`${targetTop}%`:'?'}</bdi></strong></div>
   {onTargetChange&&current&&<div className="pyramid-targets potential-target-choices" role="group" aria-label={t('Choose your target tier')}>{TOP_BAND_EDGES.map(n=><button key={n} aria-pressed={targetTop===n} disabled={current!=='65%+'&&n>=Number.parseFloat(current)} onClick={()=>onTargetChange(n)}>{t('Top')} <bdi>{n}%</bdi></button>)}</div>}
   {targets.length>0&&<div className="potential-target-changes">{targets.map(g=><div key={g.id}><span className="metric-title"><MetricIcon id={g.id}/>{t(g.name)}</span><strong><bdi>{display(g.id,values[g.id]??g.current)} → {display(g.id,g.target)}</bdi><small>{unit(g.id)}</small></strong></div>)}</div>}
   {!current&&<p className="recorded-caption">{t('Record one result first. Then choose your target and build your plan.')}</p>}
   <div className="section-standings">{(Object.keys(categories) as PillarId[]).map(id=>{const rows=standing.rows.filter(r=>r.pillar===id);return <details className={`section-standing category-block ${id}`} key={id}><summary><span><CategoryIcon id={id}/>{t(categories[id])}<small>{rows.length} {t('recorded')}</small></span><strong>{t('Top')} <bdi>{standing.sections[id]??'?'}</bdi></strong></summary>{rows.map(row=>{const m=activeMetrics.find(m=>m.id===row.id)!;return <div className="potential-recorded-row" key={row.id}><span className="metric-title"><MetricIcon id={row.id}/>{t(m.name)}</span><span><bdi>{display(row.id,values[row.id]!)}</bdi> {unit(row.id)}<strong>{t('Top')} <bdi>{row.top}</bdi></strong></span></div>;})}</details>;})}</div>
   {onOtherTargets&&<button className="text-link potential-other-targets" onClick={onOtherTargets}>{t('Explore other targets')}</button>}
  </section></div>
 </div>;
}
