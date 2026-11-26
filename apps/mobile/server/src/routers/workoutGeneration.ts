import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  ALL_MUSCLES,
  generateAdaptiveWorkout,
  type GeneratorPreset,
  type MuscleId,
} from '@top1/engine';
import { mapLiftoffEquipmentToDetailed, MUSCLE_ID_TO_SVG_GROUP } from '@apexlift/shared';
import { exercises, workoutEnvironments } from '../db/schema.js';
import { generateId } from '../lib/auth.js';
import { loadUserTop1Context } from '../lib/top1Context.js';
import { protectedProcedure, router } from '../trpc.js';

const SPLIT_TO_TOP1_MUSCLES: Record<string, MuscleId[]> = {
  push: ['upper_chest', 'mid_chest', 'front_delt', 'side_delt', 'triceps'],
  pull: ['lats', 'upper_back', 'rear_delt', 'traps', 'biceps'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  upper: ['mid_chest', 'lats', 'upper_back', 'front_delt', 'biceps', 'triceps'],
  lower: ['quads', 'hamstrings', 'glutes', 'erectors', 'calves'],
  full_body: ['mid_chest', 'quads', 'lats', 'hamstrings', 'front_delt', 'abs'],
};

export const workoutGenerationRouter = router({
  listEnvironments: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(workoutEnvironments)
      .where(eq(workoutEnvironments.userId, ctx.user.id));
    return rows.map((r) => ({
      ...r,
      equipment: JSON.parse(r.equipmentJson) as string[],
    }));
  }),

  upsertEnvironment: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().min(1).max(40),
        equipment: z.array(z.string()).min(1),
        defaultDurationMin: z.number().int().min(15).max(120).default(45),
        complexity: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        await ctx.db
          .update(workoutEnvironments)
          .set({
            name: input.name,
            equipmentJson: JSON.stringify(input.equipment),
            defaultDurationMin: input.defaultDurationMin,
            complexity: input.complexity,
          })
          .where(
            and(
              eq(workoutEnvironments.id, input.id),
              eq(workoutEnvironments.userId, ctx.user.id)
            )
          );
        return { id: input.id };
      }

      const id = generateId('env');
      await ctx.db.insert(workoutEnvironments).values({
        id,
        userId: ctx.user.id,
        name: input.name,
        equipmentJson: JSON.stringify(input.equipment),
        defaultDurationMin: input.defaultDurationMin,
        complexity: input.complexity,
        isDefault: false,
        createdAt: new Date().toISOString(),
      });
      return { id };
    }),

  generateWorkout: protectedProcedure
    .input(
      z.object({
        mode: z.enum(['smart_next', 'target_muscles', 'preset']).default('smart_next'),
        preset: z
          .enum(['gym', 'at_home', 'dumbbells_only', 'bodyweight', 'travel', 'cardio'])
          .optional(),
        split: z.enum(['push', 'pull', 'legs', 'upper', 'lower', 'full_body']).optional(),
        targetMuscles: z.array(z.string()).optional(),
        durationMin: z.number().int().min(10).max(120).default(45),
        equipment: z.array(z.string()).optional(),
        intensity: z.enum(['strength', 'hypertrophy', 'endurance']).default('hypertrophy'),
        discomfort: z
          .object({
            severity: z.enum(['none', 'mild', 'concerning']),
            area: z.string().max(80).optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const t1 = await loadUserTop1Context(ctx.db, ctx.user);

      // Resolve mode & target muscles cleanly (supports both TOP1 modes and legacy split callers)
      const validMuscleSet = new Set<string>(ALL_MUSCLES);
      const explicitTargets = (input.targetMuscles ?? []).filter((m): m is MuscleId =>
        validMuscleSet.has(m)
      );
      const splitTargets = input.split ? SPLIT_TO_TOP1_MUSCLES[input.split] : undefined;
      const effectiveMode =
        explicitTargets.length > 0 || (input.split && input.mode === 'target_muscles')
          ? 'target_muscles'
          : input.split && !input.preset && input.mode === 'smart_next'
            ? 'target_muscles'
            : input.mode;
      const targetMuscles =
        explicitTargets.length > 0 ? explicitTargets : splitTargets;

      const equipmentOverride =
        input.equipment && input.equipment.length > 0
          ? mapLiftoffEquipmentToDetailed(input.equipment)
          : undefined;

      const plan = generateAdaptiveWorkout({
        dossier: t1.dossier,
        trainingEvents: t1.trainingEvents,
        wearableHistory: t1.wearableHistory,
        customExercises: t1.customExercises,
        request: {
          mode: effectiveMode,
          preset: input.preset as GeneratorPreset | undefined,
          targetMuscles,
          availableMinutes: input.durationMin,
          equipmentOverride,
          discomfort:
            input.discomfort && input.discomfort.severity !== 'none'
              ? input.discomfort
              : undefined,
          upcomingGoalMetricsWithin36h: t1.upcomingGoalMetricsWithin36h,
        },
      });

      // Match generated TOP1 exercise blocks to catalog IDs; auto-register unmatched ontology exercises so saving/logging never fails FK constraints.
      const allExs = await ctx.db.select().from(exercises);
      const byId = new Map(allExs.map((e) => [e.id, e]));
      const byLowerName = new Map(allExs.map((e) => [e.name.toLowerCase(), e]));

      const resolveCatalogExercise = (name: string, fallbackId: string) => {
        const direct = byId.get(fallbackId);
        if (direct) return direct;
        const lower = name.toLowerCase();
        const exact = byLowerName.get(lower);
        if (exact) return exact;
        const partial = allExs.find(
          (e) =>
            e.name.toLowerCase().includes(lower) || lower.includes(e.name.toLowerCase())
        );
        return partial ?? null;
      };

      const repAdjust = input.intensity === 'strength' ? 5 : input.intensity === 'endurance' ? 15 : null;
      const nowIso = new Date().toISOString();

      const resolvedExercises = [];
      for (const block of plan.exercises) {
        let matched = resolveCatalogExercise(block.name, block.exerciseId);
        const primaryMuscles = block.musclesTargeted
          .filter((m) => m.role === 'primary')
          .map((m) => MUSCLE_ID_TO_SVG_GROUP[m.muscle] ?? m.muscle);
        if (!matched) {
          const safeId = `ex_onto_${block.exerciseId.replace(/[^a-z0-9_]/gi, '_').toLowerCase()}`;
          await ctx.db
            .insert(exercises)
            .values({
              id: safeId,
              name: block.name,
              equipment: 'Gym',
              inputType: 'weight_reps',
              primaryMusclesJson: JSON.stringify(primaryMuscles.length ? primaryMuscles : ['Upper Chest']),
              secondaryMusclesJson: '[]',
              instructions: block.whyChosen || `Perform ${block.name} with controlled tempo.`,
              maleBaseFactor: 4.0,
              femaleBaseFactor: 2.8,
              includesBodyweight: false,
              isRankable: true,
              createdAt: nowIso,
            })
            .onConflictDoNothing();
          matched = {
            id: safeId,
            authorId: null,
            name: block.name,
            equipment: 'Gym',
            inputType: 'weight_reps',
            primaryMusclesJson: JSON.stringify(primaryMuscles),
            secondaryMusclesJson: '[]',
            instructions: block.whyChosen || '',
            maleBaseFactor: 4.0,
            femaleBaseFactor: 2.8,
            includesBodyweight: false,
            isRankable: true,
            createdAt: nowIso,
          };
          byId.set(safeId, matched);
        }

        const reps = repAdjust ?? block.targetAmount;
        const loadKg = block.suggestedLoadKg ?? 0;
        resolvedExercises.push({
          exerciseId: matched.id,
          top1ExerciseId: block.exerciseId,
          exerciseName: matched.name,
          equipment: matched.equipment,
          pattern: block.pattern,
          primaryMuscles,
          restSeconds: block.restSeconds,
          effortCue: block.effortCue,
          whyChosen: block.whyChosen,
          estimatedMinutes: block.estimatedMinutes,
          suggestedLoadKg: block.suggestedLoadKg,
          substitutes: block.substitutes,
          sets: Array.from({ length: block.sets }, () => ({
            weightKg: loadKg,
            reps,
            setType: 'normal' as const,
          })),
        });
      }

      return {
        status: plan.status,
        title: plan.title,
        mode: plan.mode,
        preset: plan.preset ?? null,
        split: input.split ?? 'smart_next',
        durationMin: plan.availableMinutes,
        intensity: input.intensity,
        timeBreakdown: plan.timeBreakdown,
        totalSets: plan.totalSets,
        targetMuscles: plan.targetMuscles.map((m) => MUSCLE_ID_TO_SVG_GROUP[m] ?? m),
        targetMuscleIds: plan.targetMuscles,
        warnings: plan.warnings,
        scientificRationale: plan.scientificRationale,
        safetyGuidance: plan.safetyGuidance,
        exercises: resolvedExercises,
      };
    }),
});
