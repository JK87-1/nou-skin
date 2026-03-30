export default function TabBar({ activeTab, onTabChange }) {
  const tabs = [
    {
      key: 'home',
      label: '홈',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'url(#luaGrad)' : 'none'} fillOpacity={active ? 0.15 : 0}>
          <defs><linearGradient id="luaGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#F9E84A" /><stop offset="50%" stopColor="#FFB347" /><stop offset="100%" stopColor="#FF8FAB" /></linearGradient></defs>
          <path d="M4 12l8-7 8 7v7a1 1 0 01-1 1H5a1 1 0 01-1-1v-7z" stroke={active ? 'url(#luaGrad)' : '#bbb'} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      key: 'album',
      label: '앨범',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="8" height="8" rx="2" stroke={active ? 'url(#luaGrad)' : '#bbb'} strokeWidth="1.5" />
          <rect x="13" y="3" width="8" height="8" rx="2" stroke={active ? 'url(#luaGrad)' : '#bbb'} strokeWidth="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="2" stroke={active ? 'url(#luaGrad)' : '#bbb'} strokeWidth="1.5" />
          <rect x="13" y="13" width="8" height="8" rx="2" stroke={active ? 'url(#luaGrad)' : '#bbb'} strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      key: 'routine',
      label: '루틴',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={active ? 'url(#luaGrad)' : '#bbb'} strokeWidth="1.5" />
          <path d="M8 12.5l2.5 2.5L16 10" stroke={active ? 'url(#luaGrad)' : '#bbb'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      key: 'food',
      label: '분석',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M21 21l-4.35-4.35" stroke={active ? 'url(#luaGrad)' : '#bbb'} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="11" cy="11" r="8" stroke={active ? 'url(#luaGrad)' : '#bbb'} strokeWidth="1.5" />
          <path d="M8 11h6M11 8v6" stroke={active ? 'url(#luaGrad)' : '#bbb'} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      key: 'body',
      label: '바디',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2a3 3 0 100 6 3 3 0 000-6zM16 22v-2a4 4 0 00-8 0v2" stroke={active ? 'url(#luaGrad)' : '#bbb'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 12h8M12 10v6" stroke={active ? 'url(#luaGrad)' : '#bbb'} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 56, paddingBottom: 'env(safe-area-inset-bottom)',
      background: '#fff',
      borderTop: '0.5px solid #eee',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      zIndex: 100,
    }}>
      {tabs.map(tab => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 2,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px 0',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {tab.icon(active)}
            <span style={{
              fontSize: 9, fontWeight: active ? 600 : 400,
              color: active ? '#C4580A' : '#bbb',
            }}>{tab.label}</span>
            {active && (
              <div style={{
                width: 4, height: 4, borderRadius: '50%',
                background: 'linear-gradient(135deg, #FFB347, #FF8FAB)',
                marginTop: -1,
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}
