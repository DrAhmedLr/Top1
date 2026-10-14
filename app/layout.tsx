import type { Metadata } from 'next';
import './globals.css';
import InteractionProvider from '@/components/providers/InteractionProvider';
import AuthProvider from '@/components/providers/AuthProvider';
import PostHogProvider from '@/components/providers/PostHogProvider';
export const dynamic='force-dynamic';
export const metadata: Metadata = { title: 'TOP1 · Your performance, simplified.', description: 'Record your measurements, follow comparable progress, and explore your next step.', metadataBase:new URL('https://top1.fit'), alternates:{canonical:'/'}, openGraph:{title:'TOP1 · Understand your progress',description:'Optional measurements, personal progress and transparent experimental comparisons.',url:'/',images:[{url:'/api/og',width:1200,height:630}]},twitter:{card:'summary_large_image',images:['/api/og']} };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><PostHogProvider><InteractionProvider><AuthProvider>{children}</AuthProvider></InteractionProvider></PostHogProvider></body></html>; }
