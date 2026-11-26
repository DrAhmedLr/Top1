import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  buildBodyPhysiologyReport,
  EXERCISE_CATALOG,
  findBiomechanicalSubstitutes,
} from '@top1/engine';
import { buildSvgMuscleMapFromPhysiology } from '@apexlift/shared';
import { users } from '../db/schema.js';
import { loadUserTop1Context } from '../lib/top1Context.js';
import { protectedProcedure, router } from '../trpc.js';

export const physiologyRouter = router({
  getBodyReport: protectedProcedure
    .input(z.object({ userId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      let targetUser = ctx.user;
      if (input?.userId && input.userId !== ctx.user.id) {
        const [found] = await ctx.db
          .select()
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);
        if (found) targetUser = found;
      }

      const t1 = await loadUserTop1Context(ctx.db, targetUser);
      const report = buildBodyPhysiologyReport({
        dossier: t1.dossier,
        trainingEvents: t1.trainingEvents,
        upcomingGoalMetricsWithin36h: t1.upcomingGoalMetricsWithin36h,
        wearableHistory: t1.wearableHistory,
        customExercises: t1.customExercises,
      });

      const svgMuscles = buildSvgMuscleMapFromPhysiology(report.muscles);

      return {
        ...report,
        svgMuscles,
      };
    }),

  findSubstitutes: protectedProcedure
    .input(
      z.object({
        exerciseIdOrName: z.string(),
        discomfortArea: z.string().optional(),
        limit: z.number().int().min(1).max(8).default(4),
      })
    )
    .query(async ({ ctx, input }) => {
      const t1 = await loadUserTop1Context(ctx.db, ctx.user);
      const catalog = [...EXERCISE_CATALOG, ...t1.customExercises];
      const q = input.exerciseIdOrName.toLowerCase();
      const source = catalog.find(
        (e) =>
          e.id === input.exerciseIdOrName ||
          e.name.toLowerCase() === q ||
          e.aliases.some((a) => a.toLowerCase() === q)
      );
      if (!source) return { source: null, substitutes: [] };

      const subs = findBiomechanicalSubstitutes(source.id, {
        discomfortArea: input.discomfortArea,
        limit: input.limit,
        customExercises: t1.customExercises,
      });
      return {
        source: { id: source.id, name: source.name, pattern: source.pattern },
        substitutes: subs.map((s) => ({
          exerciseId: s.exercise.id,
          name: s.exercise.name,
          similarityScore: Number(s.similarityScore.toFixed(2)),
          reason: s.reason,
        })),
      };
    }),
});
