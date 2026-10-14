'use client';
import {benchmarkReadiness} from '@/lib/benchmark';
import type {Values} from '@/lib/registry';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
export default function BenchmarkPanel({values,details,onMeasurements}:{values:Values;details:MeasurementMetadata;onMeasurements:()=>void}){
 const status=benchmarkReadiness(values,details);
 return <section className="card benchmark-panel"><div className="card-heading"><h2>Your age & sex peer benchmark</h2><span>{status.completed}/{status.total} tests documented</span></div><p><strong>Peer percentile: pending calibration.</strong> Compare physical performance with adults in the same age and reference-sex group. A representative peer reference measured with the same tests is not connected yet.</p><details><summary>Review the proposed benchmark battery</summary><ul>{status.tests.map(t=><li key={t.metricId}><strong>{t.domain}: {t.name}</strong> — {t.reason}</li>)}</ul><p>This battery measures selected physical capacities. It does not rate every aspect of human ability. All measurements remain optional; incomplete batteries do not receive a comparative rank. Absolute adult comparisons are separate from age/sex peer rankings.</p></details><button className="secondary-button" onClick={onMeasurements}>Record a test</button></section>;
}
