'use client';

import BenchmarkEvidence from './BenchmarkEvidence';
import {useMemo, useState} from 'react';
import {activeMetrics, type Demographics, type Metric, type Values} from '@/lib/registry';
import {metricGroups} from '@/lib/metricGroups';
import {metricGameEstimate} from '@/lib/benchmarkGame';
import {valid} from '@/lib/engine';
import {formatRunTime} from '@/lib/run10kReference';
import {bandLabel,metricStandings} from '@/lib/metricStandings';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
import {useTranslations} from './providers/LocaleProvider';

type Results = {values: Values; details: MeasurementMetadata; demographics: Demographics};
type Actions = {onTest:(id:string)=>void; onHistory:(id:string)=>void};
const comparisonCopy = ['TOP1 challenge tier', 'Palier de défi TOP1', 'مستوى تحدي TOP1'] as const;

function useResultText(){
 const {locale,t}=useTranslations();
 return {locale,t,local:(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en};
}

function ResultValue({metric,value}:{metric:Metric;value:number}){
 const {locale,t}=useResultText();
 const timed=['run_5k','run_10k'].includes(metric.id);
 const number=timed?formatRunTime(value):new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(metric.id==='total_sleep'?value/60:value);
 return <><bdi>{number}</bdi> {t(timed?'min:sec':metric.id==='total_sleep'?'h/night':metric.unit)}</>;
}

function usePublished({values,demographics,details}:Results){
 return useMemo(()=>new Map(metricStandings(values,demographics,details).map(row=>[row.metric.id,row])),[values,demographics,details]);
}

function BenchmarkLabel({row,estimate}:{row?:ReturnType<typeof metricStandings>[number];estimate:ReturnType<typeof metricGameEstimate>}){
 const {local,t}=useResultText();
 if(row?.band&&row.source&&row.reference)return <div className="test-comparison">
  <strong><bdi>TOP {bandLabel(row.band)}</bdi>{row.band.kind==='upper'&&<small> {t('or better')}</small>}</strong>
  <small><a href={row.source} target="_blank" rel="noreferrer">{t(row.reference)}</a>{row.cohort? ` · ${t(row.cohort)}` : ''}</small>
  {row.attribution&&<small>{row.attribution}</small>}
 </div>;
 if(estimate)return <div className="test-comparison"><strong><bdi>TOP {estimate.top}</bdi></strong><small>{local(...comparisonCopy)}</small></div>;
 return <p className="test-no-comparison">{local('No matching comparison','Aucune comparaison compatible','لا توجد مقارنة مطابقة')}</p>;
}

export function TodaySnapshot({values,details,demographics,needsSetup,onTest,onHistory,onBrowse,onProfile,weightLatest,onWeight}: Results & Actions & {
 needsSetup:boolean;onBrowse:()=>void;onProfile:()=>void;weightLatest?:{kg:number;measuredAt:string};onWeight:()=>void;
}){
 const {t,locale,local}=useResultText();
 const published=usePublished({values,demographics,details});
 const recent=activeMetrics.filter(metric=>metric.pillar==='strength'&&valid(metric,values[metric.id]))
  .map(metric=>({metric,value:values[metric.id]!,date:Date.parse(details[metric.id]?.measuredAt??'')||0}))
  .sort((a,b)=>b.date-a.date)[0];
 const estimate=recent?metricGameEstimate(recent.metric.id,recent.value,demographics):null;
 const weight=weightLatest?.kg??(needsSetup?undefined:demographics.weight);
 return <>
  <article className="performance-highlight">
   <div><p className="eyebrow">{recent?local(recent.date?'LATEST DATED TEST':'RECORDED TEST','TEST ENREGISTRÉ','اختبار مسجّل'):local('YOUR FIRST TOP%','TON PREMIER TOP%','أول نتيجة TOP% لك')}</p>
    <h2>{recent?t(recent.metric.name):local('Start with one test','Commence par un test','ابدأ باختبار واحد')}</h2>
    {recent&&<><BenchmarkLabel row={published.get(recent.metric.id)} estimate={estimate}/><p><ResultValue metric={recent.metric} value={recent.value}/></p></>}
   </div>
   <div><p>{recent?local('Repeat the same test setup to see how your performance changes.','Répète le test dans les mêmes conditions pour suivre ton évolution.','كرّر الاختبار في الظروف نفسها لتتابع تغير أدائك.'):local('Record a result to see your first benchmark. Choose a test that fits your equipment.','Enregistre un résultat pour voir ton premier repère. Choisis un test adapté à ton matériel.','سجّل نتيجة لترى مستواك الأول. اختر اختبارًا يناسب المعدات المتوفرة لديك.')}</p>
    <button className="primary-button" onClick={()=>recent?onTest(recent.metric.id):onBrowse()}>{recent?local('Record another result','Enregistrer un nouveau résultat','سجّل نتيجة جديدة'):local('Choose a test','Choisir un test','اختر اختبارًا')}</button>
    {recent&&<button className="text-link shell-action" onClick={()=>onHistory(recent.metric.id)}>{local('See history','Voir l’historique','اعرض السجل')}</button>}
   </div>
  </article>
  <section className="performance-note bodyweight-card"><div>
   <h2>{t('Body weight')}</h2>
   {weight?<p><strong><bdi>{new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(weight)} kg</bdi></strong></p>:<p>{local('No body weight recorded','Aucun poids enregistré','لا يوجد وزن مسجّل')}</p>}
   {weightLatest?<small>{new Date(weightLatest.measuredAt).toLocaleString(locale)}</small>:weight!==undefined&&<small>{local('Profile context · date not recorded','Contexte du profil · date inconnue','سياق الملف · التاريخ غير مسجل')}</small>}
  </div><button className="text-link shell-action" onClick={onWeight}>{local('Track bodyweight','Suivre mon poids','تتبّع وزن الجسم')}</button></section>
 </>;
}

export default function PerformanceSnapshot({values,details,demographics,onTest,onHistory,additional=false,onImprove}:Results & Actions & {additional?:boolean;onImprove?:(id:string)=>void}){
 const {t,locale,local}=useResultText();
 const [query,setQuery]=useState('');
 const [category,setCategory]=useState('');
 const [browse,setBrowse]=useState(false);
 const published=usePublished({values,details,demographics});
 const filter=additional?activeMetrics.filter(metric=>metric.pillar!=='strength'):activeMetrics.filter(metric=>metric.pillar==='strength');
 const groups=metricGroups.map(group=>({...group,tests:filter.filter(metric=>group.metrics.includes(metric.id))})).filter(group=>group.tests.length);
 const search=query.trim().toLocaleLowerCase(locale);
 const matching=groups.filter(group=>!category||category===group.id).map(group=>({...group,tests:group.tests.filter(metric=>(additional||browse||valid(metric,values[metric.id]))&&t(metric.name).toLocaleLowerCase(locale).includes(search))})).filter(group=>group.tests.length);
 const groupLabel=(labels:readonly string[])=>labels[locale==='fr'?1:locale==='ar'?2:0];
 const update=local('Update','Actualiser','تحديث'),record=local('Record','Enregistrer','سجّل');
 return <section aria-labelledby="performance-catalog-heading" className="test-catalog">
   <h2 id="performance-catalog-heading">{additional?local('Recovery, body composition and bloodwork','Récupération, composition et analyses','التعافي وتكوين الجسم والتحاليل'):local('My results','Mes résultats','نتائجي')}</h2>
   {!additional&&<button className="primary-button" aria-expanded={browse} onClick={()=>{setBrowse(!browse);setQuery('');setCategory('');}}>{browse?local('Show my results','Voir mes résultats','عرض نتائجي'):local('Add a result','Ajouter un résultat','إضافة نتيجة')}</button>}
   {(additional||browse)&&<div className="performance-catalog-controls">
    <label>{local('Search tests','Rechercher un test','ابحث عن اختبار')}<input type="search" value={query} onChange={event=>setQuery(event.target.value)}/></label>
    <label>{local('Test collection','Collection de tests','مجموعة الاختبارات')}<select value={category} onChange={event=>setCategory(event.target.value)}>
     <option value="">{local('All tests','Tous les tests','جميع الاختبارات')}</option>
     {groups.map(group=><option key={group.id} value={group.id}>{groupLabel(group.labels)}</option>)}
    </select></label>
   </div>}
   {!matching.length&&<p role="status">{local('No results to show. Add a result to get started.','Aucun résultat à afficher. Ajoute un résultat pour commencer.','لا توجد نتائج لعرضها. أضف نتيجة للبدء.')}</p>}
   {matching.map(group=><section key={group.id} className="performance-test-group">
    <h3>{groupLabel(group.labels)}</h3>
    <div className="performance-grid">{group.tests.map(metric=>{
     const value=values[metric.id], recorded=valid(metric,value);
     const estimate=recorded&&!additional?metricGameEstimate(metric.id,value,demographics):null;
     const name=t(metric.name);
     return <article className="performance-result test-card" key={metric.id}>
      <h4>{name}</h4>
      {recorded?<><p><ResultValue metric={metric} value={value}/></p>{!additional&&<BenchmarkLabel row={published.get(metric.id)} estimate={estimate}/>}</>:<p>{local('No result yet','Aucun résultat','لا توجد نتيجة بعد')}</p>}
      {recorded&&<BenchmarkEvidence metric={metric} reason={published.get(metric.id)?.reason}/>}
      <div className="test-card-actions">
       <button className="text-link" aria-label={`${recorded?update:record} · ${name}`} onClick={()=>onTest(metric.id)}>{recorded?update:record}</button>
       {recorded&&onImprove&&!additional&&<button className="text-link" onClick={()=>onImprove(metric.id)}>{local('Improve this','Améliorer ce résultat','تحسين هذه النتيجة')}</button>}
       {recorded&&<button className="text-link" aria-label={`${local('History','Historique','السجل')} · ${name}`} onClick={()=>onHistory(metric.id)}>{local('History','Historique','السجل')}</button>}
      </div>
     </article>;
    })}</div>
   </section>)}
 </section>;
}

export function CurrentBenchmark({id,values,details,demographics}:Results & {id:string}){
 const {t,local}=useResultText();
 const published=usePublished({values,details,demographics});
 const metric=activeMetrics.find(item=>item.id===id&&item.pillar==='strength');
 if(!metric||!valid(metric,values[id]))return null;
 const estimate=metricGameEstimate(id,values[id]!,demographics);
 const row=published.get(id);
 if(!estimate&&!row?.band)return null;
 return <article className="performance-note progress-current"><div>
  <h2>{local('Current benchmark','Repère actuel','مستواك الحالي')}</h2>
  <p>{t(metric.name)} · <ResultValue metric={metric} value={values[id]!}/></p>
 </div><BenchmarkLabel row={row} estimate={estimate}/></article>;
}
