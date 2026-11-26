import crypto from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  activeMetrics,
  addDays,
  buildProgram,
  currentAdaptivePlans,
  datedProgram,
  doseKey,
  goalValue,
  MAX_PINNED_GOALS,
  optimizePersonalPhysiology,
  optimizePersonalPolicy,
  personalForecast,
  portfolioMaintenanceSummary,
  programFamilies,
  replayGoalAttempts,
  scenarioResult,
  selectNextSessionDecision,
  type AdaptiveConfig,
  type DiscomfortReport,
  type EquipmentOption,
  type PersonalWorkspace,
} from '@top1/engine';
import { coachDecisions, personalWorkspaces, trainingLedgerEvents } from '../db/schema.js';
import { generateId } from '../lib/auth.js';
import { loadUserTop1Context, nextLedgerSequence } from '../lib/top1Context.js';
import { protectedProcedure, router } from '../trpc.js';

const equipmentSchema = z.enum(['none', 'pullup_bar', 'dumbbells', 'barbell', 'machines', 'outdoor']);
const discomfortSchema = z.object({
  severity: z.enum(['none', 'mild', 'concerning']),
  area: z.string().max(80).optional(),
});

export const coachRouter = router({
  getTodayDecision: protectedProcedure
    .input(
      z
        .object({
          planId: z.string().optional(),
          availableMinutes: z.number().int().min(5).max(180).optional(),
          equipment: z.array(equipmentSchema).optional(),
          discomfort: discomfortSchema.optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const t1 = await loadUserTop1Context(ctx.db, ctx.user);
      const plans = currentAdaptivePlans(t1.trainingEvents);
      if (!plans.length) {
        return { hasPlan: false as const, decision: null, policy: optimizePersonalPolicy(t1.dossier, t1.trainingEvents) };
      }

      const plan = (input?.planId ? plans.find((p) => p.event.id === input.planId) : undefined) ?? plans[0];
      const cal = plan.config.guidedVersion === 1 ? datedProgram(plan) : undefined;
      const nextSession = cal?.weeks.flatMap((w) => w.sessions).find((s) => s.date >= t1.today);
      const targetDay = nextSession?.date ?? t1.today;

      // Apply optional transient "today" constraint override for instant what-if coaching
      let dossier = t1.dossier;
      if (input?.availableMinutes || input?.equipment || input?.discomfort) {
        const nowIso = new Date().toISOString();
        const override = {
          date: targetDay,
          minutes: input.availableMinutes,
          equipment: input.equipment as EquipmentOption[] | undefined,
          discomfort: input.discomfort as DiscomfortReport | undefined,
          expiresOn: addDays(targetDay, 1),
          recordedAt: nowIso,
        };
        const prev = dossier.effectiveAvailability;
        dossier = {
          ...dossier,
          effectiveAvailability: (day: string, planMinutes?: number) => {
            const base = prev(day, planMinutes);
            if (day !== targetDay) return base;
            return {
              ...base,
              minutes:
                input.availableMinutes !== undefined
                  ? { value: input.availableMinutes, source: 'declared', observedAt: nowIso, scope: 'today', expiresOn: override.expiresOn }
                  : base.minutes,
              equipment:
                input.equipment !== undefined
                  ? { value: input.equipment as EquipmentOption[], source: 'declared', observedAt: nowIso, scope: 'today', expiresOn: override.expiresOn }
                  : base.equipment,
              discomfort:
                input.discomfort !== undefined
                  ? { value: input.discomfort as DiscomfortReport, source: 'declared', observedAt: nowIso, scope: 'today', expiresOn: override.expiresOn }
                  : base.discomfort,
              overrideApplied: override,
            };
          },
        };
      }

      const decision = selectNextSessionDecision(dossier, {
        plan,
        targetDay,
        calendar: cal,
        allPlans: plans,
      });

      const policy = optimizePersonalPolicy(t1.dossier, t1.trainingEvents);
      return {
        hasPlan: true as const,
        targetDay,
        planId: plan.event.id,
        metric: plan.config.metric,
        decision,
        policy,
      };
    }),

  acceptDecision: protectedProcedure
    .input(
      z.object({
        planId: z.string(),
        targetDay: z.string(),
        action: z.enum(['keep', 'shorten', 'substitute', 'move', 'rest', 'retest']),
        reasonCode: z.string(),
        decisionJson: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date().toISOString();
      const id = generateId('dec');
      await ctx.db.insert(coachDecisions).values({
        id,
        userId: ctx.user.id,
        planId: input.planId,
        targetDay: input.targetDay,
        action: input.action,
        reasonCode: input.reasonCode,
        decisionJson: input.decisionJson,
        acceptedAt: now,
        undoneAt: null,
        createdAt: now,
      });
      return { id, acceptedAt: now };
    }),

  undoDecision: protectedProcedure
    .input(z.object({ decisionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date().toISOString();
      await ctx.db
        .update(coachDecisions)
        .set({ undoneAt: now })
        .where(and(eq(coachDecisions.id, input.decisionId), eq(coachDecisions.userId, ctx.user.id)));
      return { ok: true, undoneAt: now };
    }),

  listPrograms: protectedProcedure.query(async ({ ctx }) => {
    const t1 = await loadUserTop1Context(ctx.db, ctx.user);
    const plans = currentAdaptivePlans(t1.trainingEvents);
    const attempts = replayGoalAttempts(t1.trainingEvents, t1.observations, Date.now());
    const maintenance = portfolioMaintenanceSummary({
      plans,
      attempts,
      dossier: t1.dossier,
      today: t1.today,
    });

    return {
      today: t1.today,
      programs: plans.map((plan) => {
        const metric = activeMetrics.find((m) => m.id === plan.config.metric);
        const currentVal =
          metric !== undefined
            ? goalValue(
                metric,
                plan.config.goalUnit,
                t1.values[metric.id],
                t1.details[metric.id]
              ) ?? plan.config.baseline
            : plan.config.baseline;
        const calendar = plan.config.guidedVersion === 1 ? datedProgram(plan) : null;
        const rawForecast = personalForecast(plan, t1.observations, currentVal, t1.today);
        const defaultGain =
          plan.config.goalUnit === 'kg'
            ? 2.5
            : metric?.unit === 's' || metric?.unit === 'min'
              ? 4
              : 2;
        const planWithScenario = plan.config.scenario
          ? plan
          : {
              ...plan,
              config: {
                ...plan.config,
                scenario: {
                  response: 70,
                  attendance: 85,
                  gain: defaultGain,
                  dose: doseKey(plan.config, plan.prescription),
                },
              },
            };
        const sc = scenarioResult(planWithScenario, currentVal, t1.today);
        const forecast =
          rawForecast.kind === 'ready'
            ? rawForecast
            : sc
              ? ({
                  kind: 'ready' as const,
                  probability: sc.p,
                  low: sc.low,
                  high: sc.high,
                  sessionsRemaining: sc.sessions,
                  gainsRequired: sc.required,
                  source: 'scenario' as const,
                })
              : rawForecast;
        const maint = maintenance.maintenancePlans.find((m) => m.planId === plan.event.id) ?? null;

        return {
          planId: plan.event.id,
          metric: plan.config.metric,
          metricName: metric?.name ?? plan.config.metric,
          unit: plan.config.goalUnit === 'kg' ? 'kg' : metric?.unit ?? '',
          goalUnit: plan.config.goalUnit,
          baseline: plan.config.baseline,
          current: currentVal,
          target: plan.config.target,
          deadline: plan.config.deadline,
          daysPerWeek: plan.config.days,
          minutesPerSession: plan.config.minutes,
          exercise: plan.config.exercise,
          prescription: plan.prescription,
          forecast,
          calendar,
          maintenance: maint,
        };
      }),
      maintenanceSummary: maintenance,
    };
  }),

  createGoalProgram: protectedProcedure
    .input(
      z.object({
        metricId: z.string(),
        goalUnit: z.enum(['metric', 'kg']).default('metric'),
        baseline: z.number(),
        target: z.number(),
        weeks: z.number().int().min(4).max(24).default(8),
        daysPerWeek: z.number().int().min(1).max(3).default(3),
        minutesPerSession: z.number().int().min(15).max(90).default(40),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const metric = activeMetrics.find((m) => m.id === input.metricId);
      if (!metric || metric.pillar !== 'strength') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Adaptive goal programs support Strength & Fitness benchmark metrics.',
        });
      }
      if ((input.target - input.baseline) * metric.polarity <= 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Target must improve upon your current baseline.',
        });
      }

      const t1 = await loadUserTop1Context(ctx.db, ctx.user);
      const existingPlans = currentAdaptivePlans(t1.trainingEvents);
      const sharedGroupId = existingPlans[0]?.config.groupId ?? crypto.randomUUID();
      const now = new Date().toISOString();
      const deadline = addDays(t1.today, input.weeks * 7);
      const isGuided = Object.hasOwn(programFamilies, metric.id);
      const isSeconds = metric.unit === 's' || metric.unit === 'min';
      const baseSets = 4;
      const baseAmount = isSeconds
        ? Math.min(180, Math.max(20, Math.round(input.baseline * 0.75)))
        : ['bench_1rm', 'squat_1rm', 'deadlift_1rm', 'pullup_1rm'].includes(metric.id)
          ? 5
          : Math.max(4, Math.round(input.baseline * 0.65));
      const baseLoadKg =
        input.goalUnit === 'kg'
          ? Math.max(20, Math.round((input.baseline * 0.78) / 2.5) * 2.5)
          : 0;

      const config: AdaptiveConfig = {
        metric: metric.id,
        goalUnit: input.goalUnit,
        baseline: input.baseline,
        target: input.target,
        deadline,
        createdAt: now,
        days: input.daysPerWeek,
        minutes: input.minutesPerSession,
        exercise: metric.name,
        dose: {
          sets: baseSets,
          amount: baseAmount,
          mode: isSeconds ? 'seconds' : 'reps',
          loadKg: baseLoadKg,
        },
        routineId: `rtn_${metric.id}_${Date.now()}`,
        bodyWeightKg: ctx.user.bodyweightKg,
        groupId: sharedGroupId,
        ...(isGuided
          ? {
              guidedVersion: 1 as const,
              scheduleStart: t1.today,
              exerciseLabels: [metric.name, metric.name, metric.name] as [string, string, string],
            }
          : {}),
      };

      const program = buildProgram(config, t1.timeZone);
      const entityId = crypto.randomUUID();
      const seq = await nextLedgerSequence(ctx.db, ctx.user.id);
      await ctx.db.insert(trainingLedgerEvents).values({
        id: generateId('tle'),
        userId: ctx.user.id,
        entityId,
        sequence: seq,
        revision: 1,
        kind: 'program',
        source: 'personal',
        deleted: false,
        dataJson: JSON.stringify(program),
        recordedAt: now,
      });

      // Pin metric in workspace respecting Top1.Fit MAX_PINNED_GOALS (2)
      const nextPinned = [
        ...new Set([metric.id, ...(t1.workspace.context.pinnedMetrics ?? [])]),
      ].slice(0, MAX_PINNED_GOALS);
      const nextWs: PersonalWorkspace = {
        ...t1.workspace,
        context: { ...t1.workspace.context, pinnedMetrics: nextPinned },
      };
      await ctx.db
        .insert(personalWorkspaces)
        .values({ userId: ctx.user.id, workspaceJson: JSON.stringify(nextWs), updatedAt: now })
        .onConflictDoUpdate({
          target: personalWorkspaces.userId,
          set: { workspaceJson: JSON.stringify(nextWs), updatedAt: now },
        });

      return { planId: entityId, metricId: metric.id, deadline };
    }),

  getSelfOptimization: protectedProcedure.query(async ({ ctx }) => {
    const t1 = await loadUserTop1Context(ctx.db, ctx.user);
    const policy = optimizePersonalPolicy(t1.dossier, t1.trainingEvents);
    const physiology = optimizePersonalPhysiology(
      t1.dossier,
      t1.trainingEvents,
      t1.customExercises
    );
    return { policy, physiology };
  }),
});
