import { useState, useEffect } from 'react';
import { getOrGenerateInsights, refreshInsights, markShown, getGreetingByTime, toggleLike, getLikes } from '../engine/InsightEngine';
import { hapticLight } from '../utils/haptic';

const cardStyle = {
  background: 'rgba(255,255,255,0.2)',
  borderRadius: 30,
  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.3)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
  padding: 20,
};

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
      <div style={cardStyle}>

        {/* 상단: 새로고침 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <div onClick={handleRefresh} style={{ cursor: 'pointer', padding: 4, WebkitTapHighlightColor: 'transparent' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b1b8ba" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </div>
        </div>

        {/* 말풍선 1개 (lua 아이콘 포함) */}
        <div style={{
          background: 'rgba(255,255,255,0.5)', borderRadius: 20,
          padding: '16px 18px',
        }}>
          {/* lua 아이콘 + 이름 + 인사 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg, #B8865C, #D4B888, #E5D5B5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 4px rgba(184,134,92,0.2)',
              position: 'relative', flexShrink: 0,
            }}>
              <span style={{ fontSize: 12 }}>✨</span>
              <div style={{
                position: 'absolute', bottom: -1, right: -1,
                width: 8, height: 8, borderRadius: '50%',
                background: '#5E9D8A', border: '1.5px solid #fff',
              }} />
            </div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>lua</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>{greeting.discovery}</span>
            </div>
          </div>

          {/* 메시지 본문 */}
          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7 }}>
            {main.message}
          </div>
        </div>

        {/* 하단: 행동 + 하트 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
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
