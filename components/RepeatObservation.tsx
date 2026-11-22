'use client';
import {useTranslations} from '@/components/providers/LocaleProvider';
import {useRef,useState} from 'react';
import MetricEditor from './MetricEditor';
import MetricCalculator from './MetricCalculator';
import {repeatDetails} from '@/lib/observationPresentation';
import {COMPETITIVE_CHALLENGE_METRICS} from '@/lib/competitiveMetrics';
import {withPerformanceProfile} from '@/lib/performanceContext';
import type {OverallSaveChange} from '@/lib/overallPerformance';
import OverallChangeResult from './OverallChangeResult';
import {valid} from '@/lib/engine';
import type {Metric,Demographics} from '@/lib/registry';
import type {MeasurementDetails} from '@/lib/measurementMetadata';
export default function RepeatObservation({metric,value,details,demographics,onDone,onFinish}:{metric:Metric;value:number;details:MeasurementDetails;demographics:Demographics;onDone:()=>void;onFinish:(value:number,details:MeasurementDetails)=>Promise<OverallSaveChange|null>}){
 const {t:tr,locale}=useTranslations();
 const [busy,setBusy]=useState(false),[saveError,setSaveError]=useState(''),lock=useRef(false);

 const [next,setNext]=useState(value),[context,setContext]=useState(()=>repeatDetails(details,new Date().toISOString())),[error,setError]=useState(''),[proof,setProof]=useState(false),[calculator,setCalculator]=useState(false);
 const [savedChange,setSavedChange]=useState<OverallSaveChange|null>(null);
 if(savedChange)return <section><OverallChangeResult change={savedChange}/><button className="primary-button" onClick={onDone}>{tr('Done')}</button></section>;
 if(calculator)return <><MetricCalculator metric={metric} demographics={demographics} onUse={(v,d)=>{setNext(v);setContext({...d,measuredAt:context.measuredAt});setCalculator(false);setError('');}}/><button className="text-link" onClick={()=>setCalculator(false)}>{tr("Back to observation")}</button></>;
 async function record() {
  if(lock.current)return;
  if(context.measuredAt&&details.measuredAt&&Date.parse(context.measuredAt)===Date.parse(details.measuredAt)){
   setSaveError(locale==='fr'?'Indique la date et l’heure de ce nouveau test.':locale==='ar'?'أدخل تاريخ ووقت الاختبار الجديد.':'Enter the date and time of the new test.');
   return;
  }
  lock.current=true;setBusy(true);setSaveError('');
  try {
   const testedToday=!!context.measuredAt&&new Date(context.measuredAt).toDateString()===new Date().toDateString();
   const snapshot=COMPETITIVE_CHALLENGE_METRICS.has(metric.id)?withPerformanceProfile(metric.id,context,{
    age:context.ageAtMeasurement??(testedToday?demographics.age:undefined),
    sex:context.protocol?.referenceSex??demographics.sex,
    weight:context.protocol?.bodyWeightKg,
   }):context;
   const change=await onFinish(next,snapshot);
   if(change)setSavedChange(change);
  }
  catch(reason){setSaveError(reason instanceof Error?reason.message:'Unable to save.');}
  finally {lock.current=false;setBusy(false);}
 }
 return <fieldset className="retest-form" disabled={busy}><p>{tr("Record this only after repeating the test. Review the copied value and equipment. Enter new calculation inputs, test age or averaging window where appropriate; the previous inputs have been cleared.")}</p><MetricEditor metric={metric} value={next} details={context} demographics={demographics} onValue={(_id,raw)=>{setNext(raw.trim()?Number(raw):NaN);setContext(d=>({...d,derivation:undefined}));}} onDetails={(_id,d)=>setContext(d)} onContextError={(_id,e)=>setError(e)} onEvidence={()=>setProof(v=>!v)} onCalculate={()=>setCalculator(true)}/>{proof&&<div className="proof-block"><h3>{tr("Evidence and method")}</h3><p>{tr(metric.proofData.rationale)}</p><p>{tr(metric.proofData.instructions)}</p><p>{tr(metric.proofData.study)}. {tr(metric.proofData.sampleSize)}</p>{metric.proofData.url&&<a href={metric.proofData.url} target="_blank" rel="noreferrer">{tr("Read the source")}</a>}</div>}<p className="retest-date">{locale==='fr'?'Date du test':locale==='ar'?'تاريخ الاختبار':'Test date'} <time dateTime={context.measuredAt}>{context.measuredAt?new Date(context.measuredAt).toLocaleString(locale):tr('Unknown')}</time></p>{saveError&&<p className="field-error" role="alert">{tr(saveError)}</p>}<button className="primary-button" disabled={busy||!valid(metric,next)||!!error||!context.measuredAt} onClick={()=>void record()}>{tr(busy?'Saving…':'Save reviewed observation')}</button></fieldset>;
}
