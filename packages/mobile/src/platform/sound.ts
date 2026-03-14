/**
 * Mobile Sound Backend — uses expo-av for audio playback.
 * Sound files are bundled as local wav assets.
 */

import { Audio } from 'expo-av';
import type { ISoundBackend, SoundEffect } from '@openbunny/shared/services/sound';

const SOUND_ASSETS = {
  'message-send': require('../../assets/sounds/message-send.wav'),
  'message-receive': require('../../assets/sounds/message-receive.wav'),
  'tool-start': require('../../assets/sounds/tool-start.wav'),
  'tool-complete': require('../../assets/sounds/tool-complete.wav'),
  'error': require('../../assets/sounds/error.wav'),
  'notification': require('../../assets/sounds/notification.wav'),
  'click': require('../../assets/sounds/click.wav'),
} satisfies Record<SoundEffect, number>;

export class MobileSoundBackend implements ISoundBackend {
  private cache = new Map<SoundEffect, Audio.Sound>();

  async play(sound: SoundEffect, volume = 0.5): Promise<void> {
    const asset = SOUND_ASSETS[sound];
    if (!asset) return;

    try {
      const audioSound = this.cache.get(sound);
      if (audioSound) {
        await audioSound.setVolumeAsync(volume);
        await audioSound.setPositionAsync(0);
        await audioSound.playAsync();
        return;
      }

      const { sound: created } = await Audio.Sound.createAsync(asset, {
        shouldPlay: true,
        volume,
      });
      this.cache.set(sound, created);
    } catch {
      // Silently ignore playback errors
    }
  }

  async preload(): Promise<void> {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
    });
  }

  dispose(): void {
    for (const sound of this.cache.values()) {
      sound.unloadAsync().catch(() => {});
    }
    this.cache.clear();
  }
}
