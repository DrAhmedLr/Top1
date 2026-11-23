'use client';

import {useMemo,useState,type FormEvent} from 'react';
import {ArrowLeft,ArrowRight,CalendarDays,Check} from 'lucide-react';
import {addDays,checkConfig,dayInZone,goalMetrics,type AdaptiveConfig,type AdaptivePlan} from '@/lib/adaptiveProgram';
import {createGuidedConfig,datedProgram,previewDatedProgram,type ProgramEffort,type ProgramWarning} from '@/lib/datedProgram';
import {maximumGuidedDays,programFamilies,type ProgramFamily} from '@/lib/guidedSchedule';
import {guidedAdherenceScenario} from '@/lib/guidedAdherence';
import {performanceInsights,type InsightInputs,type PerformanceInsights} from '@/lib/performanceInsights';
import {rankProgramOpportunities} from '@/lib/programOpportunities';
import type {Observation} from '@/lib/history';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
import {parseMeasurementInput} from '@/lib/measurementInput';
import type {GoalCalibration} from '@/lib/goalTrackingTypes';
import type {PersonalWorkspace} from '@/lib/personalWorkspace';
import {formatRunTime,parseRunTime} from '@/lib/run10kReference';
import type {Demographics,Values} from '@/lib/registry';
import {useProgramCopy} from './programCopy';
import ProgrammeBuilder from './ProgrammeBuilder';
import ProgrammeDates,{type ProgrammeDateOption} from './ProgrammeDates';
import {editProgrammeDateOptions} from '@/lib/programPortfolio';
import {MetricIcon} from './MetricIcon';
import css from './AdaptiveProgram.module.css';


type ExistingGoal=NonNullable<PerformanceInsights['goal']>;
type Forecast=NonNullable<ExistingGoal['adherence']>;
type EditContext={availableConfigs?:AdaptiveConfig[];lockedMetrics?:ReadonlySet<string>;revise?:(config:AdaptiveConfig)=>AdaptiveConfig;goal?:ExistingGoal|null;current?:number;loggedToday:boolean;fullHistory?:Pick<InsightInputs,'values'|'details'|'profile'|'entries'>};
type Selection={metric:string;unit:AdaptiveConfig['goalUnit'];current:number;nextTarget:number};
type Schedule=ReturnType<typeof previewDatedProgram>;

