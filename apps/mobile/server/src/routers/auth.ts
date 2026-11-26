import { TRPCError } from '@trpc/server';
import { eq, or } from 'drizzle-orm';
import { z } from 'zod';
import {
  avatarConfigSchema,
  calculateExerciseRank,
  confirmResetPasswordSchema,
  ratingToRank,
  resetPasswordRequestSchema,
  signInInputSchema,
  signUpInputSchema,
  xpToLevel,
} from '@apexlift/shared';
import {
  exerciseRanks,
  exercises,
  macroGoals,
  notificationSettings,
  passwordResetTokens,
  sessions,
  users,
} from '../db/schema.js';
import {
  generateId,
  generateOpaqueToken,
  getRefreshExpiryIso,
  hashPassword,
  hashToken,
  signAccessToken,
  verifyPassword,
} from '../lib/auth.js';
import { protectedProcedure, publicProcedure, router } from '../trpc.js';

export function serializeUser(row: typeof users.$inferSelect) {
  const levelInfo = xpToLevel(row.experiencePoints);
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.displayName,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    avatarConfig: avatarConfigSchema.parse(JSON.parse(row.avatarConfigJson || '{}')),
    rankingSex: row.rankingSex as 'Male' | 'Female',
    age: row.age,
    heightCm: row.heightCm,
    bodyweightKg: row.bodyweightKg,
    unitWeight: row.unitWeight as 'lbs' | 'kg',
    unitMeasure: row.unitMeasure as 'in' | 'cm',
    themeId: row.themeId,
    language: row.language,
    fitnessGoal: row.fitnessGoal,
    experienceLevel: row.experienceLevel,
    experiencePoints: row.experiencePoints,
    level: levelInfo.level,
    levelProgress: levelInfo.progress,
    credits: row.credits,
    streaks: row.streaks,
    longestStreak: row.longestStreak,
    weeklyWorkoutGoal: row.weeklyWorkoutGoal,
    lastWorkoutAt: row.lastWorkoutAt,
    peakAverageRank: row.peakAverageRank,
    peakAverageRating: row.peakAverageRating,
    overallTopPercent: row.overallTopPercent ?? null,
    overallTierLabel: row.overallTierLabel || 'Unranked',
    scientificModelScore: row.scientificModelScore ?? null,
    timeZone: row.timeZone || 'UTC',
    totalWorkouts: row.totalWorkouts,
    totalVolumeKg: row.totalVolumeKg,
    equippedTitleId: row.equippedTitleId,
    equippedBorderId: row.equippedBorderId,
    equippedBannerId: row.equippedBannerId,
    equippedMedalIds: JSON.parse(row.equippedMedalIdsJson || '["","",""]') as string[],
    referralCode: row.referralCode,
    isProDemo: row.isProDemo,
    onboardingCompleted: row.onboardingCompleted,
    createdAt: row.createdAt,
  };
}

