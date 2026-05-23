import { useState } from 'react';
import { hapticLight } from '../utils/haptics';

/**
 * MeasurementGuide — 측정 직전 표준 가이드 modal.
 *
 * 같은 환경에서 측정하지 않으면 점수가 들쑥날쑥한 문제 해결.
 * 사용자가 매번 같은 5가지 조건을 지키도록 시각적 안내.
 *
 * "다시 보지 않기" 체크 시 localStorage에 저장.
 */

const GUIDE_DISMISS_KEY = 'nou_measure_guide_dismissed';

export function isMeasureGuideDismissed() {
  try { return localStorage.getItem(GUIDE_DISMISS_KEY) === '1'; } catch { return false; }
}

export function resetMeasureGuideDismiss() {
  try { localStorage.removeItem(GUIDE_DISMISS_KEY); } catch {}
}

// Tabler Icons (Filled) — inline SVG
const TablerIcon = ({ d, color = '#5BA8D6' }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={color} stroke="none">
    <path fillRule="evenodd" d={d} />
  </svg>
);

const TIPS = [
  {
    icon: <TablerIcon d="M12 19a1 1 0 0 1 .993 .883l.007 .117v1a1 1 0 0 1 -1.993 .117l-.007 -.117v-1a1 1 0 0 1 1 -1m6.364 -2.05l.707 .707a1 1 0 0 1 -1.414 1.414l-.707 -.707a1 1 0 0 1 1.414 -1.414m-12.728 0a1 1 0 0 1 .083 1.32l-.083 .094 -.707 .707a1 1 0 0 1 -1.497 -1.32l.083 -.094 .707 -.707a1 1 0 0 1 1.414 0M12 6a6 6 0 1 1 0 12 6 6 0 0 1 0 -12m-8 5a1 1 0 0 1 .117 1.993l-.117 .007h-1a1 1 0 0 1 -.117 -1.993l.117 -.007h1m17 0a1 1 0 0 1 .117 1.993l-.117 .007h-1a1 1 0 0 1 -.117 -1.993l.117 -.007h1M4.929 4.929a1 1 0 0 1 1.32 -.083l.094 .083 .707 .707a1 1 0 0 1 -1.32 1.497l-.094 -.083 -.707 -.707a1 1 0 0 1 0 -1.414m14.142 0a1 1 0 0 1 .083 1.32l-.083 .094 -.707 .707a1 1 0 0 1 -1.497 -1.32l.083 -.094 .707 -.707a1 1 0 0 1 1.414 0M12 2a1 1 0 0 1 .993 .883l.007 .117v1a1 1 0 0 1 -1.993 .117l-.007 -.117v-1a1 1 0 0 1 1 -1" />,
    title: '자연광',
    desc: '창가·낮시간 자연광이 가장 정확. 형광등·전구는 점수 왜곡',
  },
  {
    icon: <TablerIcon d="M12 3c-3.866 0 -7 3.272 -7 7a8 8 0 0 0 3.25 6.18a4 4 0 0 1 .924 1.32l.126 .28h5.4l.126 -.28a4 4 0 0 1 .924 -1.32A8 8 0 0 0 19 10c0 -3.728 -3.134 -7 -7 -7m-1.6 15h3.2l-.2 1h-2.8l-.2 -1m.6 3h2l-.2 1h-1.6l-.2 -1" />,
    title: '세안 직후',
    desc: '메이크업·잔여 유분 제거 후 5분 안에 측정',
  },
  {
    icon: <TablerIcon d="M12 2c5.523 0 10 4.477 10 10s-4.477 10 -10 10S2 17.523 2 12 6.477 2 12 2m3.707 5.293a1 1 0 0 0 -1.414 0L12 9.586 9.707 7.293a1 1 0 1 0 -1.414 1.414L10.586 11H7a1 1 0 1 0 0 2h3.586l-2.293 2.293a1 1 0 1 0 1.414 1.414L12 14.414l2.293 2.293a1 1 0 0 0 1.414 -1.414L13.414 13H17a1 1 0 1 0 0 -2h-3.586l2.293 -2.293a1 1 0 0 0 0 -1.414" />,
    title: '메이크업 없이',
    desc: '베이스·컨실러는 점수 가림. 진짜 피부 측정',
  },
  {
    icon: <TablerIcon d="M9 2a1 1 0 0 1 1 1v1a1 1 0 0 1 -2 0V3a1 1 0 0 1 1 -1m6 0a1 1 0 0 1 1 1v1a1 1 0 0 1 -2 0V3a1 1 0 0 1 1 -1M5.5 6A3.5 3.5 0 0 0 2 9.5v7A3.5 3.5 0 0 0 5.5 20h13a3.5 3.5 0 0 0 3.5 -3.5v-7A3.5 3.5 0 0 0 18.5 6h-13M9 10a3 3 0 1 1 0 6 3 3 0 0 1 0 -6m6.5 1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0 -3" />,
    title: '정면 30cm',
    desc: '얼굴이 화면 가이드에 맞도록. 너무 가깝거나 멀면 X',
  },
  {
    icon: <TablerIcon d="M12 2c5.523 0 10 4.477 10 10s-4.477 10 -10 10S2 17.523 2 12 6.477 2 12 2m-1.5 12.444C9.926 15.398 10.886 16 12 16s2.074 -.602 3.5 -1.556a1 1 0 1 1 1 1.732C15.074 17.102 13.614 18 12 18s-3.074 -.898 -4.5 -1.824a1 1 0 1 1 1 -1.732M8.5 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0 -3m7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0 -3" />,
    title: '자연스러운 표정',
    desc: '입 다물고 편안하게. 미소·찡그림은 주름 점수 영향',
  },
];

