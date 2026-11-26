import React, { useEffect, useState } from 'react';
import { Animated, Image, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { JYMBO_MASCOT_PNGS, RIVE_WEB_URLS } from '../../assets/v3AssetRegistry';
import { useFloatEffect } from '../../theme/animations';
import { useTheme } from '../../theme/ThemeProvider';
import { ensureLocalRiveWasm } from './riveSetup';

export type JymboPose =
  | 'Neutral'
  | 'Salute'
  | 'Confident'
  | 'Notes'
  | 'Congrats'
  | 'Curling'
  | 'Pushups'
  | 'Chilling'
  | 'Cool'
  | 'Lazy'
  | 'Resting'
  | 'Reminder'
  | 'Path'
  | 'Selfie';

/**
 * Exact stateIdx mapping extracted from mod_07809_triggerNoteTaking.js (jymbo.riv, stateMachine 'MAIN')
 */
const RIVE_POSE_INDEX: Partial<Record<JymboPose, number>> = {
  Neutral: 0,
  Salute: 1,
  Confident: 2,
  Notes: 4,
  Congrats: 5,
  Curling: 6,
};

const POSE_TO_PNG_KEY: Record<JymboPose, string> = {
  Neutral: 'jymboneutral',
  Salute: 'jymbosalute',
  Confident: 'jymbocool',
  Notes: 'jymbonotes',
  Congrats: 'jymbocongrats',
  Curling: 'jymbopushups',
  Pushups: 'jymbopushups',
  Chilling: 'jymbochilling',
  Cool: 'jymbocool',
  Lazy: 'jymbolazy',
  Resting: 'jymboresting',
  Reminder: 'jymboreminder',
  Path: 'jymbopath',
  Selfie: 'jymboselfie',
};

export interface JymboRiveProps {
  pose?: JymboPose;
  size?: number;
  premium?: boolean;
  curlIntense?: boolean;
  skipTransition?: boolean;
  noteTriggerKey?: number;
  showShadow?: boolean;
  shadowColor?: string;
  useLiveRive?: boolean;
  style?: StyleProp<ViewStyle>;
}

function WebJymboRiveCanvas({
  pose,
  size,
  premium,
  curlIntense,
  skipTransition,
  noteTriggerKey,
  onFallback,
}: {
  pose: JymboPose;
  size: number;
  premium: boolean;
  curlIntense: boolean;
  skipTransition: boolean;
  noteTriggerKey: number;
  onFallback: () => void;
}) {
  ensureLocalRiveWasm();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useRive, useStateMachineInput, Layout, Fit, Alignment } = require('@rive-app/react-canvas');

  const src = premium ? RIVE_WEB_URLS.jymboPremium : RIVE_WEB_URLS.jymbo;
  const { rive, RiveComponent } = useRive({
    src,
    artboard: 'production',
    stateMachines: 'MAIN',
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    onLoadError: () => onFallback(),
  });

  const stateIdxInput = useStateMachineInput(rive, 'MAIN', 'stateIdx');
  const premiumInput = useStateMachineInput(rive, 'MAIN', 'premium');
  const curlInput = useStateMachineInput(rive, 'MAIN', 'curlIntense');
  const skipInput = useStateMachineInput(rive, 'MAIN', 'skipTransition');
  const takeNoteTrigger = useStateMachineInput(rive, 'MAIN', 'takeNote');

  useEffect(() => {
    const idx = RIVE_POSE_INDEX[pose] ?? 0;
    if (skipInput) skipInput.value = skipTransition;
    if (stateIdxInput) stateIdxInput.value = idx;
    if (premiumInput) premiumInput.value = premium;
    if (curlInput) curlInput.value = curlIntense;
  }, [pose, premium, curlIntense, skipTransition, stateIdxInput, premiumInput, curlInput, skipInput]);

  useEffect(() => {
    if (pose === 'Notes' && takeNoteTrigger && noteTriggerKey > 0) {
      try {
        takeNoteTrigger.fire();
      } catch {
        // ignore if input not ready
      }
    }
  }, [pose, noteTriggerKey, takeNoteTrigger]);

  return (
    <View style={{ width: size, height: size, overflow: 'visible' }}>
      <RiveComponent style={{ width: size, height: size, display: 'block' }} />
    </View>
  );
}

/**
 * Live Jymbo Mascot modeled on mod_07809_triggerNoteTaking.js:
 * Renders real jymbo.riv / jymbo_premium.riv via Rive state machine 'MAIN' on Web,
 * with seamless fallback to the 21 extracted Jymbo expression PNGs + 3D floor shadow.
 */
export function JymboRive({
  pose = 'Neutral',
  size = 148,
  premium = false,
  curlIntense = false,
  skipTransition = false,
  noteTriggerKey = 0,
  showShadow = true,
  shadowColor,
  useLiveRive = true,
  style,
}: JymboRiveProps) {
  const { theme } = useTheme();
  const [riveFailed, setRiveFailed] = useState(false);
  const floatY = useFloatEffect(5, 2200);

  const supportsLiveRive =
    useLiveRive && Platform.OS === 'web' && !riveFailed && pose in RIVE_POSE_INDEX;

  const basePngKey = POSE_TO_PNG_KEY[pose] ?? 'jymboneutral';
  const premiumPngKey = `${basePngKey}premium`;
  const pngSource =
    (premium && JYMBO_MASCOT_PNGS[premiumPngKey]) ||
    JYMBO_MASCOT_PNGS[basePngKey] ||
    JYMBO_MASCOT_PNGS.jymboneutral;

  const shadowSize = size * 0.68;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
        },
        style,
      ]}
    >
      {supportsLiveRive ? (
        <WebJymboRiveCanvas
          pose={pose}
          size={size}
          premium={premium}
          curlIntense={curlIntense}
          skipTransition={skipTransition}
          noteTriggerKey={noteTriggerKey}
          onFallback={() => setRiveFailed(true)}
        />
      ) : (
        <Animated.View
          style={{
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ translateY: floatY }],
          }}
        >
          <Image
            source={pngSource}
            resizeMode="contain"
            style={{ width: size * 0.92, height: size * 0.92 }}
          />
        </Animated.View>
      )}

      {showShadow ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: -shadowSize * 0.44,
            width: shadowSize,
            height: shadowSize,
            borderRadius: 999,
            backgroundColor: shadowColor ?? theme.colors.thirdBg,
            opacity: 0.72,
            transform: [{ rotateX: '80deg' }],
            zIndex: -1,
          }}
        />
      ) : null}
    </View>
  );
}
