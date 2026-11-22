'use client';
import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {ArrowRight,CalendarDays,Check,ClipboardList,Dumbbell,Settings2,Target,TrendingUp} from 'lucide-react';
import {useTranslations} from './providers/LocaleProvider';
import {useRetests} from '@/lib/hooks/useRetests';
import PersonalForecastPanel from './PersonalForecastPanel';
import {observationDate,type Observation} from '@/lib/history';
import {isLift} from '@/lib/focusedEntry';
import {suggestStartingSession} from '@/lib/startingSession';
import {parseMeasurementInput} from '@/lib/measurementInput';
import {parseRunTime,formatRunTime} from '@/lib/run10kReference';
import type {Values} from '@/lib/registry';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
import type {WorkspaceState} from '@/lib/hooks/usePersonalWorkspace';
import type {AdaptiveTrainingState} from '@/lib/adaptiveProgramClient';
import {adaptivePlans,actualDose,addDays,buildProgram,checkConfig,dayInZone,doseKey,goalMetrics,goalValue,makeWorkout,planForSession,observedGain,scenarioResult,sessionResult,workoutId,type AdaptiveConfig,type AdaptivePlan,type Dose,type GoalUnit,type PerformedSession} from '@/lib/adaptiveProgram';
import type {TrainingEvent,TrainingProgram,Workout} from '@/lib/training';
import s from './AdaptiveProgram.module.css';

