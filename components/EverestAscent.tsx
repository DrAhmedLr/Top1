'use client';

import Image from 'next/image';
import {Crown} from 'lucide-react';
import {useState} from 'react';
import {PYRAMID_LEAGUES} from '@/lib/pyramid';
import {useTranslations} from './providers/LocaleProvider';

// Coordinates are percentages of the illustration. Each waypoint sits on a new stratum.
const route = [[24,93],[39,84],[58,73],[43,59],[56,46],[47,32],[50,16]];
const labels = ['Base camp','Camp de base','المعسكر الأساسي'];

export default function EverestAscent({stage}:{stage:number}){
 const [selected,setSelected]=useState<number|null>(null);
 const {locale,t}=useTranslations();
 const lang=locale==='fr'?1:locale==='ar'?2:0;
 const league=PYRAMID_LEAGUES[PYRAMID_LEAGUES.length-stage];
 const position=league?t(league.name):labels[lang];
 return <figure className="everest-ascent">
  <div className="everest-landscape">
   <div className="everest-axis">{[...PYRAMID_LEAGUES].reverse().map((tier,i)=><button type="button" key={tier.name} style={{top:route[i+1][1]+"%"}} onClick={()=>setSelected(i+1)} aria-pressed={selected===i+1}>{tier.range}</button>)}</div>
   <Image src="/everest-ascent.webp" fill sizes="(max-width: 680px) 100vw, 680px" alt="" priority/>
   <svg className="everest-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <polyline points={route.map(point=>point.join(',')).join(' ')} />
    {stage>0&&<polyline className="everest-route-reached" points={route.slice(0,stage+1).map(point=>point.join(',')).join(' ')}/>}
    {route.map(([left,top],index)=><circle key={index} cx={left} cy={top} r={1.05} data-reached={index<=stage}/>)}
   </svg>
   <span className="everest-crown" aria-hidden="true"><Crown size={23}/></span>
  </div>
  <figcaption aria-live="polite">{selected!==null&&<span>{t(PYRAMID_LEAGUES[6-selected].name)} · {PYRAMID_LEAGUES[6-selected].range} — </span>}{['Your position','Ta position','موقعك'][lang]} <strong>{position}</strong></figcaption>
 </figure>;
}
