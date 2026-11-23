'use client';
import {probabilityLabel,useProgramCopy} from './programCopy';
import type {RecentGoalPace} from '@/lib/recentGoalPace';
import s from './AdaptiveProgram.module.css';

type Pace=RecentGoalPace|null;
export default function ProgrammePace({pace}:{pace:Pace|undefined}){
 const {l,locale,number}=useProgramCopy();
 const format=(day:string)=>new Intl.DateTimeFormat(locale,{year:'numeric',month:'short',day:'numeric',timeZone:'UTC',calendar:'gregory'}).format(new Date(day+'T12:00:00Z'));
 if(!pace)return null;
 const unavailable=pace.kind==='unavailable'?({
  insufficient:l('More comparable tests and logged sessions are needed.','Des tests comparables et des séances consignées supplémentaires sont nécessaires.','تلزم اختبارات مماثلة وحصص مسجلة إضافية.'),
  stale:l('Record a recent comparable test to update this estimate.','Enregistre un test comparable récent pour actualiser cette estimation.','سجّل اختبارًا حديثًا مماثلًا لتحديث التقدير.'),
  logs:l('Log your training to estimate your current pace.','Consigne tes séances pour estimer ton rythme actuel.','سجّل حصصك لتقدير وتيرتك الحالية.'),
  context:l('Repeat a test under matching conditions.','Refais un test dans les mêmes conditions.','أعد الاختبار في ظروف مماثلة.'),
  horizon:l('The goal is beyond the supported forecast window.','L’objectif dépasse la période de projection.','يتجاوز الهدف فترة التوقع المدعومة.'),
  expired:l('The goal deadline has passed.','L’échéance est passée.','انتهى موعد الهدف.'),
  reached:l('Your latest comparable test reached the target.','Ton dernier test comparable a atteint la cible.','حقق اختبارك المماثل الأخير الهدف.')
 })[pace.reason]:undefined;
 return <div className={s.recentPace}><h3>{l('At your recent pace','À ton rythme récent','حسب وتيرتك الأخيرة')}</h3>
   {pace.kind==='ready'?<>
     <div><bdi>{probabilityLabel(pace.probability,locale)}</bdi><span>{l('chance by the target date','de chance à la date cible','احتمال بلوغ الهدف في الموعد')}</span></div>
     <p>{pace.finishRange?<>{l('Projected finish','Fin estimée','موعد الإنجاز المتوقع')} · <bdi>{format(pace.finishRange.early)} – {format(pace.finishRange.late)}</bdi></>:
       pace.finishDay?<>{l('Projected finish','Fin estimée','موعد الإنجاز المتوقع')} · <bdi>{format(pace.finishDay)}</bdi></>:
       l('The data do not yet support a finish date.','Les données ne permettent pas encore de dater la réussite.','لا تدعم البيانات تحديد موعد للإنجاز بعد.')}</p>
   </>:<p>{unavailable}</p>}
   {pace.kind==='ready'&&<details className={s.explainer}><summary>{l('Recent training used','Entraînement récent pris en compte','التدريب الأخير المستخدم')}</summary><p>{number(pace.intervals)} {l('comparable intervals','intervalles comparables','فترات مماثلة')} · {number(pace.observationDays)} {l('days','jours','أيام')}</p>
     <p>{number(pace.attendance.completed)} {l('as planned','comme prévu','حسب الخطة')} · {number(pace.attendance.modified)} {l('modified','modifiées','معدّلة')} · {number(pace.attendance.skipped)} {l('skipped','passées','متخطاة')} · {number(pace.attendance.unlogged)} {l('unlogged','non consignées','غير مسجلة')}</p></details>}
 </div>;
}
