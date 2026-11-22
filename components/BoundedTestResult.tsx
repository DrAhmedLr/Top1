'use client';

import {Check,Flag} from 'lucide-react';
import {maintenanceTargets,type Metric} from '@/lib/registry';
import {useTranslations} from './providers/LocaleProvider';
import css from './GameTierResult.module.css';

export default function BoundedTestResult({metric,value}:{metric:Metric;value:number}){
  const {locale}=useTranslations();
  const target=maintenanceTargets[metric.id];
  if(target===undefined)return null;

  const reached=value>=target;
  const unit=metric.unit==='s'?['s','s','ث']:['reps','rép.','تكرار'];
  const number=new Intl.NumberFormat(locale,{maximumFractionDigits:2});
  const l=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
  const format=(n:number)=>number.format(n)+' '+(n===1&&unit[0]==='reps'&&locale==='en'?'rep':unit[locale==='fr'?1:locale==='ar'?2:0]);
  const Icon=reached?Check:Flag;
  return <section className={css.bounded} data-maintenance={reached?'reached':'building'}>
    <span className={css.label}><Icon size={15} aria-hidden="true"/>{l('TOP1 game target','Objectif du jeu TOP1','هدف لعبة TOP1')}</span>
    <strong>{reached?l('Target reached','Objectif atteint','تم بلوغ الهدف'):l('Working toward ','En route vers ','نحو ')+format(target)}</strong>
    <progress max={target} value={Math.min(value,target)} aria-label={l('Progress to game target','Progression vers l’objectif du jeu','التقدم نحو هدف اللعبة')}/>
    <p>{reached?l('Maintain '+format(target)+' on your next test.','Maintiens '+format(target)+' au prochain test.','حافظ على '+format(target)+' في اختبارك القادم.'):l(format(target-value)+' to go.',format(target-value)+' pour atteindre l’objectif.','المتبقي '+format(target-value)+'.')}</p>
  </section>;
}
