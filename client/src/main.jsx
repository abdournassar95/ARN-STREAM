import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Local fonts bundled with the project
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import '@fontsource/alexandria/400.css';
import '@fontsource/alexandria/600.css';
import '@fontsource/alexandria/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/audiowide/400.css';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/700.css';
import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/700.css';

import './index.css';
import './i18n/index.js';

// Handle chunk loading errors seamlessly after new builds/deployments
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('[ARN Stream] Detected newer build or missing chunk, reloading page...', event);
    window.location.reload();
  });

  window.addEventListener('error', (event) => {
    console.error('[ARN Stream Uncaught Error]:', event.error || event.message);
    const root = document.getElementById('root');
    if (root && (!root.innerHTML || root.innerHTML.trim() === '')) {
      root.innerHTML = `
        <div style="min-height: 100vh; background: #0A0E17; color: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif; padding: 24px; text-align: center;">
          <div style="font-size: 40px; margin-bottom: 16px;">⚠️</div>
          <h2 style="color: #ef4444; font-size: 22px; margin-bottom: 8px;">حدث خطأ أثناء تحميل واجهة المنصة</h2>
          <p style="color: #94a3b8; font-size: 13px; max-width: 500px; margin-bottom: 20px; line-height: 1.6;">${event.message || 'Error initializing application'}</p>
          <button onclick="localStorage.clear(); sessionStorage.clear(); location.reload();" style="background: #06b6d4; color: #000; border: none; padding: 10px 24px; border-radius: 12px; font-weight: bold; cursor: pointer; font-size: 14px;">إعادة تعيين التخزين وإعادة المحاولة</button>
        </div>
      `;
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[ARN Stream Unhandled Rejection]:', event.reason);
  });
}

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
