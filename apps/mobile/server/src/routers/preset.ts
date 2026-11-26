import { TRPCError } from '@trpc/server';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { exercises, presetExercises, presets, workoutFolders } from '../db/schema.js';
import { isBlockedBetween, safeJsonParse } from '../lib/accessControl.js';
import { generateId } from '../lib/auth.js';
import { protectedProcedure, router } from '../trpc.js';

const presetExerciseInputSchema = z.object({
  exerciseId: z.string(),
  supersetGroup: z.string().nullable().optional(),
  restSeconds: z.number().int().min(15).max(600).default(90),
  notes: z.string().default(''),
  targetSets: z
    .array(
      z.object({
        weightKg: z.number().min(0),
        reps: z.number().int().min(1),
        setType: z.enum(['normal', 'warmup', 'drop', 'failure']).default('normal'),
      })
    )
    .default([{ weightKg: 40, reps: 10, setType: 'normal' }]),
});

export const presetRouter = router({
  listFolders: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(workoutFolders)
      .where(eq(workoutFolders.userId, ctx.user.id))
      .orderBy(asc(workoutFolders.sortOrder));
  }),

  createFolder: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(40) }))
    .mutation(async ({ ctx, input }) => {
      const id = generateId('fld');
      const now = new Date().toISOString();
      await ctx.db.insert(workoutFolders).values({
        id,
        userId: ctx.user.id,
        name: input.name,
        sortOrder: 0,
        createdAt: now,
      });
      return { id, name: input.name };
    }),

  deleteFolder: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(workoutFolders)
        .where(and(eq(workoutFolders.id, input.id), eq(workoutFolders.userId, ctx.user.id)));
      return { ok: true };
    }),

  list: protectedProcedure
    .input(z.object({ userId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const targetUserId = input?.userId ?? ctx.user.id;
      const rows = await ctx.db
        .select()
        .from(presets)
        .where(eq(presets.userId, targetUserId))
        .orderBy(asc(presets.sortOrder));

      const allExRows = await ctx.db.select().from(exercises);
      const exMap = new Map(allExRows.map((e) => [e.id, e]));

      const out = [];
      for (const p of rows) {
        if (targetUserId !== ctx.user.id && !p.isPublic) continue;
        const pExs = await ctx.db
          .select()
          .from(presetExercises)
          .where(eq(presetExercises.presetId, p.id))
          .orderBy(asc(presetExercises.sortOrder));

        const primaryMuscles = new Set<string>();
        const hydrated = pExs.map((pe) => {
          const ex = exMap.get(pe.exerciseId);
          const pm = ex ? (JSON.parse(ex.primaryMusclesJson) as string[]) : [];
          pm.forEach((m) => primaryMuscles.add(m));
          return {
            id: pe.id,
            exerciseId: pe.exerciseId,
            exerciseName: ex?.name ?? 'Exercise',
            equipment: ex?.equipment ?? 'Barbell',
            primaryMuscles: pm,
            supersetGroup: pe.supersetGroup,
            restSeconds: pe.restSeconds,
            notes: pe.notes,
            targetSets: JSON.parse(pe.targetSetsJson) as Array<{
              weightKg: number;
              reps: number;
              setType?: 'normal' | 'warmup' | 'drop' | 'failure';
            }>,
          };
        });

        out.push({
          ...p,
          muscles: Array.from(primaryMuscles),
          exercises: hydrated,
        });
      }
      return out;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [p] = await ctx.db.select().from(presets).where(eq(presets.id, input.id)).limit(1);
      if (
        !p ||
        (p.userId !== ctx.user.id &&
          (!p.isPublic || (await isBlockedBetween(ctx.db, ctx.user.id, p.userId))))
      ) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Preset not found' });
      }

      const pExs = await ctx.db
        .select()
        .from(presetExercises)
        .where(eq(presetExercises.presetId, p.id))
        .orderBy(asc(presetExercises.sortOrder));
      const allExRows = await ctx.db.select().from(exercises);
      const exMap = new Map(allExRows.map((e) => [e.id, e]));

      return {
        ...p,
        exercises: pExs.map((pe) => {
          const ex = exMap.get(pe.exerciseId);
          return {
            id: pe.id,
            exerciseId: pe.exerciseId,
            exerciseName: ex?.name ?? 'Exercise',
            equipment: ex?.equipment ?? 'Barbell',
            primaryMuscles: ex ? safeJsonParse<string[]>(ex.primaryMusclesJson, []) : [],
            supersetGroup: pe.supersetGroup,
            restSeconds: pe.restSeconds,
            notes: pe.notes,
            targetSets: safeJsonParse<
              Array<{
                weightKg: number;
                reps: number;
                setType?: 'normal' | 'warmup' | 'drop' | 'failure';
              }>
            >(pe.targetSetsJson, []),
          };
        }),
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(60),
        description: z.string().max(200).default(''),
        folderId: z.string().nullable().optional(),
        isPublic: z.boolean().default(true),
        exercises: z.array(presetExerciseInputSchema).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = generateId('prs');
      const now = new Date().toISOString();
      await ctx.db.insert(presets).values({
        id,
        userId: ctx.user.id,
        folderId: input.folderId ?? null,
        name: input.name,
        description: input.description,
        isPublic: input.isPublic,
        downloadsCount: 0,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      });

      for (let i = 0; i < input.exercises.length; i++) {
        const item = input.exercises[i];
        await ctx.db.insert(presetExercises).values({
          id: generateId('pe'),
          presetId: id,
          exerciseId: item.exerciseId,
          sortOrder: i,
          supersetGroup: item.supersetGroup ?? null,
          restSeconds: item.restSeconds,
          notes: item.notes,
          targetSetsJson: JSON.stringify(item.targetSets),
        });
      }

      return { id, name: input.name };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(presets)
        .where(and(eq(presets.id, input.id), eq(presets.userId, ctx.user.id)));
      return { ok: true };
    }),

  copyFromUser: protectedProcedure
    .input(z.object({ presetId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [src] = await ctx.db
        .select()
        .from(presets)
        .where(eq(presets.id, input.presetId))
        .limit(1);
      if (
        !src ||
        (src.userId !== ctx.user.id &&
          (!src.isPublic || (await isBlockedBetween(ctx.db, ctx.user.id, src.userId))))
      ) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Preset not found' });
      }

      const srcExs = await ctx.db
        .select()
        .from(presetExercises)
        .where(eq(presetExercises.presetId, src.id))
        .orderBy(asc(presetExercises.sortOrder));

      const newId = generateId('prs');
      const now = new Date().toISOString();
      await ctx.db.insert(presets).values({
        id: newId,
        userId: ctx.user.id,
        folderId: null,
        name: `${src.name} (Copy)`,
        description: src.description,
        isPublic: true,
        downloadsCount: 0,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      });

      for (let i = 0; i < srcExs.length; i++) {
        const item = srcExs[i];
        await ctx.db.insert(presetExercises).values({
          id: generateId('pe'),
          presetId: newId,
          exerciseId: item.exerciseId,
          sortOrder: i,
          supersetGroup: item.supersetGroup,
          restSeconds: item.restSeconds,
          notes: item.notes,
          targetSetsJson: item.targetSetsJson,
        });
      }

      await ctx.db
        .update(presets)
        .set({ downloadsCount: src.downloadsCount + 1 })
        .where(eq(presets.id, src.id));

      return { id: newId };
    }),
});
