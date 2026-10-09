'use client';
import { accessibilityTiers, type AccessibilityTier } from '@/lib/registry';
export default function AccessibilityTabs({value,onChange}:{value:AccessibilityTier;onChange:(tier:AccessibilityTier)=>void}){
 return <div className="accessibility-filter"><div className="tier-tabs" role="group" aria-label="Measurement accessibility tier">{accessibilityTiers.map(t=><button key={t.id} aria-pressed={value===t.id} className={value===t.id?'selected':''} onClick={()=>onChange(t.id)}><span>{t.label}</span></button>)}</div><p>{accessibilityTiers.find(t=>t.id===value)?.description} Filtering never clears measurements or changes your score.</p></div>;
}
