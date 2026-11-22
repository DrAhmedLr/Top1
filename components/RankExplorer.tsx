'use client';
import {useId,useMemo,useState} from 'react';
import {ArrowUpRight,ChevronDown,ChevronRight,ExternalLink,SlidersHorizontal} from 'lucide-react';
import {entryRaw,entryUnit} from '@/lib/focusedEntry';
import {goalMetrics} from '@/lib/adaptiveProgram';
import {inverseCdf,valid} from '@/lib/engine';
import type {Observation} from '@/lib/history';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
import {measurementTrack,performanceOrder} from '@/lib/performanceCatalog';
import {COMPETITIVE_CHALLENGE_METRICS} from '@/lib/competitiveMetrics';
import {challengeBand,personalPosition,referenceRank} from '@/lib/rankExplorer';
import {usePrivateMetricHistory} from '@/lib/hooks/usePrivateMetricHistory';
import {maintenanceTargets,type Demographics,type Values} from '@/lib/registry';
import type {TopBand} from '@/lib/topBands';
import {useTranslations} from './providers/LocaleProvider';
import {MetricIcon} from './MetricIcon';
import {performanceProfileAtTest} from '@/lib/performanceContext';
import OverallPerformanceRank from './OverallPerformanceRank';
import BoundedTestResult from './BoundedTestResult';
import GameTierResult,{gameTierLabel,type CreateTierGoal} from './GameTierResult';
import css from './RankExplorer.module.css';

export type RankExplorerProps={
 values:Values;details:MeasurementMetadata;profile?:Demographics;metricId?:string;onSelect?:(id:string)=>void;
 onRecord?:(id:string)=>void;onHistory?:(id:string)=>void;onGoal?:(metric:string)=>void;onCreateGoal?:CreateTierGoal;disabled?:boolean;owner?:string;guestEntries?:Observation[];revision?:number;
};
const noEntries:Observation[]=[];
const selectionGroups=[
 {names:['Performance tests','Tests de performance','اختبارات الأداء'],metrics:performanceOrder.filter(m=>measurementTrack(m.id)==='performance')},
 {names:['Bounded comparisons','Comparaisons plafonnées','مقارنات محدودة'],metrics:performanceOrder.filter(m=>measurementTrack(m.id)==='capped')},
 {names:['Personal tracking','Suivi personnel','المتابعة الشخصية'],metrics:performanceOrder.filter(m=>measurementTrack(m.id)==='journal')},
];
const left=18,right=342,bottom=111;
const chartX=(z:number)=>left+(right-left)*(z+3.2)/6.4;
const chartY=(z:number)=>bottom-88*Math.exp(-z*z/2);
const curve=Array.from({length:129},(_,i)=>{const z=-3.2+i/20;return (i?'L':'M')+chartX(z).toFixed(2)+' '+chartY(z).toFixed(2);}).join(' ');
function percentileX(p:number){
 if(p<=0)return left;
 if(p>=100)return right;
 return chartX(Math.max(-3.2,Math.min(3.2,inverseCdf(p/100))));
}

