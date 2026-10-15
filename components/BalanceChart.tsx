'use client';
import {useTranslations} from '@/components/providers/LocaleProvider';

import { useId } from 'react';
import { toModelScore } from '@/lib/engine';
import type { PillarId } from '@/lib/registry';

const axes = [
  { id: 'bodymarkers' as const, x: 250, y: 55, color: '#34d399', label: 'Body markers' },
  { id: 'strength' as const, x: 65, y: 325, color: '#f87171', label: 'Strength & fitness' },
  { id: 'recovery' as const, x: 435, y: 325, color: '#60a5fa', label: 'Recovery' },
];
export default function BalanceChart({ domains, score, onSelect }: { domains: Partial<Record<PillarId, number>>; score?: number; onSelect: (pillar: PillarId) => void }) {
 const {t:tr}=useTranslations();

  const id = useId().replace(/:/g, '');
  const points = axes.map(a => {
    const z = domains[a.id];
    const ratio = z === undefined ? 0 : toModelScore(z) / 100;
    return { ...a, score: z === undefined ? undefined : toModelScore(z), px: Number((250 + (a.x - 250) * ratio).toFixed(2)), py: Number((220 + (a.y - 220) * ratio).toFixed(2)) };
  });
  return <div className="balance-chart">
    <svg viewBox="0 0 500 390" role="img" aria-label={tr("Three-pillar model chart. Missing scored data is shown at the center, not as a zero score.")}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#10b981" stopOpacity=".32"/><stop offset=".5" stopColor="#3b82f6" stopOpacity=".2"/><stop offset="1" stopColor="#ef4444" stopOpacity=".3"/></linearGradient></defs>
      {[40, 80, 120, 165].map(r => <circle key={r} cx="250" cy="220" r={r} fill="none" stroke="#26344b" strokeDasharray={r === 165 ? '3 5' : undefined}/>)}
      {axes.map(a => <line key={a.id} x1="250" y1="220" x2={a.x} y2={a.y} stroke="#293754"/>)}
      <polygon points="250,55 65,325 435,325" fill="none" stroke="#334155" strokeDasharray="4 5"/>
      <polygon points={points.map(p => `${p.px},${p.py}`).join(' ')} fill={`url(#${id})`} stroke="#a5b4c8" strokeWidth="1.5"/>
      {points.filter(p => p.score !== undefined).map(p => <g key={p.id}><circle cx={p.px} cy={p.py} r="11" fill={p.color} opacity=".16"/><circle cx={p.px} cy={p.py} r="4" fill={p.color} stroke="#fff"/></g>)}
      <circle cx="250" cy="220" r="34" fill="#111827" stroke="#334155"/>
      <text x="250" y="219" textAnchor="middle" fill="#f3f4f6" fontSize="18" fontFamily="monospace" fontWeight="700">{tr(score === undefined ? '—' : score.toFixed(1))}</text>
      <text x="250" y="236" textAnchor="middle" fill="#9ca3af" fontSize="10">{tr("INDEX")}</text>
    </svg>
    {points.map(p => <button key={p.id} className={`balance-label ${p.id}`} onClick={() => onSelect(p.id)}><i style={{ background: p.color }}/>{tr(p.label)}<strong>{tr(p.score === undefined ? '—' : p.score.toFixed(1))}</strong></button>)}
  </div>;
}
