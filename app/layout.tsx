import type { Metadata } from 'next';
import './globals.css';
import LocaleProvider from '@/components/providers/LocaleProvider';
import {getTranslations} from '@/lib/localeServer';
import {localeDirection} from '@/lib/i18n';
import InteractionProvider from '@/components/providers/InteractionProvider';
import AuthProvider from '@/components/providers/AuthProvider';
import PostHogProvider from '@/components/providers/PostHogProvider';
export const dynamic='force-dynamic';
export const metadata: Metadata = { title: 'TOP1 · Your performance, simplified.', description: 'Record your measurements, follow comparable progress, and explore your next step.', metadataBase:new URL('https://top1.fit'), alternates:{canonical:'/'}, openGraph:{title:'TOP1 · Understand your progress',description:'Optional measurements, personal progress and transparent experimental comparisons.',url:'/',images:[{url:'/api/og',width:1200,height:630}]},twitter:{card:'summary_large_image',images:['/api/og']} };
export default async function RootLayout({ children }: { children: React.ReactNode }) { const {locale}=await getTranslations(); return <html lang={locale} dir={localeDirection(locale)}><body><LocaleProvider initialLocale={locale}><PostHogProvider><InteractionProvider><AuthProvider>{children}</AuthProvider></InteractionProvider></PostHogProvider></LocaleProvider></body></html>; }
