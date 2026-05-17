export default function TabBar({ activeTab, onTabChange, themeColors, colorMode }) {
  const c = (active) => active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)';

  const leftTabs = [
    {
      key: 'home',
      label: '홈',
      icon: (active) => (
        <svg width="28" height="28" viewBox="-5 -5 34 34" fill="none">
          <path d="M10.26,14.74c-1.03,0-1.9.87-1.9,1.89l-.02,4.86c0,1.23-1.02,2.3-2.26,2.34h-3.72C1.09,23.83,0,22.73,0,21.45v-7.91s0-5.13,0-5.13c0-.87.43-1.68,1.19-2.14L10.74.54c.79-.52,1.82-.5,2.6.05l9.38,5.62c.8.48,1.28,1.29,1.28,2.23v13.06c-.01,1.21-1.04,2.27-2.24,2.31h-3.8c-1.29,0-2.3-1.13-2.3-2.4v-4.72c0-1.01-.82-1.93-1.84-1.96h-3.55Z" fill={c(active)} />
        </svg>
      ),
    },
    {
      key: 'history',
      label: '케어',
      icon: (active) => (
        <svg width="28" height="28" viewBox="0 0 24 24" fill={c(active)}>
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M22 5a1 1 0 0 1 -1 1h-8a1 1 0 0 1 0 -2h8a1 1 0 0 1 1 1m-3 4a1 1 0 0 1 -1 1h-5a1 1 0 0 1 0 -2h5a1 1 0 0 1 1 1m3 6a1 1 0 0 1 -1 1h-8a1 1 0 0 1 0 -2h8a1 1 0 0 1 1 1m-3 4a1 1 0 0 1 -1 1h-5a1 1 0 0 1 0 -2h5a1 1 0 0 1 1 1m-11 -16a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2l.001 -4.051l.004 -.051a1.996 1.996 0 0 1 1.995 -1.898zm0 10a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2l.001 -4.051l.004 -.051a1.996 1.996 0 0 1 1.995 -1.898z" />
        </svg>
      ),
    },
  ];

  const rightTabs = [
    {
      key: 'discover',
      label: '발견',
      icon: (active) => (
        <svg width="28" height="28" viewBox="0 0 24 24" fill={c(active)}>
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M17.997 4.17a3 3 0 0 1 2.003 2.83v12a3 3 0 0 1 -3 3h-10a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 2.003 -2.83a4 4 0 0 0 3.997 3.83h4a4 4 0 0 0 3.98 -3.597zm-3.704 7.123l-3.293 3.292l-1.293 -1.292a1 1 0 1 0 -1.414 1.414l2 2a1 1 0 0 0 1.414 0l4 -4a1 1 0 0 0 -1.414 -1.414m-.293 -9.293a2 2 0 1 1 0 4h-4a2 2 0 1 1 0 -4z" />
        </svg>
      ),
    },
    {
      key: 'my',
      label: '마이',
      icon: (active) => (
        <svg width="28" height="28" viewBox="-3 -3 30 30" fill="none">
          <path d="M10.14,24l-1.47-.04-2.51-.12c-1.25-.06-2.47-.2-3.68-.54-1.15-.32-2.37-1.13-2.24-2.28.2-1.82,1.05-3.44,2.46-4.62,2.32-1.95,5.74-2.57,8.75-2.64,3.36-.07,7.32.49,9.91,2.7,1.28,1.09,2.06,2.61,2.36,4.25.28,1.55-1.2,2.4-2.66,2.71-1.57.34-3.15.46-4.76.5l-2.98.07h-3.2Z" fill={c(active)} />
          <path d="M15.85,11.1c-2.09,1.64-5.01,1.75-7.21.33-2.4-1.54-3.38-4.46-2.47-7.14C7.04,1.71,9.57.05,12.36.19c3.17.16,5.71,2.71,5.8,5.9.05,1.95-.74,3.78-2.32,5.01Z" fill={c(active)} />
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
          color: activeTab === tab.key ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)',
        }}>{tab.label}</span>
      </button>
    </div>
  );

  return (
    <nav className="tab-bar">
      {leftTabs.map(renderTab)}
      {rightTabs.map(renderTab)}
    </nav>
  );
}
