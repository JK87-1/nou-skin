import { useState, useEffect, useRef } from 'react';
import { hapticLight } from '../utils/haptics';
import { getBaselineBuildingState } from '../engine/HybridAnalysis';
import EternalPearl from './icons/EternalPearl';

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
    headline: '정확한 변화추적을 위해',
    sub: '같은 환경에서 측정해주세요.',
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
    title: '맨 얼굴',
    desc: '선크림, 메이크업 없이',
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" stroke="none">
        <defs><linearGradient id="gBan" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6BA0FF" /><stop offset="100%" stopColor="#4D8AFF" /></linearGradient></defs>
        <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z" fill="url(#gBan)" />
        <path d="M14.5 9.5l-5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M9.5 9.5l5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: '세안 이후',
    desc: '스킨케어 전 또는 스킨케어 30분 후',
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" stroke="none">
        <defs><linearGradient id="gDrop" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#88D8FF" /><stop offset="100%" stopColor="#6BC8FF" /></linearGradient></defs>
        <path d="M6.8 11a6 6 0 1 0 10.396 0l-5.197 -8l-5.2 8z" fill="url(#gDrop)" />
      </svg>
    ),
  },
  {
    title: '밝은 곳',
    desc: '낮시간 자연광 또는 환한 실내조명',
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" stroke="none">
        <defs><linearGradient id="gBulb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b8daff" /><stop offset="100%" stopColor="#a0ccff" /></linearGradient></defs>
        <path d="M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7" stroke="url(#gBulb)" strokeWidth="2" strokeLinecap="round" />
        <path d="M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3" fill="url(#gBulb)" />
      </svg>
    ),
  },
  {
    title: '편안한 표정',
    desc: '입을 다물고 자연스럽게',
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" stroke="none">
        <defs><linearGradient id="gSmile" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f2dbff" /><stop offset="100%" stopColor="#ebc9ff" /></linearGradient></defs>
        <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z" fill="url(#gSmile)" />
        <circle cx="9" cy="10" r="1.5" fill="white" />
        <circle cx="15" cy="10" r="1.5" fill="white" />
        <path d="M9.5 15a3.5 3.5 0 0 0 5 0" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  {
    title: '정면 30cm',
    desc: '화면 가이드에 맞도록',
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" stroke="none">
        <defs><linearGradient id="gCam" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#cca0f2" /><stop offset="100%" stopColor="#b987ec" /></linearGradient></defs>
        <path d="M3 9a2 2 0 0 1 2-2h1.5a1 1 0 0 0 .8-.4l1.4-1.8a1 1 0 0 1 .8-.4h5a1 1 0 0 1 .8.4l1.4 1.8a1 1 0 0 0 .8.4H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" fill="url(#gCam)" />
        <circle cx="12" cy="13" r="3.5" fill="white" />
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
      {/* 전체 블랙 오버레이 5% */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.1)', pointerEvents: 'none', zIndex: 1 }} />
      <style>{`
        @keyframes mgFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes mgSlideUp { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes mgCondIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes mgCtaFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes mgCtaPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
      `}</style>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        maxWidth: 430, width: '100%', margin: '0 auto',
        position: 'relative', zIndex: 2,
      }}>

        {/* ① 상단 쉐브론 + 점 인디케이터 */}
        <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center' }}>
          <div onClick={(e) => { e.stopPropagation(); handleSkip(); }} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
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
          <div style={{ width: 36 }} />
        </div>

        {/* ③ 헤드라인 블록 */}
        <div style={{
          textAlign: 'center', padding: '50px 28px 0',
          animation: 'mgSlideUp 500ms ease 200ms both',
        }}>
          <div style={{
            fontSize: 20, fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.4,
            color: 'white',
            textShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}>{copy.headline}</div>
          <div style={{
            fontSize: 20, fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.4,
            color: 'white',
            textShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}>{copy.sub}</div>
        </div>

        {/* ④ 시퀀스 리스트 */}
        <div style={{
          padding: '0 28px',
          marginTop: 53,
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
                  padding: '6.5px 0',
                  animation: isFullSequence ? `mgCondIn 600ms ease both` : 'none',
                }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 20,
                  background: 'rgba(255,255,255,0.4)',
                  borderRadius: 999,
                  padding: '14px 20px 14px 18px',
                  width: 280, margin: '0 auto',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                }}>
                  <div style={{
                    width: 34, height: 34,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    background: 'white',
                    borderRadius: '50%',
                  }}>{c.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 15, fontWeight: 700, letterSpacing: -0.2, lineHeight: 1.5,
                      color: '#333',
                    }}>{c.title}</div>
                    <div style={{
                      fontSize: 12, lineHeight: 1.5,
                      color: 'rgba(0,0,0,0.45)',
                    }}>{c.desc}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ⑥ CTA + 건너뛰기 */}
        {ctaReady && <div style={{
          padding: '0 28px calc(env(safe-area-inset-bottom, 0px) + 28px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          animation: 'mgCtaFadeIn 1500ms ease-out both',
        }}>
          {/* Pearl Orb CTA */}
          <div
            onClick={(e) => { e.stopPropagation(); handleStart(); }}
            style={{ cursor: 'pointer', marginTop: 53, animation: 'mgCtaPulse 3s ease-in-out 1s infinite' }}
          >
            <EternalPearl size={156} animated />
          </div>
        </div>}
      </div>
    </div>
  );
}
