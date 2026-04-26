import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { createAutoBackup } from './storage/AutoBackup';
import { Capacitor } from '@capacitor/core';

// Capacitor 네이티브 플랫폼에서는 PWA 서비스워커 불필요
const isNative = Capacitor.isNativePlatform();

// SW 업데이트 시 데이터 백업 후 활성화 (웹에서만)
const updateSW = !isNative ? registerSW({
  onNeedRefresh() {
    // 새 SW가 설치되면 먼저 데이터를 백업한 후 업데이트 적용
    createAutoBackup()
      .then(() => {
        sessionStorage.setItem('nou_sw_updating', '1');
        updateSW(true);
      })
      .catch(() => {
        // 백업 실패해도 업데이트는 진행
        sessionStorage.setItem('nou_sw_updating', '1');
        updateSW(true);
      });
  },
  onOfflineReady() {},
}) : null;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
