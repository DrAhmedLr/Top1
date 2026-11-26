import { Platform } from 'react-native';
import { RIVE_WEB_URLS } from '../../assets/v3AssetRegistry';

let initialized = false;

/**
 * Configures @rive-app/react-canvas to load rive.wasm from our local /media/rive/rive.wasm
 * instead of an external CDN so Rive renders 100% locally and offline.
 */
export function ensureLocalRiveWasm() {
  if (initialized || Platform.OS !== 'web') return;
  initialized = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rivePkg = require('@rive-app/react-canvas');
    if (rivePkg?.RuntimeLoader?.setWasmUrl) {
      rivePkg.RuntimeLoader.setWasmUrl(RIVE_WEB_URLS.wasm);
    }
  } catch {
    // Fallback gracefully if Rive runtime unavailable
  }
}
