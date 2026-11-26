import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { trpc } from '../../api/trpc';
import {
  AppCard,
  AppText,
  ScreenContainer,
  SegmentedControl,
  StackHeader,
} from '../../components/ui';
import { useLocale } from '../../i18n/LocaleProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';

type Strategy = 'Easiest first' | 'Cardio focus' | 'Strength focus' | 'Balanced';

const STRATEGIES: readonly Strategy[] = [
  'Balanced',
  'Easiest first',
  'Strength focus',
  'Cardio focus',
];

export function RankPredictionScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { l } = useLocale();

  const [tab, setTab] = useState<'simulator' | 'forecast'>('simulator');
  const [strategy, setStrategy] = useState<Strategy>('Balanced');
  const [targetScore, setTargetScore] = useState(78);

  const simQuery = trpc.top1.simulateScenario.useQuery({ targetScore, strategy });
  const programsQuery = trpc.coach.listPrograms.useQuery();

  const sim = simQuery.data;
  const points = sim?.points ?? [];
  const chartW = 300;
  const chartH = 150;
  const padX = 22;
  const padY = 18;
  const minVal = Math.max(0, Math.min(...points.map((p) => p.modelScore), 40) - 5);
  const maxVal = Math.min(100, Math.max(...points.map((p) => p.modelScore), targetScore) + 5);

  const svgPoints = points
    .map((p, idx) => {
      const x = padX + (idx / Math.max(1, points.length - 1)) * (chartW - padX * 2);
      const y =
        chartH - padY - ((p.modelScore - minVal) / Math.max(1, maxVal - minVal)) * (chartH - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <ScreenContainer scroll>
      <StackHeader
        title={l('Forecast & Scenario Simulator', 'Prévision & Simulateur', 'التوقعات ومحاكاة السيناريو')}
        subtitle={l(
          '3-Pillar what-if trajectory + 2,048-path Monte Carlo goal forecasting',
          'Trajectoire 3 piliers + prévisions Monte Carlo (2 048 trajectoires)',
          'مسار 3 ركائز + توقعات مونت كارلو (2048 مساراً)'
        )}
      />

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { label: l('Scenario Simulator', 'Simulateur', 'المحاكاة'), value: 'simulator' },
          { label: l('Monte Carlo Goals', 'Monte Carlo', 'مونت كارلو'), value: 'forecast' },
        ]}
      />

      {tab === 'simulator' ? (
        <View style={{ gap: 12 }}>
          <AppCard style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <AppText size="xxsm" weight="xbold" tone="constant">
                  {l('SCIENTIFIC SCORE PROJECTION', 'PROJECTION SCORE SCIENTIFIQUE', 'توقعات النتيجة العلمية')}
                </AppText>
                <AppText size="xxl" weight="black">
                  {sim ? `${sim.currentScore} → ${targetScore}` : '—'}
                </AppText>
                <AppText size="xsm" tone="sub">
                  {sim?.steps !== null && sim?.steps !== undefined
                    ? `Estimated steps: ${sim.steps} cycles (${strategy})`
                    : sim?.reason === 'unreachable'
                      ? `Ceiling under ${strategy}: ${sim.ceiling}/100`
                      : 'Add 3+ scored metrics to simulate'}
                </AppText>
              </View>
            </View>

            <View style={{ alignItems: 'center', backgroundColor: c.thirdBg, borderRadius: RADII.card, paddingVertical: 10 }}>
              <Svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
                <Line x1={padX} y1={chartH - padY} x2={chartW - padX} y2={chartH - padY} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                <Line x1={padX} y1={padY} x2={chartW - padX} y2={padY} stroke="rgba(255,255,255,0.08)" strokeDasharray="4,4" strokeWidth="1" />
                {svgPoints ? (
                  <Polyline
                    points={svgPoints}
                    fill="none"
                    stroke={c.constant}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
                {points.length > 0 ? (
                  <>
                    <Circle
                      cx={padX}
                      cy={chartH - padY - ((points[0].modelScore - minVal) / Math.max(1, maxVal - minVal)) * (chartH - padY * 2)}
                      r="5"
                      fill={c.text}
                    />
                    <Circle
                      cx={chartW - padX}
                      cy={chartH - padY - ((points[points.length - 1].modelScore - minVal) / Math.max(1, maxVal - minVal)) * (chartH - padY * 2)}
                      r="6"
                      fill={c.check}
                    />
                  </>
                ) : null}
                <SvgText x={padX} y={chartH - 3} fill={c.subText} fontSize="10">
                  Now
                </SvgText>
                <SvgText x={chartW - padX - 42} y={chartH - 3} fill={c.subText} fontSize="10">
                  Target
                </SvgText>
              </Svg>
            </View>

            {/* Target Score Selector */}
            <View style={{ gap: 6 }}>
              <AppText size="xxsm" weight="bold" tone="sub">
                TARGET MODEL SCORE
              </AppText>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[70, 75, 80, 85, 90].map((score) => {
                  const active = targetScore === score;
                  return (
                    <Pressable
                      key={score}
                      onPress={() => setTargetScore(score)}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: RADII.input,
                        alignItems: 'center',
                        backgroundColor: active ? hexToRgba(c.constant, 0.22) : c.thirdBg,
                        borderWidth: 1,
                        borderColor: active ? c.constant : 'transparent',
                      }}
                    >
                      <AppText size="sm" weight="bold" tone={active ? 'constant' : 'default'}>
                        {score}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Strategy Selector */}
            <View style={{ gap: 6 }}>
              <AppText size="xxsm" weight="bold" tone="sub">
                OPTIMIZATION STRATEGY
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {STRATEGIES.map((st) => {
                  const active = strategy === st;
                  return (
                    <Pressable
                      key={st}
                      onPress={() => setStrategy(st)}
                      style={{
                        paddingHorizontal: 11,
                        paddingVertical: 7,
                        borderRadius: RADII.pill,
                        backgroundColor: active ? hexToRgba(c.check, 0.2) : c.thirdBg,
                        borderWidth: 1,
                        borderColor: active ? c.check : 'transparent',
                      }}
                    >
                      <AppText size="xsm" weight="bold" tone={active ? 'check' : 'sub'}>
                        {st}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </AppCard>

          {/* Required Metric Targets */}
          {sim && sim.metricTargets.length > 0 ? (
            <View style={{ gap: 8 }}>
              <AppText size="md" weight="bold">
                Projected Metric Shifts
              </AppText>
              {sim.metricTargets.slice(0, 8).map((mt) => (
                <AppCard
                  key={mt.metricId}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <View>
                    <AppText size="sm" weight="bold">
                      {mt.name}
                    </AppText>
                    <AppText size="xsm" tone="sub">
                      Current: {mt.currentValue} {mt.unit}
                    </AppText>
                  </View>
                  <AppText size="sm" weight="black" tone="check">
                    → {mt.targetValue} {mt.unit}
                  </AppText>
                </AppCard>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {(programsQuery.data?.programs ?? []).map((prog) => (
            <AppCard key={prog.planId} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <AppText size="md" weight="black">
                  {prog.metricName}
                </AppText>
                <AppText size="sm" weight="black" tone="constant">
                  {prog.forecast.kind === 'ready'
                    ? `${Math.round(prog.forecast.probability * 100)}% probability`
                    : 'Calibrating'}
                </AppText>
              </View>
              <AppText size="sm" tone="sub">
                {prog.current} → {prog.target} {prog.unit} by {prog.deadline}
              </AppText>
              {prog.forecast.kind === 'ready' ? (
                <AppText size="xsm" tone="sub">
                  {'completedSessions' in prog.forecast
                    ? `2,048 trajectories • ${prog.forecast.completedSessions} done / ${prog.forecast.remainingSessions} remaining sessions`
                    : `Binomial scenario • ${prog.forecast.sessionsRemaining} sessions remaining (${Math.round(prog.forecast.low * 100)}%–${Math.round(prog.forecast.high * 100)}% band)`}
                </AppText>
              ) : (
                <AppText size="xsm" tone="sub">
                  Complete 2 dated retests with logged guided sessions to unlock personalized Monte Carlo resampling.
                </AppText>
              )}
            </AppCard>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}
