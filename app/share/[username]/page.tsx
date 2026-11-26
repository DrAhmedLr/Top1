import {recordedCoverage} from '@/lib/coverage';
import {getTranslations} from '@/lib/localeServer';
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
  const title = `@${profile.username} · TOP1% Athlete Profile`;
  const description = 'Verified TOP1% performance snapshot with three-pillar scores and measurement coverage.';
  const image = `/api/og?username=${encodeURIComponent(profile.username)}`;
  return { title, description, ...(base ? { metadataBase: new URL(base) } : {}), openGraph: { title, description, type: 'profile', url: `/share/${profile.username}`, images: [{ url: image, width: 1200, height: 630, alt: 'TOP1% three-pillar performance profile' }] }, twitter: { card: 'summary_large_image', title, description, images: [image] }, robots: { index: false, follow: false } };
}
export default async function Share({ params }: Props) {
 const {t:tr}=await getTranslations();

  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) notFound();
  const { summary } = profile;
  return <main className="share-page"><div className="share-heading"><Link href="/" className="brand"><span className="brand-symbol"><Activity size={24}/></span>{tr("TOP1%")}</Link><span className="soft-tag">{tr("Athlete card")}</span></div>
    <section className="share-passport"><span className="eyebrow">{tr("TOP1% PERFORMANCE SNAPSHOT")}</span><h1>@{profile.username}</h1><p>{tr(profile.demographics.ageCohort)}{profile.demographics.sex!=='unselected'&&` · ${profile.demographics.sex}`}{profile.demographics.weight!==undefined&&` · ${profile.demographics.weight} kg`}{profile.demographics.height!==undefined&&` · ${profile.demographics.height} cm`}</p><div className="share-rank">{tr(summary.ready ? `${summary.modelScore.toFixed(1)} /100` : 'Awaiting measurements')}</div><p>{tr("TOP1% model score · snapshot ")}{tr(profile.signedAt.slice(0, 10))}</p><TriadChart domains={summary.domains}/><div className="share-stats"><span>{tr(recordedCoverage(summary.measured).toFixed(1))}{tr("% measurement coverage")}</span><span>{summary.measured} {tr("of ")}{activeMetrics.length} {tr("measurements recorded")}</span></div></section>
    {summary.modelVersion!==MODEL_VERSION&&<p className="share-disclosure">{tr("Earlier model snapshot · ")}{tr(summary.modelVersion)}{tr(". Its original calculation is preserved; the owner can save a new assessment to use the current model.")}</p>}
    <p className="share-disclosure">{tr("Self-reported measurements evaluated against published reference cohorts. Signed snapshots confirm calculation by TOP1% while raw logs remain private; not a medical diagnosis.")}</p><Link href="/" className="primary-button">{tr("Open TOP1% App ")}<ArrowRight size={16}/></Link><div className="share-privacy-link"><ShieldCheck size={14}/><Link href="/privacy">{tr("How TOP1% protects your data")}</Link></div>
  </main>;
}
