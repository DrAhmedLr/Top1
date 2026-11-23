'use client';

import {CalendarCheck,ChevronRight,History,Target} from 'lucide-react';
import {useTranslations} from './providers/LocaleProvider';
import {goalMetrics,type GoalUnit} from '@/lib/adaptiveProgram';
import type {GoalTracking} from '@/lib/goalTrackingTypes';
type GoalAttempt=GoalTracking['attempts'][number];
import {formatRunTime} from '@/lib/run10kReference';
import s from './AdaptiveProgram.module.css';

type RecordTest=(metric:string,unit:GoalUnit)=>void;

function useGoalCopy(){
 const {t,locale}=useTranslations();
 const l=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const date=(day:string)=>new Date(day+'T12:00:00Z').toLocaleDateString(locale,{day:'numeric',month:'short',year:'numeric',calendar:'gregory',timeZone:'UTC'});
 const n=(value:number)=>new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(value);
 const percent=(value:number)=>{
  const format=(p:number)=>p.toLocaleString(locale,{style:'percent',maximumFractionDigits:0});
  return value>0&&value<.01?'< '+format(.01):value>.99&&value<1?'> '+format(.99):format(value);
 };
 const metricName=(a:GoalAttempt)=>t(goalMetrics.find(m=>m.id===a.metric)?.name??a.metric);
 const reading=(a:GoalAttempt,value:number)=>{
  const metric=goalMetrics.find(m=>m.id===a.metric);
  if(a.metric==='run_5k')return formatRunTime(value,true)+' '+t('min:sec');
  return n(value)+' '+t(a.goalUnit==='kg'?'kg':metric?.unit??'');
 };
 const status={
  active:l('In progress','En cours','قيد التنفيذ'),
  reached:l('Target reached','Cible atteinte','تحقق الهدف'),
  missed:l('Target missed at the final test','Cible non atteinte au test final','لم يتحقق الهدف في الاختبار النهائي'),
  unobserved:l('Final result missing','Résultat final manquant','النتيجة النهائية غير مسجلة'),
  superseded:l('Goal ended early','Objectif terminé plus tôt','انتهى الهدف مبكرًا'),
 };
 return {l,n,date,reading,metricName,status,locale,percent};
}

function GoalEvidence({attempt:a,today,onRecord}:{attempt:GoalAttempt;today:string;onRecord:RecordTest}){
 const {l,n,date,reading,locale,percent}=useGoalCopy();
 const adherence=a.adherence;
 const finalDue=a.status==='unobserved'||(a.status==='active'&&today>=a.deadline&&a.observedOn!==a.deadline);
 const observedLabel=a.status==='reached'?l('Measured result','Résultat mesuré','النتيجة المقاسة'):
  a.status==='missed'?l('Final comparable test','Test final comparable','الاختبار النهائي القابل للمقارنة'):
   l('Latest comparable test','Dernier test comparable','آخر اختبار قابل للمقارنة');
 return <div className={s.goalEvidence}>
  <dl className={s.resultFacts}>
   <div><dt>{l('Goal date','Échéance','موعد الهدف')}</dt><dd><time dateTime={a.deadline}>{date(a.deadline)}</time></dd></div>
   <div><dt>{l('Starting result','Point de départ','نتيجة البداية')}</dt><dd><bdi>{reading(a,a.baseline)}</bdi></dd></div>
   <div><dt>{l('Target','Cible','الهدف')}</dt><dd><bdi>{reading(a,a.target)}</bdi></dd></div>
   {a.status!=='active'&&a.firstForecast&&<div>
    <dt>{l('First estimate with full attendance','Première estimation avec toutes les séances','التقدير الأول مع إتمام كل الجلسات')}</dt>
    <dd><bdi>{percent(a.firstForecast.probability)}</bdi> · <time dateTime={a.firstForecast.issuedAt}>{new Date(a.firstForecast.issuedAt).toLocaleDateString(locale,{day:'numeric',month:'short',year:'numeric',calendar:'gregory',timeZone:a.timeZone})}</time></dd>
   </div>}
   {a.observedOn&&a.observedValue!=null&&<div><dt>{observedLabel}</dt><dd><bdi>{reading(a,a.observedValue)}</bdi> · <time dateTime={a.observedOn}>{date(a.observedOn)}</time></dd></div>}
   {a.lateObservedOn&&a.lateObservedValue!=null&&<div><dt>{l('Test after the deadline','Test après l’échéance','اختبار بعد الموعد')}</dt><dd><bdi>{reading(a,a.lateObservedValue)}</bdi> · <time dateTime={a.lateObservedOn}>{date(a.lateObservedOn)}</time></dd></div>}
  </dl>
  {!a.baselineMeasuredAt&&<p>{l('A dated baseline test matching the starting result is needed to verify this goal.','Un test initial daté correspondant au point de départ est nécessaire pour vérifier cet objectif.','يتطلب التحقق من هذا الهدف اختبار بداية مؤرخًا يطابق النتيجة الأولية.')}</p>}
  <div className={s.attendance}>
   <div><h4>{l('Training attendance','Assiduité aux séances','الالتزام بالجلسات')}</h4>
    {adherence.percent!==null&&<strong><bdi>{(adherence.percent/100).toLocaleString(locale,{style:'percent',maximumFractionDigits:0})}</bdi></strong>}
   </div>
   {adherence.due?<dl className={s.resultFacts}>
    <div><dt>{l('Sessions due','Séances arrivées à échéance','الجلسات المستحقة')}</dt><dd>{n(adherence.due)}</dd></div>
    <div><dt>{l('Completed in full','Réalisées en entier','المكتملة بالكامل')}</dt><dd>{n(adherence.completed)}</dd></div>
   </dl>:<p>{l('No sessions due yet.','Aucune séance arrivée à échéance.','لا توجد جلسات مستحقة بعد.')}</p>}
   {adherence.due>0&&<progress value={adherence.completed} max={adherence.due} aria-label={l('Due sessions completed in full','Séances prévues réalisées en entier','الجلسات المستحقة المكتملة بالكامل')}/>}
   <details className={s.explainer}><summary>{l('Session breakdown','Détail des séances','تفاصيل الجلسات')}</summary>
    <p>{l('A full session matches the prescribed sets, repetitions or time, and load. Today enters the due count when logged or when the day ends.','Une séance complète respecte les séries, les répétitions ou la durée et la charge prescrites. Celle du jour compte dès sa saisie ou à la fin de la journée.','تطابق الجلسة المكتملة عدد المجموعات والتكرارات أو المدة والحمل الموصوف. تُحتسب جلسة اليوم عند تسجيلها أو عند انتهاء اليوم.')}</p>
    {a.reachedOn&&<p>{l('Attendance counted through the target-reaching test','Assiduité comptée jusqu’au test ayant atteint la cible','حُسب الالتزام حتى اختبار تحقيق الهدف')} · <time dateTime={a.reachedOn}>{date(a.reachedOn)}</time></p>}
    <dl className={s.resultFacts}>{[
     [l('Scheduled in the goal window','Prévues sur la période','المجدولة خلال فترة الهدف'),adherence.planned],
     [l('Partially completed','Partiellement réalisées','مكتملة جزئيًا'),adherence.partial],
     [l('Logged as skipped','Déclarées manquées','مسجلة كجلسات فائتة'),adherence.skipped],
     [l('Due without a log','Prévues sans saisie','مستحقة دون تسجيل'),adherence.unlogged],
    ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{n(Number(value))}</dd></div>)}</dl>
   </details>
  </div>
  {finalDue&&<div className={s.finalRetest}>
   <CalendarCheck size={19} aria-hidden="true"/>
   <div><h4>{l('Final retest','Test final','إعادة الاختبار النهائي')}</h4>
    <p>{l('Repeat the baseline test with the same protocol and enter the date you actually tested. A later test is shown separately.','Reprends le protocole du test initial et saisis la date réelle du test. Un test réalisé après l’échéance apparaît séparément.','أعد اختبار البداية بالبروتوكول نفسه وسجّل التاريخ الفعلي للاختبار. يُعرض الاختبار اللاحق للموعد بشكل منفصل.')}</p>
   </div>
   <button type="button" className={s.secondary} onClick={()=>onRecord(a.metric,a.goalUnit)}>{l('Record the retest','Consigner le test','سجّل نتيجة الاختبار')}<ChevronRight size={15} aria-hidden="true"/></button>
  </div>}
 </div>;
}

