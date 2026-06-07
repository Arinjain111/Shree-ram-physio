import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { UIProvider } from '@/context/UIContext';
import { LayoutProvider } from '@/context/LayoutContext';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { logger } from '@/utils/logger';
import App from './App';
import './index.css'

// Global Error Handler for Startup Debugging
window.onerror = function(message, source, lineno, colno, error) {
  const errDiv = document.createElement('div');
  errDiv.style.position = 'fixed';
  errDiv.style.top = '0';
  errDiv.style.left = '0';
  errDiv.style.width = '100%';
  errDiv.style.backgroundColor = 'red';
  errDiv.style.color = 'white';
  errDiv.style.padding = '20px';
  errDiv.style.zIndex = '9999';
  errDiv.innerHTML = `<h3>Startup Error</h3><pre>${message}\n${source}:${lineno}:${colno}\n${error?.stack}</pre>`;
  document.body.appendChild(errDiv);
};

// Check for electron integration (via preload script with contextIsolation)
try {
  logger.debug('boot', 'Checking Electron integration');
  if (!window.electronAPI) {
    throw new Error('window.electronAPI is not defined. Preload script not loaded?');
  }
  logger.debug('boot', 'Electron API available', { invoke: typeof window.electronAPI.invoke, on: typeof window.electronAPI.on });
} catch (e: any) {
  logger.error('boot', 'Electron integration check failed', { error: e?.message ?? String(e) });
  window.onerror(e.message, 'main.tsx', 0, 0, e);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <UIProvider>
        <LayoutProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </LayoutProvider>
      </UIProvider>
    </HashRouter>
  </React.StrictMode>,
);
