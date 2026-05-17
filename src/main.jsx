import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { Capacitor } from '@capacitor/core';
import { createAutoBackup } from './storage/AutoBackup';

const isNative = Capacitor.isNativePlatform();

// Native (iOS/Android Capacitor) — 별도 초기화 + PWA SW 등록 스킵
if (isNative) {
  import('./native/capacitor-init').then((m) => m.initNative()).catch(() => {});
} else {
  // Web/PWA — Service Worker 등록 + 업데이트 시 데이터 백업
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      onNeedRefresh() {
        createAutoBackup()
          .then(() => {
            sessionStorage.setItem('nou_sw_updating', '1');
            updateSW(true);
          })
          .catch(() => {
            sessionStorage.setItem('nou_sw_updating', '1');
            updateSW(true);
          });
      },
      onOfflineReady() {},
    });
  }).catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
