export const RANK_TIERS = [
  'Unranked',
  'Rookie',
  'Novice',
  'Enthusiast',
  'Intermediate',
  'Veteran',
  'Elite',
  'Champion',
  'Titan',
  'Olympian',
] as const;

export type RankTier = (typeof RANK_TIERS)[number];

export const RANK_DISPLAY_NAMES: Record<RankTier, string> = {
  Unranked: 'Unranked',
  Rookie: 'Wood',
  Novice: 'Bronze',
  Enthusiast: 'Silver',
  Intermediate: 'Gold',
  Veteran: 'Platinum',
  Elite: 'Diamond',
  Champion: 'Champion',
  Titan: 'Titan',
  Olympian: 'Olympian',
};

export const RANK_SR_FLOORS: Record<RankTier, number> = {
  Unranked: 0,
  Rookie: 1,
  Novice: 200,
  Enthusiast: 300,
  Intermediate: 400,
  Veteran: 500,
  Elite: 600,
  Champion: 700,
  Titan: 800,
  Olympian: 900,
};

export const RANK_COLORS: Record<
  RankTier,
  { primary: string; accent: string; text: string }
> = {
  Unranked: { primary: '#7EA1CA', accent: '#2E3C4D', text: '#FAFAFA' },
  Rookie: { primary: '#D88A3D', accent: '#69390B', text: 'rgba(0,0,0,0.75)' },
  Novice: { primary: '#D3834B', accent: '#724322', text: 'rgba(255,255,255,0.9)' },
  Enthusiast: { primary: '#C2CFD2', accent: '#62686A', text: '#1A1A2E' },
  Intermediate: { primary: '#D3A313', accent: '#A27D0A', text: '#1A1A2E' },
  Veteran: { primary: '#5EDED6', accent: '#30AEA6', text: '#1A1A2E' },
  Elite: { primary: '#6A79C7', accent: '#2C2C62', text: '#FAFAFA' },
  Champion: { primary: '#B465D0', accent: '#4D164F', text: '#FAFAFA' },
  Titan: { primary: '#B92323', accent: '#661414', text: '#FAFAFA' },
  Olympian: { primary: '#0BC4FF', accent: '#00417D', text: '#1A1A2E' },
};

export const RANK_AND_DIVISION_ORDER = [
  'Unranked 0',
  'Rookie 1',
  'Rookie 2',
  'Rookie 3',
  'Novice 1',
  'Novice 2',
  'Novice 3',
  'Enthusiast 1',
  'Enthusiast 2',
  'Enthusiast 3',
  'Intermediate 1',
  'Intermediate 2',
  'Intermediate 3',
  'Veteran 1',
  'Veteran 2',
  'Veteran 3',
  'Elite 1',
  'Elite 2',
  'Elite 3',
  'Champion 1',
  'Champion 2',
  'Champion 3',
  'Titan 1',
  'Titan 2',
  'Titan 3',
  'Olympian 1',
] as const;

export const MAX_LEGIT_GSR = 2000;
export const CSR_WEIGHT_CONSTANT = 0.86;
export const MAX_LEGIT_CSR = 14286;
export const TOTAL_MUSCLE_GROUPS_FOR_BODYRANK = 16;

export const RANKED_MUSCLE_GROUPS = [
  'Upper Chest',
  'Lower Chest',
  'Front Delt',
  'Middle Delt',
  'Triceps',
  'Lats',
  'Upper Back',
  'Traps',
  'Rear Delt',
  'Biceps',
  'Forearms',
  'Lower Back',
  'Quadriceps',
  'Hamstrings',
  'Glutes',
  'Abductors',
  'Adductors',
  'Calves',
  'Abdominals',
  'Obliques',
] as const;

export const OMITTED_MUSCLE_GROUPS = [
  'Neck',
  'Cardio',
  'Rotator Cuff',
  'Other',
] as const;

export const ALL_MUSCLE_GROUPS = [
  ...RANKED_MUSCLE_GROUPS,
  ...OMITTED_MUSCLE_GROUPS,
] as const;

export type RankedMuscleGroup = (typeof RANKED_MUSCLE_GROUPS)[number];
export type MuscleGroup = (typeof ALL_MUSCLE_GROUPS)[number];

export const EQUIPMENT_TYPES = [
  'Barbell',
  'Dumbbell',
  'Machine',
  'Cable',
  'Bodyweight',
  'Kettlebell',
  'Smith Machine',
  'Bands',
  'EZ Bar',
  'Trap Bar',
] as const;

export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export const SUPERSET_COLORS = [
  '#C81D1D',
  '#008B16',
  '#033492',
  '#B465D0',
  '#E37241',
  '#225C56',
  '#6B2B0F',
  '#8E1399',
  '#A45C14',
  '#5463B2',
] as const;

export const LEAGUE_TIERS = [
  { tier: 0, name: 'Iron League', csrFloor: 1, color: '#5B7A99', promotePct: 0.66, demotePct: 0 },
  { tier: 1, name: 'Bronze League', csrFloor: 1705, color: '#5E8FB5', promotePct: 0.46, demotePct: 0.05 },
  { tier: 2, name: 'Silver League', csrFloor: 2581, color: '#3E86D4', promotePct: 0.4, demotePct: 0.08 },
  { tier: 3, name: 'Gold League', csrFloor: 3456, color: '#2F7BE6', promotePct: 0.33, demotePct: 0.12 },
  { tier: 4, name: 'Platinum League', csrFloor: 4332, color: '#2E8BF0', promotePct: 0.3, demotePct: 0.15 },
  { tier: 5, name: 'Diamond League', csrFloor: 5208, color: '#3A9BF5', promotePct: 0.26, demotePct: 0.2 },
  { tier: 6, name: 'Master League', csrFloor: 6084, color: '#46AEF8', promotePct: 0.22, demotePct: 0.28 },
  { tier: 7, name: 'Titan League', csrFloor: 6960, color: '#6CCBFB', promotePct: 0.16, demotePct: 0.35 },
  { tier: 8, name: 'Olympian League', csrFloor: 7835, color: '#9BE7FF', promotePct: 0, demotePct: 0.45 },
] as const;

export const BAR_TYPES = [
  { id: 'olympic', name: 'Olympic Bar', weightLbs: 45, weightKg: 20 },
  { id: 'womens', name: "Women's Bar", weightLbs: 35, weightKg: 15 },
  { id: 'ezBar', name: 'EZ Curl Bar', weightLbs: 25, weightKg: 10 },
  { id: 'trapBar', name: 'Trap / Hex Bar', weightLbs: 55, weightKg: 25 },
  { id: 'smith', name: 'Smith Bar', weightLbs: 20, weightKg: 10 },
] as const;

export const STANDARD_LBS_PLATES = [45, 35, 25, 10, 5, 2.5] as const;
export const STANDARD_KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25] as const;
