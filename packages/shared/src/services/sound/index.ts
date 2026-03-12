/**
 * Sound Manager — singleton with pluggable backend.
 *
 * Backend selection:
 * - Browser / Electron: use-sound (Howler.js), injected by web/desktop platform init
 * - React Native: expo-av, injected by mobile platform init
 * - CLI / TUI: no-op (no backend injected)
 *
 * Sound on/off and volume are read from useSettingsStore at play time.
 */

import type { SoundEffect, ISoundBackend } from './types';
import { useSettingsStore } from '../../stores/settings';

export { SOUND_EFFECTS } from './types';
export type { SoundEffect, ISoundBackend } from './types';

const noopBackend: ISoundBackend = {
  play() {},
};

class SoundManager {
  private backend: ISoundBackend = noopBackend;

  /** Replace the audio backend (called during platform init). */
  setBackend(backend: ISoundBackend): void {
    this.backend = backend;
    backend.preload?.();
  }

  /** Play a sound effect. Respects masterMuted, soundEffectsEnabled, and masterVolume. */
  play(sound: SoundEffect): void {
    const { masterMuted, soundEffectsEnabled, masterVolume } = useSettingsStore.getState();
    if (masterMuted || !soundEffectsEnabled) return;
    this.backend.play(sound, masterVolume);
  }

  /** Release resources. */
  dispose(): void {
    this.backend.dispose?.();
    this.backend = noopBackend;
  }
}

export const soundManager = new SoundManager();
