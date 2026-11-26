import { z } from 'zod';

export const rankingSexSchema = z.enum(['Male', 'Female']);
export const weightUnitSchema = z.enum(['lbs', 'kg']);
export const measureUnitSchema = z.enum(['in', 'cm']);

export const avatarConfigSchema = z.object({
  skinTone: z.string().default('#F1C27D'),
  hairStyle: z.enum(['short', 'buzz', 'wavy', 'long', 'bald', 'fade']).default('short'),
  hairColor: z.string().default('#1F1A17'),
  outfitColor: z.string().default('#59B9F9'),
  accessory: z.enum(['none', 'headband', 'glasses', 'cap', 'headphones']).default('none'),
  backgroundColor: z.string().default('#1A1524'),
});

export type AvatarConfig = z.infer<typeof avatarConfigSchema>;

export const signUpInputSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(24, 'Username must be at most 24 characters')
    .regex(/^[a-z0-9_.]+$/, 'Use lowercase letters, numbers, underscores, or periods'),
  displayName: z.string().trim().min(1, 'Name is required').max(40),
  rankingSex: rankingSexSchema.default('Male'),
  age: z.number().int().min(13).max(100).default(24),
  heightCm: z.number().min(100).max(250).default(178),
  bodyweightKg: z.number().min(35).max(250).default(78),
  unitWeight: weightUnitSchema.default('lbs'),
  unitMeasure: measureUnitSchema.default('in'),
  fitnessGoal: z
    .enum(['build_muscle', 'get_stronger', 'lose_fat', 'athletic'])
    .default('build_muscle'),
  experienceLevel: z
    .enum(['beginner', 'intermediate', 'advanced'])
    .default('intermediate'),
  weeklyWorkoutGoal: z.number().int().min(1).max(7).default(4),
  avatarConfig: avatarConfigSchema.optional(),
  onboardingBenchmarks: z
    .array(
      z.object({
        exerciseId: z.string(),
        weightKg: z.number().positive(),
        reps: z.number().int().min(1).max(30),
      })
    )
    .optional(),
});

export const signInInputSchema = z.object({
  identifier: z.string().trim().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const resetPasswordRequestSchema = z.object({
  email: z.string().trim().email(),
});

export const confirmResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_.]+$/)
    .optional(),
  bio: z.string().max(160).optional(),
  rankingSex: rankingSexSchema.optional(),
  age: z.number().int().min(13).max(100).optional(),
  heightCm: z.number().min(100).max(250).optional(),
  bodyweightKg: z.number().min(35).max(250).optional(),
  unitWeight: weightUnitSchema.optional(),
  unitMeasure: measureUnitSchema.optional(),
  themeId: z.string().optional(),
  language: z.enum(['en', 'fr', 'ar']).optional(),
  timeZone: z.string().max(64).optional(),
  weeklyWorkoutGoal: z.number().int().min(1).max(7).optional(),
  avatarConfig: avatarConfigSchema.optional(),
});

export const calculatePreviewInputSchema = z.object({
  exerciseId: z.string(),
  weightKg: z.number().min(0).max(1000),
  reps: z.number().int().min(1).max(30),
  bodyweightKg: z.number().min(35).max(250),
  sex: rankingSexSchema,
});
