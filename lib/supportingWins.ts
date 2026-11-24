import type {AthleteDossier} from './athleteDossier';
import type {EquipmentOption} from './personalWorkspace';
import type {ProgramOpportunity} from './programOpportunities';

export type SupportingWinSuggestion = {
  metric: string;
  pairedWithMainGoal: string;
  basis: 'study' | 'movement';
  evidenceId?: string;
  /** Additional weekly minutes required (0 when folded into existing main-goal warm-up/sessions). */
  extraWeeklyMinutes: number;
  requiredEquipment: EquipmentOption[];
  canDisplaceMainGoal: false;
  separateTestRequired: true;
  transferStatus: 'hypothesis-only';
  whyItFits: [string, string, string];
};

type PairRule = {
  mainMetric: string;
  supportMetric: string;
  basis: 'study' | 'movement';
  evidenceId?: string;
  requiredEquipment: EquipmentOption[];
  extraWeeklyMinutes: number;
  whyItFits: [string, string, string];
};

const SUPPORTING_WIN_RULES: readonly PairRule[] = [
  {
    mainMetric: 'bench_1rm',
    supportMetric: 'pushups',
    basis: 'study',
    evidenceId: 'kikuchi-nakazato-2017',
    requiredEquipment: [],
    extraWeeklyMinutes: 0,
    whyItFits: [
      'Shares horizontal pressing work with your bench press inside the same weekly budget (zero extra equipment). Each goal still needs its own measured test.',
      'Partage le travail de poussée avec ton développé couché dans le même budget temps (sans matériel supplémentaire). Chaque objectif garde son propre test.',
      'يشترك في جهد الدفع مع ضغط الصدر ضمن الوقت الأسبوعي نفسه ودون معدات إضافية. ويحتفظ كل هدف باختباره الخاص.',
    ],
  },
  {
    mainMetric: 'bench_1rm',
    supportMetric: 'dips',
    basis: 'movement',
    requiredEquipment: [],
    extraWeeklyMinutes: 5,
    whyItFits: [
      'Builds upper-body pressing stability alongside bench press without displacing your main goal.',
      'Renforce la stabilité en poussée aux côtés du développé couché sans remplacer ton objectif principal.',
      'يدعم ثبات الدفع إلى جانب ضغط الصدر دون أن يزيح هدفك الرئيسي.',
    ],
  },
  {
    mainMetric: 'squat_1rm',
    supportMetric: 'cmj',
    basis: 'study',
    evidenceId: 'hartmann-2012',
    requiredEquipment: [],
    extraWeeklyMinutes: 0,
    whyItFits: [
      'Squat training frequently supports vertical jump power in the same lower-body sessions. Jump height is still verified on its own test.',
      'L’entraînement au squat soutient souvent la détente verticale dans les mêmes séances. La hauteur de saut reste vérifiée par son propre test.',
      'يدعم تدريب القرفصاء قوة القفز العمودي ضمن الحصص نفسها، ويُتحقّق من القفز باختباره المستقل.',
    ],
  },
  {
    mainMetric: 'pullups',
    supportMetric: 'dead_hang',
    basis: 'movement',
    requiredEquipment: ['pullup_bar'],
    extraWeeklyMinutes: 0,
    whyItFits: [
      'Uses the same pull-up bar and grip stimulus at the end of pulling sessions with zero extra visits.',
      'Utilise la même barre de traction et sollicite la prise en fin de séance, sans visite supplémentaire.',
      'يستخدم بار العقلة نفسه ويقوّي القبضة في نهاية الحصة دون أيام إضافية.',
    ],
  },
  {
    mainMetric: 'pullup_1rm',
    supportMetric: 'dead_hang',
    basis: 'movement',
    requiredEquipment: ['pullup_bar'],
    extraWeeklyMinutes: 0,
    whyItFits: [
      'Reinforces bar grip on the same pull-up bar without adding another training day.',
      'Renforce la prise sur la même barre sans ajouter de jour d’entraînement.',
      'يعزّز قوة القبضة على البار نفسه دون إضافة يوم تدريب آخر.',
    ],
  },
  {
    mainMetric: 'run_5k',
    supportMetric: 'sprint_400m',
    basis: 'movement',
    requiredEquipment: ['outdoor'],
    extraWeeklyMinutes: 0,
    whyItFits: [
      'Relaxed running strides fit naturally into your 5 km warm-up/cool-down without extra weekly days.',
      'Quelques lignes droites relâchées s’intègrent facilement à tes sorties 5 km sans journée supplémentaire.',
      'تندمج تسارعات الجري المريحة بسهولة مع حصص الـ 5 كم دون أيام إضافية.',
    ],
  },
  {
    mainMetric: 'pushups',
    supportMetric: 'bench_1rm',
    basis: 'study',
    evidenceId: 'kikuchi-nakazato-2017',
    requiredEquipment: ['barbell'],
    extraWeeklyMinutes: 0,
    whyItFits: [
      'Shared horizontal pressing stimulus with barbell access; each lift keeps its own separate retest.',
      'Stimulus de poussée partagé avec accès à une barre ; chaque performance garde son propre retest.',
      'محفّز دفع مشترك عند توفر البار؛ ويحتفظ كل اختبار بقياسه المستقل.',
    ],
  },
];

