import { useState, useEffect, useRef } from 'react';
import { hapticLight } from '../utils/haptics';
import { getBaselineBuildingState } from '../engine/HybridAnalysis';

/**
 * MeasurementGuide — 측정 온보딩 풀스크린.
 *
 * 분기 로직:
 * - baseline_count = 0 → 1/3 풀버전 (시퀀스 애니메이션)
 * - baseline_count = 1 → 2/3 단계 4 즉시
 * - baseline_count = 2 → 3/3 단계 4 즉시
 * - baseline_count >= 3 → 미표시 (App.jsx에서 처리)
 * - trigger_source = "settings_reset" → 1/3부터 다시
 */

const GUIDE_DISMISS_KEY = 'nou_measure_guide_dismissed';

export function isMeasureGuideDismissed() {
  try { return localStorage.getItem(GUIDE_DISMISS_KEY) === '1'; } catch { return false; }
}

export function resetMeasureGuideDismiss() {
  try { localStorage.removeItem(GUIDE_DISMISS_KEY); } catch {}
}

// ── 단계별 카피 ──
const COPY = {
  1: {
    header: '처음 마주하는 자리',
    eyebrow: '',
    headline: '정확한 변화 추적을 위해',
    sub: '매번 같은 환경에서 측정해주세요',
  },
  2: {
    header: '두 번째 비춤',
    eyebrow: '같은 환경 기억하시죠',
    headline: '한 번 더\n비춰주세요',
    sub: '첫 측정과 같은 조건이\n가장 정확한 기준을 만들어요',
  },
  3: {
    header: '마지막 한 번',
    eyebrow: '곧 기준점이 완성돼요',
    headline: '마지막으로\n비춰주세요',
    sub: '이 세 번이\n나만의 기준점이 돼요',
  },
};

// ── 조건 리스트 ──
const CONDITIONS = [
  {
    title: '밝은 환경',
    desc: '낮시간 자연광이 좋아요. 밤이면 방을 환하게 밝혀주세요.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7" />
        <path d="M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3" />
        <path d="M9.7 17l4.6 0" />
      </svg>
    ),
  },
  {
    title: '세안 이후',
    desc: '스킨케어 전이 좋아요. 스킨케어를 했다면 30분후에.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.8 11a6 6 0 1 0 10.396 0l-5.197 -8l-5.2 8z" />
      </svg>
    ),
  },
  {
    title: '메이크업 없이',
    desc: '선크림이나 베이스, 컨실러는 내 진짜 피부를 가려요.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
        <path d="M14.5 9.5l-5 5" /><path d="M9.5 9.5l5 5" />
      </svg>
    ),
  },
  {
    title: '정면 30cm',
    desc: '얼굴이 화면 가이드에 맞도록. 너무 가깝거나 멀지않게.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2" />
        <path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
      </svg>
    ),
  },
  {
    title: '자연스러운 표정',
    desc: '입을 다물고 자연스러운 표정이 좋아요.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
        <path d="M9 10l.01 0" /><path d="M15 10l.01 0" />
        <path d="M9.5 15a3.5 3.5 0 0 0 5 0" />
      </svg>
    ),
  },
];

