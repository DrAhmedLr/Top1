'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Calculator, Check, ChevronDown, CircleHelp } from 'lucide-react';
import { parseMeasurementInput } from '@/lib/measurementInput';
import { eligible, scoringEligibility, valid } from '@/lib/engine';
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

export default function MetricEditor({ metric: m, value, details = {}, demographics, onValue, onDetails, onEvidence, onCalculate, compact = false, readOnly = false, onEditingChange,onContextError }: {
  metric: Metric; value: number | undefined; details?: MeasurementDetails; demographics: Demographics;
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
  const [contextError,setContextError]=useState('');
  function updateDetails(next:MeasurementDetails){try{normalizeMeasurementMetadata({[m.id]:next});setContextError('');onContextError?.(m.id,'');onDetails(m.id,next);}catch(e){const message=e instanceof Error?e.message:'Check the measurement details.';setContextError(message);onContextError?.(m.id,message);}}
  const low = sleep ? m.min / 60 : m.min, high = sleep ? m.max / 60 : m.max;
  const starterInstructions: Record<string, string> = { pushups: 'Count consecutive strict push-ups. Stop when you can no longer keep the same form.', sit_to_stand: 'Count full stands from a chair in 30 seconds. Use the same chair and technique each time.', total_sleep: 'Enter your average hours of sleep per night over the last seven days.' };
  const bad = value !== undefined && !valid(m, value);
  const scored = eligible(m, demographics, { [m.id]: details });
  const eligibility = scoringEligibility(m, demographics, { [m.id]: details });
  const measuredAt = details.measuredAt && Number.isFinite(Date.parse(details.measuredAt))
    ? new Date(Date.parse(details.measuredAt) - new Date(details.measuredAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  return <div className={`metric-row ${m.pillar} ${compact ? 'compact-row' : ''}`} onFocusCapture={() => onEditingChange?.(m.id)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onEditingChange?.(null); }}>
    <div className="metric-label">
      <label htmlFor={inputId}>{m.name}</label>
      <span id={`${inputId}-hint`} className={compact ? "metric-description" : "sr-only"}>{compact ? starterInstructions[m.id] ?? m.proofData.instructions : `Optional. Enter ${shownUnit} or leave blank if unmeasured.`}</span>
      {!compact && <span className={`metric-kind ${scored ? 'scored' : ''}`}>{scored ? m.id==='vo2_max'?'Published CPET reference':'Provisional model' : 'Tracking only'}</span>}
    </div>
    <div className="metric-controls">
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
      <summary><ChevronDown size={13}/> Measurement method & date {m.id === 'vo2_max' && !scored && <span>Required for VO₂ scoring</span>}</summary>
      <div className="measurement-context">
        <label>Measurement method<select disabled={readOnly} aria-label={`Method for ${m.name}`} value={details.method ?? ''} onChange={e => updateDetails({ ...details, method: e.target.value ? e.target.value as MeasurementMethod : undefined, source: 'manual' })}>
          <option value="">Unknown / not recorded</option>{allowedMethods(m.id).map(method => <option key={method} value={method}>{methodLabels[method]}</option>)}
        </select></label>
        <label>Date & time<input disabled={readOnly} aria-label={`Measurement date for ${m.name}`} type="datetime-local" value={measuredAt} onChange={e => { if (!e.target.value || Number.isFinite(Date.parse(e.target.value))) updateDetails({ ...details, measuredAt: e.target.value ? new Date(e.target.value).toISOString() : undefined }); }}/></label>
        {m.id === 'vo2_max' && <label>Age at test<input disabled={readOnly} aria-label="Age at VO₂ test" type="number" min="18" max="120" step="1" value={testAge} aria-invalid={testAgeError} onChange={e => { const raw = e.target.value; setTestAge(raw); const validAge = !raw || Number.isInteger(Number(raw)) && Number(raw) >= 18 && Number(raw) <= 120; setTestAgeError(!validAge); if(!validAge)onContextError?.(m.id,'Use a whole test age from 18 to 120.'); if (validAge) updateDetails({ ...details, ageAtMeasurement: raw ? Number(raw) : undefined }); }}/></label>}
        {m.id === 'vo2_max' && details.method==='direct_cpet' && <label>Exercise modality<select disabled={readOnly} aria-label="Exercise modality for VO₂ test" value={details.exerciseMode??''} onChange={e=>updateDetails({...details,exerciseMode:e.target.value?e.target.value as ExerciseMode:undefined})}><option value="">Unknown / not recorded</option><option value="treadmill">Treadmill</option><option value="cycle">Cycle ergometer</option><option value="other">Other modality</option></select></label>}
      </div>{testAgeError && <p className="field-error" role="alert">Use a whole test age from 18 to 120. This change has not been saved.</p>}
      <p>{m.id === 'vo2_max' ? 'Only direct CPET with explicit treadmill modality and a recorded test age of 20–79 enters this reference. Estimates and cycle tests remain available for tracking.' : m.proofData.instructions}</p>
      {!scored&&m.scoringEligible&&<p className="field-error" role="status">{eligibility.reason}</p>}
    </details>}
    {!compact&&value!==undefined&&<small className="observation-age">{observationAge(m.id,details).label}{observationAge(m.id,details).older?' · review for your next check-in':''}</small>}
    {contextError&&<p className="field-error" role="alert">{contextError} This detail change has not been saved.</p>}
    {bad && <p id={`${inputId}-error`} className="field-error" role="alert">Enter {countMetrics.has(m.id)?'a whole number':'a value'} from {low} to {high} {shownUnit}. This value is excluded until corrected.</p>}
  </div>;
}
