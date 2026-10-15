'use client';
import {useTranslations} from '@/components/providers/LocaleProvider';
import {evaluate} from '@/lib/engine';
import {activeMetrics,type Values,type PillarId,type Demographics} from '@/lib/registry';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
import MetricStandings from './MetricStandings';
import {TOP_BAND_EDGES} from '@/lib/topBands';
import PublishedReference from './PublishedReference';
import BenchmarkPanel from './BenchmarkPanel';
import RecordedDataChart from './RecordedDataChart';
export const pillarNames={bodymarkers:'Body markers',strength:'Strength & fitness',recovery:'Recovery'};
export default function Overview({values,demographics,details,result,needsSetup,onStart,onMeasurements,onScience,onCalculationReport}:{values:Values;demographics:Demographics;details:MeasurementMetadata;result:ReturnType<typeof evaluate>;needsSetup:boolean;onStart:()=>void;onMeasurements:(pillar?:PillarId,metricId?:string)=>void;onScience:()=>void;onCalculationReport:()=>void}){
 const {t:tr}=useTranslations();
 const counts=Object.fromEntries(Object.keys(pillarNames).map(id=>[id,result.measured.filter(m=>m.pillar===id).length]));
 return <div className="dashboard-summary">
 <section className="protocol-hero baseline-card benchmark-hero"><span className="eyebrow">{tr('YOUR PERFORMANCE, IN PERSPECTIVE')}</span><h2>{tr(result.measured.length?'Your results, test by test':'Find your starting point.')}</h2>
 {result.measured.length?<MetricStandings values={values} demographics={demographics} details={details} onMeasurements={id=>onMeasurements(undefined,id)}/>:<><p className="benchmark-intro">{tr('Your measurements. A clearer perspective. One step at a time.')}</p><p>{tr('Start free on this device. An account is optional for saving across devices.')}</p></>}
 <button className="primary-button" onClick={needsSetup?onStart:()=>onMeasurements()}>{tr(needsSetup?'Get started':'Record a measurement')}</button>
 <details className="baseline-details"><summary>{tr('How the brackets work')}</summary><p>{tr('Smaller bands at the top, broader bands elsewhere. The best displayed bracket is Top 1%; the last is 65%+.')}</p><div className="bracket-scale" aria-label={tr('Reference bracket boundaries')}>{TOP_BAND_EDGES.map(edge=><span key={edge} dir="ltr">{edge}%</span>)}<span dir="ltr">65%+</span></div><p>{tr('Results span multiple brackets when the published data is less precise. No decimal world ranks are inferred.')}</p><PublishedReference values={values} demographics={demographics} details={details}/></details>
 <details className="baseline-details"><summary>{tr('Methods & calculation details')}</summary><p>{tr('The combined index is experimental. It is not a population percentile.')}</p>{result.ready&&<p>{tr('Experimental index')}: <bdi>{result.modelScore.toFixed(1)}/100</bdi></p>}<p>{tr('Missing entries never count as zero.')}</p><BenchmarkPanel values={values} details={details} onMeasurements={()=>onMeasurements()}/><button className="text-link" onClick={onScience}>{tr('Methods & evidence')}</button><button className="text-link" disabled={needsSetup} onClick={onCalculationReport}>{tr('Download calculation report')}</button></details></section>
 <section className="card recorded-data-card"><div className="card-heading"><h2>{tr('YOUR RECORDED DATA')}</h2><div className="recorded-total"><strong aria-live="polite">{(100*result.measured.length/activeMetrics.length).toFixed(1)}%</strong><small>{result.measured.length} {tr('of')} {activeMetrics.length} {tr('recorded')}</small></div></div><RecordedDataChart counts={counts} onSelect={onMeasurements}/><small className="recorded-caption">{tr('Recording coverage · not a performance rank')}</small></section>
 </div>;
}
