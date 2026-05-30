import { useEffect, useState } from 'react';
import { hapticSuccess } from '../utils/haptics';

/**
 * BaselineCompleteModal — 3회 baseline 측정 완성 시 축하 + 다음 행동 안내.
 *
 * 애플 setup 완료 화면 톤. 사용자가 첫 흐름을 완수했음을 명확히 알리고
 * "이제 매일 측정해 변화를 추적하세요" 다음 단계 유도.
 *
 * avgScore — 3회 평균 종합 점수
 * onClose — 닫기 (또는 홈으로)
 */

export default function BaselineCompleteModal({ avgScore, onClose }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    hapticSuccess();
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      background: 'rgba(15,20,30,0.66)',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      animation: 'baselineFadeIn 220ms ease-out',
    }}>
      <style>{`
        @keyframes baselineFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes baselineRise { from { transform: translateY(20px) scale(0.98); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes baselinePop { 0% { transform: scale(0.3); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes baselineRing { 0% { transform: scale(0.9); opacity: 0; } 50% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1); opacity: 0.85; } }
      `}</style>

      <div style={{
        width: '100%', maxWidth: 360,
        background: 'linear-gradient(180deg, #ffffff 0%, #f4f8fc 100%)',
        borderRadius: 28, padding: '32px 24px 24px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        textAlign: 'center',
        animation: 'baselineRise 360ms cubic-bezier(0.32,0.72,0,1)',
      }}>
        {/* Success icon — 큰 circular checkmark */}
        <div style={{
          width: 76, height: 76, borderRadius: '50%',
          margin: '0 auto 18px',
          background: 'linear-gradient(135deg, var(--accent-primary), #8ac4fe)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(var(--accent-rgb),0.32)',
          animation: animated ? 'baselinePop 480ms cubic-bezier(0.34,1.56,0.64,1)' : 'none',
        }}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
            <path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Headline */}
        <div style={{
          fontSize: 24, fontWeight: 500, color: 'var(--text-primary)',
          letterSpacing: -0.4, marginBottom: 8,
        }}>
          기준점 완성!
        </div>
        <div style={{
          fontSize: 14, fontWeight: 500, color: '#374E66', lineHeight: 1.6,
          marginBottom: 20, wordBreak: 'keep-all',
        }}>
          3회 측정 평균으로 정확한 기준점이 만들어졌어요.<br />
          이제 매일 측정하면 작은 변화도 정밀하게 추적돼요.
        </div>

        {/* Average score badge */}
        {typeof avgScore === 'number' && (
          <div style={{
            display: 'inline-flex', alignItems: 'baseline', gap: 6,
            padding: '10px 20px', borderRadius: 20,
            background: 'rgba(var(--accent-rgb),0.12)',
            border: 'none',
            marginBottom: 22,
          }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--accent-primary)', letterSpacing: 0.3 }}>평균 종합 점수</span>
            <span style={{ fontSize: 24, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: -0.5 }}>{Math.round(avgScore)}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#6B7F99' }}>점</span>
          </div>
        )}

        {/* Next-step bullets */}
        <div style={{
          textAlign: 'left',
          background: 'rgba(255,255,255,0.7)',
          border: 'none',
          borderRadius: 14, padding: '14px 16px',
          marginBottom: 22,
        }}>
          {[
            '✨ 매일 같은 시간·환경에서 측정',
            '🔍 화장대에 사용 화장품 등록하면 더 정확',
            '💬 변화 원인이 궁금하면 상담사에게 물어보기',
          ].map((t, i) => (
            <div key={i} style={{
              fontSize: 13, fontWeight: 500, color: '#374E66', lineHeight: 1.7,
              wordBreak: 'keep-all',
              padding: i > 0 ? '6px 0 0' : 0,
            }}>{t}</div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '14px',
            background: 'linear-gradient(135deg, var(--accent-primary), #8ac4fe)',
            border: 'none', borderRadius: 14,
            color: '#fff', fontSize: 16, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 6px 18px rgba(var(--accent-rgb),0.35)',
            letterSpacing: -0.2,
          }}
        >확인</button>
      </div>
    </div>
  );
}
