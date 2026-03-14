import i18n from '@openbunny/shared/i18n';
import { initializePlatformStorage } from '@openbunny/shared/services/storage/bootstrap';
import { soundManager } from '@openbunny/shared/services/sound';
import { registerZustandAIRuntimeAdapters } from '@openbunny/shared/stores/aiRuntimeAdapters';
import { setLanguageHandler, setThemeHandler, useSettingsStore } from '@openbunny/shared/stores/settings';
import { WebSoundBackend } from './sound';
import { applyTheme, type Theme } from './theme';

export function initializeBrowserLikePlatformServices(themeHandler: (theme: Theme) => void = applyTheme): void {
  initializePlatformStorage();
  registerZustandAIRuntimeAdapters();
  setThemeHandler(themeHandler);
  setLanguageHandler((lang: string) => {
    i18n.changeLanguage(lang);
  });
  soundManager.setSettingsResolver(() => {
    const { masterMuted, soundEffectsEnabled, masterVolume } = useSettingsStore.getState();
    return { masterMuted, soundEffectsEnabled, masterVolume };
  });
  soundManager.setBackend(new WebSoundBackend());
}
