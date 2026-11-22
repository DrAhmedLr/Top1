'use client';
import {parseMeasurementInput} from '@/lib/measurementInput';
import {useEffect,useRef,useState} from 'react';
import {useTranslations} from './providers/LocaleProvider';
import {epley,weightedPullupRatio,valid} from '@/lib/engine';
import type {Metric} from '@/lib/registry';
import type {MeasurementDetails} from '@/lib/measurementMetadata';

export default function StrengthEquation({loadUnit='kg',metric,weight:profileWeight,value,details,disabled,onUse,onProfile,onClear,grouped=false,onValidityChange,initialInputs,onInputsChange}:{loadUnit?:'kg'|'lb';initialInputs?:{load:string;reps:string};onInputsChange?:(inputs:{load:string;reps:string})=>void;metric:Metric;weight?:number;value?:number;details:MeasurementDetails;disabled:boolean;onUse:(value:number,details:MeasurementDetails)=>void;onProfile?:()=>void;onClear:()=>void;grouped?:boolean;onValidityChange?:(invalid:boolean)=>void}){
 const {t}=useTranslations(),derivation=details.derivation;
 const factor=loadUnit==='lb'?0.45359237:1;
 const [load,setLoad]=useState(initialInputs?.load?String(Number(initialInputs.load)/factor):derivation?String(derivation.inputs[0]/factor):''),[reps,setReps]=useState(initialInputs?.reps??(derivation?String(derivation.inputs[1]):'1'));
 const pullup=metric.id==='pullup_1rm';
 const loadNumber=Number(parseMeasurementInput(load,factor)),repNumber=Number(parseMeasurementInput(reps)),complete=load.trim()!==''&&reps.trim()!=='';
 const sameInputs=derivation?.inputs[0]===loadNumber&&derivation.inputs[1]===repNumber;
 const weight=sameInputs?derivation.bodyWeightKg??profileWeight:profileWeight;
 const bodyWeightValid=weight!==undefined&&weight>=25&&weight<=350;
 let result:number|undefined;
 if(complete&&bodyWeightValid&&Number.isFinite(loadNumber)&&loadNumber>=(pullup?0:1)&&Number.isInteger(repNumber)&&repNumber>=1&&repNumber<=10){try{const n=pullup?weightedPullupRatio(loadNumber,repNumber,weight):epley(loadNumber,repNumber)/weight;if(valid(metric,n))result=Number(n.toFixed(3));}catch{}}
 const validityCallback=useRef(onValidityChange);validityCallback.current=onValidityChange;
 useEffect(()=>{validityCallback.current?.((load.trim()!==''||reps!=='1')&&result===undefined);},[load,reps,result]);
 const previousValue=useRef(value),clearingInput=useRef(false);
 const changed=result!==undefined&&(result!==value||derivation?.inputs[0]!==loadNumber||derivation?.inputs[1]!==repNumber||derivation?.bodyWeightKg!==weight);
 useEffect(()=>{
  const cleared=previousValue.current!==undefined&&value===undefined;
  previousValue.current=value;
  const fromInput=clearingInput.current;clearingInput.current=false;
  if(cleared){if(!fromInput){setLoad('');setReps('1');}return;}
  if(disabled||!changed||result===undefined||!bodyWeightValid)return;
  onUse(result,{...details,measuredAt:undefined,method:repNumber===1?'direct_1rm':'epley_estimate',source:'manual',derivation:{formula:pullup?'pullup_ratio_v1':'epley_ratio_v1',inputs:[loadNumber,repNumber],bodyWeightKg:weight}});
 },[value,disabled,changed,result,bodyWeightValid,details,repNumber,pullup,loadNumber,weight,onUse]);
 return <div className="strength-equation">
  <div className="equation-inputs"><label>{t(pullup?'Added load':'Weight lifted')} ({loadUnit})<input type="text" inputMode="decimal" disabled={disabled} value={load} placeholder="—" onChange={e=>{setLoad(e.target.value);onInputsChange?.({load:parseMeasurementInput(e.target.value,factor),reps});if(!e.target.value.trim()){clearingInput.current=true;onClear();}}}/></label><label>{t('Repetitions (1–10)')}<input type="number" inputMode="numeric" min={1} max={10} step={1} disabled={disabled} value={reps} onChange={e=>{setReps(e.target.value);onInputsChange?.({load:parseMeasurementInput(load,factor),reps:e.target.value});if(!e.target.value.trim()){clearingInput.current=true;onClear();}}}/></label></div>
  <div className="equation-result"><span>{t('Estimated max')}</span><output aria-live="polite"><bdi>{result===undefined?'—':result.toFixed(2)}</bdi> <small>{t(pullup?'× BW added':'× BW')}</small></output></div>
  {!grouped&&<p className="equation-weight">{t('Body weight')}: <bdi>{bodyWeightValid?`${weight} kg`:'—'}</bdi>{onProfile&&<button className="text-link" onClick={onProfile}>{t(bodyWeightValid?'Edit':'Add body weight')}</button>}</p>}
  {complete&&result===undefined&&bodyWeightValid&&<p className="field-error" role="alert">{t('Use a valid weight and 1–10 whole repetitions within this test’s range.')}</p>}
  {!bodyWeightValid&&<p className="equation-hint">{t('Add your body weight in your profile to calculate this result.')}</p>}
  {value!==undefined&&!derivation&&<p className="equation-hint">{t('Your previous result is kept until you enter a valid calculation.')} <bdi>{value.toFixed(2)} {t(metric.unit)}</bdi></p>}

 </div>;
}
