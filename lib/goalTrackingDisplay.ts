import type {AdaptivePlan} from './adaptiveProgram';
import type {GoalCalibration} from './goalTrackingTypes';

/** The plan and conditional estimate may arrive from separate account reads. */
export function savedGoalCalibration(calibration:GoalCalibration|null|undefined,plan:AdaptivePlan|null|undefined,base:number|undefined){
 if(!calibration||!plan||plan.config.guidedVersion!==1||base===undefined)return undefined;
 if(calibration.planId!==plan.event.id||calibration.revision!==plan.event.revision)return undefined;
 if(!Number.isFinite(base)||!Number.isFinite(calibration.baseProbability)||Math.abs(calibration.baseProbability-base)>1e-6)return undefined;
 if(!Number.isFinite(calibration.probability)||calibration.probability<0||calibration.probability>1||!Number.isSafeInteger(calibration.participants)||calibration.participants<=0)return undefined;
 return calibration;
}
