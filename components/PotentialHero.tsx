'use client';
import StandingHero from './StandingHero';
import {CategoryIcon,MetricIcon} from './MetricIcon';
import {useTranslations} from './providers/LocaleProvider';
import {benchmarkGame} from '@/lib/benchmarkGame';
import {activeMetrics,type Values,type Demographics,type PillarId} from '@/lib/registry';
import type {ReactNode} from 'react';
import type {GameRoute} from '@/lib/gameScenarios';
import type {ScenarioSelection} from '@/lib/scenarioPlan';

const categories:Record<PillarId,string>={bodymarkers:'Body markers',strength:'Strength & fitness',recovery:'Recovery'};
export default function PotentialHero({values,demographics,targetTop,targets=[],onTargetChange,onAction,actionLabel,programPreview,route,routeOptions,onRouteChange,projectedTop,reached=true,actionDisabled=false}:{values:Values;demographics:Demographics;targetTop?:number;targets?:ScenarioSelection['targets'];onTargetChange?:(tier:number)=>void;onAction:()=>void;actionLabel:string;programPreview?:ReactNode;route?:GameRoute;routeOptions?:{route:GameRoute;top:string|null}[];onRouteChange?:(route:GameRoute)=>void;projectedTop?:string|null;reached?:boolean;actionDisabled?:boolean}){
 const {t}=useTranslations(),standing=benchmarkGame(values,demographics),current=standing.total;
 const display=(id:string,n:number)=>Number((id==='total_sleep'?n/60:n).toFixed(2));
 const unit=(id:string)=>t(id==='total_sleep'?'h/night':activeMetrics.find(m=>m.id===id)?.unit??'');
 return <div className="dashboard-summary stitch-dashboard potential-dashboard">
  <StandingHero potential onChooseTier={onTargetChange} actionDisabled={actionDisabled} top={current} empty={!current} selectedTier={targetTop} onAction={onAction} actionLabel={actionLabel}/>
  <div className="dashboard-right"><section className="recorded-data-card stitch-recorded potential-data-card">
   <div className="card-heading"><h2>{t(programPreview?'Your program':'Your target')}</h2><strong className="potential-target-top">{t('Top')} <bdi>{targetTop!==undefined?`${targetTop}%`:'?'}</bdi></strong></div>
   {routeOptions&&onRouteChange&&<div className="potential-route-choices" role="group" aria-label={t('Choose your route')}>{routeOptions.map(option=><button key={option.route} aria-pressed={route===option.route} onClick={()=>onRouteChange(option.route)}><span>{t(option.route==='easier'?'FOCUSED':option.route==='balanced'?'BALANCED':'HIGHER EFFORT')}</span><strong>{t('Top')} <bdi>{option.top??'?'}</bdi></strong></button>)}</div>}
   {!reached&&projectedTop&&<p className="potential-stage-note">{t('This stage')} · {t('Top')} <bdi>{projectedTop}</bdi> · {t('Closest available route within the change limits')}</p>}
   {targets.length>0&&<div className="potential-target-changes">{targets.map(g=><div key={g.id}><span className="metric-title"><MetricIcon id={g.id}/>{t(g.name)}</span><strong><bdi>{display(g.id,values[g.id]??g.current)} → {display(g.id,g.target)}</bdi><small>{unit(g.id)}</small></strong></div>)}</div>}
   {!current&&<p className="recorded-caption">{t('Record one result first. Then choose your target and build your plan.')}</p>}
   {current&&targets.length===0&&<p className="recorded-caption">{t('Record a physical performance test or a sleep habit measurement to build a program. Other measurements still contribute to your game standing.')}</p>}
   {programPreview}
   <details className="potential-recorded-details"><summary>{t('YOUR METRICS')} <bdi>{standing.rows.length}/{activeMetrics.length}</bdi></summary><div className="section-standings">{(Object.keys(categories) as PillarId[]).map(id=>{const rows=standing.rows.filter(r=>r.pillar===id);return <details className={`section-standing category-block ${id}`} key={id}><summary><span><CategoryIcon id={id}/>{t(categories[id])}<small>{rows.length} {t('recorded')}</small></span><strong>{t('Top')} <bdi>{standing.sections[id]??'?'}</bdi></strong></summary>{rows.map(row=>{const m=activeMetrics.find(m=>m.id===row.id)!;return <div className="potential-recorded-row" key={row.id}><span className="metric-title"><MetricIcon id={row.id}/>{t(m.name)}</span><span><bdi>{display(row.id,values[row.id]!)}</bdi> {unit(row.id)}<strong>{t('Top')} <bdi>{row.top}</bdi></strong></span></div>;})}</details>;})}</div></details>
  </section></div>
 </div>;
}
