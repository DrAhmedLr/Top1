import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { foodBundles, foodLogs, foods, healthLogs, macroGoals, metricObservations } from '../db/schema.js';
import { generateId } from '../lib/auth.js';
import { nextObservationSequence } from '../lib/top1Context.js';
import { protectedProcedure, router } from '../trpc.js';

export const foodRouter = router({
  getMacroGoals: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select()
      .from(macroGoals)
      .where(eq(macroGoals.userId, ctx.user.id))
      .limit(1);
    return (
      row ?? {
        userId: ctx.user.id,
        dailyCaloriesGoal: 2400,
        dailyProteinGoal: 180,
        dailyCarbsGoal: 250,
        dailyFatGoal: 70,
        updatedAt: new Date().toISOString(),
      }
    );
  }),

  updateMacroGoals: protectedProcedure
    .input(
      z.object({
        dailyCaloriesGoal: z.number().int().min(800).max(8000),
        dailyProteinGoal: z.number().int().min(20).max(500),
        dailyCarbsGoal: z.number().int().min(0).max(1000),
        dailyFatGoal: z.number().int().min(10).max(300),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date().toISOString();
      const [existing] = await ctx.db
        .select()
        .from(macroGoals)
        .where(eq(macroGoals.userId, ctx.user.id))
        .limit(1);

      if (existing) {
        await ctx.db
          .update(macroGoals)
          .set({ ...input, updatedAt: now })
          .where(eq(macroGoals.userId, ctx.user.id));
      } else {
        await ctx.db.insert(macroGoals).values({
          userId: ctx.user.id,
          ...input,
          updatedAt: now,
        });
      }
      return { ...input, updatedAt: now };
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string().default(''), customOnly: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(foods)
        .where(or(isNull(foods.authorId), eq(foods.authorId, ctx.user.id)));

      let out = rows;
      if (input.customOnly) out = out.filter((f) => f.authorId === ctx.user.id);
      if (input.query.trim()) {
        const q = input.query.trim().toLowerCase();
        out = out.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.brand.toLowerCase().includes(q) ||
            (f.barcode && f.barcode.includes(q))
        );
      }
      return out.slice(0, 40);
    }),

  byBarcode: protectedProcedure
    .input(z.object({ barcode: z.string().trim().min(4) }))
    .query(async ({ ctx, input }) => {
      const [found] = await ctx.db
        .select()
        .from(foods)
        .where(eq(foods.barcode, input.barcode))
        .limit(1);
      return found ?? null;
    }),

  createCustom: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(60),
        brand: z.string().max(40).default('Custom'),
        barcode: z.string().nullable().optional(),
        servingSize: z.number().positive().default(100),
        servingUnit: z.string().default('g'),
        calories: z.number().min(0),
        proteinG: z.number().min(0),
        carbsG: z.number().min(0),
        fatG: z.number().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = generateId('cfd');
      await ctx.db.insert(foods).values({
        id,
        authorId: ctx.user.id,
        name: input.name,
        brand: input.brand,
        barcode: input.barcode ?? null,
        servingSize: input.servingSize,
        servingUnit: input.servingUnit,
        calories: input.calories,
        proteinG: input.proteinG,
        carbsG: input.carbsG,
        fatG: input.fatG,
        isCommon: false,
        createdAt: new Date().toISOString(),
      });
      return { id };
    }),

  listBundles: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(foodBundles)
      .where(eq(foodBundles.userId, ctx.user.id));
    return rows.map((r) => ({
      ...r,
      items: JSON.parse(r.itemsJson || '[]') as Array<{
        foodId: string;
        foodName: string;
        servings: number;
      }>,
    }));
  }),

  createBundle: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(60),
        items: z
          .array(
            z.object({
              foodId: z.string(),
              foodName: z.string(),
              servings: z.number().positive(),
              calories: z.number().min(0),
              proteinG: z.number().min(0),
              carbsG: z.number().min(0),
              fatG: z.number().min(0),
            })
          )
          .min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = generateId('bnd');
      const totalCalories = input.items.reduce((s, i) => s + i.calories * i.servings, 0);
      const totalProteinG = input.items.reduce((s, i) => s + i.proteinG * i.servings, 0);
      const totalCarbsG = input.items.reduce((s, i) => s + i.carbsG * i.servings, 0);
      const totalFatG = input.items.reduce((s, i) => s + i.fatG * i.servings, 0);

      await ctx.db.insert(foodBundles).values({
        id,
        userId: ctx.user.id,
        name: input.name,
        itemsJson: JSON.stringify(input.items),
        totalCalories: Number(totalCalories.toFixed(1)),
        totalProteinG: Number(totalProteinG.toFixed(1)),
        totalCarbsG: Number(totalCarbsG.toFixed(1)),
        totalFatG: Number(totalFatG.toFixed(1)),
        createdAt: new Date().toISOString(),
      });
      return { id };
    }),

  deleteBundle: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(foodBundles)
        .where(and(eq(foodBundles.id, input.id), eq(foodBundles.userId, ctx.user.id)));
      return { ok: true };
    }),

  getLogsByDate: protectedProcedure
    .input(z.object({ dateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const logs = await ctx.db
        .select()
        .from(foodLogs)
        .where(and(eq(foodLogs.userId, ctx.user.id), eq(foodLogs.dateIso, input.dateIso)))
        .orderBy(desc(foodLogs.loggedAt));

      const totals = logs.reduce(
        (acc, l) => ({
          calories: acc.calories + l.calories,
          proteinG: acc.proteinG + l.proteinG,
          carbsG: acc.carbsG + l.carbsG,
          fatG: acc.fatG + l.fatG,
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
      );

      return {
        logs,
        totals: {
          calories: Math.round(totals.calories),
          proteinG: Math.round(totals.proteinG),
          carbsG: Math.round(totals.carbsG),
          fatG: Math.round(totals.fatG),
        },
      };
    }),

  logFood: protectedProcedure
    .input(
      z.object({
        dateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).default('lunch'),
        foodId: z.string().nullable().optional(),
        foodName: z.string().min(1),
        servings: z.number().positive().default(1),
        calories: z.number().min(0),
        proteinG: z.number().min(0),
        carbsG: z.number().min(0),
        fatG: z.number().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = generateId('flg');
      await ctx.db.insert(foodLogs).values({
        id,
        userId: ctx.user.id,
        dateIso: input.dateIso,
        mealType: input.mealType,
        foodId: input.foodId ?? null,
        foodName: input.foodName,
        servings: input.servings,
        calories: Number((input.calories * input.servings).toFixed(1)),
        proteinG: Number((input.proteinG * input.servings).toFixed(1)),
        carbsG: Number((input.carbsG * input.servings).toFixed(1)),
        fatG: Number((input.fatG * input.servings).toFixed(1)),
        loggedAt: new Date().toISOString(),
      });
      return { id };
    }),

  deleteLog: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(foodLogs)
        .where(and(eq(foodLogs.id, input.id), eq(foodLogs.userId, ctx.user.id)));
      return { ok: true };
    }),

  getHealthLog: protectedProcedure
    .input(z.object({ dateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(healthLogs)
        .where(and(eq(healthLogs.userId, ctx.user.id), eq(healthLogs.dateIso, input.dateIso)))
        .limit(1);
      return (
        row ?? {
          id: '',
          userId: ctx.user.id,
          dateIso: input.dateIso,
          steps: 0,
          activeCalories: 0,
          sleepMinutes: 450,
          waterMl: 0,
          restingHr: 60,
          updatedAt: new Date().toISOString(),
        }
      );
    }),

  upsertHealthLog: protectedProcedure
    .input(
      z.object({
        dateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        steps: z.number().int().min(0).max(100000),
        activeCalories: z.number().int().min(0).max(10000),
        sleepMinutes: z.number().int().min(0).max(1440),
        waterMl: z.number().int().min(0).max(15000),
        restingHr: z.number().int().min(30).max(200).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date().toISOString();
      const [existing] = await ctx.db
        .select()
        .from(healthLogs)
        .where(and(eq(healthLogs.userId, ctx.user.id), eq(healthLogs.dateIso, input.dateIso)))
        .limit(1);

      let logId = existing?.id ?? generateId('hlg');
      if (existing) {
        await ctx.db
          .update(healthLogs)
          .set({
            steps: input.steps,
            activeCalories: input.activeCalories,
            sleepMinutes: input.sleepMinutes,
            waterMl: input.waterMl,
            restingHr: input.restingHr ?? existing.restingHr,
            updatedAt: now,
          })
          .where(eq(healthLogs.id, existing.id));
      } else {
        await ctx.db.insert(healthLogs).values({
          id: logId,
          userId: ctx.user.id,
          dateIso: input.dateIso,
          steps: input.steps,
          activeCalories: input.activeCalories,
          sleepMinutes: input.sleepMinutes,
          waterMl: input.waterMl,
          restingHr: input.restingHr ?? null,
          updatedAt: now,
        });
      }

      // Sync sleep & resting HR into canonical TOP1% metric_observations
      const syncItems: Array<{ metricId: string; value: number; unit: string }> = [];
      if (input.sleepMinutes >= 60 && input.sleepMinutes <= 960) {
        syncItems.push({ metricId: 'total_sleep', value: input.sleepMinutes, unit: 'min' });
      }
      if (input.restingHr && input.restingHr >= 30 && input.restingHr <= 140) {
        syncItems.push({ metricId: 'rhr', value: input.restingHr, unit: 'bpm' });
      }
      for (const s of syncItems) {
        const seq = await nextObservationSequence(ctx.db, ctx.user.id);
        await ctx.db.insert(metricObservations).values({
          id: generateId('obs'),
          userId: ctx.user.id,
          metricId: s.metricId,
          value: s.value,
          unit: s.unit,
          measuredAt: `${input.dateIso}T08:00:00.000Z`,
          recordedAt: now,
          sequence: seq,
          method: 'device',
          cleared: false,
          source: 'health_sync',
        });
      }
      return { id: logId };
    }),
});
