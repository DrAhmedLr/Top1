'use client';
import LabUnitHelper from './LabUnitHelper';
import {protocolOptions,type MeasurementProtocol} from '@/lib/protocols';

import { useEffect, useId, useRef, useState } from 'react';
import { Star, Calculator, Check, ChevronDown, CircleHelp } from 'lucide-react';
import { parseMeasurementInput } from '@/lib/measurementInput';
import { eligible, scoringEligibility, valid,score } from '@/lib/engine';
import {normalizeMeasurementMetadata, type MeasurementDetails, type MeasurementMethod, type ExerciseMode } from '@/lib/measurementMetadata';
import {allowedMethods,countMetrics,observationAge} from '@/lib/measurementRules';
import type { Demographics, Metric } from '@/lib/registry';

const methodLabels: Record<MeasurementMethod, string> = {
  manual: 'Manual observation', lab: 'Laboratory test', direct_cpet: 'Direct CPET',
  cooper_estimate: 'Cooper run estimate', wearable_estimate: 'Wearable estimate',
  dynamometer_single_hand: 'Single-hand dynamometer', dexa: 'DEXA scan',
  skinfold_estimate: 'Skinfold estimate', direct_1rm: 'Measured one-rep max',
  epley_estimate: 'Estimated one-rep max (Epley)', device: 'Device measurement',
};
const calculators = new Set(['vo2_max', 'body_fat', 'squat_1rm', 'deadlift_1rm', 'bench_1rm', 'pullup_1rm']);

