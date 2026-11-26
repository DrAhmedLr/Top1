import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  RANKED_MUSCLE_GROUPS,
  TOP1_RECOVERY_COLORS,
  TOP1_VOLUME_COLORS,
  type RankedMuscleGroup,
  type RankTier,
  type UnifiedSvgMuscleState,
} from '@apexlift/shared';
import { trpc } from '../../api/trpc';
import { getMuscleGraphicUrl } from '../../assets/v4MediaManifest';
import { MuscleBodygraphSvg, type BodygraphMode } from '../../components/rank/MuscleBodygraphSvg';
import { RankProgressBar } from '../../components/rank/RankProgressBar';
import {
  AppCard,
  AppText,
  RankBadge,
  ScreenContainer,
  SegmentedControl,
  StackHeader,
} from '../../components/ui';
import { useLocale } from '../../i18n/LocaleProvider';
import { useAuthStore } from '../../stores/authStore';
import { RANK_BG_GRADIENTS, RANK_SOLID_ACCENT } from '../../theme/rankGradients';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import type { MainStackParamList } from '../../navigation/types';

export function BodygraphScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { l } = useLocale();
  const route = useRoute<RouteProp<MainStackParamList, 'Bodygraph'>>();
  const targetUserId = route.params?.userId;
  const displayName = route.params?.displayName;
  const user = useAuthStore((s) => s.user);
  const isFemale = user?.rankingSex === 'Female';
  const sex = isFemale ? 'Female' : 'Male';

  const [side, setSide] = useState<'front' | 'back'>('front');
  const [mode, setMode] = useState<BodygraphMode>('capability');
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>('Lower Chest');

  const physQuery = trpc.physiology.getBodyReport.useQuery(
    targetUserId ? { userId: targetUserId } : undefined
  );
  const report = physQuery.data;
  const muscles: Partial<Record<RankedMuscleGroup, UnifiedSvgMuscleState>> =
    report?.svgMuscles ?? {};
  const activeEntry = selectedMuscle
    ? muscles[selectedMuscle as RankedMuscleGroup] ?? null
    : null;
  const activeTier = (activeEntry?.tier ?? 'Unranked') as RankTier;
  const activeAccent =
    mode === 'recovery' && activeEntry
      ? TOP1_RECOVERY_COLORS[activeEntry.recoveryBand][1]
      : mode === 'volume' && activeEntry
        ? TOP1_VOLUME_COLORS[activeEntry.volumeZone][1]
        : RANK_SOLID_ACCENT[activeTier] ?? c.constant;
  const activeMuscleGraphic = selectedMuscle ? getMuscleGraphicUrl(selectedMuscle, sex) : null;

  return (
    <ScreenContainer scroll>
      <StackHeader
        title={
          displayName
            ? `${displayName}'s Bodygraph`
            : l('Physiology Bodygraph', 'Bodygraph physiologique', 'خريطة فسيولوجيا العضلات')
        }
        subtitle={l(
          'Capability tiers, live local recovery % & weekly MEV/MAV/MRV volume',
          'Niveaux de force, récupération locale % et volume MEV/MAV/MRV',
          'مستويات القوة، التعافي الموضعي % وحجم التدريب الأسبوعي'
        )}
      />

      {/* Mode Switcher */}
      <SegmentedControl
        value={mode}
        onChange={setMode}
        options={[
          { label: l('TOP1 Tier', 'Niveau', 'المستوى'), value: 'capability' },
          { label: l('Recovery %', 'Récupération', 'التعافي'), value: 'recovery' },
          { label: l('Volume MRV', 'Volume', 'الحجم'), value: 'volume' },
        ]}
      />

      {/* Front / Back Switcher */}
      <SegmentedControl
        value={side}
        onChange={setSide}
        options={[
          { label: l('Front Anatomy', 'Face avant', 'الأمام'), value: 'front' },
          { label: l('Back Anatomy', 'Face arrière', 'الخلف'), value: 'back' },
        ]}
      />

      {/* Systemic Readiness Strip */}
      {report ? (
        <AppCard style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText size="xxsm" weight="xbold" tone="constant">
              {l('SYSTEMIC READINESS', 'DISPONIBILITÉ SYSTÉMIQUE', 'الجاهزية العامة')}
            </AppText>
            <AppText size="sm" weight="bold">
              {report.systemicReadiness.score}% • {report.systemicReadiness.band.toUpperCase()}
            </AppText>
            <AppText size="xsm" tone="sub" numberOfLines={2}>
              {report.systemicReadiness.note}
            </AppText>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <AppText size="xxsm" tone="sub">
              {l('COVERAGE', 'COUVERTURE', 'التغطية')}
            </AppText>
            <AppText size="md" weight="black" tone="check">
              {report.overallBodyTier.measuredMuscles}/{report.overallBodyTier.totalMuscles}
            </AppText>
          </View>
        </AppCard>
      ) : null}

      {/* Interactive Anatomical SVG */}
      <AppCard style={{ alignItems: 'center', paddingVertical: 16, gap: 10 }}>
        <MuscleBodygraphSvg
          muscles={muscles}
          side={side}
          mode={mode}
          isFemale={isFemale}
          selectedMuscle={selectedMuscle}
          onSelectMuscle={(m) => setSelectedMuscle((prev) => (prev === m ? null : m))}
          height={330}
        />

        {/* Mode Legend */}
        {mode === 'recovery' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            {(['fresh', 'ready', 'recovering', 'fatigued'] as const).map((band) => (
              <View key={band} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 9, height: 9, borderRadius: 99, backgroundColor: TOP1_RECOVERY_COLORS[band][1] }} />
                <AppText size="xxsm" tone="sub" style={{ textTransform: 'capitalize' }}>
                  {band}
                </AppText>
              </View>
            ))}
          </View>
        ) : mode === 'volume' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            {[
              { z: 'under_mev' as const, label: '< MEV' },
              { z: 'optimal_mav' as const, label: 'Optimal MAV' },
              { z: 'near_mrv' as const, label: 'Near MRV' },
              { z: 'over_mrv' as const, label: 'Over MRV' },
            ].map((item) => (
              <View key={item.z} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 9, height: 9, borderRadius: 99, backgroundColor: TOP1_VOLUME_COLORS[item.z][1] }} />
                <AppText size="xxsm" tone="sub">
                  {item.label}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}

        {selectedMuscle ? (
          <Pressable onPress={() => setSelectedMuscle(null)}>
            <AppText size="xsm" weight="bold" tone="constant">
              {selectedMuscle} • {l('Tap to show all muscles', 'Toucher pour tout afficher', 'اضغط لعرض كل العضلات')}
            </AppText>
          </Pressable>
        ) : (
          <AppText size="xsm" tone="sub">
            {l('Tap any muscle to inspect capability, recovery & MEV/MAV/MRV', 'Touchez un muscle pour l’inspecter', 'اضغط على أي عضلة لفحص تفاصيلها')}
          </AppText>
        )}
      </AppCard>

      {/* Selected Muscle Inspector */}
      {activeEntry ? (
        <AppCard
          gradientColors={RANK_BG_GRADIENTS[activeTier]}
          glowColor={activeAccent}
          style={{ gap: 12 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {activeMuscleGraphic ? (
              <View
                style={{
                  width: 64,
                  height: 72,
                  borderRadius: 14,
                  backgroundColor: hexToRgba('#0F0A18', 0.55),
                  borderWidth: 1,
                  borderColor: hexToRgba(activeAccent, 0.55),
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 4,
                }}
              >
                <Image
                  source={{ uri: activeMuscleGraphic }}
                  resizeMode="contain"
                  style={{ width: 56, height: 64 }}
                />
              </View>
            ) : null}
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <AppText size="lg" weight="black">
                  {activeEntry.muscle}
                </AppText>
                <RankBadge tier={activeTier} division={activeEntry.division} size={34} />
              </View>
              <AppText size="sm" weight="xbold" style={{ color: activeAccent }}>
                {activeEntry.label}
                {activeEntry.capabilityScore !== null ? ` • ${Math.round(activeEntry.capabilityScore)}/100` : ''}
                {` (${activeEntry.confidence})`}
              </AppText>
              <RankProgressBar
                tier={activeTier}
                progress={activeEntry.capabilityScore !== null ? Math.min(1, activeEntry.capabilityScore / 100) : 0}
                height={8}
              />
            </View>
          </View>

          {/* Recovery & Volume Telemetry Pills */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, padding: 10, borderRadius: RADII.input, backgroundColor: 'rgba(10,7,18,0.5)' }}>
              <AppText size="xxsm" tone="sub">
                {l('LOCAL RECOVERY', 'RÉCUPÉRATION', 'التعافي الموضعي')}
              </AppText>
              <AppText
                size="md"
                weight="black"
                style={{ color: TOP1_RECOVERY_COLORS[activeEntry.recoveryBand][1] }}
              >
                {activeEntry.recoveryPercent}% ({activeEntry.recoveryBand})
              </AppText>
              <AppText size="xxsm" tone="sub">
                {activeEntry.hoursUntilReady > 0
                  ? `~${activeEntry.hoursUntilReady}h to ready • ${activeEntry.acuteSets72h} sets/72h`
                  : `Ready now • ${activeEntry.acuteSets72h} sets/72h`}
              </AppText>
            </View>
            <View style={{ flex: 1, padding: 10, borderRadius: RADII.input, backgroundColor: 'rgba(10,7,18,0.5)' }}>
              <AppText size="xxsm" tone="sub">
                {l('7D EFFECTIVE SETS', 'SÉRIES 7J', 'مجموعات 7 أيام')}
              </AppText>
              <AppText
                size="md"
                weight="black"
                style={{ color: TOP1_VOLUME_COLORS[activeEntry.volumeZone][1] }}
              >
                {activeEntry.weeklyEffectiveSets} / {activeEntry.mrv} MRV
              </AppText>
              <AppText size="xxsm" tone="sub">
                MEV {activeEntry.mev} • MAV {activeEntry.mav}
              </AppText>
            </View>
          </View>

          {activeEntry.protectedForUpcomingGoal ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                padding: 8,
                borderRadius: RADII.input,
                backgroundColor: hexToRgba('#38BDF8', 0.16),
                borderWidth: 1,
                borderColor: hexToRgba('#38BDF8', 0.4),
              }}
            >
              <Ionicons name="shield-checkmark" size={16} color="#38BDF8" />
              <AppText size="xsm" weight="bold" style={{ color: '#38BDF8', flex: 1 }}>
                Protected for an upcoming pinned TOP1% goal session within 36h.
              </AppText>
            </View>
          ) : null}
        </AppCard>
      ) : null}

      {/* Structural Balance Checks */}
      {report && report.structuralBalance.length > 0 ? (
        <AppCard style={{ gap: 10 }}>
          <AppText size="md" weight="black">
            {l('Structural Balance', 'Équilibre structurel', 'التوازن الهيكلي')}
          </AppText>
          {report.structuralBalance.map((chk) => {
            const color =
              chk.status === 'balanced'
                ? c.check
                : chk.status === 'imbalanced'
                  ? c.warning
                  : c.subText;
            return (
              <View
                key={chk.id}
                style={{
                  padding: 10,
                  borderRadius: RADII.input,
                  backgroundColor: c.thirdBg,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <AppText size="sm" weight="bold">
                    {chk.label}
                  </AppText>
                  <AppText size="xsm" weight="black" style={{ color, textTransform: 'uppercase' }}>
                    {chk.ratio !== null ? `${chk.ratio.toFixed(2)} • ` : ''}
                    {chk.status.replace('_', ' ')}
                  </AppText>
                </View>
                <AppText size="xsm" tone="sub">
                  {chk.guidance}
                </AppText>
              </View>
            );
          })}
        </AppCard>
      ) : null}

      {/* All 20 Muscle Groups List */}
      <View style={{ gap: 8 }}>
        <AppText size="md" weight="bold">
          {l('All 20 Anatomical Muscle Groups', '20 groupes musculaires', 'جميع المجموعات العضلية (20)')}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {RANKED_MUSCLE_GROUPS.map((m) => {
            const entry = muscles[m];
            const tier = (entry?.tier ?? 'Unranked') as RankTier;
            const color =
              mode === 'recovery' && entry
                ? TOP1_RECOVERY_COLORS[entry.recoveryBand][1]
                : mode === 'volume' && entry
                  ? TOP1_VOLUME_COLORS[entry.volumeZone][1]
                  : entry && entry.rating > 0
                    ? RANK_SOLID_ACCENT[tier]
                    : c.subText;
            const active = selectedMuscle === m;
            const thumb = getMuscleGraphicUrl(m, sex);
            const subtitle =
              mode === 'recovery' && entry
                ? `${entry.recoveryPercent}% ready`
                : mode === 'volume' && entry
                  ? `${entry.weeklyEffectiveSets}/${entry.mrv} sets`
                  : `${entry?.label ?? 'Unmeasured'}`;
            return (
              <Pressable
                key={m}
                onPress={() => setSelectedMuscle(active ? null : m)}
                style={{
                  width: '48.3%',
                  padding: 10,
                  borderRadius: RADII.input,
                  backgroundColor: active ? hexToRgba(color, 0.18) : c.secondBg,
                  borderWidth: 1,
                  borderColor: active ? color : hexToRgba('#FFFFFF', 0.08),
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {thumb ? (
                  <Image source={{ uri: thumb }} resizeMode="contain" style={{ width: 32, height: 36 }} />
                ) : null}
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText size="sm" weight="bold" numberOfLines={1}>
                    {m}
                  </AppText>
                  <AppText size="xsm" weight="bold" style={{ color }}>
                    {subtitle}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScreenContainer>
  );
}
