'use client';

import {useEffect,useRef,useState} from 'react';
import {Check,Timer} from 'lucide-react';
import {draftValues,journeyBaseline,journeyDraftKey,readJourneyDraft,type BaselinePlan,type JourneyDraft} from '@/lib/journeyDraft';
import {balancedBaseline,baselineAreas,baselineChallenge,baselineStorageKey,baselineTests,readBaselineSelection,type BaselineArea} from '@/lib/balancedBaseline';
import {clearBaselineChoice,saveBaselineChoice} from '@/lib/baselineStorage';
import {baselineArea,resultChange,unfinishedPlan} from '@/lib/journeyResult';
import {captureEvent} from '@/lib/analytics';
import {activeMetrics,type Demographics,type Values} from '@/lib/registry';
import {valid} from '@/lib/engine';
import {formatRunTime,parseRunTime} from '@/lib/run10kReference';
import {parseMeasurementInput} from '@/lib/measurementInput';
import {parseProfileDraft,profileToDraft} from '@/lib/onboarding';
import {normalizeMeasurementMetadata,type MeasurementMetadata} from '@/lib/measurementMetadata';
import {clearCheckpoint,firstChallenge,readCheckpoint} from '@/lib/journeyProgress';
import {repeatDetails} from '@/lib/observationPresentation';
import {protocolOptions} from '@/lib/protocols';
import MetricEditor from './MetricEditor';
import JourneyResult,{type SavedJourneyResult} from './JourneyResult';
import JourneyRetest from './JourneyRetest';
import {useTranslations} from './providers/LocaleProvider';

type Props={loadUnit?:'kg'|'lb';owner:string;initialLevel?:number;initialMetric?:string;initialProfile?:Demographics;initialValues:Values;initialDetails:MeasurementMetadata;onSave:(profile:Demographics,values:Values,details:MeasurementMetadata)=>void;onFinish:()=>void;onHistory:(id:string)=>void;onBrowse?:()=>void};

