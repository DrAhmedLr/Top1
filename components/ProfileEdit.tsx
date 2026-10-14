'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Demographics } from '@/lib/registry';
import { getAgeBracket } from '@/lib/demographics';

function ProfileNumber({ label, value, min, max, integer, optional, onChange, onValid }: {
  label: string; value?: number; min: number; max: number; integer?: boolean;optional?:boolean;
  onChange: (value: number|undefined) => void; onValid: (valid: boolean) => void;
}) {
  const [raw, setRaw] = useState(value===undefined?'':String(value)), [error, setError] = useState(false);
  const focused = useRef(false);
  const errorId = useId();
  useEffect(() => { if (!focused.current) { setRaw(value===undefined?'':String(value)); setError(false); } }, [value]);
  function update(text: string) {
    setRaw(text);
    if(optional&&!text.trim()){setError(false);onValid(true);onChange(undefined);return;}
    const number = Number(text), valid = !!text.trim() && Number.isFinite(number) && number >= min && number <= max && (!integer || Number.isInteger(number));
    setError(!valid); onValid(valid);
    if (valid) onChange(number);
  }
  return <label>{label}<input type="number" min={min} max={max} step={integer ? 1 : 'any'} value={raw} placeholder={optional?'Optional':undefined} aria-label={label} aria-describedby={error ? errorId : undefined} aria-invalid={error} onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; if (!error) setRaw(value===undefined?'':String(value)); }} onChange={e => update(e.target.value)}/>{error && <small id={errorId} className="profile-field-error">Enter {min}–{max}{integer ? ' as a whole number' : ''}. This change has not been saved.</small>}</label>;
}

export default function ProfileEdit({ profile, onChange, privacyControls, onValidityChange }: {
  profile: Demographics; privacyControls?: ReactNode; onChange: (profile: Demographics) => void;
  onValidityChange?: (valid: boolean) => void;
}) {
  const [validity, setValidity] = useState({ age: true, weight: true, height: true });
  const isValid = Object.values(validity).every(Boolean);
  useEffect(() => { onValidityChange?.(isValid); }, [isValid, onValidityChange]);
  return <>{privacyControls}<div className="profile-fields">
    <ProfileNumber label="Age" value={profile.age} min={18} max={120} integer onChange={age => {if(age!==undefined)onChange({ ...profile, age });}} onValid={age => setValidity(current => ({ ...current, age }))}/>
    <label>Biological sex<select value={profile.sex} onChange={e => onChange({ ...profile, sex: e.target.value as Demographics['sex'] })}><option value="male">Male</option><option value="female">Female</option></select></label>
    <ProfileNumber label="Weight (kg) · optional" optional value={profile.weight} min={25} max={350} onChange={weight => onChange({ ...profile, weight })} onValid={weight => setValidity(current => ({ ...current, weight }))}/>
    <ProfileNumber label="Height (cm) · optional" optional value={profile.height} min={100} max={240} onChange={height => onChange({ ...profile, height })} onValid={height => setValidity(current => ({ ...current, height }))}/>
  </div><p className="drawer-description" role="status">Reference cohort: {getAgeBracket(profile.age)} · {profile.sex}. These details update your experimental references.</p></>;
}
