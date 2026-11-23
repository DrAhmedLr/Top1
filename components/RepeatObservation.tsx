'use client';
import {useTranslations} from '@/components/providers/LocaleProvider';
import {useRef,useState} from 'react';
import MetricEditor from './MetricEditor';
import MetricCalculator from './MetricCalculator';
import {comparableTest} from '@/lib/history';
import {goalValue,type GoalUnit} from '@/lib/adaptiveProgram';
import {repeatDetails} from '@/lib/observationPresentation';
import {COMPETITIVE_CHALLENGE_METRICS} from '@/lib/competitiveMetrics';
import {withPerformanceProfile} from '@/lib/performanceContext';
import type {OverallSaveChange} from '@/lib/overallPerformance';
import OverallChangeResult from './OverallChangeResult';
import {valid} from '@/lib/engine';
import type {Metric,Demographics} from '@/lib/registry';
import type {MeasurementDetails} from '@/lib/measurementMetadata';
export default function RepeatObservation({metric,value,details,demographics,goalUnit,onDone,onFinish}:{metric:Metric;value?:number;details:MeasurementDetails;demographics?:Demographics;goalUnit?:GoalUnit;onDone:()=>void;onFinish:(value:number,details:MeasurementDetails,profile:Demographics)=>Promise<OverallSaveChange|null>}){
 const {t:tr,locale}=useTranslations();
 const [busy,setBusy]=useState(false),[saveError,setSaveError]=useState(''),lock=useRef(false);

 const [next,setNext]=useState(value),[context,setContext]=useState(()=>repeatDetails(details,new Date().toISOString())),[error,setError]=useState(''),[proof,setProof]=useState(false),[calculator,setCalculator]=useState(false);
 const [newAge,setNewAge]=useState(''),[confirmedAge,setConfirmedAge]=useState(false);
 const age=Number(newAge);
 const person=demographics??(Number.isInteger(age)&&age>=18&&age<=120?{age,sex:'unselected' as const}:undefined);
 const l=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const eligible=valid(metric,next)&&(!goalUnit||(comparableTest({metricId:metric.id,value:next,...context})&&goalValue(metric,goalUnit,next,context)!==undefined));
 const [savedChange,setSavedChange]=useState<OverallSaveChange|null>(null);
 if(savedChange)return <section><OverallChangeResult change={savedChange}/><button className="primary-button" onClick={onDone}>{tr('Done')}</button></section>;
 if(!person||(!demographics&&!confirmedAge))return <form onSubmit={e=>{e.preventDefault();if(person)setConfirmedAge(true);}}>
   <label>{l('Your age in years','Ton âge en années','عمرك بالسنوات')}<input type="number" value={newAge} min={18} max={120} required onChange={e=>setNewAge(e.target.value)}/></label>
   <button type="submit" className="primary-button" disabled={!person}>{l('Continue to the test','Continuer vers le test','متابعة إلى الاختبار')}</button>
 </form>;
 if(calculator)return <><MetricCalculator metric={metric} demographics={person} onUse={(v,d)=>{setNext(v);setContext({...context,...d,measuredAt:context.measuredAt});setCalculator(false);setError('');}}/><button className="text-link" onClick={()=>setCalculator(false)}>{tr("Back to observation")}</button></>;
 async function record() {
  if(lock.current||!person||!valid(metric,next)||!eligible)return;
  if(context.measuredAt&&details.measuredAt&&Date.parse(context.measuredAt)===Date.parse(details.measuredAt)){
   setSaveError(locale==='fr'?'Indique la date et l’heure de ce nouveau test.':locale==='ar'?'أدخل تاريخ ووقت الاختبار الجديد.':'Enter the date and time of the new test.');
   return;
  }
  lock.current=true;setBusy(true);setSaveError('');
  try {
   const testedToday=!!context.measuredAt&&new Date(context.measuredAt).toDateString()===new Date().toDateString();
   const snapshot=COMPETITIVE_CHALLENGE_METRICS.has(metric.id)?withPerformanceProfile(metric.id,context,{
    age:context.ageAtMeasurement??(testedToday?person.age:undefined),
    sex:context.protocol?.referenceSex??person.sex,
    weight:context.protocol?.bodyWeightKg,
   }):context;
   const change=await onFinish(next,snapshot,person);
   if(change)setSavedChange(change);
  }
  catch(reason){setSaveError(reason instanceof Error?reason.message:'Unable to save.');}
  finally {lock.current=false;setBusy(false);}
 }
 return <fieldset className="retest-form" disabled={busy}>
  <p>{goalUnit
   ?l('Enter your measured result, test method and setup. Use the same setup for future tests.','Saisis le résultat mesuré, la méthode et le protocole. Garde le même protocole aux prochains tests.','أدخل النتيجة المقاسة والطريقة وإعدادات الاختبار. استخدم الإعدادات نفسها في الاختبارات القادمة.')
   :tr("Record this only after repeating the test. Review the copied value and equipment. Enter new calculation inputs, test age or averaging window where appropriate; the previous inputs have been cleared.")}</p>
  <MetricEditor showDetails={!!goalUnit} expandDetails={!!goalUnit} metric={metric} value={next} details={context} demographics={person}
   onValue={(_id,raw)=>{setNext(raw.trim()?Number(raw):undefined);setContext(d=>({...d,derivation:undefined}));}}
   onDetails={(_id,d)=>setContext(d)} onContextError={(_id,e)=>setError(e)}
   onEvidence={()=>setProof(v=>!v)} onCalculate={()=>setCalculator(true)}/>
  {proof&&<div className="proof-block">
   <h3>{tr("Evidence and method")}</h3><p>{tr(metric.proofData.rationale)}</p><p>{tr(metric.proofData.instructions)}</p>
   <p>{tr(metric.proofData.study)}. {tr(metric.proofData.sampleSize)}</p>
   {metric.proofData.url&&<a href={metric.proofData.url} target="_blank" rel="noreferrer">{tr("Read the source")}</a>}
  </div>}
  <p className="retest-date">{l('Test date','Date du test','تاريخ الاختبار')} <time dateTime={context.measuredAt}>
   {context.measuredAt?new Date(context.measuredAt).toLocaleString(locale):tr('Unknown')}
  </time></p>
  {goalUnit==='kg'&&!context.derivation?.bodyWeightKg&&!context.protocol?.bodyWeightKg&&
   <p>{l('Record your body weight at the test to compare this lift in kilograms.','Indique ton poids au moment du test pour comparer la charge en kilogrammes.','أدخل وزن جسمك وقت الاختبار لمقارنة حمل الرفع بالكيلوغرام.')}</p>}
  {saveError&&<p className="field-error" role="alert">{tr(saveError)}</p>}
  <button className="primary-button" disabled={busy||!eligible||!!error||!context.measuredAt} onClick={()=>void record()}>
   {tr(busy?'Saving…':'Save reviewed observation')}
  </button>
 </fieldset>;
}
