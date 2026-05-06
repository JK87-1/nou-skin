import { useState, useEffect } from 'react';
import { getOrGenerateInsights, refreshInsights, markShown } from '../engine/InsightEngine';

const TYPE_COLORS = {
  pattern: '#B8865C',
  cross_analysis: '#5E9D8A',
  change_detection: '#C97C5E',
  positive: '#5E9D8A',
  action: '#4A6B85',
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
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setInsights(getOrGenerateInsights());
  }, []);

  useEffect(() => {
    const handler = () => {
      const fresh = refreshInsights();
      setInsights(fresh);
    };
    window.addEventListener('lua-record-updated', handler);
    window.addEventListener('lua-sleep-updated', handler);
    return () => {
      window.removeEventListener('lua-record-updated', handler);
      window.removeEventListener('lua-sleep-updated', handler);
    };
  }, []);

  if (insights.length === 0) return null;

  const main = insights[0];
  const additional = insights.slice(1);
  const color = TYPE_COLORS[main.type] || '#4A6B85';

  return (
    <div style={{ marginBottom: 10 }}>
      {/* 메인 인사이트 */}
      <div
        onClick={() => additional.length > 0 && setExpanded(!expanded)}
        style={{ ...cardStyle, cursor: additional.length > 0 ? 'pointer' : 'default' }}
      >
        {/* 상단: 타입 라벨 + 새로고침 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>{main.emoji}</span>
            {main.label && (
              <span style={{ fontSize: 13, fontWeight: 600, color: '#b1b8ba' }}>{main.label}</span>
            )}
          </div>
          <div onClick={(e) => { e.stopPropagation(); setInsights(refreshInsights()); }} style={{ cursor: 'pointer', padding: 4, WebkitTapHighlightColor: 'transparent' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b1b8ba" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </div>
        </div>

        {/* 본문 */}
        <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, fontWeight: 400 }}>
          {main.message}
        </div>

        {/* 행동 버튼 */}
        {main.action && (
          <div style={{ marginTop: 12 }}>
            <button
              onClick={(e) => { e.stopPropagation(); handleAction(main.action, main.id, setInsights); }}
              style={{
                background: 'rgba(0,0,0,0.04)', border: 'none', borderRadius: 10,
                padding: '8px 14px', fontSize: 11, color: 'var(--text-primary)', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {main.action.label}
            </button>
          </div>
        )}

        {/* 더보기 */}
        {additional.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: 12, gap: 4,
          }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {expanded ? '접기' : `+${additional.length}개 더 보기`}
            </span>
            <span style={{ fontSize: 8, color: 'var(--text-muted)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
          </div>
        )}
      </div>

      {/* 추가 인사이트 */}
      {expanded && additional.map((ins, i) => {
        const c = TYPE_COLORS[ins.type] || '#4A6B85';
        return (
          <div key={ins.id || i} style={{ ...cardStyle, marginTop: 8, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 12 }}>{ins.emoji}</span>
              {ins.label && <span style={{ fontSize: 11, fontWeight: 600, color: '#b1b8ba' }}>{ins.label}</span>}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{ins.message}</div>
            {ins.action && (
              <button
                onClick={() => handleAction(ins.action, ins.id, setInsights)}
                style={{
                  background: 'rgba(0,0,0,0.04)', border: 'none', borderRadius: 8,
                  padding: '6px 12px', fontSize: 10, color: 'var(--text-primary)', fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit', marginTop: 8,
                }}
              >
                {ins.action.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function handleAction(action, insightId, setInsights) {
  // 마킹 후 리프레시
  if (insightId) markShown(insightId);

  if (action.type === 'log_water') {
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

  // 새 인사이트로 교체
  if (setInsights) {
    setTimeout(() => setInsights(refreshInsights()), 100);
  }
}
