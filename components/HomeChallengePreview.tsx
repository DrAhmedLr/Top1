'use client';

import {useId, useRef, useState, type KeyboardEvent} from 'react';
import {ArrowUpRight, Footprints, Hand, MoveUpRight} from 'lucide-react';
import {challengeProgress} from '@/lib/challengeProgress';
import type {Demographics} from '@/lib/registry';
import {useTranslations} from './providers/LocaleProvider';
import {gameTierLabel} from './GameTierResult';
import '@/app/home-challenge-preview.css';

const tests = [
  {id:'run_5k',names:['5 km','5 km','٥ كم'],Icon:Footprints,min:19,max:40,step:0.25,initial:27,unit:['min:sec','min:s','د:ث']},
  {id:'dead_hang',names:['Dead hang','Suspension','التعلّق'],Icon:Hand,min:10,max:120,step:1,initial:45,unit:['s','s','ث']},
  {id:'pushups',names:['Push-ups','Pompes','الضغط'],Icon:MoveUpRight,min:1,max:65,step:1,initial:20,unit:['reps','rép.','تكرارات']},
] as const;
const profiles:Demographics[]=[{age:28,weight:75,sex:'male'},{age:45,weight:90,sex:'female'}];
const clock=(minutes:number)=>{
  const seconds=Math.round(minutes*60);
  return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
};

export default function HomeChallengePreview({onRecord}:{onRecord:(id:string)=>void}) {
  const {locale}=useTranslations();
  const language=locale==='fr'?1:locale==='ar'?2:0;
  const l=(en:string,fr:string,ar:string)=>[en,fr,ar][language];
  const number=new Intl.NumberFormat(locale,{maximumFractionDigits:2});
  const base=useId();
  const tabs=useRef<(HTMLButtonElement|null)[]>([]);
  const [active,setActive]=useState(0),[profile,setProfile]=useState(0);
  const [samples,setSamples]=useState<number[]>(tests.map(test=>test.initial));
  const test=tests[active],run=test.id==='run_5k',sample=samples[active];
  const scale=challengeProgress(test.id,sample,profiles[profile]);
  const format=(n:number)=>run?clock(n):number.format(n);
  const steps=Math.round((test.max-test.min)/test.step);
  const position=Math.round((run?test.max-sample:sample-test.min)/test.step);
  const toReading=(step:number)=>run?test.max-step*test.step:test.min+step*test.step;

  function moveTab(event:KeyboardEvent<HTMLButtonElement>){
    const forward=locale==='ar'?'ArrowLeft':'ArrowRight',backward=locale==='ar'?'ArrowRight':'ArrowLeft';
    const next=event.key===forward?(active+1)%tests.length:event.key===backward?(active+tests.length-1)%tests.length:event.key==='Home'?0:event.key==='End'?tests.length-1:undefined;
    if(next===undefined)return;
    event.preventDefault();setActive(next);tabs.current[next]?.focus();
  }

  return <section id="challenge-preview" className="hcp" aria-labelledby={base+'-heading'}>
    <header><h2 id={base+'-heading'}>{l('Game preview','Aperçu du jeu','معاينة اللعبة')}</h2></header>
    <div className="hcp-tabs" role="tablist" aria-label={l('Example test','Épreuve d’exemple','اختبار تجريبي')}>
      {tests.map((item,i)=><button type="button" key={item.id} id={base+'-tab-'+i} role="tab" aria-selected={i===active} aria-controls={base+'-panel-'+i} tabIndex={i===active?0:-1} ref={e=>{tabs.current[i]=e;}} onKeyDown={moveTab} onClick={()=>setActive(i)}><item.Icon size={15} aria-hidden="true"/>{item.names[language]}</button>)}
    </div>
    {tests.map((item,i)=>i!==active&&<div key={item.id} hidden role="tabpanel" id={base+'-panel-'+i} aria-labelledby={base+'-tab-'+i}/>)}
    <div role="tabpanel" id={base+'-panel-'+active} aria-labelledby={base+'-tab-'+active}>
      <label className="hcp-profile">{l('Example profile','Profil d’exemple','ملف تجريبي')}
       <select value={profile} onChange={e=>setProfile(Number(e.target.value))}>{profiles.map((p,i)=><option key={i} value={i}>{number.format(p.age)} {l('years','ans','سنة')} · {number.format(p.weight!)} {l('kg','kg','كغ')} · {p.sex==='male'?l('Male','Homme','ذكر'):l('Female','Femme','أنثى')}</option>)}</select>
      </label>
      <div className="hcp-readout"><div><label htmlFor={base+'-slider'}>{l('Example result','Résultat d’exemple','نتيجة تجريبية')}</label><strong><bdi>{format(sample)}</bdi> <small>{test.unit[language]}</small></strong></div>
       {scale&&<div className="hcp-tier" aria-live="polite"><span>{l('Game tier','Palier du jeu','مستوى اللعبة')}</span><strong><bdi>{gameTierLabel(scale.tier,locale)}</bdi></strong></div>}</div>
      <input id={base+'-slider'} className="hcp-slider" type="range" min={0} max={steps} step={1} value={position} aria-valuetext={format(sample)+' '+test.unit[language]} onChange={e=>{const value=toReading(e.currentTarget.valueAsNumber);setSamples(previous=>previous.map((n,i)=>i===active?value:n));}}/>
      <div className="hcp-endpoints" aria-hidden="true"><bdi>{format(toReading(0))}</bdi><bdi>{format(toReading(steps))}</bdi></div>
      {scale?.next&&<p className="hcp-next">{l('Next tier','Prochain palier','المستوى التالي')} <strong><bdi>{format(scale.next.value)} {test.unit[language]}</bdi></strong><span>· <bdi>{gameTierLabel(scale.next.tier,locale)}</bdi></span></p>}
      <button className="hcp-record" type="button" onClick={()=>onRecord(test.id)}>{l('Log my own result','Saisir mon résultat','تسجيل نتيجتي')}<ArrowUpRight size={15}/></button>
    </div>
  </section>;
}
