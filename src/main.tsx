import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Unregister conflicting or broken service workers in dev/iframe preview to prevent reload loops
if ('serviceWorker' in navigator) {
  // If running in development or inside an iframe, make sure we don't enter an auto-reload loop
  const isIframe = window.self !== window.top;
  
  if (isIframe || import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        // Unregister any conflicting dev service worker that causes reload loops
        registration.unregister().catch(() => {});
      }
    });
  } else {
    // In standalone production mode, register once cleanly without auto-reloading
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((reg) => {
          reg.update().catch(() => {});
        })
        .catch((err) => {
          console.warn('SW registration skipped:', err);
        });
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
