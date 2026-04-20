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
            <path d="M10.2,14.7c-1,0-1.9,.9-1.9,1.9l0,4.9c0,1.2-1,2.3-2.3,2.4l-3.8,0c-1.3,0-2.4-1.1-2.4-2.4l0-8v-5.2c0-.9,.4-1.7,1.2-2.2L10.9,.4c.8-.5,1.8-.5,2.6,.1l9.5,5.7c.8,.5,1.3,1.3,1.3,2.3l0,13.2c0,1.2-1,2.3-2.3,2.3l-3.8,0c-1.3,0-2.3-1.2-2.3-2.4l0-4.8c0-1-.8-1.9-1.9-2l-3.6,0Z" fill={c} />
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
            <path d="M9.5,22.7c-.15,.4-.49,.69-.84,.73-.27,.03-.77-.28-.88-.58l-1.5-3.94c-.47-1.24-1.38-2.06-2.62-2.53l-3.83-1.46c-.29-.11-.58-.5-.59-.75-.01-.38,.23-.77,.59-.91l3.83-1.46c1.24-.47,2.15-1.28,2.63-2.54l1.54-4.06c.07-.2,.51-.43,.72-.45,.24-.02,.75,.21,.84,.46l1.54,4.06c.49,1.29,1.44,2.1,2.73,2.58l3.63,1.35c.3,.11,.65,.54,.66,.82,.02,.41-.29,.8-.67,.95l-3.73,1.41c-1.23,.47-2.16,1.3-2.62,2.53l-1.43,3.79Z" fill={c} />
            <path d="M20.3,6.4c-1.01,.58-.88,2.85-1.97,2.92-1.21,.07-.97-1.65-1.91-2.73-.75-.86-2.62-.62-2.69-1.75-.07-1.24,1.97-1.08,2.69-1.87,.85-.93,.72-2.66,1.74-2.74,1.26-.1,.96,1.78,1.91,2.71,.85,.85,2.61,.7,2.68,1.76,.07,1.07-1.27,1-2.46,1.69Z" fill={c} />
          </svg>
        );
      },
    },
    {
      key: 'album',
      label: 'MY',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M10.1,22.1l-1.5,0-2.6-.1c-1.3-.1-2.5-.2-3.8-.6-1.2-.3-2.4-1.2-2.3-2.4,.2-1.9,1.1-3.5,2.5-4.8,2.4-2,5.9-2.7,9-2.7,3.5-.1,7.5,.5,10.2,2.8,1.3,1.1,2.1,2.7,2.4,4.4,.3,1.6-1.2,2.5-2.7,2.8-1.6,.4-3.2,.5-4.9,.5l-3.1,.1h-3.3Z" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} />
          <path d="M15.9,10.1c-2.2,1.7-5.2,1.8-7.4,.3-2.5-1.6-3.5-4.6-2.5-7.4C6.9,1.2,9.5-.3,12.4,0c3.3,.2,5.9,2.8,6,6.1,.1,2-1.8,3.9-2.4,4Z" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} />
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
