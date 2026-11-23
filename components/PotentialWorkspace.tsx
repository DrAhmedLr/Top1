'use client';
import {useState,type FormEvent} from 'react';
import {useWorkspaceEditor} from '@/lib/hooks/useWorkspaceEditor';
import {activeMetrics,type Values} from '@/lib/registry';
import {captureEvent} from '@/lib/analytics';
import {valid} from '@/lib/engine';
import {formatRunTime} from '@/lib/run10kReference';
import {useTranslations} from './providers/LocaleProvider';

import type {WorkspaceState} from '@/lib/hooks/usePersonalWorkspace';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
import WorkspaceStatus from './WorkspaceStatus';
import {createPersonalGoal,type PersonalGoal as Goal} from '@/lib/personalGoal';
export default function PotentialWorkspace({state,selectedMetric,values,details,onRecord}:{state:WorkspaceState;selectedMetric?:string;values:Values;details:MeasurementMetadata;onRecord:(id:string)=>void}){
 const {locale,t}=useTranslations(),local=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const choices=activeMetrics.filter(m=>m.pillar==='strength');
 const [error,setError]=useState('');
 const goal=state.data.goal,ready=state.ready;
 const display=(n:number,id:string)=>['run_5k','run_10k'].includes(id)?formatRunTime(n):String(n);
 const editor=useWorkspaceEditor(state,'goal',{metricId:goal?.metric??selectedMetric??choices.find(m=>valid(m,values[m.id]))?.id??'pushups',target:goal?display(goal.target,goal.metric):'',date:goal?.date??''});
 const {metricId,target,date}=editor.values,blocked=!state.editable||!editor.loaded;
 const metric=choices.find(m=>m.id===metricId)??choices[0],timed=['run_5k','run_10k'].includes(metric.id);
 const current=values[metric.id],hasBaseline=valid(metric,current);
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!ready||blocked)return;
  const data=new FormData(event.currentTarget);let next:Goal;
  try{next=createPersonalGoal(metric.id,String(data.get('target')??''),String(data.get('date')??''),values);}catch{setError(local('Choose an improving target within the test range and a future date.','Choisis une cible de progression valide et une date future.','اختر هدفًا صالحًا للتحسن وتاريخًا مستقبليًا.'));return;}
  next={...next,baselineDetails:details[metric.id],context:editor.data.context};
  if(await state.save({...editor.data,goal:next},editor.revision,'goal')){captureEvent('goal_saved');setError('');}
 }
 return <div className="potential-workspace">
  <section className="performance-note"><h2>{local('What do you want to improve?','Que veux-tu améliorer ?','ما الذي تريد تحسينه؟')}</h2><p>{local('Choose a result, set your target, then track it with the same test.','Choisis un résultat, fixe ta cible et suis-la avec le même test.','اختر نتيجة وحدد هدفك وتابعه بالاختبار نفسه.')}</p>
   <form onSubmit={save}><fieldset disabled={!ready||blocked} className="potential-fields"><label>{local('My focus','Mon objectif','هدفي')}<select value={metric.id} onChange={e=>{editor.update({...editor.values,metricId:e.target.value,target:''});}}>{choices.map(m=><option key={m.id} value={m.id}>{t(m.name)}</option>)}</select></label>
   {hasBaseline?<><p>{local('Current result','Résultat actuel','النتيجة الحالية')}: <strong><bdi>{display(current!,metric.id)} {timed?'min:sec':metric.unit}</bdi></strong></p><label>{local('Target','Cible','الهدف')} ({timed?'min:sec':metric.unit})<input name="target" value={target} inputMode={timed?'text':'decimal'} placeholder={timed?'mm:ss':undefined} onChange={e=>{editor.update({...editor.values,target:e.target.value});}}/></label><label>{local('Target date','Date cible','تاريخ الهدف')}<input name="date" type="date" value={date} onChange={e=>{editor.update({...editor.values,date:e.target.value});}}/></label><button className="primary-button" type="submit">{local('Save my goal','Enregistrer mon objectif','حفظ هدفي')}</button></>:<><p>{local('Record a starting result before setting this goal.','Enregistre un résultat de départ avant de fixer cet objectif.','سجّل نتيجة أولية قبل تحديد هذا الهدف.')}</p><button className="primary-button" type="button" onClick={()=>onRecord(metric.id)}>{local('Record baseline','Enregistrer mon point de départ','تسجيل نتيجة أولية')}</button></>}
   </fieldset></form>{error&&<p role="alert">{error}</p>}{editor.error&&<p role="alert">{editor.error}</p>}{editor.dirty&&<button className="text-link" onClick={editor.clear}>{local('Discard form changes','Annuler les modifications','إلغاء تغييرات النموذج')}</button>}
  </section>
  {goal&&<section className="performance-note"><h2>{local('My saved goal','Mon objectif enregistré','هدفي المحفوظ')}</h2><p>{t(activeMetrics.find(m=>m.id===goal.metric)!.name)} · <bdi>{display(goal.target,goal.metric)} {['run_5k','run_10k'].includes(goal.metric)?'min:sec':activeMetrics.find(m=>m.id===goal.metric)!.unit}</bdi> · <time dateTime={goal.date}>{goal.date}</time></p><p>{local('Your chosen target, not a predicted result.','Ta cible choisie, pas une prédiction.','هدف تختاره وليس نتيجة متوقعة.')}</p>{goal.baseline!==undefined&&<p>{local('Starting result','Résultat de départ','نتيجة البداية')}: {display(goal.baseline,goal.metric)} · {new Date(goal.createdAt).toLocaleDateString(locale,{timeZone:state.data.context.timezone})}</p>}<div className="potential-actions"><button className="primary-button" onClick={()=>onRecord(goal.metric)}>{local('Record a new result','Enregistrer un nouveau résultat','تسجيل نتيجة جديدة')}</button><button className="text-link" onClick={state.exportData}>{local('Export goal','Exporter l’objectif','تصدير الهدف')}</button><button className="text-link" disabled={!state.editable} onClick={()=>void state.save({...state.data,goal:null},state.revision,'goal')}>{local('Remove goal','Retirer l’objectif','إزالة الهدف')}</button></div></section>}
  <WorkspaceStatus state={state}/>
  <section className="performance-note"><h2>{local('Success estimate unavailable','Estimation de réussite indisponible','تقدير النجاح غير متاح')}</h2><p>{local('Personalized programs and event-based adjustments are the next step. A success percentage will appear only when a suitable prediction model has been validated.','Les programmes personnalisés et les ajustements selon tes séances sont la prochaine étape. Un pourcentage de réussite apparaîtra uniquement après validation d’un modèle adapté.','البرامج الشخصية والتعديلات بناءً على جلساتك هي الخطوة التالية. ستظهر نسبة النجاح فقط بعد التحقق من نموذج تنبؤ مناسب.')}</p></section>
 </div>;
}
