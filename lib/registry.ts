import { TRACKING_ONLY_METRICS } from './model';
export const pillars = [
  { id: 'cardiovascular', name: 'Cardiovascular', short: 'Cardio', weight: .25, color: '#ef7648', description: 'Your engine. Endurance, circulation & capacity.' },
  { id: 'biomarkers', name: 'Biomarkers', short: 'Biomarkers', weight: .25, color: '#a68aca', description: 'The signals beneath the surface.' },
  { id: 'strength_mobility', name: 'Strength & mobility', short: 'Strength', weight: .20, color: '#d4ab56', description: 'Force, power & freedom of movement.' },
  { id: 'recovery_somnology', name: 'Recovery & sleep', short: 'Recovery', weight: .15, color: '#73a390', description: 'Recover well. Perform consistently.' },
  { id: 'body_comp', name: 'Body composition', short: 'Body comp', weight: .15, color: '#78a8c4', description: 'The architecture of your performance.' },
] as const;
export type PillarId = typeof pillars[number]['id'];
export type Demographics = { age: number; sex: 'male' | 'female'; weight: number; height: number };
export type Values = Record<string, number | undefined>;
export type Metric = { id: string; name: string; pillar: PillarId; unit: string; target: string; polarity: 1 | -1; scoringType: 'linear' | 'skewed' | 'bounded'; mean: number; sd: number; min: number; max: number; optimal?: [number,number]; lms?: { L:number; M:number; S:number }; weight: number; easiestPathPriority: number; scenarioChangePerStep: number; scoringEligible: boolean; proofData: { study: string; sampleSize: string; rationale: string; instructions: string; url: string }; protocol: string };
type Row = [string,string,string,string,1|-1,Metric['scoringType'],number,number,number,number,string,string];
const data: Record<PillarId, Row[]> = {
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
export const metrics: Metric[] = Object.entries(data).flatMap(([pillar,rows]) => rows.map(r => ({
  id:r[0],name:r[1],pillar:pillar as PillarId,unit:r[2],target:r[3],polarity:r[4],scoringType:r[5],mean:r[6],sd:r[7],min:r[8],max:r[9],weight:1/rows.length,
  optimal:r[0]==='total_sleep'?[420,540] as [number,number]:undefined,
  easiestPathPriority:['total_sleep','circadian_regularity','fasting_insulin','ankle_dorsiflexion'].includes(r[0])?1:3,
  scoringEligible:!TRACKING_ONLY_METRICS.has(r[0]),
  scenarioChangePerStep:TRACKING_ONLY_METRICS.has(r[0])?0:r[0]==='circadian_regularity'?.045:r[0]==='total_sleep'?.04:.025,
  proofData:{study:r[0]==='vo2_max'?'FRIEND 2015 direct treadmill CPET':sources[r[0]]?r[10]:`Unverified reference label: ${r[10]}`,sampleSize:r[0]==='vo2_max'?'7,783 treadmill tests: 4,611 men and 3,172 women, age 20–79, without cardiovascular disease; FRIEND 2015 Table 4.':'No study-derived quantitative reference distribution is loaded for this metric.',rationale:r[11],instructions:pillar==='biomarkers'?'Use a laboratory result in the stated units. Follow the laboratory’s preparation instructions; discuss interpretation with your clinician.':pillar==='strength_mobility'?'Use consistent equipment and technique. Warm up; use a qualified spotter for loaded tests. Enter body-weight ratios where shown.':pillar==='body_comp'?'Use a DEXA or validated imaging report. Skinfold estimates are an alternative method, not interchangeable with DEXA.':pillar==='recovery_somnology'?'Use a representative 7-day average and consistent device. For balance, test beside a stable support.':'Measure under a consistent protocol. Use a rested morning average for resting measures and supervised testing for maximal exercise.',url:sources[r[0]]||''},
  protocol:r[0]==='lpa'?'Discuss inherited risk with your clinician. Lifestyle changes generally do not lower Lp(a).':pillar==='biomarkers'?'Confirm the measurement and review it with a clinician before choosing an intervention.':pillar==='cardiovascular'?'Build a consistent aerobic base, then reassess with the same test protocol.':pillar==='strength_mobility'?'Practice progressive strength and mobility work with consistent technique.':pillar==='recovery_somnology'?'Keep a consistent sleep opportunity and track a 7-day average.':'Track comparable measurements over time; assess targets individually.',
})));
export const demoValues: Values = { vo2_max:52,zone2_power:2.5,rhr:49,hrv:72,hrr_1min:36,bp_systolic:112,apob:72,fasting_insulin:5.2,hba1c:5.1,hscrp:.7,body_fat:14,grip_strength:53,cmj:44,squat_1rm:1.6,deadlift_1rm:1.9,bench_1rm:1.15,ankle_dorsiflexion:30,total_sleep:420,sleep_efficiency:91,circadian_regularity:76,reaction_time:230 };
