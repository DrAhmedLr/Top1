import type {AthleteDossier} from './athleteDossier';
import {
  expandCoarseEquipment,
  findBiomechanicalSubstitutes,
  MUSCLE_META,
  parseDiscomfortJoints,
  queryExercises,
  type DetailedEquipmentId,
  type ExerciseDefinition,
  type MuscleId,
} from './exerciseOntology';
import {
  buildBodyPhysiologyReport,
  type BodyPhysiologyReport,
} from './musclePhysiology';
import type {DiscomfortReport} from './personalWorkspace';
import type {TrainingEvent} from './training';
import type {WearableDailySnapshot} from './wearableReadiness';

export const WORKOUT_GENERATOR_VERSION = 'adaptive-workout-gen-v1';

export type GeneratorMode = 'smart_next' | 'target_muscles' | 'preset';
export type GeneratorPreset =
  | 'at_home'
  | 'gym'
  | 'cardio'
  | 'travel'
  | 'bodyweight'
  | 'dumbbells_only';

export type WorkoutGenerationRequest = {
  mode: GeneratorMode;
  preset?: GeneratorPreset;
  targetMuscles?: MuscleId[];
  /** Strict session time cap in minutes (10..120). */
  availableMinutes: number;
  /** Optional explicit granular equipment override; falls back to dossier equipment + preset mapping. */
  equipmentOverride?: DetailedEquipmentId[];
  discomfort?: DiscomfortReport;
  upcomingGoalMetricsWithin36h?: string[];
  asOf?: Date;
};

export type GeneratedExerciseBlock = {
  exerciseId: string;
  name: string;
  pattern: ExerciseDefinition['pattern'];
  sets: number;
  mode: 'reps' | 'seconds';
  targetAmount: number;
  restSeconds: number;
  effortCue: string;
  /** Grounded ONLY in real measured history; null when unmeasured (never invented from percentiles). */
  suggestedLoadKg: number | null;
  estimatedMinutes: number;
  musclesTargeted: Array<{muscle: MuscleId; role: string; effectiveSetsAdded: number}>;
  whyChosen: string;
  substitutes: Array<{exerciseId: string; name: string; similarityScore: number; reason: string}>;
};

export type GeneratedWorkoutPlan = {
  version: typeof WORKOUT_GENERATOR_VERSION;
  status: 'generated' | 'rest_recommended';
  title: string;
  mode: GeneratorMode;
  preset?: GeneratorPreset;
  availableMinutes: number;
  timeBreakdown: {
    warmupMinutes: number;
    workAndRestMinutes: number;
    transitionMinutes: number;
    cooldownMinutes: number;
    totalMinutes: number;
  };
  totalSets: number;
  equipmentUsed: DetailedEquipmentId[];
  targetMuscles: MuscleId[];
  exercises: GeneratedExerciseBlock[];
  warnings: string[];
  scientificRationale: string[];
  safetyGuidance: string | null;
};

const PRESET_EQUIPMENT: Record<GeneratorPreset, DetailedEquipmentId[]> = {
  at_home: ['none', 'small_weights', 'resistance_bands', 'calisthenics_bars'],
  gym: [
    'none',
    'small_weights',
    'bars_plates',
    'benches_racks',
    'calisthenics_bars',
    'cable_machines',
    'weighted_machines',
    'plated_machines',
    'cardio_machines',
  ],
  cardio: ['none', 'outdoor_track', 'cardio_machines'],
  travel: ['none', 'resistance_bands', 'outdoor_track'],
  bodyweight: ['none'],
  dumbbells_only: ['none', 'small_weights'],
};

