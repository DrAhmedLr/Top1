import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ratingToRank, type RankTier } from '@apexlift/shared';
import { trpc } from '../../api/trpc';
import { RankUpCinematicModal } from '../../components/fx';
import { MuscleBodygraphSvg, type BodygraphMode } from '../../components/rank/MuscleBodygraphSvg';
import { RankProgressBar } from '../../components/rank/RankProgressBar';
import { TriadChartSvg } from '../../components/rank/TriadChartSvg';
import {
  AppButton,
  AppCard,
  AppText,
  RankBadge,
  ScreenContainer,
  SegmentedControl,
  SkeletonCard,
} from '../../components/ui';
import { useLocale } from '../../i18n/LocaleProvider';
import { useAuthStore } from '../../stores/authStore';
import { RANK_BG_GRADIENTS, RANK_SOLID_ACCENT } from '../../theme/rankGradients';
import { useResponsiveLayout } from '../../theme/useResponsiveLayout';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import type { MainStackParamList } from '../../navigation/types';

export function RanksTabScreen() {
  const { theme } = useTheme();
  const layout = useResponsiveLayout();
  const c = theme.colors;
  const { locale, l } = useLocale();
  const localeIdx = locale === 'fr' ? 1 : locale === 'ar' ? 2 : 0;
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const isFemale = user?.rankingSex === 'Female';
  const [cinematicOpen, setCinematicOpen] = useState(false);
  const [bgMode, setBgMode] = useState<BodygraphMode>('capability');

  const top1Query = trpc.top1.getOverview.useQuery();
  const leagueQuery = trpc.rank.getMyLeague.useQuery();
  const weeklyQuery = trpc.gamification.getWeeklyReport.useQuery();

  const top1 = top1Query.data;
  const fallbackRank = ratingToRank(user?.peakAverageRating ?? 0);
  const overallTier = (top1?.badge.badgeTier ?? fallbackRank.tier) as RankTier;
  const overallDivision = top1?.badge.division ?? fallbackRank.division;
  const accent = RANK_SOLID_ACCENT[overallTier] ?? c.constant;
  const muscles = top1?.physiology.svgMuscles ?? {};

  const tiles: Array<{
    title: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    onPress: () => void;
  }> = [
    {
      title: l('Benchmark Lab', 'Labo mesures', 'مختبر المعايير'),
      subtitle: l('30+ scientific metrics', '30+ indicateurs', 'أكثر من 30 معياراً'),
      icon: 'flask-outline',
      color: '#38BDF8',
      onPress: () => navigation.navigate('BenchmarkLab'),
    },
    {
      title: l('Adaptive Coach', 'Coach adaptatif', 'المدرب التكيّفي'),
      subtitle: top1?.coachDecision
        ? `Today: ${top1.coachDecision.action.toUpperCase()}`
        : l('Goals & calendar', 'Objectifs & calendrier', 'الأهداف والجدول'),
      icon: 'compass-outline',
      color: '#22C55E',
      onPress: () => navigation.navigate('CoachHub'),
    },
    {
      title: l('Bodygraph 3D', 'Bodygraph', 'خريطة العضلات'),
      subtitle: l('Tier · Recovery · MRV', 'Rang · Récup · MRV', 'القوة · التعافي · الحجم'),
      icon: 'body-outline',
      color: c.constant,
      onPress: () => navigation.navigate('Bodygraph'),
    },
    {
      title: l('Percentile Explorer', 'Explorateur rang', 'مستكشف النسب'),
      subtitle: l('13 competitive tests', '13 tests compétitifs', '13 اختباراً تنافسياً'),
      icon: 'calculator-outline',
      color: '#5EDED6',
      onPress: () => navigation.navigate('RankCalculator'),
    },
    {
      title: l('Forecast & Sim', 'Prévision & Sim', 'التوقعات والمحاكاة'),
      subtitle: l('Monte Carlo + 3-Pillar', 'Monte Carlo + Piliers', 'مونت كارلو والمحاكاة'),
      icon: 'trending-up-outline',
      color: c.check,
      onPress: () => navigation.navigate('RankPrediction'),
    },
    {
      title: l('Watch Readiness', 'Montre & VFC', 'جاهزية الساعة'),
      subtitle: top1?.wearable.hasWearableData
        ? `${Math.round(top1.wearable.readinessMultiplier * 100)}% readiness`
        : l('Sync HRV & sleep', 'Synchro VFC & sommeil', 'مزامنة النوم والنبض'),
      icon: 'watch-outline',
      color: '#F43F5E',
      onPress: () => navigation.navigate('WearableReadiness'),
    },
    {
      title: leagueQuery.data?.league.name ?? 'Weekly League',
      subtitle: 'Promote / safe zone',
      icon: 'shield-outline',
      color: '#D075E8',
      onPress: () => navigation.navigate('RankLeagues'),
    },
    {
      title: 'Goals & Quests',
      subtitle: `${weeklyQuery.data?.streak ?? user?.streaks ?? 0}d streak • Medals`,
      icon: 'flag-outline',
      color: '#F59E0B',
      onPress: () => navigation.navigate('GoalsQuestsMedals', { initialTab: 'quests' }),
    },
    {
      title: 'Rank Gallery',
      subtitle: 'Sculpted lift badges',
      icon: 'ribbon-outline',
      color: '#F2BC1B',
      onPress: () => navigation.navigate('RankGallery'),
    },
    {
      title: 'Recap Stories',
      subtitle: 'Athlete archetype',
      icon: 'sparkles-outline',
      color: '#0BC4FF',
      onPress: () => navigation.navigate('RecapStories'),
    },
  ];

  const tileBasis =
    layout.gridColumns === 4
      ? '23.2%'
      : layout.gridColumns === 3
        ? '31.5%'
        : '48%';

  return (
    <ScreenContainer
      scroll
      refreshing={top1Query.isRefetching}
      onRefresh={() => {
        void top1Query.refetch();
        void leagueQuery.refetch();
        void weeklyQuery.refetch();
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <AppText size="xxl" weight="black">
            {l('TOP1% Standings', 'Classement TOP1%', 'تصنيف TOP1%')}
          </AppText>
          <AppText size="sm" tone="sub">
            {l(
              'Overall Top %, 4 competitive areas, 3 scientific pillars & bodygraph',
              'Top % global, 4 axes compétitifs, 3 piliers & bodygraph',
              'النسبة العامة، 4 محاور تنافسية، 3 ركائز وخريطة العضلات'
            )}
          </AppText>
        </View>
        <Pressable
          onPress={() => navigation.navigate('Leaderboard', { initialCategory: 'ranks' })}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: RADII.pill,
            backgroundColor: c.secondBg,
            borderWidth: 1,
            borderColor: hexToRgba(c.constant, 0.4),
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Ionicons name="podium-outline" size={16} color={c.constant} />
          <AppText size="xsm" weight="bold" tone="constant">
            {l('Boards', 'Classement', 'المتصدرون')}
          </AppText>
        </Pressable>
      </View>

      {/* Desktop 2-Column Bento Row: Overall Standing + Bodygraph (Left) & 3-Pillar Scientific Triad (Right) */}
      <View
        style={
          layout.isDesktop
            ? { flexDirection: 'row', alignItems: 'flex-start', gap: 18 }
            : { gap: layout.sectionGap }
        }
      >
        {/* Overall TOP1% Hero Card */}
        <AppCard
          gradientColors={RANK_BG_GRADIENTS[overallTier]}
          glowColor={accent}
          style={{ gap: 16, ...(layout.isDesktop ? { flex: 1.35 } : {}) }}
        >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Pressable onPress={() => setCinematicOpen(true)}>
            <RankBadge
              tier={overallTier}
              division={overallDivision}
              size={90}
              showShine
              floating
            />
          </Pressable>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText size="xxsm" weight="xbold" style={{ color: accent, letterSpacing: 1 }}>
                OVERALL TOP1%
              </AppText>
              <Pressable onPress={() => setCinematicOpen(true)}>
                <AppText size="xxsm" weight="black" tone="constant">
                  REPLAY ▶
                </AppText>
              </Pressable>
            </View>
            <AppText size="xxl" weight="black">
              {top1?.overall.overall
                ? `Top ${top1.overall.overall.percent < 1 ? top1.overall.overall.percent.toFixed(2) : top1.overall.overall.percent.toFixed(1)}%`
                : fallbackRank.label}
            </AppText>
            <AppText size="sm" weight="bold" style={{ color: accent }}>
              {top1?.badge.tierName ?? fallbackRank.displayName} • {top1?.overall.testCount ?? 0} verified tests
            </AppText>
            {top1?.overall.overall?.limitedByWeakest ? (
              <AppText size="xxsm" style={{ color: c.warning }}>
                Weakest-link limiter active — balance all 4 areas to unlock higher Top %!
              </AppText>
            ) : null}
            <View style={{ marginTop: 4 }}>
              <RankProgressBar
                tier={overallTier}
                progress={
                  top1?.overall.overall
                    ? Math.min(1, Math.max(0.08, top1.overall.overall.points / 2.2))
                    : fallbackRank.progressToNext
                }
                height={10}
              />
            </View>
          </View>
        </View>

        {/* 4 Competitive Areas Breakdown */}
        {top1 ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {top1.areas.map((a) => (
              <Pressable
                key={a.area}
                onPress={() => navigation.navigate('BenchmarkLab', { initialPillar: 'strength' })}
                style={{
                  flex: 1,
                  padding: 8,
                  borderRadius: RADII.input,
                  backgroundColor: 'rgba(10,7,20,0.55)',
                  borderWidth: 1,
                  borderColor: hexToRgba(a.meta.color, 0.35),
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <AppText size="xxsm" weight="bold" tone="sub">
                  {a.meta.label[localeIdx]}
                </AppText>
                <AppText size="sm" weight="black" style={{ color: a.meta.color }}>
                  {a.tier ? `Top ${a.tier}` : '—'}
                </AppText>
                <AppText size="xxsm" tone="sub">
                  {a.tests.length} tests
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* 3-Mode Anatomical Mini Bodygraph Preview */}
        <SegmentedControl
          value={bgMode}
          onChange={setBgMode}
          options={[
            { label: l('Tier', 'Niveau', 'المستوى'), value: 'capability' },
            { label: l('Recovery', 'Récup', 'التعافي'), value: 'recovery' },
            { label: l('Volume', 'Volume', 'الحجم'), value: 'volume' },
          ]}
        />

        <Pressable
          onPress={() => navigation.navigate('Bodygraph')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
            backgroundColor: 'rgba(10, 7, 20, 0.55)',
            borderRadius: RADII.card,
            borderWidth: 1,
            borderColor: hexToRgba('#FFFFFF', 0.08),
            paddingVertical: 14,
          }}
        >
          <MuscleBodygraphSvg muscles={muscles} side="front" mode={bgMode} isFemale={isFemale} height={layout.bodygraphHeight} />
          <MuscleBodygraphSvg muscles={muscles} side="back" mode={bgMode} isFemale={isFemale} height={layout.bodygraphHeight} />
        </Pressable>

        <AppButton
          label={l('Inspect Full Physiology Bodygraph', 'Ouvrir le Bodygraph complet', 'فتح خريطة العضلات الكاملة')}
          variant="secondary"
          onPress={() => navigation.navigate('Bodygraph')}
          fullWidth
        />
      </AppCard>

      {/* 3 Scientific Pillars Card */}
      {top1Query.isLoading ? (
        <View style={layout.isDesktop ? { flex: 1 } : undefined}>
          <SkeletonCard height={190} lines={3} />
        </View>
      ) : top1 ? (
        <AppCard style={{ gap: 10, ...(layout.isDesktop ? { flex: 1 } : {}) }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <AppText size="xxsm" weight="xbold" tone="constant">
                {l('3-PILLAR SCIENTIFIC MODEL', 'MODÈLE SCIENTIFIQUE 3 PILIERS', 'النموذج العلمي (3 ركائز)')}
              </AppText>
              <AppText size="lg" weight="black">
                {top1.scientific.ready ? `${top1.scientific.modelScore} / 100` : 'Pending 3 metrics'}
              </AppText>
            </View>
            <AppButton
              label={l('Log Metrics', 'Mesures', 'تسجيل')}
              size="sm"
              onPress={() => navigation.navigate('BenchmarkLab')}
            />
          </View>
          <TriadChartSvg
            strength={top1.scientific.pillars.find((p) => p.id === 'strength')?.score ?? null}
            bodymarkers={top1.scientific.pillars.find((p) => p.id === 'bodymarkers')?.score ?? null}
            recovery={top1.scientific.pillars.find((p) => p.id === 'recovery')?.score ?? null}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {top1.scientific.pillars.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => navigation.navigate('BenchmarkLab', { initialPillar: p.id })}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: RADII.input,
                  backgroundColor: c.thirdBg,
                  gap: 3,
                }}
              >
                <AppText size="xxsm" weight="bold" style={{ color: p.meta.color }} numberOfLines={1}>
                  {p.meta.label[localeIdx]}
                </AppText>
                <AppText size="md" weight="black">
                  {p.score !== null ? `${p.score}` : '—'}
                </AppText>
                <AppText size="xxsm" tone="sub">
                  {Math.round(p.weight * 100)}% wt
                </AppText>
              </Pressable>
            ))}
          </View>
        </AppCard>
      ) : null}
      </View>

      {/* Feature Grid — Fluid 2/3/4 columns */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {tiles.map((t) => (
          <View key={t.title} style={{ flexBasis: tileBasis, flexGrow: 1, minWidth: 145 }}>
            <AppCard onPress={t.onPress} style={{ gap: 6 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: hexToRgba(t.color, 0.18),
                  borderWidth: 1,
                  borderColor: hexToRgba(t.color, 0.35),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={t.icon} size={20} color={t.color} />
              </View>
              <AppText size="sm" weight="bold">
                {t.title}
              </AppText>
              <AppText size="xsm" tone="sub">
                {t.subtitle}
              </AppText>
            </AppCard>
          </View>
        ))}
      </View>

      <RankUpCinematicModal
        visible={cinematicOpen}
        onClose={() => setCinematicOpen(false)}
        title={`TOP1% • ${top1?.badge.topLabel ?? fallbackRank.label}`}
        subtitle={`Standing: ${top1?.badge.tierName ?? fallbackRank.label} across ${top1?.overall.coverage ?? 0}/4 competitive areas.`}
        tier={overallTier}
        division={overallDivision}
        rating={Math.round((top1?.scientific.modelScore ?? 65) * 10)}
        deltaSr={24}
        mode="rank"
      />
    </ScreenContainer>
  );
}
