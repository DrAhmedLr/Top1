'use client';
import {Check} from 'lucide-react';
import {probabilityLabel,useProgramCopy} from './programCopy';
import s from './AdaptiveProgram.module.css';

export type ProgrammeDateOption={date:string;probability:number|null};
export default function ProgrammeDates({name,options,value,onChange,saved,manual=false}:{name:string;options:ProgrammeDateOption[];value:string;onChange:(date:string)=>void;saved?:string;manual?:boolean}){
 const {l,locale}=useProgramCopy();
 const format=new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric',calendar:'gregory',timeZone:'UTC'});
 return <fieldset className={s.datePicker}><legend>{l('Target date','Date cible','تاريخ الهدف')}</legend><small>{manual?l('Scenario under your training assumptions','Scénario selon tes hypothèses d’entraînement','سيناريو بحسب افتراضات تدريبك'):l('If you follow the plan · initial estimate','Si tu suis le programme · estimation initiale','عند الالتزام بالخطة · تقدير أولي')}</small><div className={s.dateChoices}>
   {options.map(option=>{
     const checked=option.date===value;
     return <label key={option.date} className={s.dateOption} data-selected={checked}>
       <input type="radio" name={name} value={option.date} checked={checked} onChange={()=>onChange(option.date)}/>
       <span><time dateTime={option.date}>{format.format(new Date(option.date+'T12:00Z'))}</time>{checked&&<Check size={13} aria-hidden="true"/>}</span>
       {option.probability!==null&&<bdi>{probabilityLabel(option.probability,locale)}</bdi>}{option.date===saved&&<small>{l('Saved date','Date enregistrée','الموعد المحفوظ')}</small>}
     </label>;
   })}</div></fieldset>;
}
