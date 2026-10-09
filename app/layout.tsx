import type { Metadata } from 'next';
import './globals.css';
import InteractionProvider from '@/components/providers/InteractionProvider';
import AuthProvider from '@/components/providers/AuthProvider';
import PostHogProvider from '@/components/providers/PostHogProvider';
export const metadata: Metadata = { title: 'TOP1 · Your biology. Your benchmark.', description: 'A personal performance dashboard across five biological pillars.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><PostHogProvider><InteractionProvider><AuthProvider>{children}</AuthProvider></InteractionProvider></PostHogProvider></body></html>; }
