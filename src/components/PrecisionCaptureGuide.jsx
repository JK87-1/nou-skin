/**
 * PrecisionCaptureGuide.jsx — 정밀 측정 캡처 + 분석 흐름
 *
 * UX 단계:
 *   intro → front → left → right → analyzing → (onComplete) | error
 *
 * 카메라 라이브뷰는 CameraCapture.jsx의 단일 캡처 패턴을 단순화·시퀀스화.
 * 각 캡처 후 즉시 next stage. 3번째 캡처 후 자동으로 분석 호출.
 *
 * props:
 *   - onComplete(result, images)  성공 시 결과 + 3장 이미지
 *   - onCancel()                  사용자가 취소
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { runPrecisionMeasure, precisionErrorMessage } from '../engine/PrecisionAnalysis';
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning } from '../utils/haptics';

const STAGES = ['front', 'left', 'right'];

const GUIDE = {
  intro: {
    title: '정밀 측정',
    sub: '정면 · 좌측면 · 우측면 3장을 차례로 촬영해\n임상급 분석을 제공합니다.',
    cta: '시작하기',
  },
  front: {
    step: 1,
    title: '정면',
    sub: '카메라를 정면으로 응시하세요',
    tip: '얼굴 전체가 가이드 원 안에 들어오게',
  },
  left: {
    step: 2,
    title: '좌측면',
    sub: '얼굴을 오른쪽으로 살짝 돌려\n왼쪽 얼굴이 잘 보이게 해주세요',
    tip: '왼쪽 광대 · 팔자 · 턱선이 보이게',
  },
  right: {
    step: 3,
    title: '우측면',
    sub: '얼굴을 왼쪽으로 살짝 돌려\n오른쪽 얼굴이 잘 보이게 해주세요',
    tip: '오른쪽 광대 · 팔자 · 턱선이 보이게',
  },
};

export default function PrecisionCaptureGuide({ onComplete, onCancel }) {
  const [stage, setStage] = useState('intro');
  const [images, setImages] = useState({ front: null, left: null, right: null });
  const [progress, setProgress] = useState({ label: '', percent: 0 });
  const [errorReason, setErrorReason] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);

  // ===== 카메라 라이프사이클 =====
  useEffect(() => {
    const isCaptureStage = STAGES.includes(stage);
    if (!isCaptureStage) {
      // 라이브뷰 필요 없는 stage → 카메라 중지
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setVideoReady(false);
      return;
    }
    if (streamRef.current) return; // 이미 켜져 있으면 재시작 안 함 (캡처 stage 간 전환 부드럽게)

    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setVideoReady(true);
        }
      } catch (e) {
        console.warn('[precision] camera denied:', e);
        setErrorReason('camera_denied');
        setStage('error');
      }
    })();

    return () => { cancelled = true; };
  }, [stage]);

  // 마운트 해제 시 카메라 종료
  useEffect(() => () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  // ===== 캡처 (video → canvas → base64) =====
  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    // 미러링된 라이브뷰를 사용자가 보지만, 저장은 mirror 해제(좌·우 의미 일관)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    return dataUrl.split(',')[1];
  }, []);

  // ===== 단계 캡처 핸들러 =====
  const handleCapture = useCallback(async () => {
    if (!videoReady) { hapticWarning(); return; }
    hapticMedium();
    const b64 = capture();
    if (!b64) { hapticWarning(); return; }

    const idx = STAGES.indexOf(stage);
    const newImages = { ...images, [stage]: b64 };
    setImages(newImages);
    hapticSuccess();

    if (idx < STAGES.length - 1) {
      setStage(STAGES[idx + 1]);
      return;
    }

    // 3장 완료 → 분석
    setStage('analyzing');
    const res = await runPrecisionMeasure({
      frontB64: newImages.front,
      leftB64: newImages.left,
      rightB64: newImages.right,
      onProgress: (label, percent) => setProgress({ label, percent }),
    });

    if (res.ok) {
      hapticSuccess();
      onComplete?.(res.result, newImages);
    } else {
      hapticWarning();
      setErrorReason(res.reason);
      setStage('error');
    }
  }, [videoReady, capture, stage, images, onComplete]);

  // ===== 화면별 렌더 =====
  if (stage === 'intro') return <IntroScreen onStart={() => setStage('front')} onCancel={onCancel} />;
  if (stage === 'analyzing') return <AnalyzingScreen progress={progress} />;
  if (stage === 'error') return <ErrorScreen reason={errorReason} onRetry={() => { setErrorReason(null); setImages({front:null,left:null,right:null}); setStage('intro'); }} onCancel={onCancel} />;

  // 캡처 stage (front/left/right)
  const g = GUIDE[stage];
  return (
    <div style={baseScreen}>
      <video ref={videoRef} autoPlay playsInline muted style={liveVideo} />
      {/* 미리 캡처된 이미지 프리뷰 (왼/오른 사진은 라이브뷰 위 작은 칩으로 — 진척감) */}
      <PreviewChips images={images} currentStage={stage} />

      <div style={topGradient} />
      <div style={topBar}>
        <div onClick={onCancel} style={closeBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500 }}>{g.step}/3 · {g.title}</div>
        <div style={{ width: 36 }} />
      </div>

      {/* 얼굴 가이드 원 */}
      <div style={faceGuideRing} />

      {/* 하단 가이드 + 캡처 버튼 */}
      <div style={bottomBg}>
        <div style={{ color: '#fff', fontSize: 17, fontWeight: 600, textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.45, marginBottom: 6, letterSpacing: -0.3 }}>{g.sub}</div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 500, textAlign: 'center', marginBottom: 22 }}>{g.tip}</div>
        <button onClick={handleCapture} disabled={!videoReady} style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: videoReady ? '#fff' : 'rgba(255,255,255,0.5)',
          border: '4px solid rgba(255,255,255,0.35)',
          cursor: videoReady ? 'pointer' : 'not-allowed',
          transition: 'transform 120ms ease',
        }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#58aefe' }} />
        </button>
      </div>
    </div>
  );
}

