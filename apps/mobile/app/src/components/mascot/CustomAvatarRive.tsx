import React, { useEffect, useState } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import type { RankTier } from '@apexlift/shared';
import { RIVE_WEB_URLS } from '../../assets/v3AssetRegistry';
import { RANK_BODYGRAPH_GRADIENTS } from '../../theme/rankGradients';
import { ensureLocalRiveWasm } from './riveSetup';

/**
 * Exact ViewModel string enum values extracted from mod_06286_module.js & mod_06284_applyHexAlphaChannel.js
 */
export const AVATAR_DISPLAY_MODES = [
  { id: 'display_default', label: 'Portrait' },
  { id: 'display_idle', label: 'Idle Pose' },
  { id: 'display_bodygraphFront', label: 'BodyRank Front' },
  { id: 'display_bodygraphBack', label: 'BodyRank Back' },
] as const;
export type AvatarDisplayMode = (typeof AVATAR_DISPLAY_MODES)[number]['id'];

export const AVATAR_BODY_TYPES = [
  { id: 'body_A', label: 'Athletic' },
  { id: 'body_B', label: 'Broad' },
  { id: 'body_C', label: 'Lean' },
  { id: 'body_D', label: 'Power' },
  { id: 'body_E', label: 'Sculpted' },
  { id: 'body_F', label: 'Titan' },
] as const;

export const AVATAR_HEAD_SHAPES = [
  { id: 'headShape_A', label: 'Round' },
  { id: 'headShape_B', label: 'Square' },
  { id: 'headShape_C', label: 'Heart' },
  { id: 'headShape_D', label: 'Oval' },
  { id: 'headShape_E', label: 'Sharp' },
] as const;

export const AVATAR_EYE_SHAPES = [
  { id: 'eyeShape_A1', label: 'Default' },
  { id: 'eyeShape_A2', label: 'Serious' },
  { id: 'eyeShape_A3', label: 'Happy' },
  { id: 'eyeShape_A4', label: 'Cool' },
  { id: 'eyeShape_A5', label: 'Fierce' },
  { id: 'eyeShape_A6', label: 'Bright' },
  { id: 'eyeShape_A7', label: 'Curious' },
] as const;

export const AVATAR_MOUTH_SHAPES = [
  { id: 'mouthShape_A', label: 'Smirk' },
  { id: 'mouthShape_B', label: 'Grin' },
  { id: 'mouthShape_C', label: 'Open Smile' },
  { id: 'mouthShape_D', label: 'Crooked' },
  { id: 'mouthShape_F', label: 'Excited' },
  { id: 'mouthShape_H', label: 'Locked In' },
  { id: 'mouthShape_I', label: 'Neutral' },
  { id: 'mouthShape_J', label: 'Playful' },
] as const;

export const AVATAR_HAIR_STYLES = [
  { id: 'hairStyle_A', label: 'Bald' },
  { id: 'hairStyle_B', label: 'Buzz' },
  { id: 'hairStyle_C1', label: 'Short' },
  { id: 'hairStyle_C2', label: 'Short Wavy' },
  { id: 'hairStyle_C3', label: 'Short Curly' },
  { id: 'hairStyle_D1', label: 'Medium' },
  { id: 'hairStyle_D2', label: 'Med Wavy' },
  { id: 'hairStyle_D3', label: 'Med Curly' },
  { id: 'hairStyle_E1', label: 'Twin' },
  { id: 'hairStyle_F1', label: 'Long' },
  { id: 'hairStyle_F2', label: 'Long Wavy' },
  { id: 'hairStyle_F3', label: 'Long Curly' },
] as const;

export const AVATAR_BEARD_STYLES = [
  { id: 'beardStyle_A', label: 'Clean' },
  { id: 'beardStyle_B1', label: 'Stubble' },
  { id: 'beardStyle_B2', label: 'Full Beard' },
] as const;

export const AVATAR_MUSTACHE_STYLES = [
  { id: 'mustacheStyle_A', label: 'None' },
  { id: 'mustacheStyle_B', label: 'Hungarian' },
  { id: 'mustacheStyle_C', label: 'Walrus' },
  { id: 'mustacheStyle_D', label: 'Classic' },
] as const;

export const AVATAR_COMPLEXION_STYLES = [
  { id: 'complexionStyle_A', label: 'Clear' },
  { id: 'complexionStyle_C', label: 'Freckles' },
  { id: 'complexionStyle_D', label: 'Blush' },
  { id: 'complexionStyle_B1', label: 'Mole' },
] as const;

export const AVATAR_SKIN_TONES = [
  '#FFE0BD',
  '#F5CBA7',
  '#E0AC69',
  '#C68642',
  '#8D5524',
  '#5C3317',
];

