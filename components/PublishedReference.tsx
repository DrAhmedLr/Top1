'use client';
import {useTranslations} from '@/components/providers/LocaleProvider';
import type {Demographics,Values} from '@/lib/registry';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
import {vo2CohortComparison} from '@/lib/scientificCalibration';
export default function PublishedReference({values,demographics,details}:{values:Values;demographics:Demographics;details:MeasurementMetadata}){
 const {t:tr}=useTranslations();

 const test=vo2CohortComparison(values,demographics,details);
 return <div className="published-reference"><h3>{tr("VO₂ · published cohort comparison")}</h3>{test.available?<><p>{tr(test.label)}{tr(". Recorded value: ")}{test.value} {tr("mL/kg/min. FRIEND 2022 ")}{tr(test.cohort.sex)} {tr("cohort, ages ")}{test.cohort.ageMin}–{test.cohort.ageMax}, {test.cohort.sampleSize} {tr("tests.")}</p><p>{tr("Cohort mean ")}{test.mean} {tr("mL/kg/min; standard deviation ")}{test.sd}{tr(". This describes the study distribution, not measurement uncertainty.")}</p><details><summary>{tr("Published thresholds and source")}</summary><div className="history-list">{test.thresholds.map(t=><div key={t.percentile}><strong>{tr("P")}{t.percentile}</strong><span>{t.value} {tr("mL/kg/min")}</span></div>)}</div><p>{tr("Reference version: ")}{tr(test.referenceVersion)}. {tr(test.limits)}</p><a href={test.source} target="_blank" rel="noreferrer">{tr("FRIEND 2022 · Tables 2 and 3")}</a></details><p>{tr("Protocol and population match are self-reported. This individual-test comparison does not validate the experimental composite.")}</p></>:<p>{tr(test.reason)}</p>}</div>;
}
