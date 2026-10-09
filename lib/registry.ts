import { TRACKING_ONLY_METRICS } from './model';
export const pillars = [
  { id: 'bodymarkers', name: 'BodyMarkers', short: 'BodyMarkers', weight: .38, color: '#60a5fa', description: 'Morphology & biochemistry. Context before interpretation.' },
  { id: 'strength', name: 'Strength', short: 'Strength', weight: .38, color: '#ef4444', description: 'Muscular & heart strength. Capacity in motion.' },
  { id: 'recovery', name: 'Recovery', short: 'Recovery', weight: .24, color: '#3b82f6', description: 'Sleep, autonomic tone & thermal exposure.' },
] as const;
export type PillarId = 'bodymarkers' | 'strength' | 'recovery';
export type AccessibilityTier = 'tier1_everyday' | 'tier2_standard' | 'tier3_precision';
export const accessibilityTiers = [
  {id:'tier1_everyday',name:'Everyday',label:'Tier 1 · Express / Everyday',description:'Simple observations and accessible tests.'},
  {id:'tier2_standard',name:'Standard',label:'Tier 2 · Gym & Wearable',description:'Common laboratory, gym and wearable measurements.'},
  {id:'tier3_precision',name:'Precision',label:'Tier 3 · Precision / Advanced',description:'Specialist labs, equipment and advanced protocols.'},
] as const;
export type Demographics = { age: number; sex: 'male' | 'female'; weight: number; height: number };
export type Values = Record<string, number | undefined>;
export type Metric = { id: string; name: string; pillar: PillarId; tier: AccessibilityTier; archived?:boolean; unit: string; target: string; polarity: 1 | -1; scoringType: 'linear' | 'skewed' | 'bounded'; mean: number; sd: number; min: number; max: number; optimal?: [number,number]; lms?: { L:number; M:number; S:number }; weight: number; easiestPathPriority: number; scenarioChangePerStep: number; scoringEligible: boolean; proofData: { study: string; sampleSize: string; rationale: string; instructions: string; url: string }; protocol: string };
type Row = [string,string,string,string,1|-1,Metric['scoringType'],number,number,number,number,string,string];
const data: Record<string, Row[]> = {
  biomarkers: [
    ['apob','Apolipoprotein B','mg/dL','< 48',-1,'skewed',95,25,1,300,'NHANES / ESC–EAS','Atherogenic particle density'],
    ['lpa','Lipoprotein(a)','nmol/L','< 10',-1,'skewed',35,30,.1,1000,'MESA / Copenhagen General Population Study','Inherited cardiovascular risk'],
    ['fasting_insulin','Fasting insulin','µIU/mL','< 2.2',-1,'skewed',9,5,.1,100,'NHANES III','Insulin sensitivity'],
    ['hscrp','hs-CRP','mg/L','< 0.15',-1,'skewed',1.5,1.2,.01,100,'JUPITER trial','Systemic inflammation'],
    ['hba1c','HbA1c','%','< 4.8',-1,'linear',5.4,.5,3,15,'DCCT / UKPDS','Long-term blood glucose exposure'],
    ['homocysteine','Homocysteine','µmol/L','< 5.2',-1,'linear',10,3,1,100,'Framingham Offspring Study','Vascular and methylation markers'],
    ['cystatin_c','Cystatin C','mg/L','< 0.62',-1,'linear',.9,.2,.1,10,'NHANES eGFR-CysC','Kidney filtration marker'],
    ['ggt','Gamma-glutamyl transferase','U/L','< 11',-1,'skewed',28,15,1,1000,'CARDIA','Liver enzyme and metabolic marker'],
  ],
  cardiovascular: [
    ['vo2_max','VO₂ max','mL/kg/min','≥ 66.5',1,'linear',38,9,10,100,'Cooper Institute Registry','Aerobic oxygen utilization'],
    ['zone2_power','Zone 2 power','W/kg','≥ 3.3',1,'linear',1.8,.6,.1,8,'San Millán ergometry studies','Submaximal endurance capacity'],
    ['pefr','Peak expiratory flow','% predicted','≥ 128',1,'linear',100,15,10,200,'NHANES III spirometry','Pulmonary expiratory performance'],
    ['rhr','Resting heart rate','bpm','≤ 38',-1,'linear',68,12,25,150,'Olympic ECG normative databases','Resting cardiovascular physiology'],
    ['hrv','Heart rate variability','ms','≥ 110',1,'linear',45,25,1,250,'Wearable epidemiological datasets','Autonomic variability (rMSSD)'],
    ['hrr_1min','1-minute heart rate recovery','bpm drop','≥ 45',1,'linear',23,10,0,100,'Cole et al., NEJM','Post-exercise autonomic recovery'],
    ['bp_systolic','Systolic blood pressure','mmHg','< 106',-1,'linear',122,15,70,240,'Framingham Heart Study','Resting arterial pressure'],
  ],
  body_comp: [
    ['body_fat','Body fat','%','8–10.5',-1,'bounded',23,7,3,60,'NHANES DEXA','Relative fat and lean mass'],
    ['visceral_fat','Visceral fat area','cm²','< 15',-1,'skewed',85,45,1,500,'CT / DEXA imaging cohorts','Intra-abdominal adiposity'],
  ],
  strength_mobility: [
    ['grip_strength','Grip strength','kg','≥ 68.5',1,'linear',42,10,1,120,'NIH Toolbox / NHANES','Hand dynamometer force'],
    ['cmj','Countermovement jump','cm','≥ 62',1,'linear',32,12,1,120,'NCAA combine datasets','Vertical explosive power'],
    ['broad_jump','Standing broad jump','m','≥ 2.70',1,'linear',1.8,.35,.1,4,'NFL combine datasets','Horizontal explosive power'],
    ['squat_1rm','Barbell squat','× BW','≥ 2.25',1,'linear',1.1,.45,.1,4,'NSCA / Powerlifting Australia','Lower-body maximal strength'],
    ['deadlift_1rm','Deadlift','× BW','≥ 2.55',1,'linear',1.35,.5,.1,5,'IPF raw powerlifting','Posterior-chain maximal strength'],
    ['bench_1rm','Bench press','× BW','≥ 1.65',1,'linear',.8,.3,.1,3,'NSCA pressing standards','Upper-body pressing strength'],
    ['pullup_1rm','Weighted pull-up','× BW added','≥ 1.05',1,'linear',.2,.25,0,2,'Street lifting datasets','Vertical pulling force'],
    ['farmers_carry',"Farmer’s carry (total load 1× BW)",'s','≥ 120',1,'linear',45,25,1,300,'Functional work capacity norms','Loaded grip and trunk endurance'],
    ['sit_to_stand','30-second sit-to-stand','reps','≥ 36',1,'linear',20,6,1,60,'Rikli & Jones','Functional lower-body endurance'],
    ['ankle_dorsiflexion','Ankle dorsiflexion','°','≥ 48',1,'linear',32,8,1,70,'Weight-bearing lunge test datasets','Ankle range of motion'],
  ],
  recovery_somnology: [
    ['total_sleep','Total sleep time','min','≥ 420 regularly; individual needs vary',1,'bounded',405,60,120,900,'Sleep Research Society','Restorative sleep duration'],
    ['sleep_efficiency','Sleep efficiency','%','≥ 96',1,'linear',85,6,30,100,'Polysomnography continuity norms','Time asleep relative to time in bed'],
    ['circadian_regularity','Circadian regularity','/ 100','≥ 92',1,'linear',65,15,0,100,'Wearable sleep timing indices','Consistency of sleep timing'],
    ['single_leg_balance','Eyes-closed single-leg balance','s','≥ 45',1,'linear',15,10,0,180,'Age-matched balance norms','Vestibular and proprioceptive control'],
    ['reaction_time','Simple visual reaction time','ms','≤ 175',-1,'linear',300,60,100,1000,'Human Benchmark','Simple visual response with device/input latency'],
  ],
};
const sources: Partial<Record<string,string>> = {
  vo2_max:'https://pmc.ncbi.nlm.nih.gov/articles/PMC4919021/',
  hba1c:'https://www.cdc.gov/diabetes/diabetes-testing/prediabetes-a1c-test.html',
  bp_systolic:'https://www.heart.org/en/health-topics/high-blood-pressure/low-blood-pressure-when-blood-pressure-is-too-low',
  grip_strength:'https://pmc.ncbi.nlm.nih.gov/articles/PMC7197498/',
  lpa:'https://www.heart.org/en/health-topics/cholesterol/genetic-conditions/lipoprotein-a',
  total_sleep:'https://pmc.ncbi.nlm.nih.gov/articles/PMC4434546/',
  hrr_1min:'https://doi.org/10.1056/NEJM199910283411804',
};
const originalMetrics = Object.entries(data).flatMap(([pillar,rows]) => rows.map(r => ({
  id:r[0],name:r[1],pillar,unit:r[2],target:r[3],polarity:r[4],scoringType:r[5],mean:r[6],sd:r[7],min:r[8],max:r[9],weight:1/rows.length,
  optimal:r[0]==='total_sleep'?[420,540] as [number,number]:undefined,
  easiestPathPriority:['total_sleep','circadian_regularity','fasting_insulin','ankle_dorsiflexion'].includes(r[0])?1:3,
  scoringEligible:!TRACKING_ONLY_METRICS.has(r[0]),
  scenarioChangePerStep:TRACKING_ONLY_METRICS.has(r[0])?0:r[0]==='circadian_regularity'?.045:r[0]==='total_sleep'?.04:.025,
  proofData:{study:r[0]==='vo2_max'?'FRIEND 2015 direct treadmill CPET':sources[r[0]]?r[10]:`Unverified reference label: ${r[10]}`,sampleSize:r[0]==='vo2_max'?'7,783 treadmill tests: 4,611 men and 3,172 women, age 20–79, without cardiovascular disease; FRIEND 2015 Table 4.':'No study-derived quantitative reference distribution is loaded for this metric.',rationale:r[11],instructions:pillar==='biomarkers'?'Use a laboratory result in the stated units. Follow the laboratory’s preparation instructions; discuss interpretation with your clinician.':pillar==='strength_mobility'?'Use consistent equipment and technique. Warm up; use a qualified spotter for loaded tests. Enter body-weight ratios where shown.':pillar==='body_comp'?'Use a DEXA or validated imaging report. Skinfold estimates are an alternative method, not interchangeable with DEXA.':pillar==='recovery_somnology'?'Use a representative 7-day average and consistent device. For balance, test beside a stable support.':'Measure under a consistent protocol. Use a rested morning average for resting measures and supervised testing for maximal exercise.',url:sources[r[0]]||''},
  protocol:r[0]==='lpa'?'Discuss inherited risk with your clinician. Lifestyle changes generally do not lower Lp(a).':pillar==='biomarkers'?'Confirm the measurement and review it with a clinician before choosing an intervention.':pillar==='cardiovascular'?'Build a consistent aerobic base, then reassess with the same test protocol.':pillar==='strength_mobility'?'Practice progressive strength and mobility work with consistent technique.':pillar==='recovery_somnology'?'Keep a consistent sleep opportunity and track a 7-day average.':'Track comparable measurements over time; assess targets individually.',
})));