// ===== Sub Screens =====

function IntroScreen({ onStart, onCancel }) {
  return (
    <div style={{ ...baseScreen, background: 'linear-gradient(180deg, #58aefe 0%, #b8dafb 100%)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0' }}>
        <div onClick={onCancel} style={closeBtn}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', textAlign: 'center' }}>
        <div style={{ width: 92, height: 92, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22, border: '1px solid rgba(255,255,255,0.3)' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17.75l-6.172 3.245l1.179-6.873L2 9.255l6.9-1L12 2.005l3.1 6.25l6.9 1l-5 4.867l1.179 6.873z"/></svg>
        </div>
        <div style={{ color: '#fff', fontSize: 26, fontWeight: 700, letterSpacing: -0.5, marginBottom: 14 }}>{GUIDE.intro.title}</div>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: 500, lineHeight: 1.6, whiteSpace: 'pre-line', marginBottom: 28 }}>{GUIDE.intro.sub}</div>
        <div style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 16, padding: '14px 18px', textAlign: 'left', maxWidth: 320, marginBottom: 32 }}>
          <FeatureRow text="좌·우 비대칭 분석 — 거울로 못 보는 인사이트" />
          <FeatureRow text="부위별 9 영역 정밀 점수" />
          <FeatureRow text="임상 발견 + 시술 카테고리 안내" />
          <FeatureRow text="의사 톤 상세 판독 리포트" />
        </div>
      </div>
      <div style={{ padding: '0 24px calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
        <button onClick={() => { hapticLight(); onStart(); }} style={{
          width: '100%', padding: 16, background: '#fff', border: 'none', borderRadius: 16,
          color: '#0e6bec', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        }}>{GUIDE.intro.cta}</button>
      </div>
    </div>
  );
}

function FeatureRow({ text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
      <span style={{ color: '#fff', fontSize: 13, fontWeight: 500, letterSpacing: -0.1 }}>{text}</span>
    </div>
  );
}

function AnalyzingScreen({ progress }) {
  return (
    <div style={{ ...baseScreen, background: 'linear-gradient(180deg, #0e1530 0%, #1a2447 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`@keyframes pSpin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 88, height: 88, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#58aefe', animation: 'pSpin 1s linear infinite', marginBottom: 28 }} />
      <div style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginBottom: 10 }}>정밀 분석 중…</div>
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 24 }}>{progress.label || '준비 중'}</div>
      <div style={{ width: 240, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${progress.percent || 0}%`, height: '100%', background: 'linear-gradient(90deg, #58aefe, #8ec5f8)', transition: 'width 400ms ease' }} />
      </div>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 24, padding: '0 32px', textAlign: 'center', lineHeight: 1.5 }}>
        보통 20~40초 정도 소요됩니다.<br/>화면을 그대로 두고 잠시만 기다려주세요.
      </div>
    </div>
  );
}

function ErrorScreen({ reason, onRetry, onCancel }) {
  const msg = precisionErrorMessage(reason);
  return (
    <div style={{ ...baseScreen, background: 'linear-gradient(180deg, #2a1a1a 0%, #1a1414 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
      <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'rgba(255,120,120,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ff8a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/></svg>
      </div>
      <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 10 }}>정밀 측정 실패</div>
      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.6, marginBottom: 28, wordBreak: 'keep-all' }}>{msg}</div>
      <button onClick={onRetry} style={{ width: '100%', maxWidth: 280, padding: 14, background: '#58aefe', border: 'none', borderRadius: 14, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}>다시 시도</button>
      <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500, padding: 8, cursor: 'pointer', fontFamily: 'inherit' }}>나가기</button>
    </div>
  );
}

function PreviewChips({ images, currentStage }) {
  // 이미 캡처된 단계의 작은 썸네일 (라이브뷰 위 상단 우측)
  const shown = STAGES.filter(s => images[s] && s !== currentStage);
  if (shown.length === 0) return null;
  return (
    <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 60px)', right: 12, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 3 }}>
      {shown.map(s => (
        <div key={s} style={{ width: 44, height: 56, borderRadius: 8, overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.4)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
          <img src={`data:image/jpeg;base64,${images[s]}`} alt={s} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ))}
    </div>
  );
}

// ===== 공통 스타일 =====
const baseScreen = {
  position: 'fixed', inset: 0, zIndex: 9700, background: '#000',
  height: '100dvh',
};

const liveVideo = {
  position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)',
};

const topGradient = {
  position: 'absolute', top: 0, left: 0, right: 0, height: 120,
  background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
  zIndex: 2, pointerEvents: 'none',
};

const topBar = {
  position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', left: 0, right: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0 16px', zIndex: 3,
};

const closeBtn = {
  width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.35)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};

const faceGuideRing = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -56%)',
  width: 240, height: 320, borderRadius: '50%',
  border: '2px dashed rgba(255,255,255,0.55)',
  pointerEvents: 'none', zIndex: 2,
};

const bottomBg = {
  position: 'absolute', bottom: 0, left: 0, right: 0,
  padding: '40px 24px calc(env(safe-area-inset-bottom, 0px) + 24px)',
  background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.85) 100%)',
  zIndex: 3,
};
