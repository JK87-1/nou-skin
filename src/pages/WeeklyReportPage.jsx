import { useEffect, useMemo, useState } from 'react';
import { aggregateWeek, derivePatternInsights, getLastNDays } from '../utils/weeklyAggregator';
import { trackWeeklyReportViewed } from '../analytics/amplitude';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function dowOf(dateKey) {
  return DOW[new Date(dateKey + 'T00:00:00').getDay()];
}

function fmtMonthDay(dateKey) {
  const d = new Date(dateKey + 'T00:00:00');
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * 주간 리포트 풀스크린 모달.
 * props: open, onClose, source ('home_card'|'change_page'|'push')
 */
export default function WeeklyReportPage({ open, onClose, source = 'home_card' }) {
  const [weekOffset, setWeekOffset] = useState(0); // 0 = 이번 주(오늘 기준 과거 7일)
  const [metric, setMetric] = useState('condition'); // 'condition'|'sleep'|'steps'

  const agg = useMemo(() => {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - weekOffset * 7);
    const dateKeys = getLastNDays(7, endDate);
    return aggregateWeek(dateKeys);
  }, [weekOffset]);

  const insights = useMemo(() => derivePatternInsights(agg), [agg]);

  useEffect(() => {
    if (!open) return;
    try { trackWeeklyReportViewed({ week: agg.week, source }); } catch {}
    // 백드롭 mount 시 body scroll 잠금
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
    // 의도적으로 agg.week, source 의존성만 — open 변화는 마운트 자체로 충분
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, agg.week, source]);

  if (!open) return null;

  const empty = agg.summary.recordedDays === 0;
  const startKey = agg.dateKeys[0];
  const endKey = agg.dateKeys[agg.dateKeys.length - 1];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2005,
      background: 'var(--page-gradient, linear-gradient(to bottom, #ace2fc, #ffffff))',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      animation: 'weeklySlideUp 0.32s cubic-bezier(.18,.9,.32,1.12)',
    }}>
      <style>{`
        @keyframes weeklySlideUp { from { transform: translateY(24px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>

      {/* Header */}
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
        <div onClick={onClose} style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          주간 리포트
        </span>
      </div>

      {/* Week navigator */}
      <div style={{ padding: '14px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <button
          onClick={() => setWeekOffset((o) => o + 1)}
          style={navBtnStyle}
          aria-label="이전 주"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div style={{ textAlign: 'center', minWidth: 160 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{agg.week}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {fmtMonthDay(startKey)} – {fmtMonthDay(endKey)}
          </div>
        </div>
        <button
          onClick={() => setWeekOffset((o) => Math.max(0, o - 1))}
          disabled={weekOffset === 0}
          style={{ ...navBtnStyle, opacity: weekOffset === 0 ? 0.3 : 1, cursor: weekOffset === 0 ? 'default' : 'pointer' }}
          aria-label="다음 주"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      <div style={{ padding: '12px 20px 40px' }}>
        {empty ? (
          <EmptyState />
        ) : (
          <>
            <SummaryGrid s={agg.summary} />
            <div style={{ height: 16 }} />
            <BestWorstCard best={agg.bestDay} worst={agg.worstDay} />
            <div style={{ height: 16 }} />
            <TrendBars dailies={agg.dailies} metric={metric} onMetric={setMetric} />
            <div style={{ height: 16 }} />
            <InsightStack insights={insights} />
          </>
        )}
      </div>
    </div>
  );
}

const navBtnStyle = {
  width: 32, height: 32, borderRadius: '50%',
  background: 'rgba(255,255,255,0.5)',
  border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
  color: 'var(--text-primary)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', padding: 0,
  fontFamily: 'inherit',
};

function EmptyState() {
  return (
    <div style={{
      padding: '40px 20px', textAlign: 'center',
      background: 'var(--bg-card, rgba(255,255,255,0.6))',
      borderRadius: 18,
      color: 'var(--text-secondary)',
    }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
        이번 주는 기록이 부족해요
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.55 }}>
        컨디션·식사·수면을 며칠만 기록하면<br/>
        주간 패턴을 보여드릴 수 있어요.
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, sub }) {
  return (
    <div style={{
      flex: '1 1 calc(50% - 8px)', minWidth: 0,
      background: 'var(--bg-card, rgba(255,255,255,0.6))',
      borderRadius: 16, padding: '14px 14px 12px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-dim, #8B95A1)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SummaryGrid({ s }) {
  const fmt = (v, digits = 1) => (v == null ? '—' : v.toFixed(digits));
  const round = (v) => (v == null ? '—' : Math.round(v).toLocaleString());

  const weightUnit = '';
  const weightValue = s.weightEnd == null ? '—' : s.weightEnd.toFixed(1);
  const weightSub = s.weightDelta == null
    ? '기록 없음'
    : `${s.weightDelta > 0 ? '+' : ''}${s.weightDelta.toFixed(1)} kg`;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <MetricCard label="평균 컨디션" value={fmt(s.avgCondition)} unit="/ 10" sub={s.recordedDays ? `${s.recordedDays}일 기록` : null} />
      <MetricCard label="평균 수면" value={fmt(s.avgSleepHours)} unit="시간" />
      <MetricCard label="식사 칼로리" value={round(s.totalKcal)} unit="kcal" sub={s.avgDailyKcal ? `일 평균 ${round(s.avgDailyKcal)}` : null} />
      <MetricCard label="평균 수분" value={fmt(s.avgWaterCups, 1)} unit="잔" />
      <MetricCard label="체중" value={weightValue} unit={s.weightEnd != null ? 'kg' : weightUnit} sub={weightSub} />
      <MetricCard label="평균 걸음" value={round(s.avgSteps)} unit="보" sub={s.totalSteps ? `합계 ${round(s.totalSteps)}` : null} />
    </div>
  );
}

function BestWorstCard({ best, worst }) {
  if (!best && !worst) return null;
  return (
    <div style={{
      display: 'flex', gap: 12,
    }}>
      {best && (
        <div style={{
          flex: 1, padding: '14px',
          background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))',
          border: '1px solid rgba(34,197,94,0.25)',
          borderRadius: 16,
        }}>
          <div style={{ fontSize: 11, color: '#22C55E', fontWeight: 600, marginBottom: 4 }}>가장 좋았던 날</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {dowOf(best.date)} · {fmtMonthDay(best.date)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            컨디션 {best.conditionScore.toFixed(1)}점
          </div>
        </div>
      )}
      {worst && best?.date !== worst.date && (
        <div style={{
          flex: 1, padding: '14px',
          background: 'linear-gradient(135deg, rgba(224,80,80,0.12), rgba(224,80,80,0.04))',
          border: '1px solid rgba(224,80,80,0.25)',
          borderRadius: 16,
        }}>
          <div style={{ fontSize: 11, color: '#E05050', fontWeight: 600, marginBottom: 4 }}>가장 힘들었던 날</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {dowOf(worst.date)} · {fmtMonthDay(worst.date)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            컨디션 {worst.conditionScore.toFixed(1)}점
          </div>
        </div>
      )}
    </div>
  );
}

const METRIC_DEFS = {
  condition: { label: '컨디션', key: 'conditionScore', max: 10, color: '#FF8C42' },
  sleep:     { label: '수면',   key: 'sleepHours',     max: 12, color: '#89cef5' },
  steps:     { label: '걸음',   key: 'steps',          max: null, color: '#A78BFA' },
};

function TrendBars({ dailies, metric, onMetric }) {
  const def = METRIC_DEFS[metric];
  const values = dailies.map((d) => d[def.key]);
  const positive = values.filter((v) => v != null && v > 0);
  const max = def.max ?? (positive.length ? Math.max(...positive) : 1);

  return (
    <div style={{
      background: 'var(--bg-card, rgba(255,255,255,0.6))',
      borderRadius: 16, padding: '14px 14px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>7일 추이</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {Object.entries(METRIC_DEFS).map(([k, v]) => (
            <button
              key={k}
              onClick={() => onMetric(k)}
              style={{
                padding: '4px 10px', borderRadius: 999,
                border: 'none',
                background: metric === k ? v.color : 'rgba(0,0,0,0.05)',
                color: metric === k ? '#fff' : 'var(--text-secondary)',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >{v.label}</button>
          ))}
        </div>
      </div>
      <BarChart dailies={dailies} values={values} max={max} color={def.color} />
    </div>
  );
}

function BarChart({ dailies, values, max, color }) {
  const W = 280, H = 120, padTop = 6, padBottom = 22;
  const cols = dailies.length;
  const colW = W / cols;
  const barW = Math.min(22, colW * 0.55);
  const chartH = H - padTop - padBottom;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="xMidYMid meet">
      {/* baseline */}
      <line x1={0} x2={W} y1={H - padBottom} y2={H - padBottom} stroke="var(--border-subtle, rgba(0,0,0,0.08))" strokeWidth="1" />
      {dailies.map((d, i) => {
        const v = values[i];
        const x = i * colW + colW / 2 - barW / 2;
        const h = v != null && v > 0 ? Math.max(2, (v / max) * chartH) : 0;
        const y = H - padBottom - h;
        const dow = dowOf(d.date);
        const isLast = i === dailies.length - 1;
        return (
          <g key={d.date}>
            {h > 0 && (
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={4}
                fill={color}
                opacity={isLast ? 1 : 0.82}
              />
            )}
            <text
              x={i * colW + colW / 2}
              y={H - 6}
              textAnchor="middle"
              fontSize="10"
              fill="var(--text-muted)"
            >{dow}</text>
          </g>
        );
      })}
    </svg>
  );
}

function InsightStack({ insights }) {
  if (!insights || insights.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {insights.map((text, i) => (
        <div key={i} style={{
          padding: '14px',
          background: 'linear-gradient(135deg, rgba(255,140,66,0.10), rgba(137,206,245,0.06))',
          border: '1px solid rgba(255,140,66,0.18)',
          borderRadius: 16,
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 10, flexShrink: 0,
            background: 'rgba(255,140,66,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#FF8C42', fontWeight: 700, fontSize: 14,
          }}>{i + 1}</div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-primary)' }}>
            {text}
          </div>
        </div>
      ))}
    </div>
  );
}
