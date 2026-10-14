'use client';
import {benchmarkReadiness} from '@/lib/benchmark';
import type {Values} from '@/lib/registry';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
export default function BenchmarkPanel({values,details,onMeasurements}:{values:Values;details:MeasurementMetadata;onMeasurements:()=>void}){
 const status=benchmarkReadiness(values,details);
 return <section className="card benchmark-panel"><div className="card-heading"><h2>Your physical performance benchmark</h2><span>{status.completed}/{status.total} tests documented</span></div><p>A worldwide rank needs a representative reference population measured with the same tests. Calibration is pending.</p><details><summary>Review the proposed benchmark battery</summary><ul>{status.tests.map(t=><li key={t.metricId}><strong>{t.domain}: {t.name}</strong> — {t.reason}</li>)}</ul><p>This battery measures selected physical capacities. It does not rate every aspect of human ability. All measurements remain optional; incomplete batteries do not receive a comparative rank.</p></details><button className="secondary-button" onClick={onMeasurements}>Record a test</button></section>;
}
