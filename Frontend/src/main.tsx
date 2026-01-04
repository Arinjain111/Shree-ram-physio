import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { UIProvider } from '@/context/UIContext';
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

// Check for electron integration
try {
  console.log('Checking Electron Integration...');
  if (typeof window.require !== 'function') {
    throw new Error('window.require is NOT a function. Node integration failed?');
  }
  const electron = window.require('electron');
  console.log('Electron required successfully:', electron);
} catch (e: any) {
  console.error('Electron integration check failed:', e);
  window.onerror(e.message, 'main.tsx', 0, 0, e);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <UIProvider>
        <App />
      </UIProvider>
    </HashRouter>
  </React.StrictMode>,
);
