'use client';

import PerformancePyramid,{gamePercentLabel} from './PushupPyramid';
import {PERFORMANCE_RANK_FLOOR,type PerformanceProfile} from '@/lib/performanceRules';
import {Flag} from 'lucide-react';
import type {ChallengeProgress} from '@/lib/challengeProgress';
import {entryRaw} from '@/lib/focusedEntry';
import type {Locale} from '@/lib/i18n';
import type {Metric} from '@/lib/registry';
import {useTranslations} from './providers/LocaleProvider';
import css from './GameTierResult.module.css';

const arabicUnits:Readonly<Record<string,string>>={kg:'كغ',cm:'سم',m:'م'};
export type CreateTierGoal = (metricId:string, target:number)=>void;

export function gameTierLabel(tier:string, locale:Locale){
 const percent=gamePercentLabel(parseFloat(tier),locale);
 if(tier==='65%+')return (locale==='fr'?'Au-delà du top ':locale==='ar'?'خارج أعلى ':'Outside top ')+percent;
 const suffix=parseFloat(tier)<=PERFORMANCE_RANK_FLOOR?(locale==='fr'?' ou mieux':locale==='ar'?' أو أفضل':' or better'):'';
 return (locale==='ar'?'أعلى ':'Top ')+percent+suffix;
}

export default function GameTierResult({metric,progress,snapshot,onCreateGoal,disabled,showPyramid=true}:{showPyramid?:boolean;metric:Metric;progress:ChallengeProgress;snapshot?:PerformanceProfile;onCreateGoal?:CreateTierGoal;disabled?:boolean}){
 const {locale,t}=useTranslations();
 const l=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const number=new Intl.NumberFormat(locale,{maximumFractionDigits:3});
 const {next}=progress,run=metric.id==='run_5k';
 const unit=locale==='ar'?(arabicUnits[metric.unit]??t(metric.unit)):t(metric.unit);
 const model=progress.modelTopPercent;
 const inputs=snapshot?[
   snapshot.age===undefined?'':number.format(snapshot.age)+' '+l('years','ans','سنة'),
   snapshot.weight===undefined?'':number.format(snapshot.weight)+' '+l('kg','kg','كغ'),
   snapshot.sex==='female'?l('Female','Féminin','أنثى'):snapshot.sex==='male'?l('Male','Masculin','ذكر'):'',
 ].filter(Boolean).join(' · '):'';
 const missing=snapshot?[
   snapshot.age===undefined?l('age','âge','العمر'):'',
   snapshot.weight===undefined?l('weight','poids','الوزن'):'',
   !snapshot.sex||snapshot.sex==='unselected'?l('reference sex','sexe de référence','الجنس المرجعي'):'',
 ].filter(Boolean).join(locale==='ar'?'، ':', '):'';
 const basis=model!==undefined?(inputs||l('Base curve','Courbe de base','المنحنى الأساسي')):progress.basis==='sex-specific'?l('By reference sex','Selon le sexe de référence','حسب الجنس المرجعي'):progress.basis==='sex-neutral'?l('Sex-neutral scale','Barème sans distinction de sexe','سلّم موحّد للجنسين'):l('Fixed scale','Barème fixe','سلّم ثابت');
 const signedNumber=new Intl.NumberFormat(locale,{maximumFractionDigits:3,signDisplay:'always'});
 const gap=next?Math.abs(next.delta)*(run?60:1):0;
 // Clock entries persist to three decimal minutes. Round the difference to the same whole seconds shown on the clock.
 const difference=run?Math.round(gap):gap;
 const unitFor=(value:number)=>metric.unit==='reps'&&value===1&&locale==='en'?'rep':unit;
 const deltaUnit=run?t('s'):unitFor(difference);
 const minutes=run?Math.floor(difference/60):0;
 const remainingSeconds=difference-minutes*60;
 const timeGap=minutes
  ? [number.format(minutes)+' '+l('min','min','د'),remainingSeconds?number.format(remainingSeconds)+' '+deltaUnit:''].filter(Boolean).join(' ')
  : number.format(difference)+' '+deltaUnit;
 return <section className={css.card} aria-label={l('TOP1 game tier','Palier de jeu TOP1','مستوى لعبة TOP1')}>
  <div className={css.now}><div><span className={css.label}>{l('Test game position','Position du test dans le jeu','ترتيب الاختبار في اللعبة')}</span><strong><bdi>{gameTierLabel(model===undefined?progress.tier:String(model)+'%',locale)}</bdi></strong></div>{showPyramid&&model!==undefined&&<PerformancePyramid percent={model}/>}</div>
  {next?<div className={css.next}>
   <div className={css.nextHeading}><span>{l('Next tier','Prochain palier','المستوى التالي')}</span><bdi>{gameTierLabel(next.tier,locale)}</bdi></div>
   <div className={css.target}><bdi dir={run?'ltr':undefined}>{run?entryRaw(metric,next.value):number.format(next.value)}</bdi> <small>{run?l('min:sec','min:s','د:ث'):unitFor(next.value)}</small></div>
   <span className={css.gap}>{difference===0&&run?l('Less than 1 s faster','Moins de 1 s à gagner','أقل من ثانية واحدة أسرع'):next.delta<0?<><bdi>{timeGap}</bdi> {l('faster','de moins','أسرع')}</>:<bdi>{signedNumber.format(difference)} {deltaUnit}</bdi>}</span>
   {onCreateGoal&&<button type="button" className={css.goal} disabled={disabled} onClick={()=>onCreateGoal(metric.id,next.value)}><Flag size={15} aria-hidden="true"/>{l('Aim for this tier','Viser ce palier','استهدف هذا المستوى')}</button>}
  </div>:<div className={css.max}>{l('Highest available game tier','Meilleur palier disponible','أعلى مستوى متاح في اللعبة')}</div>}
  {model!==undefined&&<details className={css.basis}><summary>{l('Scoring details','Détails du calcul','تفاصيل الاحتساب')}</summary><p>{basis}{missing&&' · '+l('Neutral adjustment for '+missing+'.','Ajustement neutre pour '+missing+'.','تعديل محايد لـ'+missing+'.')}</p></details>}
 </section>;
}
