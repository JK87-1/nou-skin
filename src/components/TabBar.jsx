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
            <path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10.5z" fill={c} />
            <rect x="9" y="14" width="6" height="8" rx="0.5" fill={active ? '#fff' : '#e8e8e8'} />
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
            <rect x="3" y="3" width="8" height="8" rx="1.5" fill={c} />
            <rect x="13" y="3" width="8" height="8" rx="1.5" fill={c} />
            <rect x="3" y="13" width="8" height="8" rx="1.5" fill={c} />
            <rect x="13" y="13" width="8" height="8" rx="1.5" fill={c} />
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
            <circle cx="12" cy="13" r="9" fill={c} />
            <path d="M12 8v5l3 3" stroke={active ? '#fff' : '#e8e8e8'} strokeWidth="1.8" strokeLinecap="round" />
            <path d="M4.5 4.5l2 2M19.5 4.5l-2 2" stroke={c} strokeWidth="2" strokeLinecap="round" />
            <path d="M2 8l3-1M22 8l-3-1" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      },
    },
    {
      key: 'album',
      label: 'MY',
      icon: (active) => (
        <svg width="22" height="22" viewBox="-18 -18 262.77 267.35" fill="none">
          <path d="M95.48,231.35l-14.13-.34-24.19-1.16c-12.08-.58-23.84-1.89-35.43-5.16-11.04-3.12-22.89-10.88-21.64-22.01,1.97-17.55,10.15-33.16,23.71-44.53,22.35-18.75,55.29-24.81,84.38-25.45,32.41-.71,70.55,4.72,95.55,26.02,12.31,10.48,19.9,25.18,22.72,40.95,2.66,14.9-11.61,23.09-25.61,26.15-15.11,3.3-30.33,4.43-45.86,4.81l-28.68.71h-30.82Z" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} />
          <path d="M150.35,105.24c-20.18,15.77-48.26,16.89-69.52,3.19-23.12-14.89-32.57-42.96-23.8-68.83C65.46,14.71,89.86-1.27,116.79.08c30.54,1.53,55.06,26.15,55.94,56.89.53,18.79-7.17,36.39-22.37,48.27Z" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} />
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
