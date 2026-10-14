import type {evaluate} from '@/lib/engine';
export default function PublishedReference({result}:{result:ReturnType<typeof evaluate>}){
 const test=result.submitted.find(s=>s.metric.id==='vo2_max'&&s.reference.provenance==='published');
 if(!test)return <p>Published individual-test reference: direct treadmill CPET VO₂ max, recorded test age 20–79. Estimated VO₂ and unsupported protocols remain tracking-only. No peer percentile is inferred.</p>;
 return <div className="published-reference"><h3>VO₂ max · published test reference</h3><p>Your recorded test: {test.value} mL/kg/min. FRIEND 2015 cohort {test.reference.cohortLabel}, {test.reference.mean} mL/kg/min mean, {test.reference.sd} standard deviation. Difference from the cohort mean: {(test.value-test.reference.mean).toFixed(1)} mL/kg/min.</p><p>US adults without cardiovascular disease who underwent direct treadmill CPET. This comparison does not establish worldwide standing or clinical interpretation. Your protocol is self-reported.</p><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC4919021/" target="_blank" rel="noreferrer">Published reference and population limits</a></div>;
}