type Props={owner:string;initialMetric?:string;initialTarget?:number;onTierHandled?:(metric:string)=>void;measurementRevision?:number;training:AdaptiveTrainingState;workspace:WorkspaceState;values:Values;details?:MeasurementMetadata;guestEntries:Observation[];onRecord:(metric:string)=>void};
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
  if(code==='duration')return l('The timed sets must fit inside the session.','La durée des séries doit tenir dans la séance.','يجب أن تتسع مدة الجلسة للمجموعات.');
  if(code==='scenario')return l('Enter a positive gain and percentages between 0 and 100.','Indique un gain positif et des pourcentages entre 0 et 100.','أدخل تحسنًا موجبًا ونسبًا بين 0 و100.');
  return l('Check the exercise, sets, amount, load and session length.','Vérifie l’exercice, les séries, la charge et la durée de séance.','تحقق من التمرين والمجموعات والوزن ومدة الجلسة.');
}
function decimalField(label:string,name:string,value:string,onChange:(v:string)=>void,options:{integer?:boolean;clock?:boolean;disabled?:boolean;placeholder?:string;required?:boolean}={}){
  return <label>{label}<input name={name} type="text" inputMode={options.clock?'text':options.integer?'numeric':'decimal'} value={value} onChange={e=>onChange(e.target.value)} disabled={options.disabled} placeholder={options.placeholder} required={options.required!==false} maxLength={18}/></label>;
}
function ConfigForm({plan,initialMetric,initialTarget,workspace,values,details,blocked,onSave,onCancel}:{plan?:AdaptivePlan;initialMetric?:string;initialTarget?:number;workspace:WorkspaceState;values:Values;details?:MeasurementMetadata;blocked:boolean;onSave:(c:AdaptiveConfig)=>Promise<boolean>;onCancel?:()=>void}){
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
  const [deadline,setDeadline]=useState(existing?.deadline??(savedGoal?.date&&savedGoal.date>today?savedGoal.date:addDays(today,42)));
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
      <label>{l('Target date','Date cible','تاريخ الهدف')}<input type="date" name="deadline" value={deadline} min={addDays(today,1)} required onChange={e=>setDeadline(e.target.value)}/></label>
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
function SessionForm({plan,events,blocked,submit,onCancel}:{plan:AdaptivePlan;events:TrainingEvent[];blocked:boolean;submit:(day:string,actual:PerformedSession|null)=>Promise<boolean>;onCancel:()=>void}){
  const {l,locale}=useCopy(),today=dayInZone(new Date(),plan.event.data.timeZone),lastDay=today<plan.config.deadline?today:plan.config.deadline;
  const [kind,setKind]=useState<'done'|'missed'>('done'),[day,setDay]=useState(lastDay);
  const [end,setEnd]=useState(()=>today===lastDay?localDateTime(new Date()):lastDay+'T12:00');
  const instant=end?new Date(end):undefined,validInstant=instant&&Number.isFinite(instant.getTime())?instant:undefined;
  const selectedDay=kind==='done'&&validInstant?dayInZone(validInstant,plan.event.data.timeZone):day;
  const template=planForSession(events,plan,selectedDay,kind==='done'?validInstant?.toISOString():undefined);
  const d=template.prescription;
  const [sets,setSets]=useState(String(d.sets)),[amount,setAmount]=useState(String(d.amount)),[load,setLoad]=useState(String(d.loadKg)),[minutes,setMinutes]=useState(String(template.config.minutes)),[error,setError]=useState('');
  function changeEnd(raw:string){
    setEnd(raw);
    const date=new Date(raw);
    if(!Number.isFinite(date.getTime()))return;
    const updated=planForSession(events,plan,dayInZone(date,plan.event.data.timeZone),date.toISOString());
    setSets(String(updated.prescription.sets));setAmount(String(updated.prescription.amount));setLoad(String(updated.prescription.loadKg));setMinutes(String(updated.config.minutes));
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
function Probability({plan,current,today,blocked,onSave,comparison}:{comparison?:Observation[];plan:AdaptivePlan;current:number;today:string;blocked:boolean;onSave:(config:AdaptiveConfig)=>Promise<boolean>}){
  const {l,t,locale}=useCopy(),{config,prescription}=plan,observed=plan.sessions.filter(e=>sessionResult(e.data as Workout)?.routineId===config.routineId);
  const ratio=observed.length?100*observed.filter(e=>(e.data as Workout).status==='completed').length/observed.length:undefined;
  const currentKey=doseKey(config,prescription),initial=config.scenario?.dose===currentKey?config.scenario:undefined;
  const [gain,setGain]=useState(initial?String(initial.gain):''),[response,setResponse]=useState(initial?String(initial.response):''),[attendance,setAttendance]=useState(initial?String(initial.attendance):''),[error,setError]=useState('');
  const unit=goalUnit(config.metric,config.goalUnit),simulation=scenarioResult(plan,current,today);
  const personal=observedGain(plan,comparison);
  const edited=!!initial&&(numeric(gain)!==initial.gain||numeric(response)!==initial.response||numeric(attendance)!==initial.attendance);
  const pct=(p:number)=>p>0&&p<.01?'< 1 %':p<1&&p>.99?'> 99 %':new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:0}).format(p);
  async function save(e:FormEvent){e.preventDefault();setError('');try{
    const c=checkConfig({...config,scenario:{dose:currentKey,gain:numeric(gain),response:numeric(response),attendance:numeric(attendance)}});
    await onSave(c);
  }catch(reason){setError(errorText(reason,l));}}
  return <section className={s.card}><div className={s.heading}><TrendingUp size={21}/><h2>{l('Goal scenario','Scénario de réussite','سيناريو بلوغ الهدف')}</h2></div>
    <p>{config.exercise} · <bdi>{doseText(prescription,l,locale)} · {config.minutes} min</bdi> · {config.days} {l('sessions/week','séances/semaine','جلسات أسبوعيًا')}</p>
    {simulation&&<div className={s.forecast}><strong><bdi>{pct(simulation.p)}</bdi></strong><span>{edited?l('Last calculated scenario','Dernier scénario calculé','آخر سيناريو محسوب'):l('Chance under your assumptions','Probabilité selon tes hypothèses','الاحتمال وفق افتراضاتك')}</span><p>{l('Effective sessions needed','Séances efficaces nécessaires','الجلسات الفعّالة المطلوبة')} <b>{simulation.required}</b> · {l('scheduled before the deadline','prévues d’ici l’échéance','المجدولة حتى الموعد')} <b>{simulation.sessions}</b></p><small>{l('If the response assumption changes by ±10 percentage points','Si l’hypothèse de réponse varie de ±10 points','إذا تغير افتراض الاستجابة بمقدار ±10 نقاط')} · <bdi>{pct(simulation.low)} – {pct(simulation.high)}</bdi></small></div>}
    {!simulation&&<p>{config.scenario?l('Your next session has changed. Set assumptions for this dose.','Ta prochaine séance a changé. Précise les hypothèses pour cette séance.','تغيرت جلستك القادمة. حدد افتراضاتك لهذه الجلسة.'):l('Enter your assumptions to calculate a conditional estimate.','Renseigne tes hypothèses pour calculer une estimation conditionnelle.','أدخل افتراضاتك لحساب تقدير مشروط.')}</p>}
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
export default function AdaptiveProgram({owner,initialMetric,initialTarget,onTierHandled,training,workspace,values,details,guestEntries,measurementRevision=0,onRecord}:Props){
  const {l,t,locale}=useCopy(),plans=useMemo(()=>adaptivePlans(training.ledger.events),[training.ledger.events]),plan=plans.at(0);
  const [screen,setScreen]=useState<'entry'|'program'|'edit'|'new'>('entry'),[logging,setLogging]=useState(false),[tab,setTab]=useState<'session'|'scenario'>('session'),[notice,setNotice]=useState('');
  const history=useRetests(owner,plan?.config.metric,guestEntries,measurementRevision);
  const blocked=training.busy||!training.ready||!!training.error||training.ledger.pending.length>0;
  const requested=goalMetrics.find(m=>m.id===initialMetric)?.id;
  const matchesCurrentGoal=plan?.config.metric===requested&&(initialTarget===undefined||
    (plan?.config.goalUnit==='metric'&&Number(plan.config.target.toFixed(3))===initialTarget&&plan.config.deadline>=dayInZone(new Date(),plan.event.data.timeZone)));
  const openNew=screen==='new'||(screen==='entry'&&!!requested&&!matchesCurrentGoal);
  const effective=openNew?null:plan;
  useEffect(()=>{
    if(screen==='entry'&&initialTarget!==undefined&&matchesCurrentGoal&&requested)onTierHandled?.(requested);
  },[screen,initialTarget,matchesCurrentGoal,requested,onTierHandled]);
  async function save(c:AdaptiveConfig){
    if(blocked)return false;
    const program=effective?.event.data as TrainingProgram|undefined;
    const timeZone=program?.timeZone??workspace.data.context.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone;
    const ok=await training.put({kind:'program',version:1,id:effective?.event.id??crypto.randomUUID(),requestId:crypto.randomUUID(),deleted:false,reason:'',expectedRevision:effective?.event.revision??0,epoch:training.ledger.epoch,data:buildProgram(c,timeZone,program)});
    if(ok){if(initialTarget!==undefined)onTierHandled?.(c.metric);setScreen('program');setNotice(l('Program saved.','Programme enregistré.','تم حفظ البرنامج.'));}
    return ok;
  }
  async function log(day:string,actual:PerformedSession|null){
    if(blocked||!plan)return false;
    const data=makeWorkout(planForSession(training.ledger.events,plan,day,actual?.endedAt),day,actual);
    const ok=await training.put({kind:'workout',version:1,id:await workoutId(plan.event.id,day),requestId:crypto.randomUUID(),deleted:false,reason:'',expectedRevision:0,epoch:training.ledger.epoch,data});
    if(ok)setNotice(l('Session logged. Your next session has been updated.','Séance enregistrée. La prochaine séance a été ajustée.','سُجّلت الجلسة وحُدّثت الجلسة القادمة.'));
    return ok;
  }
  const today=dayInZone(new Date(),plan?.event.data.timeZone??'UTC'),config=plan?.config,metric=goalMetrics.find(m=>m.id===config?.metric),unit=config?t(goalUnit(config.metric,config.goalUnit)):'';
  const observed=history.latest&&config&&Date.parse(observationDate(history.latest))>=Date.parse(config.createdAt)?history.latest:undefined;
  const measured=observed&&metric&&config?goalValue(metric,config.goalUnit,observed.value??undefined,observed):undefined;
  const current=measured??config?.baseline??0;
  const complete=!!metric&&!!config&&(current-config.target)*metric.polarity>=0;
  const expired=!!config&&today>config.deadline;
  const closed=expired||complete;
  const full=!!plan&&!openNew&&screen!=='edit';
  return <div className={s.planner}>
    {training.busy&&!training.ready&&<p role="status">{l('Loading program…','Chargement du programme…','جارٍ تحميل البرنامج…')}</p>}
    {(training.error||training.ledger.pending.length>0)&&<div className={s.card} role="alert"><p>{training.ledger.pending.length?l('A saved change is waiting to sync.','Une modification est en attente de synchronisation.','هناك تغيير محفوظ ينتظر المزامنة.'):l('The training journal could not be loaded or saved.','La lecture ou l’enregistrement du journal a échoué.','تعذرت قراءة سجل التدريب أو حفظه.')}</p><div className={s.actions}><button className={s.secondary} onClick={()=>void (training.ledger.pending.length?training.retry():training.refresh())}>{t('Retry')}</button>{training.ledger.pending.length>0&&<button className={s.secondary} onClick={()=>void training.discard()}>{l('Discard pending change','Abandonner la modification en attente','تجاهل التغيير المعلق')}</button>}</div></div>}
    {notice&&<p className={s.notice} role="status">{notice}</p>}
    {!full&&training.ready&&(workspace.ready||!!workspace.error)&&<ConfigForm key={screen+':'+(effective?.event.id??'new')} plan={effective??undefined} initialMetric={screen==='entry'?requested:undefined} initialTarget={screen==='entry'?initialTarget:undefined} workspace={workspace} values={values} details={details} blocked={blocked} onSave={save} onCancel={plan?()=>{if(initialTarget!==undefined)onTierHandled?.(plan.config.metric);setScreen('program');}:undefined}/>}
    {full&&plan&&config&&metric&&<>
      <section className={s.goal}><div className={s.heading}><Target size={20}/><h2>{t(metric.name)}</h2><button className={s.icon} aria-label={l('Edit program','Modifier le programme','تعديل البرنامج')} onClick={()=>{setLogging(false);setScreen('edit');}}><Settings2 size={18}/></button></div>
        <div className={s.goalNums}><div><small>{measured===undefined?l('Starting result','Point de départ','نتيجة البداية'):l('Latest result','Dernier résultat','أحدث نتيجة')}</small><strong><bdi>{resultText(current,metric.id,locale)}</bdi> <em>{unit}</em></strong></div><ArrowRight size={22}/><div><small>{l('Target','Cible','الهدف')}</small><strong><bdi>{resultText(config.target,metric.id,locale)}</bdi> <em>{unit}</em></strong></div></div>
        <progress aria-label={l('Goal progress','Progression vers la cible','التقدم نحو الهدف')} value={Math.max(0,Math.min(1,(current-config.baseline)/(config.target-config.baseline)))} max={1}/>
        <p className={s.date}><CalendarDays size={15}/><time dateTime={config.deadline}>{new Date(config.deadline+'T12:00Z').toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})}</time>{complete&&<b>{observed&&!observed.measuredAt?l('Target value recorded · test date unknown','Valeur cible saisie · date du test inconnue','سُجّلت قيمة الهدف · تاريخ الاختبار غير معروف'):observed&&dayInZone(new Date(observationDate(observed)),plan.event.data.timeZone)>config.deadline?l('Reached after deadline','Atteinte après échéance','تحقق بعد الموعد'):l('Target reached','Cible atteinte','تحقق الهدف')}</b>}</p>
        {observed&&measured!==undefined&&<small>{observed.measuredAt?l('Test date','Date du test','تاريخ الاختبار'):l('Entry saved','Saisie enregistrée','تاريخ الحفظ')} · {new Date(observationDate(observed)).toLocaleDateString(locale)}</small>}
        {history.failed&&<p>{l('The retest history is unavailable. The starting value is shown.','L’historique des tests est indisponible. Le point de départ est affiché.','سجل الاختبارات غير متاح. تظهر نتيجة البداية.')}</p>}
        <button className={s.link} onClick={()=>onRecord(metric.id)}>{l('Record a test result','Enregistrer un résultat de test','تسجيل نتيجة اختبار')}<ArrowRight size={14}/></button>
      </section>
      {!closed&&<div className={s.tabs}><button aria-pressed={tab==='session'} onClick={()=>setTab('session')}><Dumbbell size={16}/>{l('Training','Séances','الجلسات')}</button><button aria-pressed={tab==='scenario'} onClick={()=>setTab('scenario')}><TrendingUp size={16}/>{l('Probability','Probabilité','الاحتمال')}</button></div>}
      {tab==='scenario'&&!closed?<><PersonalForecastPanel plan={plan} owner={owner} revision={measurementRevision} guest={guestEntries} current={current} today={today}/><Probability key={plan.event.id+doseKey(config,plan.prescription)} plan={plan} comparison={history.comparison} current={current} today={today} blocked={blocked||!!history.pending||!!history.failed} onSave={save}/></>:<>
        {closed?<section className={s.card}><div className={s.heading}><Check size={21}/><h2>{complete?l('Goal completed','Objectif atteint','تم تحقيق الهدف'):l('Program ended','Programme terminé','انتهت مدة البرنامج')}</h2></div><p>{complete?l('Your recorded result reached your target.','Ton résultat enregistré atteint ta cible.','بلغت نتيجتك المسجلة الهدف.'):l('The target date has passed. You can still complete your journal for earlier sessions.','La date cible est passée. Tu peux compléter le journal des séances antérieures.','انقضى الموعد المحدد. يمكنك إكمال سجل الجلسات السابقة.')}</p>{!logging?<button className={s.secondary} disabled={blocked} onClick={()=>setLogging(true)}>{l('Log a past session','Consigner une séance passée','تسجيل جلسة سابقة')}</button>:<SessionForm plan={plan} events={training.ledger.events} blocked={blocked} submit={log} onCancel={()=>setLogging(false)}/>}</section>:<section className={s.card}><div className={s.heading}><Dumbbell size={21}/><h2>{l('Next session','Prochaine séance','الجلسة القادمة')}</h2></div>
          <p>{config.exercise}</p><strong className={s.dose}><bdi>{doseText(plan.prescription,l,locale)}</bdi></strong>
          <p>{config.days} {l('sessions a week','séances par semaine','جلسات أسبوعيًا')} · {config.minutes} min</p>
          <div className={s.week} aria-label={l('Scheduled weekdays','Jours prévus','أيام التدريب')} >{Array.from({length:7},(_,i)=><span key={i} data-active={(plan.event.data as TrainingProgram).sessions[0].weekdays.includes(i+1)}>{new Intl.DateTimeFormat(locale,{weekday:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2024,0,1+i)))}</span>)}</div>
          <p>{({initial:l('Your chosen starting session.','Ta séance de départ.','جلسة البداية التي اخترتها.'),missed:l('One fewer set after a missed session, with a minimum of one.','Après une séance manquée, une série en moins, avec un minimum d’une série.','مجموعة أقل بعد الجلسة الفائتة، بحد أدنى مجموعة واحدة.'),actual:l('Adjusted to the work you actually logged.','Ajustée aux séries, répétitions et charges que tu as réalisées.','عُدّلت وفق المجموعات والتكرارات والأوزان التي أنجزتها.'),progression:l('Two completed doses in a row. The next target adds one rep or five seconds per set.','Deux séances consécutives remplies. La cible augmente d’une répétition ou cinq secondes par série.','أتممت الكمية المخططة مرتين متتاليتين. يُضاف تكرار واحد أو خمس ثوانٍ لكل مجموعة.')})[plan.prescription.reason]}</p>
          {!logging?<button className={s.primary} disabled={blocked} onClick={()=>{setNotice('');setLogging(true);}}>{l('Log a session','Consigner une séance','سجّل جلسة')}<ArrowRight size={16}/></button>:<SessionForm plan={plan} events={training.ledger.events} blocked={blocked} submit={log} onCancel={()=>setLogging(false)}/>}
        </section>}
        {plan.sessions.length>0&&<section className={s.card}><div className={s.heading}><ClipboardList size={20}/><h2>{l('Training journal','Journal des séances','سجل الجلسات')}</h2></div><ol className={s.journal}>{plan.sessions.map(event=>{const w=event.data as Workout,report=sessionResult(w)!,a=actualDose(w);return <li key={event.id}><div><time dateTime={report.day}>{new Date(report.day+'T12:00Z').toLocaleDateString(locale,{timeZone:'UTC'})}</time><b>{a?l('Completed','Réalisée','مكتملة'):l('Missed','Manquée','فائتة')}</b></div><small>{l('Planned','Prévu','المخطط')} · <bdi>{doseText(report.dose,l,locale)}</bdi></small>{a&&<span>{l('Actual','Réalisé','الفعلي')} · <bdi>{doseText(a,l,locale)} · {report.minutes} min</bdi></span>}</li>;})}</ol></section>}
        {plans.length>1&&<section className={s.card}><h2>{l('Earlier goals','Objectifs précédents','الأهداف السابقة')}</h2>{plans.slice(1).map(old=>{const oldMetric=goalMetrics.find(m=>m.id===old.config.metric)!;return <details className={s.explainer} key={old.event.id}><summary>{t(oldMetric.name)} · <bdi>{resultText(old.config.target,oldMetric.id,locale)} {t(goalUnit(oldMetric.id,old.config.goalUnit))}</bdi> · {old.config.deadline}</summary><p>{l('Starting result','Point de départ','نتيجة البداية')} · {resultText(old.config.baseline,oldMetric.id,locale)} {t(goalUnit(oldMetric.id,old.config.goalUnit))}</p>{old.sessions.length?<ol className={s.journal}>{old.sessions.map(event=>{const w=event.data as Workout,report=sessionResult(w)!,a=actualDose(w);return <li key={event.id}><time dateTime={report.day}>{report.day}</time>{a?doseText(a,l,locale):l('Missed','Manquée','فائتة')}</li>;})}</ol>:<p>{l('No sessions logged','Aucune séance consignée','لم تُسجّل جلسات')}</p>}</details>;})}</section>}
        <button className={s.link} disabled={blocked} onClick={()=>{setLogging(false);setNotice('');setScreen('new');}}>{l('Create a new goal','Créer un autre objectif','إنشاء هدف جديد')}<ArrowRight size={15}/></button>
      </>}
    </>}
  </div>;
}
