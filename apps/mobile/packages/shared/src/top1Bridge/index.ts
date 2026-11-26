import {
  ALL_MUSCLES,
  epley,
  performanceTier,
  weightedPullupRatio,
  type DetailedEquipmentId,
  type MuscleId,
  type MuscleState,
  type MuscleTier,
  type PerformanceArea,
  type PillarId,
  type RecoveryBand,
  type TrainingEvent,
  type VolumeZone,
  type Workout,
} from '@top1/engine';
import { RANKED_MUSCLE_GROUPS, type RankedMuscleGroup, type RankTier } from '../constants';

/**
 * Unified TOP1% Fusion Badge & Tier Display Mapping.
 * Preserves Liftoff's sculpted badge assets and metallic gradients while using
 * Top1.Fit's authentic percentile & muscle capability tiers as the ground truth.
 */
export interface Top1BadgeVisual {
  badgeTier: RankTier;
  division: 0 | 1 | 2 | 3;
  tierName: string;
  topLabel: string;
  muscleTier: MuscleTier;
  accentColor: string;
}

export const TOP1_MUSCLE_TIER_DISPLAY: Record<
  MuscleTier,
  { badgeTier: RankTier; label: string; color: string }
> = {
  unmeasured: { badgeTier: 'Unranked', label: 'Unmeasured', color: '#7EA1CA' },
  foundation: { badgeTier: 'Rookie', label: 'Foundation', color: '#D88A3D' },
  bronze: { badgeTier: 'Novice', label: 'Bronze', color: '#E08E55' },
  silver: { badgeTier: 'Enthusiast', label: 'Silver', color: '#C2CFD2' },
  gold: { badgeTier: 'Intermediate', label: 'Gold', color: '#F2BC1B' },
  platinum: { badgeTier: 'Veteran', label: 'Platinum', color: '#54DED6' },
  diamond: { badgeTier: 'Elite', label: 'Diamond', color: '#7D7DFF' },
  top1: { badgeTier: 'Olympian', label: 'TOP 1%', color: '#00BEFF' },
};

export const TOP1_RECOVERY_COLORS: Record<RecoveryBand, [string, string]> = {
  fresh: ['#16A34A', '#4ADE80'],
  ready: ['#0284C7', '#38BDF8'],
  recovering: ['#D97706', '#FBBF24'],
  fatigued: ['#DC2626', '#F87171'],
};

export const TOP1_VOLUME_COLORS: Record<VolumeZone, [string, string]> = {
  under_mev: ['#475569', '#94A3B8'],
  optimal_mav: ['#15803D', '#34D399'],
  near_mrv: ['#CA8A04', '#FACC15'],
  over_mrv: ['#B91C1C', '#F87171'],
};

export const PERFORMANCE_AREA_META: Record<
  PerformanceArea,
  { label: [string, string, string]; color: string; icon: string }
> = {
  push: { label: ['Push', 'Poussée', 'الدفع'], color: '#F97316', icon: 'barbell-outline' },
  pull: { label: ['Pull', 'Tirage', 'السحب'], color: '#38BDF8', icon: 'fitness-outline' },
  lower: { label: ['Lower', 'Bas du corps', 'الجزء السفلي'], color: '#A855F7', icon: 'walk-outline' },
  running: { label: ['Running', 'Course', 'الجري'], color: '#22C55E', icon: 'flash-outline' },
};

export const PILLAR_META: Record<
  PillarId,
  { label: [string, string, string]; color: string; icon: string }
> = {
  bodymarkers: {
    label: ['BodyMarkers', 'Marqueurs corporels', 'مؤشرات الجسم'],
    color: '#60A5FA',
    icon: 'pulse-outline',
  },
  strength: {
    label: ['Strength & Fitness', 'Force & condition', 'القوة واللياقة'],
    color: '#EF4444',
    icon: 'barbell-outline',
  },
  recovery: {
    label: ['Recovery', 'Récupération', 'التعافي'],
    color: '#34D399',
    icon: 'moon-outline',
  },
};

export function muscleTierToRankTier(tier: MuscleTier): RankTier {
  return TOP1_MUSCLE_TIER_DISPLAY[tier]?.badgeTier ?? 'Unranked';
}

