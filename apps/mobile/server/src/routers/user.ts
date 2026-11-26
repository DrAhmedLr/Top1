import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { updateProfileSchema } from '@apexlift/shared';
import { users } from '../db/schema.js';
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
      if (input.username !== undefined) updates.username = input.username.toLowerCase();
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
});
