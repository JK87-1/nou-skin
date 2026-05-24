import { useCallback } from 'react';

export default function TabBar({ activeTab, onTabChange, themeColors, colorMode }) {
  const c = (active) => active ? '#0f0f0f' : '#d0d0d0';
  const tabBarRef = useCallback((node) => {
    if (node) {
      const update = () => document.documentElement.style.setProperty('--tab-bar-h', node.offsetHeight + 'px');
      update();
      const ro = new ResizeObserver(update);
      ro.observe(node);
    }
  }, []);

  const leftTabs = [
    {
      key: 'home',
      label: '홈',
      icon: (active) => (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c(active)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 8.71l-5.333 -4.148a2.666 2.666 0 0 0 -3.274 0l-5.334 4.148a2.665 2.665 0 0 0 -1.029 2.105v7.2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-7.2c0 -.823 -.38 -1.6 -1.03 -2.105" />
        </svg>
      ),
    },
    {
      key: 'care1',
      label: '화장대',
      icon: (active) => (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c(active)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" />
        </svg>
      ),
    },
    {
      key: 'history',
      label: '케어',
      icon: (active) => (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c(active)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666" /><path d="M4.012 16.737a2 2 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" /><path d="M11 14l2 2l4 -4" />
        </svg>
      ),
    },
  ];

  const rightTabs = [
    {
      key: 'discover',
      label: '발견',
      icon: (active) => (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c(active)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="12" width="4" height="9" rx="1" /><rect x="10" y="3" width="4" height="18" rx="1" /><rect x="17" y="7" width="4" height="14" rx="1" />
        </svg>
      ),
    },
    {
      key: 'my',
      label: '마이',
      icon: (active) => (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c(active)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 10a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M6.168 18.849a4 4 0 0 1 3.832 -2.849h4a4 4 0 0 1 3.834 2.855" />
        </svg>
      ),
    },
  ];

  const renderTab = (tab) => (
    <div key={tab.key} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
      <button
        className={`tab-bar-item${activeTab === tab.key ? ' active' : ''}`}
        onClick={() => onTabChange(tab.key)}
        style={{ gap: 4 }}
      >
        {tab.icon(activeTab === tab.key)}
        <span style={{
          fontSize: 11, fontWeight: 500,
          color: activeTab === tab.key ? '#0f0f0f' : '#d0d0d0',
        }}>{tab.label}</span>
      </button>
    </div>
  );

  return (
    <nav className="tab-bar" ref={tabBarRef}>
      {leftTabs.map(renderTab)}
      {rightTabs.map(renderTab)}
    </nav>
  );
}