/**
 * Recommends compatible supporting wins alongside up to 2 pinned main goals.
 * Filters strictly by available equipment and remaining time budget; never displaces a main goal.
 */
export function suggestSupportingWins(input: {
  dossier: AthleteDossier;
  opportunities?: readonly ProgramOpportunity[];
  activeGoalMetrics?: readonly string[];
}): SupportingWinSuggestion[] {
  const {dossier} = input;
  const pinned = dossier.pinnedMetrics.slice(0, 2);
  const activeSet = new Set([
    ...pinned,
    ...(input.activeGoalMetrics ?? dossier.goals.map(g => g.metric)),
  ]);
  const equipment = dossier.constraints.equipment.value;
  const weeklyBudget =
    dossier.constraints.weeklyDays.value * dossier.constraints.defaultMinutes.value;
  const measuredSet = new Set(
    input.opportunities?.map(o => o.metric) ?? Object.keys(dossier.measuredResults),
  );

  const suggestions: SupportingWinSuggestion[] = [];
  const seen = new Set<string>();

  for (const main of pinned) {
    for (const rule of SUPPORTING_WIN_RULES) {
      if (rule.mainMetric !== main) continue;
      if (activeSet.has(rule.supportMetric) || seen.has(rule.supportMetric)) continue;
      // Check equipment feasibility when equipment is explicitly declared
      if (
        equipment.length > 0 &&
        rule.requiredEquipment.length > 0 &&
        !rule.requiredEquipment.every(req => equipment.includes(req))
      ) {
        continue;
      }
      // Respect tight weekly budgets: skip extra-time wins if weekly budget <= 60 min
      if (weeklyBudget <= 60 && rule.extraWeeklyMinutes > 0) continue;

      seen.add(rule.supportMetric);
      suggestions.push({
        metric: rule.supportMetric,
        pairedWithMainGoal: main,
        basis: rule.basis,
        evidenceId: rule.evidenceId,
        extraWeeklyMinutes: rule.extraWeeklyMinutes,
        requiredEquipment: rule.requiredEquipment,
        canDisplaceMainGoal: false,
        separateTestRequired: true,
        transferStatus: 'hypothesis-only',
        whyItFits: rule.whyItFits,
      });
    }
  }

  // Prefer study-backed pairings, then already-measured candidates, then zero extra time.
  return suggestions.sort((a, b) => {
    const aStudy = a.basis === 'study' ? 1 : 0;
    const bStudy = b.basis === 'study' ? 1 : 0;
    if (bStudy !== aStudy) return bStudy - aStudy;
    const aMeasured = measuredSet.has(a.metric) ? 1 : 0;
    const bMeasured = measuredSet.has(b.metric) ? 1 : 0;
    if (bMeasured !== aMeasured) return bMeasured - aMeasured;
    return a.extraWeeklyMinutes - b.extraWeeklyMinutes;
  });
}
