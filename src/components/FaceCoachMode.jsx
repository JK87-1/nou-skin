/**
 * FaceCoachMode.jsx — 얼굴 분석·스타일링 + 케어 시뮬레이션 통합 컨테이너
 *
 * 모드:
 *   - 'proportion': 얼굴 비율 + AI 메이크업/헤어 코칭 (Phase 1)
 *   - 'future':     케어 후 피부 시각화 (Phase 2, 이미지 생성)
 *
 * 흐름: intro → capture → analyzing → result
 * 1단계 결과 화면 끝에서 "2단계도 보기" CTA로 자연스럽게 이어짐.
 *
 * App.jsx에서 마운트:
 *   <FaceCoachMode open={open} onClose={...} />
 * 또는 글로벌 진입:
 *   window.luaFaceCoach()              // intro부터
 *   window.luaFaceCoach('proportion')  // 모드 지정
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { analyzeProportion } from '../engine/FaceProportion';
import { detectLandmarks } from '../engine/FaceLandmarker';
import { fetchFaceCoaching, coachingErrorMessage } from '../engine/FaceCoaching';
import { fetchSkinFuture, skinFutureErrorMessage } from '../engine/SkinFuture';
import FaceProportionResult from './FaceProportionResult';
import SkinFutureView from './SkinFutureView';
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning } from '../utils/haptics';

const MODE_INFO = {
  proportion: {
    title: '얼굴 분석 · 스타일링',
    sub: '얼굴 비율을 분석해\n메이크업·헤어 가이드를 제공합니다.',
    cta: '시작',
    bullets: ['삼정·오등분·황금비·좌우 대칭', '얼굴형 맞춤 메이크업 5단계', '추천·회피 헤어스타일', '아이브로우 모양·팁'],
  },
  future: {
    title: '3개월 후 예상 피부',
    sub: '꾸준한 케어 후의 모습을\nAI가 자연스럽게 시각화합니다.',
    cta: '시작',
    bullets: ['현재 사진 ↔ 예상 사진 슬라이더', '메트릭별 예상 점수 변화', '의료 시술 X — 케어 효과만', '필요한 케어 가이드'],
  },
};

export default function FaceCoachMode({ open, onClose, initialMode = null }) {
  // stage: 'select' | 'intro' | 'capture' | 'analyzing-1' | 'result-1' | 'analyzing-2' | 'result-2' | 'error'
  const [stage, setStage] = useState('select');
  const [mode, setMode] = useState(initialMode);
  const [capturedImage, setCapturedImage] = useState(null);
  const [proportion, setProportion] = useState(null);
  const [coaching, setCoaching] = useState(null);
  const [futureImage, setFutureImage] = useState(null);
  const [progress, setProgress] = useState({ label: '', percent: 0 });
  const [errorReason, setErrorReason] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);

  // 진입 시 모드 결정
  useEffect(() => {
    if (!open) return;
    if (initialMode) {
      setMode(initialMode);
      setStage('intro');
    } else {
      setStage('select');
    }
  }, [open, initialMode]);

  // 카메라 라이프사이클 — capture stage에서만 켬
  useEffect(() => {
    if (stage !== 'capture') {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setVideoReady(false);
      return;
    }
    if (streamRef.current) return;
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
        console.warn('[face-coach] camera denied:', e);
        setErrorReason('camera_denied');
        setStage('error');
      }
    })();
    return () => { cancelled = true; };
  }, [stage]);

  useEffect(() => () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    setMode(null);
    setCapturedImage(null);
    setProportion(null);
    setCoaching(null);
    setFutureImage(null);
    setErrorReason(null);
    setProgress({ label: '', percent: 0 });
    setStage('select');
  }, []);

  // 캡처 핸들러
  const handleCapture = useCallback(async () => {
    if (!videoReady || !videoRef.current) { hapticWarning(); return; }
    hapticMedium();
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
    setCapturedImage(dataUrl);
    hapticSuccess();
    // 모드에 따라 다른 분석 stage로
    setStage(mode === 'future' ? 'analyzing-2' : 'analyzing-1');
  }, [videoReady, mode]);

  // ===== Phase 1 분석: landmark → proportion → AI coaching =====
  useEffect(() => {
    if (stage !== 'analyzing-1' || !capturedImage) return;
    let cancelled = false;
    (async () => {
      try {
        setProgress({ label: '얼굴 인식', percent: 15 });
        const img = new Image();
        img.src = capturedImage;
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
        const lm = await detectLandmarks(img);
        if (cancelled) return;
        if (!lm) { setErrorReason('landmark_failed'); setStage('error'); return; }

        setProgress({ label: '비율 분석', percent: 40 });
        const p = analyzeProportion(lm);
        if (cancelled) return;
        if (!p) { setErrorReason('proportion_failed'); setStage('error'); return; }
        setProportion(p);

        setProgress({ label: 'AI 스타일링', percent: 60 });
        const res = await fetchFaceCoaching(p, { onProgress: (label, percent) => setProgress({ label, percent: 60 + percent * 0.35 }) });
        if (cancelled) return;
        if (!res.ok) {
          // 코칭 실패해도 proportion은 표시
          console.warn('[face-coach] coaching failed:', res.reason);
          setCoaching(null);
        } else {
          setCoaching(res.coaching);
        }
        setProgress({ label: '완료', percent: 100 });
        hapticSuccess();
        setStage('result-1');
      } catch (e) {
        console.error('[face-coach] analysis-1 error:', e);
        if (!cancelled) { setErrorReason('analyzing_failed'); setStage('error'); }
      }
    })();
    return () => { cancelled = true; };
  }, [stage, capturedImage]);

  // ===== Phase 2 분석: SkinFuture API =====
  useEffect(() => {
    if (stage !== 'analyzing-2' || !capturedImage) return;
    let cancelled = false;
    (async () => {
      try {
        // 기존 측정 결과(localStorage 최근 record)에서 메트릭 가져오기
        let metrics = null;
        try {
          const records = JSON.parse(localStorage.getItem('skinRecords') || '[]');
          metrics = records[0] || null;
        } catch {}

        // capturedImage는 data:image/jpeg;base64,XXX 형식 → raw base64로 분리
        const rawB64 = capturedImage.split(',')[1] || capturedImage;
        const res = await fetchSkinFuture({
          image: rawB64,
          metrics,
          onProgress: (label, percent) => setProgress({ label, percent }),
        });
        if (cancelled) return;
        if (!res.ok) {
          setErrorReason(res.reason);
          setStage('error');
          return;
        }
        setFutureImage(res.imageBase64);
        hapticSuccess();
        setStage('result-2');
      } catch (e) {
        console.error('[face-coach] analysis-2 error:', e);
        if (!cancelled) { setErrorReason('analyzing_failed'); setStage('error'); }
      }
    })();
    return () => { cancelled = true; };
  }, [stage, capturedImage]);

  // ===== 렌더 =====
  if (!open) return null;

  if (stage === 'select') {
    return <ModeSelectScreen onSelect={(m) => { hapticLight(); setMode(m); setStage('intro'); }} onClose={onClose} />;
  }
  if (stage === 'intro') {
    return <IntroScreen info={MODE_INFO[mode]} onStart={() => { hapticLight(); setStage('capture'); }} onBack={() => setStage('select')} onClose={onClose} />;
  }
  if (stage === 'capture') {
    return <CaptureScreen videoRef={videoRef} videoReady={videoReady} onCapture={handleCapture} onClose={onClose} mode={mode} />;
  }
  if (stage === 'analyzing-1' || stage === 'analyzing-2') {
    return <AnalyzingScreen progress={progress} mode={mode} />;
  }
  if (stage === 'result-1') {
    return (
      <>
        <FaceProportionResult proportion={proportion} coaching={coaching} imageBase64={capturedImage} onClose={onClose} />
        <NextActionFAB label="3개월 후 피부도 보기" onClick={() => { hapticLight(); setMode('future'); setStage('analyzing-2'); }} />
      </>
    );
  }
  if (stage === 'result-2') {
    return <SkinFutureView beforeImage={capturedImage} afterImage={futureImage} metrics={tryGetLatestMetrics()} onClose={onClose} />;
  }
  if (stage === 'error') {
    return <ErrorScreen reason={errorReason} mode={mode} onRetry={reset} onClose={onClose} />;
  }
  return null;
}

function tryGetLatestMetrics() {
  try {
    const records = JSON.parse(localStorage.getItem('skinRecords') || '[]');
    return records[0] || null;
  } catch { return null; }
}

// ===== Sub Screens =====

function ModeSelectScreen({ onSelect, onClose }) {
  return (
    <div style={{ ...pageWrap, background: 'linear-gradient(180deg, #0e1530 0%, #111118 100%)', display: 'flex', flexDirection: 'column' }}>
      <div style={topBar}>
        <button onClick={onClose} style={iconBtn} aria-label="닫기">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>분석 선택</div>
        <div style={{ width: 36 }} />
      </div>
      <div style={{ flex: 1, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
        <ModeCard mode="proportion" info={MODE_INFO.proportion} onClick={() => onSelect('proportion')} />
        <ModeCard mode="future" info={MODE_INFO.future} onClick={() => onSelect('future')} />
      </div>
    </div>
  );
}

function ModeCard({ mode, info, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 18, padding: 20, textAlign: 'left',
      cursor: 'pointer', fontFamily: 'inherit', color: 'inherit',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(88,174,254,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {mode === 'proportion' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#58aefe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3v18"/><path d="M3 5h18"/><path d="M3 12h18"/><path d="M3 19h18"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#58aefe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>
          )}
        </div>
        <div style={{ color: '#fff', fontSize: 17, fontWeight: 700, letterSpacing: -0.3 }}>{info.title}</div>
      </div>
      <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-line', marginBottom: 12 }}>{info.sub}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {info.bullets.map((b, i) => (
          <span key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 5 }}>{b}</span>
        ))}
      </div>
    </button>
  );
}

function IntroScreen({ info, onStart, onBack, onClose }) {
  return (
    <div style={{ ...pageWrap, background: 'linear-gradient(180deg, #58aefe 0%, #b8dafb 100%)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 0', display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{ ...iconBtn, background: 'rgba(0,0,0,0.2)' }} aria-label="뒤로">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button onClick={onClose} style={{ ...iconBtn, background: 'rgba(0,0,0,0.2)' }} aria-label="닫기">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', textAlign: 'center' }}>
        <div style={{ color: '#fff', fontSize: 26, fontWeight: 700, letterSpacing: -0.5, marginBottom: 12 }}>{info.title}</div>
        <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14.5, lineHeight: 1.65, whiteSpace: 'pre-line', marginBottom: 28 }}>{info.sub}</div>
        <div style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 16, padding: '14px 18px', textAlign: 'left', maxWidth: 320 }}>
          {info.bullets.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{b}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '0 24px calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
        <button onClick={onStart} style={{
          width: '100%', padding: 16, background: '#fff', border: 'none', borderRadius: 16,
          color: '#0e6bec', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}>{info.cta}</button>
      </div>
    </div>
  );
}

function CaptureScreen({ videoRef, videoReady, onCapture, onClose, mode }) {
  return (
    <div style={pageWrap}>
      <video ref={videoRef} autoPlay playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
      <div style={topGradient} />
      <div style={topBar}>
        <button onClick={onClose} style={{ ...iconBtn, background: 'rgba(0,0,0,0.35)' }} aria-label="닫기">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600 }}>{MODE_INFO[mode]?.title}</div>
        <div style={{ width: 36 }} />
      </div>
      <div style={faceGuideRing} />
      <div style={bottomBg}>
        <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, textAlign: 'center', marginBottom: 6 }}>정면을 응시해주세요</div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center', marginBottom: 22 }}>얼굴이 가이드 안에 들어오도록</div>
        <button onClick={onCapture} disabled={!videoReady} style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: videoReady ? '#fff' : 'rgba(255,255,255,0.5)',
          border: '4px solid rgba(255,255,255,0.35)',
          cursor: videoReady ? 'pointer' : 'not-allowed',
        }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#58aefe' }} />
        </button>
      </div>
    </div>
  );
}

function AnalyzingScreen({ progress, mode }) {
  return (
    <div style={{ ...pageWrap, background: 'linear-gradient(180deg, #0e1530 0%, #1a2447 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`@keyframes pSpin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 88, height: 88, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#58aefe', animation: 'pSpin 1s linear infinite', marginBottom: 28 }} />
      <div style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginBottom: 10 }}>{mode === 'future' ? 'AI 시각화 중…' : '스타일링 분석 중…'}</div>
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 24 }}>{progress.label || '준비 중'}</div>
      <div style={{ width: 240, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${progress.percent || 0}%`, height: '100%', background: 'linear-gradient(90deg, #58aefe, #8ec5f8)', transition: 'width 400ms ease' }} />
      </div>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 24, padding: '0 32px', textAlign: 'center', lineHeight: 1.5 }}>
        {mode === 'future' ? '이미지 생성은 20~40초 소요됩니다.' : '보통 10~20초 소요됩니다.'}
      </div>
    </div>
  );
}

function ErrorScreen({ reason, mode, onRetry, onClose }) {
  const msg = mode === 'future' ? skinFutureErrorMessage(reason) :
              reason === 'camera_denied' ? '카메라 권한이 필요해요. 브라우저 설정에서 허용해주세요.' :
              reason === 'landmark_failed' ? '얼굴 인식이 잘 안 됐어요. 조명·각도 조정 후 다시 시도해주세요.' :
              reason === 'proportion_failed' ? '비율 계산이 실패했어요. 다시 시도해주세요.' :
              coachingErrorMessage(reason);
  return (
    <div style={{ ...pageWrap, background: 'linear-gradient(180deg, #2a1a1a 0%, #1a1414 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
      <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'rgba(255,120,120,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ff8a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/></svg>
      </div>
      <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 10 }}>분석 실패</div>
      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.6, marginBottom: 28, wordBreak: 'keep-all' }}>{msg}</div>
      <button onClick={onRetry} style={{ width: '100%', maxWidth: 280, padding: 14, background: '#58aefe', border: 'none', borderRadius: 14, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}>다시 시도</button>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500, padding: 8, cursor: 'pointer', fontFamily: 'inherit' }}>나가기</button>
    </div>
  );
}

function NextActionFAB({ label, onClick }) {
  return (
    <button onClick={onClick} style={{
      position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)', left: '50%', transform: 'translateX(-50%)',
      zIndex: 9800,
      background: 'linear-gradient(135deg, #58aefe 0%, #6598ef 100%)',
      border: 'none', borderRadius: 999, padding: '14px 22px',
      color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: -0.2,
      cursor: 'pointer', fontFamily: 'inherit',
      boxShadow: '0 8px 24px rgba(88,174,254,0.45)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      ✦ {label}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
  );
}

// ===== Styles =====

const pageWrap = {
  position: 'fixed', inset: 0, zIndex: 9700,
  background: '#000', height: '100dvh',
};

const topBar = {
  position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', left: 0, right: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0 16px', zIndex: 3,
};

const iconBtn = {
  width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', cursor: 'pointer', padding: 0,
};

const topGradient = {
  position: 'absolute', top: 0, left: 0, right: 0, height: 120,
  background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
  zIndex: 2, pointerEvents: 'none',
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

// ===== 디버그용 글로벌 진입점 =====
if (typeof window !== 'undefined') {
  window.luaFaceCoach = function(mode) {
    window.dispatchEvent(new CustomEvent('lua:face-coach-open', { detail: { mode: mode || null } }));
    console.log('[face-coach] open event dispatched', mode ? `(mode=${mode})` : '');
  };
}
