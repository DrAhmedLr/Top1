import React from 'react';
import { View } from 'react-native';
import Svg, { Defs, G, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import {
  RANK_TIERS,
  TOP1_RECOVERY_COLORS,
  TOP1_VOLUME_COLORS,
  type RankTier,
} from '@apexlift/shared';
import type { RecoveryBand, VolumeZone } from '@top1/engine';
import { RANK_BODYGRAPH_GRADIENTS } from '../../theme/rankGradients';
import { useTheme } from '../../theme/ThemeProvider';
import {
  FEMALE_BACK_BODYGRAPH,
  FEMALE_FRONT_BODYGRAPH,
  MALE_BACK_BODYGRAPH,
  MALE_FRONT_BODYGRAPH,
} from './bodygraphPaths';

export type BodygraphMode = 'capability' | 'recovery' | 'volume';

export interface MuscleRankEntry {
  muscle: string;
  rating: number;
  tier: string;
  division: number;
  label: string;
  topExerciseName: string | null;
  topExerciseId: string | null;
  exerciseCount: number;
  // Optional TOP1% physiology fields for Recovery & Weekly Volume modes
  recoveryPercent?: number;
  recoveryBand?: RecoveryBand;
  volumeZone?: VolumeZone;
  protectedForUpcomingGoal?: boolean;
}

interface MuscleBodygraphSvgProps {
  muscles: Record<string, MuscleRankEntry>;
  side: 'front' | 'back';
  mode?: BodygraphMode;
  isFemale?: boolean;
  selectedMuscle?: string | null;
  onSelectMuscle?: (muscle: string) => void;
  height?: number;
}

const RECOVERY_BANDS: readonly RecoveryBand[] = ['fresh', 'ready', 'recovering', 'fatigued'];
const VOLUME_ZONES: readonly VolumeZone[] = ['under_mev', 'optimal_mav', 'near_mrv', 'over_mrv'];

/**
 * Exact anatomical Front & Back SVG Bodygraph upgraded for Unified TOP1% Fusion:
 * - 'capability': TOP1% capability tier metallic gradients
 * - 'recovery': Live physiological local recovery % bands + 36h pinned-goal protection border
 * - 'volume': Trailing 7-day fractional hard sets vs individualized MEV / MAV / MRV zones
 */
export function MuscleBodygraphSvg({
  muscles,
  side,
  mode = 'capability',
  isFemale = false,
  selectedMuscle,
  onSelectMuscle,
  height = 310,
}: MuscleBodygraphSvgProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const geometry =
    side === 'front'
      ? isFemale
        ? FEMALE_FRONT_BODYGRAPH
        : MALE_FRONT_BODYGRAPH
      : isFemale
        ? FEMALE_BACK_BODYGRAPH
        : MALE_BACK_BODYGRAPH;

  const width = Math.round((geometry.width / geometry.height) * height);
  const idPrefix = `bg_${mode}_${side}_${isFemale ? 'f' : 'm'}_${height}`;

  const bodyFill = theme.dark ? '#1C162B' : '#E7E5F5';
  const contourStroke = theme.dark ? '#4B4363' : '#9B96B8';
  const unrankedMuscleFill = theme.dark ? '#312A45' : '#CBCBE0';

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={width} height={height} viewBox={geometry.viewBox} fill="none">
        <Defs>
          {RANK_TIERS.map((tier) => {
            const [startCol, endCol] = RANK_BODYGRAPH_GRADIENTS[tier];
            return (
              <SvgLinearGradient
                key={tier}
                id={`${idPrefix}_cap_${tier}`}
                x1="0%"
                y1="100%"
                x2="100%"
                y2="0%"
              >
                <Stop offset="0%" stopColor={startCol} />
                <Stop offset="100%" stopColor={endCol} />
              </SvgLinearGradient>
            );
          })}
          {RECOVERY_BANDS.map((band) => {
            const [startCol, endCol] = TOP1_RECOVERY_COLORS[band];
            return (
              <SvgLinearGradient
                key={band}
                id={`${idPrefix}_rec_${band}`}
                x1="0%"
                y1="100%"
                x2="100%"
                y2="0%"
              >
                <Stop offset="0%" stopColor={startCol} />
                <Stop offset="100%" stopColor={endCol} />
              </SvgLinearGradient>
            );
          })}
          {VOLUME_ZONES.map((zone) => {
            const [startCol, endCol] = TOP1_VOLUME_COLORS[zone];
            return (
              <SvgLinearGradient
                key={zone}
                id={`${idPrefix}_vol_${zone}`}
                x1="0%"
                y1="100%"
                x2="100%"
                y2="0%"
              >
                <Stop offset="0%" stopColor={startCol} />
                <Stop offset="100%" stopColor={endCol} />
              </SvgLinearGradient>
            );
          })}
        </Defs>

        {/* Anatomical Silhouette Contours */}
        <G>
          {geometry.contours.map((d, idx) => (
            <Path
              key={`contour_${idx}`}
              d={d}
              fill={bodyFill}
              stroke={contourStroke}
              strokeWidth={geometry.strokeWidth}
            />
          ))}
          {geometry.hair ? (
            <Path
              d={geometry.hair.d}
              fill={unrankedMuscleFill}
              stroke={geometry.hair.stroked ? contourStroke : undefined}
              strokeWidth={geometry.hair.stroked ? geometry.strokeWidth : undefined}
              strokeMiterlimit={geometry.hair.stroked ? 10 : undefined}
            />
          ) : null}
        </G>

        {/* 42-44 Anatomical Muscle Paths */}
        <G>
          {geometry.muscles.map((item, idx) => {
            const entry = muscles[item.muscle];
            const isSelected = Boolean(selectedMuscle && selectedMuscle === item.muscle);
            const isDimmed = Boolean(selectedMuscle && selectedMuscle !== item.muscle);
            const isProtected = Boolean(entry?.protectedForUpcomingGoal);

            let fill = unrankedMuscleFill;
            if (mode === 'recovery') {
              const band: RecoveryBand = entry?.recoveryBand ?? 'fresh';
              fill = `url(#${idPrefix}_rec_${band})`;
            } else if (mode === 'volume') {
              const zone: VolumeZone = entry?.volumeZone ?? 'under_mev';
              fill = `url(#${idPrefix}_vol_${zone})`;
            } else {
              const hasRank = Boolean(entry && entry.rating > 0);
              const tier = (hasRank ? entry!.tier : 'Unranked') as RankTier;
              fill = hasRank
                ? `url(#${idPrefix}_cap_${tier})`
                : isSelected
                  ? c.constant
                  : unrankedMuscleFill;
            }

            const stroke = isSelected
              ? '#FFFFFF'
              : mode !== 'capability' && isProtected
                ? '#38BDF8'
                : 'rgba(10,7,18,0.28)';
            const strokeWidth = isSelected
              ? geometry.strokeWidth * 0.9
              : mode !== 'capability' && isProtected
                ? geometry.strokeWidth * 0.6
                : geometry.strokeWidth * 0.3;

            return (
              <Path
                key={`muscle_${item.muscle}_${idx}`}
                d={item.d}
                fill={fill}
                fillOpacity={isDimmed ? 0.25 : 1}
                stroke={stroke}
                strokeWidth={strokeWidth}
                onPress={onSelectMuscle ? () => onSelectMuscle(item.muscle) : undefined}
              />
            );
          })}
        </G>
      </Svg>
    </View>
  );
}