const assignments: Record<PillarId, readonly (readonly string[])[]> = {
  bodymarkers: [ ['body_fat','waist_height_ratio'], ['fasting_glucose','hba1c','ggt'], ['apob','fasting_insulin','hscrp','lpa','homocysteine','cystatin_c','visceral_fat'] ],
  strength: [ ['rhr','sit_to_stand','pushups'], ['bench_1rm','grip_strength','vo2_max','hrr_1min'], ['squat_1rm','deadlift_1rm','pullup_1rm','cmj','broad_jump','zone2_power','pefr','farmers_carry'] ],
  recovery: [ ['total_sleep','sleep_efficiency','sauna_minutes','cold_plunge_minutes'], ['hrv','circadian_regularity','single_leg_balance'], ['thermal_hrv_rebound','reaction_time'] ],
};
const additions: Row[] = [
 ['waist_height_ratio','Waist-to-height ratio','ratio','Context required',-1,'linear',.5,.08,.2,1.5,'No calibrated cohort loaded','Waist circumference divided by height in the same units'],
 ['fasting_glucose','Fasting glucose','mg/dL','Context required',-1,'linear',95,15,20,600,'Laboratory glucose','Fasting plasma glucose; clinical interpretation requires individual context'],
 ['pushups','Strict push-up repetitions','reps','Illustrative anchor ≥ 40',1,'linear',20,10,0,150,'No calibrated cohort loaded','Upper-body muscular endurance under a standardized strict technique'],
 ['sauna_minutes','Weekly sauna duration','min/week','Tracking only',1,'bounded',75,30,0,600,'Finnish KIHD sauna cohort','Heat exposure duration; exposure time alone does not establish benefit or safety'],
 ['cold_plunge_minutes','Weekly cold plunge duration','min/week','Tracking only',1,'bounded',13,5,0,120,'Winter-swimming thermogenesis study','Cold exposure duration; temperature, acclimatization and session pattern matter'],
 ['thermal_hrv_rebound','Post-thermal HRV rebound ratio','ratio','Tracking only',1,'linear',1,.2,.01,10,'No validated rebound reference','Post-exposure RMSSD divided by matched pre-exposure RMSSD'],
];
const added: Omit<Metric,'pillar'|'tier'|'weight'>[] = additions.map(r=>({id:r[0],name:r[1],unit:r[2],target:r[3],polarity:r[4],scoringType:r[5],mean:r[6],sd:r[7],min:r[8],max:r[9],easiestPathPriority:r[0]==='pushups'?1:3,scoringEligible:!TRACKING_ONLY_METRICS.has(r[0]),scenarioChangePerStep:r[0]==='pushups'?.025:0,proofData:{study:r[10],sampleSize:'No study-derived quantitative reference distribution is loaded.',rationale:r[11],instructions:'Record the observation in the stated units using the same protocol.',url:''},protocol:r[0]==='pushups'?'Use consistent strict technique and stop when form cannot be maintained.':'Log comparable observations; do not increase exposure to chase a score.'}));
const specialProof: Record<string, Partial<Metric['proofData']>> = {
 sauna_minutes:{study:'Finnish KIHD observational cohort (2015)',sampleSize:'2,315 Finnish men, ages 42–60. Observational associations; not a validated weekly optimal window.',url:'https://pubmed.ncbi.nlm.nih.gov/25705824/',instructions:'Sum actual sauna exposure over the same seven-day window. Record temperature and session pattern separately in your own notes. The requested 60–90 min/week band is an unvalidated product assumption, not a prescribed dose.'},
 cold_plunge_minutes:{study:'Winter-swimming thermogenesis study (2021)',url:'https://pubmed.ncbi.nlm.nih.gov/34755128/',sampleSize:'Small study in experienced male winter swimmers; no validated universal 11–15 min/week optimum.',instructions:'Sum actual immersion duration over seven days. Temperature, acclimatization and session pattern affect exposure. Do not convert a weekly total into a required dose; avoid solo immersion.'},
 thermal_hrv_rebound:{instructions:'Divide post-exposure RMSSD by pre-exposure RMSSD measured with the same device, posture, recording length and timing. Do not mix SDNN and RMSSD. No validated recovery or optimal ratio is established.'},
 waist_height_ratio:{instructions:'Measure waist and height in the same units, then divide waist by height. Keep anatomical site and technique consistent. This is tracking-only.'},
 fasting_glucose:{instructions:'Enter a fasting laboratory plasma glucose result in mg/dL. Do not enter mmol/L; multiply mmol/L by 18.0182 first. Follow laboratory fasting instructions and review results clinically.'},
 pushups:{instructions:'Count consecutive strict repetitions with a straight trunk, consistent depth and full elbow extension. Stop at form failure. Knee, incline and strict variants are not interchangeable.'},
 reaction_time:{instructions:'Use a consistent choice-reaction test with multiple stimulus-response alternatives. Log milliseconds and the protocol/device. Legacy simple-reaction measurements are not choice-reaction results; leave the method unknown unless retested.'},
};
export const metrics: Metric[] = [...originalMetrics,...added].map(m=>{
 const assignment=Object.entries(assignments).flatMap(([pillar,tiers])=>tiers.flatMap((ids,i)=>ids.includes(m.id)?[{pillar:pillar as PillarId,tier:accessibilityTiers[i].id}]:[]))[0];
 const archived=!assignment;
 const pillar=assignment?.pillar ?? (m.id==='bp_systolic'?'bodymarkers':'strength');
 const count=assignments[pillar].flat().length;
 return {...m,pillar,tier:assignment?.tier??'tier2_standard',archived,weight:archived?0:1/count,scoringEligible:!archived&&m.scoringEligible,
   name:m.id==='reaction_time'?'Choice reaction time':m.name,
   optimal:m.id==='sauna_minutes'?[60,90]:m.id==='cold_plunge_minutes'?[11,15]:m.optimal,
   proofData:{...m.proofData,...specialProof[m.id]},
 } as Metric;
});
export const activeMetrics=metrics.filter(m=>!m.archived);
export type MetricDefinition = Metric;
export const demoValues: Values = { vo2_max:52,zone2_power:2.5,rhr:49,hrv:72,hrr_1min:36,bp_systolic:112,apob:72,fasting_insulin:5.2,hba1c:5.1,hscrp:.7,body_fat:14,grip_strength:53,cmj:44,squat_1rm:1.6,deadlift_1rm:1.9,bench_1rm:1.15,ankle_dorsiflexion:30,total_sleep:420,sleep_efficiency:91,circadian_regularity:76,reaction_time:400,pushups:28,waist_height_ratio:.47,sauna_minutes:60,cold_plunge_minutes:5 };
