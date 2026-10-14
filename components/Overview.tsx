'use client';
import {recordedCoverage} from '@/lib/coverage';
import {evaluate} from '@/lib/engine';
import {activeMetrics,type Values,type PillarId,type Demographics} from '@/lib/registry';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
import {assessmentContext} from '@/lib/observationPresentation';
import PublishedReference from './PublishedReference';
import BenchmarkPanel from './BenchmarkPanel';
import RecordedDataChart from './RecordedDataChart';
export const pillarNames={bodymarkers:'Body markers',strength:'Strength & fitness',recovery:'Recovery'};
const display=(n:number)=>n.toFixed(1).replace(/\.0$/,'');
export default function Overview({values,demographics,details,result,needsSetup,onStart,onMeasurements,onScience,onCalculationReport}:{values:Values;demographics:Demographics;details:MeasurementMetadata;result:ReturnType<typeof evaluate>;needsSetup:boolean;onStart:()=>void;onMeasurements:(pillar?:PillarId)=>void;onScience:()=>void;onCalculationReport:()=>void}){
 const context=assessmentContext(result.submitted.map(s=>s.context));
 const counts=Object.fromEntries(Object.keys(pillarNames).map(id=>[id,result.measured.filter(m=>m.pillar===id).length]));
 return <div className="dashboard-summary">
 <section className="protocol-hero baseline-card"><h2>YOUR PERSONAL BASELINE</h2><div className="baseline-value">{result.ready?display(result.modelScore):'—'}<small>{result.ready?'/100 experimental index':'No model assessment yet'}</small></div><p className="baseline-status">Composite peer rank: unavailable · not validated.</p>{result.ready&&<p className="baseline-context">{result.publishedReferenceCount} published-reference input · {result.provisionalReferenceCount} uncalibrated model inputs · {context.unknownDates} undated · {context.unknownMethods} methods unknown. {context.first&&<>Observation span: {context.first.slice(0,10)} to {context.last?.slice(0,10)}.</>} This exploratory model may combine tests from different dates. {result.comparable?'Recorded comparison context is documented and self-reported.':'Comparison context is incomplete: review dates, methods and applicable protocols.'}</p>}{needsSetup&&<button className="primary-button" onClick={onStart}>Set up my profile</button>}<details className="baseline-details"><summary>Calculation details</summary><p>{result.ready?'This provisional index is not your population percentile.':result.readinessReason}</p><button className="text-link" onClick={onScience}>Methods & evidence</button><p>Adding a measurement changes the scored subset and weights; points can change without a physical change. Missing entries never count as zero.</p><PublishedReference values={values} demographics={demographics} details={details}/><BenchmarkPanel values={values} details={details} onMeasurements={()=>onMeasurements()}/><button className="text-link" disabled={needsSetup} onClick={onCalculationReport}>Download calculation report</button></details></section>
 <section className="card recorded-data-card"><div className="card-heading"><h2>YOUR RECORDED DATA</h2><div className="recorded-total"><strong aria-live="polite">{display(recordedCoverage(result.measured.length))}%</strong><small>{result.measured.length} of {activeMetrics.length} recorded</small></div></div><RecordedDataChart counts={counts} onSelect={onMeasurements}/><small className="recorded-caption">Recording coverage · not a performance rank</small></section>
 </div>;
}
