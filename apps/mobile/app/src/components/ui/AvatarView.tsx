import React from 'react';
import { Animated, Image, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { AvatarConfig } from '@apexlift/shared';
import { AVATAR_PRESET_IMAGES, getProfileBorderAsset } from '../../assets/assetRegistry';
import { useRotationLoop } from '../../theme/animations';

export interface AvatarViewProps {
  config?: Partial<AvatarConfig> & { presetKey?: string };
  size?: number;
  borderColor?: string;
  borderId?: string | null;
  presetKey?: string | null;
}

/**
 * Upgraded AvatarView supporting:
 * - Stylized 3D Character Avatar Presets (extracted from APK)
 * - Custom Vector SVG Avatar fallback
 * - Animated Layered PNG Profile Borders (rotating Solar/Asteroid rings, Water, Fire, Moon, Premium)
 */
export function AvatarView({
  config,
  size = 64,
  borderColor,
  borderId,
  presetKey,
}: AvatarViewProps) {
  const skin = config?.skinTone ?? '#E0AC69';
  const hairStyle = config?.hairStyle ?? 'fade';
  const hairColor = config?.hairColor ?? '#1F1A17';
  const outfit = config?.outfitColor ?? '#59B9F9';
  const accessory = config?.accessory ?? 'none';
  const bg = config?.backgroundColor ?? '#1A1524';

  const resolvedPreset = presetKey ?? (config as { presetKey?: string } | undefined)?.presetKey;
  const presetImg = resolvedPreset ? AVATAR_PRESET_IMAGES[resolvedPreset] : null;
  const borderAsset = getProfileBorderAsset(borderId);
  const { rotate: cwRotate } = useRotationLoop(14000, false);
  const { rotate: ccwRotate } = useRotationLoop(18000, true);

  const hasGraphicBorder = Boolean(borderAsset.front || borderAsset.back);
  const frameSize = hasGraphicBorder ? Math.round(size * 1.34) : size;

  return (
    <View
      style={{
        width: frameSize,
        height: frameSize,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Back Rotating Border Layer */}
      {borderAsset.back ? (
        <Animated.Image
          source={borderAsset.back}
          resizeMode="contain"
          style={{
            position: 'absolute',
            width: frameSize,
            height: frameSize,
            transform: borderAsset.rotateBack ? [{ rotate: cwRotate }] : [],
          }}
        />
      ) : null}

      {/* Core Avatar Circle */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          borderWidth: hasGraphicBorder ? 1.5 : borderColor ? 2.5 : 1.5,
          borderColor: borderColor ?? 'rgba(255,255,255,0.16)',
          backgroundColor: bg,
        }}
      >
        {presetImg ? (
          <Image
            source={presetImg}
            resizeMode="cover"
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <Svg width={size} height={size} viewBox="0 0 100 100">
            <Rect x="0" y="0" width="100" height="100" fill={bg} />
            <Path d="M16 100 C18 72 34 66 50 66 C66 66 82 72 84 100 Z" fill={outfit} />
            <Rect x="42" y="56" width="16" height="14" rx="6" fill={skin} />
            <Circle cx="50" cy="42" r="21" fill={skin} />
            {hairStyle === 'fade' || hairStyle === 'short' ? (
              <Path d="M29 38 C30 20 70 20 71 38 C64 29 36 29 29 38 Z" fill={hairColor} />
            ) : null}
            {hairStyle === 'buzz' ? (
              <Path d="M31 35 C34 22 66 22 69 35 C60 28 40 28 31 35 Z" fill={hairColor} />
            ) : null}
            {hairStyle === 'wavy' ? (
              <Path d="M26 42 C24 18 76 18 74 42 C67 27 33 27 26 42 Z" fill={hairColor} />
            ) : null}
            {hairStyle === 'long' ? (
              <Path
                d="M26 40 C26 16 74 16 74 40 L76 66 L66 66 L66 36 C60 28 40 28 34 36 L34 66 L24 66 Z"
                fill={hairColor}
              />
            ) : null}
            <Circle cx="42" cy="43" r="2.6" fill="#18181B" />
            <Circle cx="58" cy="43" r="2.6" fill="#18181B" />
            <Path
              d="M43 52 Q50 57 57 52"
              stroke="#18181B"
              strokeWidth="2.4"
              strokeLinecap="round"
              fill="none"
            />
            {accessory === 'headband' ? (
              <Rect x="29" y="29" width="42" height="6" rx="3" fill={outfit} />
            ) : null}
            {accessory === 'glasses' ? (
              <>
                <Rect
                  x="34"
                  y="38"
                  width="13"
                  height="9"
                  rx="3"
                  stroke="#FAFAFA"
                  strokeWidth="2"
                  fill="rgba(255,255,255,0.15)"
                />
                <Rect
                  x="53"
                  y="38"
                  width="13"
                  height="9"
                  rx="3"
                  stroke="#FAFAFA"
                  strokeWidth="2"
                  fill="rgba(255,255,255,0.15)"
                />
                <Path d="M47 42 L53 42" stroke="#FAFAFA" strokeWidth="2" />
              </>
            ) : null}
            {accessory === 'headphones' ? (
              <>
                <Path d="M27 42 C27 16 73 16 73 42" stroke={outfit} strokeWidth="4" fill="none" />
                <Rect x="23" y="37" width="7" height="14" rx="3.5" fill={outfit} />
                <Rect x="70" y="37" width="7" height="14" rx="3.5" fill={outfit} />
              </>
            ) : null}
            {accessory === 'cap' ? (
              <>
                <Path d="M28 33 C30 18 70 18 72 33 Z" fill={outfit} />
                <Rect x="26" y="30" width="52" height="5" rx="2.5" fill={outfit} />
              </>
            ) : null}
          </Svg>
        )}
      </View>

      {/* Front Cosmetic Border Layer */}
      {borderAsset.front ? (
        <Animated.Image
          source={borderAsset.front}
          resizeMode="contain"
          style={{
            position: 'absolute',
            width: frameSize,
            height: frameSize,
            transform: borderAsset.rotateFront ? [{ rotate: ccwRotate }] : [],
          }}
        />
      ) : null}
    </View>
  );
}
