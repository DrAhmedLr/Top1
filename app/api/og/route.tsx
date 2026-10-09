import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';
import { getPublicProfile } from '@/lib/publicProfile';
import { getAgeBracket } from '@/lib/demographics';
import { pillars } from '@/lib/registry';
import { toModelScore } from '@/lib/engine';
export const runtime='edge';
export async function GET(request:NextRequest){
 try{
  const username=request.nextUrl.searchParams.get('username');
  const profile=username?await getPublicProfile(username):null;
  if(username&&!profile)return new Response('Profile not found',{status:404,headers:{'Cache-Control':'private, no-store'}});
  const s=profile?.summary;
  return new ImageResponse(<div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between',background:'#090d16',color:'#f3f4f6',padding:'44px 56px',fontFamily:'sans-serif',backgroundImage:'radial-gradient(ellipse at top left, rgba(239,68,68,.15), transparent 55%), radial-gradient(ellipse at bottom right, rgba(59,130,246,.16), transparent 55%)'}}>
   <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{display:'flex',fontSize:27,fontWeight:800,letterSpacing:3}}>TOP1 / FIRE & ICE</div><div style={{display:'flex',border:'1px solid #1f2937',borderRadius:30,padding:'12px 22px',fontSize:17,color:'#9ca3af'}}>{s?`${s.completeness.toFixed(1)}% DATA COVERAGE`:'THE THREE-PILLAR TRIAD'}</div></div>
   <div style={{display:'flex',alignItems:'center',gap:50}}>
    <div style={{display:'flex',flexDirection:'column',width:580,gap:18}}>
     <span style={{fontSize:17,color:'#9ca3af',letterSpacing:2}}>YOUR BIOLOGY. YOUR TRIAD.</span>
     <div style={{display:'flex',flexDirection:'column',gap:4,borderLeft:'5px solid #ef4444',paddingLeft:24}}><span style={{fontSize:18,color:'#ef4444',letterSpacing:2}}>EXPERIMENTAL MODEL INDEX</span><span style={{fontSize:s?.ready?77:57,fontWeight:900,letterSpacing:-3}}>{s?.ready?s.modelScore.toFixed(1):'Find your balance.'}</span>{s?.ready&&<span style={{fontSize:23,color:'#9ca3af'}}>model points / 100</span>}</div>
     <span style={{fontSize:21,color:'#9ca3af'}}>{profile?`@${profile.username} · ${getAgeBracket(profile.demographics.age)} · ${profile.demographics.sex}`:'BodyMarkers · Strength · Recovery'}</span>
    </div>
    <div style={{display:'flex',flexDirection:'column',width:410,gap:27}}>{pillars.map(p=>{const z=s?.domains[p.id],points=z===undefined?undefined:toModelScore(z);return <div key={p.id} style={{display:'flex',flexDirection:'column',gap:11}}><div style={{display:'flex',justifyContent:'space-between',fontSize:22}}><span>{p.name}</span><span style={{color:p.color}}>{points===undefined?'Tracking':`${points.toFixed(1)} pts`}</span></div><div style={{display:'flex',width:'100%',height:11,borderRadius:7,background:'#1f2937'}}><div style={{display:'flex',width:`${points??0}%`,height:'100%',borderRadius:7,background:p.id==='bodymarkers'?'linear-gradient(90deg,#ef4444,#3b82f6)':p.color}}/></div></div>;})}</div>
   </div>
   <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid #1f2937',paddingTop:22,fontSize:16,color:'#9ca3af'}}><span>Self-reported · Experimental index · No population rank</span><span style={{color:'#3b82f6'}}>Explore your triad →</span></div>
  </div>,{width:1200,height:630,headers:{'Cache-Control':'private, no-store'}});
 }catch{return new Response('Unable to render card',{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
