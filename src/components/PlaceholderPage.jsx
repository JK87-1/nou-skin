export function RoutinePlaceholder() {
  return (
    <div style={{
      minHeight: '80dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '40px 24px',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(255,220,100,0.3), rgba(255,130,170,0.2))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="4" width="16" height="5" rx="1.5" stroke="#c4705a" strokeWidth="1.5" fill="rgba(196,112,90,0.1)" />
          <rect x="4" y="11" width="16" height="5" rx="1.5" stroke="#c4705a" strokeWidth="1.5" fill="rgba(196,112,90,0.07)" />
          <rect x="4" y="18" width="16" height="3" rx="1.5" stroke="#c4705a" strokeWidth="1.5" fill="rgba(196,112,90,0.04)" />
        </svg>
      </div>
      <h2 style={{
        fontSize: 20, fontWeight: 600, color: '#2d2520',
        fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
        marginBottom: 8,
      }}>루틴</h2>
      <p style={{ fontSize: 14, color: '#A89890', textAlign: 'center', lineHeight: 1.6, marginBottom: 6 }}>
        나만의 스킨케어 루틴을<br />설정하고 관리할 수 있어요
      </p>
      <span style={{
        fontSize: 12, color: '#c4705a', background: 'rgba(196,112,90,0.1)',
        padding: '6px 16px', borderRadius: 20, fontWeight: 600, marginTop: 12,
      }}>준비 중</span>
    </div>
  );
}

export function MyPlaceholder() {
  return (
    <div style={{
      minHeight: '80dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '40px 24px',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(255,220,100,0.3), rgba(255,130,170,0.2))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke="#c4705a" strokeWidth="1.5" fill="rgba(196,112,90,0.1)" />
          <path d="M4 21v-1a6 6 0 0112 0v1" stroke="#c4705a" strokeWidth="1.5" strokeLinecap="round" fill="rgba(196,112,90,0.07)" />
        </svg>
      </div>
      <h2 style={{
        fontSize: 20, fontWeight: 600, color: '#2d2520',
        fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
        marginBottom: 8,
      }}>마이페이지</h2>
      <p style={{ fontSize: 14, color: '#A89890', textAlign: 'center', lineHeight: 1.6, marginBottom: 6 }}>
        피부 프로필과 설정을<br />관리할 수 있어요
      </p>
      <span style={{
        fontSize: 12, color: '#c4705a', background: 'rgba(196,112,90,0.1)',
        padding: '6px 16px', borderRadius: 20, fontWeight: 600, marginTop: 12,
      }}>준비 중</span>
    </div>
  );
}
