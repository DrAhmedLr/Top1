import { Platform } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOUND_WEB_URLS, type SoundId } from '../assets/v3AssetRegistry';

export type { SoundId };

interface SoundMeta {
  category: 'music' | 'sfx' | 'sting';
  defaultVolume: number;
  loop?: boolean;
  throttleMs?: number;
  duck?: boolean;
}

/**
 * Exact sound metadata matching mod_05814_hasSoundAsset.js
 */
export const SOUND_META: Record<SoundId, SoundMeta> = {
  egg_shop: { category: 'music', defaultVolume: 0.42, loop: true },
  tick: { category: 'sfx', defaultVolume: 0.55, throttleMs: 85 },
  eggs_burst: { category: 'sfx', defaultVolume: 0.9 },
  eggs_gained: { category: 'sfx', defaultVolume: 0.85 },
  stat_card_1: { category: 'sfx', defaultVolume: 0.85 },
  stat_card_2: { category: 'sfx', defaultVolume: 0.85 },
  stat_card_3: { category: 'sfx', defaultVolume: 0.9 },
  next_step: { category: 'sfx', defaultVolume: 0.7 },
  flow_complete: { category: 'sfx', defaultVolume: 0.95 },
  set_complete_1: { category: 'sfx', defaultVolume: 0.9 },
  summary_rank_bump: { category: 'sfx', defaultVolume: 0.9 },
  rest_timer_cue: { category: 'sfx', defaultVolume: 1.0 },
  timed_exercise_complete: { category: 'sfx', defaultVolume: 0.95 },
  level_up: { category: 'sting', defaultVolume: 1.0, duck: true },
  workout_complete: { category: 'sting', defaultVolume: 0.85 },
  fanfare: { category: 'sting', defaultVolume: 0.65 },
  intro: { category: 'sting', defaultVolume: 0.85 },
  splash: { category: 'sting', defaultVolume: 0.85 },
  splash_short: { category: 'sting', defaultVolume: 0.75 },
  challenge_claim: { category: 'sting', defaultVolume: 0.95 },
  streak_bump_1: { category: 'sting', defaultVolume: 0.9 },
  streak_bump_2: { category: 'sting', defaultVolume: 0.92 },
  streak_bump_3: { category: 'sting', defaultVolume: 0.95 },
  rank_wood: { category: 'sting', defaultVolume: 0.95, duck: true },
  rank_bronze: { category: 'sting', defaultVolume: 0.95, duck: true },
  rank_silver: { category: 'sting', defaultVolume: 0.95, duck: true },
  rank_gold: { category: 'sting', defaultVolume: 0.95, duck: true },
  rank_platinum: { category: 'sting', defaultVolume: 0.95, duck: true },
  rank_diamond: { category: 'sting', defaultVolume: 1.0, duck: true },
  rank_champion: { category: 'sting', defaultVolume: 1.0, duck: true },
  rank_titan: { category: 'sting', defaultVolume: 1.0, duck: true },
  rank_olympian: { category: 'sting', defaultVolume: 1.0, duck: true },
};

interface SoundscapeStoreState {
  muted: boolean;
  musicMuted: boolean;
  toggleMute: () => void;
  toggleMusicMute: () => void;
  setMuted: (v: boolean) => void;
}

