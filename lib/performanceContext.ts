import {COMPETITIVE_CHALLENGE_METRICS} from './competitiveMetrics';
import type {MeasurementDetails} from './measurementMetadata';
import {normalizeProtocol,PROFILE_ONLY_PROTOCOL} from './protocols';
import type {Demographics} from './registry';

type TestProfile=Partial<Pick<Demographics,'age'|'sex'|'weight'>>;

export function performanceProfileAtTest(profile:TestProfile|undefined, details:MeasurementDetails={}) {
  const saved=details.protocol;
  return {
    age:details.ageAtMeasurement??(saved?.referenceSex===undefined?profile?.age:undefined),
    sex:saved?.referenceSex??profile?.sex,
    weight:details.derivation?.bodyWeightKg??saved?.bodyWeightKg,
  };
}

export function withPerformanceProfile(id:string, details:MeasurementDetails, profile:TestProfile):MeasurementDetails {
  if(!COMPETITIVE_CHALLENGE_METRICS.has(id))return details;
  if(profile.age!==undefined&&(!Number.isInteger(profile.age)||profile.age<18||profile.age>120))throw new Error('Use a whole test age from 18 to 120.');
  const protocol=normalizeProtocol(id,{
    ...details.protocol,
    id:details.protocol?.id??(id==='pushups'?'strict_pushups_v1':PROFILE_ONLY_PROTOCOL),
    referenceSex:profile.sex??'unselected',
    bodyWeightKg:details.derivation?.bodyWeightKg??profile.weight,
  });
  return {...details,ageAtMeasurement:profile.age,protocol};
}