export function AdherenceEstimate({estimate,unit,calibration}:{estimate:Forecast|null;unit:string;calibration?:GoalCalibration}){
 const {l,locale,number,t}=useProgramCopy();
 const percent=(n:number)=>n>0&&n<.01?'< 1%':n>.99&&n<1?'> 99%':new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:0}).format(n);
 return <section className={css.card} aria-live="polite">
  <h3>{l('Chance of reaching the target','Chances d’atteindre la cible','احتمال بلوغ الهدف')}</h3>
  {estimate?<><div className={css.forecast}><strong><bdi>{percent(calibration?.probability??estimate.probability)}</bdi></strong>
   <span>{calibration?l('Adjusted using observed goal outcomes','Ajustée selon les résultats observés','تقدير معدّل باستخدام نتائج الأهداف المرصودة'):estimate.kind==='personal'?l('Personal estimate from comparable training','Estimation personnelle issue de séances comparables','تقدير شخصي من فترات تدريب مماثلة'):
      l('Illustrative estimate','Estimation indicative','تقدير توضيحي')}</span>
   <p>{l('Assumes you complete every remaining scheduled session.','Suppose que tu réalises toutes les séances restantes du programme.','يفترض إتمام جميع الجلسات المقرّرة المتبقية.')}</p></div>
   {!calibration&&estimate.kind==='illustrative'&&estimate.probability===0&&<p>{l('Even a gain in every remaining session falls short under these assumptions. A later date or smaller target changes the scenario.','Même un gain à chaque séance restante ne suffit pas selon ces hypothèses. Une échéance plus tardive ou une cible plus proche modifie le scénario.','حتى التحسن في كل جلسة متبقية لا يكفي وفق هذه الافتراضات. تمديد المهلة أو خفض الهدف يغيّر نتيجة السيناريو.')}</p>}
   <details className={css.explainer}><summary>{l('How to read this estimate','Comprendre cette estimation','كيف يُقرأ هذا التقدير')}</summary>
    {calibration&&<p>{l('Before adjustment','Avant ajustement','قبل التعديل')} · <bdi>{percent(calibration.baseProbability)}</bdi>. {l('Contributing participants','Participants ayant contribué','عدد المشاركين المساهمين')} · <bdi>{number(calibration.participants)}</bdi>.</p>}
    {estimate.kind==='illustrative'?<><p>{l('The scenario assumes a gain in one out of two completed sessions. Gain per responsive session','Le scénario suppose un progrès lors d’une séance réalisée sur deux. Gain par séance avec progrès','يفترض السيناريو تحسنًا في نصف الجلسات المكتملة. مقدار التحسن لكل جلسة تستجيب لها')} · <bdi>{number(estimate.gain,3)} {t(unit)}</bdi>.</p>
    <p>{l('Changing the response assumption from 40% to 60% gives','Si l’hypothèse de réponse passe de 40 % à 60 %, le résultat varie entre','عند تغيير افتراض الاستجابة من ٤٠٪ إلى ٦٠٪ يتراوح التقدير بين')} <bdi>{percent(estimate.low)} – {percent(estimate.high)}</bdi>.</p>
    <p>{number(estimate.intervals)} / {number(3)} · {l('Four comparable dated tests and three fully logged training intervals unlock a personal estimate.','Quatre tests datés comparables et trois intervalles d’entraînement entièrement consignés permettent une estimation personnelle.','بعد أربعة اختبارات مؤرخة قابلة للمقارنة وثلاث فترات تدريب مكتملة التسجيل يتاح تقدير شخصي.')}</p></>:
    <p>{l('This simulation samples changes from your completed training intervals.','La simulation utilise les variations observées pendant tes intervalles d’entraînement réalisés.','تستخدم المحاكاة التغيرات المرصودة في فترات تدريبك المكتملة.')} · {number(estimate.intervals)} {l('comparable intervals','intervalles comparables','فترات قابلة للمقارنة')}.</p>}
    <p>{l('Individual prediction accuracy still needs validation.','La précision prédictive individuelle reste à valider.','لا تزال دقة التنبؤ الفردي بحاجة إلى تحقق.')}</p>
   </details>
  </>:<p>{l('An estimate is unavailable for this target and date.','Estimation indisponible pour cette cible et cette date.','لا يتوفر تقدير لهذا الهدف والتاريخ.')}</p>}
 </section>;
}

