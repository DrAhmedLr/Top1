'use client';
import {useMemo,useState} from 'react';
import {CalendarDays,Check,ChevronLeft,ChevronRight} from 'lucide-react';
import {addDays,dayInZone,goalMetrics,sessionResult,actualDose,planForSession,type AdaptiveConfig,type AdaptivePlan,type PerformedSession} from '@/lib/adaptiveProgram';
import type {DatedProgram,DatedSession,DatedTrainingSession} from '@/lib/datedProgram';
import {parseMeasurementInput} from '@/lib/measurementInput';
import type {TrainingEvent,TrainingProgram,Workout} from '@/lib/training';
import {useProgramCopy} from './programCopy';
import s from './AdaptiveProgram.module.css';

export type CalendarPlan={id:string;config:AdaptiveConfig;schedule:Pick<DatedProgram,'weeks'>;plan?:AdaptivePlan;through?:string;start?:string};
export type CheckIn={plan:AdaptivePlan;actual:PerformedSession|null};
export function manualCalendarItem(plan:AdaptivePlan,events:TrainingEvent[],groupStart:string,groupEnd:string):CalendarPlan {
 const template=plan.event.data as TrainingProgram;
 const start=[groupStart,dayInZone(new Date(plan.config.createdAt),template.timeZone)].sort().at(-1)!;
 const through=[groupEnd,plan.config.deadline].sort()[0],sessions:DatedSession[]=[];
 const nowDay=dayInZone(new Date(),template.timeZone),revisions=events.filter(event=>event.kind==='program'&&event.id===plan.event.id);
 const weekdays=template.sessions[0]?.weekdays??[],logs=new Map(plan.sessions.map(e=>[sessionResult(e.data as Workout)?.day,e.data as Workout]));
 for(let day=start;day<=through;day=addDays(day,1)){
  const weekday=(new Date(day+'T12:00:00Z').getUTCDay()+6)%7+1;
  const logged=logs.get(day),record=logged?sessionResult(logged):undefined;
  if(!record&&!weekdays.includes(weekday))continue;
  const version=day<nowDay?planForSession(revisions,plan,day):plan,dose=record?.dose??version.prescription;
  const name=version.config.exercise;
  sessions.push({date:day,kind:'training',exercise:[name,name,name],...dose,effort:'same-protocol',restSeconds:0,warmupMinutes:0,cooldownMinutes:0,estimatedMinutes:version.config.minutes});
 }
 return {id:plan.event.id,plan,config:plan.config,schedule:{weeks:[{number:1,start,end:through,sessions}]},start,through};
}
type DayItem={entry:CalendarPlan;session:DatedSession;logged?:Workout};
type TrainingItem=DayItem&{session:DatedTrainingSession};
type Save=(date:string,records:CheckIn[])=>Promise<boolean>;
type Adjustment={mode:'planned'|'adjust'|'skip';sets:string;amount:string;loadKg:string;minutes:string;substitute:boolean;exercise:string;reason:string};
function mondayOf(day:string){const weekday=new Date(day+'T12:00Z').getUTCDay();return addDays(day,-((weekday+6)%7));}
const fieldNumber=(v:string)=>{const n=parseMeasurementInput(v);return n===''?NaN:Number(n);};
function endOn(day:string,time:string,zone:string){
 if(!/^\d{2}:\d{2}$/.test(time))return null;
 const target=Date.parse(day+'T'+time+':00Z'), formatter=new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 if(!Number.isFinite(target))return null;
 let instant=target;
 for(let i=0;i<3;i++){const parts=Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part=>[part.type,part.value]));const local=parts.year+'-'+parts.month+'-'+parts.day+'T'+parts.hour+':'+parts.minute;if(local===day+'T'+time)return new Date(instant);instant+=target-Date.parse(local+':00Z');}
 return null;
}
function defaultAdjustment(session:DatedTrainingSession):Adjustment{return {mode:'planned',sets:String(session.sets),amount:String(session.amount),loadKg:String(session.loadKg),minutes:String(session.estimatedMinutes),substitute:false,exercise:'',reason:''};}

