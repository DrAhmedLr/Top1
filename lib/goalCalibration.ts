/** The base probability is conditional on completing the remaining schedule.
 * Fit its bias on earlier, fully adherent attempts and check the proposed
 * adjustment on later people whose forecasts were issued after those outcomes. */
export interface CalibrationPartition {
  participants:number;
  reached:number;
  expected:number;
  brierBase:number;
}

export interface CalibrationEvidence {
  training:CalibrationPartition | null;
  validation:CalibrationPartition | null;
}

function eligible(sample:CalibrationPartition | null):sample is CalibrationPartition {
  return !!sample && Number.isSafeInteger(sample.participants) && sample.participants >= 20 &&
    Number.isSafeInteger(sample.reached) && sample.reached >= 0 && sample.reached <= sample.participants &&
    Number.isFinite(sample.expected) && sample.expected >= 0 && sample.expected <= sample.participants &&
    Number.isFinite(sample.brierBase) && sample.brierBase >= 0 && sample.brierBase <= 1;
}

export function calibratedGoalProbability(base:number, evidence:CalibrationEvidence | null) {
  if (!Number.isFinite(base) || base < 0 || base > 1 || !evidence) return null;
  const {training,validation} = evidence;
  if (!eligible(training) || !eligible(validation)) return null;

  // Twenty neutral observations shrink small cohorts toward the original
  // estimate. A single fitted update can move it by at most 15 points.
  const correction = Math.max(-0.15, Math.min(0.15, (training.reached-training.expected) / (training.participants+20)));
  // For each held-out outcome y, (p+d-y)^2 - (p-y)^2 = 2d(p-y)+d².
  // Clipping to [0,1] afterwards only reduces the adjusted squared error.
  const brierChange = 2*correction*(validation.expected-validation.reached)/validation.participants + correction**2;
  if (validation.brierBase <= 0 || brierChange > -0.002) return null;
  const probability = Math.max(0,Math.min(1,base+correction));
  if (Math.abs(probability-base) < 0.005) return null;
  return {probability,baseProbability:base,participants:training.participants+validation.participants};
}
