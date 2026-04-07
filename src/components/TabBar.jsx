export default function TabBar({ activeTab, onTabChange }) {
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
      label: '기록',
      icon: (active) => (
        <svg width="22" height="22" viewBox="-10 -10 246.77 243.59" fill="none">
          <path d="M203.94,213.17l-180.79.02c-12.55,0-23.14-9.72-23.14-22.53v-125.2c0-12.23,10.09-22.28,21.99-22.31l39.87-.09,15.94-23.86c3.93-5.88,10.01-9.45,17.05-10.13h36.6c6.85.52,13.18,3.75,17.06,9.53l16.39,24.45,39.87.09c11.89.03,21.99,10.08,21.99,22.3v125.22c0,12.43-10.21,22.49-22.84,22.5ZM117.96,171.43c23.47-2.19,40.73-21.74,40.6-44.94-.12-23.3-17.72-42.42-40.87-44.47-24.88-2.2-46.56,15.89-48.75,40.67-2.47,28.01,20.6,51.39,49.02,48.74Z" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} />
        </svg>
      ),
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
      label: '변화',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="13" width="5" height="9" rx="1.5" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} />
          <rect x="9.5" y="7" width="5" height="15" rx="1.5" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} />
          <rect x="16" y="2" width="5" height="20" rx="1.5" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} />
        </svg>
      ),
    },
    {
      key: 'album',
      label: 'MY',
      icon: (active) => (
        <svg width="22" height="22" viewBox="-20 -20 552 552" fill="none">
          <path d="M469.61,484.6c-63.92,14.5-126.76,22.39-191.53,23.85l-44.74.03c-66.13-1.92-131.72-9.26-195.73-25.36-22.98-5.78-30.89-29.82-25.33-50.57,19.1-71.28,66.84-130.29,132.92-163.05,11.83-5.87,24.58-7.16,36.5-.29,19.71,11.35,41.11,18.53,64.11,19.8,29.09,1.61,56.51-4.04,81.69-18.53,9.77-5.62,21.92-8.61,32.95-3.54,71.1,32.65,123.67,96.88,140.16,173.54,4.52,20.99-10.69,39.52-31.01,44.13Z" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} />
          <path d="M273.16,4.72c65.31,8.9,110.9,67.14,107.25,130.58s-58.06,116.83-123.03,117.69-119.96-48.9-125.86-113.23C125.51,74.28,171.1,14.87,236.9,4.94c11.77-1.78,23.73-1.92,36.26-.21Z" fill={active ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)'} />
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
            onClick={() => onTabChange(tab.key)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '12px 0 30px',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
