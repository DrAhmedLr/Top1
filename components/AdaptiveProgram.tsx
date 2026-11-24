'use client';
import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {ArrowRight,CalendarDays,Check,ClipboardList,Dumbbell,Settings2,Target,TrendingUp} from 'lucide-react';
import {useTranslations} from './providers/LocaleProvider';
import {captureEvent,recordJourneyAction} from '@/lib/analytics';
import {useRetests} from '@/lib/hooks/useRetests';
import PersonalForecastPanel from './PersonalForecastPanel';
import {savedGoalCalibration} from '@/lib/goalTrackingDisplay';
import {useGoalTracking} from '@/lib/hooks/useGoalTracking';
import {CurrentGoalResult,GoalSharing,PastGoalResults} from './ProgramGoalResults';
import GuidedProgram,{AdherenceEstimate} from './GuidedProgram';
import {datedProgram} from '@/lib/datedProgram';
import ProgrammeDates from './ProgrammeDates';
import ProgrammePace from './ProgrammePace';
import {replanMixedManualGoal,replanPortfolioDates} from '@/lib/programPortfolio';
import {programContextFromHistory} from '@/lib/programTrainingHistory';
import {probabilityLabel} from './programCopy';
import ProgrammeCalendar,{manualCalendarItem,type CalendarPlan,type CheckIn} from './ProgrammeCalendar';
import CoachDecisionCard from './CoachDecisionCard';
import MaintenanceCard from './MaintenanceCard';
import {buildAthleteDossier,isoWeekdayForDay} from '@/lib/athleteDossier';
import {applyDayAvailabilityOverride,applyWeekdayMinutesRule,selectNextSessionDecision,toStoredDecision} from '@/lib/coachDecision';
import {buildMaintenancePlan} from '@/lib/maintenancePlan';
import {evaluatePersonalLearning} from '@/lib/outcomeLearning';
import {suggestSupportingWins} from '@/lib/supportingWins';
import {illustrativeGain} from '@/lib/guidedAdherence';
import {observationDate,type Observation} from '@/lib/history';
import {isLift} from '@/lib/focusedEntry';
import {suggestStartingSession} from '@/lib/startingSession';
import {parseMeasurementInput} from '@/lib/measurementInput';
import {parseRunTime,formatRunTime} from '@/lib/run10kReference';
import type {Demographics, Values} from '@/lib/registry';
import {scenarioAssumptions, type PerformanceInsights} from '@/lib/performanceInsights';
import {usePerformanceInsights} from '@/lib/hooks/usePerformanceInsights';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
import type {WorkspaceState} from '@/lib/hooks/usePersonalWorkspace';
import type {AdaptiveTrainingState} from '@/lib/adaptiveProgramClient';
import {adaptivePlans,currentAdaptivePlans,actualDose,correctWorkout,deterministicRequestId,scenarioResult,scheduledWeekdays,addDays,buildProgram,checkConfig,dayInZone,doseKey,goalMetrics,goalValue,makeWorkout,planForSession,observedGain,sessionResult,workoutId,type AdaptiveConfig,type AdaptivePlan,type Dose,type GoalUnit,type PerformedSession} from '@/lib/adaptiveProgram';
import type {TrainingEvent,TrainingProgram,TrainingMutation,Workout} from '@/lib/training';
import s from './AdaptiveProgram.module.css';