export function muscleTierToDisplayName(tier: MuscleTier): string {
  return TOP1_MUSCLE_TIER_DISPLAY[tier]?.label ?? 'Unmeasured';
}

/**
 * Map a Top1.Fit percentile (0.01..100, lower is better) to Liftoff's sculpted RankBadge visual
 * plus clean TOP1% tier display labels.
 */
export function topPercentToBadge(percent: number | null | undefined): Top1BadgeVisual {
  if (percent == null || !Number.isFinite(percent) || percent <= 0) {
    return {
      badgeTier: 'Unranked',
      division: 0,
      tierName: 'Unmeasured',
      topLabel: 'Unranked',
      muscleTier: 'unmeasured',
      accentColor: '#7EA1CA',
    };
  }

  const clamped = Math.max(0.01, Math.min(100, percent));
  const tierStr = performanceTier(clamped);
  const topLabel = clamped > 65 ? 'Top 65%+' : `Top ${tierStr}`;

  if (clamped <= 0.1) {
    return {
      badgeTier: 'Olympian',
      division: 1,
      tierName: 'TOP 0.1% APEX',
      topLabel,
      muscleTier: 'top1',
      accentColor: '#00BEFF',
    };
  }
  if (clamped <= 0.5) {
    return {
      badgeTier: 'Titan',
      division: clamped <= 0.25 ? 3 : 1,
      tierName: 'TOP 0.5% TITAN',
      topLabel,
      muscleTier: 'top1',
      accentColor: '#FF3B30',
    };
  }
  if (clamped <= 1.0) {
    return {
      badgeTier: 'Champion',
      division: clamped <= 0.75 ? 3 : 1,
      tierName: 'TOP 1%',
      topLabel,
      muscleTier: 'top1',
      accentColor: '#D075E8',
    };
  }
  if (clamped <= 2.5) {
    return {
      badgeTier: 'Elite',
      division: clamped <= 1.5 ? 3 : clamped <= 2 ? 2 : 1,
      tierName: 'Diamond',
      topLabel,
      muscleTier: 'diamond',
      accentColor: '#7D7DFF',
    };
  }
  if (clamped <= 5.0) {
    return {
      badgeTier: 'Veteran',
      division: clamped <= 3.2 ? 3 : clamped <= 4.1 ? 2 : 1,
      tierName: 'Platinum',
      topLabel,
      muscleTier: 'platinum',
      accentColor: '#54DED6',
    };
  }
  if (clamped <= 10.0) {
    return {
      badgeTier: 'Intermediate',
      division: clamped <= 6.5 ? 3 : clamped <= 8.2 ? 2 : 1,
      tierName: 'Gold',
      topLabel,
      muscleTier: 'gold',
      accentColor: '#F2BC1B',
    };
  }
  if (clamped <= 25.0) {
    return {
      badgeTier: 'Enthusiast',
      division: clamped <= 15 ? 3 : clamped <= 20 ? 2 : 1,
      tierName: 'Silver',
      topLabel,
      muscleTier: 'silver',
      accentColor: '#C2CFD2',
    };
  }
  if (clamped <= 50.0) {
    return {
      badgeTier: 'Novice',
      division: clamped <= 32 ? 3 : clamped <= 41 ? 2 : 1,
      tierName: 'Bronze',
      topLabel,
      muscleTier: 'bronze',
      accentColor: '#E08E55',
    };
  }
  return {
    badgeTier: 'Rookie',
    division: clamped <= 60 ? 3 : clamped <= 75 ? 2 : 1,
    tierName: 'Foundation',
    topLabel,
    muscleTier: 'foundation',
    accentColor: '#D88A3D',
  };
}

/**
 * Convert TOP1% percentile (0.01..100) into an equivalent monotonic rating (0..1200)
 * for smooth compatibility with Liftoff progress bars & legacy sorting fields.
 */
export function topPercentToRating(percent: number | null | undefined): number {
  if (percent == null || !Number.isFinite(percent) || percent <= 0) return 0;
  const clamped = Math.max(0.01, Math.min(100, percent));
  // log10(100/p) ranges from 0 (100%) -> 2 (Top 1%) -> 4 (Top 0.01%)
  const logPts = Math.log10(100 / clamped);
  return Math.round(Math.min(1200, Math.max(50, 120 + logPts * 390)));
}

