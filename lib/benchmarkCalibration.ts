/** Server-side research engine. No calibration is enabled in the application.
 * A reviewed reference artifact, rather than a user-submitted cohort, must be
 * supplied before any percentile can be published. */
export interface BenchmarkVariable{id:string;protocolId:string;direction:1|-1;domain:string}
export interface BenchmarkRow{id:string;weight:number;values:Record<string,number>}
export interface CalibrationArtifact{
 id:string;version:string;batteryId:string;population:string;scope:'worldwide-adults'|'national-adults'|'age-sex-peers';
 sourceKind:'probability-sample'|'convenience'|'synthetic';representative:boolean;approved:boolean;
 variables:BenchmarkVariable[];domainWeights:Record<string,number>;normalization:BenchmarkRow[];validation:BenchmarkRow[];
 validationReport:string;samplingDesign:string;effectiveSampleSize:number;validatedPercentileCeiling:number;
 confidenceLevel:number;uncertaintyMethod:string;confidenceDefinition:'strict-below';cohort?:{ageMin:number;ageMax:number;sex?:'male'|'female'};
 confidenceBands:Array<{score:number;lower:number;upper:number}>;
}
function checkedRows(rows:BenchmarkRow[],variables:BenchmarkVariable[]){
 if(!rows.length)throw new Error('A complete joint reference sample is required.');const ids=new Set<string>();
 for(const row of rows){if(!row.id||ids.has(row.id)||!Number.isFinite(row.weight)||row.weight<=0||variables.some(v=>!Number.isFinite(row.values[v.id])))throw new Error('Reference rows require unique IDs, positive survey weights and every battery value.');ids.add(row.id);}
 const sum=rows.reduce((s,r)=>s+r.weight,0);if(!Number.isFinite(sum)||sum<=0)throw new Error('Invalid total reference weight.');return sum;
}
function weightedCDF(value:number,rows:BenchmarkRow[],read:(r:BenchmarkRow)=>number,direction:1|-1=1){
 const total=rows.reduce((s,r)=>s+r.weight,0);let below=0,equal=0;
 for(const row of rows){const x=direction*read(row),target=direction*value;if(x<target)below+=row.weight;else if(x===target)equal+=row.weight;}
 return {estimate:(below+.5*equal)/total,lower:below/total,upper:(below+equal)/total};
}
export function validateCalibration(a:CalibrationArtifact){
 if(!a.approved||!a.representative||a.sourceKind!=='probability-sample'||!a.validationReport||!a.samplingDesign)throw new Error('A reviewed representative probability sample and independent validation report are required.');
 if(!a.id||!a.version||!a.population||!a.batteryId||!['worldwide-adults','national-adults','age-sex-peers'].includes(a.scope)||a.variables.length<2||new Set(a.variables.map(v=>v.id)).size!==a.variables.length||a.variables.some(v=>!v.protocolId||!v.domain||![1,-1].includes(v.direction)))throw new Error('Invalid population or test battery definition.');
 const domains=[...new Set(a.variables.map(v=>v.domain))],weights=Object.values(a.domainWeights);
 if(Object.keys(a.domainWeights).length!==domains.length||domains.some(d=>!Number.isFinite(a.domainWeights[d])||a.domainWeights[d]<=0)||Math.abs(weights.reduce((s,w)=>s+w,0)-1)>1e-9)throw new Error('Frozen domain weights must be positive and sum to one.');
 checkedRows(a.normalization,a.variables);checkedRows(a.validation,a.variables);
 const trainingIds=new Set(a.normalization.map(r=>r.id));if(a.validation.some(r=>trainingIds.has(r.id)))throw new Error('Normalization and validation participants must be disjoint.');
 if(!Number.isFinite(a.effectiveSampleSize)||a.effectiveSampleSize<=0||a.effectiveSampleSize>a.validation.length||!Number.isFinite(a.validatedPercentileCeiling)||a.validatedPercentileCeiling<=0||a.validatedPercentileCeiling>100)throw new Error('Document reference precision and supported tail resolution.');
 if(!a.uncertaintyMethod||a.confidenceDefinition!=='strict-below'||!Number.isFinite(a.confidenceLevel)||a.confidenceLevel<=0||a.confidenceLevel>=1)throw new Error('Document the confidence level, survey method and strict-below estimand.');
 if(a.scope==='age-sex-peers'&&(!a.cohort||!Number.isInteger(a.cohort.ageMin)||!Number.isInteger(a.cohort.ageMax)||a.cohort.ageMin<18||a.cohort.ageMax<a.cohort.ageMin||!['male','female'].includes(a.cohort.sex??'')))throw new Error('Age/sex peer reference cohorts require explicit age bounds and reference sex.');
 if(a.confidenceBands.length<2)throw new Error('Design-valid uncertainty bands are required.');
 a.confidenceBands.forEach((b,i)=>{const prev=a.confidenceBands[i-1];if(![b.score,b.lower,b.upper].every(Number.isFinite)||b.score<0||b.score>1||b.lower<0||b.upper>1||b.lower>b.upper||prev&&(b.score<=prev.score||b.lower<prev.lower||b.upper<prev.upper))throw new Error('Invalid or non-monotone confidence envelope.');});
}
export function empiricalBenchmark(a:CalibrationArtifact,values:Record<string,number|undefined>,protocolIds:Record<string,string|undefined>,demographics?:{age:number;sex:string}){
 validateCalibration(a);
 if(a.cohort&&(!demographics||!Number.isInteger(demographics.age)||demographics.age<a.cohort.ageMin||demographics.age>a.cohort.ageMax||a.cohort.sex!==undefined&&a.cohort.sex!==demographics.sex))return {available:false as const,reason:'This reference cohort does not match the recorded comparison context.'};
 if(a.variables.some(v=>!Number.isFinite(values[v.id])||protocolIds[v.id]!==v.protocolId))return {available:false as const,reason:'Complete the same fixed protocol battery; missing tests are not scored as zero.'};
 const composite=(input:Record<string,number|undefined>)=>{
  const byDomain:Record<string,number[]>={};
  for(const v of a.variables){const p=weightedCDF(input[v.id]!,a.normalization,r=>r.values[v.id],v.direction).estimate;(byDomain[v.domain]??=[]).push(p);}
  // Frozen domain weights prevent extra correlated tests from enlarging a
  // domain's weight. The compensatory arithmetic rule is a disclosed policy.
  return Object.entries(byDomain).reduce((s,[domain,ps])=>s+a.domainWeights[domain]*ps.reduce((x,p)=>x+p,0)/ps.length,0);
 };
 const score=composite(values),reference=a.validation.map(row=>({...row,values:{composite:composite(row.values)}}));
 const rank=weightedCDF(score,reference,r=>r.values.composite);
 if(100*rank.lower>a.validatedPercentileCeiling)return {available:false as const,score,reason:'This result exceeds the validated resolution of the reference tail. No precise percentile is reported.'};
 const lowerBand=a.confidenceBands.filter(b=>b.score<=score).at(-1),upperBand=a.confidenceBands.find(b=>b.score>=score);
 const lower=lowerBand?.lower??0,upper=upperBand?.upper??1;
 if(lower>rank.lower+1e-9||upper<rank.lower-1e-9)throw new Error('The uncertainty envelope does not match the supplied joint reference.');
 return {available:true as const,calibrationId:a.id,version:a.version,batteryId:a.batteryId,population:a.population,scope:a.scope,
 score,percentile:100*rank.lower,midrankPercentile:100*rank.estimate,tieRange:[100*rank.lower,100*rank.upper],interval:[100*lower,100*upper],confidenceLevel:a.confidenceLevel,effectiveSampleSize:a.effectiveSampleSize,
 topOnePercent:rank.lower>=.99&&lower>=.99&&a.validatedPercentileCeiling>=99,verifiedPerformance:false,
 interpretation:'Position under this declared physical-test battery and weighting policy. This is not a universal rating of a person. Input verification is a separate requirement.'};
}
