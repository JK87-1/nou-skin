export default function TabBar({ activeTab, onTabChange }) {
  const tabs = [
    {
      key: 'home',
      label: '홈',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <defs><linearGradient id="luaGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#81E4BD" /><stop offset="100%" stopColor="#81E4BD" /></linearGradient></defs>
          <path d="M4 12l8-7 8 7v7a1 1 0 01-1 1H5a1 1 0 01-1-1v-7z" stroke={active ? '#81E4BD' : '#bbb'} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      key: 'food',
      label: '기록',
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={active ? '#81E4BD' : '#bbb'} strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="12" cy="13" r="4" stroke={active ? '#81E4BD' : '#bbb'} strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      key: 'body',
      label: 'MY',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="10" r="4" stroke={active ? '#81E4BD' : '#bbb'} strokeWidth="1.5" />
          <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={active ? '#81E4BD' : '#bbb'} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      key: 'routine',
      label: '루틴',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={active ? '#81E4BD' : '#bbb'} strokeWidth="1.5" />
          <path d="M8 12.5l2.5 2.5L16 10" stroke={active ? '#81E4BD' : '#bbb'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      key: 'album',
      label: '앨범',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="8" height="8" rx="2" stroke={active ? '#81E4BD' : '#bbb'} strokeWidth="1.5" />
          <rect x="13" y="3" width="8" height="8" rx="2" stroke={active ? '#81E4BD' : '#bbb'} strokeWidth="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="2" stroke={active ? '#81E4BD' : '#bbb'} strokeWidth="1.5" />
          <rect x="13" y="13" width="8" height="8" rx="2" stroke={active ? '#81E4BD' : '#bbb'} strokeWidth="1.5" />
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
            <div style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {tab.icon(active)}
            </div>
            <span style={{
              fontSize: 9, fontWeight: active ? 600 : 400,
              color: active ? '#81E4BD' : '#bbb',
            }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