/**
 * Bidirectional mapping between Top1.Fit's 19 anatomical MuscleIds
 * and Liftoff's 20 SVG RankedMuscleGroups.
 */
export const SVG_GROUP_TO_MUSCLE_IDS: Record<RankedMuscleGroup, readonly MuscleId[]> = {
  'Upper Chest': ['upper_chest'],
  'Lower Chest': ['mid_chest', 'lower_chest'],
  'Front Delt': ['front_delt'],
  'Middle Delt': ['side_delt'],
  Triceps: ['triceps'],
  Lats: ['lats'],
  'Upper Back': ['upper_back'],
  Traps: ['traps'],
  'Rear Delt': ['rear_delt'],
  Biceps: ['biceps'],
  Forearms: ['forearms'],
  'Lower Back': ['erectors'],
  Quadriceps: ['quads'],
  Hamstrings: ['hamstrings'],
  Glutes: ['glutes'],
  Abductors: ['glutes'],
  Adductors: ['quads', 'glutes'],
  Calves: ['calves'],
  Abdominals: ['abs'],
  Obliques: ['obliques'],
};

export const MUSCLE_ID_TO_SVG_GROUP: Record<MuscleId, RankedMuscleGroup> = {
  upper_chest: 'Upper Chest',
  mid_chest: 'Lower Chest',
  lower_chest: 'Lower Chest',
  front_delt: 'Front Delt',
  side_delt: 'Middle Delt',
  rear_delt: 'Rear Delt',
  upper_back: 'Upper Back',
  lats: 'Lats',
  traps: 'Traps',
  erectors: 'Lower Back',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abdominals',
  obliques: 'Obliques',
  quads: 'Quadriceps',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
};

export interface UnifiedSvgMuscleState {
  muscle: RankedMuscleGroup;
  muscleIds: MuscleId[];
  /** Visual tier mapped to Liftoff RankBadge/SVG gradients */
  tier: RankTier;
  division: 0 | 1 | 2 | 3;
  /** Authentic TOP1 MuscleTier */
  muscleTier: MuscleTier;
  label: string;
  rating: number;
  capabilityScore: number | null;
  confidence: MuscleState['capability']['confidence'];
  sourceExercise: string | null;
  topExerciseName: string | null;
  topExerciseId: string | null;
  exerciseCount: number;
  recoveryPercent: number;
  recoveryBand: RecoveryBand;
  hoursUntilReady: number;
  acuteSets72h: number;
  weeklyEffectiveSets: number;
  mev: number;
  mav: number;
  mrv: number;
  volumeZone: VolumeZone;
  protectedForUpcomingGoal: boolean;
  nextTargetPriority: number;
}

const MUSCLE_TIER_RANK_ORDER: readonly MuscleTier[] = [
  'unmeasured',
  'foundation',
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
  'top1',
];

/**
 * Convert Top1.Fit's 19-muscle BodyPhysiologyReport muscle map into Liftoff's
 * 20-muscle SVG Bodygraph payload with full Capability, Recovery, and Volume telemetry.
 */
