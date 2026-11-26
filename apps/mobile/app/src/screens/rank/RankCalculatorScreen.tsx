import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { trpc } from '../../api/trpc';
import {
  AppButton,
  AppCard,
  AppInput,
  AppText,
  RankBadge,
  ScreenContainer,
  SegmentedControl,
  StackHeader,
} from '../../components/ui';
import { useLocale } from '../../i18n/LocaleProvider';
import { useAuthStore } from '../../stores/authStore';
import { RANK_SOLID_ACCENT } from '../../theme/rankGradients';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';

const EXPLORE_METRICS = [
  { id: 'pushups', label: 'Push-ups', unit: 'reps', sample: '40' },
  { id: 'pullups', label: 'Pull-ups', unit: 'reps', sample: '16' },
  { id: 'dips', label: 'Dips', unit: 'reps', sample: '20' },
  { id: 'dead_hang', label: 'Dead Hang', unit: 's', sample: '110' },
  { id: 'bench_1rm', label: 'Bench (×BW)', unit: '× BW', sample: '1.35' },
  { id: 'squat_1rm', label: 'Squat (×BW)', unit: '× BW', sample: '1.75' },
  { id: 'deadlift_1rm', label: 'Deadlift (×BW)', unit: '× BW', sample: '2.1' },
  { id: 'pullup_1rm', label: 'Weighted Pull-up', unit: '× BW', sample: '0.55' },
  { id: 'grip_strength', label: 'Grip Strength', unit: 'kg', sample: '56' },
  { id: 'cmj', label: 'Vertical Jump', unit: 'cm', sample: '50' },
  { id: 'broad_jump', label: 'Broad Jump', unit: 'm', sample: '2.35' },
  { id: 'run_5k', label: '5 km Run', unit: 'min', sample: '22.5' },
  { id: 'sprint_400m', label: '400m Sprint', unit: 's', sample: '62' },
] as const;

export function RankCalculatorScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { l } = useLocale();
  const user = useAuthStore((s) => s.user);

  const [selected, setSelected] = useState<(typeof EXPLORE_METRICS)[number]>(EXPLORE_METRICS[0]);
  const [valueInput, setValueInput] = useState<string>(EXPLORE_METRICS[0].sample);
  const [sex, setSex] = useState<'male' | 'female'>(
    user?.rankingSex === 'Female' ? 'female' : 'male'
  );
  const [ageInput, setAgeInput] = useState(String(user?.age ?? 27));
  const [bwInput, setBwInput] = useState(String(Math.round(user?.bodyweightKg ?? 78)));

  const exploreMutation = trpc.top1.exploreRank.useMutation();

  const runExplore = (metricId = selected.id, valStr = valueInput) => {
    const val = parseFloat(valStr);
    if (!Number.isFinite(val)) return;
    exploreMutation.mutate({
      metricId,
      value: val,
      age: Math.max(18, Math.min(120, parseInt(ageInput, 10) || 27)),
      sex,
      weightKg: Math.max(35, Math.min(220, parseFloat(bwInput) || 78)),
    });
  };

  useEffect(() => {
    runExplore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.id, sex]);

  const res = exploreMutation.data;
  const accent = res ? RANK_SOLID_ACCENT[res.badge.badgeTier] ?? c.constant : c.constant;

  return (
    <ScreenContainer scroll>
      <StackHeader
        title={l('TOP1% Percentile Explorer', 'Explorateur TOP1%', 'مستكشف النسب المئوية')}
        subtitle={l(
          'Age, sex & bodyweight-adjusted TOP1% difficulty model across 13 tests',
          'Modèle ajusté âge/sexe/poids sur 13 tests compétitifs',
          'نموذج تصنيف معدل حسب العمر والجنس والوزن لـ 13 اختباراً'
        )}
      />

      {res ? (
        <AppCard glowColor={accent} style={{ alignItems: 'center', gap: 10, paddingVertical: 20 }}>
          <RankBadge
            tier={res.badge.badgeTier}
            division={res.badge.division}
            size={104}
            showShine
            floating
          />
          <AppText size="xxl" weight="black" style={{ color: accent }}>
            {res.percent !== null
              ? `Top ${res.percent < 1 ? res.percent.toFixed(2) : res.percent.toFixed(1)}%`
              : 'Unranked'}
          </AppText>
          <AppText size="md" weight="bold">
            {res.badge.tierName} • {res.metricName}
          </AppText>
          <AppText size="sm" tone="sub" align="center">
            {res.next
              ? `Next milestone: Top ${res.next.tier} at ${res.next.value} ${res.unit} (${res.next.delta > 0 ? '+' : ''}${res.next.delta})`
              : 'Peak TOP 0.01% ceiling achieved!'}
          </AppText>
        </AppCard>
      ) : null}

      <View style={{ gap: 8 }}>
        <AppText size="sm" weight="bold" tone="sub">
          {l('SELECT COMPETITIVE TEST', 'CHOISIR UN TEST', 'اختر الاختبار التنافسي')}
        </AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {EXPLORE_METRICS.map((m) => {
            const active = m.id === selected.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => {
                  setSelected(m);
                  setValueInput(m.sample);
                  runExplore(m.id, m.sample);
                }}
                style={{
                  paddingHorizontal: 13,
                  paddingVertical: 8,
                  borderRadius: RADII.pill,
                  backgroundColor: active ? hexToRgba(c.constant, 0.2) : c.secondBg,
                  borderWidth: 1,
                  borderColor: active ? c.constant : c.thirdBg,
                }}
              >
                <AppText size="xsm" weight="bold" tone={active ? 'constant' : 'default'}>
                  {m.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <AppCard style={{ gap: 12 }}>
        <SegmentedControl
          value={sex}
          onChange={setSex}
          options={[
            { label: l('Male Cohort', 'Homme', 'ذكر'), value: 'male' },
            { label: l('Female Cohort', 'Femme', 'أنثى'), value: 'female' },
          ]}
        />

        <AppInput
          label={`${selected.label} (${selected.unit})`}
          keyboardType="decimal-pad"
          value={valueInput}
          onChangeText={setValueInput}
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <AppInput
            label={l('Age', 'Âge', 'العمر')}
            keyboardType="number-pad"
            value={ageInput}
            onChangeText={setAgeInput}
            containerStyle={{ flex: 1 }}
          />
          <AppInput
            label={l('Bodyweight (kg)', 'Poids (kg)', 'الوزن (كغ)')}
            keyboardType="decimal-pad"
            value={bwInput}
            onChangeText={setBwInput}
            containerStyle={{ flex: 1 }}
          />
        </View>

        <AppButton
          label={l('Calculate TOP1% Standing', 'Calculer le rang TOP1%', 'احسب التصنيف')}
          loading={exploreMutation.isPending}
          onPress={() => runExplore()}
          fullWidth
        />
      </AppCard>
    </ScreenContainer>
  );
}
