import type { RankTier } from '@apexlift/shared';

/**
 * Exact multi-stop metallic & crystal rank gradients extracted from mod_01567_getRankSVGGradient.js
 */
export const RANK_BODYGRAPH_GRADIENTS: Record<RankTier, [string, string]> = {
  Olympian: ['#00BEFF', '#A1E7FF'],
  Titan: ['#A01911', '#FF1D1D'],
  Champion: ['#BA55D3', '#FDAEFF'],
  Elite: ['#6C6CE9', '#C6C2FF'],
  Veteran: ['#45BAB3', '#78F0E9'],
  Intermediate: ['#E6AE08', '#FFE37E'],
  Enthusiast: ['#7B8B91', '#A5BBC3'],
  Novice: ['#D3834B', '#FFAD73'],
  Rookie: ['#743B00', '#C47017'],
  Unranked: ['#3E3752', '#524A6B'],
};

export const RANK_METALLIC_GRADIENTS: Record<RankTier, string[]> = {
  Olympian: ['#FFD87B', '#00BEFF'],
  Titan: ['#A01911', '#FF1D1D'],
  Champion: ['#BA55D3', '#FDAEFF', '#BA55D3'],
  Elite: ['#6C6CE9', '#C6C2FF', '#6C6CE9'],
  Veteran: ['#45BAB3', '#B9FFFB', '#49A39D', '#89E5E0'],
  Intermediate: ['#E6AE08', '#FFE37E', '#D29907', '#EEBE40'],
  Enthusiast: ['#C2CFD2', '#F0FBFF', '#CCDDE2', '#D7E7EC'],
  Novice: ['#D3834B', '#FFAD73', '#D38A56', '#ECA26D'],
  Rookie: ['#C47017', '#743B00', '#C47017'],
  Unranked: ['#4A4260', '#635A7E'],
};

export const RANK_BG_GRADIENTS: Record<RankTier, [string, string]> = {
  Olympian: ['#103B52', '#262040'],
  Titan: ['#4A0E0B', '#22090B'],
  Champion: ['#421D4D', '#1E1128'],
  Elite: ['#28295C', '#161630'],
  Veteran: ['#143B39', '#0E2125'],
  Intermediate: ['#4C3A05', '#221A08'],
  Enthusiast: ['#383E42', '#1C1E24'],
  Novice: ['#452A17', '#21150E'],
  Rookie: ['#381F06', '#1D1209'],
  Unranked: ['#1E192B', '#151020'],
};

export const RANK_SOLID_ACCENT: Record<RankTier, string> = {
  Olympian: '#00BEFF',
  Titan: '#FF3B30',
  Champion: '#D075E8',
  Elite: '#7D7DFF',
  Veteran: '#54DED6',
  Intermediate: '#F2BC1B',
  Enthusiast: '#C2CFD2',
  Novice: '#E08E55',
  Rookie: '#C47017',
  Unranked: '#7EA1CA',
};
