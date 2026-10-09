import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublicProfile } from '@/lib/publicProfile';
import { getAgeBracket } from '@/lib/demographics';
import { pillars } from '@/lib/registry';
import RadarChart from '@/components/RadarChart';
export const dynamic='force-dynamic';
type Props={params:Promise<{username:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
  const {username}=await params;
  const profile=await getPublicProfile(username);
  if(!profile)return {title:'Profile unavailable · TOP1',robots:{index:false,follow:false}};
  const base=process.env.NEXT_PUBLIC_SITE_URL;
  const title=`@${profile.username} · TOP1 Biological Benchmark`;
  const description='A experimental model index profile across five biological pillars.';
  const image=`/api/og?username=${encodeURIComponent(profile.username)}`;
  return {title,description,...(base?{metadataBase:new URL(base)}:{}),openGraph:{title,description,type:'profile',url:`/share/${profile.username}`,images:[{url:image,width:1200,height:630,alt:'TOP1 model index, cohort, and five-pillar radar'}]},twitter:{card:'summary_large_image',title,description,images:[image]},robots:{index:false,follow:false}};
}
export default async function Share({params}:Props){
  const {username}=await params;
  const profile=await getPublicProfile(username);if(!profile)notFound();
  const {summary:s}=profile;
  return <main className="share-page"><div className="share-heading"><Link href="/" className="brand">TOP1 <span className="beta-tag">LIVE BETA</span></Link><span className="soft-tag">Public profile</span></div>
    <section className="share-passport"><span className="eyebrow">BIOLOGICAL BENCHMARK</span><h1>@{profile.username}</h1><p>{getAgeBracket(profile.demographics.age)} · {profile.demographics.sex} · {profile.demographics.weight} kg · {profile.demographics.height} cm</p><div className="share-rank">{s.ready?`INDEX ${s.modelScore.toFixed(1)} / 100`:'AWAITING ELIGIBLE DATA'}</div><p>Experimental model index · snapshot {profile.signedAt.slice(0,10)}</p><RadarChart domains={s.domains}/><div className="share-stats"><span>{s.completeness.toFixed(1)}% coverage</span><span>{s.measured}/32 metrics</span><span>Model units {s.z.toFixed(2)}</span></div></section>
    <section className="share-pillars">{pillars.map(p=><div className="card" key={p.id}><span>{p.name}</span><strong>{s.domains[p.id]?.toFixed(2)??'—'} <small>Z</small></strong></div>)}</section>
    <p className="share-disclosure">Self-reported measurements. Provisional reference model; not a validated population rank or medical assessment. Raw measurement logs are private. Public snapshots are dated and signed; they remain self-reported.</p><Link href="/" className="primary-button">Build your own profile →</Link>
  </main>;
}
