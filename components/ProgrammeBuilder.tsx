'use client';
import {useMemo,useState,type FormEvent} from 'react';
import {Check,Plus,Target} from 'lucide-react';
import {type AdaptiveConfig} from '@/lib/adaptiveProgram';
import {parseMeasurementInput} from '@/lib/measurementInput';
import {formatRunTime,parseRunTime} from '@/lib/run10kReference';
import {relatedProgramGoals,planGoalPortfolio,addPortfolioGoals,rankGoalCollections} from '@/lib/programPortfolio';
import type {ProgramOpportunity} from '@/lib/programOpportunities';
import type {PersonalWorkspace} from '@/lib/personalWorkspace';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
import type {Observation} from '@/lib/history';
import {goalMetrics} from '@/lib/adaptiveProgram';
import {recordJourneyAction} from '@/lib/analytics';
import {MetricIcon} from './MetricIcon';
import {useProgramCopy} from './programCopy';
import ProgrammeCalendar from './ProgrammeCalendar';
import ProgrammeDates from './ProgrammeDates';
import {previewDatedProgram} from '@/lib/datedProgram';
import s from './AdaptiveProgram.module.css';

type Props={rows:ProgramOpportunity[];workspace:PersonalWorkspace;details:MeasurementMetadata;observations:Observation[];today:string;zone:string;
  initialMetric?:string;initialTarget?:number;existing?:AdaptiveConfig[];manualWeekdays?:Record<string,number[]>;lockedMetrics?:ReadonlySet<string>;busy:boolean;save:(configs:AdaptiveConfig[],revised?:AdaptiveConfig[])=>Promise<boolean>;onCancel?:()=>void;onBrowse:()=>void;};
