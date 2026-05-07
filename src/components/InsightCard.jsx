import { useState, useEffect } from 'react';
import { getOrGenerateInsights, refreshInsights, markShown, getGreetingByTime, toggleLike, getLikes, triggerLLMOnDataInput } from '../engine/InsightEngine';
import { hapticLight } from '../utils/haptic';

export default function InsightCard() {
  const [insights, setInsights] = useState([]);
  const [likes, setLikes] = useState(getLikes);
  const [refreshing, setRefreshing] = useState(false);
  const [llmLoading, setLlmLoading] = useState(false);

  useEffect(() => { setInsights(getOrGenerateInsights()); }, []);

  useEffect(() => {
    const triggerAndRefresh = (dataType) => {
      setInsights(refreshInsights());
      setLlmLoading(true);
      triggerLLMOnDataInput(dataType).finally(() => setLlmLoading(false));
    };
    const handlers = {
      'lua-record-updated': () => triggerAndRefresh('meal_logged'),
      'lua-sleep-updated': () => triggerAndRefresh('sleep_logged'),
      'lua-food-logged': () => triggerAndRefresh('meal_logged'),
      'lua-drink-logged': (e) => triggerAndRefresh(e.detail?.type || 'drink_caffeine'),
      'lua-condition-logged': () => triggerAndRefresh('condition_logged'),
      'lua-supplement-completed': () => triggerAndRefresh('supplement_completed'),
      'lua-llm-insight-ready': () => setInsights(getOrGenerateInsights()),
    };
    Object.entries(handlers).forEach(([evt, fn]) => window.addEventListener(evt, fn));
    return () => Object.entries(handlers).forEach(([evt, fn]) => window.removeEventListener(evt, fn));
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
        padding: '16px 18px 20px',
      }}>

        {/* lua 아이콘 + 이름 + 인사 + 새로고침 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', flexShrink: 0, width: 20, height: 20 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 2px rgba(220,160,170,0.35))' }}>
                <defs><linearGradient id="luaSmile" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F8C8D0"/><stop offset="100%" stopColor="#E8A0B0"/></linearGradient></defs>
                <circle cx="12" cy="12" r="10" fill="url(#luaSmile)" opacity="0.7"/>
                <circle cx="9" cy="10.5" r="1.2" fill="#fff" opacity="0.9"/>
                <circle cx="15" cy="10.5" r="1.2" fill="#fff" opacity="0.9"/>
                <path d="M9.5 14.5c0 0 1 1.5 2.5 1.5s2.5-1.5 2.5-1.5" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.9"/>
              </svg>
              <div style={{
                position: 'absolute', bottom: -1, right: -1,
                width: 7, height: 7, borderRadius: '50%',
                background: '#89cef5', border: '1.5px solid #fff',
              }} />
            </div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>lua</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>{new Date().getHours()}:{String(new Date().getMinutes()).padStart(2, '0')} 기준</span>
            </div>
          </div>
        </div>

        {/* 메시지 + 인라인 버튼 */}
        <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(0,0,0,0.6)', lineHeight: 1.7 }}>
          {main.message}
          {main.action && (
            <button onClick={handleAction} style={{
              display: 'inline-block', background: 'rgba(0,0,0,0.04)', border: 'none', borderRadius: 10,
              padding: '5px 12px', fontSize: 11, color: 'var(--text-primary)', fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit', marginLeft: 4, verticalAlign: 'middle',
            }}>
              {main.action.label}
            </button>
          )}
          <span style={{ display: 'inline-flex', gap: 12, marginLeft: 8, verticalAlign: 'middle' }}>
            <span onClick={handleRefresh} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent', display: 'inline-flex' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </span>
            <span onClick={handleLike} style={{
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent', display: 'inline-flex',
              transition: 'transform 0.15s',
              transform: isLiked ? 'scale(1.1)' : 'scale(1)',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={isLiked ? '#E8A0B0' : 'none'} stroke={isLiked ? '#E8A0B0' : '#ccc'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.15s' }}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </span>
          </span>
        </div>

      </div>
    </div>
  );
}