export function CurrentGoalResult({attempt,today,onRecord}:{attempt:GoalAttempt;today:string;onRecord:RecordTest}){
 const {l,status,metricName}=useGoalCopy();
 return <section className={s.card}>
  <div className={s.heading}><Target aria-hidden="true" size={19}/><h2>{l('Goal result','Résultat de l’objectif','نتيجة الهدف')}</h2></div>
  <div className={s.outcomeRow}><strong>{metricName(attempt)}</strong><span className={s.outcome} data-status={attempt.status}>{status[attempt.status]}</span></div>
  <GoalEvidence attempt={attempt} today={today} onRecord={onRecord}/>
 </section>;
}

export function PastGoalResults({attempts,today,onRecord}:{attempts:GoalAttempt[];today:string;onRecord:RecordTest}){
 const {l,date,reading,metricName,status}=useGoalCopy();
 if(!attempts.length)return null;
 return <section className={s.card}>
  <div className={s.heading}><History size={19} aria-hidden="true"/><h2>{l('Past goals','Objectifs passés','الأهداف السابقة')}</h2></div>
  {attempts.map(a=><details className={s.pastGoal} key={a.planId+':'+a.revision}>
   <summary><span><strong>{metricName(a)} · <bdi>{reading(a,a.target)}</bdi></strong><small>{date(a.deadline)} · {status[a.status]}</small></span></summary>
   <GoalEvidence attempt={a} today={today} onRecord={onRecord}/>
  </details>)}
 </section>;
}

export function GoalSharing({sharing,busy,failed,onChange}:{sharing:boolean;busy:boolean;failed:boolean;onChange:(value:boolean)=>void}){
 const {l}=useGoalCopy();
 return <section className={s.card}>
  <label className={s.learningOptIn}>
   <input type="checkbox" checked={sharing} disabled={busy} onChange={e=>onChange(e.target.checked)}/>
   <span>{l('Use my goal outcomes to improve estimates','Utiliser les résultats de mes objectifs pour améliorer les estimations','استخدام نتائج أهدافي لتحسين التقديرات')}</span>
  </label>
  <p>{l('Contribute your goal results and training attendance to pooled estimates. You can turn this off here at any time.','Partage les résultats de tes objectifs et ton assiduité pour améliorer les estimations collectives. Tu peux désactiver cette option ici à tout moment.','ساهم بنتائج أهدافك والتزامك بالجلسات في تحسين التقديرات المجمّعة. يمكنك إيقاف المشاركة هنا في أي وقت.')}</p>
  {busy&&<p role="status">{l('Saving your choice…','Enregistrement…','جارٍ حفظ اختيارك…')}</p>}
  {failed&&<p role="alert">{l('Your choice could not be saved. Try again.','Impossible d’enregistrer ton choix. Réessaie.','تعذّر حفظ اختيارك. حاول مجددًا.')}</p>}
 </section>;
}
