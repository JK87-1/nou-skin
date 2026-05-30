/**
 * SkinFutureView.jsx — "케어 후 예상 피부" Before/After 비교 화면
 *
 * UX:
 *  - 가운데 드래그 핸들 슬라이더로 좌(현재) ↔ 우(3개월 후 예상) 분할
 *  - 메트릭 변화 표시 (현재 → 예상)
 *  - 디스클레이머: "AI 시뮬레이션, 실제 결과 보장 X"
 *  - PNG 공유
 *
 * props:
 *   - beforeImage:  현재 사진 base64 (data URL 또는 raw base64)
 *   - afterImage:   AI 생성 사진 base64
 *   - metrics:      현재 측정 메트릭 (예상 개선 계산용)
 *   - onClose()
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { hapticLight, hapticSuccess } from '../utils/haptics';

const METRIC_INFO = {
  skinTone: { label: '피부톤', expectedGain: 8 },
  moisture: { label: '수분', expectedGain: 7 },
  pigmentation: { label: '색소·잡티', expectedGain: 10 },
  pores: { label: '모공', expectedGain: 5 },
  redness: { label: '붉은기', expectedGain: 6 },
  texture: { label: '피부결', expectedGain: 7 },
  darkCircles: { label: '다크서클', expectedGain: 4 },
};

function toDataUrl(b64) {
  if (!b64) return '';
  return b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
}

function predictedAfter(metrics) {
  if (!metrics) return null;
  const out = {};
  Object.entries(METRIC_INFO).forEach(([k, info]) => {
    const cur = metrics[k];
    if (typeof cur !== 'number') return;
    // 현재 점수가 낮을수록 개선폭 큼 (선형)
    const gainFactor = Math.max(0.4, (100 - cur) / 60);
    const gain = Math.round(info.expectedGain * gainFactor);
    const next = Math.min(100, cur + gain);
    out[k] = { before: cur, after: next, gain: next - cur };
  });
  return out;
}

export default function SkinFutureView({ beforeImage, afterImage, metrics, onClose }) {
  const sheetRef = useRef(null);
  const sliderRef = useRef(null);
  const [splitPct, setSplitPct] = useState(50);
  const [sharing, setSharing] = useState(false);

  const predicted = predictedAfter(metrics);

  // 슬라이더 드래그
  const onPointer = useCallback((clientX) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplitPct(Math.max(2, Math.min(98, pct)));
  }, []);

  const handleMouseDown = (e) => {
    e.preventDefault();
    onPointer(e.clientX);
    const move = (ev) => onPointer(ev.clientX);
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const handleTouchMove = (e) => {
    const t = e.touches[0];
    if (t) onPointer(t.clientX);
  };

  // 진입 시 한 번 부드러운 데모 애니메이션
  useEffect(() => {
    const timeline = [
      { t: 300, v: 80 },
      { t: 1300, v: 20 },
      { t: 2300, v: 50 },
    ];
    const timers = timeline.map(({ t, v }) => setTimeout(() => setSplitPct(v), t));
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleShare = async () => {
    hapticLight();
    setSharing(true);
    try {
      const htmlToImage = await import('html-to-image');
      const dataUrl = await htmlToImage.toPng(sheetRef.current, { pixelRatio: 2, backgroundColor: '#0e1530' });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'lua-skin-future.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'LUA · 3개월 후 예상 피부' });
      } else {
        const a = document.createElement('a');
        a.href = dataUrl; a.download = 'lua-skin-future.png'; a.click();
      }
      hapticSuccess();
    } catch (e) {
      console.warn('[skin-future] share failed:', e);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div style={pageWrap}>
      <div style={topBar}>
        <button onClick={onClose} style={iconBtn} aria-label="닫기">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>3개월 후 예상 피부</div>
        <button onClick={handleShare} disabled={sharing} style={iconBtn} aria-label="공유">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        </button>
      </div>

      <div ref={sheetRef} style={scrollArea}>
        {/* Before/After 슬라이더 */}
        <section style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div
            ref={sliderRef}
            onMouseDown={handleMouseDown}
            onTouchMove={handleTouchMove}
            onTouchStart={handleTouchMove}
            style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', cursor: 'ew-resize', userSelect: 'none', touchAction: 'none', background: '#000' }}
          >
            {/* before (전체) */}
            <img src={toDataUrl(beforeImage)} alt="현재" draggable={false}
                 style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            {/* after (clip-path로 우측만 노출) */}
            <img src={toDataUrl(afterImage)} alt="3개월 후" draggable={false}
                 style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                          clipPath: `inset(0 0 0 ${splitPct}%)` }} />

            {/* 분할 라인 + 핸들 */}
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${splitPct}%`, width: 2, background: '#fff', boxShadow: '0 0 10px rgba(0,0,0,0.4)', transform: 'translateX(-1px)' }} />
            <div style={{ position: 'absolute', top: '50%', left: `${splitPct}%`, transform: 'translate(-50%, -50%)',
                          width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.95)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0e1530" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
                <polyline points="9 18 3 12 9 6" transform="translate(20)"/>
              </svg>
            </div>

            {/* 라벨 */}
            <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, letterSpacing: 0.3 }}>현재</div>
            <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(88,174,254,0.85)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, letterSpacing: 0.3 }}>3개월 후</div>
          </div>
          <div style={{ padding: '12px 14px', color: 'rgba(255,255,255,0.55)', fontSize: 11.5, textAlign: 'center' }}>
            ← 좌우 드래그해서 비교해보세요 →
          </div>
        </section>

        {/* 예상 메트릭 변화 */}
        {predicted && Object.keys(predicted).length > 0 && (
          <section style={card}>
            <SectionTitle icon="trend">예상 메트릭 변화</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(predicted).map(([k, v]) => (
                <MetricChange key={k} label={METRIC_INFO[k].label} before={v.before} after={v.after} gain={v.gain} />
              ))}
            </div>
          </section>
        )}

        {/* 케어 권장 안내 */}
        <section style={{ ...card, background: 'linear-gradient(135deg, rgba(88,174,254,0.12) 0%, rgba(101,152,239,0.08) 100%)', border: '1px solid rgba(88,174,254,0.25)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(88,174,254,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#58aefe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3l8 -8"/><path d="M20 12v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h9"/></svg>
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 6 }}>이 변화에 가까워지려면</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12.5, lineHeight: 1.7 }}>
                · 매일 자외선 차단 (SPF 30+) · 보습 루틴 꾸준히<br/>
                · 측정에서 약점으로 나온 메트릭에 맞는 성분 케어<br/>
                · 수면 7시간 이상 · 수분 섭취 충분히
              </div>
            </div>
          </div>
        </section>

        {/* 디스클레이머 */}
        <div style={{ padding: '16px 14px', color: 'rgba(255,255,255,0.4)', fontSize: 10.5, lineHeight: 1.6, textAlign: 'center' }}>
          AI 시뮬레이션 결과이며 실제 케어 결과를 보장하지 않습니다.<br/>
          개인의 피부 상태·생활습관·유전적 요인에 따라 결과는 달라질 수 있어요.<br/>
          의료 시술·진단·치료 목적이 아닙니다.
        </div>

        <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }} />
      </div>
    </div>
  );
}

function MetricChange({ label, before, after, gain }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 70, color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 }}>{label}</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 600, width: 28, textAlign: 'right' }}>{before}</div>
        <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: `${before}%`, width: `${after - before}%`, height: '100%', background: 'linear-gradient(90deg, rgba(88,174,254,0.3), #58aefe)' }} />
          <div style={{ position: 'absolute', left: 0, width: `${before}%`, height: '100%', background: 'rgba(255,255,255,0.15)' }} />
        </div>
        <div style={{ color: '#58aefe', fontSize: 13, fontWeight: 700, width: 28 }}>{after}</div>
      </div>
      <div style={{ color: '#58aefe', fontSize: 11.5, fontWeight: 700, width: 32, textAlign: 'right' }}>+{gain}</div>
    </div>
  );
}

function SectionTitle({ children, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      {icon === 'trend' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#58aefe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/>
        </svg>
      )}
      <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: -0.3 }}>{children}</div>
    </div>
  );
}

const pageWrap = {
  position: 'fixed', inset: 0, zIndex: 9700,
  background: 'linear-gradient(180deg, #0e1530 0%, #111118 100%)',
  height: '100dvh', display: 'flex', flexDirection: 'column',
};

const topBar = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 16px 12px',
  borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
};

const iconBtn = {
  width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', cursor: 'pointer', padding: 0,
};

const scrollArea = {
  flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px 16px',
};

const card = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 16, padding: 18, marginTop: 12,
};