export function buildSvgMuscleMapFromPhysiology(
  muscles: Record<MuscleId, MuscleState>
): Record<RankedMuscleGroup, UnifiedSvgMuscleState> {
  const out = {} as Record<RankedMuscleGroup, UnifiedSvgMuscleState>;

  for (const svgGroup of RANKED_MUSCLE_GROUPS) {
    const ids = [...SVG_GROUP_TO_MUSCLE_IDS[svgGroup]];
    const states = ids.map((id) => muscles[id]).filter(Boolean);

    // Peak capability across mapped anatomical heads
    const bestCap = states.reduce<MuscleState | null>((best, st) => {
      if (!best) return st;
      const aIdx = MUSCLE_TIER_RANK_ORDER.indexOf(st.capability.tier);
      const bIdx = MUSCLE_TIER_RANK_ORDER.indexOf(best.capability.tier);
      if (aIdx !== bIdx) return aIdx > bIdx ? st : best;
      return (st.capability.score ?? -1) > (best.capability.score ?? -1) ? st : best;
    }, null);

    // Most conservative recovery across mapped heads
    const worstRec = states.reduce<MuscleState | null>((worst, st) => {
      if (!worst) return st;
      return st.recovery.percent < worst.recovery.percent ? st : worst;
    }, null);

    // Highest volume utilization across mapped heads
    const maxVol = states.reduce<MuscleState | null>((peak, st) => {
      if (!peak) return st;
      return st.volume.weeklyEffectiveSets / Math.max(1, st.volume.mrv) >
        peak.volume.weeklyEffectiveSets / Math.max(1, peak.volume.mrv)
        ? st
        : peak;
    }, null);

    const primary = bestCap ?? states[0];
    const muscleTier: MuscleTier = primary?.capability.tier ?? 'unmeasured';
    const badgeTier = muscleTierToRankTier(muscleTier);
    const score = primary?.capability.score ?? null;
    const division: 0 | 1 | 2 | 3 =
      muscleTier === 'unmeasured'
        ? 0
        : muscleTier === 'top1'
          ? 1
          : score !== null && score >= 88
            ? 3
            : score !== null && score >= 60
              ? 2
              : 1;

    out[svgGroup] = {
      muscle: svgGroup,
      muscleIds: ids,
      tier: badgeTier,
      division,
      muscleTier,
      label: muscleTierToDisplayName(muscleTier),
      rating: score !== null ? Math.round(score * 9.5) : 0,
      capabilityScore: score,
      confidence: primary?.capability.confidence ?? 'unmeasured',
      sourceExercise: primary?.capability.sourceExercise ?? null,
      topExerciseName: primary?.capability.sourceExercise ?? null,
      topExerciseId: null,
      exerciseCount: states.filter((s) => s.capability.score !== null).length,
      recoveryPercent: worstRec?.recovery.percent ?? 100,
      recoveryBand: worstRec?.recovery.band ?? 'fresh',
      hoursUntilReady: worstRec?.recovery.hoursUntilReady ?? 0,
      acuteSets72h: Number(
        Math.max(...states.map((s) => s.recovery.acuteSets72h), 0).toFixed(1)
      ),
      weeklyEffectiveSets: Number(
        (maxVol?.volume.weeklyEffectiveSets ?? 0).toFixed(1)
      ),
      mev: maxVol?.volume.mev ?? 4,
      mav: maxVol?.volume.mav ?? 10,
      mrv: maxVol?.volume.mrv ?? 18,
      volumeZone: maxVol?.volume.zone ?? 'under_mev',
      protectedForUpcomingGoal: states.some((s) => s.protectedForUpcomingGoal),
      nextTargetPriority: Math.max(...states.map((s) => s.nextTargetPriority), 0),
    };
  }

  return out;
}

export function mapLiftoffEquipmentToDetailed(equipment: readonly string[]): DetailedEquipmentId[] {
  const out = new Set<DetailedEquipmentId>(['none']);
  for (const raw of equipment) {
    const k = raw.trim().toLowerCase();
    if (k.includes('barbell') || k.includes('ez bar') || k.includes('trap bar')) {
      out.add('bars_plates');
      out.add('benches_racks');
    } else if (k.includes('dumbbell') || k.includes('kettlebell')) {
      out.add('small_weights');
    } else if (k.includes('cable')) {
      out.add('cable_machines');
    } else if (k.includes('smith')) {
      out.add('benches_racks');
      out.add('weighted_machines');
    } else if (k.includes('machine')) {
      out.add('weighted_machines');
      out.add('plated_machines');
    } else if (k.includes('band')) {
      out.add('resistance_bands');
    } else if (k.includes('bodyweight') || k.includes('calisthenics') || k.includes('pull')) {
      out.add('calisthenics_bars');
    }
  }
  return [...out];
}

export interface DetectedTop1Benchmark {
  metricId:
    | 'bench_1rm'
    | 'squat_1rm'
    | 'deadlift_1rm'
    | 'pullup_1rm'
    | 'pushups'
    | 'pullups'
    | 'dips'
    | 'dead_hang';
  value: number;
  unit: string;
  derivation?: {
    formula: 'epley_ratio_v1' | 'pullup_ratio_v1';
    inputs: [number, number];
    bodyWeightKg: number;
  };
}

