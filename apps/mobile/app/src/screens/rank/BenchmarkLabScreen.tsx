import React, { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Switch, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { PILLAR_META, type RankTier } from '@apexlift/shared';
import { trpc } from '../../api/trpc';
import { RankUpCinematicModal } from '../../components/fx';
import { BodyweightTrackerCard } from '../../components/rank/BodyweightTrackerCard';
import { FieldCalculatorsCard } from '../../components/rank/FieldCalculatorsCard';
import { LabUnitHelperCard } from '../../components/rank/LabUnitHelperCard';
import { PushupPyramidCard } from '../../components/rank/PushupPyramidCard';
import {
  AppButton,
  AppCard,
  AppInput,
  AppModal,
  AppText,
  RankBadge,
  ScreenContainer,
  SegmentedControl,
  SkeletonCard,
  StackHeader,
  useAppAlert,
} from '../../components/ui';
import { useLocale } from '../../i18n/LocaleProvider';
import { RANK_SOLID_ACCENT } from '../../theme/rankGradients';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import type { MainStackParamList } from '../../navigation/types';

type PillarFilter = 'all' | 'blood' | 'bodymarkers' | 'strength' | 'recovery';
type TierFilter = 'all' | 'tier1_everyday' | 'tier2_standard' | 'tier3_precision';
type MethodKey =
  | 'manual'
  | 'lab'
  | 'direct_cpet'
  | 'cooper_estimate'
  | 'wearable_estimate'
  | 'dynamometer_single_hand'
  | 'dexa'
  | 'skinfold_estimate'
  | 'direct_1rm'
  | 'epley_estimate'
  | 'device';

const ALL_METHODS: Array<{ id: MethodKey; label: string }> = [
  { id: 'manual', label: 'Manual' },
  { id: 'direct_1rm', label: 'Direct 1RM' },
  { id: 'epley_estimate', label: 'Epley Est.' },
  { id: 'lab', label: 'Blood Lab' },
  { id: 'dexa', label: 'DEXA' },
  { id: 'skinfold_estimate', label: 'Skinfold' },
  { id: 'direct_cpet', label: 'Direct CPET' },
  { id: 'cooper_estimate', label: 'Cooper 12m' },
  { id: 'dynamometer_single_hand', label: 'Dynamometer' },
  { id: 'wearable_estimate', label: 'Wearable' },
  { id: 'device', label: 'Device' },
];

export function BenchmarkLabScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { locale, l } = useLocale();
  const localeIdx = locale === 'fr' ? 1 : locale === 'ar' ? 2 : 0;
  const { showAlert } = useAppAlert();
  const utils = trpc.useUtils();
  const route = useRoute<RouteProp<MainStackParamList, 'BenchmarkLab'>>();

  const [pillar, setPillar] = useState<PillarFilter>(route.params?.initialPillar ?? 'all');
  const [tier, setTier] = useState<TierFilter>('all');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [query, setQuery] = useState('');
  const [showTools, setShowTools] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(
    route.params?.metricId ?? null,
  );
  const [valueInput, setValueInput] = useState('');
  const [measuredDateInput, setMeasuredDateInput] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<MethodKey>('manual');
  const [cpetModality, setCpetModality] = useState<'treadmill' | 'cycle'>('treadmill');
  const [cinematic, setCinematic] = useState<{
    tier: RankTier;
    division: 0 | 1 | 2 | 3;
    title: string;
    subtitle: string;
  } | null>(null);

  const metricsQuery = trpc.top1.listMetrics.useQuery({
    pillar,
    tier,
    includeArchived,
    query: query.trim() || undefined,
  });

  const auditQuery = trpc.top1.getScientificAudit.useQuery(undefined, { enabled: showAudit });

  const historyQuery = trpc.top1.getMetricHistory.useQuery(
    { metricId: selectedMetricId! },
    { enabled: Boolean(selectedMetricId) },
  );

  const invalidateAll = () => {
    void utils.top1.listMetrics.invalidate();
    void utils.top1.getOverview.invalidate();
    void utils.top1.getScientificAudit.invalidate();
    void utils.physiology.getBodyReport.invalidate();
    if (selectedMetricId) {
      void utils.top1.getMetricHistory.invalidate({ metricId: selectedMetricId });
    }
  };

  const logMutation = trpc.top1.logObservation.useMutation({
    onSuccess: (res) => {
      invalidateAll();
      setSelectedMetricId(null);
      setValueInput('');

      if (res.tierImproved) {
        setCinematic({
          tier: res.overallBadge.badgeTier,
          division: res.overallBadge.division,
          title: `NEW STANDING: ${res.overallBadge.topLabel}`,
          subtitle: `${res.metricName} (${res.value} ${res.unit}) pushed you to ${res.overallBadge.tierName}!`,
        });
      } else {
        const deltaNote =
          res.overallChange && res.overallChange.previous !== null
            ? `Overall: Top ${res.overallChange.previous.toFixed(1)}% → Top ${res.overallChange.current.toFixed(1)}%`
            : `Scientific Score: ${res.scientificModelScore}/100`;
        showAlert({
          title: l('Observation Logged', 'Mesure enregistrée', 'تم تسجيل القياس'),
          message: `${res.metricName}: ${res.value} ${res.unit}. ${deltaNote} (+${res.xpEarned} XP)`,
        });
      }
    },
    onError: (err) => {
      showAlert({ title: 'Validation Error', message: err.message });
    },
  });

  const clearMutation = trpc.top1.clearObservation.useMutation({
    onSuccess: () => {
      invalidateAll();
      setSelectedMetricId(null);
      showAlert({ title: 'Observation Cleared', message: 'Latest measurement removed from active standings.' });
    },
  });

  const items = metricsQuery.data?.items ?? [];
  const activeItem = useMemo(
    () => items.find((m) => m.id === selectedMetricId) ?? null,
    [items, selectedMetricId],
  );

  const openMetric = (item: (typeof items)[number]) => {
    setSelectedMetricId(item.id);
    setValueInput(item.currentValue !== null ? String(item.currentValue) : '');
    setMeasuredDateInput((item.measuredAt ?? new Date().toISOString()).slice(0, 10));
    setCpetModality(item.exerciseMode === 'cycle' ? 'cycle' : 'treadmill');
    setMethod(
      (item.method as MethodKey) ||
        (item.isBlood
          ? 'lab'
          : item.id === 'vo2_max'
            ? 'direct_cpet'
            : item.pillar === 'recovery'
              ? 'device'
              : ['bench_1rm', 'squat_1rm', 'deadlift_1rm', 'pullup_1rm'].includes(item.id)
                ? 'direct_1rm'
                : 'manual'),
    );
  };

  return (
    <ScreenContainer
      scroll
      refreshing={metricsQuery.isRefetching}
      onRefresh={() => {
        void metricsQuery.refetch();
        if (showAudit) void auditQuery.refetch();
      }}
    >
      <StackHeader
        title={l('TOP1% Benchmark & Biomarker Lab', 'Labo TOP1% & Biomarqueurs', 'مختبر المعايير والمؤشرات')}
        subtitle={`${metricsQuery.data?.totalActive ?? 36} active • ${metricsQuery.data?.totalBlood ?? 9} blood labs • ${metricsQuery.data?.totalArchived ?? 10} experimental`}
      />

      <AppInput
        placeholder={l('Search ApoB, HbA1c, VO2 max, Bench, 5K...', 'Rechercher ApoB, VO2 max, Bench...', 'ابحث عن معيار أو تحليل...')}
        value={query}
        onChangeText={setQuery}
      />

      {/* Pillar & Dedicated Blood Lab Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {(
          [
            { id: 'all', label: l('All Pillars', 'Tous', 'الكل') },
            { id: 'blood', label: l('Blood & Labs (9)', 'Bilans sanguins (9)', 'تحاليل الدم (9)') },
            { id: 'strength', label: PILLAR_META.strength.label[localeIdx] },
            { id: 'bodymarkers', label: PILLAR_META.bodymarkers.label[localeIdx] },
            { id: 'recovery', label: PILLAR_META.recovery.label[localeIdx] },
          ] as const
        ).map((opt) => {
          const active = pillar === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => setPillar(opt.id)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: RADII.pill,
                backgroundColor: active ? hexToRgba(c.constant, 0.22) : c.secondBg,
                borderWidth: 1,
                borderColor: active ? c.constant : c.thirdBg,
              }}
            >
              <AppText size="xsm" weight="bold" tone={active ? 'constant' : 'sub'}>
                {opt.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Accessibility Tier Filter */}
      <SegmentedControl
        value={tier}
        onChange={setTier}
        options={[
          { label: l('All', 'Tous', 'الكل'), value: 'all' },
          { label: l('Everyday', 'Quotidien', 'يومي'), value: 'tier1_everyday' },
          { label: l('Standard', 'Standard', 'قياسي'), value: 'tier2_standard' },
          { label: l('Precision', 'Précision', 'دقيق'), value: 'tier3_precision' },
        ]}
      />

      {/* Experimental / Archived Metrics Toggle + Tools / Scientific Audit Buttons */}
      <AppCard style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <AppText size="sm" weight="black">
              {l('Experimental / Archived Metrics', 'Indicateurs expérimentaux (10)', 'المعايير التجريبية (10)')}
            </AppText>
            <AppText size="xsm" tone="sub">
              {l(
                'Show 10 archived metrics (10K, 10m sprint, visceral fat, sauna, cold plunge...)',
                'Afficher les 10 mesures archivées (10 km, graisse viscérale, sauna...)',
                'عرض 10 معايير تجريبية إضافية'
              )}
            </AppText>
          </View>
          <Switch
            value={includeArchived}
            onValueChange={setIncludeArchived}
            trackColor={{ false: c.thirdBg, true: hexToRgba('#F59E0B', 0.55) }}
            thumbColor={includeArchived ? '#F59E0B' : '#94A3B8'}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <AppButton
            label={showTools ? 'Hide Calculators' : 'Lab Calculators'}
            variant="secondary"
            size="sm"
            onPress={() => setShowTools((v) => !v)}
            style={{ flex: 1 }}
          />
          <AppButton
            label={showAudit ? 'Hide Evidence' : 'Science Audit'}
            variant="secondary"
            size="sm"
            onPress={() => setShowAudit((v) => !v)}
            style={{ flex: 1 }}
          />
        </View>
      </AppCard>

      {showTools ? (
        <View style={{ gap: 10 }}>
          <FieldCalculatorsCard
            onApply={(metricId, val, calcMethod) => {
              logMutation.mutate({ metricId, value: val, method: calcMethod });
            }}
          />
          <LabUnitHelperCard
            onUseValue={(converted) => {
              setValueInput(String(converted));
              showAlert({ title: 'Value Ready', message: `Converted value ${converted} copied into your metric input.` });
            }}
          />
          <BodyweightTrackerCard />
          <PushupPyramidCard currentReps={items.find((m) => m.id === 'pushups')?.currentValue ?? null} />
        </View>
      ) : null}

      {/* Scientific Audit, Correlations, Next-Best Tests & Evidence Register */}
      {showAudit ? (
        <AppCard style={{ gap: 12 }} glowColor="#38BDF8">
          <View>
            <AppText size="xxsm" weight="xbold" style={{ color: '#38BDF8' }}>
              TRANSPARENT SCIENCE AUDIT &amp; EVIDENCE REGISTER
            </AppText>
            <AppText size="md" weight="black">
              Coverage: {auditQuery.data ? `${auditQuery.data.coveragePct}%` : '…'} (
              {auditQuery.data?.report.coverage.recorded ?? 0}/{auditQuery.data?.report.coverage.total ?? 36} active)
            </AppText>
          </View>

          {auditQuery.data?.vo2Cohort.available ? (
            <View style={{ padding: 10, borderRadius: RADII.input, backgroundColor: c.thirdBg, gap: 3 }}>
              <AppText size="xxsm" weight="bold" tone="constant">
                FRIEND 2022 VO₂ MAX COHORT COMPARISON
              </AppText>
              <AppText size="xsm" weight="bold">
                {auditQuery.data.vo2Cohort.label} ({auditQuery.data.vo2Cohort.value} mL/kg/min)
              </AppText>
              <AppText size="xxsm" tone="sub">
                Cohort n={auditQuery.data.vo2Cohort.cohort.sampleSize} ({auditQuery.data.vo2Cohort.cohort.sex}, ages{' '}
                {auditQuery.data.vo2Cohort.cohort.ageMin}–{auditQuery.data.vo2Cohort.cohort.ageMax})
              </AppText>
            </View>
          ) : null}

          {auditQuery.data?.correlations ? (
            <View style={{ gap: 6 }}>
              <AppText size="xxsm" weight="bold" tone="sub">
                BIOMARKER &amp; STRENGTH INTERPLAY
              </AppText>
              {auditQuery.data.correlations.map((corr) => (
                <View
                  key={`${corr.metricA}-${corr.metricB}`}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 8,
                    borderRadius: RADII.input,
                    backgroundColor: c.thirdBg,
                    gap: 8,
                  }}
                >
                  <AppText size="xsm" style={{ flex: 1 }}>
                    {corr.label}
                  </AppText>
                  <AppText size="xsm" weight="black" tone="constant" tabular>
                    r = {corr.r.toFixed(2)}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}

          {auditQuery.data?.recommendedNextTests?.length ? (
            <View style={{ gap: 6 }}>
              <AppText size="xxsm" weight="bold" tone="sub">
                RECOMMENDED NEXT TESTS TO LOG
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {auditQuery.data.recommendedNextTests.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => {
                      const found = items.find((x) => x.id === t.id);
                      if (found) openMetric(found);
                    }}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: RADII.pill,
                      backgroundColor: hexToRgba(t.evidence.color, 0.16),
                      borderWidth: 1,
                      borderColor: hexToRgba(t.evidence.color, 0.4),
                    }}
                  >
                    <AppText size="xsm" weight="bold" style={{ color: t.evidence.color }}>
                      + {t.name}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {auditQuery.data?.evidenceRegister ? (
            <View style={{ gap: 8 }}>
              <AppText size="xxsm" weight="bold" tone="sub">
                PEER-REVIEWED EVIDENCE REGISTER ({auditQuery.data.evidenceRegister.length} STUDIES)
              </AppText>
              {auditQuery.data.evidenceRegister.slice(0, 4).map((ev) => (
                <Pressable
                  key={ev.id}
                  onPress={() => void Linking.openURL(ev.url)}
                  style={{ padding: 10, borderRadius: RADII.input, backgroundColor: c.thirdBg, gap: 4 }}
                >
                  <AppText size="xsm" weight="bold">
                    {ev.citation} ({ev.year})
                  </AppText>
                  <AppText size="xxsm" tone="sub">
                    Decision: {ev.supportedDecision}
                  </AppText>
                  <AppText size="xxsm" style={{ color: '#38BDF8' }}>
                    Open Primary Study ↗
                  </AppText>
                </Pressable>
              ))}
            </View>
          ) : null}
        </AppCard>
      ) : null}

      {/* Metric & Biomarker List */}
      {metricsQuery.isLoading ? (
        <View style={{ gap: 10 }}>
          <SkeletonCard height={90} />
          <SkeletonCard height={90} />
          <SkeletonCard height={90} />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {items.map((item) => {
            const pMeta = PILLAR_META[item.pillar];
            const accent = item.isCompetitive
              ? RANK_SOLID_ACCENT[item.badge.badgeTier] ?? pMeta.color
              : item.clinicalZone && item.currentValue !== null
                ? item.clinicalZone.color
                : pMeta.color;

            return (
              <AppCard key={item.id} onPress={() => openMetric(item)} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 99,
                          backgroundColor: pMeta.color,
                        }}
                      />
                      <AppText size="sm" weight="black">
                        {item.name}
                      </AppText>
                      <View
                        style={{
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: 99,
                          backgroundColor: hexToRgba(item.evidence.color, 0.16),
                          borderWidth: 1,
                          borderColor: hexToRgba(item.evidence.color, 0.4),
                        }}
                      >
                        <AppText size="xxsm" weight="bold" style={{ color: item.evidence.color }}>
                          {item.evidence.badgeLabel}
                        </AppText>
                      </View>
                      {item.isBlood ? (
                        <View
                          style={{
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 99,
                            backgroundColor: hexToRgba('#F43F5E', 0.16),
                          }}
                        >
                          <AppText size="xxsm" weight="bold" style={{ color: '#F43F5E' }}>
                            BLOOD LAB
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                    <AppText size="xsm" tone="sub" numberOfLines={1}>
                      {item.evidence.summary}
                    </AppText>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <AppText size="md" weight="black" style={{ color: accent }} tabular>
                      {item.currentValue !== null ? `${item.currentValue} ${item.unit}` : '—'}
                    </AppText>
                    {item.progress ? (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 99,
                          backgroundColor: hexToRgba(accent, 0.2),
                          borderWidth: 1,
                          borderColor: hexToRgba(accent, 0.45),
                        }}
                      >
                        <AppText size="xxsm" weight="black" style={{ color: accent }}>
                          {item.badge.topLabel} • {item.badge.tierName}
                        </AppText>
                      </View>
                    ) : item.clinicalZone ? (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 99,
                          backgroundColor: hexToRgba(item.clinicalZone.color, 0.18),
                        }}
                      >
                        <AppText size="xxsm" weight="bold" style={{ color: item.clinicalZone.color }}>
                          {item.clinicalZone.label}
                        </AppText>
                      </View>
                    ) : (
                      <AppText size="xxsm" tone="sub">
                        {item.eligibility.status === 'eligible' ? 'Model Scored' : 'Tracking'}
                      </AppText>
                    )}
                  </View>
                </View>

                {/* Clinical Range Bar for Blood Biomarkers & Clinical Markers */}
                {item.clinicalZone ? (
                  <View style={{ gap: 4 }}>
                    <View style={{ height: 6, borderRadius: 99, backgroundColor: c.thirdBg, overflow: 'hidden' }}>
                      <View
                        style={{
                          width: `${item.clinicalZone.barPct}%`,
                          height: '100%',
                          backgroundColor: item.clinicalZone.color,
                        }}
                      />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <AppText size="xxsm" tone="sub">
                        Target: {item.clinicalZone.optimalLabel}
                      </AppText>
                      <AppText size="xxsm" tone="sub">
                        {item.measuredAt ? item.measuredAt.slice(0, 10) : 'Tap to log'}
                      </AppText>
                    </View>
                  </View>
                ) : item.progress?.next ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <AppText size="xxsm" tone="sub">
                      {l('Next tier', 'Prochain palier', 'المستوى التالي')}: Top {item.progress.next.tier} (
                      {item.progress.next.value} {item.unit})
                    </AppText>
                    <Ionicons name="chevron-forward" size={14} color={c.subText} />
                  </View>
                ) : null}
              </AppCard>
            );
          })}
        </View>
      )}

      {/* Full Protocol & Evidence Logging Modal */}
      <AppModal
        visible={Boolean(activeItem)}
        onClose={() => setSelectedMetricId(null)}
        title={activeItem?.name ?? 'Log Metric'}
      >
        {activeItem ? (
          <View style={{ gap: 12 }}>
            {activeItem.isCompetitive && activeItem.currentValue !== null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: RADII.input, backgroundColor: c.thirdBg }}>
                <RankBadge tier={activeItem.badge.badgeTier} division={activeItem.badge.division} size={46} showShine />
                <View style={{ flex: 1 }}>
                  <AppText size="sm" weight="black">
                    {activeItem.badge.topLabel} • {activeItem.badge.tierName}
                  </AppText>
                  <AppText size="xsm" tone="sub">
                    {activeItem.progress?.next
                      ? `Next: Top ${activeItem.progress.next.tier} at ${activeItem.progress.next.value} ${activeItem.unit}`
                      : `Target: ${activeItem.target}`}
                  </AppText>
                </View>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1.4 }}>
                <AppInput
                  label={`${l('Value', 'Valeur', 'القيمة')} (${activeItem.unit})`}
                  keyboardType="decimal-pad"
                  value={valueInput}
                  onChangeText={setValueInput}
                  placeholder={`${activeItem.min}–${activeItem.max}`}
                />
              </View>
              <View style={{ flex: 1 }}>
                <AppInput
                  label="Test Date"
                  value={measuredDateInput}
                  onChangeText={setMeasuredDateInput}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            </View>

            {activeItem.id === 'vo2_max' ? (
              <View style={{ gap: 6 }}>
                <AppText size="xxsm" weight="bold" tone="sub">
                  CPET MODALITY (FRIEND 2015 / 2022)
                </AppText>
                <SegmentedControl
                  value={cpetModality}
                  onChange={setCpetModality}
                  options={[
                    { label: 'Treadmill', value: 'treadmill' },
                    { label: 'Cycle Ergometer', value: 'cycle' },
                  ]}
                />
              </View>
            ) : null}

            <View style={{ gap: 6 }}>
              <AppText size="xxsm" weight="bold" tone="sub">
                {l('MEASUREMENT METHOD (11 PROTOCOLS)', 'MÉTHODE DE MESURE', 'طريقة القياس')}
              </AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {ALL_METHODS.map((m) => {
                  const active = method === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => setMethod(m.id)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                        borderRadius: RADII.pill,
                        backgroundColor: active ? hexToRgba(c.constant, 0.22) : c.thirdBg,
                        borderWidth: 1,
                        borderColor: active ? c.constant : 'transparent',
                      }}
                    >
                      <AppText size="xxsm" weight="bold" tone={active ? 'constant' : 'sub'}>
                        {m.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={{ padding: 10, borderRadius: RADII.input, backgroundColor: c.thirdBg, gap: 4 }}>
              <AppText size="xxsm" weight="xbold" style={{ color: activeItem.evidence.color }}>
                {activeItem.evidence.badgeLabel} • PROTOCOL &amp; EVIDENCE
              </AppText>
              <AppText size="xsm" weight="bold">
                {activeItem.proofData.study}
              </AppText>
              <AppText size="xxsm" tone="sub">
                {activeItem.proofData.instructions}
              </AppText>
              <AppText size="xxsm" tone="sub">
                Calibration: {activeItem.calibration.reason}
              </AppText>
            </View>

            {historyQuery.data && historyQuery.data.history.length > 0 ? (
              <View style={{ gap: 4 }}>
                <AppText size="xxsm" weight="bold" tone="sub">
                  RECENT HISTORY ({historyQuery.data.history.length})
                </AppText>
                {historyQuery.data.history.slice(0, 4).map((h) => (
                  <View key={h.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText size="xsm" tone="sub">
                      {(h.measuredAt ?? h.recordedAt).slice(0, 10)} ({h.method ?? 'manual'})
                    </AppText>
                    <AppText size="xsm" weight="bold" tabular>
                      {h.value} {activeItem.unit}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <AppButton
                label={l('Save Verified Result', 'Enregistrer', 'حفظ القياس')}
                loading={logMutation.isPending}
                onPress={() => {
                  const parsed = parseFloat(valueInput);
                  if (!Number.isFinite(parsed)) {
                    showAlert({
                      title: 'Enter a valid number',
                      message: `Expected ${activeItem.min}–${activeItem.max} ${activeItem.unit}`,
                    });
                    return;
                  }
                  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(measuredDateInput)
                    ? `${measuredDateInput}T12:00:00.000Z`
                    : undefined;
                  logMutation.mutate({
                    metricId: activeItem.id,
                    value: parsed,
                    method,
                    measuredAt: isoDate,
                    exerciseMode: activeItem.id === 'vo2_max' ? cpetModality : undefined,
                  });
                }}
                style={{ flex: 1.5 }}
              />
              {activeItem.currentValue !== null ? (
                <AppButton
                  label="Clear"
                  variant="danger"
                  loading={clearMutation.isPending}
                  onPress={() => clearMutation.mutate({ metricId: activeItem.id })}
                  style={{ flex: 0.7 }}
                />
              ) : null}
            </View>
          </View>
        ) : null}
      </AppModal>

      {cinematic ? (
        <RankUpCinematicModal
          visible
          onClose={() => setCinematic(null)}
          title={cinematic.title}
          subtitle={cinematic.subtitle}
          tier={cinematic.tier}
          division={cinematic.division}
          rating={850}
          deltaSr={35}
          mode="rank"
        />
      ) : null}
    </ScreenContainer>
  );
}
