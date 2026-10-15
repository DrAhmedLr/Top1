'use client';
import {useTranslations} from '@/components/providers/LocaleProvider';
import {benchmarkReadiness} from '@/lib/benchmark';
import type {Values} from '@/lib/registry';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
export default function BenchmarkPanel({values,details,onMeasurements}:{values:Values;details:MeasurementMetadata;onMeasurements:()=>void}){
 const {t:tr}=useTranslations();

 const status=benchmarkReadiness(values,details);
 return <section className="card benchmark-panel"><div className="card-heading"><h2>{tr("Your age & sex peer benchmark")}</h2><span>{status.completed}/{status.total} {tr("tests documented")}</span></div><p><strong>{tr("Peer percentile: pending calibration.")}</strong> {tr("Compare physical performance with adults in the same age and reference-sex group. A representative peer reference measured with the same tests is not connected yet.")}</p><details><summary>{tr("Review the proposed benchmark battery")}</summary><ul>{status.tests.map(t=><li key={t.metricId}><strong>{tr(t.domain)}: {tr(t.name)}</strong> — {tr(t.reason)}</li>)}</ul><p>{tr("This battery measures selected physical capacities. It does not rate every aspect of human ability. All measurements remain optional; incomplete batteries do not receive a comparative rank. Absolute adult comparisons are separate from age/sex peer rankings.")}</p></details><button className="secondary-button" onClick={onMeasurements}>{tr("Record a test")}</button></section>;
}
