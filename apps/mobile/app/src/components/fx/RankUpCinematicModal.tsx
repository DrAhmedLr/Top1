import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { RankTier } from '@apexlift/shared';
import { RIVE_WEB_URLS } from '../../assets/v3AssetRegistry';
import { JymboRive, ensureLocalRiveWasm } from '../mascot';
import { AnimatedRankShine } from '../rank/AnimatedRankShine';
import { AppButton, AppText, RankBadge } from '../ui';
import { USE_NATIVE_DRIVER } from '../../theme/animations';
import { RANK_SOLID_ACCENT } from '../../theme/rankGradients';
import { useTheme } from '../../theme/ThemeProvider';
import { hexToRgba, RADII } from '../../theme/tokens';
import { impactHeavy, notifySuccess } from '../../utils/haptics';
import { playRankTierSting } from '../../utils/soundscape';
import { ConfettiOverlay } from './ConfettiOverlay';

export interface RankUpCinematicModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  tier: RankTier;
  division?: 0 | 1 | 2 | 3;
  rating?: number;
  deltaSr?: number;
  mode?: 'rank' | 'muscle';
  muscleName?: string;
}

const MUSCLE_GROUP_TO_RIVE: Record<string, string> = {
  Biceps: 'bicep',
  'Front Delt': 'frontDelt',
  'Middle Delt': 'midDelt',
  'Rear Delt': 'rearDelt',
  Triceps: 'tricep',
  Forearms: 'forearm',
  'Upper Chest': 'upperChest',
  'Lower Chest': 'lowerChest',
  Obliques: 'oblique',
  Abdominals: 'abs',
  Traps: 'traps',
  'Upper Back': 'upperBack',
  Lats: 'lats',
  'Lower Back': 'lowerBack',
  Glutes: 'glutes',
  Abductors: 'abductor',
  Adductors: 'adductor',
  Quadriceps: 'quads',
  Hamstrings: 'hamstring',
  Calves: 'calves',
};

/**
 * Web Rive player bound directly to RankUpVM (rank_up.riv) and BodyrankMuscleRankUpVM (muscle_rank_up.riv)
 * using exact ViewModel property & trigger keys from mod_08933_module.js.
 */
function BoundRankUpRive({
  mode,
  title,
  muscleName,
  visible,
}: {
  mode: 'rank' | 'muscle';
  title: string;
  muscleName?: string;
  visible: boolean;
}) {
  const [failed, setFailed] = useState(false);
  ensureLocalRiveWasm();

  if (Platform.OS !== 'web' || failed) return null;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useRive, Layout, Fit, Alignment } = require('@rive-app/react-canvas');
  const src = mode === 'muscle' ? RIVE_WEB_URLS.muscleRankUp : RIVE_WEB_URLS.rankUp;

  const { rive, RiveComponent } = useRive({
    src,
    artboard: 'main',
    animations: mode === 'muscle' ? undefined : ['rankUp', 'idleIconEnd'],
    autoplay: true,
    autoBind: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    onLoadError: () => setFailed(true),
  });

  useEffect(() => {
    if (!rive || !visible) return;
    const vmi = rive.viewModelInstance;
    if (!vmi) return;
    try {
      if (mode === 'muscle') {
        const riveMuscle = (muscleName && MUSCLE_GROUP_TO_RIVE[muscleName]) || 'upperChest';
        const mProp = vmi.string?.('muscle');
        if (mProp) mProp.value = riveMuscle;
        const seqProp = vmi.string?.('sequenceVers');
        if (seqProp) seqProp.value = 'loop';
        const hProp = vmi.string?.('header');
        if (hProp) hProp.value = title;
        const demoProp = vmi.boolean?.('demo');
        if (demoProp) demoProp.value = true;
        const lastProp = vmi.boolean?.('isLastMuscle');
        if (lastProp) lastProp.value = true;

        vmi.trigger?.('startSequence')?.trigger();
        vmi.trigger?.('playRankUp')?.trigger();
      } else {
        const hProp = vmi.string?.('header');
        if (hProp) hProp.value = title;
        vmi.trigger?.('playRankUp')?.trigger();
        vmi.trigger?.('impact')?.trigger();
      }
      rive.play();
    } catch {
      // graceful fallback
    }
  }, [rive, visible, mode, title, muscleName]);

  return (
    <View style={{ width: 230, height: 230, alignItems: 'center', justifyContent: 'center' }}>
      <RiveComponent style={{ width: 230, height: 230, display: 'block' }} />
    </View>
  );
}

