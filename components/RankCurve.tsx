'use client';

import {useId} from 'react';
import {inverseCdf} from '@/lib/engine';
import type {TopBand} from '@/lib/topBands';
import css from './RankExplorer.module.css';

const left=18,right=342,bottom=111;
const chartX=(z:number)=>left+(right-left)*(z+3.2)/6.4;
const chartY=(z:number)=>bottom-88*Math.exp(-z*z/2);
const curve=Array.from({length:129},(_,i)=>{const z=-3.2+i/20;return (i?'L':'M')+chartX(z).toFixed(2)+' '+chartY(z).toFixed(2);}).join(' ');
function percentileX(p:number){
 if(p<=0)return left;
 if(p>=100)return right;
 return chartX(Math.max(-3.2,Math.min(3.2,inverseCdf(p/100))));
}

export default function RankCurve({band,percentile,caption,axisLabels}:{band?:TopBand|null;percentile?:number;caption:string;axisLabels:string[]}){
 const clip=useId(),fill=useId();
 const start=band?percentileX(100-band.to):null,end=band?percentileX(100-band.from):null;
 const point=percentile===undefined?null:percentileX(percentile);
 return <figure className={css.figure}>
  <svg viewBox="0 0 360 141" role="img" aria-label={caption} preserveAspectRatio="xMidYMid meet" direction="ltr">
   <defs><clipPath id={clip}><path d={curve+' L342 111 H18 Z'}/></clipPath>
    <linearGradient id={fill} x1="0" x2="0" y1="0" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#9ac7ff" stopOpacity=".27"/><stop offset="1" stopColor="#9ac7ff" stopOpacity=".02"/></linearGradient>
   </defs>
   {[43,77,bottom].map(y=><line key={y} x1={left} x2={right} y1={y} y2={y} stroke="#384c65" strokeDasharray={y===bottom?undefined:'2 5'}/>)}
   {[10,50,90].map(p=><line key={p} x1={percentileX(p)} x2={percentileX(p)} y1="12" y2={bottom+4} stroke="#384c65" strokeDasharray="2 5"/>)}
   <path d={curve+' L342 111 H18 Z'} fill={band||point!==null?'url(#'+fill+')':'#233347'}/>
   {start!==null&&end!==null&&<g><rect x={start} width={Math.max(1,end-start)} y="13" height={bottom-13} fill="#9ac7ff" opacity=".08"/><rect x={start} width={Math.max(1,end-start)} y="10" height={bottom-10} fill="#9ac7ff" opacity=".72" clipPath={'url(#'+clip+')'}/><path d={'M'+start+' 106 V115 H'+end+' V106'} fill="none" stroke="#9ac7ff" strokeWidth="2"/></g>}
   <path d={curve} fill="none" stroke={band||point!==null?'#9ac7ff':'#8c9baa'} strokeWidth="2.5"/>
   {point!==null&&<g><line x1={point} x2={point} y1="12" y2={bottom} stroke="#9ac7ff" strokeWidth="2" strokeDasharray="3 3"/><circle cx={point} cy={chartY((point-left)/(right-left)*6.4-3.2)} r="4.5" fill="#9ac7ff" stroke="#101b28" strokeWidth="2"/></g>}
   {[10,50,90].map((p,i)=><text className={css.tick} key={p} x={percentileX(p)} y="134" textAnchor="middle" direction="ltr">{axisLabels[i]}</text>)}
  </svg><figcaption>{caption}</figcaption>
 </figure>;
}