function RankCurve({band,percentile,caption,axisLabels}:{band?:TopBand|null;percentile?:number;caption:string;axisLabels:string[]}){
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

export default function RankExplorer({values,details,profile,metricId,onSelect,onRecord,onHistory,onGoal,onCreateGoal,disabled,owner='guest',guestEntries=noEntries,revision=0}:RankExplorerProps){
 const {locale,t}=useTranslations(),l=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const uid=useId(),[chosen,setChosen]=useState(''),[mode,setMode]=useState<'reference'|'personal'>('reference');
 const metric=performanceOrder.find(m=>m.id===(metricId??chosen))??performanceOrder.find(m=>valid(m,values[m.id]))??performanceOrder[0];
 const {id}=metric,context=details[id]??{};
 const assessed=useMemo(()=>referenceRank(metric,values[id],profile,details[id]),[metric,id,values,profile,details]);
 const {value,evidence,published,challenge,progress,reason}=assessed;
 const {rows,loading,failed,retry}=usePrivateMetricHistory(owner,id,revision,guestEntries,mode==='personal'&&value!==undefined);
 const personal=useMemo(()=>personalPosition(metric,value,context,rows),[metric,value,context,rows]);
 const format=new Intl.NumberFormat(locale,{maximumFractionDigits:1});
 const percent=(n:number)=>new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:1}).format(n/100);
 const numeric=(n:number)=>new Intl.NumberFormat(locale,{maximumFractionDigits:3}).format(n);
 const raw=value!==undefined?(id==='run_5k'?entryRaw(metric,value):numeric(Number(entryRaw(metric,value)))):'—';
 const band=published?.band??(challenge?challengeBand(challenge):null);
 const bandText=published?(published.band.kind==='upper'?l('Top '+percent(published.band.to)+' or better','Top '+percent(published.band.to)+' ou mieux','ضمن أعلى '+percent(published.band.to)+' أو أفضل'):published.band.kind==='lower'?l('Outside the top '+percent(published.band.from),'Au-delà du top '+percent(published.band.from),'خارج أعلى '+percent(published.band.from)):l('Top ','Top ','أعلى ')+format.format(published.band.from)+'–'+percent(published.band.to)):undefined;
 const challengeText=challenge?gameTierLabel(challenge,locale):undefined;
 const activePersonal=value!==undefined&&mode==='personal'&&(personal.kind==='personal'||personal.kind==='logged')&&!loading&&!failed;
 const result=mode==='reference'?bandText??challengeText:activePersonal?percent(personal.percentile):undefined;
 const isHealth=evidence.kind==='tracking'||id==='zone2_power';
 const suggestPersonal=mode==='reference'&&!published&&!challenge&&value!==undefined;
 const showCurve=mode==='personal'?activePersonal:!!published;
 const pLabel=l('Personal percentile','Percentile personnel','المئين الشخصي');
 const modeLabel=mode==='personal'?pLabel:published?l('Published cohort','Cohorte publiée','عينة منشورة'):challenge?l('TOP1 challenge tier','Palier du défi TOP1','مستوى تحدّي TOP1'):l('Reference','Référence','المرجع');
 const noRank=mode==='reference'&&isHealth?l('Personal tracking','Suivi personnel','متابعة شخصية'):value===undefined?l('No result yet','Aucun résultat','لا توجد نتيجة بعد'):l('No rank available','Rang indisponible','لا توجد مرتبة متاحة');
 const description=mode==='personal'?loading?l('Loading your measurements…','Chargement de tes mesures…','جارٍ تحميل قياساتك…'):failed?l('Your history could not be loaded.','Ton historique n’a pas pu être chargé.','تعذّر تحميل سجلك.'):personal.kind==='personal'
   ?l('Compared with '+format.format(personal.count)+' earlier comparable '+(personal.count===1?'test.':'tests.'),'Comparaison avec '+format.format(personal.count)+' '+(personal.count===1?'mesure antérieure comparable.':'mesures antérieures comparables.'),'بالمقارنة مع قياساتك السابقة المماثلة وعددها '+format.format(personal.count)+'.')
   :personal.kind==='logged'?l('Compared with your earlier logged values ('+format.format(personal.count)+'). Test protocols unverified.','Comparaison avec tes valeurs déjà saisies ('+format.format(personal.count)+'). Protocoles de mesure non vérifiés.','مقارنة بقيمك المسجلة سابقًا ('+format.format(personal.count)+'). لم يتم التحقق من بروتوكولات القياس.')
   :personal.kind==='insufficient'?l('No earlier value to compare. Record this measurement on two occasions to see your percentile.','Aucune valeur antérieure à comparer. Saisis cette mesure à deux reprises pour voir ton percentile.','لا توجد قيمة سابقة للمقارنة. سجّل هذا القياس في مناسبتين لعرض مئينك.')
   :l('Record your first test to start a personal history.','Enregistre un premier test pour commencer ton historique.','سجّل أول اختبار لبدء سجلك الشخصي.')
  :published?t(published.reference):challenge?l('Your level on the TOP1 game scale.','Ton niveau sur le barème de jeu TOP1.','مستواك وفق سلم تحدّي TOP1.'):value===undefined?l('Record a result to see the comparison available for this test.','Enregistre un résultat pour voir la comparaison disponible pour ce test.','سجّل نتيجة لمعرفة المقارنة المتاحة لهذا الاختبار.')
  :reason?t(reason):l('TOP1 has no compatible population reference for this measurement.','TOP1 ne dispose pas de référence de population compatible avec cette mesure.','لا يتوفر في TOP1 مرجع سكاني متوافق مع هذا القياس.');
 const caption=mode==='personal'?l('Schematic curve · numerical position in your history','Courbe schématique · position numérique dans ton historique','منحنى توضيحي · الموضع العددي في سجلك'):published?l('Schematic curve · shaded area shows your published range','Courbe schématique · zone colorée de ton intervalle publié','منحنى توضيحي · المنطقة المظللة تمثل نطاقك المنشور'):challenge?l('Schematic curve of TOP1 tiers · shaded area shows your tier','Courbe schématique des paliers TOP1 · ton palier est coloré','منحنى توضيحي لمستويات TOP1 · مستواك مظلل'):l('Schematic curve · no result positioned','Courbe schématique · aucun résultat positionné','منحنى توضيحي · لم توضع نتيجة عليه');
 const cohort=mode==='reference'?published?.cohort.split(' · '):undefined;
 const showTier=mode==='reference'?progress:null;
 const showMaintenance=mode==='reference'&&value!==undefined&&maintenanceTargets[id]!==undefined;
 const hasGameResult=performanceOrder.some(m=>COMPETITIVE_CHALLENGE_METRICS.has(m.id)&&valid(m,values[m.id]));
 return <section className={css.explorer} aria-label={l('Explore your rankings','Explorer tes classements','استكشف تصنيفاتك')}>
  <h2 className={css.title}>{l('Your ranking','Ton classement','تصنيفك')}</h2>
  {hasGameResult&&<OverallPerformanceRank values={values} details={details} profile={profile}/>}
  <div className={css.controls}>
   <label htmlFor={uid} className={css.selectLabel}>{l('Individual test','Test individuel','الاختبار الفردي')}</label>
   <div className={css.selectWrap}><MetricIcon id={id} size={20}/><select id={uid} value={id} onChange={e=>{setChosen(e.target.value);setMode('reference');onSelect?.(e.target.value);}}>
    {selectionGroups.map(group=><optgroup key={group.names[0]} label={group.names[locale==='fr'?1:locale==='ar'?2:0]}>{group.metrics.map(item=><option value={item.id} key={item.id}>{t(item.name)}</option>)}</optgroup>)}
   </select><ChevronDown size={17}/></div>
  </div>
  {value!==undefined&&<div className={css.modes} aria-label={l('Comparison group','Groupe de comparaison','مجموعة المقارنة')} role="group">
   <button type="button" aria-pressed={mode==='reference'} onClick={()=>setMode('reference')}>{l('Standing','Position','المستوى')}</button>
   <button type="button" aria-pressed={mode==='personal'} onClick={()=>setMode('personal')}>{l('My history','Mon historique','سجلي')}</button>
  </div>}
  <article className={css.panel} aria-live="polite" aria-busy={loading}>
   <div className={css.topline}><div><span className={css.overline}>{l('Current result','Résultat actuel','النتيجة الحالية')}</span><strong className={css.raw}><bdi>{raw}</bdi>{value!==undefined&&<small> {t(entryUnit(metric))}</small>}</strong></div>
    {onRecord&&<button className={css.entry} type="button" disabled={disabled} onClick={()=>onRecord(id)}>{l('Log result','Saisir','تسجيل')}<ArrowUpRight size={15}/></button>}
   </div>
   {showTier&&<GameTierResult metric={metric} progress={showTier} snapshot={performanceProfileAtTest(profile,context)} onCreateGoal={onCreateGoal} disabled={disabled}/>}
   {showMaintenance&&<BoundedTestResult metric={metric} value={value}/>}
   {!showMaintenance&&(!showTier||published)&&<div className={css.ranking}><span className={css.overline}>{modeLabel}</span><h3 className={result?css.rangeValue:css.noRank} dir="auto">{result??(loading?'…':noRank)}</h3><p>{description}</p></div>}
   {showCurve&&<RankCurve band={mode==='reference'?band:null} percentile={activePersonal?personal.percentile:undefined} caption={caption} axisLabels={['P10','P50','P90']}/>}
   {cohort&&<p className={css.cohort}>{l('Reference group','Groupe de référence','المجموعة المرجعية')} · <bdi>{cohort[0]}</bdi> {l('years','ans','سنة')} · {t(cohort[1])}</p>}
   {failed&&<button className={css.action} type="button" onClick={retry}>{l('Retry','Réessayer','أعد المحاولة')}</button>}
   {suggestPersonal&&<button type="button" className={css.action} onClick={()=>setMode('personal')}>{l('Compare with my history','Comparer avec mon historique','المقارنة مع سجلي')}<ChevronRight size={16}/></button>}
   {mode==='personal'&&onHistory&&value!==undefined&&!loading&&!failed&&<button className={css.action} type="button" onClick={()=>onHistory(id)}>{l('View dated results','Voir les résultats datés','عرض النتائج المؤرخة')}<ChevronRight size={16}/></button>}
  </article>
  {onGoal&&!(showTier?.next&&onCreateGoal)&&goalMetrics.some(row=>row.id===id)&&<button type="button" className={css.goal} onClick={()=>onGoal(id)}>{l('Set a goal','Définir un objectif','تحديد هدف')}<ChevronRight size={17}/></button>}
  {mode==='reference'&&evidence.kind==='published'&&<details className={css.method}><summary><SlidersHorizontal size={15}/>{l('Reference and test protocol','Référence et protocole du test','المرجع وبروتوكول الاختبار')}<ChevronDown size={16}/></summary>
   {challenge&&reason&&<p>{t(reason)}</p>}
   <p>{id==='vo2_max'?l('FRIEND compares direct treadmill CPET for ages 20–89. Enter test age, date, reference sex, peak RER and reference-population eligibility.','FRIEND compare les tests directs sur tapis des 20–89 ans. Il faut la date, l’âge au test, le sexe de référence, le RER de pointe et les critères de la cohorte.','يقارن FRIEND اختبارات الجهد المباشرة على جهاز المشي للأعمار 20–89 سنة. يلزم تاريخ الاختبار والعمر والجنس المرجعي وأعلى RER وأهلية العينة.')
    :id==='grip_strength'?l('iGRIPS compares adults aged 20 and over. Use the highest single reading across both hands, seated with a hydraulic dynamometer, three trials per hand.','iGRIPS compare les adultes dès 20 ans. Retenir la meilleure valeur des deux mains, en position assise avec un dynamomètre hydraulique et trois essais par main.','يقارن iGRIPS البالغين من عمر 20 سنة. تُعتمد أعلى قراءة منفردة لليدين في وضع الجلوس بمقياس هيدروليكي، بعد ثلاث محاولات لكل يد.')
    :l('The Canadian survey compares ages 18–69. Use a Leonardo force plate, arms free, and the best of three jumps.','L’enquête canadienne compare les 18–69 ans. Utiliser une plateforme de force Leonardo, bras libres, et retenir le meilleur de trois sauts.','يقارن المسح الكندي الأعمار 18–69 سنة. تُستخدم منصة قوة Leonardo مع تأرجح الذراعين ويُعتمد أفضل ثلاث قفزات.')}</p>
   {published?.attribution&&<p>{t(published.attribution)}</p>}
   <a className={css.source} href={evidence.source} target="_blank" rel="noreferrer">{l('Published study','Étude publiée','الدراسة المنشورة')} <ExternalLink size={13}/></a>
  </details>}
  {mode==='personal'&&activePersonal&&<details className={css.method}><summary><SlidersHorizontal size={15}/>{l('How this is calculated','Comment ce chiffre est calculé','طريقة الحساب')}<ChevronDown size={16}/></summary><p>{l('This percentile counts earlier values lower than yours and half of equal values. It describes the numerical position of this result.','Ce percentile compte les valeurs antérieures inférieures à la tienne et la moitié des valeurs égales. Il décrit la position numérique de ta mesure.','يحسب هذا المئين القيم السابقة الأقل من قيمتك ونصف القيم المساوية لها. وهو يصف الموضع العددي لنتيجتك.')}</p></details>}
  {!hasGameResult&&<OverallPerformanceRank values={values} details={details} profile={profile}/>}
 </section>;
}
