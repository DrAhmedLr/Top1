import React from 'react';
import { View } from 'react-native';
import { AppCard, AppText } from '../ui';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';

const PYRAMID_TIERS = [
  { label: 'Top 0.1%', reps: 85, color: '#FACC15' },
  { label: 'Top 1%', reps: 65, color: '#38BDF8' },
  { label: 'Top 5%', reps: 50, color: '#A855F7' },
  { label: 'Top 15%', reps: 38, color: '#22C55E' },
  { label: 'Top 35%', reps: 28, color: '#FB923C' },
  { label: 'Base', reps: 15, color: '#94A3B8' },
] as const;

/**
 * Interactive Push-Up Pyramid (ported from Top1.Fit PushupPyramid.tsx)
 * visualizing where the athlete's unbroken push-up reps sit on the TOP1% pyramid.
 */
export function PushupPyramidCard({
  currentReps,
  title = 'TOP1% Push-Up Pyramid',
}: {
  currentReps: number | null;
  title?: string;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const reps = currentReps ?? 0;

  return (
    <AppCard style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <AppText size="xxsm" weight="xbold" tone="constant">
            CALISTHENICS LADDER
          </AppText>
          <AppText size="md" weight="black">
            {title}
          </AppText>
        </View>
        <AppText size="md" weight="black" tone="constant">
          {currentReps !== null ? `${currentReps} reps` : 'Unlogged'}
        </AppText>
      </View>

      <View style={{ alignItems: 'center', gap: 5 }}>
        {PYRAMID_TIERS.map((tier, idx) => {
          const widthPct = 44 + idx * 11;
          const reached = currentReps !== null && reps >= tier.reps;
          return (
            <View
              key={tier.label}
              style={{
                width: `${widthPct}%`,
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: RADII.input,
                backgroundColor: reached ? hexToRgba(tier.color, 0.25) : c.thirdBg,
                borderWidth: 1,
                borderColor: reached ? tier.color : 'rgba(255,255,255,0.06)',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <AppText
                size="xxsm"
                weight="black"
                style={{ color: reached ? tier.color : c.subText }}
              >
                {tier.label}
              </AppText>
              <AppText size="xxsm" weight="bold" tone={reached ? 'default' : 'sub'}>
                {tier.reps}+ reps {reached ? '✓' : ''}
              </AppText>
            </View>
          );
        })}
      </View>
    </AppCard>
  );
}