function ScheduleDetails({schedule,config,today,onRecord}:{schedule:Schedule;config:AdaptiveConfig;today:string;onRecord?:()=>void}){
 const {l,t,index,number,date}=useProgramCopy();
 const unit=config.goalUnit==='kg'?'kg':goalMetrics.find(metric=>metric.id===config.metric)?.unit??'';
 const effort:Record<ProgramEffort,string>={
  submaximal:l('Finish each set with 2–3 good repetitions in reserve.','Garde 2 à 3 répétitions de réserve à chaque série.','أنه كل مجموعة مع القدرة على أداء تكرارين أو ثلاثة إضافية بإتقان.'),
  'easy-aerobic':l('Keep a pace at which you can talk.','Garde une allure qui te permet de parler.','اختر وتيرة يمكنك خلالها التحدث.'),
  'relaxed-strides':l('Use a relaxed pace below a sprint.','Cours relâché, en dessous de ta vitesse de sprint.','اجرِ بوتيرة مريحة دون بلوغ سرعة العدو القصوى.'),
  quality:l('Reset your position between attempts.','Replace-toi entre chaque essai.','أعد ضبط وضعيتك بين المحاولات.'),
  'comfortable-hold':l('Stop the hold while your grip and posture are steady.','Arrête le maintien tant que ta prise et ta posture restent stables.','أنهِ التثبيت بينما لا تزال قبضتك ووضعيتك ثابتتين.'),
  balance:l('Keep your eyes open with a stable support nearby.','Garde les yeux ouverts, près d’un appui stable.','أبقِ عينيك مفتوحتين بجوار مسند ثابت.'),
  'same-protocol':l('Repeat your original test protocol.','Répète le protocole du test initial.','كرّر طريقة الاختبار الأصلية.'),
 };
 const preparation:Record<ProgramFamily,string>={
  repetition:config.metric==='pushups'?l('March easily, circle your shoulders, then try a few easy wall push-ups.','Marche sur place, fais des cercles avec les épaules puis quelques pompes faciles contre un mur.','امشِ في مكانك بهدوء، ثم حرّك كتفيك في دوائر وأدِّ بضع ضغطات سهلة على الحائط.'):
   l('Walk easily, then rehearse a few comfortable repetitions of the movement with support if needed.','Marche tranquillement, puis répète le mouvement en douceur avec un appui si nécessaire.','امشِ بهدوء ثم تدرّب على الحركة ببضع تكرارات مريحة مع دعم عند الحاجة.'),
  lift:l('Walk easily, then practise the lifting movement without weight or with a light load.','Marche tranquillement, puis répète le mouvement à vide ou avec une charge légère.','امشِ بهدوء ثم تدرّب على حركة الرفع دون وزن أو بحمل خفيف.'),
  aerobic:config.metric==='zone2_power'?l('Start pedalling slowly with light resistance.','Commence à pédaler doucement avec une faible résistance.','ابدأ التبديل ببطء مع مقاومة خفيفة.'):
   l('Start with a walk and ease into a light jog.','Commence par marcher puis passe à un footing léger.','ابدأ بالمشي ثم انتقل تدريجيًا إلى هرولة خفيفة.'),
  stride:l('Walk, ease into a jog, then practise a few relaxed steps.','Marche, passe à un footing léger puis effectue quelques foulées souples.','امشِ ثم هرول بخفة وجرّب بضع خطوات مريحة.'),
  jump:l('March easily, then practise a few shallow squats and quiet two-foot landings.','Marche sur place, puis fais quelques flexions légères et des réceptions souples sur deux pieds.','امشِ في مكانك ثم جرّب قرفصاء خفيفة وهبوطًا هادئًا على القدمين.'),
  grip:l('Move your wrists gently and open and close your hands.','Mobilise doucement les poignets, puis ouvre et ferme les mains.','حرّك معصميك برفق وافتح يديك وأغلقهما.'),
  hang:l('Circle your shoulders gently and open and close your hands.','Fais des cercles doux avec les épaules, puis ouvre et ferme les mains.','حرّك كتفيك في دوائر برفق وافتح يديك وأغلقهما.'),
  balance:l('March holding a stable support, then shift weight from foot to foot with eyes open.','Marche sur place avec un appui stable puis transfère le poids d’un pied à l’autre, yeux ouverts.','امشِ في مكانك ممسكًا بمسند ثابت، ثم انقل الوزن بين القدمين مع إبقاء العينين مفتوحتين.'),
 };
 const finish=config.metric==='zone2_power'?l('Pedal slowly at low resistance and let your breathing settle.','Pédale lentement à faible résistance et laisse ta respiration se calmer.','بدّل ببطء مع مقاومة خفيفة ودع تنفسك يهدأ.'):
   l('Walk slowly and let your breathing settle.','Marche lentement et laisse ta respiration se calmer.','امشِ ببطء ودع تنفسك يهدأ.');
 const warnings:Record<ProgramWarning,string>={
  'short-window':l('Few sessions fit before the retest. A later deadline allows more practice.','Peu de séances sont possibles avant le retest. Une date plus tardive laisse plus de temps pour pratiquer.','لا تتسع المدة إلا لعدد قليل من الجلسات. يتيح تمديد الموعد وقتًا أطول للتدريب.'),
  'large-change':l('This target requires a large change over the chosen period. Review it after your next test.','Cette cible exige une forte progression sur la période choisie. Réévalue-la après le prochain test.','يتطلب الهدف تغيرًا كبيرًا خلال المدة المحددة. راجعه بعد الاختبار القادم.'),
  'review-equipment':l('The exercise uses a substitute for the tested movement. Check that your equipment fits it.','Un exercice de remplacement est proposé. Vérifie que ton matériel convient.','يتضمن البرنامج تمرينًا بديلًا للحركة المختبرة. تحقق من توفر المعدات المناسبة.'),
  'review-limitations':l('Review these exercises against the movement limitations saved in your profile.','Vérifie que ces exercices respectent les limitations enregistrées dans ton profil.','راجع التمارين وفق قيود الحركة المسجلة في ملفك.'),
  reassess:l('Retest periodically and review the plan as your performance changes.','Répète le test régulièrement et révise le programme à mesure que tu progresses.','أعد الاختبار دوريًا وراجع البرنامج كلما تغير أداؤك.'),
 };

 const weeks=schedule.weeks;
 const currentWeek=weeks.findIndex(week=>week.end>=today);
 const [chosenWeek,setChosenWeek]=useState<number>();
 const weekIndex=Math.min(weeks.length-1,chosenWeek??(currentWeek<0?weeks.length-1:currentWeek));
 const week=weeks[weekIndex];
 const firstTraining=week.sessions.find(session=>session.kind==='training');
 const minutes=week.sessions.reduce((sum,session)=>sum+session.estimatedMinutes,0);
 return <section className={css.card}><div className={css.heading}><CalendarDays size={20}/><h2>{l('Training schedule','Calendrier d’entraînement','جدول التدريب')}</h2></div>
  <p>{number(schedule.trainingCount)} {l('training sessions before your retest on','séances d’entraînement avant ton retest du','جلسات تدريب قبل إعادة الاختبار في')} <bdi>{date(schedule.retestDate)}</bdi>.</p>
  <p>{l('Target change per week','Progression moyenne nécessaire par semaine','متوسط التغيّر المطلوب أسبوعيًا')} · <bdi>{number(schedule.changePerWeek,3)} {t(unit)}</bdi></p>
  <div className={css.weekPager}><button type="button" disabled={weekIndex===0} className={css.secondary} aria-label={l('Previous week','Semaine précédente','الأسبوع السابق')} onClick={()=>setChosenWeek(weekIndex-1)}><ArrowLeft size={16}/></button>
   <span aria-live="polite">{l('Week','Semaine','الأسبوع')} {number(week.number)} / {number(weeks.length)}</span>
   <button type="button" disabled={weekIndex+1>=weeks.length} className={css.secondary} aria-label={l('Next week','Semaine suivante','الأسبوع التالي')} onClick={()=>setChosenWeek(weekIndex+1)}><ArrowRight size={16}/></button>
  </div>
  <div className={css.programWeek}><p><bdi>{date(week.start)} — {date(week.end)}</bdi> · <strong>{number(minutes)} {l('training minutes','min d’entraînement','دقيقة تدريب')}</strong></p>
   {firstTraining&&<div className={css.preparation}>
    <p><b>{l('Warm-up','Échauffement','إحماء')} · {number(firstTraining.warmupMinutes)} {l('min','min','د')}</b> {preparation[programFamilies[config.metric]!]}</p>
    <p><b>{l('Cool-down','Retour au calme','تهدئة')} · {number(firstTraining.cooldownMinutes)} {l('min','min','د')}</b> {finish}</p>
   </div>}
   <ol>{week.sessions.map(session=><li key={session.date}><time dateTime={session.date}>{date(session.date)}</time>
    {session.kind==='retest'?<><strong>{session.date===config.deadline?l('Final retest','Retest final','إعادة الاختبار النهائية'):l('Progress retest','Test de suivi','اختبار متابعة')} · {session.exercise[index]}</strong>
    {onRecord&&session.date<=today&&<button type="button" className={css.link} onClick={onRecord}>{l('Record a test result','Enregistrer un résultat de test','تسجيل نتيجة اختبار')}<ArrowRight size={14}/></button>}</>:<>
     <strong>{session.exercise[index]} · {number(session.estimatedMinutes)} {l('min','min','د')}</strong>
     <span><bdi>{number(session.sets)} × {number(session.amount)}</bdi> {session.mode==='reps'?l('reps per set','répétitions par série','تكرارات لكل مجموعة'):l('seconds per set','secondes par série','ثانية لكل مجموعة')}{config.metric==='single_leg_balance'&&' · '+l('each leg','par jambe','لكل ساق')}{session.loadKg>0&&<> · <bdi>{number(session.loadKg)} kg</bdi></>}</span>
     <small>{effort[session.effort]}</small>
     <span>{l('Rest between sets','Repos entre les séries','الراحة بين المجموعات')} · {number(session.restSeconds)} {l('sec','s','ث')}</span>
    </>}
   </li>)}</ol>
   {week.sessions.length===0&&<p>{l('Recovery week','Semaine de récupération','أسبوع تعافٍ')}</p>}
  </div>
  <details className={css.explainer}><summary>{l('Programming notes and sources','Notes et sources du programme','ملاحظات ومصادر البرنامج')}</summary>
   {schedule.warnings.map(warning=><p key={warning}>{warnings[warning]}</p>)}
   <p>{l('Training principles inform these exercises. The exact schedule and success estimate are TOP1 models.','Les principes d’entraînement guident les exercices. Le calendrier précis et l’estimation de réussite proviennent des modèles TOP1.','تستند التمارين إلى مبادئ التدريب. الجدول المحدد وتقدير النجاح من نماذج TOP1.')}</p>
   <a href={schedule.source} target="_blank" rel="noreferrer">{l('Training guidance','Recommandations d’entraînement','إرشادات التدريب')}</a>
   {config.metric==='pushups'&&<> · <a href="https://pubmed.ncbi.nlm.nih.gov/29466268/" target="_blank" rel="noreferrer">{l('Progressive push-up study','Étude sur la progression des pompes','دراسة التدرّج في تمارين الضغط')}</a></>}
  </details>
 </section>;
}