export default function MeasurementGuide({ onStart, onClose }) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleStart = () => {
    if (dontShowAgain) {
      try { localStorage.setItem(GUIDE_DISMISS_KEY, '1'); } catch {}
    }
    hapticLight();
    onStart?.();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(15,20,30,0.55)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      animation: 'guideFadeIn 200ms ease-out',
    }}>
      <style>{`
        @keyframes guideFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes guideSlideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
      <div style={{
        width: '100%', maxWidth: 460,
        background: 'linear-gradient(180deg, #ffffff 0%, #f4f8fc 100%)',
        borderRadius: '24px 24px 0 0',
        padding: '22px 22px calc(20px + env(safe-area-inset-bottom, 0px))',
        boxShadow: '0 -12px 36px rgba(0,0,0,0.12)',
        animation: 'guideSlideUp 280ms cubic-bezier(0.32,0.72,0,1)',
      }}>
        {/* Handle */}
        <div style={{ width: 38, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.12)', margin: '0 auto 14px' }} />

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
            color: '#5BA8D6', marginBottom: 4, textTransform: 'uppercase',
          }}>정확한 측정을 위해</div>
          <h2 style={{
            fontSize: 19, fontWeight: 700, color: 'var(--text-primary, #191F28)',
            margin: 0, letterSpacing: -0.3,
          }}>측정 환경을 맞춰주세요</h2>
          <p style={{
            fontSize: 12, color: 'var(--text-muted, #8B95A1)',
            margin: '6px 0 0', lineHeight: 1.5, wordBreak: 'keep-all',
          }}>같은 환경에서 측정해야 추세를 정확히 추적할 수 있어요.</p>
        </div>

        {/* Tips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
          {TIPS.map((t, i) => (
            <div key={i} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              padding: '11px 14px',
              background: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(137,206,245,0.18)',
              borderRadius: 14,
            }}>
              <div style={{
                flexShrink: 0, width: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{t.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary, #191F28)',
                  marginBottom: 1, letterSpacing: -0.1,
                }}>{t.title}</div>
                <div style={{
                  fontSize: 11.5, color: 'var(--text-secondary, #4A4E58)',
                  lineHeight: 1.5, wordBreak: 'keep-all',
                }}>{t.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* "다음부터 안 보기" */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: 'var(--text-muted)', marginBottom: 14,
          cursor: 'pointer', userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={e => setDontShowAgain(e.target.checked)}
            style={{ accentColor: '#5BA8D6' }}
          />
          <span>다음부터 이 안내 안 보기</span>
        </label>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: '0 0 30%', padding: '13px',
              background: 'transparent', border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: 14, fontSize: 14, fontWeight: 600,
              color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >나중에</button>
          <button
            onClick={handleStart}
            style={{
              flex: 1, padding: '13px',
              background: 'linear-gradient(135deg, #5BA8D6, #4F94C0)',
              border: 'none', borderRadius: 14,
              fontSize: 14, fontWeight: 700, color: '#fff',
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 14px rgba(91,168,214,0.32)',
            }}
          >지금 측정 시작</button>
        </div>
      </div>
    </div>
  );
}
