'use client';
import {benchmarkEvidence} from '@/lib/benchmarkCoverage';
import type {Metric} from '@/lib/registry';
import {useTranslations} from './providers/LocaleProvider';
export default function BenchmarkEvidence({metric,reason}:{metric:Metric;reason?:string}){
 const {locale,t}=useTranslations(),l=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en,e=benchmarkEvidence(metric);
 return <details className="benchmark-evidence"><summary>{l('Comparison details','Détails de comparaison','تفاصيل المقارنة')}</summary><p>{t(e.cohort)}</p><p>{t(e.precision)}</p>{reason&&e.kind==='published'&&<p>{t(reason)}</p>}<p>{t(e.protocol)}</p>{e.source&&<a href={e.source} target="_blank" rel="noreferrer">{l('Reference source','Source de référence','المصدر المرجعي')}</a>}{e.additionalSource&&<p><a href={e.additionalSource} target="_blank" rel="noreferrer">CDC STEADI</a> · {t(e.limitation!)}</p>}</details>;
}
