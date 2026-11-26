'use client';

import { useMemo, useState } from 'react';
import { activeMetrics, pillars, accessibilityTiers, type PillarId } from '@/lib/registry';
import { performanceAreas, type PerformanceArea } from '@/lib/overallPerformance';
import { COMPETITIVE_CHALLENGE_METRICS } from '@/lib/competitiveMetrics';
import { ALL_MUSCLES, MUSCLE_META } from '@/lib/exerciseOntology';
import s from './page.module.css';

export type BackendSummaryData = {
  profiles: number;
  metricLogs: number;
  trainingEvents: number;
  personalWorkspaces: number;
  wearableSnapshots: number;
  nutritionLogs: number;
  customExercises: number;
  workoutPosts: number;
  workoutPresets: number;
  featureRequests: number;
} | null;

const AREA_BY_METRIC = new Map<string, PerformanceArea>();
for (const [area, ids] of Object.entries(performanceAreas) as Array<[PerformanceArea, readonly string[]]>) {
  for (const id of ids) AREA_BY_METRIC.set(id, area);
}

const API_ROUTES = [
  { route: '/api/profile', purpose: 'Authenticated profile, demographics & metric_logs observations' },
  { route: '/api/personal-workspace', purpose: 'Athlete dossier constraints, equipment, weekday slots & pinned goals' },
  { route: '/api/training', purpose: 'Append-only training ledger (adaptive programs & completed workouts)' },
  { route: '/api/coach/decision', purpose: 'Deterministic Coach Decision Engine (keep/shorten/substitute/move/rest/retest)' },
  { route: '/api/intelligence/body-map', purpose: '19-muscle physiology report (capability, recovery %, MEV/MAV/MRV, balance)' },
  { route: '/api/intelligence/generate-workout', purpose: 'Recovery-aware, goal-protecting, time-budgeted workout generator' },
  { route: '/api/intelligence/wearable-sync', purpose: 'Rolling 28-day smartwatch HRV RMSSD, RHR, sleep debt & ACWR readiness' },
  { route: '/api/nutrition', purpose: 'Daily macro logs, barcode food lookup & targets' },
  { route: '/api/cosmetics', purpose: 'Profile borders, card themes, quests & athlete cosmetics' },
  { route: '/api/mobile/overview', purpose: 'Unified mobile hydration (profile, overall Top %, 3-pillar score, coach, body-map, gamification)' },
  { route: '/api/mobile/posts', purpose: 'Social workout posts feed, live logging, edit past workout & auto-sync to training_events' },
  { route: '/api/mobile/presets', purpose: 'Workout folders & presets CRUD for mobile gym tracker' },
  { route: '/api/mobile/social', purpose: 'Reactions, comments, friend links & community feature requests' },
  { route: '/api/mobile/gamification', purpose: 'XP, credits, streaks, daily deals shop rerolls & Strava connection state' },
  { route: '/api/cron/self-optimize', purpose: 'Weekly Sunday 03:00 UTC held-out Brier score population self-optimization' },
  { route: '/share/[username] & /api/og', purpose: 'Public shareable TOP1% profile pages & dynamic OpenGraph cards' },
];

