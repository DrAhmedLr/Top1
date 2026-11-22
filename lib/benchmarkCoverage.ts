import {activeMetrics,type Metric} from './registry';
import {COMPETITIVE_CHALLENGE_METRICS} from './challengeProgress';
export type BenchmarkEvidence={kind:'published'|'challenge'|'tracking';source:string;cohort:string;precision:string;protocol:string;additionalSource?:string;limitation?:string};
const published:Record<string,Omit<BenchmarkEvidence,'kind'>>={
 vo2_max:{source:'https://pubmed.ncbi.nlm.nih.gov/34809986/',cohort:'FRIEND · US treadmill laboratory participants · ages 20–89',precision:'Published P10–P90 bands; highest supported bound is Top 10%.',protocol:'Direct treadmill CPET, dated test age, reference sex, peak RER ≥1.0 and matching reference population.'},
 grip_strength:{source:'https://doi.org/10.1016/j.jshs.2024.101014',cohort:'iGRIPS · international population-weighted adults · ages 20–100+',precision:'Published P5–P95 bands; highest supported bound is Top 5%.',protocol:'Seated hydraulic dynamometer, best single result across both hands; date, test age and reference sex.'},
 grip_combined:{source:'https://www150.statcan.gc.ca/n1/pub/82-003-x/2019010/article/00002-eng.htm',cohort:'Canadian Health Measures Survey · ages 18–79',precision:'Published P10, P50, P90 and P95 bands; no extrapolated tail.',protocol:'Standing Smedley III; best of two trials per hand, summed; date, test age and reference sex.'},
 cmj:{source:'https://www150.statcan.gc.ca/n1/pub/82-003-x/2019010/article/00002-eng.htm',cohort:'Canadian Health Measures Survey · ages 18–69',precision:'Published P10, P50, P90 and P95 bands; no extrapolated tail.',protocol:'Leonardo force plate, arm swing, best of three; date, test age and reference sex.'}
};
export function benchmarkEvidence(m:Metric):BenchmarkEvidence{
 if(published[m.id])return {kind:'published',...published[m.id]};
 const challenge=COMPETITIVE_CHALLENGE_METRICS.has(m.id);
 return {kind:challenge?'challenge':'tracking',source:m.proofData.url,cohort:challenge?'TOP1 product-defined challenge':'Personal tracking',precision:challenge?'Challenge tiers are not observed population percentiles.':'No population percentile enabled.',protocol:m.proofData.instructions,...(m.id==='sit_to_stand'?{additionalSource:'https://www.cdc.gov/steadi/media/pdfs/STEADI-Assessment-30Sec-508.pdf',limitation:'CDC STEADI provides screening cutoffs for ages 60–94, not percentiles. Its 17-inch chair and final partial-stand counting rule differ from the existing full-stand test. Context only; these cutoffs do not change your level.'}: {})};
}
export const benchmarkCoverage=activeMetrics.map(metric=>({id:metric.id,name:metric.name,...benchmarkEvidence(metric)}));