function computeExerciseMinutes(ex: ExerciseDefinition, sets: number): {
  workAndRestMin: number;
  transitionMin: number;
  totalMin: number;
} {
  const tp = ex.timePhysics;
  const workPerSetSec =
    tp.mode === 'seconds' ? tp.defaultRepsOrSeconds : tp.defaultRepsOrSeconds * tp.secondsPerRep;
  const totalSec = sets * workPerSetSec + Math.max(0, sets - 1) * tp.defaultRestSeconds;
  const workAndRestMin = totalSec / 60;
  const transitionMin = tp.setupTransitionMinutes;
  return {
    workAndRestMin: Number(workAndRestMin.toFixed(1)),
    transitionMin,
    totalMin: Number((workAndRestMin + transitionMin).toFixed(1)),
  };
}

function groundedLoadKgFor(ex: ExerciseDefinition, dossier: AthleteDossier): number | null {
  if (!ex.linkedMetric) return null;
  if (
    ex.linkedMetric !== 'bench_1rm' &&
    ex.linkedMetric !== 'squat_1rm' &&
    ex.linkedMetric !== 'deadlift_1rm'
  ) {
    return null;
  }
  const snap = dossier.measuredResults[ex.linkedMetric];
  const bw = dossier.identity.profile.weightKg?.value ?? null;
  if (!snap || !Number.isFinite(snap.rawValue)) return null;
  const est1rm =
    snap.goalUnit === 'kg'
      ? snap.value
      : bw
        ? snap.rawValue * bw
        : null;
  if (est1rm === null || !Number.isFinite(est1rm) || est1rm < 15) return null;
  // Working load at ~75% of measured/estimated 1RM, rounded cleanly to 2.5 kg increments
  const working = Math.round((est1rm * 0.75) / 2.5) * 2.5;
  return Math.max(20, working);
}

/**
 * Generates an adaptive, recovery-aware, goal-protecting, time-bounded workout.
 * Upgrades naive static workout generators by enforcing:
 * 1) Clinical/concerning discomfort rest routing
 * 2) Joint-sparing filtering on mild discomfort
 * 3) Local muscle recovery (>= 65%) and weekly MEV/MAV/MRV caps
 * 4) Protection of upcoming pinned TOP1 goal prime movers
 * 5) Antagonist structural balance remediation
 * 6) Strict mathematical time-budget accounting (warmup + transitions + work + rest + cooldown <= budget)
 */
