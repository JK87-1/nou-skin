import { useState } from 'react';

// 단일 AudioContext 재사용 (매 탭마다 새로 만들면 브라우저 한도 초과로 사운드가 끊김)
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) {
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return null; }
  }
  // suspended 상태면 resume (iOS Safari 등에서 사용자 제스처 후에만 재생 가능)
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume().catch(() => {});
  }
  return _audioCtx;
}

const TAB_BOUNCE_STYLE = document.createElement('style');
TAB_BOUNCE_STYLE.textContent = `
  @keyframes tabBounce {
    0% { transform: scale(1); }
    40% { transform: scale(0.90); }
    70% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
`;
if (!document.head.querySelector('[data-tab-bounce]')) {
  TAB_BOUNCE_STYLE.setAttribute('data-tab-bounce', '');
  document.head.appendChild(TAB_BOUNCE_STYLE);
}

export default function TabBar({ activeTab, onTabChange }) {
  const [bouncingTab, setBouncingTab] = useState(null);

  const playTick = () => {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 1800;
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.start(now);
      osc.stop(now + 0.04);
      // ctx는 닫지 않고 재사용 — osc/gain은 stop 후 자동 GC
    } catch {}
  };

  const handleTap = (key) => {
    setBouncingTab(key);
    onTabChange(key);
    if (navigator.vibrate) navigator.vibrate(8);
    playTick();
    setTimeout(() => setBouncingTab(null), 300);
  };

  const tabs = [
    {
      key: 'home',
      label: '홈',
      icon: (active) => {
        const c = active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)';
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M10.26,14.74c-1.03,0-1.9.87-1.9,1.89l-.02,4.86c0,1.23-1.02,2.3-2.26,2.34h-3.72C1.09,23.83,0,22.73,0,21.45v-7.91s0-5.13,0-5.13c0-.87.43-1.68,1.19-2.14L10.74.54c.79-.52,1.82-.5,2.6.05l9.38,5.62c.8.48,1.28,1.29,1.28,2.23v13.06c-.01,1.21-1.04,2.27-2.24,2.31h-3.8c-1.29,0-2.3-1.13-2.3-2.4v-4.72c0-1.01-.82-1.93-1.84-1.96h-3.55Z" fill={c} />
          </svg>
        );
      },
    },
    {
      key: 'food',
      label: '오늘',
      icon: (active) => {
        const c = active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)';
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="9" height="9" rx="3" fill={c} />
            <rect x="13" y="2" width="9" height="9" rx="3" fill={c} />
            <rect x="2" y="13" width="9" height="9" rx="3" fill={c} />
            <rect x="13" y="13" width="9" height="9" rx="3" fill={c} />
          </svg>
        );
      },
    },
    {
      key: 'routine',
      label: '루틴',
      icon: (active) => {
        const c = active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)';
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill={c} />
            <path d="M8 12.5l2.5 2.5L16 9.5" stroke={active ? '#fff' : '#e8e8e8'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      },
    },
    {
      key: 'body',
      label: '돌아보기',
      icon: (active) => {
        const c = active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)';
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M10.48,23.25c-.15.41-.5.71-.86.75-.27.03-.78-.29-.9-.59l-1.53-4.02c-.48-1.26-1.41-2.1-2.67-2.58l-3.91-1.48c-.29-.11-.59-.51-.6-.76-.01-.39.23-.79.6-.93l3.9-1.49c1.27-.48,2.19-1.31,2.68-2.59l1.57-4.14c.08-.2.52-.44.74-.46.24-.02.77.21.86.46l1.57,4.14c.5,1.32,1.47,2.15,2.78,2.63l3.7,1.37c.31.11.66.55.67.83.02.42-.29.82-.68.97l-3.8,1.44c-1.26.48-2.2,1.32-2.67,2.58l-1.45,3.86Z" fill={c} />
            <path d="M21.48,6.29c-1.03.59-.9,2.91-2.01,2.98-1.23.08-.99-1.68-1.94-2.78-.77-.88-2.68-.63-2.74-1.78-.07-1.27,2.01-1.1,2.74-1.91.87-.95.73-2.72,1.78-2.8,1.29-.1.98,1.81,1.95,2.77.87.86,2.67.71,2.73,1.8.07,1.08-1.29,1.02-2.51,1.72Z" fill={c} />
          </svg>
        );
      },
    },
    {
      key: 'album',
      label: 'MY',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M10.14,24l-1.47-.04-2.51-.12c-1.25-.06-2.47-.2-3.68-.54-1.15-.32-2.37-1.13-2.24-2.28.2-1.82,1.05-3.44,2.46-4.62,2.32-1.95,5.74-2.57,8.75-2.64,3.36-.07,7.32.49,9.91,2.7,1.28,1.09,2.06,2.61,2.36,4.25.28,1.55-1.2,2.4-2.66,2.71-1.57.34-3.15.46-4.76.5l-2.98.07h-3.2Z" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} />
          <path d="M15.85,11.1c-2.09,1.64-5.01,1.75-7.21.33-2.4-1.54-3.38-4.46-2.47-7.14C7.04,1.71,9.57.05,12.36.19c3.17.16,5.71,2.71,5.8,5.9.05,1.95-.74,3.78-2.32,5.01Z" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} />
        </svg>
      ),
    },
  ];

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '-0.5%', right: '-0.5%',
      paddingBottom: 'env(safe-area-inset-bottom)',
      background: 'rgba(255,255,255,0.25)',
      backdropFilter: 'saturate(140%) blur(24px)',
      WebkitBackdropFilter: 'saturate(140%) blur(24px)',
      borderTop: '1px solid rgba(255,255,255,0.6)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 -2px 12px rgba(255,255,255,0.15)',
      borderRadius: '22px 22px 0 0',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      padding: '0 12px',
      zIndex: 100,
    }}>
      {tabs.map(tab => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => handleTap(tab.key)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 0 32px',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{
              width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: bouncingTab === tab.key ? 'tabBounce 0.3s ease' : 'none',
            }}>
              {tab.icon(active)}
            </div>
            <span style={{
              fontSize: 11, fontWeight: 500,
              color: active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)',
            }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
