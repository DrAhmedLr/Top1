'use client';
export default function Error({reset}:{reset:()=>void}){return <main className="auth-page"><section className="auth-card"><h1>Profile temporarily unavailable.</h1><p>We couldn’t reach cloud storage. Please try again.</p><button className="primary-button" onClick={reset}>Retry</button></section></main>;}
