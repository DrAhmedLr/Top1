import { TRPCError } from '@trpc/server';
import { and, desc, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { updateProfileSchema } from '@apexlift/shared';
import {
  bodyMeasurements,
  exerciseRanks,
  foodLogs,
  goals,
  healthLogs,
  metricObservations,
  presets,
  userInventory,
  users,
  wearableSnapshots,
  workoutPosts,
} from '../db/schema.js';
import { protectedProcedure, publicProcedure, router } from '../trpc.js';
import { serializeUser } from './auth.js';

export const userRouter = router({
  me: protectedProcedure.query(({ ctx }) => {
    return serializeUser(ctx.user);
  }),

  checkUsernameAvailable: publicProcedure
    .input(z.object({ username: z.string().trim().min(3).max(24) }))
    .query(async ({ ctx, input }) => {
      const [found] = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, input.username.toLowerCase()))
        .limit(1);
      return { available: !found };
    }),

  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const updates: Partial<typeof users.$inferInsert> = {
        updatedAt: new Date().toISOString(),
      };
      if (input.displayName !== undefined) updates.displayName = input.displayName;
      if (input.username !== undefined) {
        const nextUsername = input.username.toLowerCase();
        const [taken] = await ctx.db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.username, nextUsername), ne(users.id, ctx.user.id)))
          .limit(1);
        if (taken) {
          throw new TRPCError({ code: 'CONFLICT', message: 'That username is already taken.' });
        }
        updates.username = nextUsername;
      }
      if (input.bio !== undefined) updates.bio = input.bio;
      if (input.rankingSex !== undefined) updates.rankingSex = input.rankingSex;
      if (input.age !== undefined) updates.age = input.age;
      if (input.heightCm !== undefined) updates.heightCm = input.heightCm;
      if (input.bodyweightKg !== undefined) updates.bodyweightKg = input.bodyweightKg;
      if (input.unitWeight !== undefined) updates.unitWeight = input.unitWeight;
      if (input.unitMeasure !== undefined) updates.unitMeasure = input.unitMeasure;
      if (input.themeId !== undefined) updates.themeId = input.themeId;
      if (input.language !== undefined) updates.language = input.language;
      if (input.timeZone !== undefined) updates.timeZone = input.timeZone;
      if (input.weeklyWorkoutGoal !== undefined) updates.weeklyWorkoutGoal = input.weeklyWorkoutGoal;
      if (input.avatarConfig !== undefined) {
        updates.avatarConfigJson = JSON.stringify(input.avatarConfig);
      }

      await ctx.db.update(users).set(updates).where(eq(users.id, ctx.user.id));
      const [updated] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      return serializeUser(updated);
    }),

  exportData: protectedProcedure.query(async ({ ctx }) => {
    const uid = ctx.user.id;
    const [
      posts,
      userPresets,
      ranks,
      observations,
      measurements,
      nutritionLogs,
      dailyHealth,
      wearables,
      userGoals,
      inventory,
    ] = await Promise.all([
      ctx.db.select().from(workoutPosts).where(eq(workoutPosts.userId, uid)).orderBy(desc(workoutPosts.completedAt)),
      ctx.db.select().from(presets).where(eq(presets.userId, uid)),
      ctx.db.select().from(exerciseRanks).where(eq(exerciseRanks.userId, uid)),
      ctx.db.select().from(metricObservations).where(eq(metricObservations.userId, uid)),
      ctx.db.select().from(bodyMeasurements).where(eq(bodyMeasurements.userId, uid)),
      ctx.db.select().from(foodLogs).where(eq(foodLogs.userId, uid)),
      ctx.db.select().from(healthLogs).where(eq(healthLogs.userId, uid)),
      ctx.db.select().from(wearableSnapshots).where(eq(wearableSnapshots.userId, uid)),
      ctx.db.select().from(goals).where(eq(goals.userId, uid)),
      ctx.db.select().from(userInventory).where(eq(userInventory.userId, uid)),
    ]);

    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      platform: 'TOP1%',
      profile: serializeUser(ctx.user),
      workoutPosts: posts,
      presets: userPresets,
      exerciseRanks: ranks,
      metricObservations: observations,
      bodyMeasurements: measurements,
      foodLogs: nutritionLogs,
      healthLogs: dailyHealth,
      wearableSnapshots: wearables,
      goals: userGoals,
      inventory,
    };
  }),
});
