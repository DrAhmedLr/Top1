'use client';
import {Globe2} from 'lucide-react';
import {useTranslations} from './providers/LocaleProvider';
import {normalizeLocale} from '@/lib/i18n';
export default function LanguageToggle(){const {locale,t:tr,setLocale}=useTranslations();return <label className="language-toggle"><Globe2 size={16} aria-hidden="true"/><span className="sr-only">{tr('Language')}</span><select aria-label={tr('Language')} value={locale} onChange={e=>setLocale(normalizeLocale(e.target.value))}><option value="en" lang="en">EN</option><option value="fr" lang="fr">FR</option><option value="ar" lang="ar">العربية</option></select></label>;}
