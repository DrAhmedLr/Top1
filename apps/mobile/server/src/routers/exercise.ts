import { TRPCError } from '@trpc/server';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { exercises, workoutExerciseLogs, workoutPosts, workoutSets } from '../db/schema.js';
import { generateId } from '../lib/auth.js';
import { protectedProcedure, router } from '../trpc.js';

function serializeExercise(row: typeof exercises.$inferSelect) {
  return {
    id: row.id,
    authorId: row.authorId,
    name: row.name,
    equipment: row.equipment,
    inputType: row.inputType,
    primaryMuscles: JSON.parse(row.primaryMusclesJson) as string[],
    secondaryMuscles: JSON.parse(row.secondaryMusclesJson) as string[],
    instructions: row.instructions,
    maleBaseFactor: row.maleBaseFactor,
    femaleBaseFactor: row.femaleBaseFactor,
    includesBodyweight: row.includesBodyweight,
    isRankable: row.isRankable,
    isCustom: row.authorId !== null,
  };
}

export const exerciseRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          muscle: z.string().optional(),
          equipment: z.string().optional(),
          customOnly: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(exercises)
        .where(or(isNull(exercises.authorId), eq(exercises.authorId, ctx.user.id)));

      let mapped = rows.map(serializeExercise);
      if (input?.customOnly) {
        mapped = mapped.filter((e) => e.authorId === ctx.user.id);
      }
      if (input?.equipment && input.equipment !== 'All') {
        mapped = mapped.filter((e) => e.equipment === input.equipment);
      }
      if (input?.muscle && input.muscle !== 'All') {
        mapped = mapped.filter(
          (e) =>
            e.primaryMuscles.includes(input.muscle!) ||
            e.secondaryMuscles.includes(input.muscle!)
        );
      }
      if (input?.search?.trim()) {
        const q = input.search.trim().toLowerCase();
        mapped = mapped.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            e.equipment.toLowerCase().includes(q) ||
            e.primaryMuscles.some((m) => m.toLowerCase().includes(q))
        );
      }
      return mapped.sort((a, b) => a.name.localeCompare(b.name));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(exercises)
        .where(eq(exercises.id, input.id))
        .limit(1);
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Exercise not found' });
      return serializeExercise(row);
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(60),
        equipment: z.string().min(1),
        inputType: z.enum(['weight_reps', 'bodyweight_reps', 'duration']).default('weight_reps'),
        primaryMuscles: z.array(z.string()).min(1),
        secondaryMuscles: z.array(z.string()).default([]),
        instructions: z.string().max(400).default(''),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = generateId('cex');
      const now = new Date().toISOString();
      await ctx.db.insert(exercises).values({
        id,
        authorId: ctx.user.id,
        name: input.name,
        equipment: input.equipment,
        inputType: input.inputType,
        primaryMusclesJson: JSON.stringify(input.primaryMuscles),
        secondaryMusclesJson: JSON.stringify(input.secondaryMuscles),
        instructions: input.instructions,
        maleBaseFactor: 4.0,
        femaleBaseFactor: 2.8,
        includesBodyweight: input.inputType === 'bodyweight_reps',
        isRankable: true,
        createdAt: now,
      });
      const [created] = await ctx.db
        .select()
        .from(exercises)
        .where(eq(exercises.id, id))
        .limit(1);
      return serializeExercise(created);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().trim().min(2).max(60).optional(),
        equipment: z.string().optional(),
        primaryMuscles: z.array(z.string()).min(1).optional(),
        secondaryMuscles: z.array(z.string()).optional(),
        instructions: z.string().max(400).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(exercises)
        .where(and(eq(exercises.id, input.id), eq(exercises.authorId, ctx.user.id)))
        .limit(1);
      if (!existing) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot edit built-in or other user exercise' });
      }
      await ctx.db
        .update(exercises)
        .set({
          name: input.name ?? existing.name,
          equipment: input.equipment ?? existing.equipment,
          primaryMusclesJson: input.primaryMuscles
            ? JSON.stringify(input.primaryMuscles)
            : existing.primaryMusclesJson,
          secondaryMusclesJson: input.secondaryMuscles
            ? JSON.stringify(input.secondaryMuscles)
            : existing.secondaryMusclesJson,
          instructions: input.instructions ?? existing.instructions,
        })
        .where(eq(exercises.id, input.id));
      const [updated] = await ctx.db
        .select()
        .from(exercises)
        .where(eq(exercises.id, input.id))
        .limit(1);
      return serializeExercise(updated);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(exercises)
        .where(and(eq(exercises.id, input.id), eq(exercises.authorId, ctx.user.id)));
      return { ok: true };
    }),

  getHistory: protectedProcedure
    .input(z.object({ exerciseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const logs = await ctx.db
        .select({
          log: workoutExerciseLogs,
          postTitle: workoutPosts.title,
          completedAt: workoutPosts.completedAt,
        })
        .from(workoutExerciseLogs)
        .innerJoin(workoutPosts, eq(workoutExerciseLogs.postId, workoutPosts.id))
        .where(
          and(
            eq(workoutExerciseLogs.exerciseId, input.exerciseId),
            eq(workoutPosts.userId, ctx.user.id)
          )
        )
        .orderBy(desc(workoutPosts.completedAt))
        .limit(20);

      const results = [];
      for (const item of logs) {
        const sets = await ctx.db
          .select()
          .from(workoutSets)
          .where(eq(workoutSets.exerciseLogId, item.log.id));
        results.push({
          postId: item.log.postId,
          postTitle: item.postTitle,
          completedAt: item.completedAt,
          bestE1rmKg: item.log.bestE1rmKg,
          bestRating: item.log.bestRating,
          bestRankTier: item.log.bestRankTier,
          sets: sets.sort((a, b) => a.setIndex - b.setIndex),
        });
      }
      return results;
    }),
});