/**
 * Full-screen Rank-Up Cinematic Modal modeled on mod_09247_LiftoffRankUpModalTsx.js
 * & mod_08930_SummaryRankUpModalV2Tsx.js with ViewModel-bound rank_up.riv / muscle_rank_up.riv,
 * sunburst rays, confetti particles, Jymbo Congrats, and exact tier fanfare audio.
 */
export function RankUpCinematicModal({
  visible,
  onClose,
  title = 'RANK UP!',
  subtitle,
  tier,
  division = 1,
  rating,
  deltaSr,
  mode = 'rank',
  muscleName,
}: RankUpCinematicModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const accent = RANK_SOLID_ACCENT[tier] ?? c.constant;
  const badgeScale = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (!visible) return;
    impactHeavy();
    notifySuccess();
    playRankTierSting(tier);

    badgeScale.setValue(0.35);
    Animated.spring(badgeScale, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [visible, tier, badgeScale]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(8, 5, 16, 0.92)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <ConfettiOverlay visible={visible} count={42} />

        <LinearGradient
          colors={[hexToRgba(accent, 0.28), '#161026', '#0F0A18']}
          style={{
            width: '100%',
            maxWidth: 390,
            borderRadius: RADII.cardLarge,
            borderWidth: 1.5,
            borderColor: hexToRgba(accent, 0.65),
            padding: 24,
            alignItems: 'center',
            gap: 14,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              paddingHorizontal: 14,
              paddingVertical: 5,
              borderRadius: 99,
              backgroundColor: hexToRgba(accent, 0.2),
              borderWidth: 1,
              borderColor: accent,
            }}
          >
            <AppText size="xsm" weight="black" style={{ color: accent, letterSpacing: 1.4 }}>
              {title}
            </AppText>
          </View>

          {/* Sunburst + Live ViewModel-Bound Rive Energy Surge + Sculpted Badge */}
          <View style={{ width: 230, height: 230, alignItems: 'center', justifyContent: 'center' }}>
            <View
              style={{
                position: 'absolute',
                width: 220,
                height: 220,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.5,
              }}
            >
              <AnimatedRankShine size={220} baseColor={accent} />
            </View>
            <View style={{ position: 'absolute', opacity: 0.88 }} pointerEvents="none">
              <BoundRankUpRive
                mode={mode}
                title={title}
                muscleName={muscleName}
                visible={visible}
              />
            </View>
            <Animated.View style={{ transform: [{ scale: badgeScale }] }}>
              <RankBadge tier={tier} division={division} size={136} showLabel floating />
            </Animated.View>
          </View>

          {rating ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <AppText size="xxl" weight="black" style={{ color: accent }} tabular>
                {rating} SR
              </AppText>
              {deltaSr && deltaSr > 0 ? (
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 99,
                    backgroundColor: hexToRgba(c.check, 0.2),
                  }}
                >
                  <AppText size="xsm" weight="black" tone="check" tabular>
                    +{deltaSr} SR
                  </AppText>
                </View>
              ) : null}
            </View>
          ) : null}

          {subtitle ? (
            <AppText size="sm" tone="sub" align="center" style={{ maxWidth: 300 }}>
              {subtitle}
            </AppText>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <JymboRive pose="Congrats" size={76} showShadow={false} />
            <AppText size="xsm" weight="bold" tone="sub" style={{ flex: 1 }}>
              Jymbo: &quot;Unstoppable! Keep pushing and claim your next tier!&quot;
            </AppText>
          </View>

          <AppButton title="Claim & Continue" variant="gold" size="lg" fullWidth onPress={onClose} />
        </LinearGradient>
      </View>
    </Modal>
  );
}
