// 주간 변화 리포트 카드 — 매주 사용자에게 "정말 좋아지고 있다" 감각 제공.
// 톤: 글래스(white 56%) + accent 블루(var(--accent-primary)) + spring 등장 + 부드러운 hover.
// 클릭 시 onOpenBeforeAfter callback으로 풀스크린 비교 trigger.
import { useState, useEffect } from 'react';
import { hapticLight } from '../utils/haptics';

const ACCENT = 'var(--accent-primary)';
const POSITIVE = 'var(--accent-primary)';
const NEGATIVE = '#e05545';

export default function WeeklyReportCard({ report, onOpenBeforeAfter, onDismiss }) {
  const [closing, setClosing] = useState(false);

  if (!report || !report.hasAnyMeaningfulChange) return null;

  const { topImproved, topDeclined, measuredThisWeek } = report;

  // 메인 라인 — 가장 좋아진 메트릭 강조
  const headline = topImproved
    ? `${topImproved.label}이 ${formatDiff(topImproved)} 좋아졌어요`
    : topDeclined
      ? `${topDeclined.label}이 살짝 떨어졌어요`
      : '이번 주 변화 살펴볼게요';

  const handleClose = (e) => {
    e?.stopPropagation();
    hapticLight();
    setClosing(true);
    setTimeout(() => onDismiss?.(), 200);
  };

  const handleOpen = () => {
    hapticLight();
    onOpenBeforeAfter?.();
  };

  return (
    <div
      onClick={handleOpen}
      className="tap-fx-subtle"
      style={{
        margin: '8px 16px 14px',
        padding: '16px 18px',
        background: 'var(--card-bg)',
        backdropFilter: 'var(--card-blur)',
        WebkitBackdropFilter: 'var(--card-blur)',
        border: 'none',
        borderRadius: 'var(--card-radius)',
        boxShadow: 'var(--card-shadow)',
        cursor: 'pointer',
        position: 'relative',
        animation: closing
          ? 'wrCardOut 0.22s ease forwards'
          : 'wrCardIn 0.5s cubic-bezier(0.34, 1.45, 0.5, 1) both',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <style>{`
        @keyframes wrCardIn {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes wrCardOut {
          to { opacity: 0; transform: translateY(-4px) scale(0.98); }
        }
      `}</style>

      {/* 닫기 — 우상단 */}
      <button
        onClick={handleClose}
        aria-label="닫기"
        style={{
          position: 'absolute', top: 10, right: 10,
          width: 26, height: 26, borderRadius: 13,
          background: 'rgba(0,0,0,0.04)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="2.2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11, fontWeight: 600, letterSpacing: -0.1,
          color: ACCENT,
          background: 'rgba(var(--accent-rgb),0.14)',
          padding: '3px 9px', borderRadius: 8,
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 17 9 11 13 15 21 7" />
            <polyline points="14 7 21 7 21 14" />
          </svg>
          이번 주 변화
        </span>
        <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)' }}>{measuredThisWeek}회 측정</span>
      </div>

      {/* 메인 헤드라인 */}
      <div style={{
        fontSize: 16, fontWeight: 600,
        color: '#1f1f1f', letterSpacing: -0.3,
        lineHeight: 1.4, marginBottom: 10,
      }}>
        {headline}
      </div>

      {/* 변화 chip 한 줄 */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap',
      }}>
        {topImproved && <ChangeChip change={topImproved} positive />}
        {topDeclined && <ChangeChip change={topDeclined} positive={false} />}
      </div>

      {/* CTA */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 14px', borderRadius: 14,
        background: `linear-gradient(135deg, ${ACCENT}1F, ${ACCENT}0F)`,
        border: `1px solid ${ACCENT}30`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <line x1="12" y1="5" x2="12" y2="19" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1f1f1f', letterSpacing: -0.2 }}>
            7일 전 vs 지금 비교
          </span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </div>
  );
}

function ChangeChip({ change, positive }) {
  const color = positive ? POSITIVE : NEGATIVE;
  const sign = change.displayDiff > 0 ? '+' : '';
  const value = change.unit === '세'
    ? `${sign}${change.displayDiff}세`
    : change.unit === '개'
      ? `${sign}${change.displayDiff}개`
      : `${sign}${change.displayDiff}점`;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '6px 11px', borderRadius: 12,
      background: `${color}12`,
      border: `1px solid ${color}28`,
    }}>
      <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.55)', fontWeight: 500 }}>{change.label}</span>
      <span style={{ fontSize: 13, color, fontWeight: 600, letterSpacing: -0.2 }}>{value}</span>
    </div>
  );
}

// 시각화용 — 부호 + 단위
function formatDiff(c) {
  const v = Math.abs(c.displayDiff);
  if (c.unit === '세') return `${v}세`;
  if (c.unit === '개') return `${v}개`;
  return `${v}점`;
}
