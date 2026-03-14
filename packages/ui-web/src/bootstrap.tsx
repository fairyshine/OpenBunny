import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { initializeDOMI18n } from './platform/i18n';

export function renderOpenBunnyApp(root: HTMLElement): void {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}

export async function bootstrapOpenBunnyDOMApp(initPlatform: () => void, rootId: string = 'root'): Promise<void> {
  await initializeDOMI18n();
  initPlatform();

  const root = document.getElementById(rootId);
  if (!root) {
    throw new Error(`OpenBunny root element not found: #${rootId}`);
  }

  renderOpenBunnyApp(root);
}
