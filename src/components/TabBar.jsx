export default function TabBar({ activeTab, onTabChange, onMeasure }) {
  const c = (active) => active ? '#FF8C42' : '#c4b0a0';

  const tabs = [
    {
      key: 'home',
      label: '홈',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? c(active) : 'none'} fillOpacity={active ? 0.15 : 0}>
          <path d="M4 12l8-7 8 7v7a1 1 0 01-1 1H5a1 1 0 01-1-1v-7z" stroke={c(active)} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      key: 'routine',
      label: '루틴',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" stroke={c(active)} strokeWidth="1.5" />
          <path d="M7.5 11.5l3 3 6-6" stroke={c(active)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      key: 'history',
      label: '앨범',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="8" height="8" rx="2.5" stroke={c(active)} strokeWidth="1.5" />
          <rect x="13" y="3" width="8" height="8" rx="2.5" stroke={c(active)} strokeWidth="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="2.5" stroke={c(active)} strokeWidth="1.5" />
          <rect x="13" y="13" width="8" height="8" rx="2.5" stroke={c(active)} strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      key: 'analyze',
      label: '기록',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M2 4 C2 4, 7 3, 12 5 C17 3, 22 4, 22 4 L22 19 C22 19, 17 18, 12 20 C7 18, 2 19, 2 19 Z" stroke={c(active)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="5" x2="12" y2="20" stroke={c(active)} strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      key: 'my',
      label: '마이',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="10" r="4" stroke={c(active)} strokeWidth="1.5" />
          <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={c(active)} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="tab-bar">
      {tabs.map((tab) => (
        <div key={tab.key} style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center' }}>
          {/* Floating + button above album tab */}
          {tab.key === 'history' && activeTab === 'history' && onMeasure && (
            <div
              onClick={(e) => { e.stopPropagation(); onMeasure(); }}
              style={{
                position: 'absolute', top: -52,
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(255,255,255,0.6)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.5)',
                boxShadow: '0 4px 20px rgba(196,112,90,0.2), inset 0 1px 1px rgba(255,255,255,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', zIndex: 10,
                animation: 'popIn 0.3s ease',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="#c4705a" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          )}
          <button
            className={`tab-bar-item${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.icon(activeTab === tab.key)}
            <span className="tab-bar-label">{tab.label}</span>
          </button>
        </div>
      ))}
    </nav>
  );
}