export default function MetricEditor({ favorite,onFavorite,metric: m, value, details = {}, demographics, onValue, onDetails, onEvidence, onCalculate, compact = false, readOnly = false, onEditingChange,onContextError }: {
  favorite?:boolean;onFavorite?:()=>void;metric: Metric; value: number | undefined; details?: MeasurementDetails; demographics: Demographics;
  onValue: (id: string, raw: string) => void;
  onDetails: (id: string, details: MeasurementDetails) => void;
  onEvidence: (metric: Metric) => void; onCalculate: (metric: Metric) => void;
  compact?: boolean; readOnly?: boolean; onEditingChange?: (id: string | null) => void;onContextError?:(id:string,error:string)=>void;
}) {
  const [testAge, setTestAge] = useState(String(details.ageAtMeasurement ?? ''));
  const [testAgeError, setTestAgeError] = useState(false);
  useEffect(() => { setTestAge(String(details.ageAtMeasurement ?? '')); setTestAgeError(false); }, [details.ageAtMeasurement]);
  const sleep = m.id === 'total_sleep';
  const shownUnit = sleep ? 'h/night' : m.unit;
  const shownValue = sleep && value !== undefined ? Number((value / 60).toFixed(3)) : value;
  const inputId = useId();
  const focused = useRef(false);
  const [raw, setRaw] = useState(shownValue === undefined ? '' : String(shownValue));
  useEffect(() => { if (!focused.current) setRaw(shownValue === undefined ? '' : String(shownValue)); }, [shownValue]);
  const [contextError,setContextError]=useState(''),rawErrors=useRef<Record<string,string>>({});
  function rawError(field:string,message:string){rawErrors.current={...rawErrors.current,[field]:message};const all=Object.values(rawErrors.current).filter(Boolean).join(' ');setContextError(all);onContextError?.(m.id,all);}
  const [chairHeight,setChairHeight]=useState(String(details.protocol?.chairHeightCm??''));
  useEffect(()=>{setChairHeight(String(details.protocol?.chairHeightCm??''));},[details.protocol?.chairHeightCm]);
  const localDate=(date?:string)=>date?new Date(Date.parse(date)-new Date(date).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
  const [windowDraft,setWindowDraft]=useState({start:localDate(details.window?.start),end:localDate(details.window?.end),samples:String(details.window?.sampleCount??7)});
  useEffect(()=>{setWindowDraft({start:localDate(details.window?.start),end:localDate(details.window?.end),samples:String(details.window?.sampleCount??7)});},[details.window]);
  function updateWindow(patch:Partial<typeof windowDraft>){const next={...windowDraft,...patch};setWindowDraft(next);if(!next.start||!next.end||!next.samples){rawError('window','Complete the window dates and sample count, or clear the window.');return;}try{updateDetails({...details,window:{start:new Date(next.start).toISOString(),end:new Date(next.end).toISOString(),sampleCount:Number(next.samples),statistic:['sauna_minutes','cold_plunge_minutes'].includes(m.id)?'total':'mean'}},'window');}catch{rawError('window','Check the averaging window.');}}
  function updateDetails(next:MeasurementDetails,field='detail'){try{normalizeMeasurementMetadata({[m.id]:next});rawError(field,'');onDetails(m.id,next);}catch(e){rawError(field,e instanceof Error?e.message:'Check the measurement details.');}}
  const low = sleep ? m.min / 60 : m.min, high = sleep ? m.max / 60 : m.max;
  const starterInstructions: Record<string, string> = { pushups: 'Count consecutive strict push-ups. Stop when you can no longer keep the same form.', sit_to_stand: 'Count full stands from a chair in 30 seconds. Use the same chair and technique each time.', total_sleep: 'Enter your average hours of sleep per night over the last seven days.' };
  const bad = value !== undefined && !valid(m, value);
  const scored = eligible(m, demographics, { [m.id]: details });
  const eligibility = scoringEligibility(m, demographics, { [m.id]: details });
  const measuredAt = details.measuredAt && Number.isFinite(Date.parse(details.measuredAt))
    ? new Date(Date.parse(details.measuredAt) - new Date(details.measuredAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  return <div data-metric-id={m.id} className={`metric-row ${m.pillar} ${compact ? 'compact-row' : ''}`} onFocusCapture={() => onEditingChange?.(m.id)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onEditingChange?.(null); }}>
    <div className="metric-label">
      <label htmlFor={inputId}>{m.name}</label>
      <span id={`${inputId}-hint`} className={compact ? "metric-description" : "sr-only"}>{compact ? starterInstructions[m.id] ?? m.proofData.instructions : `Optional. Enter ${shownUnit} or leave blank if unmeasured.`}</span>
      {!compact && <span className={`metric-kind ${scored ? 'scored' : ''}`}>{scored ? m.id==='vo2_max'?'Published CPET reference':'Provisional model' : 'Tracking only'}</span>}
    </div>
    <div className="metric-controls">{onFavorite&&<button className="icon-button" aria-label={`${favorite?"Remove":"Add"} ${m.name} ${favorite?"from":"to"} favorites`} aria-pressed={!!favorite} onClick={onFavorite}><Star size={18} fill={favorite?"currentColor":"none"}/></button>}
      {valid(m, value) && <Check size={15} className="measured-check" aria-label="Recorded"/>}
      <div className={`input-unit ${bad ? 'invalid' : ''}`}>
        <input id={inputId} type="text" inputMode={countMetrics.has(m.id)?"numeric":"decimal"} value={raw} placeholder="—" disabled={readOnly} aria-invalid={bad} aria-describedby={bad ? `${inputId}-error` : `${inputId}-hint`} onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; }} onChange={e => { setRaw(e.target.value); onValue(m.id, parseMeasurementInput(e.target.value, sleep ? 60 : 1)); }}/>

        <span>{shownUnit}</span>
      </div>
      {!compact && <>
        {calculators.has(m.id) && <button className="icon-button" aria-label={`Calculate ${m.name}`} title="Calculate an estimate" onClick={() => onCalculate(m)}><Calculator size={18}/></button>}
        <button className="icon-button" aria-label={`Evidence for ${m.name}`} title="How to measure & evidence" onClick={() => onEvidence(m)}><CircleHelp size={18}/></button>
      </>}
    </div>
    {compact && <details className="starter-evidence"><summary><CircleHelp size={14}/> How to measure & evidence</summary><p>{m.proofData.instructions}</p><p>{m.proofData.study}. {m.proofData.sampleSize}</p>{m.proofData.url && <a className="text-link" href={m.proofData.url} target="_blank" rel="noreferrer">Read the source</a>}</details>}
    {!compact && <details className="measurement-details">
      <summary aria-label={`Method and date for ${m.name}`}><ChevronDown size={13}/> Measurement method & date {m.id === 'vo2_max' && !scored && <span>Required for VO₂ scoring</span>}</summary>
      {details.invalidContext&&<p role="alert">Stored measurement details need review. Original context remains in history/export. <button className="text-link" disabled={readOnly} onClick={()=>updateDetails({invalidContext:undefined})}>Keep value and clear unreadable details</button></p>}
      <div className="measurement-context">
        {protocolOptions[m.id]&&<label>Test protocol<select disabled={readOnly} aria-label={`Protocol for ${m.name}`} value={details.protocol?.id??''} onChange={e=>updateDetails({...details,protocol:e.target.value?{id:e.target.value}:undefined})}><option value="">Unknown / not recorded</option>{protocolOptions[m.id].map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>}
        {details.protocol&&<>
          <label>Equipment / task label<input disabled={readOnly} maxLength={60} aria-label={`Equipment for ${m.name}`} value={details.protocol.equipment??''} placeholder="Same label for repeated tests" onChange={e=>updateDetails({...details,protocol:{...details.protocol!,equipment:e.target.value||undefined}})}/></label>
          {['grip_strength','grip_combined','single_leg_balance'].includes(m.id)&&<label>{m.id==='single_leg_balance'?'Test leg':'Hand'}<select disabled={readOnly} value={details.protocol.hand??''} aria-label={`Side for ${m.name}`} onChange={e=>updateDetails({...details,protocol:{...details.protocol!,hand:e.target.value?e.target.value as MeasurementProtocol['hand']:undefined}})}><option value="">Unknown</option><option value="left">Left</option><option value="right">Right</option>{m.id!=='single_leg_balance'&&<option value="both">Both hands · combined</option>}</select></label>}
          {['grip_strength','grip_combined','cmj','sprint_10m'].includes(m.id)&&<label>Trials per side/test<input disabled={readOnly} type="number" min={1} max={10} aria-label={`Trials for ${m.name}`} value={details.protocol.trials??''} onChange={e=>updateDetails({...details,protocol:{...details.protocol!,trials:e.target.value?Number(e.target.value):undefined}})}/></label>}
          {m.id==='sit_to_stand'&&<label>Chair height (cm)<input disabled={readOnly} type="number" min={25} max={70} aria-label="Chair height" value={chairHeight} onChange={e=>{setChairHeight(e.target.value);const n=Number(e.target.value);if(e.target.value&&(!Number.isFinite(n)||n<25||n>70)){rawError('chair','Use a chair height of 25–70 cm.');return;}updateDetails({...details,protocol:{...details.protocol!,chairHeightCm:e.target.value?n:undefined}},'chair');}}/></label>}
          {m.id==='hrv'&&<label>HRV statistic<select disabled={readOnly} aria-label="HRV statistic" value={details.protocol.hrvStatistic??''} onChange={e=>updateDetails({...details,protocol:{...details.protocol!,hrvStatistic:e.target.value?e.target.value as MeasurementProtocol['hrvStatistic']:undefined}})}><option value="">Unknown</option><option value="rmssd">RMSSD</option><option value="sdnn">SDNN · different statistic</option></select></label>}
        </>}
        <label>Measurement method<select disabled={readOnly} aria-label={`Method for ${m.name}`} value={details.method ?? ''} onChange={e => updateDetails({ ...details, method: e.target.value ? e.target.value as MeasurementMethod : undefined, source: 'manual' })}>
          <option value="">Unknown / not recorded</option>{allowedMethods(m.id).map(method => <option key={method} value={method}>{methodLabels[method]}</option>)}
        </select></label>
        <label>Date & time<input disabled={readOnly} aria-label={`Measurement date for ${m.name}`} type="datetime-local" value={measuredAt} onChange={e => { if (!e.target.value || Number.isFinite(Date.parse(e.target.value))) updateDetails({ ...details, measuredAt: e.target.value ? new Date(e.target.value).toISOString() : undefined }); }}/></label>
        {m.id === 'vo2_max' && <label>Age at test<input disabled={readOnly} aria-label="Age at VO₂ test" type="number" min="18" max="120" step="1" value={testAge} aria-invalid={testAgeError} onChange={e => { const raw = e.target.value; setTestAge(raw); const validAge = !raw || Number.isInteger(Number(raw)) && Number(raw) >= 18 && Number(raw) <= 120; setTestAgeError(!validAge); if(!validAge)rawError('testAge','Use a whole test age from 18 to 120.'); if (validAge) updateDetails({ ...details, ageAtMeasurement: raw ? Number(raw) : undefined },'testAge'); }}/></label>}
        {m.id === 'vo2_max' && details.method==='direct_cpet' && <label>Exercise modality<select disabled={readOnly} aria-label="Exercise modality for VO₂ test" value={details.exerciseMode??''} onChange={e=>updateDetails({...details,exerciseMode:e.target.value?e.target.value as ExerciseMode:undefined})}><option value="">Unknown / not recorded</option><option value="treadmill">Treadmill</option><option value="cycle">Cycle ergometer</option><option value="other">Other modality</option></select></label>}
      </div>{testAgeError && <p className="field-error" role="alert">Use a whole test age from 18 to 120. This change has not been saved.</p>}
      {['total_sleep','sleep_efficiency','circadian_regularity','sauna_minutes','cold_plunge_minutes'].includes(m.id)&&<fieldset disabled={readOnly}><legend>Observation window for {m.name} · optional</legend><div className="measurement-context"><label>Window start<input type="datetime-local" value={windowDraft.start} onChange={e=>updateWindow({start:e.target.value})}/></label><label>Window end<input type="datetime-local" value={windowDraft.end} onChange={e=>updateWindow({end:e.target.value})}/></label><label>Samples / nights<input type="number" min={1} max={10000} value={windowDraft.samples} onChange={e=>updateWindow({samples:e.target.value})}/></label></div><button className="text-link" onClick={()=>{setWindowDraft({start:'',end:'',samples:'7'});updateDetails({...details,window:undefined},'window');}}>Clear window</button></fieldset>}
      {details.derivation&&<p>Original calculation: {details.derivation.formula.replaceAll('_',' ')} · inputs {details.derivation.inputs.join(', ')}{details.derivation.bodyWeightKg!==undefined&&` · test body weight ${details.derivation.bodyWeightKg} kg`}{details.derivation.ageAtTest!==undefined&&` · test age ${details.derivation.ageAtTest}`}. Editing the result manually removes this derivation.</p>}
      <p>{m.id === 'vo2_max' ? 'Only direct CPET with explicit treadmill modality and a recorded test age of 20–79 enters this reference. Estimates and cycle tests remain available for tracking.' : m.proofData.instructions}</p>
      {!scored&&m.scoringEligible&&<p className="field-error" role="status">{eligibility.reason}</p>}
    </details>}
    {!compact&&<LabUnitHelper metricId={m.id}/>}
    {!compact&&value!==undefined&&<small className="observation-age">{observationAge(m.id,details).label}{observationAge(m.id,details).older?' · review for your next check-in':''}</small>}
    {!compact&&value!==undefined&&!bad&&scored&&Math.abs(score(m,value,demographics,{[m.id]:details}))>=3&&<small className="observation-age">At the experimental index limit. Further raw progress may not change these points.</small>}
    {contextError&&<p id={`${inputId}-context-error`} className="field-error" role="alert">{contextError} This detail change has not been saved.</p>}
    {bad && <p id={`${inputId}-error`} className="field-error" role="alert">Enter {countMetrics.has(m.id)?'a whole number':'a value'} from {low} to {high} {shownUnit}. This value is excluded until corrected.</p>}
  </div>;
}
