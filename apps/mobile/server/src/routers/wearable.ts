import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  evaluateWearableReadiness,
  normalizeWearableSnapshot,
  type WearableSource,
} from '@top1/engine';
import { healthLogs, metricObservations, wearableSnapshots } from '../db/schema.js';
import { generateId } from '../lib/auth.js';
import { loadUserTop1Context, nextObservationSequence, syncUserTop1Standings } from '../lib/top1Context.js';
import { protectedProcedure, router } from '../trpc.js';

export const wearableRouter = router({
  getReadiness: protectedProcedure.query(async ({ ctx }) => {
    const t1 = await loadUserTop1Context(ctx.db, ctx.user);
    const readiness = evaluateWearableReadiness(t1.wearableHistory, t1.today);
    return {
      today: t1.today,
      readiness,
      snapshots: [...t1.wearableHistory].reverse().slice(0, 28),
    };
  }),

  upsertSnapshot: protectedProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        source: z
          .enum([
            'apple_health',
            'apple_watch',
            'health_connect',
            'google_health',
            'garmin',
            'oura',
            'whoop',
            'polar',
            'coros',
            'fitbit',
          ])
          .default('apple_watch'),
        hrvRmssdMs: z.number().optional(),
        hrvStatistic: z.enum(['rmssd', 'sdnn']).optional(),
        restingHeartRateBpm: z.number().optional(),
        totalSleepMinutes: z.number().optional(),
        sleepEfficiencyPercent: z.number().optional(),
        wristTempDeviationC: z.number().optional(),
        respiratoryRateBpm: z.number().optional(),
        cardioLoadTrimp: z.number().optional(),
        vo2Max: z.number().optional(),
        gpsRun5kMinutes: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let normalized;
      try {
        normalized = normalizeWearableSnapshot(input);
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: err instanceof Error ? err.message : 'Invalid biometric snapshot.',
        });
      }

      const now = new Date().toISOString();
      const [existing] = await ctx.db
        .select()
        .from(wearableSnapshots)
        .where(
          and(
            eq(wearableSnapshots.userId, ctx.user.id),
            eq(wearableSnapshots.dateIso, normalized.date)
          )
        )
        .limit(1);

      if (existing) {
        await ctx.db
          .update(wearableSnapshots)
          .set({
            source: normalized.source as WearableSource,
            hrvRmssdMs: normalized.hrvRmssdMs ?? existing.hrvRmssdMs,
            restingHeartRateBpm: normalized.restingHeartRateBpm ?? existing.restingHeartRateBpm,
            totalSleepMinutes: normalized.totalSleepMinutes ?? existing.totalSleepMinutes,
            sleepEfficiencyPercent: normalized.sleepEfficiencyPercent ?? existing.sleepEfficiencyPercent,
            wristTempDeviationC: normalized.wristTempDeviationC ?? existing.wristTempDeviationC,
            respiratoryRateBpm: normalized.respiratoryRateBpm ?? existing.respiratoryRateBpm,
            cardioLoadTrimp: normalized.cardioLoadTrimp ?? existing.cardioLoadTrimp,
            vo2Max: normalized.vo2Max ?? existing.vo2Max,
            gpsRun5kMinutes: normalized.gpsRun5kMinutes ?? existing.gpsRun5kMinutes,
            updatedAt: now,
          })
          .where(eq(wearableSnapshots.id, existing.id));
      } else {
        await ctx.db.insert(wearableSnapshots).values({
          id: generateId('wbl'),
          userId: ctx.user.id,
          dateIso: normalized.date,
          source: normalized.source,
          hrvRmssdMs: normalized.hrvRmssdMs ?? null,
          restingHeartRateBpm: normalized.restingHeartRateBpm ?? null,
          totalSleepMinutes: normalized.totalSleepMinutes ?? null,
          sleepEfficiencyPercent: normalized.sleepEfficiencyPercent ?? null,
          wristTempDeviationC: normalized.wristTempDeviationC ?? null,
          respiratoryRateBpm: normalized.respiratoryRateBpm ?? null,
          cardioLoadTrimp: normalized.cardioLoadTrimp ?? null,
          vo2Max: normalized.vo2Max ?? null,
          gpsRun5kMinutes: normalized.gpsRun5kMinutes ?? null,
          updatedAt: now,
        });
      }

      // Sync sleep/RHR into Liftoff health_logs & TOP1 metric_observations for seamless cross-pillar updates
      if (normalized.totalSleepMinutes !== undefined || normalized.restingHeartRateBpm !== undefined) {
        const [hl] = await ctx.db
          .select()
          .from(healthLogs)
          .where(and(eq(healthLogs.userId, ctx.user.id), eq(healthLogs.dateIso, normalized.date)))
          .limit(1);
        if (hl) {
          await ctx.db
            .update(healthLogs)
            .set({
              sleepMinutes: normalized.totalSleepMinutes ?? hl.sleepMinutes,
              restingHr:
                normalized.restingHeartRateBpm !== undefined
                  ? Math.round(normalized.restingHeartRateBpm)
                  : hl.restingHr,
              updatedAt: now,
            })
            .where(eq(healthLogs.id, hl.id));
        } else {
          await ctx.db.insert(healthLogs).values({
            id: generateId('hlg'),
            userId: ctx.user.id,
            dateIso: normalized.date,
            steps: 0,
            activeCalories: 0,
            sleepMinutes: normalized.totalSleepMinutes ?? 0,
            waterMl: 0,
            restingHr:
              normalized.restingHeartRateBpm !== undefined
                ? Math.round(normalized.restingHeartRateBpm)
                : null,
            updatedAt: now,
          });
        }
      }

      const syncPairs: Array<[string, number | undefined, string]> = [
        ['total_sleep', normalized.totalSleepMinutes, 'min'],
        ['rhr', normalized.restingHeartRateBpm, 'bpm'],
        ['hrv', normalized.hrvRmssdMs, 'ms'],
      ];
      for (const [metricId, val, unit] of syncPairs) {
        if (val !== undefined) {
          const seq = await nextObservationSequence(ctx.db, ctx.user.id);
          await ctx.db.insert(metricObservations).values({
            id: generateId('obs'),
            userId: ctx.user.id,
            metricId,
            value: val,
            unit,
            measuredAt: `${normalized.date}T08:00:00Z`,
            recordedAt: now,
            sequence: seq,
            method: 'device',
            cleared: false,
            source: normalized.source,
          });
        }
      }

      await syncUserTop1Standings(ctx.db, ctx.user);
      const t1 = await loadUserTop1Context(ctx.db, ctx.user);
      return {
        snapshot: normalized,
        readiness: evaluateWearableReadiness(t1.wearableHistory, t1.today),
      };
    }),
});
