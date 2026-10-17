'use client';
import {useState} from 'react';
import {useTranslations} from './providers/LocaleProvider';
import {epley,weightedPullupRatio,valid} from '@/lib/engine';
import type {Metric} from '@/lib/registry';
import type {MeasurementDetails} from '@/lib/measurementMetadata';

export default function StrengthEquation({metric,weight,value,details,disabled,onUse,onProfile}:{metric:Metric;weight?:number;value?:number;details:MeasurementDetails;disabled:boolean;onUse:(value:number,details:MeasurementDetails)=>void;onProfile?:()=>void}){
 const {t}=useTranslations(),derivation=details.derivation;
 const [load,setLoad]=useState(derivation?String(derivation.inputs[0]):''),[reps,setReps]=useState(derivation?String(derivation.inputs[1]):'1');
 const pullup=metric.id==='pullup_1rm',bodyWeightValid=weight!==undefined&&weight>=25&&weight<=350;
 const loadNumber=Number(load),repNumber=Number(reps),complete=load.trim()!==''&&reps.trim()!=='';
 let result:number|undefined;
 if(complete&&bodyWeightValid&&Number.isFinite(loadNumber)&&loadNumber>=(pullup?0:1)&&Number.isInteger(repNumber)&&repNumber>=1&&repNumber<=10){try{const n=pullup?weightedPullupRatio(loadNumber,repNumber,weight):epley(loadNumber,repNumber)/weight;if(valid(metric,n))result=Number(n.toFixed(3));}catch{}}
 const changed=result!==undefined&&(result!==value||derivation?.inputs[0]!==loadNumber||derivation?.inputs[1]!==repNumber||derivation?.bodyWeightKg!==weight);
 return <div className="strength-equation">
  <div className="equation-inputs"><label>{t(pullup?'Added load (kg)':'Weight lifted (kg)')}<input type="number" inputMode="decimal" min={pullup?0:1} step="any" disabled={disabled} value={load} placeholder="—" onChange={e=>setLoad(e.target.value)}/></label><span aria-hidden="true">·</span><label>{t('Repetitions (1–10)')}<input type="number" inputMode="numeric" min={1} max={10} step={1} disabled={disabled} value={reps} onChange={e=>setReps(e.target.value)}/></label></div>
  <p className="equation-hint">{t(pullup?'Estimated added max ÷ body weight':'Estimated one-rep max ÷ body weight')}</p>
  <div className="equation-result"><span aria-hidden="true">=</span><output aria-live="polite"><bdi>{result===undefined?'—':result.toFixed(2)}</bdi> <small>{t(pullup?'× BW added':'× BW')}</small></output></div>
  <p className="equation-weight">{t('Body weight')}: <bdi>{bodyWeightValid?`${weight} kg`:'—'}</bdi>{onProfile&&<button className="text-link" onClick={onProfile}>{t(bodyWeightValid?'Edit':'Add body weight')}</button>}</p>
  {complete&&result===undefined&&bodyWeightValid&&<p className="field-error" role="alert">{t('Use a valid weight and 1–10 whole repetitions within this test’s range.')}</p>}
  {!bodyWeightValid&&<p className="equation-hint">{t('Add your body weight in your profile to calculate this result.')}</p>}
  {value!==undefined&&!derivation&&<p className="equation-hint">{t('Your previous result is kept until you save a new calculation.')} <bdi>{value.toFixed(2)} {t(metric.unit)}</bdi></p>}
  <button className="equation-save" disabled={disabled||!changed} onClick={()=>{if(result===undefined||!bodyWeightValid)return;onUse(result,{...details,method:repNumber===1?'direct_1rm':'epley_estimate',source:'manual',derivation:{formula:pullup?'pullup_ratio_v1':'epley_ratio_v1',inputs:[loadNumber,repNumber],bodyWeightKg:weight}});}}>{t(changed?'Save result':value!==undefined&&result===value?'Result saved':'Enter your lift')}</button>
 </div>;
}
