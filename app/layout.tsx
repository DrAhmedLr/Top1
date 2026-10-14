import type { Metadata } from 'next';
import './globals.css';
import InteractionProvider from '@/components/providers/InteractionProvider';
import AuthProvider from '@/components/providers/AuthProvider';
import PostHogProvider from '@/components/providers/PostHogProvider';
export const metadata: Metadata = { title: 'TOP1 · Your performance, simplified.', description: 'Record your measurements, understand your experimental performance index, and explore your next step.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><PostHogProvider><InteractionProvider><AuthProvider>{children}</AuthProvider></InteractionProvider></PostHogProvider></body></html>; }