export default function BenchmarkJourney({loadUnit,owner,initialLevel,initialMetric,initialProfile,initialValues,initialDetails,onSave,onFinish,onHistory,onBrowse}:Props){
 const {t,locale}=useTranslations();
 const local=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const inputBaseline=journeyBaseline(initialProfile,initialValues,initialDetails);
 const [resume]=useState(()=>{if(initialMetric||initialLevel!==undefined)return null;try{return readJourneyDraft(localStorage.getItem(journeyDraftKey(owner)),inputBaseline);}catch{return null;}});
 const [checkpoint]=useState(()=>!initialMetric&&!resume?readCheckpoint(owner):undefined);
 const [baselineChoices,setBaselineChoices]=useState(()=>{try{return readBaselineSelection(localStorage.getItem(baselineStorageKey(owner)));}catch{return {};}});
 const [metricId,setMetricId]=useState(initialMetric==='basics'?firstChallenge:initialMetric??resume?.metric??checkpoint?.metric??firstChallenge);
 const [screen,setScreen]=useState<'choose'|'basics'|'record'|'result'>(()=>resume?.screen==='profile'?'basics':resume?.screen??(initialMetric||checkpoint?initialProfile?'record':'basics':'choose'));
 const [draft,setDraft]=useState(()=>resume?.profile??profileToDraft(initialProfile));
 const [baseline,setBaseline]=useState({values:initialValues,details:initialDetails});
 const [values,setValues]=useState<Values>(()=>{
  const next={...(resume?.values??initialValues)};
  if(resume?.rawInput!==undefined){const parsed=['run_5k','run_10k'].includes(resume.metric)?parseMeasurementInput(parseRunTime(resume.rawInput)):parseMeasurementInput(resume.rawInput,resume.metric==='total_sleep'?60:1);next[resume.metric]=parsed?Number(parsed):undefined;}
  return next;
 });
 const [details,setDetails]=useState(resume?.details??initialDetails);
 const [plan,setPlan]=useState<BaselinePlan>(()=>resume?.plan??{
  ...Object.fromEntries(baselineAreas.flatMap(key=>baselineChoices[key]?[[key,baselineChoices[key]!.test]]:[])),
  ...(baselineArea(initialMetric??'')?{[baselineArea(initialMetric!)!]:initialMetric}:{}),
 });
 const [skipped,setSkipped]=useState<BaselineArea[]>(resume?.skipped??[]);
 const [mode,setMode]=useState<'existing'|'today'|undefined>(resume?.mode);
 const [confirmed,setConfirmed]=useState(resume?.mode==='today'?false:resume?.confirmed??false);
 const [rawInput,setRawInput]=useState(resume?.rawInput);
 const [testWeight,setTestWeight]=useState(resume?.testWeight??resume?.profile.weight??(initialProfile?.weight===undefined?'':String(initialProfile.weight)));
 const [liftInputs,setLiftInputs]=useState(resume?.liftInputs);
 const [contextError,setContextError]=useState('');
 const [changed,setChanged]=useState(!!resume&&resume.screen==='record');
 const [useForBaseline,setUseForBaseline]=useState(resume?.useForBaseline??true);
 const [storageError,setStorageError]=useState(false);
 const [report,setReport]=useState<SavedJourneyResult>();
 const [editorEpoch,setEditorEpoch]=useState(0);
 const [endsAt,setEndsAt]=useState(0),[seconds,setSeconds]=useState(30);
 const root=useRef<HTMLDivElement>(null);
 const metric=activeMetrics.find(item=>item.id===metricId)??activeMetrics.find(item=>item.id===firstChallenge)!;
 const profile=parseProfileDraft(draft),previous=baseline.values[metric.id],result=values[metric.id];
 const area=baselineArea(metric.id);
 const areaNames={push:local('Pushing','Poussée','الدفع'),pull:local('Pulling','Tirage','السحب'),lower:local('Lower body','Bas du corps','الجزء السفلي'),endurance:local('Endurance','Endurance','التحمّل')};
 const coverage=balancedBaseline(baseline.values,baseline.details,baselineChoices).coverage;
 const pending=unfinishedPlan(plan,baselineChoices,baseline.values,baseline.details);
 const show=(n:number)=>['run_5k','run_10k'].includes(metric.id)?formatRunTime(n):String(metric.id==='total_sleep'?n/60:n);
 const lift=['bench_1rm','squat_1rm','deadlift_1rm','pullup_1rm'].includes(metric.id);
 const ageBad=!!draft.age&&!parseProfileDraft({...draft,weight:'',height:''});
 const testWeightNumber=testWeight.trim()?Number(parseMeasurementInput(testWeight)):undefined;
 const weightValid=testWeightNumber!==undefined&&Number.isFinite(testWeightNumber)&&testWeightNumber>=25&&testWeightNumber<=350;
 const weightBad=!!testWeight&&!weightValid;
 const existingEligible=!!profile&&mode==='existing'&&!!baselineChallenge(metric.id,values,details,profile.sex);
 const testContextError=(()=>{try{normalizeMeasurementMetadata(details);return false;}catch{return true;}})();

 function sessionDraft():JourneyDraft{
  return {version:2,updatedAt:Date.now(),baseline:inputBaseline,metric:metric.id,collection:initialLevel??0,guided:mode==='today',screen:screen==='result'?'choose':screen,profile:draft,values:draftValues(values),details,plan,skipped,mode:screen==='result'?undefined:mode,confirmed:screen==='result'?false:confirmed,useForBaseline,testWeight,rawInput:screen==='result'?undefined:rawInput,liftInputs:screen==='result'?undefined:liftInputs};
 }
 function persist(){
  try{
   if(screen==='result'&&coverage===4&&!pending.length)localStorage.removeItem(journeyDraftKey(owner));
   else localStorage.setItem(journeyDraftKey(owner),JSON.stringify(sessionDraft()));
   setStorageError(false);return true;
  }catch{setStorageError(true);return false;}
 }
 useEffect(()=>{persist();},[screen,draft,values,details,plan,skipped,mode,confirmed,useForBaseline,testWeight,rawInput,liftInputs,inputBaseline,owner,coverage,pending.join(',')]);
 useEffect(()=>{root.current?.querySelector<HTMLElement>('[data-journey-heading]')?.focus();},[screen,metricId]);
 useEffect(()=>{
  if(!endsAt)return;
  const timer=window.setInterval(()=>{const remaining=Math.max(0,Math.ceil((endsAt-Date.now())/1000));setSeconds(remaining);if(!remaining)setEndsAt(0);},200);
  return()=>clearInterval(timer);
 },[endsAt]);

 function begin(id:string){
  setMetricId(id);setMode(undefined);setConfirmed(false);setContextError('');setChanged(false);
  setValues(baseline.values);setDetails(baseline.details);setRawInput(undefined);setLiftInputs(undefined);
  setEndsAt(0);setSeconds(30);setEditorEpoch(n=>n+1);
  const nextArea=baselineArea(id);
  if(nextArea){setPlan(current=>({...current,[nextArea]:id}));setSkipped(current=>current.filter(item=>item!==nextArea));}
  const selected=nextArea&&baselineChoices[nextArea];
  setUseForBaseline(!selected||selected.test===id);
  setScreen(profile?'record':'basics');
  captureEvent('journey_challenge_chosen');
 }
 function startMode(next:'existing'|'today'){
  setMode(next);setConfirmed(false);setRawInput(undefined);setLiftInputs(undefined);setContextError('');setChanged(false);setEditorEpoch(n=>n+1);
  if(next==='today'){
   setValues({...baseline.values,[metric.id]:undefined});
   const ctx=repeatDetails(baseline.details[metric.id]??{},new Date().toISOString());
   // The date and current age follow the user's explicit choice to test today.
   setDetails({...baseline.details,[metric.id]:{...ctx,ageAtMeasurement:profile?.age,protocol:undefined,method:undefined}});
  }else{setValues(baseline.values);setDetails(baseline.details);}
 }
 function save(){
  if(!profile||!changed&&!existingEligible||!!contextError||testContextError||!valid(metric,result)||mode==='today'&&!confirmed||endsAt)return;
  let next={...details};
  if(mode==='today')next={...next,[metric.id]:{...next[metric.id],measuredAt:new Date().toISOString(),ageAtMeasurement:profile.age}};
  try{next=normalizeMeasurementMetadata(next);}catch{setContextError(local('Review the test details.','Vérifie les détails du test.','راجع تفاصيل الاختبار.'));return;}
  const validValues=draftValues(values);
  const eligible=!!area&&!!baselineChallenge(metric.id,validValues,next,profile.sex);
  let selected=false,warning=false;
  if(useForBaseline&&eligible){
   try{const choices=saveBaselineChoice(localStorage,owner,metric.id,validValues,next,profile.sex);if(choices){setBaselineChoices(choices);selected=true;window.dispatchEvent(new Event('top1-baseline-updated'));}}
   catch{warning=true;}
  }
  if(!useForBaseline&&area){try{setBaselineChoices(clearBaselineChoice(localStorage,owner,metric.id));window.dispatchEvent(new Event('top1-baseline-updated'));}catch{warning=true;}}
  const change=resultChange(metric.id,previous,baseline.details[metric.id],result!,next[metric.id]??{});
  onSave(profile,validValues,next);
  setReport({metric,value:result!,details:next[metric.id]??{},profile,change,backdated:!!baseline.details[metric.id]?.measuredAt&&!!next[metric.id]?.measuredAt&&Date.parse(next[metric.id].measuredAt!)<Date.parse(baseline.details[metric.id].measuredAt!),baselineStatus:selected?'selected':area&&!eligible?'incomplete':'unselected',warning});
  setValues(validValues);setDetails(next);setBaseline({values:validValues,details:next});
  setRawInput(undefined);setLiftInputs(undefined);setScreen('result');clearCheckpoint(owner);
  captureEvent('journey_result_saved',{metric_id:metric.id});captureEvent('journey_reveal_viewed');
  if(change!==null)captureEvent('journey_retest_completed');
 }
 const pause=()=>{if(persist()){setEndsAt(0);onFinish();}};
 const footer=<button className="journey-back" onClick={pause}>{local('Pause and finish later','Mettre en pause et reprendre plus tard','توقف وتابع لاحقًا')}</button>;
 const warning=storageError&&<p className="field-error" role="alert">{local('This browser could not save your unfinished session. Keep this panel open until storage is available.','Ce navigateur n’a pas pu sauvegarder ta session. Garde ce panneau ouvert tant que le stockage est indisponible.','تعذّر حفظ جلستك غير المكتملة. أبقِ هذه اللوحة مفتوحة حتى يتوفر التخزين.')}</p>;
 const draftHint=<small className="journey-draft-note">{local('Unfinished entries stay in this browser for 7 days. They do not count as recorded results.','Les saisies inachevées restent 7 jours dans ce navigateur. Elles ne comptent pas comme résultats.','تبقى المدخلات غير المكتملة في هذا المتصفح 7 أيام ولا تُحتسب كنتائج مسجلة.')}</small>;

 if(screen==='choose')return <div ref={root} className="benchmark-journey baseline-journey">
  <h3 tabIndex={-1} data-journey-heading>{local('Build your baseline at your pace','Prépare ton profil à ton rythme','أكمل ملف أدائك بالوتيرة التي تناسبك')}</h3>
  <p>{local('Choose an alternative in each area. Start with one test; skip anything you cannot measure yet.','Choisis un test par domaine. Commence par un seul ; reporte ce que tu ne peux pas encore mesurer.','اختر اختبارًا لكل مجال. ابدأ بواحد وتجاوز ما لا يمكنك قياسه الآن.')}</p>
  <div className="baseline-planner">{baselineAreas.map(key=>{
   const id=plan[key],choice=baselineChoices[key],done=id&&choice?.test===id&&baselineChallenge(id,baseline.values,baseline.details,choice.sex);
   return <section key={key} className="baseline-plan-area" aria-labelledby={`baseline-plan-${key}`}><h4 id={`baseline-plan-${key}`}>{areaNames[key]}</h4>
    <label>{local('Your test','Ton test','اختبارك')}<select value={id??''} aria-label={local('Test for ','Test pour ','اختبار مجال ')+areaNames[key]} onChange={event=>{const value=event.target.value;setPlan(current=>({...current,[key]:value||undefined}));setSkipped(current=>current.filter(item=>item!==key));}}>
     <option value="">{local('Choose an alternative','Choisir une option','اختر بديلًا')}</option>
     {baselineTests[key].map(test=><option key={test} value={test}>{t(activeMetrics.find(item=>item.id===test)!.name)}</option>)}
    </select></label>
    <p>{done?local('Result included','Résultat inclus','النتيجة محتسبة'):skipped.includes(key)?local('Skipped in this session','Reporté pour cette session','متروك في هذه الجلسة'):local('Not yet included','Pas encore inclus','لم تُحتسب بعد')}</p>
    <div><button className="journey-next" disabled={!id} onClick={()=>id&&begin(id)}>{done?local('Review this test','Vérifier ce test','راجع هذا الاختبار'):local('Start this test','Commencer ce test','ابدأ هذا الاختبار')}</button>
     <button className="text-link" onClick={()=>{setPlan(current=>({...current,[key]:undefined}));setSkipped(current=>[...new Set([...current,key])]);}}>{local('Skip for now','Reporter','تجاوز الآن')}</button></div>
   </section>;
  })}</div>
  {onBrowse&&<button className="text-link" onClick={onBrowse}>{local('Browse all tests','Parcourir tous les tests','تصفّح جميع الاختبارات')}</button>}
  {draftHint}{warning}<div className="journey-actions">{footer}</div>
 </div>;

 if(screen==='basics')return <div ref={root} className="benchmark-journey baseline-journey">
  <h3 tabIndex={-1} data-journey-heading>{local('A little context for your test','Quelques informations pour ton test','بعض المعلومات لاختبارك')}</h3>
  <p>{t(metric.name)}</p>
  <p>{local('Age sets the reference context. Sex-specific comparisons are optional; leaving that choice blank keeps neutral challenge levels.','L’âge précise le contexte. La comparaison par sexe est facultative ; sans choix, les niveaux de défi restent neutres.','يحدد العمر سياق المقارنة. المقارنة حسب الجنس اختيارية، وتركها دون اختيار يبقي مستويات التحدي محايدة.')}</p>
  <div className="journey-profile">
   <label>{t('Age')}<input type="text" maxLength={99} inputMode="numeric" value={draft.age} aria-invalid={ageBad} onChange={event=>setDraft({...draft,age:event.target.value})}/></label>
   <label>{local('Reference group · optional','Groupe de référence · facultatif','المجموعة المرجعية · اختياري')}<select value={draft.sex||'unselected'} onChange={event=>setDraft({...draft,sex:event.target.value})}>
    <option value="unselected">{local('No sex-specific reference','Sans référence par sexe','دون مرجع حسب الجنس')}</option><option value="male">{t('Male')}</option><option value="female">{t('Female')}</option>
   </select></label>
   {lift&&<label>{local('Body weight at the test (kg)','Poids corporel au test (kg)','وزن الجسم عند الاختبار (كغ)')}<input type="text" maxLength={99} inputMode="decimal" value={testWeight} aria-label={local('Body weight at the test (kg)','Poids corporel au test (kg)','وزن الجسم عند الاختبار (كغ)')} aria-invalid={weightBad} onChange={event=>setTestWeight(event.target.value)}/><small>{local('Used to calculate this lift relative to bodyweight.','Utilisé pour calculer cette performance par rapport au poids corporel.','يُستخدم لحساب الأداء نسبةً إلى وزن الجسم.')}</small></label>}
  </div>
  {(ageBad||weightBad)&&<p className="field-error" role="alert">{local('Use a whole age from 18–120 and, if entered, bodyweight from 25–350 kg.','Indique un âge entier de 18 à 120 ans et, si renseigné, un poids de 25 à 350 kg.','أدخل عمرًا صحيحًا من 18 إلى 120 سنة ووزنًا من 25 إلى 350 كغ عند إدخاله.')}</p>}
  {warning}<div className="journey-actions">{footer}<button className="journey-next" disabled={!profile||lift&&!weightValid} onClick={()=>setScreen('record')}>{t('Continue')}</button></div>
 </div>;

 if(screen==='result'&&report)return <div ref={root} className="benchmark-journey baseline-journey">
  <JourneyResult report={report} owner={owner} onReview={()=>{setMode('existing');setChanged(false);setScreen('record');setEditorEpoch(n=>n+1);}} onNext={()=>setScreen('choose')} onHistory={()=>onHistory(metric.id)} onFinish={pause}/>
  <JourneyRetest owner={owner} metric={metric.id}/>
  {warning}
 </div>;

 return <div ref={root} className="benchmark-journey baseline-journey">
  <h3 tabIndex={-1} data-journey-heading>{t(metric.name)}</h3>
  {previous!==undefined&&<p>{local('Previous recorded result','Résultat enregistré précédent','النتيجة المسجلة السابقة')} · <bdi>{show(previous)}</bdi> {t(['run_5k','run_10k'].includes(metric.id)?'min:sec':metric.id==='total_sleep'?'h/night':metric.unit)}</p>}
  {!mode?<><p>{local('Use a result you already have or follow the protocol today. You do not need to retest now.','Utilise un résultat existant ou suis le protocole aujourd’hui. Tu n’es pas obligé de refaire le test.','استخدم نتيجة لديك أو اتبع البروتوكول اليوم. لا يلزمك إعادة الاختبار الآن.')}</p>
   <div className="journey-actions"><button className="journey-next" onClick={()=>startMode('existing')}>{local('Enter an existing result','Saisir un résultat existant','أدخل نتيجة سابقة')}</button>
   {metric.id!=='vo2_max'&&<button className="journey-back" onClick={()=>startMode('today')}>{local('Follow the protocol today','Suivre le protocole aujourd’hui','اتبع البروتوكول اليوم')}</button>}</div>
  </>:<>
   <details className="journey-method" open={mode==='today'?true:undefined}><summary>{t('How to measure')}</summary><p>{t(metric.proofData.instructions)}</p><p>{local('Keep your setup consistent. You can stop and return later, or choose an alternative.','Garde des conditions constantes. Tu peux t’arrêter et revenir plus tard, ou choisir un autre test.','حافظ على ظروف قياس متسقة. يمكنك التوقف والعودة لاحقًا أو اختيار بديل.')}</p></details>
   {resume?.mode==='today'&&mode==='today'&&metric.id==='sit_to_stand'&&<p>{local('The timer was reset after interruption. Restart it if you still need to complete the test.','Le chrono a été réinitialisé après l’interruption. Relance-le si le test reste à réaliser.','أُعيد ضبط المؤقت بعد الانقطاع. أعد تشغيله إذا لم تكمل الاختبار بعد.')}</p>}
   {mode==='today'&&metric.id==='sit_to_stand'&&<div className="journey-timer"><output aria-label={local('Seconds remaining','Secondes restantes','الثواني المتبقية')}><bdi>0:{String(seconds).padStart(2,'0')}</bdi></output><button className="journey-back" onClick={()=>{setSeconds(30);setEndsAt(endsAt?0:Date.now()+30000);}}><Timer size={16}/>{endsAt?local('Reset timer','Réinitialiser','إعادة ضبط المؤقت'):local('Start timer','Lancer le chrono','ابدأ المؤقت')}</button>{seconds===0&&<p role="status">{local('Time’s up','Temps écoulé','انتهى الوقت')}</p>}</div>}
   {profile&&<MetricEditor loadUnit={loadUnit} key={metric.id+editorEpoch} dashboardCard showDetails expandDetails={false} hideGameBand metric={metric} value={result} details={details[metric.id]} demographics={lift?{...profile,weight:weightValid?testWeightNumber:undefined}:profile}
    initialRaw={rawInput} onRawChange={setRawInput} initialLiftInputs={liftInputs} onLiftInputs={setLiftInputs}
    onValue={(id,raw)=>{setChanged(true);setValues(current=>({...current,[id]:raw.trim()?Number(raw):undefined}));setDetails(current=>({...current,[id]:{...current[id],measuredAt:mode==='existing'&&current[id]?.measuredAt===baseline.details[id]?.measuredAt?undefined:current[id]?.measuredAt,derivation:lift?current[id]?.derivation:undefined}}));}}
    onDetails={(id,next)=>{setChanged(true);setDetails(current=>({...current,[id]:next}));}}
    onEvidence={()=>{}} onProfile={()=>setScreen('basics')} onContextError={(_,error)=>setContextError(error)}/>}
   <div className="journey-essential">
    {mode==='existing'&&<label>{local('Test date · optional','Date du test · facultative','تاريخ الاختبار · اختياري')}<input type="date" value={details[metric.id]?.measuredAt?.slice(0,10)??''} onChange={e=>{const day=e.target.value;setChanged(true);setDetails(d=>({...d,[metric.id]:{...d[metric.id],measuredAt:day?new Date(`${day}T12:00:00`).toISOString():undefined}}));}}/></label>}
    {protocolOptions[metric.id]&&<label>{local('Test setup · optional','Protocole · facultatif','طريقة الاختبار · اختياري')}<select value={details[metric.id]?.protocol?.id??''} onChange={e=>{setChanged(true);setDetails(d=>({...d,[metric.id]:{...d[metric.id],protocol:e.target.value?{id:e.target.value}:undefined}}));}}><option value="">{local('Not recorded','Non renseigné','غير مسجل')}</option>{protocolOptions[metric.id].map(p=><option key={p.id} value={p.id}>{t(p.label)}</option>)}</select></label>}
   </div>

   <p className="journey-context-hint">{local('Add test details for a published comparison. You can save your result without completing a full baseline.','Ouvre les détails pour renseigner méthode, protocole, date et âge au test. Le profil équilibré nécessite ces informations.','افتح تفاصيل الاختبار لتسجيل الطريقة والبروتوكول والتاريخ والعمر عند الاختبار. احتساب النتيجة يحتاج هذا السياق.')}</p>
   {mode==='today'&&<label className="journey-confirmation"><input type="checkbox" checked={confirmed} onChange={event=>{setConfirmed(event.target.checked);setChanged(true);}}/>{local('I completed this test today using the recorded protocol.','J’ai réalisé ce test aujourd’hui selon le protocole indiqué.','أكملت هذا الاختبار اليوم باستخدام البروتوكول المسجل.')}</label>}
   {area&&<label className="journey-confirmation"><input type="checkbox" checked={useForBaseline} onChange={event=>{setUseForBaseline(event.target.checked);setChanged(true);}}/>{local('Use this result for my ','Utiliser ce résultat pour : ','استخدم هذه النتيجة لمجال ')}{areaNames[area]}</label>}
   {contextError&&<p className="field-error" role="alert">{t(contextError)}</p>}
   <button className="journey-next journey-save" disabled={!profile||!changed&&!existingEligible||!!contextError||testContextError||!valid(metric,result)||mode==='today'&&!confirmed||!!endsAt} onClick={save}><Check size={18}/>{local('Save my result','Enregistrer mon résultat','احفظ نتيجتي')}</button>
  </>}
  {draftHint}{warning}<div className="journey-actions"><button className="journey-back" onClick={()=>{setEndsAt(0);setMode(undefined);setScreen('choose');}}>{local('Choose another test','Choisir un autre test','اختر اختبارًا آخر')}</button>{footer}</div>
 </div>;
}
