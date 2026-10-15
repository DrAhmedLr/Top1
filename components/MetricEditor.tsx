'use client';
import {MetricIcon} from './MetricIcon';
import {useTranslations} from '@/components/providers/LocaleProvider';
import {metricGameEstimate} from '@/lib/benchmarkGame';
import {CANADIAN_INSTRUCTIONS,CANADIAN_JUMP_PROTOCOL,CANADIAN_GRIP_PROTOCOL} from '@/lib/canadianReference';
import {GRIP_PROTOCOL,GRIP_INSTRUCTIONS,gripComparison} from '@/lib/gripReference';
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
 const {t:tr}=useTranslations();

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
  const publishedGrip=m.id==='grip_strength'&&gripComparison({grip_strength:value},demographics,{grip_strength:details}).available;
  const scored = eligible(m, demographics, { [m.id]: details });
  const eligibility = scoringEligibility(m, demographics, { [m.id]: details });
  const measuredAt = details.measuredAt && Number.isFinite(Date.parse(details.measuredAt))
    ? new Date(Date.parse(details.measuredAt) - new Date(details.measuredAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  return <div data-metric-id={m.id} className={`metric-row ${m.pillar} ${compact ? 'compact-row' : ''}`} onFocusCapture={() => onEditingChange?.(m.id)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onEditingChange?.(null); }}>
    <div className="metric-label">
      <label htmlFor={inputId}><MetricIcon id={m.id}/>{tr(m.name)}</label>
      <span id={`${inputId}-hint`} className={compact ? "metric-description" : "sr-only"}>{tr(compact ? starterInstructions[m.id] ?? m.proofData.instructions : `Optional. Enter ${shownUnit} or leave blank if unmeasured.`)}</span>
      {!compact&&value!==undefined&&!bad&&<strong className="metric-game-top">{tr('Top')} {metricGameEstimate(m.id,value,demographics)?.top??'—'} <small>{tr('Illustrative estimate')}</small></strong>}
      {!compact && <span className={`metric-kind ${scored ? 'scored' : ''}`}>{tr(publishedGrip?'Published grip reference':scored ? m.id==='vo2_max'?'Published CPET reference':'Provisional model' : 'Illustrative benchmark')}</span>}
    </div>
    <div className="metric-controls">{onFavorite&&<button className="icon-button" aria-label={tr(`${favorite?"Remove":"Add"} ${m.name} ${favorite?"from":"to"} favorites`)} aria-pressed={!!favorite} onClick={onFavorite}><Star size={18} fill={favorite?"currentColor":"none"}/></button>}
      {valid(m, value) && <Check size={15} className="measured-check" aria-label={tr("Recorded")}/>}
      <div className={`input-unit ${bad ? 'invalid' : ''}`}>
        <input id={inputId} type="text" inputMode={countMetrics.has(m.id)?"numeric":"decimal"} value={raw} placeholder={tr("—")} disabled={readOnly} aria-invalid={bad} aria-describedby={bad ? `${inputId}-error` : `${inputId}-hint`} onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; }} onChange={e => { setRaw(e.target.value); onValue(m.id, parseMeasurementInput(e.target.value, sleep ? 60 : 1)); }}/>

        <span>{tr(shownUnit)}</span>
      </div>
      {!compact && <>
        {calculators.has(m.id) && <button className="icon-button" aria-label={tr(`Calculate ${m.name}`)} title={tr("Calculate an estimate")} onClick={() => onCalculate(m)}><Calculator size={18}/></button>}
        <button className="icon-button" aria-label={tr(`Evidence for ${m.name}`)} title={tr("How to measure & evidence")} onClick={() => onEvidence(m)}><CircleHelp size={18}/></button>
      </>}
    </div>
    {compact && <details className="starter-evidence"><summary><CircleHelp size={14}/> {tr("How to measure & evidence")}</summary><p>{tr(m.proofData.instructions)}</p><p>{tr(m.proofData.study)}. {tr(m.proofData.sampleSize)}</p>{m.proofData.url && <a className="text-link" href={m.proofData.url} target="_blank" rel="noreferrer">{tr("Read the source")}</a>}</details>}
    {!compact && <details className="measurement-details">
      <summary aria-label={tr(`Method and date for ${m.name}`)}><ChevronDown size={13}/> {tr("Measurement method & date ")}{m.id === 'vo2_max' && !scored && <span>{tr("Required for VO₂ scoring")}</span>}</summary>
      {details.invalidContext&&<p role="alert">{tr("Stored measurement details need review. Original context remains in history/export. ")}<button className="text-link" disabled={readOnly} onClick={()=>updateDetails({invalidContext:undefined})}>{tr("Keep value and clear unreadable details")}</button></p>}
      <div className="measurement-context">
        {protocolOptions[m.id]&&<label>{tr("Test protocol")}<select disabled={readOnly} aria-label={tr(`Protocol for ${m.name}`)} value={details.protocol?.id??''} onChange={e=>updateDetails({...details,protocol:e.target.value?{id:e.target.value}:undefined})}><option value="">{tr("Unknown / not recorded")}</option>{protocolOptions[m.id].map(p=><option key={p.id} value={p.id}>{tr(p.label)}</option>)}</select></label>}
        {details.protocol&&<>
          <label>{tr("Equipment / task label")}<input disabled={readOnly} maxLength={60} aria-label={tr(`Equipment for ${m.name}`)} value={details.protocol.equipment??''} placeholder={tr("Same label for repeated tests")} onChange={e=>updateDetails({...details,protocol:{...details.protocol!,equipment:e.target.value||undefined}})}/></label>
          {['grip_strength','grip_combined','single_leg_balance'].includes(m.id)&&<label>{tr(m.id==='single_leg_balance'?'Test leg':'Hand')}<select disabled={readOnly} value={details.protocol.hand??''} aria-label={tr(`Side for ${m.name}`)} onChange={e=>updateDetails({...details,protocol:{...details.protocol!,hand:e.target.value?e.target.value as MeasurementProtocol['hand']:undefined}})}><option value="">{tr("Unknown")}</option><option value="left">{tr("Left")}</option><option value="right">{tr("Right")}</option>{m.id!=='single_leg_balance'&&<option value="both">{tr(details.protocol?.id===GRIP_PROTOCOL?'Both hands · maximum':'Both hands · combined')}</option>}</select></label>}
          {['grip_strength','grip_combined','cmj','sprint_10m'].includes(m.id)&&<label>{tr("Trials per side/test")}<input disabled={readOnly} type="number" min={1} max={10} aria-label={tr(`Trials for ${m.name}`)} value={details.protocol.trials??''} onChange={e=>updateDetails({...details,protocol:{...details.protocol!,trials:e.target.value?Number(e.target.value):undefined}})}/></label>}
          {m.id==='sit_to_stand'&&<label>{tr("Chair height (cm)")}<input disabled={readOnly} type="number" min={25} max={70} aria-label={tr("Chair height")} value={chairHeight} onChange={e=>{setChairHeight(e.target.value);const n=Number(e.target.value);if(e.target.value&&(!Number.isFinite(n)||n<25||n>70)){rawError('chair','Use a chair height of 25–70 cm.');return;}updateDetails({...details,protocol:{...details.protocol!,chairHeightCm:e.target.value?n:undefined}},'chair');}}/></label>}
          {m.id==='hrv'&&<label>{tr("HRV statistic")}<select disabled={readOnly} aria-label={tr("HRV statistic")} value={details.protocol.hrvStatistic??''} onChange={e=>updateDetails({...details,protocol:{...details.protocol!,hrvStatistic:e.target.value?e.target.value as MeasurementProtocol['hrvStatistic']:undefined}})}><option value="">{tr("Unknown")}</option><option value="rmssd">{tr("RMSSD")}</option><option value="sdnn">{tr("SDNN · different statistic")}</option></select></label>}
        </>}
        {m.id==='vo2_max'&&details.protocol?.id==='cpet_treadmill_v1'&&<><label>{tr("Peak RER from CPET report · optional")}<input disabled={readOnly} type="number" min="0.01" max="3" step="0.01" aria-label={tr("Peak RER from CPET report")} value={details.protocol.peakRer??''} onChange={e=>updateDetails({...details,protocol:{...details.protocol!,peakRer:e.target.value?Number(e.target.value):undefined}},'rer')}/></label><label>{tr("FRIEND reference population · optional")}<select disabled={readOnly} aria-label={tr("FRIEND reference population")} value={details.protocol.referencePopulation??''} onChange={e=>updateDetails({...details,protocol:{...details.protocol!,referencePopulation:e.target.value?e.target.value as 'matches'|'outside':undefined}})}><option value="">{tr("Unknown / prefer not to answer")}</option><option value="matches">{tr("No known cardiovascular disease or COPD at the test")}</option><option value="outside">{tr("Outside this reference population")}</option></select></label></>}
        <label>{tr("Measurement method")}<select disabled={readOnly} aria-label={tr(`Method for ${m.name}`)} value={details.method ?? ''} onChange={e => updateDetails({ ...details, method: e.target.value ? e.target.value as MeasurementMethod : undefined, source: 'manual' })}>
          <option value="">{tr("Unknown / not recorded")}</option>{allowedMethods(m.id).map(method => <option key={method} value={method}>{tr(methodLabels[method])}</option>)}
        </select></label>
        <label>{tr("Date & time")}<input disabled={readOnly} aria-label={tr(`Measurement date for ${m.name}`)} type="datetime-local" value={measuredAt} onChange={e => { if (!e.target.value || Number.isFinite(Date.parse(e.target.value))) updateDetails({ ...details, measuredAt: e.target.value ? new Date(e.target.value).toISOString() : undefined }); }}/></label>
        {(['vo2_max','grip_strength','cmj','grip_combined'].includes(m.id)) && <label>{tr("Age at test")}<input disabled={readOnly} aria-label={tr("Age at test")} type="number" min="18" max="120" step="1" value={testAge} aria-invalid={testAgeError} onChange={e => { const raw = e.target.value; setTestAge(raw); const validAge = !raw || Number.isInteger(Number(raw)) && Number(raw) >= 18 && Number(raw) <= 120; setTestAgeError(!validAge); if(!validAge)rawError('testAge','Use a whole test age from 18 to 120.'); if (validAge) updateDetails({ ...details, ageAtMeasurement: raw ? Number(raw) : undefined },'testAge'); }}/></label>}
        {m.id === 'vo2_max' && details.method==='direct_cpet' && <label>{tr("Exercise modality")}<select disabled={readOnly} aria-label={tr("Exercise modality for VO₂ test")} value={details.exerciseMode??''} onChange={e=>updateDetails({...details,exerciseMode:e.target.value?e.target.value as ExerciseMode:undefined})}><option value="">{tr("Unknown / not recorded")}</option><option value="treadmill">{tr("Treadmill")}</option><option value="cycle">{tr("Cycle ergometer")}</option><option value="other">{tr("Other modality")}</option></select></label>}
      </div>{testAgeError && <p className="field-error" role="alert">{tr("Use a whole test age from 18 to 120. This change has not been saved.")}</p>}
      {['total_sleep','sleep_efficiency','circadian_regularity','sauna_minutes','cold_plunge_minutes'].includes(m.id)&&<fieldset disabled={readOnly}><legend>{tr("Observation window for ")}{tr(m.name)} {tr("· optional")}</legend><div className="measurement-context"><label>{tr("Window start")}<input type="datetime-local" value={windowDraft.start} onChange={e=>updateWindow({start:e.target.value})}/></label><label>{tr("Window end")}<input type="datetime-local" value={windowDraft.end} onChange={e=>updateWindow({end:e.target.value})}/></label><label>{tr("Samples / nights")}<input type="number" min={1} max={10000} value={windowDraft.samples} onChange={e=>updateWindow({samples:e.target.value})}/></label></div><button className="text-link" onClick={()=>{setWindowDraft({start:'',end:'',samples:'7'});updateDetails({...details,window:undefined},'window');}}>{tr("Clear window")}</button></fieldset>}
      {details.derivation&&<p>{tr("Original calculation: ")}{tr(details.derivation.formula.replaceAll('_',' '))} {tr("· inputs ")}{tr(details.derivation.inputs.join(', '))}{details.derivation.bodyWeightKg!==undefined&&` · test body weight ${details.derivation.bodyWeightKg} kg`}{details.derivation.ageAtTest!==undefined&&` · test age ${details.derivation.ageAtTest}`}{tr(". Editing the result manually removes this derivation.")}</p>}
      <p>{tr(details.protocol?.id===CANADIAN_JUMP_PROTOCOL?CANADIAN_INSTRUCTIONS.cmj:details.protocol?.id===CANADIAN_GRIP_PROTOCOL?CANADIAN_INSTRUCTIONS.grip_combined:details.protocol?.id===GRIP_PROTOCOL?GRIP_INSTRUCTIONS:m.id === 'vo2_max' ? 'Only direct CPET with documented date, treadmill modality, test age 20–89, peak RER ≥ 1.0 and confirmed reference-population match enters this reference. Estimates and cycle tests remain available for tracking.' : m.proofData.instructions)}</p>
      {!scored&&m.scoringEligible&&<p className="field-error" role="status">{tr('Excluded from the stricter scientific report; the game estimate remains illustrative.')}</p>}
    </details>}
    {!compact&&<LabUnitHelper metricId={m.id}/>}
    {!compact&&value!==undefined&&<small className="observation-age">{tr(observationAge(m.id,details).label)}{tr(observationAge(m.id,details).older?' · review for your next check-in':'')}</small>}
    {!compact&&value!==undefined&&!bad&&scored&&Math.abs(score(m,value,demographics,{[m.id]:details}))>=3&&<small className="observation-age">{tr("At the experimental index limit. Further raw progress may not change these points.")}</small>}
    {contextError&&<p id={`${inputId}-context-error`} className="field-error" role="alert">{tr(contextError)} {tr("This detail change has not been saved.")}</p>}
    {bad && <p id={`${inputId}-error`} className="field-error" role="alert">{tr("Enter ")}{tr(countMetrics.has(m.id)?'a whole number':'a value')} {tr("from ")}{low} {tr("to ")}{high} {tr(shownUnit)}{tr(". This value is excluded until corrected.")}</p>}
  </div>;
}
