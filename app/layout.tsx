import type { Metadata } from 'next';
import './globals.css';
import './glass.css';
import './personal.css';
import './focus.css';
import './training-shell.css';
import LocaleProvider from '@/components/providers/LocaleProvider';
import {getTranslations} from '@/lib/localeServer';
import {localeDirection} from '@/lib/i18n';
import InteractionProvider from '@/components/providers/InteractionProvider';
import AuthProvider from '@/components/providers/AuthProvider';
import UsageAnalyticsProvider from '@/components/providers/UsageAnalyticsProvider';
export const dynamic='force-dynamic';
export const metadata: Metadata = { title: 'TOP1 · Your training and progress', description: 'Track performances, plan training, and explore your goal scenarios.', metadataBase:new URL('https://top1.fit'), alternates:{canonical:'/'}, openGraph:{title:'TOP1 · Understand your progress',description:'Optional measurements, personal progress and transparent experimental comparisons.',url:'/',images:[{url:'/api/og',width:1200,height:630}]},twitter:{card:'summary_large_image',images:['/api/og']} };
export default async function RootLayout({ children }: { children: React.ReactNode }) { const {locale,preference}=await getTranslations(); return <html lang={locale} dir={localeDirection(locale)}><body><LocaleProvider initialLocale={locale} initialPreference={preference}><InteractionProvider><AuthProvider><UsageAnalyticsProvider>{children}</UsageAnalyticsProvider></AuthProvider></InteractionProvider></LocaleProvider></body></html>; }
