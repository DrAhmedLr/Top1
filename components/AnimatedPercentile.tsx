'use client';
import {useTranslations} from '@/components/providers/LocaleProvider';
import { useEffect,useRef } from 'react';
import { animate,useReducedMotion } from 'framer-motion';
export default function AnimatedPercentile({value}:{value:number}){
 const {t:tr}=useTranslations();

  const element=useRef<HTMLSpanElement>(null),previous=useRef(0);
  const reduced=useReducedMotion();
  useEffect(()=>{
    if(reduced){if(element.current)element.current.textContent=value.toFixed(1).replace(/\.0$/,'');previous.current=value;return;}
    const controls=animate(previous.current,value,{duration:.85,ease:'easeOut',onUpdate:current=>{if(element.current)element.current.textContent=current.toFixed(1).replace(/\.0$/,'');}});
    previous.current=value;return()=>controls.stop();
  },[value,reduced]);
  return <span ref={element} className="animated-rank" aria-label={tr(`${value.toFixed(1)} model points`)}>{tr(value.toFixed(1).replace(/\.0$/,''))}</span>;
}
