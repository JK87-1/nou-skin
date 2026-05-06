import { useState, useEffect } from 'react';
import { getOrGenerateInsights, refreshInsights, markShown, getGreetingByTime, splitIntoBubbles, toggleLike, getLikes } from '../engine/InsightEngine';
import { hapticLight } from '../utils/haptic';

const TYPE_COLORS = {
  pattern: '#B8865C',
  cross_analysis: '#5E9D8A',
  change_detection: '#C97C5E',
  positive: '#5E9D8A',
  action: '#4A6B85',
  fallback: '#6B8499',
};

// 카드 종류별 이모지 (말풍선 좌측)
const CARD_EMOJI_MAP = {
  A1: '💧', A2: '☕', A4: '😴', A6: '🍺', A8: '🏃', A9: '☕', A10: '😰',
  B1: '☕', B2: '💧', B3: '🏃', B4: '🍱', B5: '☕', B6: '🍺', B7: '🌙', B8: '🍱',
  C1: '⚡', C2: '😴', C3: '✨', C4: '💧', C5: '☕', C6: '😴',
  D1: '💧', D2: '💊', D3: '✨', D4: '✨',
  E1: '💧', E2: '🌙', E3: '☕', E4: '🍺',
};

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

  useEffect(() => {
    setInsights(getOrGenerateInsights());
  }, []);

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
  const { bubble1, bubble2 } = splitIntoBubbles(main.message);
  const cardEmoji = CARD_EMOJI_MAP[main.id] || '✨';
  const isLiked = !!likes[main.id];

  const handleRefresh = (e) => {
    e.stopPropagation();
    setRefreshing(true);
    setTimeout(() => {
      setInsights(refreshInsights());
      setRefreshing(false);
    }, 150);
    hapticLight();
  };

  const handleLike = (e) => {
    e.stopPropagation();
    const liked = toggleLike(main.id);
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

        {/* [1] 상단: lua 정체성 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* lua 아이콘 */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #B8865C, #D4B888, #E5D5B5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(184,134,92,0.25)',
              position: 'relative', flexShrink: 0,
            }}>
              <span style={{ fontSize: 14 }}>✨</span>
              {/* 온라인 점 */}
              <div style={{
                position: 'absolute', bottom: -1, right: -1,
                width: 9, height: 9, borderRadius: '50%',
                background: '#5E9D8A', border: '1.5px solid #fff',
              }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>lua</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{greeting.discovery}</div>
            </div>
          </div>
          {/* 새로고침 */}
          <div onClick={handleRefresh} style={{ cursor: 'pointer', padding: 6, WebkitTapHighlightColor: 'transparent' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b1b8ba" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </div>
        </div>

        {/* [2] 메시지: 말풍선 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: bubble2 ? 6 : 0 }}>
          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }}>{cardEmoji}</span>
          <div style={{
            background: 'rgba(255,255,255,0.6)', borderRadius: '14px 14px 14px 4px',
            padding: '10px 14px', flex: 1,
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{bubble1}</div>
          </div>
        </div>

        {bubble2 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 16, flexShrink: 0, visibility: 'hidden' }}>{cardEmoji}</span>
            <div style={{
              background: 'rgba(255,255,255,0.4)', borderRadius: '14px 14px 14px 4px',
              padding: '10px 14px', flex: 1,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.6 }}>{bubble2}</div>
            </div>
          </div>
        )}

        {/* [3] 하단: 행동 + 하트 */}
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
          {/* 하트 */}
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