type EditorProps={
 choice:Selection;workspace:PersonalWorkspace;details:MeasurementMetadata;initialTarget?:number;initialDate?:string;
 existing?:AdaptivePlan;editContext?:EditContext;busy:boolean;onBack?:()=>void;save:(config:AdaptiveConfig)=>Promise<boolean>;
};
function GoalEditor({choice,workspace,details,initialTarget,initialDate,existing,editContext,busy,onBack,save}:EditorProps){
 const {l,t,locale,measure}=useProgramCopy();
 const metric=goalMetrics.find(item=>item.id===choice.metric)!;
 const zone=existing?.event.data.timeZone??workspace.context.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone;
 const today=dayInZone(new Date(),zone);
 const firstTarget=initialTarget??choice.nextTarget;
 const [raw,setRaw]=useState(metric.id==='run_5k'?formatRunTime(firstTarget,true):String(firstTarget));
 const [deadline,setDate]=useState(initialDate&&initialDate>today?initialDate:addDays(today,42));
 const [submitError,setSubmitError]=useState(false);
 const lastDate=addDays(existing?.config.scheduleStart??today,maximumGuidedDays);
 const unit=choice.unit==='kg'?'kg':metric.unit;
 const parsedTarget=Number(parseMeasurementInput(metric.id==='run_5k'?parseRunTime(raw):raw));
 const target=Number(parsedTarget.toFixed(3));
 const dates=useMemo(()=>{
   if(!existing||!Number.isFinite(target))return [];
   const original=existing.config;
   try{
     const result=editProgrammeDateOptions(editContext?.availableConfigs??[original],{...original,target},today,editContext?.lockedMetrics,editContext?.current,editContext?.loggedToday);
     const rows:ProgrammeDateOption[]=[...result];
     if(!rows.some(row=>row.date===original.deadline)){
       const projection=editContext?.revise?.({...original,target})??{...original,target};
       const probability=guidedAdherenceScenario(projection,today,editContext?.current??original.baseline,editContext?.loggedToday)?.probability??null;
       rows.unshift({date:original.deadline,probability});
     }
     return rows;
   }catch{return [{date:original.deadline,probability:null}];}
 },[existing,editContext,target,today]);
 const selectedDate=dates.some(row=>row.date===deadline)?deadline:dates[0]?.date??deadline;
 const proposal=useMemo(()=>{
  try{
   if(!raw.trim()||!Number.isFinite(target))throw Error('target');
   if(selectedDate<=today)throw Error('date');
   const c=existing?.config;
   const edited=c?{...c,target,deadline:selectedDate}:undefined;
   const config=edited?(editContext?.revise?.(edited)??edited):createGuidedConfig({metric:metric.id,baseline:choice.current,target,deadline:selectedDate,startDay:today,
    goalUnit:choice.unit,timeZone:zone,context:workspace.context,locale,bodyWeightKg:details[metric.id]?.derivation?.bodyWeightKg??details[metric.id]?.protocol?.bodyWeightKg});
   checkConfig(config);
   if(!existing)return {config,schedule:previewDatedProgram(config,zone),estimate:guidedAdherenceScenario(config,today)};
   const draftPlan={...existing,config};
   const schedule=datedProgram(draftPlan);
   if(c?.target===target&&c.deadline===selectedDate&&editContext?.goal)return {config,schedule,estimate:editContext.goal.adherence};
   if(editContext?.fullHistory){
    const refreshed=performanceInsights({...editContext.fullHistory,plan:draftPlan,today});
    return {config,schedule,estimate:refreshed.goal?.adherence};
   }
   const current=editContext?.goal?.current??editContext?.current;
   const estimate=current===undefined?null:guidedAdherenceScenario(config,today,current,editContext?.loggedToday);
   return {config,schedule,estimate,refreshOnSave:true};
  }catch(error){return {error:error instanceof Error?error.message:'goal'};}
 },[raw,target,selectedDate,today,choice.current,choice.unit,metric.id,existing,editContext,workspace.context,zone,details,locale]);
 async function submit(event:FormEvent){event.preventDefault();if(!proposal.config||busy)return;
  setSubmitError(false);try{if(!await save(proposal.config))setSubmitError(true);}catch{setSubmitError(true);}}
 return <form className={css.planner} onSubmit={submit}>
  {onBack&&<button className={css.link} type="button" onClick={onBack}><ArrowLeft size={16}/>{l('Back','Retour','رجوع')}</button>}
  <section className={css.goal}><div className={css.heading}><MetricIcon id={metric.id} size={22}/><h2>{t(metric.name)}</h2></div>
   <p>{l('Starting result','Résultat de départ','نتيجة البداية')} · <strong><bdi>{measure(metric.id,choice.current)} {t(unit)}</bdi></strong></p>
   {existing&&editContext?.current!==undefined&&editContext.current!==choice.current&&<p>{l('Latest result','Dernier résultat','أحدث نتيجة')} · <strong><bdi>{measure(metric.id,editContext.current)} {t(unit)}</bdi></strong></p>}
   <fieldset disabled={busy} className={css.fields}>
    <label>{l('Target','Cible','الهدف')} · {metric.id==='run_5k'?'min:sec':t(unit)}<input name="target" type="text" inputMode={metric.id==='run_5k'?'text':'decimal'} value={raw} onChange={e=>setRaw(e.target.value)} maxLength={18} required/></label>
    <ProgrammeDates name="deadline" options={dates} value={selectedDate} onChange={setDate} saved={existing?.config.deadline}/>
   </fieldset>
   {proposal.error&&<p role="status">{proposal.error==='date'?l('Choose a future date on or before','Choisis une date future au plus tard le','اختر تاريخًا مستقبليًا أقصاه')+' '+lastDate:
   proposal.error==='schedule'?l('Choose a date that leaves the other tests and recovery days available.','Choisis une date qui laisse les autres tests et les jours de récupération disponibles.','اختر موعدًا يترك مساحة للاختبارات الأخرى وأيام التعافي.'):l('Choose a measurable target that improves on your starting result.','Choisis une cible mesurable qui améliore ton résultat de départ.','اختر هدفًا قابلاً للقياس يتجاوز نتيجة البداية.')}</p>}
  </section>
  {proposal.config&&proposal.schedule&&<details className={css.card}><summary>{l('Forecast and schedule details','Détails de l’estimation et du calendrier','تفاصيل التقدير والجدول')}</summary><AdherenceEstimate estimate={proposal.estimate??null} unit={unit}/>
   {proposal.refreshOnSave&&<p>{l('Saving recalculates your estimate with the complete account history.','L’enregistrement recalcule ton estimation avec tout l’historique de ton compte.','يُعاد حساب تقديرك عند الحفظ باستخدام سجل حسابك الكامل.')}</p>}
   <ScheduleDetails config={proposal.config} schedule={proposal.schedule} today={today}/></details>}
  {submitError&&<p role="alert">{l('Could not save the program. Review the sync status and retry.','Impossible d’enregistrer le programme. Vérifie la synchronisation et réessaie.','تعذّر حفظ البرنامج. تحقق من حالة المزامنة وأعد المحاولة.')}</p>}
  <button className={css.primary} type="submit" disabled={busy||!proposal.config}>{existing?l('Save changes','Enregistrer les modifications','حفظ التعديلات'):l('Save program','Enregistrer le programme','حفظ البرنامج')}<Check size={16}/></button>
 </form>;
}

