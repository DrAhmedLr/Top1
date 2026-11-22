'use client';
import {useId,useState} from 'react';
import {PYRAMID_LEAGUES} from '@/lib/pyramid';
import {useTranslations} from './providers/LocaleProvider';
const tiers=[...PYRAMID_LEAGUES].reverse();
export default function BellCurveJourney({stage}:{stage:number}){
 const clip=useId();
 const {locale,t}=useTranslations();const [preview,setPreview]=useState<number|null>(null);const current=Math.max(0,stage-1),selected=preview??current;const local=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const x=60+selected*96;const y=240-170*Math.exp(-Math.pow((x-300)/145,2)/2);
 return <figure className="bell-journey">
 <div className="bell-plot"><svg viewBox="0 0 600 280" role="img" aria-label={local('Illustrative challenge curve','Courbe illustrative des défis','منحنى تحديات توضيحي')}><defs><clipPath id={clip}><path d="M20 239 C100 239 145 220 190 149 C230 80 260 55 300 55 C340 55 370 80 410 149 C455 220 500 239 580 239 L580 250 L20 250Z"/></clipPath><linearGradient id="bell-fill" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#cde9ff"/><stop offset=".5" stopColor="#619bff"/><stop offset="1" stopColor="#ceb4ff"/></linearGradient></defs><path d="M20 239 C100 239 145 220 190 149 C230 80 260 55 300 55 C340 55 370 80 410 149 C455 220 500 239 580 239 L580 250 L20 250Z" fill="url(#bell-fill)" opacity=".42"/><path d="M20 239 C100 239 145 220 190 149 C230 80 260 55 300 55 C340 55 370 80 410 149 C455 220 500 239 580 239" fill="none" stroke="#3586ff" strokeWidth="4"/><g clipPath={`url(#${clip})`}>{tiers.map((tier,i)=><g key={tier.name}><rect x={20+i*560/6} y="0" width={560/6} height="250" fill={["#82caff","#61baf2","#5fcfbd","#a7d987","#d9b5ff","#ffd376"][i]} opacity={selected===i?.8:.45}/><line x1={20+i*560/6} x2={20+i*560/6} y1="0" y2="250" stroke="white" strokeWidth="3"/></g>)}</g><path d="M20 250H580" stroke="#dbe3ed"/><line x1={x} x2={x} y1={y} y2="250" stroke="#356eff" strokeDasharray="4 5"/><circle cx={x} cy={y} r="7" fill="#007aff" stroke="white" strokeWidth="3"/></svg>
 </div>
 <div className="bell-tiers">{tiers.map((tier,i)=><button type="button" key={tier.name} onClick={()=>setPreview(i)} aria-pressed={selected===i}><span>{t(tier.name)}</span><strong>{tier.range}</strong>{stage>0&&i===current&&<i aria-label={local('Your tier','Ton niveau','مستواك')}/> }</button>)}</div>
 <figcaption aria-live="polite">{preview!==null?<><strong>{t(tiers[selected].name)}</strong><button type="button" onClick={()=>setPreview(null)}>{local('Back to me','Revenir à moi','العودة إليّ')} ↩</button></>:stage?local('Your game tier','Ton niveau de jeu','مستواك في اللعبة'):local('Build your performance baseline','Construis ton point de départ','ابنِ خط الأساس لأدائك')}</figcaption>
 <small className="bell-disclaimer">{local('Game scale · Not a population distribution','Échelle de jeu · Pas une distribution de population','مقياس لعبة · ليس توزيعًا للسكان')}</small>
 </figure>;
}
