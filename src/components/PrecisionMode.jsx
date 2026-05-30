/**
 * PrecisionMode.jsx — 정밀 측정 모드 컨테이너
 *
 * 모든 정밀 측정 흐름의 단일 진입점:
 *   1) paywall:   unlock 안 됨 → 결제 UI
 *   2) capture:   3각도 캡처 + AI 분석
 *   3) result:    결과 화면 (저장 자동)
 *
 * 사용:
 *   <PrecisionMode open={open} onClose={() => setOpen(false)} />
 *
 * App.jsx에서 호출만 추가하면 됨 (메인 UI 진입점은 미배치 — 사용자 요청).
 * 개발 시 console.lua_precision() 으로 강제 진입 가능.
 */

import { useState, useEffect } from 'react';
import PrecisionPaywall from './PrecisionPaywall';
import PrecisionCaptureGuide from './PrecisionCaptureGuide';
import PrecisionResultView from './PrecisionResultView';
import {
  isPrecisionUnlocked,
  consumePrecisionQuota,
  savePrecisionRecord,
  getLatestPrecisionRecord,
} from '../storage/PrecisionStorage';

export default function PrecisionMode({ open, onClose, startStage = 'auto' }) {
  // stage: 'paywall' | 'capture' | 'result' | 'history-latest'
  const [stage, setStage] = useState('paywall');
  const [result, setResult] = useState(null);
  const [images, setImages] = useState(null);

  // 진입 시 unlock 상태 따라 시작 stage 결정
  useEffect(() => {
    if (!open) return;
    if (startStage !== 'auto') { setStage(startStage); return; }
    if (isPrecisionUnlocked()) {
      setStage('capture');
    } else {
      setStage('paywall');
    }
  }, [open, startStage]);

  if (!open) return null;

  // ===== 분기 처리 =====
  const handlePaywallUnlock = () => {
    setStage('capture');
  };

  const handleCaptureComplete = (precisionResult, capturedImages) => {
    // quota 차감 (성공한 측정만)
    consumePrecisionQuota();
    // 자동 저장
    savePrecisionRecord(precisionResult, capturedImages);
    setResult(precisionResult);
    setImages(capturedImages);
    setStage('result');
  };

  const handleResultClose = () => {
    setResult(null);
    setImages(null);
    onClose?.();
  };

  const handleCaptureCancel = () => {
    onClose?.();
  };

  // ===== 렌더 =====
  if (stage === 'paywall') {
    return <PrecisionPaywall onUnlock={handlePaywallUnlock} onClose={onClose} />;
  }
  if (stage === 'capture') {
    return <PrecisionCaptureGuide onComplete={handleCaptureComplete} onCancel={handleCaptureCancel} />;
  }
  if (stage === 'result') {
    return <PrecisionResultView result={result} images={images} onClose={handleResultClose} />;
  }
  if (stage === 'history-latest') {
    // 최근 저장된 정밀 측정 결과 다시 보기 (이미지는 thumbnail만)
    const latest = getLatestPrecisionRecord();
    if (!latest) { onClose?.(); return null; }
    // savePrecisionRecord에서 일부만 저장하므로 result 구조 복원
    const reconstructed = {
      ...latest.metrics,
      regional_scores: latest.regionalScores,
      clinical_findings: latest.clinicalFindings,
      treatment_candidates: latest.treatmentCandidates?.map(c => ({ category: c })),
      asymmetry: latest.asymmetrySummary ? { summary: latest.asymmetrySummary } : null,
      detailed_analysis: null,
      analysisMode: latest.analysisMode,
    };
    const reconstructedImages = latest.thumbnail ? { front: latest.thumbnail.split(',')[1] } : null;
    return <PrecisionResultView result={reconstructed} images={reconstructedImages} onClose={onClose} />;
  }

  return null;
}

// ===== 디버그용 글로벌 진입점 =====
// 콘솔에서 window.luaPrecision() 으로 강제 진입 (App.jsx 통합 전 테스트용)
if (typeof window !== 'undefined') {
  window.luaPrecision = function() {
    const evt = new CustomEvent('lua:precision-open');
    window.dispatchEvent(evt);
    console.log('[precision] open event dispatched — listen with window.addEventListener("lua:precision-open", ...)');
  };
  window.luaPrecisionReset = function() {
    try {
      localStorage.removeItem('lua_precision_unlocked');
      localStorage.removeItem('lua_precision_quota');
      localStorage.removeItem('lua_precision_quota_meta');
      console.log('[precision] unlock reset');
    } catch {}
  };
}
