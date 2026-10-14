import type {Demographics,Values} from '@/lib/registry';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
import {vo2CohortComparison} from '@/lib/scientificCalibration';
export default function PublishedReference({values,demographics,details}:{values:Values;demographics:Demographics;details:MeasurementMetadata}){
 const test=vo2CohortComparison(values,demographics,details);
 return <div className="published-reference"><h3>VO₂ · published cohort comparison</h3>{test.available?<><p>{test.label}. Recorded value: {test.value} mL/kg/min. FRIEND 2015 {test.cohort.sex} cohort, ages {test.cohort.ageMin}–{test.cohort.ageMax}, {test.cohort.sampleSize} tests.</p><p>Cohort mean {test.mean} mL/kg/min; standard deviation {test.sd}. This describes the study distribution, not measurement uncertainty.</p><details><summary>Published thresholds and source</summary><div className="history-list">{test.thresholds.map(t=><div key={t.percentile}><strong>P{t.percentile}</strong><span>{t.value} mL/kg/min</span></div>)}</div><p>Reference version: {test.referenceVersion}. {test.limits}</p><a href={test.source} target="_blank" rel="noreferrer">FRIEND 2015 · Tables 3 and 4</a></details><p>Protocol and population match are self-reported. This individual-test comparison does not validate the experimental composite.</p></>:<p>{test.reason}</p>}</div>;
}
