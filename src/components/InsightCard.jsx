import { useState, useEffect } from 'react';
import { getOrGenerateInsights, refreshInsights } from '../engine/InsightEngine';

const TYPE_COLORS = {
  pattern: '#B8865C',
  cross_analysis: '#5E9D8A',
  change_detection: '#C97C5E',
  positive: '#5E9D8A',
  action: '#4A6B85',
};

export default function InsightCard() {
  const [insights, setInsights] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setInsights(getOrGenerateInsights());
  }, []);

  // 데이터 변경 시 갱신
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

  const now = new Date();
  const timeStr = `오늘 ${now.getHours() < 12 ? '오전' : '오후'} ${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div style={{ marginBottom: 14 }}>
      {/* 메인 인사이트 */}
      <div
        onClick={() => additional.length > 0 && setExpanded(!expanded)}
        style={{
          background: 'linear-gradient(180deg, #E8F1F7 0%, #F4F8FB 100%)',
          borderRadius: 16, padding: 16,
          boxShadow: '0 2px 8px rgba(74, 107, 133, 0.06)',
          cursor: additional.length > 0 ? 'pointer' : 'default',
        }}
      >
        {/* 상단 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 14 }}>{main.emoji}</span>
            {main.label && (
              <span style={{ fontSize: 10, fontWeight: 500, color }}>{main.label}</span>
            )}
          </div>
          <span style={{ fontSize: 9, color: '#8BA6BD' }}>{timeStr}</span>
        </div>

        {/* 본문 */}
        <div style={{ fontSize: 14, color: '#2C4A5E', lineHeight: 1.5 }}>{main.message}</div>

        {/* 행동 버튼 */}
        {main.action && (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={(e) => { e.stopPropagation(); handleAction(main.action); }}
              style={{
                background: '#fff', border: '0.5px solid #4A6B85', borderRadius: 8,
                padding: '6px 10px', fontSize: 10, color: '#4A6B85', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {main.action.label}
            </button>
          </div>
        )}

        {/* 더보기 힌트 */}
        {additional.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: 10, gap: 4,
          }}>
            <span style={{ fontSize: 9, color: '#8BA6BD' }}>
              {expanded ? '접기' : `+${additional.length}개 더 보기`}
            </span>
            <span style={{ fontSize: 8, color: '#8BA6BD', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
          </div>
        )}
      </div>

      {/* 추가 인사이트 (확장) */}
      {expanded && additional.map((ins, i) => {
        const c = TYPE_COLORS[ins.type] || '#4A6B85';
        return (
          <div key={ins.id || i} style={{
            background: '#fff', borderRadius: 12, padding: '12px 16px',
            marginTop: 6, border: '0.5px solid rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 12 }}>{ins.emoji}</span>
              {ins.label && <span style={{ fontSize: 9, fontWeight: 500, color: c }}>{ins.label}</span>}
            </div>
            <div style={{ fontSize: 12, color: '#2C4A5E', lineHeight: 1.5 }}>{ins.message}</div>
            {ins.action && (
              <button
                onClick={() => handleAction(ins.action)}
                style={{
                  background: 'transparent', border: '0.5px solid #4A6B85', borderRadius: 6,
                  padding: '4px 8px', fontSize: 9, color: '#4A6B85', fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit', marginTop: 6,
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

function handleAction(action) {
  if (action.type === 'log_water') {
    // 물 1잔 추가
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
}
