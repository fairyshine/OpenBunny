/**
 * Web Sound Backend — uses Howler.js (bundled with use-sound) for audio playback.
 * Sound files are served from /sounds/ in the public directory.
 */

import { Howl } from 'howler';
import { SOUND_EFFECTS, type ISoundBackend, type SoundEffect } from '@openbunny/shared/services/sound';

const SOUND_PATHS: Record<SoundEffect, string> = SOUND_EFFECTS.reduce(
  (paths, sound) => {
    paths[sound] = `/sounds/${sound}.mp3`;
    return paths;
  },
  {} as Record<SoundEffect, string>,
);

export class WebSoundBackend implements ISoundBackend {
  private cache = new Map<SoundEffect, Howl>();

  play(sound: SoundEffect, volume = 0.5): void {
    let howl = this.cache.get(sound);
    if (!howl) {
      const src = SOUND_PATHS[sound];
      if (!src) return;
      howl = new Howl({ src: [src], volume, preload: true });
      this.cache.set(sound, howl);
    } else {
      howl.volume(volume);
    }
    howl.play();
  }

  async preload(): Promise<void> {
    for (const [key, src] of Object.entries(SOUND_PATHS)) {
      if (!this.cache.has(key as SoundEffect)) {
        this.cache.set(key as SoundEffect, new Howl({ src: [src], preload: true }));
      }
    }
  }

  dispose(): void {
    for (const howl of this.cache.values()) {
      howl.unload();
    }
    this.cache.clear();
  }
}
