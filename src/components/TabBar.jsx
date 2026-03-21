import SoftCloverIcon from './icons/SoftCloverIcon';

export default function TabBar({ activeTab, onTabChange, onMeasure, themeColors, colorMode }) {
  const accent = themeColors?.accent || '#81E4BD';
  const c = (active) => active ? '#81E4BD' : 'var(--tab-inactive)';

  const leftTabs = [
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
      key: 'consult',
      label: '상담',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? c(active) : 'none'} fillOpacity={active ? 0.15 : 0}>
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
            stroke={c(active)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  const rightTabs = [
    {
      key: 'history',
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

  const renderTab = (tab) => (
    <div key={tab.key} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
      <button
        className={`tab-bar-item${activeTab === tab.key ? ' active' : ''}`}
        onClick={() => onTabChange(tab.key)}
      >
        <div className="tab-bar-glow" />
        {tab.icon(activeTab === tab.key)}
        <span className="tab-bar-label">{tab.label}</span>
        <div className="tab-bar-dot" />
      </button>
    </div>
  );

  return (
    <nav className="tab-bar" style={{
      '--tab-accent': `${accent}14`,
      '--tab-glow': `${accent}33`,
      '--tab-label': themeColors?.sub || '#FFD4B8',
      '--tab-dot': accent,
      '--tab-shimmer-edge': `${accent}00`,
      '--tab-shimmer-mid': `${accent}40`,
      '--tab-shimmer-peak': `${themeColors?.sub || accent}80`,
    }}>
      {leftTabs.map(renderTab)}

      {/* Center Pearl Button */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
        <div
          onClick={(e) => { e.stopPropagation(); onMeasure?.(); }}
          style={{
            position: 'absolute', top: '50%', transform: 'translateY(-50%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <div style={{
            position: 'relative', zIndex: 2,
          }}>
            <SoftCloverIcon theme={themeColors?.cloverTheme || 'navySapphire'} size={54} animate />
          </div>
        </div>
      </div>

      {rightTabs.map(renderTab)}
    </nav>
  );
}
