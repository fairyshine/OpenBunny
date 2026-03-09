const OPEN_CONSOLE_PANEL_EVENT = 'openbunny:open-console-panel';

export function openConsolePanel() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_CONSOLE_PANEL_EVENT));
}

export function addOpenConsolePanelListener(listener: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleEvent = () => {
    listener();
  };

  window.addEventListener(OPEN_CONSOLE_PANEL_EVENT, handleEvent);
  return () => window.removeEventListener(OPEN_CONSOLE_PANEL_EVENT, handleEvent);
}
