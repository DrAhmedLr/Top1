'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import MetricEditor from './MetricEditor';
import { activeMetrics, type Demographics, type Values } from '@/lib/registry';
import { evaluate } from '@/lib/engine';
import { parseProfileDraft, profileToDraft } from '@/lib/onboarding';
import type { MeasurementMetadata } from '@/lib/measurementMetadata';

const availableStarters=['pushups','sit_to_stand','total_sleep','single_leg_balance'];
const numericFields = [{id:'age' as const,label:'Age',placeholder:'Your age in years'}, {id:'weight' as const,label:'Weight (kg)',placeholder:'Your weight in kilograms'}, {id:'height' as const,label:'Height (cm)',placeholder:'Your height in centimeters'}];
export default function Onboarding({ initialProfile, initialValues, initialDetails, onFinish }: {
  initialProfile?: Demographics; initialValues: Values; initialDetails: MeasurementMetadata;
  onFinish: (profile: Demographics, values: Values, details: MeasurementMetadata) => void;
}) {
  const [starterIds,setStarterIds]=useState(['pushups','sit_to_stand','total_sleep']),[step, setStep] = useState(0), [draft, setDraft] = useState(() => profileToDraft(initialProfile)), [values, setValues] = useState(initialValues);
  const profile = parseProfileDraft(draft);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  const result = profile ? evaluate(values, profile, initialDetails) : undefined;
  const invalid = starterIds.some(id => values[id] !== undefined && !result?.measured.some(m => m.id === id));
  return <div className="onboarding">
    <div className="setup-steps" aria-label={`Step ${step + 1} of 2`}><span className={step === 0 ? 'current' : 'done'}><i>{step ? <Check size={12}/> : '1'}</i>About you</span><div/><span className={step === 1 ? 'current' : ''}><i>2</i>Easy measurements</span></div>
    {step === 0 ? <><span className="eyebrow">LET’S START WITH YOU</span><h3 ref={heading} tabIndex={-1}>Build your profile.</h3><p>Enter your own details. We haven’t filled in any personal data for you.</p><div className="profile-fields">{numericFields.map(field => <label key={field.id}>{field.label}<input aria-label={field.label} type="text" inputMode={field.id === 'age' ? 'numeric' : 'decimal'} autoComplete="off" required={field.id==='age'} placeholder={field.id==='age'?field.placeholder:'Optional'} value={draft[field.id]} onChange={e => setDraft(d => ({...d,[field.id]:e.target.value}))}/></label>)}<label>Biological sex<select aria-label="Biological sex" required value={draft.sex} onChange={e => setDraft(d => ({...d,sex:e.target.value}))}><option value="">Choose your biological sex</option><option value="male">Male</option><option value="female">Female</option></select></label></div><p className="drawer-description">Age and biological sex select experimental reference context. Weight and height are optional; calculators request weight when needed.</p><div className="setup-privacy"><ShieldCheck size={17}/> Private by default.</div><Link className="text-link setup-login" href="/sign-in">Already a member? Log in</Link><div className="modal-actions"><button className="primary-button" disabled={!profile} onClick={() => setStep(1)}>Next: easy measurements <ArrowRight size={16}/></button></div></> : profile && <><span className="eyebrow">EASY TO TRACK AT HOME</span><h3 ref={heading} tabIndex={-1}>Choose your first measurements.</h3><p>Choose tests you can perform consistently. Skip anything unsuitable or unmeasured.</p><div className="starter-choice" role="group" aria-label="Choose starter measurements">{availableStarters.map(id=><label key={id}><input type="checkbox" checked={starterIds.includes(id)} onChange={e=>{setStarterIds(ids=>e.target.checked?[...ids,id]:ids.filter(x=>x!==id));if(!e.target.checked&&initialValues[id]===undefined)setValues(v=>({...v,[id]:undefined}));}}/>{activeMetrics.find(m=>m.id===id)!.name}</label>)}</div><div className="starter-metrics">{starterIds.map(id => <MetricEditor key={id} compact metric={activeMetrics.find(m => m.id === id)!} value={values[id]} demographics={profile} onValue={(id, raw) => setValues(v => ({ ...v, [id]: raw.trim() ? Number(raw) : undefined }))} onDetails={() => {}} onEvidence={() => {}} onCalculate={() => {}}/>)}</div><div className="setup-status" role="status">{result?.measured.length ? `${result.measured.length} measurements ready to save. You can add more later.` : 'Leave unmeasured fields blank.'}</div><div className="modal-actions"><button className="text-link" onClick={() => setStep(0)}><ArrowLeft size={15}/> Back</button><button className="primary-button" disabled={invalid} onClick={() => onFinish(profile, values, initialDetails)}>{result?.ready ? 'View my dashboard' : 'Save & continue later'}<ArrowRight size={16}/></button></div></>}
  </div>;
}
