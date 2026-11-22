'use client';

import type {Locale} from '@/lib/i18n';
import {PERFORMANCE_RANK_FLOOR} from '@/lib/performanceRules';
import {useTranslations} from './providers/LocaleProvider';

export function gamePercentLabel(percent:number,locale:Locale){
 return new Intl.NumberFormat(locale,{style:'percent',maximumSignificantDigits:3,useGrouping:false}).format(percent/100);
}

/** Equal vertical distances represent a tenfold change in modeled game position. */
export default function PerformancePyramid({percent}:{percent:number}){
 const {locale}=useTranslations(),cap=PERFORMANCE_RANK_FLOOR;
 const pct=(n:number)=>gamePercentLabel(n,locale);
 const topLabel=percent<=cap?pct(cap)+(locale==='fr'?' ou mieux':locale==='ar'?' أو أفضل':' or better'):pct(percent);
 const label=(locale==='fr'?'Position dans le jeu · top ':locale==='ar'?'ترتيب اللعبة · أعلى ':'Game position · top ')+topLabel;
 const top=10,bottom=80,middle=62;
 const level=(n:number)=>bottom-(bottom-top)*Math.log10(100/Math.max(cap,Math.min(n,100)))/Math.log10(100/cap);
 const widthAt=(y:number)=>(y-top)*.77;
 const y=level(percent);
 return <svg className="performance-pyramid" viewBox="0 0 155 94" role="img" aria-label={label} direction="ltr">
   <path d="M62 10 116 80H8Z" fill="#203a55" stroke="#5380a9" strokeWidth="1"/>
   {[100,10,1,.01].map(n=>{
     const y=level(n),width=widthAt(y);
     return <g key={n}><path d={`M${middle-width} ${y}H${middle+width}`} stroke="#537491"/><text x="121" y={y+2.5} fill="#b4c9db" fontSize="7.8">{pct(n)}</text></g>;
   })}
   <path d={`M${middle-widthAt(y)} ${y}H${middle+widthAt(y)}`} stroke="#a9d9ff" strokeWidth="3"/>
   <circle cx={middle} cy={y} r="3.8" fill="#b5e1ff" stroke="#14283f" strokeWidth="1.3"/>
 </svg>;
}
