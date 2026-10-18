import {activeMetrics,type Values,type Demographics} from './registry';
import {benchmarkGame} from './benchmarkGame';
import type {GameRoute} from './gameScenarios';
/** Baseline actions only: never invent an unrecorded value or projected gain. */
const planMetrics:Record<GameRoute,readonly string[]>={
 easier:['total_sleep','rhr','waist_height_ratio','single_leg_balance','sit_to_stand'],
 balanced:['pushups','broad_jump','grip_strength','vo2_max','body_fat'],
 ambitious:['bench_1rm','squat_1rm','deadlift_1rm','pullup_1rm','cmj','sprint_10m'],
};
export function missingPlanMetrics(values:Values,demographics:Demographics,route:GameRoute){
 const recorded=new Set(benchmarkGame(values,demographics).rows.map(m=>m.id));
 return planMetrics[route].flatMap(id=>{const m=activeMetrics.find(m=>m.id===id);return m&&!recorded.has(id)?[m]:[];}).slice(0,3);
}
