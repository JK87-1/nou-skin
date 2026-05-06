import { useState, useEffect } from 'react';
import { getOrGenerateInsights, refreshInsights, markShown, getGreetingByTime, toggleLike, getLikes } from '../engine/InsightEngine';
import { hapticLight } from '../utils/haptic';

export default function InsightCard() {
  const [insights, setInsights] = useState([]);
  const [likes, setLikes] = useState(getLikes);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { setInsights(getOrGenerateInsights()); }, []);

  useEffect(() => {
    const handler = () => setInsights(refreshInsights());
    window.addEventListener('lua-record-updated', handler);
    window.addEventListener('lua-sleep-updated', handler);
    return () => {
      window.removeEventListener('lua-record-updated', handler);
      window.removeEventListener('lua-sleep-updated', handler);
    };
  }, []);

  if (insights.length === 0) return null;

  const main = insights[0];
  const greeting = getGreetingByTime();
  const isLiked = !!likes[main.id];

  const handleRefresh = (e) => {
    e.stopPropagation();
    setRefreshing(true);
    setTimeout(() => { setInsights(refreshInsights()); setRefreshing(false); }, 150);
    hapticLight();
  };

  const handleLike = (e) => {
    e.stopPropagation();
    toggleLike(main.id);
    setLikes(getLikes());
    hapticLight();
  };

  const handleAction = () => {
    if (!main.action) return;
    markShown(main.id);
    if (main.action.type === 'log_water') {
      try {
        const todayKey = new Date().toISOString().slice(0, 10);
        const all = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
        const today = all[todayKey] || { date: todayKey };
        today.water = today.water || { cups: 0 };
        today.water.cups += 1;
        all[todayKey] = today;
        localStorage.setItem('lua_record_v2', JSON.stringify(all));
        window.dispatchEvent(new Event('lua-record-updated'));
      } catch { /* ignore */ }
    }
    setTimeout(() => setInsights(refreshInsights()), 100);
  };

  return (
    <div style={{ marginBottom: 10, opacity: refreshing ? 0.4 : 1, transition: 'opacity 0.15s' }}>
      {/* 카드 자체가 말풍선 */}
      <div style={{
        background: 'rgba(255,255,255,0.45)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '24px 24px 24px 6px',
        border: '1px solid rgba(255,255,255,0.4)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.5)',
        padding: '18px 20px',
      }}>

        {/* lua 아이콘 + 이름 + 인사 + 새로고침 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', flexShrink: 0, width: 36, height: 36 }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 2px rgba(220,160,170,0.35))' }}>
                <defs><linearGradient id="luaSmile" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F8C8D0"/><stop offset="100%" stopColor="#E8A0B0"/></linearGradient></defs>
                <circle cx="12" cy="12" r="10" fill="url(#luaSmile)" opacity="0.7"/>
                <circle cx="9" cy="10.5" r="1.2" fill="#fff" opacity="0.9"/>
                <circle cx="15" cy="10.5" r="1.2" fill="#fff" opacity="0.9"/>
                <path d="M9.5 14.5c0 0 1 1.5 2.5 1.5s2.5-1.5 2.5-1.5" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.9"/>
              </svg>
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 10, height: 10, borderRadius: '50%',
                background: '#89cef5', border: '2px solid #fff',
              }} />
            </div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>lua</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>{greeting.discovery}</span>
            </div>
          </div>
          <div onClick={handleRefresh} style={{ cursor: 'pointer', padding: 4, WebkitTapHighlightColor: 'transparent' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b1b8ba" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </div>
        </div>

        {/* 메시지 본문 */}
        <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(0,0,0,0.7)', lineHeight: 1.7 }}>
          {main.message}
        </div>

        {/* 하단: 행동 + 하트 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <div>
            {main.action && (
              <button onClick={handleAction} style={{
                background: 'rgba(0,0,0,0.04)', border: 'none', borderRadius: 10,
                padding: '7px 14px', fontSize: 11, color: 'var(--text-primary)', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {main.action.label}
              </button>
            )}
          </div>
          <div onClick={handleLike} style={{
            cursor: 'pointer', padding: '4px 8px',
            WebkitTapHighlightColor: 'transparent',
            transition: 'transform 0.15s',
            transform: isLiked ? 'scale(1.1)' : 'scale(1)',
          }}>
            <span style={{
              fontSize: 18,
              color: isLiked ? '#C97C5E' : 'rgba(0,0,0,0.12)',
              transition: 'color 0.15s',
            }}>
              {isLiked ? '♥' : '♡'}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
