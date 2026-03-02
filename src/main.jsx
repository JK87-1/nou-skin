import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker with auto-update
// In iOS PWA standalone mode, there's no pull-to-refresh or address bar.
// We check for SW updates whenever the app returns to foreground,
// and auto-reload when a new version activates.
registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    if (!registration) return;

    // Check for updates when app returns to foreground
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update();
      }
    });

    // Also check periodically (every 60 minutes) for long sessions
    setInterval(() => { registration.update(); }, 60 * 60 * 1000);
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