export default function BackendInspector({ summary }: { summary: BackendSummaryData }) {
  const [pillarFilter, setPillarFilter] = useState<'all' | PillarId>('all');
  const [query, setQuery] = useState('');

  const filteredMetrics = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeMetrics
      .filter((m) => {
        if (pillarFilter !== 'all' && m.pillar !== pillarFilter) return false;
        if (q && !m.name.toLowerCase().includes(q) && !m.id.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => a.pillar.localeCompare(b.pillar) || a.name.localeCompare(b.name));
  }, [pillarFilter, query]);

  return (
    <>
      {/* 1. Live Supabase Database Table Counts */}
      <section className={s.panel}>
        <div className={s.panelHeading}>
          <div>
            <h2>Live Supabase Database Telemetry</h2>
            <p>
              Real-time row counts across Top1.Fit&apos;s Postgres RLS tables (queried via security-definer{' '}
              <code>admin_backend_summary()</code>).
            </p>
          </div>
          <span className={summary ? s.on : s.off}>
            {summary ? 'Migration Live' : 'Pending SQL Migration'}
          </span>
        </div>

        {summary ? (
          <div className={s.stats}>
            <div>
              <h2>Athlete Profiles</h2>
              <strong>{summary.profiles.toLocaleString()}</strong>
              <p>Registered accounts with active RLS</p>
            </div>
            <div>
              <h2>Metric Observations</h2>
              <strong>{summary.metricLogs.toLocaleString()}</strong>
              <p>{summary.wearableSnapshots.toLocaleString()} wearable daily snapshots</p>
            </div>
            <div>
              <h2>Training &amp; Gym Activity</h2>
              <strong>{(summary.trainingEvents + summary.workoutPosts).toLocaleString()}</strong>
              <p>
                {summary.trainingEvents.toLocaleString()} ledger events ·{' '}
                {summary.workoutPosts.toLocaleString()} social posts ·{' '}
                {summary.workoutPresets.toLocaleString()} presets
              </p>
            </div>
            <div>
              <h2>Adaptive Workspaces</h2>
              <strong>{summary.personalWorkspaces.toLocaleString()}</strong>
              <p>Pinned goals, equipment &amp; coaching rules</p>
            </div>
            <div>
              <h2>Nutrition &amp; Custom Exercises</h2>
              <strong>{(summary.nutritionLogs + summary.customExercises).toLocaleString()}</strong>
              <p>
                {summary.nutritionLogs.toLocaleString()} food logs ·{' '}
                {summary.customExercises.toLocaleString()} custom exercises
              </p>
            </div>
            <div>
              <h2>Feature Requests</h2>
              <strong>{summary.featureRequests.toLocaleString()}</strong>
              <p>Community-submitted mobile/web requests</p>
            </div>
          </div>
        ) : (
          <p className={s.footnote}>
            Apply migration <code>20261126000000_unified_mobile_social_gym.sql</code> to your live Supabase database to enable real-time table counts here. All metric definitions and physiology constants below are live from the codebase.
          </p>
        )}
      </section>

      {/* 2. Complete 36-Metric Scientific Dictionary */}
      <section className={s.panel}>
        <div className={s.panelHeading}>
          <div>
            <h2>Complete Metric Dictionary ({activeMetrics.length} Active Metrics)</h2>
            <p>
              Exact representation of every metric stored in <code>metric_logs</code>: pillar weight, accessibility tier,
              scoring math (<code>linear</code> / <code>skewed LMS</code> / <code>bounded</code>), valid bounds, competitive
              TOP1% area, and clinical study source.
            </p>
          </div>
          <div className={s.search}>
            <label>
              <span>Filter</span>
              <input
                type="search"
                placeholder="vo2, bench, sleep..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              aria-label="Filter by pillar"
              value={pillarFilter}
              onChange={(e) => setPillarFilter(e.target.value as 'all' | PillarId)}
              style={{ height: 38, borderRadius: 8, border: '1px solid #bac6d1', padding: '0 10px' }}
            >
              <option value="all">All 3 pillars</option>
              {pillars.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({Math.round(p.weight * 100)}%)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={s.tableWrap}>
          <table>
            <thead>
              <tr>
                <th scope="col">Metric &amp; ID</th>
                <th scope="col">Pillar &amp; Tier</th>
                <th scope="col">Unit &amp; Valid Range</th>
                <th scope="col">Scoring Math</th>
                <th scope="col">TOP1% Area</th>
                <th scope="col">Study / Protocol</th>
              </tr>
            </thead>
            <tbody>
              {filteredMetrics.map((m) => {
                const area = AREA_BY_METRIC.get(m.id);
                const tierLabel = accessibilityTiers.find((t) => t.id === m.tier)?.name ?? m.tier;
                return (
                  <tr key={m.id}>
                    <th scope="row">
                      {m.name}
                      <small>
                        <code>{m.id}</code> · {m.scoringEligible ? 'Model-scored' : 'Tracking-only'}
                      </small>
                    </th>
                    <td>
                      {m.pillar}
                      <small>{tierLabel}</small>
                    </td>
                    <td>
                      {m.unit}
                      <small>
                        {m.min} – {m.max} ({m.polarity === 1 ? 'higher ↑' : 'lower ↓'})
                      </small>
                    </td>
                    <td>
                      <code>{m.scoringType}</code>
                      <small>
                        μ={m.mean}, σ={m.sd}
                      </small>
                    </td>
                    <td>
                      {COMPETITIVE_CHALLENGE_METRICS.has(m.id) ? (
                        <span className={s.on}>{area ?? 'competitive'}</span>
                      ) : (
                        <span className={s.off}>pillar only</span>
                      )}
                    </td>
                    <td>
                      {m.proofData.study}
                      <small>{m.target}</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. 19-Muscle Physiology & Volume Landmarks Dictionary */}
      <section className={s.panel}>
        <h2>19-Muscle Physiology Constants (Recovery τ &amp; MEV / MAV / MRV)</h2>
        <p>
          Base recovery time constants (<code>recoveryTauHours</code>) and weekly effective-set landmarks used by{' '}
          <code>musclePhysiology.ts</code> and the 3-mode mobile SVG Bodygraph before personal age, experience, and
          Empirical Bayes self-optimization scaling.
        </p>
        <div className={s.tableWrap}>
          <table>
            <thead>
              <tr>
                <th scope="col">Muscle (EN / FR / AR)</th>
                <th scope="col">Region</th>
                <th scope="col">Recovery τ (hours)</th>
                <th scope="col">Base MEV</th>
                <th scope="col">Base MAV</th>
                <th scope="col">Base MRV</th>
              </tr>
            </thead>
            <tbody>
              {ALL_MUSCLES.map((id) => {
                const meta = MUSCLE_META[id];
                return (
                  <tr key={id}>
                    <th scope="row">
                      {meta.label[0]}
                      <small>
                        <code>{id}</code> · {meta.label[1]} · {meta.label[2]}
                      </small>
                    </th>
                    <td>{meta.region.replace('_', ' ')}</td>
                    <td>{meta.recoveryTauHours}h</td>
                    <td>{meta.baseLandmarks.mev} sets</td>
                    <td>{meta.baseLandmarks.mav} sets</td>
                    <td>{meta.baseLandmarks.mrv} sets</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Backend API & Cron Reference */}
      <section className={s.panel}>
        <h2>Backend API Endpoints &amp; Scheduled Jobs</h2>
        <p>Every endpoint served by Vercel (<code>https://top1.fit</code>) and consumed by both web and Expo mobile clients.</p>
        <div className={s.tableWrap}>
          <table>
            <thead>
              <tr>
                <th scope="col">Endpoint</th>
                <th scope="col">Responsibility</th>
              </tr>
            </thead>
            <tbody>
              {API_ROUTES.map((item) => (
                <tr key={item.route}>
                  <th scope="row">
                    <code>{item.route}</code>
                  </th>
                  <td style={{ textAlign: 'start' }}>{item.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