type PickerProps={workspace:PersonalWorkspace;values:Values;details:MeasurementMetadata;profile?:Demographics;observations:Observation[];
 initialMetric?:string;initialTarget?:number;existing?:AdaptivePlan;editContext?:EditContext;busy:boolean;onBrowse:()=>void;onCancel?:()=>void;
 currentConfigs?:AdaptiveConfig[];manualWeekdays?:Record<string,number[]>;lockedMetrics?:ReadonlySet<string>;save:EditorProps['save'];saveGroup:(configs:AdaptiveConfig[],revised?:AdaptiveConfig[])=>Promise<boolean>};
export default function GuidedProgram({workspace,values,details,profile,observations,initialMetric,initialTarget,existing,editContext,busy,onBrowse,onCancel,save,saveGroup,currentConfigs,lockedMetrics,manualWeekdays}:PickerProps){
 const zone=existing?.event.data.timeZone??workspace.context.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone;
 const today=dayInZone(new Date(),zone);
 const rows=useMemo(()=>rankProgramOpportunities({values,details,profile,observations,goal:workspace.goal,today}),[values,details,profile,observations,workspace.goal,today]);
 if(existing){
  const c=existing.config;
  return <GoalEditor key={existing.event.id} choice={{metric:c.metric,unit:c.goalUnit,current:c.baseline,nextTarget:c.target}} workspace={workspace} details={details}
   existing={existing} editContext={editContext} initialTarget={initialTarget??c.target} initialDate={c.deadline} busy={busy} save={save} onBack={onCancel}/>;
 }
 return <ProgrammeBuilder rows={currentConfigs?rows.filter(row=>!currentConfigs.some(c=>c.metric===row.metric)):rows} existing={currentConfigs} lockedMetrics={lockedMetrics} manualWeekdays={manualWeekdays} workspace={workspace} details={details} observations={observations} today={today} zone={zone}
   initialMetric={initialMetric} initialTarget={initialTarget} onBrowse={onBrowse} onCancel={onCancel} busy={busy} save={saveGroup}/>;
}
