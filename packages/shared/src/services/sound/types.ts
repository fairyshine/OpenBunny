/**
 * Sound effect identifiers used across the app.
 */
export type SoundEffect =
  | 'message-send'
  | 'message-receive'
  | 'tool-start'
  | 'tool-complete'
  | 'error'
  | 'notification'
  | 'click';

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
