import {recordedCoverage} from '@/lib/coverage';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Activity, ArrowRight, ShieldCheck } from 'lucide-react';
import { getPublicProfile } from '@/lib/publicProfile';
import { getAgeBracket } from '@/lib/demographics';
import { activeMetrics } from '@/lib/registry';
import TriadChart from '@/components/TriadChart';
import {MODEL_VERSION} from '@/lib/model';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ username: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) return { title: 'Profile unavailable · TOP1', robots: { index: false, follow: false } };
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  const title = `@${profile.username} · TOP1 Profile Summary`;
  const description = 'An experimental performance index with measurement coverage and clear context.';
  const image = `/api/og?username=${encodeURIComponent(profile.username)}`;
  return { title, description, ...(base ? { metadataBase: new URL(base) } : {}), openGraph: { title, description, type: 'profile', url: `/share/${profile.username}`, images: [{ url: image, width: 1200, height: 630, alt: 'TOP1 experimental index and three-pillar profile' }] }, twitter: { card: 'summary_large_image', title, description, images: [image] }, robots: { index: false, follow: false } };
}
export default async function Share({ params }: Props) {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) notFound();
  const { summary } = profile;
  return <main className="share-page"><div className="share-heading"><Link href="/" className="brand"><span className="brand-symbol"><Activity size={24}/></span>TOP1.</Link><span className="soft-tag">Public summary</span></div>
    <section className="share-passport"><span className="eyebrow">A PERSONAL PERFORMANCE SNAPSHOT</span><h1>@{profile.username}</h1><p>{profile.demographics.ageCohort}{profile.demographics.sex!=='unselected'&&` · ${profile.demographics.sex}`}{profile.demographics.weight!==undefined&&` · ${profile.demographics.weight} kg`}{profile.demographics.height!==undefined&&` · ${profile.demographics.height} cm`}</p><div className="share-rank">{summary.ready ? `${summary.modelScore.toFixed(1)} /100` : 'Awaiting measurements'}</div><p>Experimental model index · snapshot {profile.signedAt.slice(0, 10)}</p><TriadChart domains={summary.domains}/><div className="share-stats"><span>{recordedCoverage(summary.measured).toFixed(1)}% measurement coverage</span><span>{summary.measured} of {activeMetrics.length} measurements recorded</span></div></section>
    {summary.modelVersion!==MODEL_VERSION&&<p className="share-disclosure">Earlier model snapshot · {summary.modelVersion}. Its original calculation is preserved; the owner can save a new assessment to use the current model.</p>}
    <p className="share-disclosure">Self-reported measurements and provisional model references. This index is not a population rank, health score or medical assessment. A signed snapshot confirms calculation by TOP1, not independent verification of the measurements. Raw logs stay private. The snapshot date is the calculation date; the underlying tests may be undated or from different dates.</p><Link href="/" className="primary-button">Explore TOP1 <ArrowRight size={16}/></Link><div className="share-privacy-link"><ShieldCheck size={14}/><Link href="/privacy">How TOP1 protects your data</Link></div>
  </main>;
}
