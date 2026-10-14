'use client';
import {recordedCoverage} from '@/lib/coverage';
import {evaluate} from '@/lib/engine';
import {activeMetrics,type PillarId} from '@/lib/registry';
import RecordedDataChart from './RecordedDataChart';
export const pillarNames={bodymarkers:'Body markers',strength:'Strength & fitness',recovery:'Recovery'};
const display=(n:number)=>n.toFixed(1).replace(/\.0$/,'');
export default function Overview({result,needsSetup,onStart,onMeasurements,onScience,onCalculationReport}:{result:ReturnType<typeof evaluate>;needsSetup:boolean;onStart:()=>void;onMeasurements:(pillar?:PillarId)=>void;onScience:()=>void;onCalculationReport:()=>void}){
 const counts=Object.fromEntries(Object.keys(pillarNames).map(id=>[id,result.measured.filter(m=>m.pillar===id).length]));
 return <div className="dashboard-summary">
 <section className="protocol-hero baseline-card"><h2>YOUR PERSONAL BASELINE</h2><div className="baseline-value">{result.ready?display(result.modelScore):'—'}<small>{result.ready?'/100 experimental index':'No model assessment yet'}</small></div><p className="baseline-status">Peer percentile: pending calibration.</p>{needsSetup&&<button className="primary-button" onClick={onStart}>Set up my profile</button>}<details className="baseline-details"><summary>Calculation details</summary><p>{result.ready?'This provisional index is not your population percentile.':result.readinessReason}</p><button className="text-link" onClick={onScience}>Methods & evidence</button><button className="text-link" disabled={needsSetup} onClick={onCalculationReport}>Download calculation report</button></details></section>
 <section className="card recorded-data-card"><div className="card-heading"><h2>YOUR RECORDED DATA</h2><div className="recorded-total"><strong aria-live="polite">{display(recordedCoverage(result.measured.length))}%</strong><small>{result.measured.length} of {activeMetrics.length} recorded</small></div></div><RecordedDataChart counts={counts} onSelect={onMeasurements}/><small className="recorded-caption">Recording coverage · not a performance rank</small></section>
 </div>;
}
