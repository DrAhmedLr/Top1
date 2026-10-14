import {comparableDelta, observationDate, type Observation} from './history';
import {protocolKey} from './protocols';
import type {MeasurementDetails} from './measurementMetadata';

/** Each series is a sequence of documented comparable observations. Unknown
 * context remains visible as isolated points, never an implied trend. */
export function observationSeries(entries:Observation[]){
 const sorted=entries.slice().sort((a,b)=>Date.parse(observationDate(a))-Date.parse(observationDate(b)));
 let segment=0,previous:Observation|undefined;
 return sorted.map(entry=>{
  const comparable=previous&&!entry.cleared&&!!comparableDelta([previous,entry]);
  if(!comparable)segment++;
  const result={entry,series:`series${segment}`,comparable:!!comparable};
  previous=entry.cleared?undefined:entry;
  return result;
 });
}

/** A repeat is a new observation. Task-specific inputs must be entered again. */
export function repeatDetails(details:MeasurementDetails,measuredAt:string):MeasurementDetails{
 return {...details,measuredAt,window:undefined,derivation:undefined,ageAtMeasurement:undefined,invalidContext:undefined};
}

export function assessmentContext(details:MeasurementDetails[],now=Date.now()){
 const dates=details.flatMap(d=>d.measuredAt?[d.measuredAt]:[]).sort();
 const unknownDates=details.length-dates.length;
 const unknownMethods=details.filter(d=>!d.method).length;
 const unknownProtocols=details.filter(d=>!protocolKey(d.protocol)).length;
 return {unknownDates,unknownMethods,unknownProtocols,first:dates[0],last:dates.at(-1),oldestDays:dates[0]?Math.floor((now-Date.parse(dates[0]))/86400000):undefined};
}
