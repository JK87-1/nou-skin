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
      icon: (active) => (
        <svg width="22" height="22" viewBox="-18 -18 262.77 259.59" fill="none">
          <path d="M96.92,137.66c-9.73-.02-17.92,8.25-17.96,17.85l-.18,45.9c-.04,11.59-9.64,21.73-21.36,22.08l-35.13.1c-11.97.03-22.25-10.45-22.26-22.48l-.03-74.76v-48.47c0-8.21,4.09-15.9,11.22-20.18L101.52,3.54c7.51-4.9,17.23-4.71,24.53.51l88.63,53.07c7.54,4.52,12.11,12.17,12.1,21.06l-.12,123.44c-.01,11.39-9.74,21.49-21.08,21.82l-35.9.04c-12.2.01-21.74-10.75-21.75-22.69l-.04-44.59c0-9.55-7.68-18.2-17.38-18.49l-33.58-.05Z" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} />
        </svg>
      ),
    },
    {
      key: 'food',
      label: '오늘',
      icon: (active) => {
        const c = active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)';
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M3 21l2.5-2.5M14.5 5.5l4 4M5.5 18.5L16.5 7.5c.8-.8 2.2-.8 3 0s.8 2.2 0 3L8.5 21.5H5.5v-3z" fill={c} />
            <path d="M2 22h20" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      },
    },
    {
      key: 'routine',
      label: '루틴',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <defs><mask id="checkMask"><rect width="24" height="24" fill="white" /><path d="M8 12.5l2.5 2.5L16 10" stroke="black" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></mask></defs>
          <circle cx="12" cy="12" r="10" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} mask="url(#checkMask)" />
        </svg>
      ),
    },
    {
      key: 'body',
      label: '돌아보기',
      icon: (active) => {
        const c = active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)';
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M1 12h3l3-7 4 14 4-10 3 5h5" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