export const useSoundscapeStore = create<SoundscapeStoreState>()(
  persist(
    (set) => ({
      muted: false,
      musicMuted: false,
      toggleMute: () =>
        set((s) => {
          const next = !s.muted;
          if (next) stopMusicLoop();
          return { muted: next };
        }),
      toggleMusicMute: () =>
        set((s) => {
          const next = !s.musicMuted;
          if (next) stopMusicLoop();
          return { musicMuted: next };
        }),
      setMuted: (muted) => {
        if (muted) stopMusicLoop();
        set({ muted });
      },
    }),
    {
      name: 'apexlift-soundscape-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

const lastPlayedAt: Partial<Record<SoundId, number>> = {};
const audioCache: Partial<Record<SoundId, HTMLAudioElement>> = {};
let activeMusicEl: HTMLAudioElement | null = null;
let activeMusicId: SoundId | null = null;
let duckTimeout: ReturnType<typeof setTimeout> | null = null;

function getWebAudioElement(id: SoundId): HTMLAudioElement | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof Audio === 'undefined') {
    return null;
  }
  const url = SOUND_WEB_URLS[id];
  if (!url) return null;

  // For short SFX that can overlap, clone from cached template so rapid taps never cut off
  if (!audioCache[id]) {
    const template = new Audio(url);
    template.preload = 'auto';
    audioCache[id] = template;
  }
  const meta = SOUND_META[id];
  if (meta.loop) {
    return audioCache[id]!;
  }
  const clone = audioCache[id]!.cloneNode(true) as HTMLAudioElement;
  clone.volume = Math.min(1, Math.max(0, meta.defaultVolume));
  return clone;
}

export function playSound(id: SoundId, volumeOverride?: number) {
  const { muted } = useSoundscapeStore.getState();
  if (muted) return;

  const meta = SOUND_META[id];
  if (!meta) return;

  const now = Date.now();
  if (meta.throttleMs && lastPlayedAt[id] && now - lastPlayedAt[id]! < meta.throttleMs) {
    return;
  }
  lastPlayedAt[id] = now;

  if (Platform.OS !== 'web') {
    return;
  }

  try {
    const el = getWebAudioElement(id);
    if (!el) return;
    el.volume = Math.min(1, Math.max(0, volumeOverride ?? meta.defaultVolume));

    if (meta.duck && activeMusicEl) {
      activeMusicEl.volume = 0.12;
      if (duckTimeout) clearTimeout(duckTimeout);
      duckTimeout = setTimeout(() => {
        if (activeMusicEl && activeMusicId) {
          activeMusicEl.volume = SOUND_META[activeMusicId].defaultVolume;
        }
      }, 2400);
    }

    el.currentTime = 0;
    const promise = el.play();
    if (promise && typeof promise.catch === 'function') {
      promise.catch(() => {
        // Browser autoplay policy before first user gesture — ignore silently
      });
    }
  } catch {
    // Graceful no-op
  }
}

export function startMusicLoop(id: SoundId = 'egg_shop') {
  const { muted, musicMuted } = useSoundscapeStore.getState();
  if (muted || musicMuted || Platform.OS !== 'web') return;
  if (activeMusicId === id && activeMusicEl && !activeMusicEl.paused) return;

  stopMusicLoop();
  try {
    const el = getWebAudioElement(id);
    if (!el) return;
    el.loop = true;
    el.volume = SOUND_META[id].defaultVolume;
    activeMusicEl = el;
    activeMusicId = id;
    const p = el.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {});
    }
  } catch {
    // Graceful no-op
  }
}

export function stopMusicLoop() {
  if (activeMusicEl) {
    try {
      activeMusicEl.pause();
      activeMusicEl.currentTime = 0;
    } catch {
      // ignore
    }
    activeMusicEl = null;
    activeMusicId = null;
  }
}

export function playRankTierSting(tier: string) {
  const map: Record<string, SoundId> = {
    Unranked: 'rank_wood',
    Rookie: 'rank_wood',
    Novice: 'rank_bronze',
    Enthusiast: 'rank_bronze',
    Intermediate: 'rank_silver',
    Veteran: 'rank_gold',
    Elite: 'rank_platinum',
    Champion: 'rank_champion',
    Titan: 'rank_titan',
    Olympian: 'rank_olympian',
  };
  playSound(map[tier] ?? 'rank_gold');
}

export function useSoundscape() {
  const muted = useSoundscapeStore((s) => s.muted);
  const toggleMute = useSoundscapeStore((s) => s.toggleMute);
  return {
    muted,
    toggleMute,
    play: playSound,
    playRankTierSting,
    startMusicLoop,
    stopMusicLoop,
  };
}
