import {valid} from './engine';
import {metrics,type Values} from './registry';
import type {MeasurementMetadata} from './measurementMetadata';
import {protocolComplete} from './protocols';
export const BENCHMARK_BATTERY={
 id:'top1-physical-capacity-v1',label:'Physical capacity · research battery',
 tests:[
  {metricId:'vo2_max',domain:'Endurance',protocolId:'cpet_treadmill_v1'},
  {metricId:'grip_combined',domain:'Grip strength',protocolId:'nhanes_grip_combined_v1'},
  {metricId:'cmj',domain:'Lower-body power',protocolId:'cmj_hands_hips_v1'},
  {metricId:'pushups',domain:'Upper-body endurance',protocolId:'strict_pushups_v1'},
  {metricId:'sprint_10m',domain:'Acceleration',protocolId:'sprint10m_gates_v1'},
 ],
} as const;
export function benchmarkReadiness(values:Values,details:MeasurementMetadata,now=Date.now()){
 const tests=BENCHMARK_BATTERY.tests.map(t=>{
  const m=metrics.find(m=>m.id===t.metricId)!,d=details[t.metricId];
  const value=valid(m,values[t.metricId]),dated=!!d?.measuredAt&&Date.parse(d.measuredAt)<=now+300000;
  const protocol=d?.protocol?.id===t.protocolId&&protocolComplete(t.metricId,d.protocol);
  const direct=t.metricId!=='vo2_max'||d?.method==='direct_cpet'&&d.exerciseMode==='treadmill';
  const complete=value&&dated&&protocol&&direct&&!d?.invalidContext;
  return {...t,name:m.name,complete,reason:!value?'Not recorded':!dated?'Dated test needed':!direct?'Direct treadmill CPET needed':!protocol?'Matching protocol details needed':'Protocol recorded · self-reported'};
 });
 return {batteryId:BENCHMARK_BATTERY.id,tests,complete:tests.every(t=>t.complete),completed:tests.filter(t=>t.complete).length,total:tests.length,
 calibrated:false as const,rank:null,message:'No approved representative reference population is connected. Recording these tests does not yet establish a top-1% rank.'};
}