export default function MeasurementGuide({ onStart, onClose, triggerSource }) {
  const buildState = (() => { try { return getBaselineBuildingState(); } catch { return null; } })();

  // baseline_count 결정
  let baselineCount = 0;
  if (buildState) {
    if (buildState.stage === 'none') baselineCount = 0;
    else if (buildState.stage === 'building') baselineCount = buildState.count || 0;
    else if (buildState.stage === 'complete') baselineCount = 3;
  }

  // settings_reset이면 1/3부터
  if (triggerSource === 'settings_reset') baselineCount = 0;

  const step = Math.min(baselineCount + 1, 3); // 1, 2, or 3
  const copy = COPY[step];

  // 2/3, 3/3은 시퀀스 스킵 → 단계 4(전체 표시) 즉시
  const isFullSequence = baselineCount === 0;

  // 시퀀스 상태: 0=시작, 1=하나, 2=둘, 3=셋, 4=전체
  const [seqStep, setSeqStep] = useState(isFullSequence ? 0 : 4);
  const [ctaReady, setCtaReady] = useState(!isFullSequence);
  const seqTimerRef = useRef(null);

  // 풀 시퀀스 자동 진행
  useEffect(() => {
    if (!isFullSequence) return;

    const delays = [1200, 1200, 1200, 1200, 1200, 1200]; // 0→1, 1→2, 2→3, 3→4, 4→5, 5→CTA
    let currentStep = 0;

    const advance = () => {
      currentStep++;
      setSeqStep(currentStep);
      if (currentStep >= 6) {
        setCtaReady(true);
        return;
      }
      seqTimerRef.current = setTimeout(advance, delays[currentStep]);
    };

    seqTimerRef.current = setTimeout(advance, delays[0]);
    return () => clearTimeout(seqTimerRef.current);
  }, [isFullSequence]);

  // 탭으로 시퀀스 가속
  const handleTapAccelerate = () => {
    if (seqStep >= 6) return;
    clearTimeout(seqTimerRef.current);
    const next = seqStep + 1;
    setSeqStep(next);
    if (next >= 6) setCtaReady(true);
  };

  const handleStart = () => {
    if (!ctaReady) return;
    hapticLight();
    onStart?.();
  };

  const handleSkip = () => {
    hapticLight();
    onClose?.();
  };

  return (
    <div
      onClick={handleTapAccelerate}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'linear-gradient(180deg, #58aefe 0%, #8ec5f8 33%, #b8dafb 66%, #d7e9fa 100%)',
        display: 'flex', flexDirection: 'column',
        animation: 'mgFadeIn 300ms ease-out',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes mgFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes mgSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes mgCondIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        maxWidth: 430, width: '100%', margin: '0 auto',
        position: 'relative',
      }}>

        {/* ① 상단 여백 */}
        <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0' }} />

        {/* ② 점 인디케이터 */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '4px 0 0',
        }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            {[1, 2, 3].map(d => (
              <div key={d} style={{
                width: 8, height: 8,
                borderRadius: '50%',
                background: d <= step ? 'white' : 'transparent',
                border: d <= step ? '1.5px solid white' : '1.5px solid rgba(255,255,255,0.4)',
                transition: 'all 300ms ease',
              }} />
            ))}
          </div>
          <div style={{
            fontSize: 10, fontWeight: 500,
            color: 'rgba(255,255,255,0.7)', letterSpacing: 0.2,
          }}>{step} / 3번째 측정</div>
        </div>

        {/* ③ 헤드라인 블록 */}
        <div style={{
          textAlign: 'center', padding: '65px 28px 0',
          animation: 'mgSlideUp 500ms ease 200ms both',
        }}>
          {/* eyebrow */}
          <div style={{
            fontSize: 11, fontWeight: 500, letterSpacing: 0.4,
            color: 'rgba(255,255,255,0.85)', marginBottom: 8,
          }}>{copy.eyebrow}</div>

          {/* 메인 헤드라인 */}
          <h1 style={{
            fontSize: 22, fontWeight: 600, letterSpacing: -0.4, lineHeight: 1.3,
            color: 'white', margin: 0, whiteSpace: 'pre-line',
            textShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}>{copy.headline}</h1>

          {/* 보조 카피 */}
          <p style={{
            fontSize: 12, lineHeight: 1.55,
            color: 'rgba(255,255,255,0.78)',
            margin: '10px 0 0', whiteSpace: 'pre-line',
          }}>{copy.sub}</p>
        </div>

        {/* ④ 시퀀스 리스트 */}
        <div style={{
          flex: 1, padding: '60px 28px 0',
          display: 'flex', flexDirection: 'column', gap: 0,
        }}>
          {CONDITIONS.map((c, i) => {
            const condIdx = i + 1;
            const visible = seqStep >= condIdx;
            if (!visible) return null;

            return (
              <div
                key={i}
                style={{
                  padding: '18px 0',
                  animation: isFullSequence ? `mgCondIn 400ms cubic-bezier(0.32,0.72,0,1) both` : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{
                    width: 24, height: 24,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 1, opacity: 0.85,
                  }}>{c.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 17, fontWeight: 700, letterSpacing: -0.2,
                      color: 'white', marginBottom: 4,
                    }}>{c.title}</div>
                    <div style={{
                      fontSize: 13, lineHeight: 1.55,
                      color: 'rgba(255,255,255,0.65)',
                    }}>{c.desc}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ⑥ CTA + 건너뛰기 */}
        <div style={{
          padding: '0 28px calc(env(safe-area-inset-bottom, 0px) + 12px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); handleStart(); }}
            disabled={!ctaReady}
            style={{
              width: '100%', padding: '16px',
              borderRadius: 16, border: 'none',
              background: ctaReady ? 'white' : 'rgba(255,255,255,0.22)',
              color: ctaReady ? '#1E90E8' : 'rgba(255,255,255,0.6)',
              fontSize: 15,
              fontWeight: ctaReady ? 600 : 500,
              letterSpacing: -0.2,
              cursor: ctaReady ? 'pointer' : 'default',
              fontFamily: 'inherit',
              transition: 'all 300ms ease',
              minHeight: 52,
            }}
          >측정 시작</button>
          <button
            onClick={(e) => { e.stopPropagation(); handleSkip(); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 400,
              color: 'rgba(0,0,0,0.1)', fontFamily: 'inherit',
              padding: '12px 16px',
              minHeight: 36,
            }}
          >건너뛰기</button>
        </div>
      </div>
    </div>
  );
}
