'use client';
import {useTranslations} from '@/components/providers/LocaleProvider';
export default function Error({reset}:{reset:()=>void}){
 const {t:tr}=useTranslations();
return <main className="auth-page"><section className="auth-card"><h1>{tr("Profile temporarily unavailable.")}</h1><p>{tr("We couldn’t reach cloud storage. Please try again.")}</p><button className="primary-button" onClick={reset}>{tr("Retry")}</button></section></main>;}