function DayCheckIn({items,day,today,busy,save}:{items:TrainingItem[];day:string;today:string;busy:boolean;save:Save}) {
 const {l,t,index,number}=useProgramCopy();
 const [drafts,setDrafts]=useState<Record<string,Adjustment>>({}),[time,setTime]=useState(''),[error,setError]=useState(false);
 const zone=items[0].entry.plan!.event.data.timeZone;
 function change(item:TrainingItem,update:Partial<Adjustment>){setError(false);setDrafts(prev=>({...prev,[item.entry.id]:{...(prev[item.entry.id]??defaultAdjustment(item.session)),...update}}));}
 async function commit(){
   try{
     const now=new Date(),end=day===today?now:endOn(day,time,zone);
     const records=items.map(item=>{
       const plan=item.entry.plan!,a=drafts[item.entry.id]??defaultAdjustment(item.session);
       if(a.mode==='skip')return {plan,actual:null};
       if(!end||end>now||dayInZone(end,plan.event.data.timeZone)!==day)throw Error();
       const source=a.mode==='planned'?defaultAdjustment(item.session):a;
       const substitution=source.substitute?{name:source.exercise.trim(),reason:source.reason.trim()}:undefined;
       if(substitution&&(!substitution.name||!substitution.reason))throw Error();
       const actual={substitution,sets:fieldNumber(source.sets),amount:fieldNumber(source.amount),loadKg:fieldNumber(source.loadKg),minutes:fieldNumber(source.minutes),endedAt:end.toISOString()};
       return {plan,actual};
     });
     setError(!await save(day,records));
   }catch{setError(true);}
 }
 const anyDone=items.some(item=>drafts[item.entry.id]?.mode!=='skip');
 return <fieldset className={s.checkIn} disabled={busy}><legend>{l('Workout check-in','Suivi de séance','تسجيل الحصة')}</legend>
   {items.map(item=>{const a=drafts[item.entry.id]??defaultAdjustment(item.session),d=item.session;
     return <div key={item.entry.id} className={s.checkExercise}><strong>{item.session.exercise[index]}</strong>
       <small><bdi>{number(d.sets)} × {number(d.amount)} {d.mode==='seconds'?t('s'):l('reps','rép.','تكرارات')}{d.loadKg>0?' · '+number(d.loadKg)+' '+t('kg'):''}</bdi> · {number(d.estimatedMinutes)} {t('min')}</small>
       <div className={s.checkModes}>{(['planned','adjust','skip'] as const).map(mode=><button key={mode} type="button" className={s.choice} aria-pressed={a.mode===mode} onClick={()=>change(item,{mode})}>{mode==='planned'?l('As planned','Comme prévu','حسب الخطة'):mode==='adjust'?l('Adjust','Ajuster','تعديل'):l('Skip','Passer','تخطَّ')}</button>)}</div>
       {a.mode==='adjust'&&<><div className={s.doseInputs}>{([
         ['sets',l('Sets','Séries','المجموعات')],['amount',d.mode==='seconds'?l('Seconds / set','Secondes / série','ثوانٍ للمجموعة'):l('Reps / set','Rép. / série','تكرارات للمجموعة')],
         ['loadKg',l('Load (kg)','Charge (kg)','الوزن (كغ)')],['minutes',l('Minutes','Minutes','دقائق')]
       ] as const).map(([key,title])=><label key={key}>{title}<input type="text" inputMode={key==='loadKg'?'decimal':'numeric'} maxLength={10} value={a[key]} onChange={e=>change(item,{[key]:e.target.value})}/></label>)}</div>
         <label className={s.replace}><input type="checkbox" checked={a.substitute} onChange={e=>change(item,{substitute:e.target.checked})}/>{l('I did a different exercise','J’ai fait un autre exercice','أديت تمرينًا مختلفًا')}</label>
         {a.substitute&&<div className={s.pair}><label>{l('Exercise performed','Exercice effectué','التمرين المُنفَّذ')}<input type="text" maxLength={160} value={a.exercise} onChange={e=>change(item,{exercise:e.target.value})}/></label>
         <label>{l('Reason for substitution','Raison du remplacement','سبب الاستبدال')}<input type="text" maxLength={240} value={a.reason} onChange={e=>change(item,{reason:e.target.value})}/></label></div>}</>}
     </div>;})}
   {day!==today&&anyDone&&<label>{l('Workout end time','Heure de fin','وقت انتهاء الحصة')} · {zone}<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label>}
   {error&&<p role="alert">{l('Check the time, workout amounts and any replacement exercise, then retry.','Vérifie l’heure, les quantités et tout exercice de remplacement, puis réessaie.','تحقق من الوقت والكميات وأي تمرين بديل ثم أعد المحاولة.')}</p>}
   <button type="button" className={s.primary} disabled={day!==today&&anyDone&&!time} onClick={()=>void commit()}><Check size={16}/>{l('Save check-in','Enregistrer la séance','حفظ الحصة')}</button>
 </fieldset>;
}

