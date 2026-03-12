/**
 * Sound effect identifiers used across the app.
 */
export const SOUND_EFFECTS = [
  'message-send',
  'message-receive',
  'tool-start',
  'tool-complete',
  'error',
  'notification',
  'click',
] as const;

export type SoundEffect = typeof SOUND_EFFECTS[number];

/**
 * Platform-specific audio backend interface.
 * Web: use-sound (Howler.js), Mobile: expo-av
 */
export interface ISoundBackend {
  /** Play a named sound effect. Volume 0-1. */
  play(sound: SoundEffect, volume?: number): void;
  /** Preload sounds for instant playback. */
  preload?(): Promise<void>;
  /** Release resources. */
  dispose?(): void;
}