/**
 * Inspect an exercise logged in Liftoff's ActiveWorkoutSheet and detect whether it
 * qualifies as a competitive Top1.Fit benchmark observation.
 */
export function detectTop1BenchmarkFromSets(params: {
  exerciseName: string;
  bodyweightKg: number;
  sets: ReadonlyArray<{
    setType?: string;
    weightKg: number;
    reps: number;
    durationSeconds?: number | null;
    isCompleted?: boolean;
  }>;
}): DetectedTop1Benchmark | null {
  const name = params.exerciseName.toLowerCase();
  const bw = Math.max(35, params.bodyweightKg || 75);
  const working = params.sets.filter(
    (s) => s.isCompleted !== false && s.setType !== 'warmup'
  );
  if (!working.length) return null;

  const bestLoadSet = () => {
    let best: { weightKg: number; reps: number; e1rm: number } | null = null;
    for (const s of working) {
      if (s.weightKg <= 0 || s.reps <= 0 || s.reps > 15) continue;
      // lib/derivations.ts enforces Epley bounds at 1..10 reps; clamp cleanly to avoid RangeError on 11-15 rep sets.
      const clampedReps = Math.min(10, Math.max(1, Math.round(s.reps)));
      try {
        const est = epley(s.weightKg, clampedReps);
        if (!best || est > best.e1rm) best = { weightKg: s.weightKg, reps: clampedReps, e1rm: est };
      } catch {
        continue;
      }
    }
    return best;
  };

  if (/\bbarbell\b.*\bbench\s*press\b|\bbench\s*press\s*\(barbell\)|\bflat\s*barbell\s*bench/i.test(name) || name === 'bench press') {
    const b = bestLoadSet();
    if (!b) return null;
    const ratio = Number((b.e1rm / bw).toFixed(3));
    if (ratio >= 0.1 && ratio <= 3) {
      return {
        metricId: 'bench_1rm',
        value: ratio,
        unit: '× BW',
        derivation: { formula: 'epley_ratio_v1', inputs: [b.weightKg, b.reps], bodyWeightKg: bw },
      };
    }
  }

  if (/\b(barbell\s*)?(back\s*)?squat\b/i.test(name) && !/split|goblet|hack|front|pistol|bodyweight|box|sissy|bulgarian/i.test(name)) {
    const b = bestLoadSet();
    if (!b) return null;
    const ratio = Number((b.e1rm / bw).toFixed(3));
    if (ratio >= 0.1 && ratio <= 4) {
      return {
        metricId: 'squat_1rm',
        value: ratio,
        unit: '× BW',
        derivation: { formula: 'epley_ratio_v1', inputs: [b.weightKg, b.reps], bodyWeightKg: bw },
      };
    }
  }

  if (/\b(barbell\s*|conventional\s*|sumo\s*)?deadlift\b/i.test(name) && !/romanian|rdl|stiff|dumbbell|single/i.test(name)) {
    const b = bestLoadSet();
    if (!b) return null;
    const ratio = Number((b.e1rm / bw).toFixed(3));
    if (ratio >= 0.1 && ratio <= 5) {
      return {
        metricId: 'deadlift_1rm',
        value: ratio,
        unit: '× BW',
        derivation: { formula: 'epley_ratio_v1', inputs: [b.weightKg, b.reps], bodyWeightKg: bw },
      };
    }
  }

  if (/\bpull[\s-]?ups?\b|\bchin[\s-]?ups?\b/i.test(name) && !/assisted|pulldown|machine/i.test(name)) {
    const weighted = working.filter((s) => s.weightKg > 0 && s.reps > 0 && s.reps <= 12);
    if (weighted.length) {
      let bestRatio = 0;
      let bestPair: [number, number] = [0, 1];
      for (const s of weighted) {
        const clampedReps = Math.min(10, Math.max(1, Math.round(s.reps)));
        try {
          const r = weightedPullupRatio(s.weightKg, clampedReps, bw);
          if (r > bestRatio) {
            bestRatio = r;
            bestPair = [s.weightKg, clampedReps];
          }
        } catch {
          continue;
        }
      }
      if (bestRatio >= 0 && bestRatio <= 2) {
        return {
          metricId: 'pullup_1rm',
          value: Number(bestRatio.toFixed(3)),
          unit: '× BW added',
          derivation: { formula: 'pullup_ratio_v1', inputs: bestPair, bodyWeightKg: bw },
        };
      }
    }
    const maxReps = Math.max(...working.map((s) => s.reps), 0);
    if (maxReps >= 1 && maxReps <= 100) {
      return { metricId: 'pullups', value: maxReps, unit: 'reps' };
    }
  }

  if (/\bpush[\s-]?ups?\b/i.test(name) && !/knee|incline|wall/i.test(name)) {
    const maxReps = Math.max(...working.map((s) => s.reps), 0);
    if (maxReps >= 1 && maxReps <= 150) {
      return { metricId: 'pushups', value: maxReps, unit: 'reps' };
    }
  }

  if (/\bdips?\b/i.test(name) && !/assisted|bench|machine/i.test(name)) {
    const maxReps = Math.max(...working.map((s) => s.reps), 0);
    if (maxReps >= 1 && maxReps <= 100) {
      return { metricId: 'dips', value: maxReps, unit: 'reps' };
    }
  }

  if (/\bdead\s*hang\b/i.test(name)) {
    const maxSec = Math.max(...working.map((s) => s.durationSeconds ?? s.reps), 0);
    if (maxSec >= 5 && maxSec <= 1200) {
      return { metricId: 'dead_hang', value: maxSec, unit: 's' };
    }
  }

  return null;
}

