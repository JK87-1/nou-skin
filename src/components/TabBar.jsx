export default function TabBar({ activeTab, onTabChange }) {
  const tabs = [
    {
      key: 'home',
      label: '홈',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M4 12l8-7 8 7v7a1 1 0 01-1 1H5a1 1 0 01-1-1v-7z" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} />
        </svg>
      ),
    },
    {
      key: 'food',
      label: '기록',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <defs><mask id="camMask"><rect width="24" height="24" fill="white" /><circle cx="12" cy="13" r="4" fill="black" /></mask></defs>
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} mask="url(#camMask)" />
        </svg>
      ),
    },
    {
      key: 'routine',
      label: '루틴',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <defs><mask id="checkMask"><rect width="24" height="24" fill="white" /><path d="M8 12.5l2.5 2.5L16 10" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></mask></defs>
          <circle cx="12" cy="12" r="9" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} mask="url(#checkMask)" />
        </svg>
      ),
    },
    {
      key: 'body',
      label: '변화',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="12" width="4" height="8" rx="1" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} />
          <rect x="10" y="7" width="4" height="13" rx="1" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} />
          <rect x="16" y="3" width="4" height="17" rx="1" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} />
        </svg>
      ),
    },
    {
      key: 'album',
      label: 'MY',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="7.5" r="4.5" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} />
          <path d="M4 22c0-4.42 3.58-8 8-8s8 3.58 8 8" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} />
        </svg>
      ),
    },
  ];

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: 100,
      display: 'flex', justifyContent: 'center',
      padding: '0 12px calc(env(safe-area-inset-bottom) + 8px)',
    }}>
    <nav style={{
      height: 52,
      width: '100%',
      maxWidth: 400,
      background: 'rgba(255,255,255,0.45)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.5)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 8px',
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
              padding: '4px 0',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {tab.icon(active)}
            </div>
            <span style={{
              fontSize: 10, fontWeight: active ? 600 : 400,
              color: active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)',
            }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
    </div>
  );
}