type Props={owner:string;initialMetric?:string;initialTarget?:number;onTierHandled?:(metric:string)=>void;measurementRevision?:number;training:AdaptiveTrainingState;workspace:WorkspaceState;values:Values;profile?:Demographics;details?:MeasurementMetadata;guestEntries:Observation[];recommendationEntries:Observation[];onBrowse:()=>void;onRecord:(metric:string,unit:GoalUnit)=>void};
type L=(en:string,fr:string,ar:string)=>string;
const binomialSource='https://www.itl.nist.gov/div898/handbook/eda/section3/eda366i.htm';
function useCopy(){const {locale,t}=useTranslations(); const l:L=(en,fr,ar)=>locale==='fr'?fr:locale==='ar'?ar:en;return {l,t,locale};}
function numeric(raw:string){const parsed=parseMeasurementInput(raw);return parsed===''?NaN:Number(parsed);}
function resultText(n:number,metric:string,locale:string){return metric==='run_5k'?formatRunTime(n,true):new Intl.NumberFormat(locale,{maximumFractionDigits:3}).format(n);}
function goalUnit(id:string,unit:GoalUnit){return unit==='kg'?'kg':id==='run_5k'?'min:sec':goalMetrics.find(m=>m.id===id)?.unit??'';}
function doseText(d:Dose,l:L,locale:string){const load=new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(d.loadKg);return d.sets+' × '+d.amount+' '+(d.mode==='seconds'?l('s','s','ث'):l('reps','rép.','تكرارات'))+(d.loadKg>0?' · '+load+' kg':'');}
function errorText(reason:unknown,l:L){
  const code=reason instanceof Error?reason.message:'';
  if(code==='target'||code==='goal')return l('Enter a valid baseline and a target that improves on it.','Indique un résultat de départ valide et une cible qui l’améliore.','أدخل نتيجة بداية صالحة وهدفًا أفضل منها.');
  if(code==='date')return l('Check the date against the start and deadline.','Vérifie la date par rapport au début et à l’échéance.','تحقق من التاريخ مقارنة بالبداية والموعد النهائي.');
  if(code==='duplicate')return l('A session is already logged for this day.','Une séance est déjà enregistrée pour cette date.','سُجّلت جلسة لهذا اليوم من قبل.');
  if(code==='budget'||code==='schedule')return l('The other goals use these visits or recovery days. Choose a compatible date or adjust your weekly time.','Les autres objectifs utilisent ces séances ou jours de récupération. Choisis une date compatible ou ajuste ton temps hebdomadaire.','تستخدم الأهداف الأخرى هذه الزيارات أو أيام التعافي. اختر موعدًا متوافقًا أو عدّل الوقت الأسبوعي.');
  if(code==='duration')return l('The timed sets must fit inside the session.','La durée des séries doit tenir dans la séance.','يجب أن تتسع مدة الجلسة للمجموعات.');
  if(code==='scenario')return l('Enter a positive gain and percentages between 0 and 100.','Indique un gain positif et des pourcentages entre 0 et 100.','أدخل تحسنًا موجبًا ونسبًا بين 0 و100.');
  return l('Check the exercise, sets, amount, load and session length.','Vérifie l’exercice, les séries, la charge et la durée de séance.','تحقق من التمرين والمجموعات والوزن ومدة الجلسة.');
}
function decimalField(label:string,name:string,value:string,onChange:(v:string)=>void,options:{integer?:boolean;clock?:boolean;disabled?:boolean;placeholder?:string;required?:boolean}={}){
  return <label>{label}<input name={name} type="text" inputMode={options.clock?'text':options.integer?'numeric':'decimal'} value={value} onChange={e=>onChange(e.target.value)} disabled={options.disabled} placeholder={options.placeholder} required={options.required!==false} maxLength={18}/></label>;
}
function ConfigForm({plan,initialMetric,initialTarget,workspace,values,details,blocked,onSave,onCancel,latest}:{plan?:AdaptivePlan;latest?:number;initialMetric?:string;initialTarget?:number;workspace:WorkspaceState;values:Values;details?:MeasurementMetadata;blocked:boolean;onSave:(c:AdaptiveConfig)=>Promise<boolean>;onCancel?:()=>void}){
  const {l,t,locale}=useCopy(),existing=plan?.config;
  const savedGoal=(!initialMetric||initialMetric===workspace.data.goal?.metric)?workspace.data.goal:null;
  const first=goalMetrics.find(m=>values[m.id]!==undefined)?.id??'pushups';
  const [metricId,setMetric]=useState(existing?.metric??initialMetric??savedGoal?.metric??first);
  const [unit,setUnit]=useState<GoalUnit>(existing?.goalUnit??'metric');
  const m=goalMetrics.find(m=>m.id===metricId)??goalMetrics[0];
  const source=goalValue(m,unit,values[m.id],details?.[m.id]);
  const raw=(n:number|undefined,id=metricId)=>n===undefined?'':id==='run_5k'?formatRunTime(n,true):String(n);
  const [baseline,setBaseline]=useState(raw(existing?.baseline??source??savedGoal?.baseline)),[target,setTarget]=useState(raw(existing?.target??initialTarget??savedGoal?.target));
  const zone=workspace.data.context.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today=dayInZone(new Date(),zone);
  const [chosenDeadline,setDeadline]=useState(existing?.deadline??savedGoal?.date??'');
  const [days,setDays]=useState(String(existing?.days??workspace.data.context.days??3)),[minutes,setMinutes]=useState(String(existing?.minutes??workspace.data.context.minutes??30));
  const parsedBaseline=m.id==='run_5k'?numeric(parseRunTime(baseline)):numeric(baseline);
  const bodyweight=details?.[m.id]?.derivation?.bodyWeightKg??details?.[m.id]?.protocol?.bodyWeightKg;
  const suggestion=suggestStartingSession(m,parsedBaseline,unit,bodyweight,numeric(minutes),workspace.data.context);
  const [overrides,setOverrides]=useState<Partial<Record<'exercise'|'mode'|'sets'|'amount'|'load',string>>>(()=>existing?{
    exercise:existing.exercise,mode:existing.dose.mode,sets:String(existing.dose.sets),amount:String(existing.dose.amount),load:String(existing.dose.loadKg),
  }:{});
  const override=(field:keyof typeof overrides,value:string)=>setOverrides(previous=>({...previous,[field]:value}));
  const exercise=overrides.exercise??(suggestion.exercise?l(...suggestion.exercise):t(m.name));
  const mode=(overrides.mode??suggestion.mode) as Dose['mode'];
  const sets=overrides.sets??String(suggestion.sets),amount=overrides.amount??String(suggestion.amount),load=overrides.load??String(suggestion.loadKg);
  const [error,setError]=useState('');
  const scheduleDetails=useRef<HTMLDetailsElement>(null);
  const label=t(goalUnit(m.id,unit));
  function changeMetric(id:string,u:GoalUnit){
    const next=goalMetrics.find(item=>item.id===id)!;
    setMetric(id);setUnit(u);setBaseline(raw(goalValue(next,u,values[id],details?.[id]),id));setTarget('');
    setOverrides({});
  }
  const manualDates=useMemo(()=>{
    if(!existing||!plan)return [];
    const original={date:existing.deadline,probability:null as number|null};
    const desired=m.id==='run_5k'?numeric(parseRunTime(target)):numeric(target),frequency=numeric(days);
    const config={...existing,target:desired,days:frequency,minutes:numeric(minutes),exercise,dose:{mode,sets:numeric(sets),amount:numeric(amount),loadKg:numeric(load)}};
    if(!Number.isFinite(desired)||!Number.isInteger(frequency)||frequency<1||frequency>7)return [original];
    const weekdays=scheduledWeekdays(frequency,dayInZone(new Date(config.createdAt),zone));
    const previous=plan.event.data as TrainingProgram;
    const event={...plan.event,data:{...previous,sessions:[{...previous.sessions[0],weekdays}]}};
    const prescription=JSON.stringify(config.dose)===JSON.stringify(existing.dose)?plan.prescription:{...config.dose,reason:'initial' as const};
    const simulated={...plan,event,config,prescription},assumptions=scenarioAssumptions(simulated).assumptions;
    const currentValue=latest??parsedBaseline,response=assumptions.response*assumptions.attendance/10000;
    const gap=Math.max(0,(desired-currentValue)*m.polarity);
    if(!Number.isFinite(gap)||!Number.isFinite(assumptions.gain)||assumptions.gain<=0)return [original];
    const visits=response?Math.max(1,Math.ceil(gap/assumptions.gain/response)):52*frequency;
    const counts=[.7,1,1.4].reduce<number[]>((v,f)=>[...v,Math.min(52*frequency-2+v.length,Math.max((v.at(-1)??0)+1,Math.round(visits*f)))],[]);
    const dates=new Set([original.date]);let seen=0;
    for(let offset=1;offset<=364;offset++){
      const day=addDays(today,offset);
      if(weekdays.includes((new Date(day).getUTCDay()+6)%7+1)&&counts.includes(++seen))dates.add(day);
      if(seen>=counts[2])break;
    }
    return [...dates].sort().map(date=>({date,probability:scenarioResult({...simulated,config:{...config,deadline:date,scenario:assumptions}},currentValue,today)?.p??null}));
  },[existing,plan,m,target,days,minutes,exercise,mode,sets,amount,load,zone,today,latest,parsedBaseline]);
  const deadline=manualDates.some(row=>row.date===chosenDeadline)?chosenDeadline:manualDates[0]?.date??chosenDeadline;
  async function submit(e:FormEvent){
    e.preventDefault();setError('');
    try{
      const parse=(value:string)=>m.id==='run_5k'?Number(numeric(parseRunTime(value)).toFixed(3)):numeric(value);
      if(deadline<=today)throw Error('date');
      const dose:Dose={sets:numeric(sets),amount:numeric(amount),mode,loadKg:numeric(load)};
      const c:AdaptiveConfig={metric:m.id,goalUnit:unit,baseline:parse(baseline),target:parse(target),deadline,createdAt:existing?.createdAt??new Date().toISOString(),days:numeric(days),minutes:numeric(minutes),exercise:exercise.trim(),dose,routineId:existing?.routineId??crypto.randomUUID()};
      if(existing){
        const same=existing.exercise===c.exercise&&existing.days===c.days&&existing.minutes===c.minutes&&['sets','amount','mode','loadKg'].every(k=>dose[k as keyof Dose]===existing.dose[k as keyof Dose]);
        if(same)c.scenario=existing.scenario;else c.routineId=crypto.randomUUID();
      }
      await onSave(checkConfig(c));
    }catch(reason){
      if(reason instanceof Error&&['dose','duration'].includes(reason.message)&&scheduleDetails.current)scheduleDetails.current.open=true;
      setError(errorText(reason,l));
    }
  }
  return <form className={s.card} onSubmit={submit}><div className={s.heading}><Target size={22}/><h2>{existing?l('Edit program','Modifier le programme','تعديل البرنامج'):l('Build my program','Créer mon programme','إنشاء برنامجي')}</h2></div>
    <fieldset disabled={blocked} className={s.fields}>
      <label>{l('Performance goal','Performance à améliorer','هدف الأداء')}<select name="goalMetric" value={m.id} disabled={!!existing} onChange={e=>changeMetric(e.target.value,'metric')}>{goalMetrics.map(item=><option value={item.id} key={item.id}>{t(item.name)}</option>)}</select></label>
      {isLift(m.id)&&<label>{l('Goal unit','Unité de l’objectif','وحدة الهدف')}<select value={unit} disabled={!!existing} onChange={e=>changeMetric(m.id,e.target.value as GoalUnit)}><option value="metric">{t(m.unit)}</option><option value="kg">{m.id==='pullup_1rm'?l('Added 1RM load (kg)','Charge additionnelle 1RM (kg)','الوزن الإضافي لأقصى تكرار (كغ)'):l('1RM load (kg)','Charge au 1RM (kg)','وزن أقصى تكرار (كغ)')}</option></select></label>}
      <div className={s.pair}>{decimalField(l('Starting result','Point de départ','نتيجة البداية')+' · '+label,'baseline',baseline,setBaseline,{disabled:!!existing,clock:m.id==='run_5k'})}{decimalField(l('Target','Cible','الهدف')+' · '+label,'target',target,setTarget,{clock:m.id==='run_5k'})}</div>
      <ProgrammeDates manual name="deadline" options={manualDates} value={deadline} onChange={setDeadline} saved={existing?.deadline}/>
      <details className={s.scheduleDetails} ref={scheduleDetails} onInvalidCapture={()=>{if(scheduleDetails.current)scheduleDetails.current.open=true;}}>
        <summary><span>{l('Adjust sessions','Ajuster les séances','تعديل الجلسات')}</span><small><bdi>{days}</bdi> {l('per week','par semaine','أسبوعيًا')} · <bdi>{minutes}</bdi> {l('min','min','د')}</small></summary>
        <div className={s.fields}>
      {workspace.data.context.limitations&&<p>{l('Movements you want to avoid','Mouvements à éviter','الحركات التي تريد تجنبها')} · {workspace.data.context.limitations}</p>}
      <label>{l('Exercise','Exercice','التمرين')}<input name="exercise" value={exercise} maxLength={120} required onChange={e=>override('exercise',e.target.value)}/></label>
      <div className={s.pair}>{decimalField(l('Sessions / week','Séances / semaine','الجلسات أسبوعيًا'),'days',days,setDays,{integer:true})}{decimalField(l('Minutes / session','Minutes / séance','الدقائق للجلسة'),'minutes',minutes,setMinutes,{integer:true})}</div>
      <label>{l('Set type','Type de série','نوع المجموعة')}<select value={mode} name="mode" onChange={e=>{const next=e.target.value;setOverrides(previous=>({...previous,mode:next,amount:next===suggestion.mode?String(suggestion.amount):next==='reps'?'5':'10'}));}}><option value="reps">{l('Repetitions','Répétitions','تكرارات')}</option><option value="seconds">{l('Duration','Durée','مدة')}</option></select></label>
      <div className={s.triple}>{decimalField(l('Sets','Séries','مجموعات'),'sets',sets,v=>override('sets',v),{integer:true})}{decimalField(mode==='reps'?l('Reps / set','Rép. / série','تكرارات للمجموعة'):l('Seconds / set','Sec. / série','ثوانٍ للمجموعة'),'amount',amount,v=>override('amount',v),{integer:true})}{decimalField(l('Load (kg)','Charge (kg)','الوزن (كغ)'),'loadKg',load,v=>override('load',v))}</div>
        </div>
      </details>
      {error&&<p role="alert" className={s.error}>{error}</p>}
      <div className={s.actions}><button className={s.primary} type="submit">{existing?l('Save changes','Enregistrer les modifications','حفظ التغييرات'):l('Create program','Créer le programme','إنشاء البرنامج')}<ArrowRight size={16}/></button>{onCancel&&<button type="button" className={s.secondary} onClick={onCancel}>{l('Cancel','Annuler','إلغاء')}</button>}</div>
    </fieldset></form>;
}
function localDateTime(date:Date){
  return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
function SessionForm({plan,events,initialDay,blocked,submit,onCancel}:{initialDay?:string;plan:AdaptivePlan;events:TrainingEvent[];blocked:boolean;submit:(day:string,actual:PerformedSession|null)=>Promise<boolean>;onCancel:()=>void}){
  const {l,locale}=useCopy(),today=dayInZone(new Date(),plan.event.data.timeZone),lastDay=initialDay??(today<plan.config.deadline?today:plan.config.deadline);
  const [kind,setKind]=useState<'done'|'missed'>('done'),[day,setDay]=useState(lastDay);
  const [end,setEnd]=useState(()=>today===lastDay?localDateTime(new Date()):lastDay+'T12:00');
  const instant=end?new Date(end):undefined,validInstant=instant&&Number.isFinite(instant.getTime())?instant:undefined;
  const selectedDay=kind==='done'&&validInstant?dayInZone(validInstant,plan.event.data.timeZone):day;
  const template=planForSession(events,plan,selectedDay,kind==='done'?validInstant?.toISOString():undefined);
  const d=template.prescription;
  function scheduledMinutes(p:AdaptivePlan,when:string){
    if(p.config.guidedVersion!==1)return p.config.minutes;
    return datedProgram(p).weeks.flatMap(week=>week.sessions).find(session=>session.kind==='training'&&session.date===when)?.estimatedMinutes??p.config.minutes;
  }
  const [sets,setSets]=useState(String(d.sets)),[amount,setAmount]=useState(String(d.amount)),[load,setLoad]=useState(String(d.loadKg)),[minutes,setMinutes]=useState(()=>String(scheduledMinutes(template,selectedDay))),[error,setError]=useState('');
  function changeEnd(raw:string){
    setEnd(raw);
    const date=new Date(raw);
    if(!Number.isFinite(date.getTime()))return;
    const updated=planForSession(events,plan,dayInZone(date,plan.event.data.timeZone),date.toISOString());
    setSets(String(updated.prescription.sets));setAmount(String(updated.prescription.amount));setLoad(String(updated.prescription.loadKg));setMinutes(String(scheduledMinutes(updated,dayInZone(date,plan.event.data.timeZone))));
  }
  async function finish(e:FormEvent){e.preventDefault();setError('');try{
    if(kind==='done'&&!validInstant)throw Error('date');
    if(await submit(selectedDay,kind==='done'?{sets:numeric(sets),amount:numeric(amount),loadKg:numeric(load),minutes:numeric(minutes),endedAt:validInstant!.toISOString()}:null))onCancel();
  }catch(reason){setError(errorText(reason,l));}}
  return <form className={s.formInset} onSubmit={finish}><fieldset disabled={blocked} className={s.fields}>
    <div className={s.pair}><button type="button" className={s.choice} aria-pressed={kind==='done'} onClick={()=>setKind('done')}>{l('Completed','Réalisée','مكتملة')}</button><button type="button" className={s.choice} aria-pressed={kind==='missed'} onClick={()=>setKind('missed')}>{l('Missed','Manquée','فائتة')}</button></div>
    {kind==='done'?<><label>{l('Session end','Fin de séance','نهاية الجلسة')} · {Intl.DateTimeFormat().resolvedOptions().timeZone}<input type="datetime-local" name="endedAt" required max={localDateTime(new Date())} value={end} onChange={e=>changeEnd(e.target.value)}/></label><p>{template.config.exercise} · {doseText(d,l,locale)}</p><div className={s.triple}>{decimalField(l('Sets done','Séries faites','المجموعات المنجزة'),'actualSets',sets,setSets,{integer:true})}{decimalField(d.mode==='reps'?l('Reps / set','Rép. / série','تكرارات للمجموعة'):l('Sec / set','Sec. / série','ثوانٍ للمجموعة'),'actualAmount',amount,setAmount,{integer:true})}{decimalField(l('Load (kg)','Charge (kg)','الوزن (كغ)'),'actualLoad',load,setLoad)}</div>{decimalField(l('Actual minutes','Durée réelle (min)','المدة الفعلية بالدقائق'),'actualMinutes',minutes,setMinutes,{integer:true})}</>:<label>{l('Date of the missed session','Date de la séance manquée','تاريخ الجلسة الفائتة')}<input type="date" required min={dayInZone(new Date(plan.config.createdAt),plan.event.data.timeZone)} max={lastDay} value={day} onChange={e=>setDay(e.target.value)}/></label>}
    {error&&<p role="alert" className={s.error}>{error}</p>}<div className={s.actions}><button className={s.primary} type="submit">{l('Save session','Enregistrer la séance','حفظ الجلسة')}<Check size={16}/></button><button type="button" className={s.secondary} onClick={onCancel}>{l('Cancel','Annuler','إلغاء')}</button></div>
  </fieldset></form>;
}
function Probability({plan,goal,blocked,onSave,comparison}:{comparison?:Observation[];plan:AdaptivePlan;goal:NonNullable<PerformanceInsights['goal']>;blocked:boolean;onSave:(config:AdaptiveConfig)=>Promise<boolean>}){
  const {l,t,locale}=useCopy(),{config,prescription}=plan,observed=plan.sessions.filter(e=>sessionResult(e.data as Workout)?.routineId===config.routineId);
  const ratio=observed.length?100*observed.filter(e=>(e.data as Workout).status==='completed').length/observed.length:undefined;
  const currentKey=doseKey(config,prescription),initial=scenarioAssumptions(plan).assumptions;
  const [gain,setGain]=useState(String(initial.gain)),[response,setResponse]=useState(String(initial.response)),[attendance,setAttendance]=useState(String(initial.attendance)),[error,setError]=useState('');
  const unit=goalUnit(config.metric,config.goalUnit),simulation=goal.scenario;
  const personal=observedGain(plan,comparison);
  const edited=(numeric(gain)!==initial.gain||numeric(response)!==initial.response||numeric(attendance)!==initial.attendance);
  const pct=(p:number)=>p>0&&p<.01?'< 1 %':p<1&&p>.99?'> 99 %':new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:0}).format(p);
  async function save(e:FormEvent){e.preventDefault();setError('');try{
    const c=checkConfig({...config,scenario:{dose:currentKey,gain:numeric(gain),response:numeric(response),attendance:numeric(attendance)}});
    await onSave(c);
  }catch(reason){setError(errorText(reason,l));}}
  return <section className={s.card}><div className={s.heading}><TrendingUp size={21}/><h2>{l('Goal scenario','Scénario de réussite','سيناريو بلوغ الهدف')}</h2></div>
    <p>{config.exercise} · <bdi>{doseText(prescription,l,locale)} · {config.minutes} min</bdi> · {config.days} {l('sessions/week','séances/semaine','جلسات أسبوعيًا')}</p>
    {simulation&&<div className={s.forecast}><strong><bdi>{pct(simulation.p)}</bdi></strong><span>{edited?l('Last calculated scenario','Dernier scénario calculé','آخر سيناريو محسوب'):simulation.source==='illustrative'?l('Starting scenario · editable assumptions','Scénario initial · hypothèses modifiables','سيناريو البداية · افتراضات قابلة للتعديل'):l('Chance under your assumptions','Probabilité selon tes hypothèses','الاحتمال وفق افتراضاتك')}</span><p>{l('Effective sessions needed','Séances efficaces nécessaires','الجلسات الفعّالة المطلوبة')} <b>{simulation.required}</b> · {l('scheduled before the deadline','prévues d’ici l’échéance','المجدولة حتى الموعد')} <b>{simulation.sessions}</b></p><small>{l('If the response assumption changes by ±10 percentage points','Si l’hypothèse de réponse varie de ±10 points','إذا تغير افتراض الاستجابة بمقدار ±10 نقاط')} · <bdi>{pct(simulation.low)} – {pct(simulation.high)}</bdi></small></div>}
    {simulation?.source==='illustrative'&&<p>{l('This example starts with 80% attendance, a 50% chance of a gain at each completed session and a gain of about 1% of your baseline, rounded to a measurable step. You can change each input.','Cet exemple suppose 80 % de présence, une chance sur deux de progresser à chaque séance réalisée et un gain proche de 1 % de ton niveau initial, arrondi à un pas mesurable. Tu peux ajuster chaque valeur.','يفترض هذا المثال حضور ٨٠٪ من الجلسات وفرصة تحسّن قدرها ٥٠٪ في كل جلسة مكتملة ومكسبًا يساوي نحو ١٪ من نتيجة البداية مقربًا إلى خطوة قابلة للقياس. يمكنك تعديل كل افتراض.')}</p>}
    {!simulation&&<p>{l('This date is outside the supported simulation period.','Cette date dépasse la période de simulation prise en charge.','يقع التاريخ خارج الفترة التي تغطيها المحاكاة.')}</p>}
    {goal.atTargetPercent!==null&&<p>{l('Overall TOP1 game position if you reach the target','Position globale dans le jeu TOP1 si tu atteins la cible','ترتيب TOP1 الإجمالي في اللعبة إذا حققت الهدف')} · <bdi>{new Intl.NumberFormat(locale,{maximumSignificantDigits:2}).format(goal.atTargetPercent)}%</bdi></p>}
    <form onSubmit={save}><fieldset className={s.fields} disabled={blocked}>
      {decimalField(l('Gain per effective session','Gain par séance efficace','التحسن في كل جلسة فعّالة')+' · '+t(config.metric==='run_5k'?'min':unit),'gain',gain,setGain)}
      {personal&&<div className={s.observed}><p>{l('Observed change across two comparable tests','Évolution entre deux tests comparables','التغير بين اختبارين قابلين للمقارنة')} · <bdi>{new Intl.NumberFormat(locale,{maximumFractionDigits:3}).format(personal.delta)} {t(config.metric==='run_5k'?'min':unit)}</bdi> · {personal.count} {l('logged sessions at this dose','séances consignées à cette dose','جلسات مسجلة بهذه الجرعة')}. {l('Other training and test variation may contribute.','Les autres entraînements et la variabilité du test peuvent y contribuer.','قد تسهم التدريبات الأخرى وتباين الاختبار في هذا التغير.')}</p><button className={s.link} type="button" onClick={()=>setGain(String(personal.gain))}>{l('Use as my gain assumption','Utiliser comme hypothèse de gain','استخدمه كافتراض للتحسن')} · <bdi>{new Intl.NumberFormat(locale,{maximumFractionDigits:3}).format(personal.gain)} {t(config.metric==='run_5k'?'min':unit)}</bdi></button></div>}
      <div className={s.pair}>{decimalField(l('Chance of gaining this amount if completed (%)','Chance de ce gain si réalisée (%)','فرصة هذا التحسن عند الإنجاز (%)'),'response',response,setResponse)}{decimalField(l('Chance of completing a planned session (%)','Chance de réaliser une séance prévue (%)','احتمال إنجاز جلسة مقررة (%)'),'attendance',attendance,setAttendance)}</div>
      {ratio!==undefined&&<button type="button" className={s.link} onClick={()=>setAttendance(String(Number(ratio.toFixed(1))))}>{l('Use completion among logged sessions','Utiliser la réalisation des séances renseignées','استخدم نسبة الإنجاز في الجلسات المسجلة')} · {pct(ratio/100)} ({observed.length})</button>}
      {error&&<p role="alert" className={s.error}>{error}</p>}<button type="submit" className={s.primary}>{l('Calculate scenario','Calculer le scénario','احسب السيناريو')}<ArrowRight size={16}/></button>
    </fieldset></form>
    <details className={s.explainer}><summary>{l('Assumptions and uncertainty','Hypothèses et incertitude','الافتراضات وعدم اليقين')}</summary><p>{l('Each scheduled session is independent. A session either adds your chosen gain toward the target or leaves it unchanged. Its chance of adding that gain equals attendance × response. The model assumes a constant dose, no regression and no change in response over time.','Chaque séance planifiée est indépendante. Elle apporte le gain choisi vers la cible ou laisse le résultat identique. Sa probabilité de gain est égale à la réalisation × la réponse. Le modèle suppose une dose constante, aucune régression et une réponse stable dans le temps.','كل جلسة مجدولة مستقلة. إما أن تضيف التحسن الذي حددته نحو الهدف أو تبقي النتيجة ثابتة. احتمال التحسن يساوي الحضور × الاستجابة. يفترض النموذج جرعة ثابتة وغياب التراجع وثبات الاستجابة بمرور الوقت.')}</p><p>{l('The percentage reflects your scenario inputs. Personal physiological response remains uncalibrated.','Le pourcentage dépend de tes hypothèses. La réponse physiologique individuelle reste à valider.','تعتمد النسبة على افتراضاتك. تبقى الاستجابة الجسدية الفردية بحاجة إلى التحقق.')}</p><a href={binomialSource} target="_blank" rel="noreferrer">{l('Binomial model · NIST','Modèle binomial · NIST','النموذج الثنائي · NIST')}</a></details>
  </section>;
}
export default function AdaptiveProgram({owner,initialMetric,initialTarget,onTierHandled,training,workspace,values,profile,details,guestEntries,recommendationEntries,measurementRevision=0,onBrowse,onRecord}:Props){
  const {l,t,locale}=useCopy(),plans=useMemo(()=>adaptivePlans(training.ledger.events,undefined,true),[training.ledger.events]);
  const suggestedWorkspace=useMemo(()=>({...workspace.data,context:programContextFromHistory(workspace.data.context,training.ledger.events)}),[workspace.data,training.ledger.events]);
  const activePlans=useMemo(()=>currentAdaptivePlans(training.ledger.events),[training.ledger.events]);
  const activeConfigs=useMemo(()=>activePlans.map(p=>p.config),[activePlans]);
  const manualWeekdays=useMemo(()=>Object.fromEntries(activePlans.filter(p=>p.config.guidedVersion!==1).map(p=>[p.config.metric,(p.event.data as TrainingProgram).sessions[0].weekdays])),[activePlans]);
  const [selectedId,setSelectedId]=useState(''),[confirmStop,setConfirmStop]=useState<'goal'|'all'|null>(null);
  const plan=activePlans.find(p=>p.event.id===selectedId)??activePlans.find(p=>p.config.metric===initialMetric)??activePlans[0];
  const earlier=useMemo(()=>plans.filter(p=>!activePlans.some(active=>active.event.id===p.event.id)),[plans,activePlans]);
  const [screen,setScreen]=useState<'entry'|'program'|'edit'|'new'>('entry'),[logging,setLogging]=useState(false),[tab,setTab]=useState<'session'|'scenario'>('session'),[notice,setNotice]=useState('');
  const history=useRetests(owner,plan?.config.guidedVersion===1?undefined:plan?.config.metric,guestEntries,measurementRevision);
  const blocked=training.busy||!training.ready||!!training.error||training.ledger.pending.length>0;
  const requested=goalMetrics.find(m=>m.id===initialMetric)?.id;
  const matchesCurrentGoal=plan?.config.metric===requested&&(initialTarget===undefined||
    (plan?.config.goalUnit==='metric'&&Number(plan.config.target.toFixed(3))===initialTarget&&plan.config.deadline>=dayInZone(new Date(),plan.event.data.timeZone)));
  const editRequested=screen==='entry'&&!!requested&&plan?.config.metric===requested&&!matchesCurrentGoal&&initialTarget!==undefined;
  const isEditing=screen==='edit'||editRequested;
  const openNew=screen==='new'||(screen==='entry'&&!!requested&&!matchesCurrentGoal&&!editRequested);
  const effective=openNew?null:plan;
  useEffect(()=>{
    if(screen==='entry'&&initialTarget!==undefined&&matchesCurrentGoal&&requested)onTierHandled?.(requested);
  },[screen,initialTarget,matchesCurrentGoal,requested,onTierHandled]);
  async function save(c:AdaptiveConfig){
    if(blocked)return false;
    const program=effective?.event.data as TrainingProgram|undefined;
    const timeZone=program?.timeZone??workspace.data.context.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone;
    let ok:boolean;
    if(effective&&c.groupId&&activePlans.length>1){
      const configs=c.guidedVersion===1?replanPortfolioDates(activeConfigs,c,today,lockedMetrics):
        replanMixedManualGoal(activeConfigs,c,today,timeZone,suggestedWorkspace.context,manualWeekdays,lockedMetrics);
      const changes:TrainingMutation[]=activePlans.flatMap((sibling,index)=>{
        if(JSON.stringify(configs[index])===JSON.stringify(sibling.config))return [];
        return [{kind:'program',version:1,id:sibling.event.id,requestId:crypto.randomUUID(),deleted:false,reason:'',expectedRevision:sibling.event.revision,
          epoch:training.ledger.epoch,data:buildProgram(configs[index],sibling.event.data.timeZone,sibling.event.data as TrainingProgram)}];
      });
      ok=!changes.length||await training.putMany(changes);
    }else{
      ok=await training.put({kind:'program',version:1,id:effective?.event.id??crypto.randomUUID(),requestId:crypto.randomUUID(),deleted:false,reason:'',expectedRevision:effective?.event.revision??0,epoch:training.ledger.epoch,data:buildProgram(c,timeZone,program)});
    }
    if(ok){captureEvent('goal_saved',{metric_id:c.metric});if(!effective)setTab(c.guidedVersion===1?'session':'scenario');if(initialTarget!==undefined)onTierHandled?.(c.metric);setScreen('program');setNotice(l('Program saved.','Programme enregistré.','تم حفظ البرنامج.'));}
    if(!ok)recordJourneyAction('goal_save_failed',c.metric);
    return ok;
  }
  async function saveGroup(configs:AdaptiveConfig[],revised:AdaptiveConfig[]=[]){
    if(blocked||!configs.length)return false;
    const groupId=activePlans.find(p=>p.config.groupId)?.config.groupId??crypto.randomUUID(),zone=activePlans[0]?.event.data.timeZone??workspace.data.context.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone;
    const updates:TrainingMutation[]=activePlans.flatMap(p=>{
      const config={...(revised.find(change=>change.metric===p.config.metric)??p.config),groupId};
      if(JSON.stringify(config)===JSON.stringify(p.config))return [];
      return [{kind:'program',version:1,id:p.event.id,requestId:crypto.randomUUID(),deleted:false,reason:'',expectedRevision:p.event.revision,
        epoch:training.ledger.epoch,data:buildProgram(config,p.event.data.timeZone,p.event.data as TrainingProgram)}];
    });
    const additions:TrainingMutation[]=configs.map(config=>({kind:'program',version:1,id:crypto.randomUUID(),requestId:crypto.randomUUID(),deleted:false,reason:'',expectedRevision:0,
      epoch:training.ledger.epoch,data:buildProgram({...config,groupId},zone)}));
    const ok=await training.putMany([...updates,...additions]);
    for(const c of configs)if(ok)captureEvent('goal_saved',{metric_id:c.metric});else recordJourneyAction('goal_save_failed',c.metric);
    if(ok){setSelectedId(additions[0].id);setTab('session');setScreen('program');setNotice('');if(initialTarget!==undefined&&requested)onTierHandled?.(requested);}
    return ok;
  }
  async function applyCheckInSignals(day:string,items:CheckIn[]){
    if(!workspace.editable)return;
    const withSignal=items.find(item=>item.signal?.reasonKind);
    if(!withSignal?.signal)return;
    const sig=withSignal.signal;
    if(sig.reasonKind==='time'&&sig.timeScope==='weekday'&&sig.shortMinutes){
      const wd=isoWeekdayForDay(day);
      const nextDay=addDays(day,7);
      const draft=applyWeekdayMinutesRule(workspace.data,{weekday:wd,minutes:sig.shortMinutes,clearDateOverride:day});
      const draftDossier=buildAthleteDossier({owner,profile,values,details,observations:recommendationEntries,workspace:draft,trainingEvents:training.ledger.events,timeZone:zone});
      const preview=selectNextSessionDecision(draftDossier,{plan:withSignal.plan,targetDay:nextDay,allPlans:activePlans});
      const updated=applyWeekdayMinutesRule(workspace.data,{weekday:wd,minutes:sig.shortMinutes,clearDateOverride:day,decision:toStoredDecision(preview,locale)});
      await workspace.save(updated,workspace.revision,'context');
    }else if(sig.reasonKind==='discomfort'&&sig.discomfort){
      const nextSessionDay=datedProgram(withSignal.plan).weeks.flatMap(w=>w.sessions).find(row=>row.date>day)?.date;
      if(nextSessionDay){
        const draft=applyDayAvailabilityOverride(workspace.data,{date:nextSessionDay,discomfort:{severity:sig.discomfort},reason:`Discomfort reported on ${day}`});
        const draftDossier=buildAthleteDossier({owner,profile,values,details,observations:recommendationEntries,workspace:draft,trainingEvents:training.ledger.events,timeZone:zone});
        const preview=selectNextSessionDecision(draftDossier,{plan:withSignal.plan,targetDay:nextSessionDay,allPlans:activePlans});
        const updated=applyDayAvailabilityOverride(workspace.data,{date:nextSessionDay,discomfort:{severity:sig.discomfort},reason:`Discomfort reported on ${day}`,decision:toStoredDecision(preview,locale)});
        await workspace.save(updated,workspace.revision,'context');
      }
    }
  }
  async function logGroup(day:string,items:CheckIn[]){
    if(blocked||!items.length)return false;
    const changes:TrainingMutation[]=await Promise.all(items.map(async({plan:item,actual,signal})=>{
      const sigKey=actual?`${actual.sets}x${actual.amount}@${actual.loadKg}/${actual.minutes}/${actual.substitution?.name??''}`:`skip:${signal?.reasonKind??''}`;
      return {
        kind:'workout' as const,version:1 as const,id:await workoutId(item.event.id,day),
        requestId:await deterministicRequestId(['checkin',item.event.id,day,'0',sigKey]),
        deleted:false,reason:'',expectedRevision:0,epoch:training.ledger.epoch,
        data:makeWorkout(planForSession(training.ledger.events,item,day,actual?.endedAt),day,actual,new Date(),signal?.reasonKind)
      };
    }));
    const ok=await training.putMany(changes);
    for(const item of items)if(ok&&item.actual)captureEvent('workout_logged',{metric_id:item.plan.config.metric});else recordJourneyAction(ok?'workout_skipped':'workout_save_failed',item.plan.config.metric);
    if(ok){
      await applyCheckInSignals(day,items);
      setNotice(l('Workout saved.','Séance enregistrée.','تم حفظ الحصة.'));
    }
    return ok;
  }
  async function correctGroup(day:string,items:CheckIn[],reason:string){
    if(blocked||!items.length)return false;
    const changes:TrainingMutation[]=await Promise.all(items.map(async({plan:item,actual,existingEvent})=>{
      if(!existingEvent)throw Error('actual');
      const sigKey=actual?`${actual.sets}x${actual.amount}@${actual.loadKg}/${actual.minutes}/${actual.substitution?.name??''}`:'skip';
      return {
        kind:'workout' as const,version:1 as const,id:existingEvent.id,
        requestId:await deterministicRequestId(['correct',existingEvent.id,day,String(existingEvent.revision),sigKey,reason]),
        deleted:false,reason,expectedRevision:existingEvent.revision,epoch:training.ledger.epoch,
        data:correctWorkout(existingEvent,item,actual,reason)
      };
    }));
    const ok=await training.putMany(changes);
    if(ok)setNotice(l('Check-in corrected. Attendance and forecast updated.','Séance corrigée. Assiduité et estimation mises à jour.','تم تصحيح التسجيل وتحديث الالتزام والتقدير.'));
    return ok;
  }
  const stopSignature=useRef('');
  function requestStop(scope:'goal'|'all'){
    if(!plan)return;
    stopSignature.current=(scope==='all'?activePlans:[plan]).map(p=>p.event.id+'@'+p.event.revision).sort().join('/');
    setConfirmStop(scope);
  }
  async function stop(scope:'goal'|'all'){
    if(blocked||!plan||confirmStop!==scope)return;
    const selected=scope==='all'?activePlans:[plan];
    if(selected.map(p=>p.event.id+'@'+p.event.revision).sort().join('/')!==stopSignature.current){
      setConfirmStop(null);setNotice(l('The programme changed. Review the goals before stopping.','Le programme a changé. Vérifie les objectifs avant de les arrêter.','تغيّر البرنامج. راجع الأهداف قبل الإيقاف.'));return;
    }
    const changes:TrainingMutation[]=selected.map(p=>({kind:'program',version:1,id:p.event.id,requestId:crypto.randomUUID(),deleted:false,reason:'',expectedRevision:p.event.revision,
      epoch:training.ledger.epoch,data:{...p.event.data as TrainingProgram,archived:true}}));
    const ok=await training.putMany(changes);
    if(ok){setSelectedId('');setConfirmStop(null);setScreen('program');setLogging(false);
      setNotice(scope==='all'?l('Programme stopped.','Programme arrêté.','تم إيقاف البرنامج.'):l('Goal stopped.','Objectif arrêté.','تم إيقاف الهدف.'));}
  }
  function openRetest(metricId:string,unit:GoalUnit) {
    recordJourneyAction('goal_retest_opened',metricId);
    onRecord(metricId,unit);
  }
  async function log(day:string,actual:PerformedSession|null){
    if(blocked||!plan)return false;
    const data=makeWorkout(planForSession(training.ledger.events,plan,day,actual?.endedAt),day,actual);
    const ok=await training.put({kind:'workout',version:1,id:await workoutId(plan.event.id,day),requestId:crypto.randomUUID(),deleted:false,reason:'',expectedRevision:0,epoch:training.ledger.epoch,data});
    if(ok&&actual)captureEvent('workout_logged',{metric_id:plan.config.metric});
    else recordJourneyAction(ok?'workout_skipped':'workout_save_failed',plan.config.metric);
    if(ok)setNotice(l('Session logged. Your next session has been updated.','Séance enregistrée. La prochaine séance a été ajustée.','سُجّلت الجلسة وحُدّثت الجلسة القادمة.'));
    return ok;
  }
  const zone=plan?.event.data.timeZone??'UTC';
  const [clockDay,setClockDay]=useState('');
  useEffect(()=>{
    const update=()=>setClockDay(dayInZone(new Date(),zone));
    update();const timer=setInterval(update,60000);
    return ()=>clearInterval(timer);
  },[zone]);
  const today=clockDay||dayInZone(new Date(),zone),config=plan?.config,metric=goalMetrics.find(m=>m.id===config?.metric),unit=config?t(goalUnit(config.metric,config.goalUnit)):'';
  const tracking=useGoalTracking(owner,training.ledger,guestEntries,measurementRevision,today,training.ready);
  const lockedMetrics=useMemo(()=>new Set(activePlans.filter(p=>today>p.config.deadline||tracking.attempts?.some(a=>
    a.planId===p.event.id&&a.status==='reached'&&a.target===p.config.target&&a.deadline===p.config.deadline)).map(p=>p.config.metric)),[activePlans,today,tracking.attempts]);
  const tracked=tracking.attempts?.find(a=>a.planId===plan?.event.id&&a.status!=='superseded'&&a.target===config?.target&&a.deadline===config?.deadline&&a.metric===config?.metric&&a.goalUnit===config?.goalUnit);
  const past=tracking.attempts?.filter(a=>!activePlans.some(p=>p.event.id===a.planId&&a.status!=='superseded'&&p.config.target===a.target&&p.config.deadline===a.deadline))??[];
  const insights=usePerformanceInsights({owner,revision:measurementRevision,values,details:details??{},profile,plan,guestEntries,today,enabled:!!plan});
  const goal=insights.data?.goal?.planId===plan?.event.id?insights.data?.goal:null;
  const calibration=tracked?.status==='active'?(savedGoalCalibration(tracking.calibrations.find(c=>c.planId===plan?.event.id),plan,goal?.adherence?.probability)??insights.calibration):undefined;
  const observed=history.latest&&config&&Date.parse(observationDate(history.latest))>=Date.parse(config.createdAt)?history.latest:undefined;
  const guided=config?.guidedVersion===1;
  const expired=!!config&&today>config.deadline;
  const legacyMeasurement=observed&&metric&&config?goalValue(metric,config.goalUnit,observed.value??undefined,observed):undefined;
  const measured=tracked?tracked.latestComparableValue??tracked.observedValue??undefined:guided
    ?(!expired&&goal?.current!==config?.baseline?goal?.current:undefined)
    :legacyMeasurement;
  const current=measured??config?.baseline??0;
  const complete=tracked?tracked.status==='reached':!guided&&!!metric&&!!config&&(current-config.target)*metric.polarity>=0;
  const closed=expired||complete;
  const goalFraction=config?Math.max(0,Math.min(1,(current-config.baseline)/(config.target-config.baseline))):0;
  const remaining=config&&metric?Math.max(0,(config.target-current)*metric.polarity):0;
  const progressBar=metric&&config&&<div className={s.progressSummary}>
    <small><span>{l('Measured progress','Progression mesurée','التقدم المقاس')}</span><span>{l('Remaining','À gagner','المتبقي')} · <bdi>{resultText(remaining,metric.id,locale)} {unit}</bdi></span></small>
    <div className={s.liveProgress} role="progressbar" aria-label={l('Goal progress','Progression vers la cible','التقدم نحو الهدف')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(goalFraction*100)}><span style={{transform:'scaleX('+goalFraction+')'}}/></div>
  </div>;
  const full=!!plan&&!openNew&&!isEditing;
  const calendarItems=useMemo(()=>{
    const guidedItems:CalendarPlan[]=activePlans.filter(p=>p.config.guidedVersion===1).map(p=>{
      const outcome=tracking.attempts?.find(a=>a.planId===p.event.id&&a.status==='reached'&&a.target===p.config.target&&a.deadline===p.config.deadline);
      return {id:p.event.id,plan:p,config:p.config,schedule:datedProgram(p),through:outcome?.reachedOn??undefined};
    });
    if(!guidedItems.length)return [];
    const start=guidedItems.map(p=>p.config.scheduleStart!).sort()[0],end=guidedItems.map(p=>p.through??p.config.deadline).sort().at(-1)!;
    const manual=activePlans.filter(p=>p.config.guidedVersion!==1&&p.config.deadline>=start).map(p=>manualCalendarItem(p,training.ledger.events,start,end));
    return [...guidedItems,...manual];
  },[activePlans,tracking.attempts,training.ledger.events]);
  const loggedDays=new Set(plan?.sessions.map(event=>sessionResult(event.data as Workout)?.day));
  const loggedToday=loggedDays.has(today);
  const dossier=useMemo(()=>buildAthleteDossier({
    owner,profile,values,details,observations:recommendationEntries,workspace:workspace.data,trainingEvents:training.ledger.events,timeZone:zone,
  }),[owner,profile,values,details,recommendationEntries,workspace.data,training.ledger.events,zone]);
  const selectedCalendar=useMemo(()=>plan&&plan.config.guidedVersion===1?datedProgram(plan):undefined,[plan]);
  const nextSessionDay=useMemo(()=>{
    if(!plan||closed)return undefined;
    if(selectedCalendar){
      const next=selectedCalendar.weeks.flatMap(w=>w.sessions).find(row=>row.date>today||(row.date===today&&(!loggedToday||row.kind==='retest')));
      return next?.date;
    }
    return today;
  },[plan,closed,selectedCalendar,today,loggedToday]);
  const nextDecision=useMemo(()=>plan&&nextSessionDay?selectNextSessionDecision(dossier,{
    plan,targetDay:nextSessionDay,calendar:selectedCalendar,allPlans:activePlans,
  }):null,[plan,nextSessionDay,dossier,selectedCalendar,activePlans]);
  const decisionForCalendar=useMemo(()=>(targetPlan:AdaptivePlan,day:string)=>{
    const item=calendarItems.find(entry=>entry.id===targetPlan.event.id);
    const cal=item&&targetPlan.config.guidedVersion===1?(item.schedule as ReturnType<typeof datedProgram>):undefined;
    return selectNextSessionDecision(dossier,{plan:targetPlan,targetDay:day,calendar:cal,allPlans:activePlans});
  },[dossier,calendarItems,activePlans]);
  const maintenancePlan=useMemo(()=>plan&&tracked&&tracked.status==='reached'?buildMaintenancePlan({
    attempt:tracked,plan,dossier,today,
  }):null,[plan,tracked,dossier,today]);
  const supportingWins=useMemo(()=>suggestSupportingWins({
    dossier,activeGoalMetrics:activePlans.map(p=>p.config.metric),
  }),[dossier,activePlans]);
  const personalLearning=useMemo(()=>plan?evaluatePersonalLearning({
    dossier,plan,observations:recommendationEntries,priorGainPerSession:illustrativeGain(plan.config),
  }):null,[dossier,plan,recommendationEntries]);
  const [dismissedCalSuggestion,setDismissedCalSuggestion]=useState(false);
  const editContext=useMemo(()=>isEditing&&guided?{
    goal,current:tracked?current:goal?.current,loggedToday,availableConfigs:activeConfigs,lockedMetrics,
    revise:plan?.config.groupId&&activePlans.length>1?(c:AdaptiveConfig)=>replanPortfolioDates(activePlans.map(p=>p.config),c,today,lockedMetrics).find(item=>item.metric===c.metric)!:undefined,
    fullHistory:owner==='guest'?{values,details:details??{},profile,entries:guestEntries}:undefined,
  }:undefined,[isEditing,guided,goal,tracked,current,loggedToday,owner,values,details,profile,guestEntries,activePlans,activeConfigs,plan,today,lockedMetrics]);
  const cancel=plan?()=>{if(initialTarget!==undefined)onTierHandled?.(plan.config.metric);setScreen('program');}:undefined;
  return <div className={s.planner}>
    {training.busy&&!training.ready&&<p role="status">{l('Loading program…','Chargement du programme…','جارٍ تحميل البرنامج…')}</p>}
    {(training.error||training.ledger.pending.length>0)&&<div className={s.card} role="alert"><p>{training.ledger.pending.length?l('A saved change is waiting to sync.','Une modification est en attente de synchronisation.','هناك تغيير محفوظ ينتظر المزامنة.'):l('The training journal could not be loaded or saved.','La lecture ou l’enregistrement du journal a échoué.','تعذرت قراءة سجل التدريب أو حفظه.')}</p><div className={s.actions}><button className={s.secondary} onClick={()=>void (training.ledger.pending.length?training.retry():training.refresh())}>{t('Retry')}</button>{training.ledger.pending.length>0&&<button className={s.secondary} onClick={()=>void training.discard()}>{l('Discard pending change','Abandonner la modification en attente','تجاهل التغيير المعلق')}</button>}</div></div>}
    {notice&&<p className={s.notice} role="status">{notice}</p>}
    {!full&&training.ready&&(workspace.ready||!!workspace.error)&&(isEditing&&effective&&effective.config.guidedVersion!==1
      ?<ConfigForm key={effective.event.id} plan={effective} latest={current} workspace={workspace} values={values} details={details} blocked={blocked} onSave={save} onCancel={cancel}/>
      :<GuidedProgram key={screen+':'+(effective?.event.id??'new')} existing={isEditing&&effective?effective:undefined} editContext={editContext}
        initialMetric={screen==='entry'?requested:undefined} initialTarget={screen==='entry'?initialTarget:undefined}
        workspace={isEditing?workspace.data:suggestedWorkspace} currentConfigs={openNew&&activePlans.length?activeConfigs:undefined} lockedMetrics={lockedMetrics} manualWeekdays={manualWeekdays} values={values} profile={profile} details={details??{}} observations={recommendationEntries}
        busy={blocked} onBrowse={onBrowse} onCancel={cancel} save={save} saveGroup={saveGroup}/>)}
    {full&&activePlans.length>1&&<div className={s.goalNav} aria-label={l('Programme goals','Objectifs du programme','أهداف البرنامج')}>{activePlans.map(p=><button type="button" key={p.event.id}
        aria-pressed={p.event.id===plan.event.id} onClick={()=>{setSelectedId(p.event.id);setConfirmStop(null);setLogging(false);}}>{t(goalMetrics.find(m=>m.id===p.config.metric)?.name??p.config.metric)}</button>)}</div>}
    {full&&guided&&plan&&config&&metric&&<>
      <section className={s.goal}><div className={s.heading}><Target size={20}/><h2>{t(metric.name)}</h2>{!closed&&<button type="button" className={s.icon} aria-label={l('Edit goal','Modifier l’objectif','تعديل الهدف')} onClick={()=>setScreen('edit')}><Settings2 size={18}/></button>}</div>
        <div className={s.groupNumbers}><div><small>{tracked?.latestComparableOn?l('Latest comparable test','Dernier test comparable','أحدث اختبار مماثل'):measured===undefined?l('Starting result','Résultat de départ','نتيجة البداية'):l('Latest result','Dernier résultat','أحدث نتيجة')} → {l('Target','Cible','الهدف')}</small><bdi>{resultText(current,metric.id,locale)} → {resultText(config.target,metric.id,locale)} {unit}</bdi><small><time dateTime={config.deadline}>{new Date(config.deadline+'T12:00:00Z').toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric',calendar:'gregory',timeZone:'UTC'})}</time></small></div>
          {!closed&&(goal?.adherence||insights.loading||insights.failed)&&<div><strong><bdi>{goal?.adherence?probabilityLabel(calibration?.probability??goal.adherence.probability,locale):'—'}</bdi></strong><small>{l('If you follow the plan','Si tu suis le programme','عند الالتزام بالخطة')}</small></div>}
        </div>
        {progressBar}
        {closed&&tracked&&<strong>{tracked.status==='reached'?l('Reached on time','Atteint à temps','تحقق في الموعد')+(tracked.reachedOn?' · '+new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',calendar:'gregory',timeZone:'UTC'}).format(new Date(tracked.reachedOn+'T12:00Z')):''):tracked.status==='missed'?l('Target missed','Cible manquée','لم يتحقق الهدف'):l('Final result unconfirmed','Résultat final non confirmé','النتيجة النهائية غير مؤكدة')}</strong>}
        {!closed&&<ProgrammePace pace={goal?.recentPace}/>}
        {tracked&&<details className={s.explainer}><summary>{l('Goal result and attendance','Résultat et assiduité','نتيجة الهدف والالتزام')}</summary><CurrentGoalResult attempt={tracked} today={today} onRecord={openRetest}/></details>}
        {!closed&&<details className={s.explainer}><summary>{calibration?l('Estimate adjusted using shared outcomes','Estimation ajustée selon les résultats partagés','تقدير معدل باستخدام النتائج المشتركة'):l('About this estimate','À propos de cette estimation','حول هذا التقدير')}</summary>
          {insights.failed?<button type="button" className={s.link} onClick={insights.retry}>{t('Retry')}</button>:insights.loading?<p role="status">{l('Loading…','Chargement…','جارٍ التحميل…')}</p>:<AdherenceEstimate estimate={goal?.adherence??null} calibration={calibration} unit={config.goalUnit==='kg'?'kg':metric.unit}/>}</details>}
        <button type="button" className={s.link} onClick={()=>openRetest(metric.id,config.goalUnit)}>{l('Record a test result','Enregistrer un résultat de test','تسجيل نتيجة اختبار')}<ArrowRight size={14}/></button>
      </section>
      {maintenancePlan&&<MaintenanceCard plan={maintenancePlan} onRetest={openRetest} onOptionalNewGoal={()=>{setNotice('');setScreen('new');}}/>}
      {!closed&&personalLearning?.calendarSuggestion&&!dismissedCalSuggestion&&<section className={s.card} aria-label={l('Schedule learning suggestion','Suggestion du coach','اقتراح جدول')}>
        <p className={s.coachSentence}>{personalLearning.calendarSuggestion.prompt[locale==='fr'?1:locale==='ar'?2:0]}</p>
        <div className={s.actions}>
          <button type="button" className={s.primary} disabled={!workspace.editable||blocked} onClick={async()=>{
            const sug=personalLearning.calendarSuggestion!;
            const updated=applyWeekdayMinutesRule(workspace.data,{weekday:sug.weekday,minutes:sug.suggestedMinutes});
            if(await workspace.save(updated,workspace.revision,'context')){setDismissedCalSuggestion(true);setNotice(l('Weekly schedule updated from your attendance pattern.','Planning hebdomadaire mis à jour selon ton rythme.','تم تحديث الجدول الأسبوعي وفق نمط حضورك.'));}
          }}>{l('Apply schedule update','Appliquer','تطبيق')}</button>
          <button type="button" className={s.link} onClick={()=>setDismissedCalSuggestion(true)}>{l('Keep current schedule','Garder le planning actuel','إبقاء الجدول الحالي')}</button>
        </div>
      </section>}
      {nextDecision&&!closed&&<CoachDecisionCard decision={nextDecision} dossier={dossier} plan={plan} calendar={selectedCalendar} allPlans={activePlans} workspace={workspace.data} editable={workspace.editable&&!blocked} onSaveWorkspace={next=>workspace.save(next,workspace.revision,'context')}/>}
      {!closed&&supportingWins.length>0&&<section className={s.card} aria-labelledby="supporting-wins-heading">
        <div className={s.heading}><TrendingUp size={19} aria-hidden="true"/><h2 id="supporting-wins-heading">{l('Supporting wins that fit your budget','Victoires complémentaires dans ton budget','مكاسب داعمة ضمن وقتك المتاح')}</h2></div>
        <div className={s.goalChoices}>{supportingWins.slice(0,2).map(win=>{
          const m=goalMetrics.find(item=>item.id===win.metric);
          if(!m)return null;
          return <button key={win.metric} type="button" onClick={()=>{setNotice('');setScreen('new');}}>
            <span><strong>{t(m.name)}</strong><small>{win.whyItFits[locale==='fr'?1:locale==='ar'?2:0]}</small></span>
            <ArrowRight size={15} aria-hidden="true"/>
          </button>;
        })}</div>
      </section>}
      <ProgrammeCalendar items={calendarItems} today={today} busy={blocked} decisionFor={decisionForCalendar} onRetest={c=>openRetest(c.metric,c.goalUnit)} onCheckIn={logGroup} onCorrectCheckIn={correctGroup}/>

    </>}
    {full&&!guided&&plan&&config&&metric&&<>
      <section className={s.goal}><div className={s.heading}><Target size={20}/><h2>{t(metric.name)}</h2><button className={s.icon} aria-label={l('Edit program','Modifier le programme','تعديل البرنامج')} onClick={()=>{setLogging(false);setScreen('edit');}}><Settings2 size={18}/></button></div>
        <div className={s.goalNums}><div><small>{measured===undefined?l('Starting result','Point de départ','نتيجة البداية'):l('Latest result','Dernier résultat','أحدث نتيجة')}</small><strong><bdi>{resultText(current,metric.id,locale)}</bdi> <em>{unit}</em></strong></div><ArrowRight size={22}/><div><small>{l('Target','Cible','الهدف')}</small><strong><bdi>{resultText(config.target,metric.id,locale)}</bdi> <em>{unit}</em></strong></div></div>
        {progressBar}
        <p className={s.date}><CalendarDays size={15}/><time dateTime={config.deadline}>{new Date(config.deadline+'T12:00Z').toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})}</time>{complete&&<b>{!tracked&&observed&&!observed.measuredAt?l('Target value recorded · test date unknown','Valeur cible saisie · date du test inconnue','سُجّلت قيمة الهدف · تاريخ الاختبار غير معروف'):!tracked&&observed&&dayInZone(new Date(observationDate(observed)),plan.event.data.timeZone)>config.deadline?l('Reached after deadline','Atteinte après échéance','تحقق بعد الموعد'):l('Target reached','Cible atteinte','تحقق الهدف')}</b>}</p>
        {tracked?.observedOn&&<small>{l('Test date','Date du test','تاريخ الاختبار')} · <time dateTime={tracked.observedOn}>{new Date(tracked.observedOn+'T12:00:00Z').toLocaleDateString(locale,{timeZone:'UTC',calendar:'gregory'})}</time></small>}
        {!tracked&&observed&&measured!==undefined&&<small>{observed.measuredAt?l('Test date','Date du test','تاريخ الاختبار'):l('Entry saved','Saisie enregistrée','تاريخ الحفظ')} · {new Date(observationDate(observed)).toLocaleDateString(locale)}</small>}
        {!tracked&&history.failed&&<p>{l('The retest history is unavailable. The starting value is shown.','L’historique des tests est indisponible. Le point de départ est affiché.','سجل الاختبارات غير متاح. تظهر نتيجة البداية.')}</p>}
        <button className={s.link} onClick={()=>openRetest(metric.id,config.goalUnit)}>{l('Record a test result','Enregistrer un résultat de test','تسجيل نتيجة اختبار')}<ArrowRight size={14}/></button>
      </section>
      {!closed&&<ProgrammePace pace={goal?.recentPace}/>}
      {tracked&&<CurrentGoalResult attempt={tracked} today={today} onRecord={openRetest}/>}
      {!closed&&<div className={s.tabs}><button aria-pressed={tab==='session'} onClick={()=>setTab('session')}><Dumbbell size={16}/>{l('Training','Séances','الجلسات')}</button><button aria-pressed={tab==='scenario'} onClick={()=>setTab('scenario')}><TrendingUp size={16}/>{l('Probability','Probabilité','الاحتمال')}</button></div>}
      {tab==='scenario'&&!closed?<><PersonalForecastPanel result={goal?.personal} loading={insights.loading} failed={insights.failed||(!insights.loading&&!goal)} retry={insights.retry}/>{goal&&<Probability key={plan.event.id+doseKey(config,plan.prescription)} plan={plan} goal={goal} comparison={history.comparison} blocked={blocked||!!history.pending||!!history.failed} onSave={save}/>}</>:<>
        {closed?<section className={s.card}><div className={s.heading}><Check size={21}/><h2>{tracked?l('Session log','Suivi des séances','تسجيل الجلسات'):complete?l('Goal completed','Objectif atteint','تم تحقيق الهدف'):l('Program ended','Programme terminé','انتهت مدة البرنامج')}</h2></div><p>{tracked?l('You can still log a past session using its training date.','Tu peux encore consigner une séance passée à sa date réelle.','ما زال بإمكانك تسجيل جلسة سابقة بتاريخها الفعلي.'):complete?l('Your recorded result reached your target.','Ton résultat enregistré atteint ta cible.','بلغت نتيجتك المسجلة الهدف.'):l('The target date has passed. You can still complete your journal for earlier sessions.','La date cible est passée. Tu peux compléter le journal des séances antérieures.','انقضى الموعد المحدد. يمكنك إكمال سجل الجلسات السابقة.')}</p>{!logging?<button className={s.secondary} disabled={blocked} onClick={()=>setLogging(true)}>{l('Log a past session','Consigner une séance passée','تسجيل جلسة سابقة')}</button>:<SessionForm plan={plan} events={training.ledger.events} blocked={blocked} submit={log} onCancel={()=>setLogging(false)}/>}</section>:<section className={s.card}><div className={s.heading}><Dumbbell size={21}/><h2>{l('Next session','Prochaine séance','الجلسة القادمة')}</h2></div>
          <p>{config.exercise}</p><strong className={s.dose}><bdi>{doseText(plan.prescription,l,locale)}</bdi></strong>
          <p>{config.days} {l('sessions a week','séances par semaine','جلسات أسبوعيًا')} · {config.minutes} min</p>
          <div className={s.week} aria-label={l('Scheduled weekdays','Jours prévus','أيام التدريب')} >{Array.from({length:7},(_,i)=><span key={i} data-active={(plan.event.data as TrainingProgram).sessions[0].weekdays.includes(i+1)}>{new Intl.DateTimeFormat(locale,{weekday:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2024,0,1+i)))}</span>)}</div>
          <p>{({initial:l('Your chosen starting session.','Ta séance de départ.','جلسة البداية التي اخترتها.'),missed:l('One fewer set after a missed session, with a minimum of one.','Après une séance manquée, une série en moins, avec un minimum d’une série.','مجموعة أقل بعد الجلسة الفائتة، بحد أدنى مجموعة واحدة.'),actual:l('Adjusted to the work you actually logged.','Ajustée aux séries, répétitions et charges que tu as réalisées.','عُدّلت وفق المجموعات والتكرارات والأوزان التي أنجزتها.'),progression:l('Two completed doses in a row. The next target adds one rep or five seconds per set.','Deux séances consécutives remplies. La cible augmente d’une répétition ou cinq secondes par série.','أتممت الكمية المخططة مرتين متتاليتين. يُضاف تكرار واحد أو خمس ثوانٍ لكل مجموعة.')})[plan.prescription.reason]}</p>
          {!logging?<button className={s.primary} disabled={blocked} onClick={()=>{setNotice('');setLogging(true);}}>{l('Log a session','Consigner une séance','سجّل جلسة')}<ArrowRight size={16}/></button>:<SessionForm plan={plan} events={training.ledger.events} blocked={blocked} submit={log} onCancel={()=>setLogging(false)}/>}
        </section>}
        {plan.sessions.length>0&&<section className={s.card}><div className={s.heading}><ClipboardList size={20}/><h2>{l('Training journal','Journal des séances','سجل الجلسات')}</h2></div><ol className={s.journal}>{plan.sessions.map(event=>{const w=event.data as Workout,report=sessionResult(w)!,a=actualDose(w);return <li key={event.id}><div><time dateTime={report.day}>{new Date(report.day+'T12:00Z').toLocaleDateString(locale,{timeZone:'UTC'})}</time><b>{a?l('Completed','Réalisée','مكتملة'):l('Missed','Manquée','فائتة')}</b></div><small>{l('Planned','Prévu','المخطط')} · <bdi>{doseText(report.dose,l,locale)}</bdi></small>{a&&<span>{l('Actual','Réalisé','الفعلي')} · <bdi>{doseText(a,l,locale)} · {report.minutes} min</bdi></span>}</li>;})}</ol></section>}

      </>}
    </>}
      {full&&!guided&&calendarItems.length>0&&<ProgrammeCalendar items={calendarItems} today={today} busy={blocked} onRetest={c=>openRetest(c.metric,c.goalUnit)} onCheckIn={logGroup}/>}
    {earlier.length>0&&!openNew&&!isEditing&&<details className={s.card}><summary>{l('Earlier training journals','Anciens journaux de séances','سجلات الجلسات السابقة')}</summary>{earlier.map(p=><div key={p.event.id} className={s.targetRow}><strong>{t(goalMetrics.find(m=>m.id===p.config.metric)?.name??p.config.metric)}</strong> · {p.config.deadline}<ol className={s.journal}>{p.sessions.map(event=>{const w=event.data as Workout,result=sessionResult(w),actual=actualDose(w);return <li key={event.id}>{result?.day} · {actual?doseText(actual,l,locale):l('Skipped','Passée','تم التخطي')}</li>;})}</ol></div>)}</details>}
    {full&&plan&&<section className={s.manage}><button className={s.secondary} type="button" disabled={blocked} onClick={()=>{setNotice('');setConfirmStop(null);setScreen('new');}}>{l('Add a goal','Ajouter un objectif','أضف هدفًا')}<ArrowRight size={15}/></button>
      <details className={s.explainer}><summary>{l('Manage programme','Gérer le programme','إدارة البرنامج')}</summary>
        {confirmStop?<div className={s.stopConfirm} role="group">
          <strong>{confirmStop==='all'?l('Stop the whole programme?','Arrêter tout le programme ?','إيقاف البرنامج بالكامل؟'):l('Stop this goal?','Arrêter cet objectif ?','إيقاف هذا الهدف؟')}</strong>
          <p>{(confirmStop==='all'?activePlans:[plan]).map(p=>t(goalMetrics.find(m=>m.id===p.config.metric)?.name??p.config.metric)).join(' · ')}</p>
          <p>{l('Your recorded workouts and results stay in your history.','Tes séances et résultats enregistrés restent dans ton historique.','تبقى حصصك ونتائجك المسجّلة في السجل.')}</p>
          <div className={s.actions}><button type="button" className={s.secondary} disabled={blocked} onClick={()=>setConfirmStop(null)}>{t('Cancel')}</button>
          <button type="button" className={s.danger} disabled={blocked} onClick={()=>void stop(confirmStop)}>{l('Confirm stop','Confirmer l’arrêt','تأكيد الإيقاف')}</button></div></div>:
          <div className={s.actions}><button type="button" className={s.link} disabled={blocked} onClick={()=>requestStop('goal')}>{l('Stop selected goal','Arrêter l’objectif sélectionné','إيقاف الهدف المحدد')}</button>
            {activePlans.length>1&&<button type="button" className={s.link} disabled={blocked} onClick={()=>requestStop('all')}>{l('Stop whole programme','Arrêter le programme entier','إيقاف البرنامج بالكامل')}</button>}</div>}
      </details></section>}
    {training.ready&&!openNew&&!isEditing&&<>
      {tracking.loading&&<p role="status">{l('Loading goal results…','Chargement des résultats…','جارٍ تحميل نتائج الأهداف…')}</p>}
      {tracking.failed&&<p role="status">{l('Goal results could not be loaded.','Impossible de charger les résultats des objectifs.','تعذّر تحميل نتائج الأهداف.')} <button type="button" className={s.link} onClick={tracking.retry}>{t('Retry')}</button></p>}
      <PastGoalResults attempts={past} today={today} onRecord={openRetest}/>
      {owner!=='guest'&&tracking.sharing!==undefined&&<GoalSharing sharing={tracking.sharing} busy={tracking.saving} failed={tracking.saveFailed} onChange={v=>void tracking.setSharing(v)}/>}
    </>}
  </div>;
}
