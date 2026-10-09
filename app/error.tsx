'use client';
import Link from 'next/link';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="auth-page"><section className="auth-card"><Link href="/" className="brand">TOP1</Link><h1>Let’s try again.</h1><p>This page could not load. Reload it to reconnect with your workspace.</p><button className="primary-button" onClick={reset}>Try again</button><Link href="/sign-in" className="text-link">Account access →</Link></section></main>;}
