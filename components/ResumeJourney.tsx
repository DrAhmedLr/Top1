'use client';
import {useEffect,useState} from 'react';
import {journeyDraftKey,readJourneyDraft} from '@/lib/journeyDraft';
import {useTranslations} from './providers/LocaleProvider';
export default function ResumeJourney({owner,baseline,onResume}:{owner:string;baseline:string;onResume:()=>void}){const [available,setAvailable]=useState(false);const {locale}=useTranslations();useEffect(()=>{try{setAvailable(!!readJourneyDraft(localStorage.getItem(journeyDraftKey(owner)),baseline));}catch{setAvailable(false);}},[owner,baseline]);if(!available)return null;return <button className="resume-journey" onClick={onResume}>{locale==='fr'?'Continuer mes mesures':locale==='ar'?'متابعة تسجيل النتائج':'Continue adding results'} →</button>;}
