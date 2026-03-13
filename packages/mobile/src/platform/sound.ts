/**
 * Mobile Sound Backend — uses expo-av for audio playback.
 * Sound files are bundled as require() assets.
 */

import { Audio } from 'expo-av';
import type { ISoundBackend, SoundEffect } from '@openbunny/shared/services/sound';

const SOUND_ASSETS = {
  'message-send': require('../../assets/sounds/message-send.mp3'),
  'message-receive': require('../../assets/sounds/message-receive.mp3'),
  'tool-start': require('../../assets/sounds/tool-start.mp3'),
  'tool-complete': require('../../assets/sounds/tool-complete.mp3'),
  'error': require('../../assets/sounds/error.mp3'),
  'notification': require('../../assets/sounds/notification.mp3'),
  'click': require('../../assets/sounds/click.mp3'),
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