export function generateAdaptiveWorkout(input: {
  dossier: AthleteDossier;
  trainingEvents: readonly TrainingEvent[];
  request: WorkoutGenerationRequest;
  physiology?: BodyPhysiologyReport;
  wearableHistory?: readonly WearableDailySnapshot[];
  customExercises?: readonly ExerciseDefinition[];
}): GeneratedWorkoutPlan {
  const {dossier, trainingEvents, request, customExercises} = input;
  const availableMinutes = Math.max(10, Math.min(120, Math.round(request.availableMinutes)));
  const physiology =
    input.physiology ??
    buildBodyPhysiologyReport({
      dossier,
      trainingEvents,
      asOf: request.asOf,
      upcomingGoalMetricsWithin36h: request.upcomingGoalMetricsWithin36h,
      wearableHistory: input.wearableHistory,
      customExercises,
    });

  // Resolve equipment profile from override -> preset -> dossier
  const dossierEquip = expandCoarseEquipment(dossier.constraints.equipment.value);
  const equipmentUsed: DetailedEquipmentId[] = request.equipmentOverride
    ? [...new Set<DetailedEquipmentId>(['none', ...request.equipmentOverride])]
    : request.preset
      ? PRESET_EQUIPMENT[request.preset]
      : dossierEquip;

  // Hard smartwatch illness/overreaching guardrail
  if (physiology.wearableReadiness.illnessOrOverreachingFlag && request.discomfort?.severity !== 'concerning') {
    return {
      version: WORKOUT_GENERATOR_VERSION,
      status: 'rest_recommended',
      title: 'Biometric Recovery Day Recommended',
      mode: request.mode,
      preset: request.preset,
      availableMinutes,
      timeBreakdown: {
        warmupMinutes: 0,
        workAndRestMinutes: 0,
        transitionMinutes: 0,
        cooldownMinutes: 0,
        totalMinutes: 0,
      },
      totalSets: 0,
      equipmentUsed,
      targetMuscles: [],
      exercises: [],
      warnings: physiology.wearableReadiness.signals,
      scientificRationale: [
        'Smartwatch biometrics flagged acute systemic strain or possible illness (elevated wrist temperature or combined HRV drop + RHR spike). High-load generation paused automatically.',
      ],
      safetyGuidance:
        'Prioritize sleep, hydration, and light walking today until resting heart rate, HRV, and temperature return toward your personal baseline.',
    };
  }

  // Hard clinical guardrail: concerning discomfort NEVER gets a loaded generated workout
  if (request.discomfort?.severity === 'concerning') {
    return {
      version: WORKOUT_GENERATOR_VERSION,
      status: 'rest_recommended',
      title: 'Recovery & Clinical Check-In Recommended',
      mode: request.mode,
      preset: request.preset,
      availableMinutes,
      timeBreakdown: {
        warmupMinutes: 0,
        workAndRestMinutes: 0,
        transitionMinutes: 0,
        cooldownMinutes: 0,
        totalMinutes: 0,
      },
      totalSets: 0,
      equipmentUsed,
      targetMuscles: [],
      exercises: [],
      warnings: [
        `Concerning discomfort reported${request.discomfort.area ? ` (${request.discomfort.area})` : ''}. High-load training paused automatically.`,
      ],
      scientificRationale: [
        'Safety guardrail overrides muscle ranking, streaks, and generator presets whenever concerning pain or injury symptoms are reported.',
      ],
      safetyGuidance:
        'Rest the affected area today and consult a qualified clinician or sports physiotherapist before resuming loaded work.',
    };
  }

  const warnings: string[] = [];
  const rationale: string[] = [];
  const isCardioPreset = request.preset === 'cardio';
  const isTravelPreset = request.preset === 'travel';
  const mildDiscomfortArea =
    request.discomfort?.severity === 'mild' ? request.discomfort.area : undefined;
  const sensitiveJoints = parseDiscomfortJoints(mildDiscomfortArea);

  if (sensitiveJoints.length > 0) {
    rationale.push(
      `Applied joint-sparing filter (max joint stress ≤ 1) for mild discomfort in: ${sensitiveJoints.join(', ')}.`,
    );
  }

  // Determine target muscles
  let targetMuscles: MuscleId[] = [];
  if (request.mode === 'target_muscles' && request.targetMuscles && request.targetMuscles.length > 0) {
    targetMuscles = [...new Set(request.targetMuscles)];
    for (const m of targetMuscles) {
      const st = physiology.muscles[m];
      if (st.recovery.percent < 65) {
        warnings.push(
          `${st.label[0]} is only ${st.recovery.percent}% recovered (~${st.recovery.hoursUntilReady}h until ready). Volume capped conservatively.`,
        );
      }
      if (st.protectedForUpcomingGoal) {
        warnings.push(
          `${st.label[0]} is a prime mover for an upcoming TOP1 goal session within 36h — sets reduced to prevent pre-fatigue.`,
        );
      }
      if (st.volume.zone === 'over_mrv') {
        warnings.push(
          `${st.label[0]} is already above weekly MRV (${st.volume.weeklyEffectiveSets}/${st.volume.mrv} sets).`,
        );
      }
    }
  } else if (isCardioPreset) {
    targetMuscles = ['calves', 'quads', 'glutes', 'hamstrings'];
    rationale.push('Cardio preset prioritizes low-interference aerobic conditioning fitted to available minutes.');
  } else {
    // Smart next: pick top ready, non-protected muscles from physiology priority queue
    targetMuscles = physiology.recommendedTargets.map(t => t.muscle);
    if (targetMuscles.length === 0) {
      // Everyone is recovering -> select the freshest 3 muscles for gentle low-fatigue work
      targetMuscles = Object.values(physiology.muscles)
        .filter(m => !m.protectedForUpcomingGoal)
        .sort((a, b) => b.recovery.percent - a.recovery.percent)
        .slice(0, 3)
        .map(m => m.muscle);
      warnings.push('Most muscle groups are still recovering — scaled intensity and volume down to protect adaptation.');
    }
    const protectedCount = physiology.protectedMuscles.filter(p => p.reason === 'upcoming_goal').length;
    if (protectedCount > 0) {
      rationale.push(
        `Protected ${protectedCount} prime-mover muscle groups scheduled for an upcoming pinned TOP1 goal session within 36h.`,
      );
    }
  }

  const imbalanced = physiology.structuralBalance.filter(b => b.status === 'imbalanced');
  for (const imb of imbalanced) {
    rationale.push(`Balance audit (${imb.label}): ${imb.guidance}`);
  }

  // Filter feasible, joint-safe exercise pool (including user-created custom exercises)
  const pool = queryExercises({
    equipment: equipmentUsed,
    discomfortArea: mildDiscomfortArea,
    maxJointStress: sensitiveJoints.length > 0 ? 1 : 3,
    travelOnly: isTravelPreset,
    customExercises,
  }).filter(ex => {
    if (isCardioPreset) return ex.pattern === 'aerobic_steady' || ex.pattern === 'aerobic_intervals';
    return ex.pattern !== 'aerobic_steady' && ex.pattern !== 'aerobic_intervals';
  });

  // Strict time budget: allocate realistic warmup & cooldown proportional to total slot
  const warmupMinutes = availableMinutes <= 15 ? 2 : availableMinutes <= 25 ? 4 : 6;
  const cooldownMinutes = availableMinutes <= 15 ? 1 : 3;
  let remainingMinutes = Math.max(5, availableMinutes - warmupMinutes - cooldownMinutes);

  // Track fractional sets added in this generated session so we don't blow past MRV
  const addedSetsByMuscle = new Map<MuscleId, number>();
  const usedPatterns = new Set<string>();
  const chosenIds = new Set<string>();
  const blocks: GeneratedExerciseBlock[] = [];

  // Special handling for cardio preset (single or interval aerobic block scaled to remaining minutes)
  if (isCardioPreset) {
    const cardioEx = pool[0];
    if (cardioEx) {
      const workMin = Math.max(5, Math.floor(remainingMinutes - cardioEx.timePhysics.setupTransitionMinutes));
      const blockSec = workMin * 60;
      blocks.push({
        exerciseId: cardioEx.id,
        name: cardioEx.name,
        pattern: cardioEx.pattern,
        sets: 1,
        mode: 'seconds',
        targetAmount: blockSec,
        restSeconds: 0,
        effortCue: 'Zone 2 conversational pace (RPE 6/10)',
        suggestedLoadKg: null,
        estimatedMinutes: Number((workMin + cardioEx.timePhysics.setupTransitionMinutes).toFixed(1)),
        musclesTargeted: cardioEx.muscles.map(inv => ({
          muscle: inv.muscle,
          role: inv.role,
          effectiveSetsAdded: Number(inv.weight.toFixed(2)),
        })),
        whyChosen: 'Selected for aerobic stimulus matching your equipment and strict time budget.',
        substitutes: findBiomechanicalSubstitutes(cardioEx.id, {
          availableEquipment: equipmentUsed,
          discomfortArea: mildDiscomfortArea,
          limit: 3,
        }).map(sub => ({
          exerciseId: sub.exercise.id,
          name: sub.exercise.name,
          similarityScore: sub.similarityScore,
          reason: sub.reason,
        })),
      });
    }
  } else {
    // Greedy multi-objective exercise selection:
    // Compounds first -> pattern variety -> target muscle coverage -> MRV & recovery protection -> strict time fit
    const maxExercises = availableMinutes <= 20 ? 3 : availableMinutes <= 40 ? 5 : 6;
    const targetSet = new Set<MuscleId>(targetMuscles);

    for (let slot = 0; slot < maxExercises && remainingMinutes >= 4; slot++) {
      let bestCandidate: {ex: ExerciseDefinition; score: number; sets: number} | null = null;

      for (const ex of pool) {
        if (chosenIds.has(ex.id)) continue;

        // Score candidate
        let score = 0;
        let touchesTarget = false;
        let violatesHardProtection = false;

        for (const inv of ex.muscles) {
          const st = physiology.muscles[inv.muscle];
          const projectedWk =
            st.volume.weeklyEffectiveSets + (addedSetsByMuscle.get(inv.muscle) ?? 0);

          if (targetSet.has(inv.muscle)) {
            touchesTarget = true;
            score += inv.weight * (30 + st.nextTargetPriority * 0.4);
          } else if (request.mode !== 'target_muscles') {
            // Secondary helpful bonus for ready under-MAV synergists
            if (st.recovery.percent >= 65 && projectedWk < st.volume.mav) {
              score += inv.weight * 8;
            }
          }

          // Penalize hammering fatigued, over-MRV, or upcoming-goal protected muscles
          if (inv.role === 'primary') {
            if (st.recovery.percent < 65) score -= request.mode === 'target_muscles' ? 18 : 65;
            if (st.protectedForUpcomingGoal) {
              score -= request.mode === 'target_muscles' ? 20 : 80;
              if (request.mode !== 'target_muscles') violatesHardProtection = true;
            }
            if (projectedWk >= st.volume.mrv) score -= 50;
          }
        }

        if (violatesHardProtection) continue;
        if (!touchesTarget && slot < 2) continue;

        // Compound openers first for maximum stimulus-to-time efficiency
        if (slot < 2 && ex.isCompound) score += 16;
        // Pattern diversity bonus
        if (!usedPatterns.has(ex.pattern)) score += 12;
        else score -= 10;

        // Choose realistic set count bounded by MRV headroom, recovery, and remaining time
        const primaryMuscles = ex.muscles.filter(inv => inv.role === 'primary');
        const minHeadroom = primaryMuscles.reduce((minH, inv) => {
          const st = physiology.muscles[inv.muscle];
          const already = st.volume.weeklyEffectiveSets + (addedSetsByMuscle.get(inv.muscle) ?? 0);
          return Math.min(minH, Math.max(1, Math.floor(st.volume.mrv - already)));
        }, 4);
        const anyRecovering = primaryMuscles.some(
          inv =>
            physiology.muscles[inv.muscle].recovery.percent < 65 ||
            physiology.muscles[inv.muscle].protectedForUpcomingGoal,
        );
        const desiredSets = Math.min(
          anyRecovering ? 2 : ex.isCompound ? (availableMinutes >= 40 ? 4 : 3) : 3,
          minHeadroom,
        );

        // Fit sets strictly into remainingMinutes
        let fittingSets = desiredSets;
        while (fittingSets >= 1 && computeExerciseMinutes(ex, fittingSets).totalMin > remainingMinutes) {
          fittingSets--;
        }
        if (fittingSets < 1) continue;

        if (!bestCandidate || score > bestCandidate.score) {
          bestCandidate = {ex, score, sets: fittingSets};
        }
      }

      if (!bestCandidate || bestCandidate.score <= 0) break;

      const {ex, sets} = bestCandidate;
      const timing = computeExerciseMinutes(ex, sets);
      chosenIds.add(ex.id);
      usedPatterns.add(ex.pattern);
      remainingMinutes = Number((remainingMinutes - timing.totalMin).toFixed(1));

      const musclesTargeted = ex.muscles.map(inv => {
        const added = Number((sets * inv.weight).toFixed(2));
        addedSetsByMuscle.set(inv.muscle, (addedSetsByMuscle.get(inv.muscle) ?? 0) + added);
        return {muscle: inv.muscle, role: inv.role, effectiveSetsAdded: added};
      });

      const primaryLabels = ex.muscles
        .filter(inv => inv.role === 'primary')
        .map(inv => MUSCLE_META[inv.muscle].label[0]);
      const anyCapped = ex.muscles.some(
        inv =>
          inv.role === 'primary' &&
          (physiology.muscles[inv.muscle].recovery.percent < 65 ||
            physiology.muscles[inv.muscle].protectedForUpcomingGoal),
      );

      blocks.push({
        exerciseId: ex.id,
        name: ex.name,
        pattern: ex.pattern,
        sets,
        mode: ex.timePhysics.mode,
        targetAmount: ex.timePhysics.defaultRepsOrSeconds,
        restSeconds: ex.timePhysics.defaultRestSeconds,
        effortCue: anyCapped
          ? 'Conservative effort (RIR 3 / RPE 7) to protect recovery'
          : ex.isCompound
            ? 'Controlled working sets (RIR 2 / RPE 8)'
            : 'Focused hypertrophy sets (RIR 1–2 / RPE 8–9)',
        suggestedLoadKg: groundedLoadKgFor(ex, dossier),
        estimatedMinutes: timing.totalMin,
        musclesTargeted,
        whyChosen: `${ex.isCompound ? 'High-return compound' : 'Targeted accessory'} for ${primaryLabels.join(' & ')} fitting your ${availableMinutes}-min budget and equipment.`,
        substitutes: findBiomechanicalSubstitutes(ex.id, {
          availableEquipment: equipmentUsed,
          discomfortArea: mildDiscomfortArea,
          limit: 3,
          customExercises,
        }).map(sub => ({
          exerciseId: sub.exercise.id,
          name: sub.exercise.name,
          similarityScore: sub.similarityScore,
          reason: sub.reason,
        })),
      });
    }
  }

  const workAndRestMinutes = Number(
    blocks
      .reduce((sum, b) => {
        const ex = pool.find(e => e.id === b.exerciseId);
        return sum + (ex ? computeExerciseMinutes(ex, b.sets).workAndRestMin : b.estimatedMinutes);
      }, 0)
      .toFixed(1),
  );
  const transitionMinutes = Number(
    blocks
      .reduce((sum, b) => {
        const ex = pool.find(e => e.id === b.exerciseId);
        return sum + (ex ? ex.timePhysics.setupTransitionMinutes : 1);
      }, 0)
      .toFixed(1),
  );
  const totalMinutes = Number(
    Math.min(availableMinutes, warmupMinutes + workAndRestMinutes + transitionMinutes + cooldownMinutes).toFixed(1),
  );
  const totalSets = blocks.reduce((sum, b) => sum + b.sets, 0);

  const presetTitles: Record<GeneratorPreset, string> = {
    at_home: 'Adaptive Home Session',
    gym: 'Adaptive Gym Session',
    cardio: 'Adaptive Aerobic Conditioning',
    travel: 'Zero-Friction Travel Session',
    bodyweight: 'Adaptive Bodyweight Session',
    dumbbells_only: 'Adaptive Dumbbells-Only Session',
  };
  const title = request.preset
    ? presetTitles[request.preset]
    : request.mode === 'target_muscles' && targetMuscles.length > 0
      ? `Targeted ${targetMuscles.slice(0, 2).map(m => MUSCLE_META[m].label[0]).join(' & ')} Session`
      : 'Smart Adaptive Next Session';

  rationale.unshift(
    `Built ${blocks.length} exercise(s) (${totalSets} working sets) strictly inside your ${availableMinutes}-minute window (estimated ${totalMinutes} min including warm-up, setup/transitions, rest & cool-down).`,
  );

  return {
    version: WORKOUT_GENERATOR_VERSION,
    status: 'generated',
    title,
    mode: request.mode,
    preset: request.preset,
    availableMinutes,
    timeBreakdown: {
      warmupMinutes,
      workAndRestMinutes,
      transitionMinutes,
      cooldownMinutes,
      totalMinutes,
    },
    totalSets,
    equipmentUsed,
    targetMuscles,
    exercises: blocks,
    warnings,
    scientificRationale: rationale,
    safetyGuidance: mildDiscomfortArea
      ? `Stop or swap to an included substitute if ${mildDiscomfortArea} discomfort rises above mild (3/10).`
      : null,
  };
}
