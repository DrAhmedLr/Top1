export type CalculationFormula='epley_ratio_v1'|'pullup_ratio_v1'|'cooper_v1'|'jackson_pollock_male_3site_v1';
export interface CalculationDerivation{formula:CalculationFormula;inputs:number[];bodyWeightKg?:number;ageAtTest?:number}
export function cooper(meters:number){if(!Number.isFinite(meters)||meters<=504.9)throw new RangeError('Unsupported Cooper distance.');return (meters-504.9)/44.73;}
export function epley(weight:number,reps:number){if(!Number.isFinite(weight)||weight<=0||!Number.isInteger(reps)||reps<1||reps>10)throw new RangeError('Use positive load and 1–10 whole repetitions.');const estimate=reps===1?weight:weight*(1+reps/30);if(!Number.isFinite(estimate))throw new RangeError('Estimated load exceeds the supported numerical range.');return estimate;}
export function weightedPullupRatio(addedKg:number,reps:number,weightKg:number){if(!Number.isFinite(addedKg)||addedKg<0||!Number.isFinite(weightKg)||weightKg<=0)throw new RangeError('Invalid pull-up load.');return (epley(weightKg+addedKg,reps)-weightKg)/weightKg;}
export function skinfold(chest:number,abdomen:number,thigh:number,age:number){
  if(![chest,abdomen,thigh].every(n=>Number.isFinite(n)&&n>0&&n<=80)||!Number.isInteger(age)||age<18||age>61)throw new RangeError('Male Jackson–Pollock estimate supports age 18–61 and plausible site measurements.');
  const sum=chest+abdomen+thigh,density=1.10938-.0008267*sum+.0000016*sum*sum-.0002574*age;
  const result=495/density-450;if(!Number.isFinite(result)||result<3||result>60)throw new RangeError('Skinfold estimate outside supported range.');return result;
}

export function normalizeDerivation(metricId:string,raw:unknown):CalculationDerivation{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid calculation inputs.');const d=raw as CalculationDerivation;
 const formulas:Record<string,string[]>= {vo2_max:['cooper_v1'],body_fat:['jackson_pollock_male_3site_v1'],pullup_1rm:['pullup_ratio_v1'],squat_1rm:['epley_ratio_v1'],deadlift_1rm:['epley_ratio_v1'],bench_1rm:['epley_ratio_v1']};
 if(!formulas[metricId]?.includes(d.formula)||!Array.isArray(d.inputs)||!d.inputs.every(n=>typeof n==='number'&&Number.isFinite(n)))throw new Error('Calculation formula does not match this metric.');
 const expected=d.formula==='cooper_v1'?1:d.formula==='jackson_pollock_male_3site_v1'?3:2;if(d.inputs.length!==expected)throw new Error('Missing original calculation inputs.');
 const out:CalculationDerivation={formula:d.formula,inputs:[...d.inputs]};
 if(d.formula.includes('ratio')){if(!Number.isFinite(d.bodyWeightKg)||d.bodyWeightKg!<25||d.bodyWeightKg!>350)throw new Error('Record body weight at the test.');out.bodyWeightKg=d.bodyWeightKg;}
 if(d.formula==='jackson_pollock_male_3site_v1'){if(!Number.isInteger(d.ageAtTest)||d.ageAtTest!<18||d.ageAtTest!>61)throw new Error('Unsupported skinfold test age.');out.ageAtTest=d.ageAtTest;}
 calculationValue(out);return out;
}
export function calculationValue(d:CalculationDerivation){const [a,b,c]=d.inputs;const value=d.formula==='cooper_v1'?cooper(a):d.formula==='jackson_pollock_male_3site_v1'?skinfold(a,b,c,d.ageAtTest!):d.formula==='pullup_ratio_v1'?weightedPullupRatio(a,b,d.bodyWeightKg!):epley(a,b)/d.bodyWeightKg!;if(!Number.isFinite(value))throw new Error('Nonfinite calculated value.');return value;}
