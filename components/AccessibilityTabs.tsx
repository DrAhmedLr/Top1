'use client';
import {useTranslations} from '@/components/providers/LocaleProvider';
import { accessibilityTiers, type AccessibilityTier } from '@/lib/registry';
export default function AccessibilityTabs({value,onChange}:{value:AccessibilityTier;onChange:(tier:AccessibilityTier)=>void}){
 const {t:tr}=useTranslations();

 return <div className="accessibility-filter"><div className="tier-tabs" role="group" aria-label={tr("Measurement accessibility tier")}>{accessibilityTiers.map(t=><button key={t.id} aria-pressed={value===t.id} className={value===t.id?'selected':''} onClick={()=>onChange(t.id)}><span>{tr(t.label)}</span></button>)}</div><p>{tr(accessibilityTiers.find(t=>t.id===value)?.description)} {tr("Filtering never clears measurements or changes your score.")}</p></div>;
}
