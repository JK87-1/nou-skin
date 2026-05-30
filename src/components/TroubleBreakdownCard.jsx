/**
 * TroubleBreakdownCard — 트러블 5종 분류 시각화.
 *
 * 측정 결과의 troubleBreakdown 필드를 받아서:
 * - 화이트헤드 / 블랙헤드 / 구진 / 농포 / 결절
 * 각 종류별 카운트 + 비주얼 (dot row) 표시.
 *
 * 0개 종류는 흐림 처리.
 * GPT 시각 추정임을 짧게 명시 (의료 진단 아님).
 */

const TROUBLE_TYPES = [
  {
    key: 'whitehead', label: '화이트헤드', emoji: '⚪',
    color: '#E8E0D0', hint: '닫힌 면포 · BHA 케어',
  },
  {
    key: 'blackhead', label: '블랙헤드', emoji: '⚫',
    color: '#5A5A60', hint: '열린 면포 · BHA·딥클렌징',
  },
  {
    key: 'papule', label: '구진', emoji: '🔴',
    color: '#E89090', hint: '붉은 솟음 · 시카·진정',
  },
  {
    key: 'pustule', label: '농포', emoji: '🟡',
    color: '#F0D078', hint: '고름 동반 · 살리실산·아연',
  },
  {
    key: 'nodule', label: '결절·낭종', emoji: '🟤',
    color: '#A87858', hint: '깊은 염증 · 피부과 권유',
  },
];

export default function TroubleBreakdownCard({ breakdown }) {
  if (!breakdown || typeof breakdown !== 'object') return null;
  const total = TROUBLE_TYPES.reduce((s, t) => s + (Number(breakdown[t.key]) || 0), 0);
  if (total === 0) return null;

  const maxCount = Math.max(...TROUBLE_TYPES.map(t => Number(breakdown[t.key]) || 0));

  return (
    <div style={{
      background: 'var(--card-bg)',
      backdropFilter: 'var(--card-blur)', WebkitBackdropFilter: 'var(--card-blur)',
      border: 'none',
      borderRadius: 'var(--card-radius)',
      padding: '14px 16px',
      marginTop: 8, marginBottom: 8,
      boxShadow: 'var(--card-shadow)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
          letterSpacing: -0.2,
        }}>트러블 종류별 분류</div>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>총 {total}개</div>
      </div>

      {/* 5종 row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {TROUBLE_TYPES.map(t => {
          const count = Number(breakdown[t.key]) || 0;
          const isZero = count === 0;
          const fillPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div key={t.key} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              opacity: isZero ? 0.4 : 1,
            }}>
              {/* Emoji + Label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 110, flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{t.emoji}</span>
                <span style={{
                  fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                  letterSpacing: -0.1,
                }}>{t.label}</span>
              </div>

              {/* Bar */}
              <div style={{
                flex: 1, height: 5, borderRadius: 3,
                background: 'rgba(0,0,0,0.05)', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${fillPct}%`,
                  background: isZero ? 'transparent' : t.color,
                  transition: 'width 0.6s cubic-bezier(0.32,0.72,0,1)',
                }} />
              </div>

              {/* Count */}
              <div style={{
                fontSize: 13, fontWeight: 500,
                color: isZero ? 'var(--text-muted)' : 'var(--text-primary)',
                minWidth: 26, textAlign: 'right',
              }}>{count}</div>
            </div>
          );
        })}
      </div>

      {/* 가장 많은 종류 한 줄 안내 */}
      {(() => {
        const sorted = [...TROUBLE_TYPES]
          .map(t => ({ ...t, count: Number(breakdown[t.key]) || 0 }))
          .filter(t => t.count > 0)
          .sort((a, b) => b.count - a.count);
        if (sorted.length === 0) return null;
        const top = sorted[0];
        return (
          <div style={{
            marginTop: 11, paddingTop: 10,
            borderTop: '1px solid rgba(0,0,0,0.05)',
            fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)',
            lineHeight: 1.55, letterSpacing: -0.1,
          }}>
            <strong style={{ color: 'var(--text-primary)' }}>{top.label}</strong>
            {`이(가) 중심이에요. ${top.hint}`}
          </div>
        );
      })()}

      {/* 의료 진단 아님 고지 */}
      <div style={{
        marginTop: 8,
        fontSize: 10, fontWeight: 500, color: 'var(--text-dim, #B3B3B3)', lineHeight: 1.5,
      }}>
        AI 시각 추정이에요. 의료 진단이 아니라 참고용입니다.
      </div>
    </div>
  );
}
