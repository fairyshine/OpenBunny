export type SettingsSection = 'profile' | 'general' | 'llm' | 'tools' | 'skills' | 'network' | 'about';

const OPEN_SETTINGS_MODAL_EVENT = 'openbunny:open-settings-modal';

interface OpenSettingsModalDetail {
  section?: SettingsSection;
}

export function openSettingsModal(section?: SettingsSection) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<OpenSettingsModalDetail>(OPEN_SETTINGS_MODAL_EVENT, {
      detail: { section },
    }),
  );
}

export function addOpenSettingsModalListener(
  listener: (detail: OpenSettingsModalDetail) => void,
) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleEvent = (event: Event) => {
    const customEvent = event as CustomEvent<OpenSettingsModalDetail>;
    listener(customEvent.detail ?? {});
  };

  window.addEventListener(OPEN_SETTINGS_MODAL_EVENT, handleEvent);
  return () => window.removeEventListener(OPEN_SETTINGS_MODAL_EVENT, handleEvent);
}
