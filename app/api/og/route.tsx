import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';
import { getPublicProfile } from '@/lib/publicProfile';
import { radarPoints } from '@/lib/radar';
import { getAgeBracket } from '@/lib/demographics';
export const runtime='edge';
export async function GET(request:NextRequest){
  try{
    const username=request.nextUrl.searchParams.get('username');
    const profile=username?await getPublicProfile(username):null;
    if(username&&!profile)return new Response('Profile not found',{status:404,headers:{'Cache-Control':'private, no-store'}});
    const s=profile?.summary;
    return new ImageResponse(<div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between',background:'#142018',color:'#f5f2eb',padding:'48px 60px',fontFamily:'sans-serif'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{display:'flex',fontSize:26,fontWeight:700,letterSpacing:3}}>TOP1 / BODY PROTOCOL</div><div style={{display:'flex',border:'1px solid #445242',borderRadius:30,padding:'12px 22px',fontSize:18,color:'#c2cbb9'}}>{s?`${s.completeness.toFixed(1)}% DATA COVERAGE`:'LIVE BETA'}</div></div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <span style={{fontSize:19,color:'#a8b69f',letterSpacing:2}}>YOUR BIOLOGY. YOUR BENCHMARK.</span>
          <div style={{display:'flex',fontSize:86,fontWeight:900,letterSpacing:-4}}>{s?.ready?`INDEX ${s.modelScore.toFixed(1)} / 100`:'Find your next level.'}</div>
          <div style={{display:'flex',fontSize:25,color:'#eda17d'}}>{profile?`@${profile.username} · ${getAgeBracket(profile.demographics.age)} · ${profile.demographics.sex}`:'Five pillars. One connected picture.'}</div>
          <div style={{display:'flex',fontSize:18,color:'#a8b69f'}}>Experimental model index · Self-reported measurements</div>
        </div>
        <svg width="285" height="285" viewBox="0 0 200 200"><polygon points="100,25 171.329,76.824 144.084,160.676 55.916,160.676 28.671,76.824" fill="none" stroke="#42523d" strokeWidth="1.5"/><polygon points="100,62.5 135.665,88.412 122.042,130.338 77.958,130.338 64.335,88.412" fill="none" stroke="#42523d"/><polygon points={radarPoints(s?.domains??{})} fill="#e28d69" fillOpacity="0.25" stroke="#e28d69" strokeWidth="2.5"/></svg>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid #42523d',paddingTop:22,fontSize:18,color:'#a8b69f'}}><span>TOP1 PROTOCOL</span><span style={{color:'#eda17d'}}>Explore the five pillars →</span></div>
    </div>,{width:1200,height:630,headers:{'Cache-Control':'private, no-store'}});
  }catch{return new Response('Unable to render card',{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
