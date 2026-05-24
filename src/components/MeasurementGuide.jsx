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
    headline: '정확한 추적을 위한 첫 단계',
    sub: '매번 같은 환경일 때, 피부의 변화가 올바르게 보여요.',
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
    step: '하나',
    title: '조명',
    desc: '낮의 햇살이나 밝은 실내가 좋아요',
    note: '창가 옆 자연광이나 밤 시간의 환한 조명이 정확해요.\n빛이 한쪽으로만 쏠리지 않도록 균일하게 비춰주세요.',
    icon: (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7" />
        <path d="M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3" />
        <path d="M9.7 17l4.6 0" />
      </svg>
    ),
  },
  {
    step: '둘',
    title: '피부',
    desc: '맑은 맨 얼굴로 준비해 주세요',
    note: '세안 후 5분 안, 스킨케어 전이 가장 좋아요.\n피부 속 고유의 결을 그대로 들여다볼 수 있게 도와주세요.',
    icon: (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.8 11a6 6 0 1 0 10.396 0l-5.197 -8l-5.2 8z" />
      </svg>
    ),
  },
  {
    step: '셋',
    title: '자세',
    desc: '정면 · 30cm · 가장 편안한 표정으로',
    note: '화면 가이드에 맞추어 얼굴의 긴장을 풀어주세요.\n편안하게 이완된 표정일 때 가장 정밀한 분석이 가능해요.',
    icon: (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2" />
        <path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
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

    const delays = [800, 2200, 2200, 2200]; // 0→1, 1→2, 2→3, 3→4
    let currentStep = 0;

    const advance = () => {
      currentStep++;
      setSeqStep(currentStep);
      if (currentStep >= 4) {
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
    if (seqStep >= 4) return;
    clearTimeout(seqTimerRef.current);
    const next = seqStep + 1;
    setSeqStep(next);
    if (next >= 4) setCtaReady(true);
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

        {/* ① 헤더: 뒤로가기 */}
        <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center' }}>
          <div onClick={(e) => { e.stopPropagation(); handleSkip(); }} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </div>
        </div>

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
          textAlign: 'center', padding: '50px 28px 0',
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
          flex: 1, padding: '65px 28px 0',
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
                  padding: '16px 16px',
                  marginBottom: i < CONDITIONS.length - 1 ? 15 : 0,
                  background: 'rgba(34,113,208,0.05)',
                  borderRadius: 16,
                  animation: isFullSequence ? `mgCondIn 400ms cubic-bezier(0.32,0.72,0,1) both` : 'none',
                }}
              >
                {/* 아이콘 + 제목 + 설명 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 23, height: 23,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 2,
                  }}>{c.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 17.5, fontWeight: 600, letterSpacing: -0.2,
                      color: 'white', marginBottom: 3,
                    }}>{c.title}</div>
                    <div style={{
                      fontSize: 13.5, lineHeight: 1.55,
                      color: 'rgba(255,255,255,0.78)',
                    }}>{c.desc}</div>
                  </div>
                </div>

                {/* 노트 */}
                <div style={{
                  marginTop: 8, marginLeft: 33,
                  paddingLeft: 10,
                  borderLeft: '2px solid rgba(255,255,255,0.5)',
                }}>
                  <div style={{
                    fontSize: 12.9, lineHeight: 1.5,
                    color: 'rgba(255,255,255,0.88)',
                    whiteSpace: 'pre-line',
                  }}>{c.note}</div>
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
