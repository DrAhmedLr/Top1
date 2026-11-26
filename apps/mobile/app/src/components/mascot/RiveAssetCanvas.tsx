import React, { useState } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { RIVE_WEB_URLS } from '../../assets/v3AssetRegistry';
import { ensureLocalRiveWasm } from './riveSetup';

interface RiveCanvasProps {
  asset: 'rankUp' | 'muscleRankUp' | 'customAvatar';
  width: number;
  height: number;
  artboard?: string;
  animations?: string | string[];
  stateMachines?: string | string[];
  fallback?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

function WebRivePlayer({
  src,
  width,
  height,
  artboard,
  animations,
  stateMachines,
  onError,
}: {
  src: string;
  width: number;
  height: number;
  artboard?: string;
  animations?: string | string[];
  stateMachines?: string | string[];
  onError: () => void;
}) {
  ensureLocalRiveWasm();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useRive, Layout, Fit, Alignment } = require('@rive-app/react-canvas');

  const { RiveComponent } = useRive({
    src,
    artboard,
    animations,
    stateMachines,
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    onLoadError: () => onError(),
  });

  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <RiveComponent style={{ width, height, display: 'block' }} />
    </View>
  );
}

/**
 * Generic cross-platform Rive renderer for rank_up.riv, muscle_rank_up.riv, and custom_avatar.riv
 * with automatic local WASM setup and zero-crash fallback.
 */
export function RiveAssetCanvas({
  asset,
  width,
  height,
  artboard,
  animations,
  stateMachines,
  fallback = null,
  style,
}: RiveCanvasProps) {
  const [failed, setFailed] = useState(false);

  if (Platform.OS !== 'web' || failed) {
    return <View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]}>{fallback}</View>;
  }

  return (
    <View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]}>
      <WebRivePlayer
        src={RIVE_WEB_URLS[asset]}
        width={width}
        height={height}
        artboard={artboard}
        animations={animations}
        stateMachines={stateMachines}
        onError={() => setFailed(true)}
      />
    </View>
  );
}
