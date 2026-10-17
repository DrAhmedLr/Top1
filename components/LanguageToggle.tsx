'use client';
import {useEffect,useRef,useState} from 'react';
import {ChevronDown,Check} from 'lucide-react';
import {useTranslations} from './providers/LocaleProvider';
import type {Locale} from '@/lib/i18n';
const languages=[{code:'en' as Locale,short:'EN',name:'English',flag:'🇬🇧'},{code:'fr' as Locale,short:'FR',name:'Français',flag:'🇫🇷'},{code:'ar' as Locale,short:'AR',name:'العربية',flag:'🇸🇦'}];
export default function LanguageToggle(){
 const {locale,t,setLocale}=useTranslations(),[open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),current=languages.find(l=>l.code===locale)!;
 useEffect(()=>{if(!open)return;const dismiss=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss);},[open]);
 return <div className="language-picker" ref={root} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const options=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role=menuitemradio]')??[]);if(!open){setOpen(true);requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>('[role=menuitemradio]')?.focus());}else{const i=options.indexOf(document.activeElement as HTMLButtonElement);options[(i+(e.key==='ArrowDown'?1:-1)+options.length)%options.length]?.focus();}}}}>
 <button ref={trigger} type="button" className="language-trigger" aria-label={`${t('Language')}: ${current.name}`} aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><span aria-hidden="true" className="language-flag">{current.flag}</span><span>{current.short}</span><ChevronDown size={14} aria-hidden="true"/></button>
 {open&&<div className="language-menu" role="menu" aria-label={t('Language')}>{languages.map(l=><button type="button" role="menuitemradio" aria-checked={l.code===locale} key={l.code} lang={l.code} onClick={()=>{setLocale(l.code);setOpen(false);trigger.current?.focus();}}><span className="language-flag" aria-hidden="true">{l.flag}</span><span className="language-name">{l.name}</span><bdi>{l.short}</bdi>{l.code===locale&&<Check size={15} aria-hidden="true"/>}</button>)}</div>}
 </div>;
}
