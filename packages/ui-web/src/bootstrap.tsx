import React from 'react';
import ReactDOM from 'react-dom/client';
import '@openbunny/shared/i18n';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

export function renderOpenBunnyApp(root: HTMLElement): void {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}

export function bootstrapOpenBunnyDOMApp(initPlatform: () => void, rootId: string = 'root'): void {
  initPlatform();

  const root = document.getElementById(rootId);
  if (!root) {
    throw new Error(`OpenBunny root element not found: #${rootId}`);
  }

  renderOpenBunnyApp(root);
}