export const AVATAR_HAIR_COLORS = [
  '#1C1917',
  '#4A2E1B',
  '#9A6324',
  '#D4A359',
  '#B83232',
  '#4D6BFF',
  '#E5E7EB',
];

export interface RiveAvatarParams {
  avatarDisplay?: AvatarDisplayMode;
  bodyType?: string;
  headShape?: string;
  eyeShape?: string;
  mouthShape?: string;
  complexionStyle?: string;
  hairStyle?: string;
  mustacheStyle?: string;
  beardStyle?: string;
  skinTone?: string;
  hairColor?: string;
  muscleTiers?: Partial<Record<string, RankTier>>;
}

export interface CustomAvatarRiveProps extends RiveAvatarParams {
  width?: number;
  height?: number;
  fallback?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const MUSCLE_RIVE_KEYS: Record<string, [string, string]> = {
  Abdominals: ['abdominals_start', 'abdominals_end'],
  Abductors: ['abductors_start', 'abductors_end'],
  Adductors: ['adductors_start', 'adductors_end'],
  Biceps: ['biceps_start', 'biceps_end'],
  Calves: ['calves_start', 'calves_end'],
  Forearms: ['forearms_start', 'forearms_end'],
  'Front Delt': ['frontDelt_start', 'frontDelt_end'],
  Glutes: ['glutes_start', 'glutes_end'],
  Hamstrings: ['hamstrings_start', 'hamstrings_end'],
  Lats: ['lats_start', 'lats_end'],
  'Lower Back': ['lowerBack_start', 'lowerBack_end'],
  'Lower Chest': ['lowerChest_start', 'lowerChest_end'],
  'Middle Delt': ['midDelt_start', 'midDelt_end'],
  Obliques: ['obliques_start', 'obliques_end'],
  Quadriceps: ['quads_start', 'quads_end'],
  'Rear Delt': ['rearDelt_start', 'rearDelt_end'],
  'Rotator Cuff': ['rotatorCuff_start', 'rotatorCuff_end'],
  Traps: ['traps_start', 'traps_end'],
  Triceps: ['triceps_start', 'triceps_end'],
  'Upper Back': ['upperBack_start', 'upperBack_end'],
  'Upper Chest': ['upperChest_start', 'upperChest_end'],
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(num)) return [224, 172, 105];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function shadeRgb(rgb: [number, number, number], factor: number): [number, number, number] {
  return [
    Math.max(0, Math.min(255, Math.round(rgb[0] * factor))),
    Math.max(0, Math.min(255, Math.round(rgb[1] * factor))),
    Math.max(0, Math.min(255, Math.round(rgb[2] * factor))),
  ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeSetString(vmi: any, path: string, value: string | undefined) {
  if (!vmi || !value) return;
  try {
    const prop = vmi.string?.(path);
    if (prop) prop.value = value;
  } catch {
    // ignore missing property on artboard
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeSetRgb(vmi: any, path: string, rgb: [number, number, number]) {
  if (!vmi) return;
  try {
    const prop = vmi.color?.(path);
    if (prop?.rgb) prop.rgb(rgb[0], rgb[1], rgb[2]);
  } catch {
    // ignore missing property on artboard
  }
}

function WebCustomAvatarRive({
  width,
  height,
  avatarDisplay,
  bodyType,
  headShape,
  eyeShape,
  mouthShape,
  complexionStyle,
  hairStyle,
  mustacheStyle,
  beardStyle,
  skinTone,
  hairColor,
  muscleTiers,
  onError,
}: Required<Pick<CustomAvatarRiveProps, 'width' | 'height'>> &
  RiveAvatarParams & { onError: () => void }) {
  ensureLocalRiveWasm();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useRive, Layout, Fit, Alignment } = require('@rive-app/react-canvas');

  const { rive, RiveComponent } = useRive({
    src: RIVE_WEB_URLS.customAvatar,
    autoplay: true,
    autoBind: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    onLoadError: () => onError(),
  });

  useEffect(() => {
    if (!rive) return;
    const vmi = rive.viewModelInstance;
    if (!vmi) return;

    const isBodygraph =
      avatarDisplay === 'display_bodygraphFront' || avatarDisplay === 'display_bodygraphBack';

    safeSetString(vmi, 'avatarDisplay', avatarDisplay ?? 'display_default');
    safeSetString(vmi, 'bodyType', bodyType ?? 'body_A');
    safeSetString(vmi, 'headShape', headShape ?? 'headShape_A');
    safeSetString(vmi, 'eyeShape', eyeShape ?? 'eyeShape_A1');
    safeSetString(vmi, 'mouthShape', mouthShape ?? 'mouthShape_B');
    safeSetString(vmi, 'complexionStyle', complexionStyle ?? 'complexionStyle_A');
    safeSetString(vmi, 'hairStyle', hairStyle ?? 'hairStyle_C1');
    safeSetString(vmi, 'mustacheStyle', mustacheStyle ?? 'mustacheStyle_A');
    safeSetString(vmi, 'beardStyle', beardStyle ?? 'beardStyle_A');

    if (isBodygraph) {
      // Exact Liftoff bodygraph silhouette palette from mod_06284 defaultBodygraphColors
      const skin = hexToRgb('#E8E8F5');
      const s1 = hexToRgb('#DDDDEB');
      const s2 = hexToRgb('#AFAFBD');
      const unranked = hexToRgb('#CBCBE0');
      safeSetRgb(vmi, 'skin_base', skin);
      safeSetRgb(vmi, 'default_Muscle_Fill', s1);
      safeSetRgb(vmi, 'skin_shadow_01', s1);
      safeSetRgb(vmi, 'skin_shadow_02', s2);
      safeSetRgb(vmi, 'skin_highlights', s1);
      safeSetRgb(vmi, 'skin_details', s1);
      safeSetRgb(vmi, 'hair_base', unranked);
      safeSetRgb(vmi, 'hair_shadow', unranked);
      safeSetRgb(vmi, 'hair_highlight', unranked);
      safeSetRgb(vmi, 'hair_brows', unranked);
      safeSetRgb(vmi, 'hair_facial', unranked);
      safeSetRgb(vmi, 'neck_start', skin);
      safeSetRgb(vmi, 'neck_end', skin);

      for (const [muscleName, [startProp, endProp]] of Object.entries(MUSCLE_RIVE_KEYS)) {
        const tier = muscleTiers?.[muscleName];
        if (tier && tier !== 'Unranked' && RANK_BODYGRAPH_GRADIENTS[tier]) {
          const [g1, g2] = RANK_BODYGRAPH_GRADIENTS[tier];
          safeSetRgb(vmi, startProp, hexToRgb(g1));
          safeSetRgb(vmi, endProp, hexToRgb(g2));
        } else {
          safeSetRgb(vmi, startProp, hexToRgb('#4B4E73'));
          safeSetRgb(vmi, endProp, hexToRgb('#2E314F'));
        }
      }
    } else {
      const skinRgb = hexToRgb(skinTone ?? '#E0AC69');
      const hairRgb = hexToRgb(hairColor ?? '#1C1917');
      safeSetRgb(vmi, 'skin_base', skinRgb);
      safeSetRgb(vmi, 'default_Muscle_Fill', shadeRgb(skinRgb, 0.94));
      safeSetRgb(vmi, 'skin_shadow_01', shadeRgb(skinRgb, 0.87));
      safeSetRgb(vmi, 'skin_shadow_02', shadeRgb(skinRgb, 0.74));
      safeSetRgb(vmi, 'skin_highlights', shadeRgb(skinRgb, 1.08));
      safeSetRgb(vmi, 'skin_details', shadeRgb(skinRgb, 0.82));
      safeSetRgb(vmi, 'neck_start', skinRgb);
      safeSetRgb(vmi, 'neck_end', shadeRgb(skinRgb, 0.88));
      safeSetRgb(vmi, 'hair_base', hairRgb);
      safeSetRgb(vmi, 'hair_shadow', shadeRgb(hairRgb, 0.72));
      safeSetRgb(vmi, 'hair_highlight', shadeRgb(hairRgb, 1.25));
      safeSetRgb(vmi, 'hair_brows', shadeRgb(hairRgb, 0.85));
      safeSetRgb(vmi, 'hair_facial', hairRgb);
      safeSetRgb(vmi, 'hair_facialStubble', shadeRgb(hairRgb, 0.9));
    }

    try {
      rive.play();
    } catch {
      // already playing
    }
  }, [
    rive,
    avatarDisplay,
    bodyType,
    headShape,
    eyeShape,
    mouthShape,
    complexionStyle,
    hairStyle,
    mustacheStyle,
    beardStyle,
    skinTone,
    hairColor,
    muscleTiers,
  ]);

  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <RiveComponent style={{ width, height, display: 'block' }} />
    </View>
  );
}

/**
 * Live Rive ViewModel-bound Custom Avatar renderer powered by custom_avatar.riv.
 * Supports real-time Body, Face, Hair, Facial Hair, Skin/Hair colors, and BodyRank Front/Back modes.
 */
export function CustomAvatarRive({
  width = 220,
  height = 220,
  fallback = null,
  style,
  ...params
}: CustomAvatarRiveProps) {
  const [failed, setFailed] = useState(false);

  if (Platform.OS !== 'web' || failed) {
    return (
      <View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]}>
        {fallback}
      </View>
    );
  }

  return (
    <View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]}>
      <WebCustomAvatarRive width={width} height={height} {...params} onError={() => setFailed(true)} />
    </View>
  );
}
