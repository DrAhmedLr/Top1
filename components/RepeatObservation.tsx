'use client';
import {useTranslations} from '@/components/providers/LocaleProvider';
import {useState} from 'react';
import MetricEditor from './MetricEditor';
import MetricCalculator from './MetricCalculator';
import {repeatDetails} from '@/lib/observationPresentation';
import {valid} from '@/lib/engine';
import type {Metric,Demographics} from '@/lib/registry';
import type {MeasurementDetails} from '@/lib/measurementMetadata';
export default function RepeatObservation({metric,value,details,demographics,onFinish}:{metric:Metric;value:number;details:MeasurementDetails;demographics:Demographics;onFinish:(value:number,details:MeasurementDetails)=>void}){
 const {t:tr}=useTranslations();

 const [next,setNext]=useState(value),[context,setContext]=useState(()=>repeatDetails(details,new Date().toISOString())),[error,setError]=useState(''),[proof,setProof]=useState(false),[calculator,setCalculator]=useState(false);
 if(calculator)return <><MetricCalculator metric={metric} demographics={demographics} onUse={(v,d)=>{setNext(v);setContext({...d,measuredAt:context.measuredAt});setCalculator(false);setError('');}}/><button className="text-link" onClick={()=>setCalculator(false)}>{tr("Back to observation")}</button></>;
 return <><p>{tr("Record this only after repeating the test. Review the copied value and equipment. Enter new calculation inputs, test age or averaging window where appropriate; the previous inputs have been cleared.")}</p><MetricEditor metric={metric} value={next} details={context} demographics={demographics} onValue={(_id,raw)=>{setNext(Number(raw));setContext(d=>({...d,derivation:undefined}));}} onDetails={(_id,d)=>setContext(d)} onContextError={(_id,e)=>setError(e)} onEvidence={()=>setProof(v=>!v)} onCalculate={()=>setCalculator(true)}/>{proof&&<div className="proof-block"><h3>{tr("Evidence and method")}</h3><p>{tr(metric.proofData.rationale)}</p><p>{tr(metric.proofData.instructions)}</p><p>{tr(metric.proofData.study)}. {tr(metric.proofData.sampleSize)}</p>{metric.proofData.url&&<a href={metric.proofData.url} target="_blank" rel="noreferrer">{tr("Read the source")}</a>}</div>}<button className="primary-button" disabled={!valid(metric,next)||!!error} onClick={()=>onFinish(next,context)}>{tr("Save reviewed observation")}</button></>;
}