function rawTarget(id:string,n:number){return id==='run_5k'?formatRunTime(n,true):String(n);}
function parseTarget(id:string,value:string){const parsed=parseMeasurementInput(id==='run_5k'?parseRunTime(value):value);return value.trim()&&parsed!==''?Number(Number(parsed).toFixed(3)):NaN;}
export default function ProgrammeBuilder({rows,workspace,details,observations,today,zone,initialMetric,initialTarget,busy,save,onCancel,onBrowse,existing,lockedMetrics,manualWeekdays}:Props) {
 const {l,t,locale,index,measure,number}=useProgramCopy();
 const [ids,setIds]=useState<string[]>(()=>initialMetric&&rows.some(row=>row.metric===initialMetric)?[initialMetric]:[]);
 const [targets,setTargets]=useState<Record<string,string>>(()=>initialMetric&&initialTarget!==undefined?{[initialMetric]:rawTarget(initialMetric,initialTarget)}:{});
 const [dates,setDates]=useState<Record<string,string>>({});
 const [error,setError]=useState(false);
 const selected=useMemo(()=>ids.flatMap(id=>rows.filter(row=>row.metric===id)),[ids,rows]);
 const bundles=useMemo(()=>rankGoalCollections({choices:rows,context:workspace.context,currentMetrics:existing?.map(c=>c.metric)}),[rows,workspace.context,existing]);
 const [showAll,setShowAll]=useState(!!initialMetric);
 const related=useMemo(()=>relatedProgramGoals(ids[0],rows),[ids,rows]);
 function toggle(id:string){
   setError(false);setDates({}); if(!ids.includes(id))recordJourneyAction('goal_selected',id);
   setIds(prev=>prev.includes(id)?prev.filter(value=>value!==id):[...prev,id]);
 }
 const calculation=useMemo(()=>{
   try{
     const goals=selected.map(row=>({metric:row.metric,unit:row.unit,current:row.current,target:parseTarget(row.metric,targets[row.metric]??rawTarget(row.metric,row.nextTarget)),
       deadline:dates[row.metric]||undefined,bodyWeightKg:details[row.metric]?.derivation?.bodyWeightKg??details[row.metric]?.protocol?.bodyWeightKg}));
     const input={goals,startDay:today,timeZone:zone,context:workspace.context,locale,details,observations,manualWeekdays};
     const active=(existing??[]).filter(config=>!lockedMetrics?.has(config.metric)&&config.deadline>today);
     const data=active.length?addPortfolioGoals(active,input,lockedMetrics):{...planGoalPortfolio(input),revised:[]};
     return {data,error:''};
   }catch(reason){return {data:null,error:reason instanceof Error?reason.message:'goal'};}
 },[selected,targets,dates,today,zone,workspace.context,locale,details,observations,existing,lockedMetrics,manualWeekdays]);
 const proposal=calculation.data;
 const canStart=!!proposal?.items.length&&proposal.items.every(item=>!item.dateConflict&&item.dateOptions.some(option=>option.date===item.config.deadline));
 const calendar=useMemo(()=>{
   if(!proposal?.items.length)return [];
   const shown=[...proposal.revised.filter(c=>c.guidedVersion===1),...proposal.items.map(i=>i.config)];
   return shown.map(config=>({id:config.metric,config,schedule:previewDatedProgram(config,zone)}));
 },[proposal,zone]);
 const choices=useMemo(()=>{
   const relatedIds=new Set(related.map(row=>row.opportunity.metric));
   return [...rows].sort((a,b)=>Number(relatedIds.has(b.metric))-Number(relatedIds.has(a.metric)));
 },[rows,related]);
 async function submit(e:FormEvent){
   e.preventDefault(); if(busy||!canStart||!proposal)return;
   try{setError(!await save(proposal.items.map(item=>item.config),proposal.revised));}catch{setError(true);}
 }
 if(!rows.length)return <section className={s.card}><h2>{l('Build your programme','Créer ton programme','أنشئ برنامجك')}</h2><p>{existing?.length?l('Your programme already includes all eligible measured goals. You can record another test to add a goal.','Ton programme contient déjà tous tes objectifs mesurés disponibles. Enregistre un autre test pour ajouter un objectif.','يشمل برنامجك جميع الأهداف المقاسة المتاحة. يمكنك تسجيل اختبار آخر لإضافة هدف.'):l('Record a performance test to see your training options.','Enregistre un test de performance pour voir les options d’entraînement.','سجّل اختبار أداء لعرض خيارات التدريب.')}</p>
   <button className={s.primary} type="button" onClick={onBrowse}>{l('Choose a test','Choisir un test','اختر اختبارًا')}</button>{onCancel&&<button type="button" className={s.link} onClick={onCancel}>{t('Back')}</button>}</section>;
 return <form className={s.planner} onSubmit={submit}>
   <fieldset className={s.card} disabled={busy}><legend className={s.legend}>{l('Choose your goals','Choisis tes objectifs','اختر أهدافك')}</legend>
     <p>{l('Select the performances you want to train together.','Sélectionne les performances à entraîner ensemble.','اختر القدرات التي تريد تدريبها معًا.')}</p>
     {bundles.length>0&&<div className={s.bundleChoices}>{bundles.map(bundle=>{
       const selected=bundle.goals.every(goal=>ids.includes(goal.metric));
       return <button type="button" key={bundle.id} aria-pressed={selected} onClick={()=>{
         const keys=bundle.goals.map(goal=>goal.metric);setDates({});setError(false);
         for(const id of keys)if(!selected&&!ids.includes(id))recordJourneyAction('goal_selected',id);
         setIds(prev=>selected?prev.filter(id=>!keys.includes(id)):[...new Set([...prev,...keys])]);setShowAll(true);
       }}><Target size={19}/><span><strong>{bundle.title[index]}</strong><small>{bundle.goals.map(row=>t(goalMetrics.find(m=>m.id===row.metric)!.name)).join(' · ')}</small></span>{selected?<Check size={16}/>:<Plus size={16}/>}</button>;
     })}</div>}
     {bundles.length>0&&<button className={s.link} type="button" aria-expanded={showAll} onClick={()=>setShowAll(v=>!v)}>{showAll?l('Hide individual goals','Masquer les objectifs individuels','إخفاء الأهداف الفردية'):l('Choose individual goals','Choisir des objectifs individuels','اختيار أهداف فردية')}</button>}
     {(showAll||!bundles.length)&&<div className={s.goalChoices}>{choices.map(row=>{
       const metric=goalMetrics.find(item=>item.id===row.metric)!;
       const match=related.find(item=>item.opportunity.metric===row.metric);
       return <button key={row.metric} type="button" data-metric={row.metric} aria-pressed={ids.includes(row.metric)} onClick={()=>toggle(row.metric)}>
         <MetricIcon id={row.metric} size={20}/><span><strong>{t(metric.name)}</strong><small><bdi>{measure(row.metric,row.current)} {t(row.unit==='kg'?'kg':metric.unit)}</bdi>
         {match&&<> · {match.basis==='study'?l('Studied together','Étudiés ensemble','دُرسا معًا'):l('Related movement','Mouvement associé','حركة ذات صلة')}</>}</small></span>
         {ids.includes(row.metric)?<Check size={17}/>:<Plus size={17}/>}</button>;
     })}</div>}
     {related.some(item=>item.source)&&<details className={s.explainer}><summary>{l('Related training research','Études sur les mouvements associés','أبحاث التدريب المرتبط')}</summary>{related.filter(item=>item.source).map(item=><p key={item.opportunity.metric}><a href={item.source} target="_blank" rel="noreferrer">{t(goalMetrics.find(m=>m.id===item.opportunity.metric)!.name)} · {l('Read the study','Lire l’étude','قراءة الدراسة')}</a></p>)}</details>}
   </fieldset>
   {calculation.error==='budget'&&<p role="status">{l('Your existing routine uses the available visits or training time. Update your training availability in Profile or free a session before adding this goal.','Ta routine utilise les séances ou le temps disponibles. Ajuste tes disponibilités dans Profil ou libère une séance avant d’ajouter cet objectif.','يستخدم روتينك الحالي الزيارات أو الوقت المتاح. عدّل تفضيلات التدريب في الملف أو أتح حصة قبل إضافة هذا الهدف.')}</p>}
   {selected.length>0&&<section className={s.card}><div className={s.heading}><Target size={20}/><h2>{l('Targets and dates','Cibles et dates','الأهداف والمواعيد')}</h2></div>
     {selected.map(row=>{
       const metric=goalMetrics.find(item=>item.id===row.metric)!,item=proposal?.items.find(item=>item.config.metric===row.metric);
       const unit=t(row.unit==='kg'?'kg':metric.unit); const ready=!!item;
       return <fieldset key={row.metric} className={s.targetRow} disabled={busy}><legend>{t(metric.name)}</legend>
         <div className={s.targetSummary}><span>{l('Starting result','Point de départ','نتيجة البداية')} · <bdi>{measure(row.metric,row.current)} {unit}</bdi></span>
</div>
         <label>{l('Target','Cible','الهدف')} · {row.metric==='run_5k'?'min:sec':unit}<input name={'target-'+row.metric} value={targets[row.metric]??rawTarget(row.metric,row.nextTarget)} inputMode={row.metric==='run_5k'?'text':'decimal'} required maxLength={18} onChange={e=>{
           setTargets(p=>({...p,[row.metric]:e.target.value}));setDates(p=>{const next={...p};delete next[row.metric];return next;});
         }}/></label>
         {item&&<ProgrammeDates name={'deadline-'+row.metric} value={item.config.deadline} options={item.dateOptions} onChange={value=>setDates(Object.fromEntries(proposal!.items.map(other=>[other.config.metric,other.config.metric===row.metric?value:other.config.deadline])))}/>}
         {item?.dateBasis==='measured-pace'&&<small>{l('Dates account for your measured pace of improvement.','Les dates tiennent compte de ta progression mesurée.','تراعي المواعيد وتيرة تحسّنك المقاسة.')}</small>}
         {item&&!item.withinHorizon&&<small>{l('This target exceeds the starting model’s planning window.','Cette cible dépasse l’horizon du modèle initial.','يتجاوز هذا الهدف أفق النموذج الأولي.')}</small>}
         {item&&proposal&&item.retestMinutes>proposal.minutesPerVisit&&<small>{l('Allow extra time for this test','Prévois plus de temps pour ce test','خصّص وقتًا إضافيًا لهذا الاختبار')} · {number(item.retestMinutes)} {t('min')}.</small>}
         {item?.dateConflict&&<small role="alert">{l('Choose separate test dates with a recovery day between them.','Choisis des dates de test distinctes, avec un jour de récupération entre elles.','اختر مواعيد اختبار منفصلة واترك يومًا للتعافي بينها.')}</small>}
         {!ready&&calculation.error!=='budget'&&<small>{l('Check the selected targets and dates.','Vérifie les cibles et les dates sélectionnées.','تحقق من الأهداف والتواريخ المحددة.')}</small>}
       </fieldset>;})}
     {proposal&&<p>{number(proposal.daysPerWeek)} {l('visits per week','séances par semaine','زيارات أسبوعيًا')} · {number(proposal.minutesPerVisit)} {l('min available per visit','min disponibles par séance','دقيقة متاحة لكل زيارة')}.</p>}
   </section>}
   {proposal&&proposal.items.some(item=>(item.config.rotation?.weeks??1)>1)&&<p>{l('Exercises rotate across weeks to fit your available time.','Les exercices alternent selon les semaines pour respecter ton temps disponible.','تتناوب التمارين بين الأسابيع لتناسب وقتك المتاح.')}</p>}
   {calendar.length>0&&<ProgrammeCalendar items={calendar} today={today}/>}
   {error&&<p role="alert">{l('Could not save your programme. Check sync and retry.','Impossible d’enregistrer ton programme. Vérifie la synchronisation et réessaie.','تعذّر حفظ البرنامج. تحقق من المزامنة وأعد المحاولة.')}</p>}
   <div className={s.actions}>{selected.length>0&&<button className={s.primary} disabled={busy||!canStart} type="submit">{existing?.length?l('Add to my programme','Ajouter à mon programme','أضف إلى برنامجي'):l('Start programme','Démarrer le programme','ابدأ البرنامج')}<Check size={16}/></button>}{onCancel&&<button type="button" className={s.secondary} onClick={onCancel}>{t('Cancel')}</button>}</div>
 </form>;
}