export default function ProgrammeCalendar({items,today,busy=false,onCheckIn,onRetest}:{items:CalendarPlan[];today:string;busy?:boolean;onCheckIn?:Save;onRetest?:(config:AdaptiveConfig)=>void}) {
 const {l,t,date,index,number,locale}=useProgramCopy();
 const prepared=useMemo(()=>{
  const days=new Map<string,DayItem[]>();const starts:string[]=[],ends:string[]=[];
  for(const entry of items){
    starts.push(entry.start??entry.config.scheduleStart!);ends.push(entry.through??entry.config.deadline);
    const logs=new Map(entry.plan?.sessions.map(e=>{const w=e.data as Workout;return [sessionResult(w)?.day,w];}));
    for(const week of entry.schedule.weeks)for(const session of week.sessions){
      const logged=logs.get(session.date);if(entry.through&&session.date>entry.through&&!logged)continue;
      const rows=days.get(session.date)??[];rows.push({entry,session,logged});days.set(session.date,rows);
    }
  }
  return {days,start:starts.sort().at(0)??today,end:ends.sort().at(-1)??today};
 },[items,today]);
 const initial=today<prepared.start?prepared.start:today>prepared.end?prepared.end:today;
 const [picked,setPicked]=useState<string|undefined>();
 const day=picked&&picked>=prepared.start&&picked<=prepared.end?picked:initial,week=mondayOf(day),rows=prepared.days.get(day)??[];
 const weekdays=Array.from({length:7},(_,i)=>addDays(week,i));
 const [checkDay,setCheckDay]=useState('');
 const choose=(value:string)=>{setPicked(value);setCheckDay('');};
 function moveWeek(n:number){const next=addDays(day,n*7);choose(next<prepared.start?prepared.start:next>prepared.end?prepared.end:next);}
 const todo=rows.filter((row):row is TrainingItem=>row.session.kind==='training'&&!row.logged&&!!row.entry.plan);
 const hasCheckIn=Boolean(onCheckIn)&&day<=today&&todo.length>0;
 return <section className={s.card}><div className={s.heading}><CalendarDays size={20}/><h2>{l('Training calendar','Calendrier d’entraînement','تقويم التدريب')}</h2></div>
   <div className={s.calendarPager}><button className={s.icon} type="button" disabled={week<=mondayOf(prepared.start)} aria-label={l('Previous week','Semaine précédente','الأسبوع السابق')} onClick={()=>moveWeek(-1)}><ChevronLeft size={17}/></button>
     <strong><bdi>{date(week)} – {date(weekdays[6])}</bdi></strong><button className={s.icon} type="button" disabled={weekdays[6]>=prepared.end} aria-label={l('Next week','Semaine suivante','الأسبوع التالي')} onClick={()=>moveWeek(1)}><ChevronRight size={17}/></button></div>
   <div className={s.calendarStrip} key={week}>{weekdays.map(d=>{const entries=prepared.days.get(d)??[],selected=d===day,hasActions=entries.length>0,done=hasActions&&entries.every(r=>r.logged);
     const instant=new Date(d+'T12:00Z');return <button key={d} type="button" aria-pressed={selected} aria-current={d===today?'date':undefined} aria-label={date(d)+(hasActions?' · '+number(entries.length)+' '+l('scheduled items','éléments prévus','عناصر مجدولة'):'')} disabled={d<prepared.start||d>prepared.end} data-session={hasActions} data-done={done} onClick={()=>choose(d)}>
       <small>{new Intl.DateTimeFormat(locale,{weekday:'narrow',timeZone:'UTC'}).format(instant)}</small><b>{number(instant.getUTCDate())}</b><i aria-hidden="true"/></button>;})}</div>
   <div className={s.dayDetails} key={day}><h3><time dateTime={day}>{date(day)}</time></h3>
     {!rows.length&&<p>{l('Recovery day','Jour de récupération','يوم التعافي')}</p>}
     {rows.map(({entry,session,logged})=>{const m=goalMetrics.find(m=>m.id===entry.config.metric),actual=logged?actualDose(logged):undefined;return <div className={s.calendarExercise} key={entry.id}>
       {session.kind==='retest'?<><strong>{t(m?.name??entry.config.metric)} · {l('Retest','Retest','إعادة الاختبار')}</strong><small>{number(session.estimatedMinutes)} {t('min')}</small>{onRetest&&day<=today&&<button className={s.link} type="button" onClick={()=>onRetest(entry.config)}>{l('Log test','Enregistrer le test','تسجيل الاختبار')}</button>}</>:
       <><strong>{session.exercise[index]}</strong><span><bdi>{number(session.sets)} × {number(session.amount)} {session.mode==='seconds'?t('s'):l('reps','rép.','تكرارات')}{session.loadKg>0?' · '+number(session.loadKg)+' '+t('kg'):''}</bdi> · {number(session.estimatedMinutes)} {t('min')}</span>
       {entry.config.guidedVersion===1&&<details className={s.explainer}><summary>{l('Session details','Détails de la séance','تفاصيل الحصة')}</summary><small>{l('Warm-up','Échauffement','إحماء')} {number(session.warmupMinutes)} {t('min')} · {l('Rest between sets','Repos entre séries','راحة بين المجموعات')} {number(session.restSeconds)} {t('s')} · {l('Cool-down','Retour au calme','تهدئة')} {number(session.cooldownMinutes)} {t('min')}</small></details>}
       {logged&&<div className={s.loggedDose}>{actual?<><small>{l('Logged','Enregistré','تم التسجيل')} · {logged.exercises[0]?.name}</small>
       <bdi>{number(actual.sets)} × {number(actual.amount)} {session.mode==='seconds'?t('s'):l('reps','rép.','تكرارات')}{actual.loadKg?' · '+number(actual.loadKg)+' '+t('kg'):''} · {number(sessionResult(logged)?.minutes??0)} {t('min')}</bdi>
       {logged.exercises[0]?.substitutionReason&&<small>{logged.exercises[0].substitutionReason}</small>}</>:<small>{l('Skipped','Passée','تم التخطي')}</small>}</div>}</>}
     </div>;})}
     {hasCheckIn&&(checkDay===day?<DayCheckIn items={todo} day={day} today={today} busy={busy} save={onCheckIn!}/>:<button type="button" className={s.primary} disabled={busy} onClick={()=>setCheckDay(day)}>{l('Log this workout','Consigner cette séance','سجّل هذه الحصة')}</button>)}
   </div></section>;
}
