import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  accessibilityTiers,
  activeMetrics,
  addDays,
  bloodMetricIds,
  buildBodyPhysiologyReport,
  buildProgram,
  calculationReport,
  challengeProgress,
  COMPETITIVE_CHALLENGE_METRICS,
  currentAdaptivePlans,
  datedProgram,
  doseKey,
  evaluate,
  evaluateWearableReadiness,
  EVIDENCE_REGISTER,
  getPairwiseCorrelation,
  MAX_PINNED_GOALS,
  metricCalibration,
  metrics,
  overallChangeForSave,
  overallPerformance,
  performanceGamePercent,
  pillars,
  recordedCoverage,
  scenarioResult,
  scoringEligibility,
  selectNextSessionDecision,
  simulate,
  valid,
  vo2CohortComparison,
  type AdaptiveConfig,
  type MeasurementDetails,
  type MeasurementMethod,
  type PersonalWorkspace,
} from '@top1/engine';
import {
  buildSvgMuscleMapFromPhysiology,
  classifyMetricEvidence,
  evaluateBiomarkerZone,
  PERFORMANCE_AREA_META,
  PILLAR_META,
  topPercentToBadge,
} from '@apexlift/shared';
import { metricObservations, personalWorkspaces, users } from '../db/schema.js';
import { generateId } from '../lib/auth.js';
import {
  loadUserTop1Context,
  nextObservationSequence,
  syncUserTop1Standings,
} from '../lib/top1Context.js';
import { protectedProcedure, publicProcedure, router } from '../trpc.js';

const methodEnum = z
  .enum([
    'manual',
    'lab',
    'direct_cpet',
    'cooper_estimate',
    'wearable_estimate',
    'dynamometer_single_hand',
    'dexa',
    'skinfold_estimate',
    'direct_1rm',
    'epley_estimate',
    'device',
  ])
  .optional();

