import {COMPETITIVE_CHALLENGE_METRICS} from './competitiveMetrics';

/** A quick entry can carry its test-day profile before the test setup is documented. */
export const PROFILE_ONLY_PROTOCOL='test_profile_only_v1';

export const protocolOptions:Record<string,readonly {id:string;label:string}[]>={
 vo2_max:[{id:'cpet_treadmill_v1',label:'Direct treadmill CPET'},{id:'cooper_track_12min_v1',label:'12-minute Cooper run · measured track'},{id:'wearable_vo2_estimate_v1',label:'Wearable estimate · same device/algorithm'}],
 grip_strength:[{id:'grip_single_v1',label:'Single hand · same dynamometer and position'},{id:'igrips_hydraulic_max_v1',label:'International grip · seated hydraulic, best of both hands'}],
 grip_combined:[{id:'nhanes_grip_combined_v1',label:'NHANES · best of 3 per hand, summed'},{id:'chms_smedley_combined_v1',label:'Canadian grip · standing Smedley III, best of 2 per hand, summed'}],
 cmj:[{id:'cmj_hands_hips_v1',label:'Countermovement · hands on hips'},{id:'chms_leonardo_cmj_v1',label:'Canadian jump · Leonardo force plate, arm swing, best of 3'}],
 broad_jump:[{id:'standing_broad_jump_v1',label:'Standing broad jump · same technique'}],
 pushups:[{id:'strict_pushups_v1',label:'Consecutive strict repetitions to form failure'}],
 sit_to_stand:[{id:'chair_stand_30s_v1',label:'30 seconds · arms crossed, same chair'}],
 pullups:[{id:'strict_pullups_v1',label:'Strict overhand pull-ups · full range, no kipping'}],
 bench_1rm:[{id:'bench_paused_v1',label:'Barbell bench · paused'},{id:'bench_touch_go_v1',label:'Barbell bench · touch and go'}],
 squat_1rm:[{id:'squat_parallel_v1',label:'Barbell squat · hip crease at or below knee'}],
 pullup_1rm:[{id:'weighted_pullup_strict_v1',label:'Weighted overhand pull-up · full range'}],
 run_5k:[{id:'run5k_outdoor_gps_v1',label:'Measured outdoor 5 km · device timed'},{id:'run5k_outdoor_manual_v1',label:'Measured outdoor 5 km · hand timed'},{id:'run5k_treadmill_v1',label:'Treadmill 5 km'}],
 dead_hang:[{id:'bar_dead_hang_v1',label:'Fixed bar · straight arms, closed overhand grip'}],
 sprint_400m:[{id:'sprint400m_standing_manual_v1',label:'400 metres · standing start, hand timed'},{id:'sprint400m_standing_auto_v1',label:'400 metres · standing start, automatic timing'}],
 sprint_10m:[{id:'sprint10m_gates_v1',label:'10 metres · electronic timing gates'}],
 single_leg_balance:[{id:'balance_eyes_closed_v1',label:'Eyes closed · same leg and stop rule'}],
 hrv:[{id:'hrv_rmssd_supine_v1',label:'RMSSD · rested supine recording'}],
 hrr_1min:[{id:'hrr_passive_seated_v1',label:'60 seconds · passive seated recovery'},{id:'hrr_active_walk_v1',label:'60 seconds · active walking recovery'}],
 reaction_time:[{id:'choice_reaction_v1',label:'Choice reaction · same task/device'},{id:'simple_reaction_v1',label:'Simple reaction · same task/device'}],
 total_sleep:[{id:'sleep_diary_7d_v1',label:'Seven-day sleep diary average'},{id:'sleep_device_7d_v1',label:'Seven-day device average'}],
 sleep_efficiency:[{id:'sleep_efficiency_7d_v1',label:'Seven-day sleep efficiency average'}],
 circadian_regularity:[{id:'regularity_7d_v1',label:'Seven-day regularity · same algorithm/device'}],
};
export interface MeasurementProtocol{id:string;equipment?:string;hand?:'left'|'right'|'both';trials?:number;chairHeightCm?:number;hrvStatistic?:'rmssd'|'sdnn';peakRer?:number;referencePopulation?:'matches'|'outside';bodyWeightKg?:number;referenceSex?:'male'|'female'|'unselected'}
export interface ObservationWindow{start:string;end:string;statistic:'mean'|'median'|'total';sampleCount:number}
export function normalizeProtocol(metricId:string,raw:unknown):MeasurementProtocol{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid measurement protocol.');
 const p=raw as MeasurementProtocol;
 const profileOnly=p.id===PROFILE_ONLY_PROTOCOL&&COMPETITIVE_CHALLENGE_METRICS.has(metricId);
 if(!profileOnly&&!protocolOptions[metricId]?.some(o=>o.id===p.id))throw new Error('Choose a protocol compatible with this measurement.');
 if(profileOnly&&Object.entries(p).some(([key,value])=>value!==undefined&&!['id','referenceSex','bodyWeightKg'].includes(key)))throw new Error('Choose a test protocol before recording its setup.');
 const out:MeasurementProtocol={id:p.id};
 if(p.equipment!==undefined){if(typeof p.equipment!=='string'||!p.equipment.trim()||!/^[a-zA-Z0-9 _.-]{1,60}$/.test(p.equipment))throw new Error('Use an equipment label of up to 60 characters.');out.equipment=p.equipment.trim();}
 if(p.hand!==undefined){if(!['grip_strength','grip_combined','single_leg_balance'].includes(metricId)||!['left','right','both'].includes(p.hand))throw new Error('Invalid hand or leg context.');out.hand=p.hand;}
 if(p.trials!==undefined){if(!Number.isInteger(p.trials)||p.trials<1||p.trials>10)throw new Error('Record 1–10 trials.');out.trials=p.trials;}
 if(p.chairHeightCm!==undefined){if(metricId!=='sit_to_stand'||!Number.isFinite(p.chairHeightCm)||p.chairHeightCm<25||p.chairHeightCm>70)throw new Error('Record the chair height in centimetres (25–70).');out.chairHeightCm=p.chairHeightCm;}
 if(p.bodyWeightKg!==undefined){if(!COMPETITIVE_CHALLENGE_METRICS.has(metricId)||!Number.isFinite(p.bodyWeightKg)||p.bodyWeightKg<25||p.bodyWeightKg>350)throw new Error('Record body weight at the test (25–350 kg).');out.bodyWeightKg=p.bodyWeightKg;}
 if(p.referenceSex!==undefined){
  if(!COMPETITIVE_CHALLENGE_METRICS.has(metricId)||!['male','female','unselected'].includes(p.referenceSex))throw new Error('Invalid reference sex for this test.');
  out.referenceSex=p.referenceSex;
 }
 if(p.hrvStatistic!==undefined){if(metricId!=='hrv'||!['rmssd','sdnn'].includes(p.hrvStatistic))throw new Error('Invalid HRV statistic.');out.hrvStatistic=p.hrvStatistic;}
 if(p.peakRer!==undefined){if(p.id!=='cpet_treadmill_v1'||typeof p.peakRer!=='number'||!Number.isFinite(p.peakRer)||p.peakRer<=0||p.peakRer>3)throw new Error('Enter the peak RER from a direct treadmill CPET report (greater than 0, up to 3).');out.peakRer=p.peakRer;}
 if(p.referencePopulation!==undefined){if(p.id!=='cpet_treadmill_v1'||!['matches','outside'].includes(p.referencePopulation))throw new Error('Review the CPET reference population.');out.referencePopulation=p.referencePopulation;}
 if(p.id==='nhanes_grip_combined_v1'&&(p.hand!==undefined&&p.hand!=='both'||p.trials!==undefined&&p.trials!==3))throw new Error('NHANES requires both hands and three trials per hand.');
 if(p.id==='grip_single_v1'&&p.hand==='both')throw new Error('Choose the hand measured for single-hand grip.');
 if(p.id==='hrv_rmssd_supine_v1'&&p.hrvStatistic!==undefined&&p.hrvStatistic!=='rmssd')throw new Error('This protocol requires RMSSD, not SDNN.');
 return out;
}
export function protocolComplete(metricId:string,p?:MeasurementProtocol){
 if(!p||p.id===PROFILE_ONLY_PROTOCOL)return false;
 try{normalizeProtocol(metricId,p);}catch{return false;}
 if(['grip_strength','grip_combined'].includes(metricId))return !!p.equipment&&!!p.hand&&p.trials!==undefined&&(metricId!=='grip_combined'||p.hand==='both'&&p.trials===(p.id==='chms_smedley_combined_v1'?2:3));
 if(metricId==='sit_to_stand')return p.chairHeightCm!==undefined;
 if(['cmj','sprint_10m','reaction_time','hrv','total_sleep','sleep_efficiency','circadian_regularity'].includes(metricId))return !!p.equipment&&(metricId!=='hrv'||p.hrvStatistic==='rmssd');
 if(metricId==='vo2_max')return p.id==='cpet_treadmill_v1'?p.peakRer!==undefined&&p.peakRer>=1&&p.referencePopulation==='matches':!!p.equipment;
 if(metricId==='single_leg_balance')return !!p.hand&&p.hand!=='both';
 return true;
}
export function protocolKey(p?:MeasurementProtocol){return p&&p.id!==PROFILE_ONLY_PROTOCOL?JSON.stringify([p.id,p.equipment??null,p.hand??null,p.trials??null,p.chairHeightCm??null,p.hrvStatistic??null,p.peakRer??null,p.referencePopulation??null]):null;}
