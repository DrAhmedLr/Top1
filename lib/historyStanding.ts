import {formatGamePercent} from './pushupChallenge';
import {resultComparison} from './journeyResult';
import {bandLabel} from './metricStandings';
import type {Observation} from './history';

export function historyStanding(entry:Observation){
 if(entry.cleared||entry.value===null)return null;
 const ageAtEntry=entry.referenceContext?.profileAgeAtEntry;
 const age=ageAtEntry??entry.ageAtMeasurement;
 // Anchor the age to the date when it was known, including backfilled tests.
 const savedAt=Date.parse(entry.recordedAt);
 const assessedAt=ageAtEntry!=null||!entry.measuredAt?savedAt:Math.min(savedAt,Date.parse(entry.measuredAt));
 const sex=entry.protocol?.referenceSex??entry.referenceContext?.referenceSexAtEntry;
 if(!Number.isFinite(assessedAt)||typeof age!=='number'||!Number.isInteger(age)||age<18||age>120||!['male','female','unselected'].includes(String(sex)))return null;
 const compared=resultComparison(entry.metricId,entry.value,{age,sex:sex as 'male'|'female'|'unselected'},{measuredAt:entry.measuredAt,ageAtMeasurement:entry.ageAtMeasurement,method:entry.method,protocol:entry.protocol,exerciseMode:entry.exerciseMode,derivation:entry.derivation},assessedAt);
 if(compared?.published)return {label:`TOP ${bandLabel(compared.published.band)}${compared.published.band.kind==='upper'?' or better':''}`,cohort:compared.published.cohort,reference:compared.published.reference,source:compared.published.source,version:compared.published.referenceVersion};
 if(compared?.challenge){
   const modeled=compared.challenge.modelTopPercent;
   const label=modeled===undefined?compared.challenge.top:formatGamePercent(modeled,'en-US')+'%';
   return {label:'TOP '+label,cohort:null,reference:'TOP1 game tier',source:null,version:compared.challenge.version,modelTopPercent:modeled};
 }
 return null;
}