export const top1Router = router({
  getOverview: protectedProcedure.query(async ({ ctx }) => {
    const t1 = await loadUserTop1Context(ctx.db, ctx.user);
    const overall = overallPerformance(t1.values, t1.details, t1.profile);
    const scientific = evaluate(t1.values, t1.profile, t1.details);
    const physiology = buildBodyPhysiologyReport({
      dossier: t1.dossier,
      trainingEvents: t1.trainingEvents,
      upcomingGoalMetricsWithin36h: t1.upcomingGoalMetricsWithin36h,
      wearableHistory: t1.wearableHistory,
      customExercises: t1.customExercises,
    });
    const wearable = evaluateWearableReadiness(t1.wearableHistory, t1.today);
    const plans = currentAdaptivePlans(t1.trainingEvents);
    const activePlan = plans[0] ?? null;
    const cal = activePlan?.config.guidedVersion === 1 ? datedProgram(activePlan) : undefined;
    const nextSession = cal?.weeks
      .flatMap((w) => w.sessions)
      .find((s) => s.date >= t1.today);
    const coachDecision =
      activePlan
        ? selectNextSessionDecision(t1.dossier, {
            plan: activePlan,
            targetDay: nextSession?.date ?? t1.today,
            calendar: cal,
            allPlans: plans,
          })
        : null;

    const badge = topPercentToBadge(overall.overall?.percent ?? null);
    const svgMuscles = buildSvgMuscleMapFromPhysiology(physiology.muscles);

    return {
      today: t1.today,
      badge,
      overall,
      areas: overall.areas.map((a) => ({
        ...a,
        meta: PERFORMANCE_AREA_META[a.area],
        badge: topPercentToBadge(a.points !== null ? 100 * 10 ** -a.points : null),
      })),
      scientific: {
        ready: scientific.ready,
        readinessReason: scientific.readinessReason,
        modelScore: Number(scientific.modelScore.toFixed(1)),
        completeness: Number(scientific.completeness.toFixed(1)),
        coverageTier: scientific.coverageTier,
        scoredCount: scientific.scoredCount,
        pillars: pillars.map((p) => {
          const zVal = scientific.domains[p.id];
          return {
            id: p.id,
            name: p.name,
            weight: p.weight,
            meta: PILLAR_META[p.id],
            score: zVal !== undefined ? Number((50 + 15 * zVal).toFixed(1)) : null,
          };
        }),
        bottlenecks: scientific.bottlenecks.slice(0, 3).map((b) => ({
          metricId: b.metric.id,
          name: b.metric.name,
          modelScore: Number(b.modelScore.toFixed(1)),
          defect: Number(b.defect.toFixed(2)),
        })),
        strengths: scientific.strengths.map((s) => ({
          metricId: s.metric.id,
          name: s.metric.name,
          modelScore: Number(s.modelScore.toFixed(1)),
        })),
      },
      physiology: {
        systemicReadiness: physiology.systemicReadiness,
        overallBodyTier: physiology.overallBodyTier,
        recommendedTargets: physiology.recommendedTargets,
        protectedMuscles: physiology.protectedMuscles,
        structuralBalance: physiology.structuralBalance,
        svgMuscles,
      },
      wearable,
      coachDecision,
      activePlanCount: plans.length,
    };
  }),

  listMetrics: protectedProcedure
    .input(
      z
        .object({
          pillar: z.enum(['all', 'blood', 'bodymarkers', 'strength', 'recovery']).default('all'),
          tier: z
            .enum(['all', 'tier1_everyday', 'tier2_standard', 'tier3_precision'])
            .default('all'),
          includeArchived: z.boolean().default(false),
          query: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const t1 = await loadUserTop1Context(ctx.db, ctx.user);
      const q = input?.query?.trim().toLowerCase() ?? '';
      const bloodSet = new Set<string>(bloodMetricIds);
      const pool = input?.includeArchived ? metrics : activeMetrics;

      const items = pool
        .filter((m) => {
          if (input?.pillar === 'blood') {
            if (!bloodSet.has(m.id)) return false;
          } else if (input?.pillar && input.pillar !== 'all' && m.pillar !== input.pillar) {
            return false;
          }
          if (input?.tier && input.tier !== 'all' && m.tier !== input.tier) return false;
          if (q && !m.name.toLowerCase().includes(q) && !m.id.toLowerCase().includes(q)) {
            return false;
          }
          return true;
        })
        .map((m) => {
          const currentValue = t1.values[m.id];
          const detail = t1.details[m.id];
          const elig = scoringEligibility(m, t1.profile, t1.details);
          const prog = COMPETITIVE_CHALLENGE_METRICS.has(m.id)
            ? challengeProgress(m.id, currentValue, t1.profile)
            : null;
          const historyCount = t1.observations.filter(
            (o) => o.metricId === m.id && !o.cleared && o.value !== null
          ).length;

          return {
            id: m.id,
            name: m.name,
            pillar: m.pillar,
            tier: m.tier,
            unit: m.unit,
            target: m.target,
            polarity: m.polarity,
            min: m.min,
            max: m.max,
            archived: Boolean(m.archived),
            isBlood: bloodSet.has(m.id),
            isCompetitive: COMPETITIVE_CHALLENGE_METRICS.has(m.id),
            currentValue: currentValue ?? null,
            measuredAt: detail?.measuredAt ?? null,
            method: detail?.method ?? null,
            exerciseMode: detail?.exerciseMode ?? null,
            eligibility: elig,
            progress: prog,
            badge: topPercentToBadge(prog?.modelTopPercent ?? null),
            evidence: classifyMetricEvidence(m),
            clinicalZone: evaluateBiomarkerZone(m.id, currentValue),
            calibration: metricCalibration(m),
            historyCount,
            proofData: m.proofData,
            protocol: m.protocol,
          };
        });

      return {
        pillars,
        accessibilityTiers,
        totalActive: activeMetrics.length,
        totalArchived: metrics.length - activeMetrics.length,
        totalBlood: bloodSet.size,
        items,
      };
    }),

  getMetricHistory: protectedProcedure
    .input(z.object({ metricId: z.string() }))
    .query(async ({ ctx, input }) => {
      const t1 = await loadUserTop1Context(ctx.db, ctx.user);
      const metric = metrics.find((m) => m.id === input.metricId);
      if (!metric) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Metric not found' });
      }
      const rows = t1.observations
        .filter((o) => o.metricId === input.metricId && !o.cleared && o.value !== null)
        .reverse();
      return { metric, history: rows };
    }),

  clearObservation: protectedProcedure
    .input(z.object({ metricId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const metric = metrics.find((m) => m.id === input.metricId);
      if (!metric) throw new TRPCError({ code: 'NOT_FOUND', message: 'Metric not found' });
      const seq = await nextObservationSequence(ctx.db, ctx.user.id);
      const now = new Date().toISOString();
      await ctx.db.insert(metricObservations).values({
        id: generateId('obs'),
        userId: ctx.user.id,
        metricId: metric.id,
        value: null,
        unit: metric.unit,
        measuredAt: now,
        recordedAt: now,
        sequence: seq,
        method: 'manual',
        cleared: true,
        source: 'mobile',
      });
      await syncUserTop1Standings(ctx.db, ctx.user);
      return { cleared: true, metricId: metric.id };
    }),

  getScientificAudit: protectedProcedure.query(async ({ ctx }) => {
    const t1 = await loadUserTop1Context(ctx.db, ctx.user);
    const report = calculationReport({
      values: t1.values,
      demographics: t1.profile,
      measurementDetails: t1.details,
    });
    const vo2Cohort = vo2CohortComparison(t1.values, t1.profile, t1.details);
    const coveragePct = Number(recordedCoverage(report.coverage.recorded).toFixed(1));

    const correlationPairs: Array<[string, string, string]> = [
      ['apob', 'lpa', 'Atherogenic lipoprotein stack (ApoB × Lp(a))'],
      ['hrv', 'rhr', 'Autonomic recovery balance (HRV RMSSD × RHR)'],
      ['vo2_max', 'zone2_power', 'Aerobic engine ceiling vs metabolic base'],
      ['deadlift_1rm', 'squat_1rm', 'Lower-body posterior vs quad force balance'],
    ];
    const correlations = correlationPairs.map(([a, b, label]) => ({
      metricA: a,
      metricB: b,
      label,
      r: getPairwiseCorrelation(a, b),
      valueA: t1.values[a] ?? null,
      valueB: t1.values[b] ?? null,
    }));

    // Recommend highest-value unlogged metrics to maximize TOP1% confidence
    const priorityIds = ['vo2_max', 'apob', 'hba1c', 'grip_strength', 'cmj', 'run_5k', 'pullups', 'squat_1rm', 'hrv'];
    const recommendedNextTests = priorityIds
      .filter((id) => t1.values[id] === undefined)
      .slice(0, 4)
      .map((id) => {
        const m = activeMetrics.find((x) => x.id === id)!;
        return {
          id: m.id,
          name: m.name,
          pillar: m.pillar,
          unit: m.unit,
          evidence: classifyMetricEvidence(m),
          why: m.proofData.study,
        };
      });

    return {
      report,
      coveragePct,
      vo2Cohort,
      evidenceRegister: EVIDENCE_REGISTER,
      correlations,
      recommendedNextTests,
    };
  }),

  previewGoalProbability: protectedProcedure
    .input(
      z.object({
        metricId: z.string(),
        goalUnit: z.enum(['metric', 'kg']).default('metric'),
        baseline: z.number(),
        target: z.number(),
        weeks: z.number().int().min(4).max(24),
        daysPerWeek: z.number().int().min(1).max(6),
        minutesPerSession: z.number().int().min(15).max(90).default(40),
      })
    )
    .query(async ({ ctx, input }) => {
      const metric = activeMetrics.find((m) => m.id === input.metricId);
      if (!metric) {
        return { available: false as const, probability: null, low: null, high: null, sessions: 0, required: 0 };
      }
      const t1 = await loadUserTop1Context(ctx.db, ctx.user);
      const deadline = addDays(t1.today, input.weeks * 7);
      const defaultGain = input.goalUnit === 'kg' ? 2.5 : metric.unit === 's' || metric.unit === 'min' ? 4 : 2;
      const isSeconds = metric.unit === 's' || metric.unit === 'min';
      const safeDays = Math.min(3, Math.max(1, input.daysPerWeek)) as 1 | 2 | 3;
      const baseDose = {
        sets: 4,
        amount: isSeconds
          ? Math.max(15, Math.min(180, Math.round(input.baseline * 0.7)))
          : input.goalUnit === 'kg'
            ? 5
            : Math.max(5, Math.min(25, Math.round(input.baseline * 0.55))),
        mode: (isSeconds ? 'seconds' : 'reps') as 'reps' | 'seconds',
        loadKg: input.goalUnit === 'kg' ? Math.max(20, Math.round(input.baseline * 0.75)) : 0,
      };
      const cfg: AdaptiveConfig = {
        metric: metric.id,
        goalUnit: input.goalUnit,
        baseline: input.baseline,
        target: input.target,
        deadline,
        createdAt: new Date().toISOString(),
        days: safeDays,
        minutes: input.minutesPerSession,
        exercise: metric.name,
        dose: baseDose,
        routineId: `sim_${metric.id}`,
        guidedVersion: 1,
        scheduleStart: t1.today,
        exerciseLabels: [metric.name, metric.name, metric.name],
      };
      let prog;
      try {
        prog = buildProgram(cfg, 'UTC');
      } catch {
        return { available: false as const, probability: null, low: null, high: null, sessions: 0, required: 0 };
      }
      const fakePlan = {
        event: {
          id: 'sim',
          entityId: 'sim',
          sequence: 1,
          revision: 1,
          kind: 'program' as const,
          source: 'personal' as const,
          deleted: false,
          data: prog,
          recordedAt: new Date().toISOString(),
        },
        config: {
          ...cfg,
          scenario: {
            response: 70,
            attendance: 85,
            gain: defaultGain,
            dose: doseKey(cfg, baseDose),
          },
        },
        prescription: { ...baseDose, reason: 'progression' as const },
        sessions: [],
        calendarRevisions: [],
      };
      const sc = scenarioResult(fakePlan as unknown as Parameters<typeof scenarioResult>[0], input.baseline, t1.today);
      if (!sc) {
        return { available: false as const, probability: null, low: null, high: null, sessions: 0, required: 0 };
      }
      return {
        available: true as const,
        probability: sc.p,
        low: sc.low,
        high: sc.high,
        sessions: sc.sessions,
        required: sc.required,
        deadline,
      };
    }),

  logObservation: protectedProcedure
    .input(
      z.object({
        metricId: z.string(),
        value: z.number(),
        measuredAt: z.string().optional(),
        method: methodEnum,
        exerciseMode: z.enum(['treadmill', 'cycle']).optional(),
        ageAtMeasurement: z.number().int().min(18).max(120).optional(),
        bodyWeightKg: z.number().min(25).max(350).optional(),
        derivation: z
          .object({
            formula: z.enum([
              'epley_ratio_v1',
              'pullup_ratio_v1',
              'cooper_v1',
              'skinfold_v1',
              'jackson_pollock_male_3site_v1',
              'jackson_pollock_female_3site_v1',
            ]),
            inputs: z.array(z.number()),
            bodyWeightKg: z.number().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const metric = metrics.find((m) => m.id === input.metricId);
      if (!metric) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Unknown metric: ${input.metricId}` });
      }
      if (!valid(metric, input.value)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Value ${input.value} is outside valid bounds (${metric.min}–${metric.max} ${metric.unit}) for ${metric.name}.`,
        });
      }

      const t1 = await loadUserTop1Context(ctx.db, ctx.user);
      const now = new Date().toISOString();
      const measuredAt = input.measuredAt ?? now;
      const defaultMethod: MeasurementMethod =
        input.method ??
        (metric.pillar === 'bodymarkers'
          ? 'lab'
          : metric.pillar === 'recovery'
            ? 'device'
            : ['bench_1rm', 'squat_1rm', 'deadlift_1rm', 'pullup_1rm'].includes(metric.id)
              ? 'direct_1rm'
              : 'manual');

      const detail: MeasurementDetails = {
        method: defaultMethod,
        measuredAt,
        source: 'mobile',
        ageAtMeasurement: input.ageAtMeasurement ?? t1.profile.age,
        exerciseMode: input.exerciseMode,
        derivation: input.derivation as MeasurementDetails['derivation'],
      };

      const saveDelta = overallChangeForSave(
        metric.id,
        input.value,
        detail,
        t1.values,
        t1.details,
        t1.profile,
        t1.profile
      );

      const seq = await nextObservationSequence(ctx.db, ctx.user.id);
      const id = generateId('obs');
      await ctx.db.insert(metricObservations).values({
        id,
        userId: ctx.user.id,
        metricId: metric.id,
        value: Number(input.value.toFixed(3)),
        unit: metric.unit,
        measuredAt,
        recordedAt: now,
        sequence: seq,
        method: defaultMethod,
        exerciseMode: input.exerciseMode ?? null,
        derivationJson: input.derivation ? JSON.stringify(input.derivation) : null,
        ageAtMeasurement: input.ageAtMeasurement ?? t1.profile.age,
        bodyWeightKg: input.bodyWeightKg ?? ctx.user.bodyweightKg,
        cleared: false,
        source: 'mobile',
      });

      // Award XP & credits for logging verified benchmark observation
      const xpGain = saveDelta && (saveDelta.previous === null || saveDelta.current < saveDelta.previous) ? 100 : 40;
      await ctx.db
        .update(users)
        .set({
          experiencePoints: ctx.user.experiencePoints + xpGain,
          credits: ctx.user.credits + 20,
        })
        .where(eq(users.id, ctx.user.id));

      const synced = await syncUserTop1Standings(ctx.db, ctx.user);
      const metricProg = COMPETITIVE_CHALLENGE_METRICS.has(metric.id)
        ? challengeProgress(metric.id, input.value, t1.profile)
        : null;
      const prevBadge = topPercentToBadge(saveDelta?.previous ?? null);
      const nextBadge = topPercentToBadge(saveDelta?.current ?? synced.overall.overall?.percent ?? null);
      const tierImproved =
        saveDelta !== null &&
        (saveDelta.previous === null ||
          (saveDelta.current < saveDelta.previous && prevBadge.topLabel !== nextBadge.topLabel));

      return {
        observationId: id,
        metricId: metric.id,
        metricName: metric.name,
        value: Number(input.value.toFixed(3)),
        unit: metric.unit,
        metricProgress: metricProg,
        overallChange: saveDelta,
        overallBadge: nextBadge,
        scientificModelScore: Number(synced.scientific.modelScore.toFixed(1)),
        tierImproved,
        xpEarned: xpGain,
      };
    }),

  simulateScenario: protectedProcedure
    .input(
      z.object({
        targetScore: z.number().min(10).max(100),
        strategy: z.enum(['Easiest first', 'Cardio focus', 'Strength focus', 'Balanced']),
      })
    )
    .query(async ({ ctx, input }) => {
      const t1 = await loadUserTop1Context(ctx.db, ctx.user);
      const current = evaluate(t1.values, t1.profile, t1.details);
      const sim = simulate(
        t1.values,
        t1.profile,
        input.targetScore,
        input.strategy,
        t1.details,
        { allowPartial: true }
      );
      return {
        currentScore: Number(current.modelScore.toFixed(1)),
        targetScore: input.targetScore,
        strategy: input.strategy,
        steps: sim.steps,
        ceiling: sim.ceiling !== null ? Number(sim.ceiling.toFixed(1)) : null,
        reason: sim.reason,
        points: sim.points.map((p) => ({
          step: p.step,
          modelScore: Number(p.modelScore.toFixed(1)),
          target: p.target,
        })),
        metricTargets: sim.selected.map((s) => ({
          metricId: s.metric.id,
          name: s.metric.name,
          unit: s.metric.unit,
          currentValue: s.value,
          targetValue: Number((sim.targets[s.metric.id] ?? s.value).toFixed(2)),
        })),
      };
    }),

  exploreRank: publicProcedure
    .input(
      z.object({
        metricId: z.string(),
        value: z.number(),
        age: z.number().int().min(18).max(120).default(27),
        sex: z.enum(['male', 'female']).default('male'),
        weightKg: z.number().min(30).max(250).default(78),
      })
    )
    .mutation(({ input }) => {
      const metric = activeMetrics.find((m) => m.id === input.metricId);
      if (!metric || !COMPETITIVE_CHALLENGE_METRICS.has(input.metricId)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not a competitive TOP1% metric' });
      }
      const profile = { age: input.age, sex: input.sex, weight: input.weightKg };
      const percent = performanceGamePercent(input.metricId, input.value, profile);
      const prog = challengeProgress(input.metricId, input.value, profile);
      const badge = topPercentToBadge(percent);
      return {
        metricId: metric.id,
        metricName: metric.name,
        unit: metric.unit,
        value: input.value,
        percent: percent !== null ? Number(percent.toFixed(2)) : null,
        tier: prog?.tier ?? 'Unranked',
        next: prog?.next ?? null,
        badge,
      };
    }),

  getWorkspace: protectedProcedure.query(async ({ ctx }) => {
    const t1 = await loadUserTop1Context(ctx.db, ctx.user);
    return t1.workspace;
  }),

  updateWorkspace: protectedProcedure
    .input(
      z.object({
        experience: z.enum(['new', 'under_year', 'one_to_three', 'over_three']).optional(),
        days: z.number().int().min(1).max(7).optional(),
        minutes: z.number().int().min(10).max(180).optional(),
        equipment: z
          .array(z.enum(['none', 'pullup_bar', 'dumbbells', 'barbell', 'machines', 'outdoor']))
          .optional(),
        limitations: z.string().max(240).optional(),
        style: z.enum(['direct', 'supportive', 'minimal']).optional(),
        pinnedMetrics: z.array(z.string()).max(MAX_PINNED_GOALS).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const t1 = await loadUserTop1Context(ctx.db, ctx.user);
      const nextWs: PersonalWorkspace = {
        ...t1.workspace,
        context: {
          ...t1.workspace.context,
          experience: input.experience ?? t1.workspace.context.experience,
          days: input.days ?? t1.workspace.context.days,
          minutes: input.minutes ?? t1.workspace.context.minutes,
          equipment: input.equipment ?? t1.workspace.context.equipment,
          limitations: input.limitations ?? t1.workspace.context.limitations,
          pinnedMetrics: input.pinnedMetrics ?? t1.workspace.context.pinnedMetrics,
          preferences: {
            ...t1.workspace.context.preferences,
            style: input.style ?? t1.workspace.context.preferences?.style,
          },
        },
      };

      const now = new Date().toISOString();
      await ctx.db
        .insert(personalWorkspaces)
        .values({
          userId: ctx.user.id,
          workspaceJson: JSON.stringify(nextWs),
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: personalWorkspaces.userId,
          set: { workspaceJson: JSON.stringify(nextWs), updatedAt: now },
        });

      return nextWs;
    }),
});
