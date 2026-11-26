import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { scheduleRules, workoutPlans } from '../db/schema.js';
import { generateId } from '../lib/auth.js';
import { protectedProcedure, router } from '../trpc.js';

const WEEKDAY_DEFAULTS = [
  { weekday: 0, title: 'Rest & Recovery', isRestDay: true },
  { weekday: 1, title: 'Heavy Push Day', isRestDay: false },
  { weekday: 2, title: 'Back & Biceps Pull', isRestDay: false },
  { weekday: 3, title: 'Active Recovery', isRestDay: true },
  { weekday: 4, title: 'Lower Strength & Hypertrophy', isRestDay: false },
  { weekday: 5, title: 'Upper Power Mix', isRestDay: false },
  { weekday: 6, title: 'Rest Day', isRestDay: true },
];

export const workoutScheduleRouter = router({
  getSchedule: protectedProcedure.query(async ({ ctx }) => {
    const existing = await ctx.db
      .select()
      .from(scheduleRules)
      .where(eq(scheduleRules.userId, ctx.user.id))
      .orderBy(asc(scheduleRules.weekday));

    if (existing.length > 0) return existing;

    const now = new Date().toISOString();
    const created = [];
    for (const d of WEEKDAY_DEFAULTS) {
      const id = generateId('sch');
      const row = {
        id,
        userId: ctx.user.id,
        weekday: d.weekday,
        presetId: null,
        title: d.title,
        isRestDay: d.isRestDay,
        updatedAt: now,
      };
      await ctx.db.insert(scheduleRules).values(row);
      created.push(row);
    }
    return created;
  }),

  updateRule: protectedProcedure
    .input(
      z.object({
        weekday: z.number().int().min(0).max(6),
        title: z.string().trim().min(1).max(60),
        presetId: z.string().nullable().optional(),
        isRestDay: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date().toISOString();
      const [existing] = await ctx.db
        .select()
        .from(scheduleRules)
        .where(
          and(
            eq(scheduleRules.userId, ctx.user.id),
            eq(scheduleRules.weekday, input.weekday)
          )
        )
        .limit(1);

      if (existing) {
        await ctx.db
          .update(scheduleRules)
          .set({
            title: input.title,
            presetId: input.presetId ?? null,
            isRestDay: input.isRestDay,
            updatedAt: now,
          })
          .where(eq(scheduleRules.id, existing.id));
        return { id: existing.id };
      }

      const id = generateId('sch');
      await ctx.db.insert(scheduleRules).values({
        id,
        userId: ctx.user.id,
        weekday: input.weekday,
        presetId: input.presetId ?? null,
        title: input.title,
        isRestDay: input.isRestDay,
        updatedAt: now,
      });
      return { id };
    }),

  listPlans: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(workoutPlans)
      .where(eq(workoutPlans.userId, ctx.user.id));

    return rows.map((r) => ({
      ...r,
      split: JSON.parse(r.splitJson || '[]') as Array<{ day: string; focus: string }>,
    }));
  }),

  startPlan: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(60),
        goal: z.string().default('build_muscle'),
        daysPerWeek: z.number().int().min(2).max(6),
        durationWeeks: z.number().int().min(4).max(16).default(8),
        split: z.array(z.object({ day: z.string(), focus: z.string() })),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(workoutPlans)
        .set({ isActive: false })
        .where(eq(workoutPlans.userId, ctx.user.id));

      const id = generateId('pln');
      await ctx.db.insert(workoutPlans).values({
        id,
        userId: ctx.user.id,
        name: input.name,
        goal: input.goal,
        daysPerWeek: input.daysPerWeek,
        durationWeeks: input.durationWeeks,
        currentWeek: 1,
        isActive: true,
        splitJson: JSON.stringify(input.split),
        createdAt: new Date().toISOString(),
      });
      return { id };
    }),
});