/**
 * Convert a completed Liftoff workout post into a canonical Top1.Fit TrainingEvent
 * so Muscle Physiology (recovery %, MEV/MAV/MRV) and Self-Optimization stay 100% live.
 */
export function buildTop1WorkoutEventFromPost(params: {
  postId: string;
  sequence: number;
  title: string;
  notes?: string;
  timeZone?: string;
  startedAt: string;
  completedAt: string;
  exercises: ReadonlyArray<{
    exerciseId: string;
    exerciseName: string;
    equipment?: string;
    notes?: string;
    sets: ReadonlyArray<{
      weightKg: number;
      reps: number;
      durationSeconds?: number | null;
      rpe?: number | null;
      setType?: string;
      isCompleted?: boolean;
    }>;
  }>;
}): TrainingEvent {
  const workoutData: Workout = {
    version: 1,
    name: params.title,
    notes: params.notes ?? '',
    timeZone: params.timeZone ?? 'UTC',
    status: 'completed',
    origin: null,
    startedAt: params.startedAt,
    endedAt: params.completedAt,
    snapshot: {
      name: params.title,
      exercises: params.exercises.map((ex) => ({
        id: ex.exerciseId,
        name: ex.exerciseName,
        equipment: ex.equipment ?? '',
        notes: ex.notes ?? '',
        sets: ex.sets.map((s, idx) => ({
          id: `${params.postId}_${ex.exerciseId}_s${idx}`,
          reps: s.reps > 0 ? s.reps : undefined,
          durationSeconds: s.durationSeconds ?? undefined,
          loadKg: s.weightKg > 0 ? s.weightKg : 0,
        })),
      })),
    },
    exercises: params.exercises.map((ex) => ({
      id: ex.exerciseId,
      name: ex.exerciseName,
      notes: ex.notes ?? '',
      substitutionReason: '',
      status: 'performed' as const,
      sets: ex.sets
        .filter((s) => s.setType !== 'warmup')
        .map((s, idx) => ({
          id: `${params.postId}_${ex.exerciseId}_a${idx}`,
          completed: s.isCompleted !== false,
          reps: s.reps > 0 ? s.reps : undefined,
          durationSeconds: s.durationSeconds ?? undefined,
          loadKg: s.weightKg > 0 ? s.weightKg : 0,
        })),
    })),
  };

  return {
    version: 1,
    id: params.postId,
    requestId: params.postId,
    kind: 'workout',
    sequence: params.sequence,
    revision: 1,
    epoch: 1,
    source: 'personal',
    deleted: false,
    reason: 'workout_logged',
    recordedAt: params.completedAt,
    data: workoutData,
  };
}

export { ALL_MUSCLES };