export const authRouter = router({
  signUp: publicProcedure.input(signUpInputSchema).mutation(async ({ ctx, input }) => {
    const emailLower = input.email.toLowerCase();
    const usernameLower = input.username.toLowerCase();

    const existing = await ctx.db
      .select({ id: users.id, email: users.email, username: users.username })
      .from(users)
      .where(or(eq(users.email, emailLower), eq(users.username, usernameLower)))
      .limit(1);

    if (existing.length > 0) {
      const conflictField = existing[0].email === emailLower ? 'email' : 'username';
      throw new TRPCError({
        code: 'CONFLICT',
        message: `That ${conflictField} is already registered.`,
      });
    }

    const now = new Date().toISOString();
    const userId = generateId('usr');
    const referralCode = `${usernameLower.slice(0, 6).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;
    const avatarConfig = avatarConfigSchema.parse(input.avatarConfig ?? {});

    // Compute optional onboarding benchmark ranks
    let peakAverageRating = 0;
    let peakAverageRank = 'Unranked';
    const computedBenchmarks: Array<{
      exerciseId: string;
      e1rm: number;
      rating: number;
      tier: string;
      division: number;
    }> = [];

    if (input.onboardingBenchmarks && input.onboardingBenchmarks.length > 0) {
      for (const b of input.onboardingBenchmarks) {
        const [ex] = await ctx.db
          .select()
          .from(exercises)
          .where(eq(exercises.id, b.exerciseId))
          .limit(1);

        const rank = calculateExerciseRank({
          weightKg: b.weightKg,
          reps: b.reps,
          bodyweightKg: input.bodyweightKg,
          sex: input.rankingSex,
          standard: ex
            ? {
                maleBaseFactor: ex.maleBaseFactor,
                femaleBaseFactor: ex.femaleBaseFactor,
                includesBodyweight: ex.includesBodyweight,
              }
            : undefined,
        });

        computedBenchmarks.push({
          exerciseId: b.exerciseId,
          e1rm: rank.estimatedOneRmKg,
          rating: rank.rating,
          tier: rank.tier,
          division: rank.division,
        });
      }

      if (computedBenchmarks.length > 0) {
        const avg = Math.round(
          computedBenchmarks.reduce((acc, r) => acc + r.rating, 0) / computedBenchmarks.length
        );
        peakAverageRating = avg;
        peakAverageRank = ratingToRank(avg).label;
      }
    }

    await ctx.db.insert(users).values({
      id: userId,
      email: emailLower,
      passwordHash: hashPassword(input.password),
      username: usernameLower,
      displayName: input.displayName,
      bio: '',
      avatarUrl: '',
      avatarConfigJson: JSON.stringify(avatarConfig),
      rankingSex: input.rankingSex,
      age: input.age,
      heightCm: input.heightCm,
      bodyweightKg: input.bodyweightKg,
      unitWeight: input.unitWeight,
      unitMeasure: input.unitMeasure,
      themeId: 'theme_dark',
      language: 'en',
      fitnessGoal: input.fitnessGoal,
      experienceLevel: input.experienceLevel,
      experiencePoints: 150, // starter onboarding XP
      credits: 300,
      streaks: 0,
      longestStreak: 0,
      weeklyWorkoutGoal: input.weeklyWorkoutGoal,
      peakAverageRank,
      peakAverageRating,
      referralCode,
      onboardingCompleted: true,
      createdAt: now,
      updatedAt: now,
    });

    // Seed default macro goals & notification settings
    const calGoal =
      input.fitnessGoal === 'lose_fat'
        ? 2000
        : input.fitnessGoal === 'build_muscle'
          ? 2750
          : 2400;
    const proteinGoal = Math.round(input.bodyweightKg * 2.1);
    const fatGoal = Math.round((calGoal * 0.25) / 9);
    const carbsGoal = Math.max(80, Math.round((calGoal - proteinGoal * 4 - fatGoal * 9) / 4));

    await ctx.db.insert(macroGoals).values({
      userId,
      dailyCaloriesGoal: calGoal,
      dailyProteinGoal: proteinGoal,
      dailyCarbsGoal: carbsGoal,
      dailyFatGoal: fatGoal,
      updatedAt: now,
    });

    await ctx.db.insert(notificationSettings).values({
      userId,
      updatedAt: now,
    });

    for (const bench of computedBenchmarks) {
      await ctx.db.insert(exerciseRanks).values({
        id: generateId('rnk'),
        userId,
        exerciseId: bench.exerciseId,
        peakE1rmKg: bench.e1rm,
        peakRating: bench.rating,
        rankTier: bench.tier,
        rankDivision: bench.division,
        achievedAt: now,
        updatedAt: now,
      });
    }

    const sessionId = generateId('ses');
    const refreshToken = generateOpaqueToken(32);
    await ctx.db.insert(sessions).values({
      id: sessionId,
      userId,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: getRefreshExpiryIso(),
      createdAt: now,
    });

    const { accessToken, accessTokenExpiresAt } = signAccessToken(userId, sessionId);
    const [createdUser] = await ctx.db.select().from(users).where(eq(users.id, userId)).limit(1);

    return {
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
      user: serializeUser(createdUser),
    };
  }),

  signIn: publicProcedure.input(signInInputSchema).mutation(async ({ ctx, input }) => {
    const idLower = input.identifier.toLowerCase();
    const [user] = await ctx.db
      .select()
      .from(users)
      .where(or(eq(users.email, idLower), eq(users.username, idLower)))
      .limit(1);

    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid email/username or password.',
      });
    }

    const now = new Date().toISOString();
    const sessionId = generateId('ses');
    const refreshToken = generateOpaqueToken(32);
    await ctx.db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: getRefreshExpiryIso(),
      createdAt: now,
    });

    const { accessToken, accessTokenExpiresAt } = signAccessToken(user.id, sessionId);

    return {
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
      user: serializeUser(user),
    };
  }),

  refreshToken: publicProcedure
    .input(z.object({ refreshToken: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const tokenHash = hashToken(input.refreshToken);
      const [session] = await ctx.db
        .select()
        .from(sessions)
        .where(eq(sessions.refreshTokenHash, tokenHash))
        .limit(1);

      if (!session || session.revokedAt) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Session not found' });
      }
      if (new Date(session.expiresAt).getTime() <= Date.now()) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Refresh token expired' });
      }

      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not found' });
      }

      const { accessToken, accessTokenExpiresAt } = signAccessToken(user.id, session.id);
      return {
        accessToken,
        accessTokenExpiresAt,
      };
    }),

  removeSession: publicProcedure
    .input(z.object({ refreshToken: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const tokenHash = hashToken(input.refreshToken);
      await ctx.db
        .update(sessions)
        .set({ revokedAt: new Date().toISOString() })
        .where(eq(sessions.refreshTokenHash, tokenHash));
      return { ok: true };
    }),

  requestPasswordReset: publicProcedure
    .input(resetPasswordRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const emailLower = input.email.toLowerCase();
      const [user] = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, emailLower))
        .limit(1);

      if (!user) {
        // Return generic success to avoid email enumeration; devResetToken null
        return { ok: true, devResetToken: null as string | null };
      }

      const token = generateOpaqueToken(16);
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await ctx.db.insert(passwordResetTokens).values({
        id: generateId('prt'),
        userId: user.id,
        token,
        expiresAt,
        createdAt: now,
      });

      // Only expose the raw token outside production so local dev/tests can verify the flow without SMTP.
      const allowDevToken = process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1';
      return { ok: true, devResetToken: allowDevToken ? token : (null as string | null) };
    }),

  resetPassword: publicProcedure
    .input(confirmResetPasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const [record] = await ctx.db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.token, input.token))
        .limit(1);

      if (!record || record.usedAt || new Date(record.expiresAt).getTime() <= Date.now()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Reset link is invalid or has expired.',
        });
      }

      const now = new Date().toISOString();
      await ctx.db
        .update(users)
        .set({ passwordHash: hashPassword(input.newPassword), updatedAt: now })
        .where(eq(users.id, record.userId));

      await ctx.db
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(eq(passwordResetTokens.id, record.id));

      // Revoke all existing sessions for this user after a password reset.
      await ctx.db
        .update(sessions)
        .set({ revokedAt: now })
        .where(eq(sessions.userId, record.userId));

      return { ok: true };
    }),

  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.delete(users).where(eq(users.id, ctx.user.id));
    return { ok: true };
  }),
});
