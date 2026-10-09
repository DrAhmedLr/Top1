'use client';

import type { ReactNode } from 'react';
import { type Demographics } from '@/lib/registry';
import { clamp } from '@/lib/engine';
import { getAgeBracket } from '@/lib/demographics';

export default function ProfileEdit({ profile, onChange, privacyControls }: {
  profile: Demographics;
  privacyControls?: ReactNode;
  onChange: (profile: Demographics) => void;
}) {
  function updateNumber(field: 'age' | 'weight' | 'height', raw: string, min: number, max: number) {
    const value = Number(raw);
    if (raw.trim() && Number.isFinite(value)) onChange({ ...profile, [field]: clamp(value, min, max) });
  }
  return <>
    {privacyControls}
    <div className="profile-fields">
      <label>Age<input type="number" min="18" max="120" value={profile.age} onChange={event => updateNumber('age', event.target.value, 18, 120)}/></label>
      <label>Biological sex<select value={profile.sex} onChange={event => onChange({ ...profile, sex: event.target.value as Demographics['sex'] })}>
        <option value="male">Male</option><option value="female">Female</option>
      </select></label>
      <label>Weight (kg)<input type="number" min="25" max="350" value={profile.weight} onChange={event => updateNumber('weight', event.target.value, 25, 350)}/></label>
      <label>Height (cm)<input type="number" min="100" max="240" value={profile.height} onChange={event => updateNumber('height', event.target.value, 100, 240)}/></label>
    </div>
    <p className="drawer-description" role="status">Reference cohort: {getAgeBracket(profile.age)} · {profile.sex}. Percentiles recalculate as you edit.</p>
  </>;
}
