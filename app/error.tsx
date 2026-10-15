'use client';
import {useTranslations} from '@/components/providers/LocaleProvider';
import Link from 'next/link';
export default function ErrorPage({reset}:{reset:()=>void}){
 const {t:tr}=useTranslations();
return <main className="auth-page"><section className="auth-card"><Link href="/" className="brand">{tr("TOP1")}</Link><h1>{tr("Let’s try again.")}</h1><p>{tr("This page could not load. Reload it to reconnect with your workspace.")}</p><button className="primary-button" onClick={reset}>{tr("Try again")}</button><Link href="/sign-in" className="text-link">{tr("Account access →")}</Link></section></main>;}
