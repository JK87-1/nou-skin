/**
 * SkinMeasurePage — 피부측정 화면 (얼굴을 화면에 맞춰주세요)
 * model.png를 사용한 정적 피부측정 가이드 UI
 */
import { useState, useEffect, useRef } from 'react';

const ANALYSIS_ZONES = [
  { label: '이마', x: 50, y: 22, color: 'rgba(124,92,252,0.75)' },
  { label: 'T존', x: 50, y: 38, color: 'rgba(99,102,241,0.75)' },
  { label: '왼볼', x: 30, y: 46, color: 'rgba(79,70,229,0.65)' },
  { label: '오른볼', x: 70, y: 46, color: 'rgba(79,70,229,0.65)' },
  { label: '눈밑', x: 42, y: 42, color: 'rgba(168,85,247,0.7)' },
  { label: '턱선', x: 50, y: 62, color: 'rgba(139,92,246,0.7)' },
];

// 스캔 포인트 좌표 (얼굴 위 점들)
const SCAN_DOTS = [
  { x: 50, y: 18 },
  { x: 38, y: 28 }, { x: 62, y: 28 },
  { x: 50, y: 36 },
  { x: 30, y: 44 }, { x: 70, y: 44 },
  { x: 40, y: 52 }, { x: 60, y: 52 },
  { x: 50, y: 62 },
  { x: 50, y: 48 },
];

export default function SkinMeasurePage({ onClose, onCapture, colorMode }) {
  const [scanActive, setScanActive] = useState(false);
  const [showZones, setShowZones] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const t1 = setTimeout(() => setScanActive(true), 600);
    const t2 = setTimeout(() => setShowZones(true), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000', zIndex: 200,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* 카메라 프리뷰 영역 */}
      <div ref={containerRef} style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        borderRadius: '0 0 24px 24px',
      }}>
        {/* 모델 이미지 */}
        <img
          src="/model.png"
          alt="face guide"
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            display: 'block',
          }}
        />

        {/* 비네트 마스크 + 타원 가이드 */}
        <div style={{
          position: 'absolute', inset: 0,
          pointerEvents: 'none',
        }}>
          {/* SVG 마스크 오버레이 */}
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <mask id="oval-mask">
                <rect width="100%" height="100%" fill="white" />
                <ellipse cx="50%" cy="42%" rx="34%" ry="28%" fill="black" />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#oval-mask)" />
            <ellipse
              cx="50%" cy="42%" rx="34%" ry="28%"
              fill="none"
              stroke="rgba(124,92,252,0.85)"
              strokeWidth="2.5"
              style={{
                filter: 'drop-shadow(0 0 12px rgba(124,92,252,0.4))',
              }}
            />
          </svg>

          {/* 스캔라인 애니메이션 */}
          {scanActive && (
            <div style={{
              position: 'absolute',
              left: '16%', right: '16%',
              height: 2,
              background: 'linear-gradient(90deg, transparent, rgba(124,92,252,0.6), transparent)',
              animation: 'skinMeasureScanLine 2.5s ease-in-out infinite',
              pointerEvents: 'none',
            }} />
          )}

          {/* 분석 영역 라벨 */}
          {showZones && ANALYSIS_ZONES.map((zone) => (
            <div key={zone.label} style={{
              position: 'absolute',
              left: `${zone.x}%`, top: `${zone.y}%`,
              transform: 'translate(-50%, -50%)',
              padding: '4px 12px',
              borderRadius: 10,
              background: zone.color,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: '"Pretendard Variable", Pretendard, -apple-system, system-ui, sans-serif',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              animation: 'skinMeasureZoneFadeIn 0.5s ease-out both',
              whiteSpace: 'nowrap',
            }}>
              {zone.label}
            </div>
          ))}

          {/* 스캔 포인트 */}
          {scanActive && SCAN_DOTS.map((dot, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${dot.x}%`, top: `${dot.y}%`,
              width: 4, height: 4, borderRadius: '50%',
              background: 'rgba(124,92,252,0.7)',
              transform: 'translate(-50%, -50%)',
              animation: `skinMeasureDotPulse 2s ease-in-out ${i * 0.08}s infinite`,
            }} />
          ))}
        </div>

        {/* 뒤로가기 버튼 */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 'calc(16px + env(safe-area-inset-top, 0px))',
            left: 16,
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.85)', border: 'none',
            color: '#191F28', fontSize: 20, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            zIndex: 10,
          }}
        >
          <span>←</span>
        </button>

        {/* 앨범에서 선택 */}
        <button
          onClick={() => {}}
          style={{
            position: 'absolute',
            top: 'calc(16px + env(safe-area-inset-top, 0px))',
            right: 16,
            padding: '8px 14px', borderRadius: 10,
            background: 'rgba(255,255,255,0.85)', border: 'none',
            color: '#191F28', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            zIndex: 10,
          }}
        >
          앨범에서 선택
        </button>
      </div>

      {/* 하단 컨트롤 */}
      <div style={{
        background: colorMode === 'light' ? '#fff' : '#1a1a2e',
        padding: '16px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
      }}>
        {/* 상태 텍스트 */}
        <p style={{
          color: colorMode === 'light' ? '#191F28' : '#e0e0e0',
          fontSize: 15, fontWeight: 600, textAlign: 'center',
          margin: 0, minHeight: 20,
        }}>
          얼굴을 화면에 맞춰주세요
        </p>

        {/* 조건 인디케이터 */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          {[
            { key: 'face', label: '얼굴', ok: true },
            { key: 'position', label: '위치', ok: false },
            { key: 'distance', label: '거리', ok: false },
            { key: 'light', label: '조명', ok: true },
          ].map(({ key, label, ok }) => (
            <div key={key} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: ok ? '#FF8C42' : 'transparent',
                border: `2px solid ${ok ? '#FF8C42' : (colorMode === 'light' ? '#ccc' : '#555')}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.3s',
              }}>
                {ok && (
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>&#10003;</span>
                )}
              </div>
              <span style={{
                color: ok ? '#FF8C42' : (colorMode === 'light' ? '#999' : '#666'),
                fontSize: 10, fontWeight: 600,
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* 촬영 버튼 */}
        <button
          onClick={onCapture}
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: '#FF8C42',
            border: '4px solid #fff',
            boxShadow: '0 4px 16px rgba(255,140,66,0.3)',
            cursor: 'pointer',
            transition: 'all 0.3s',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(255,255,255,0.3)',
          }} />
        </button>
      </div>

      {/* 애니메이션 스타일 */}
      <style>{`
        @keyframes skinMeasureScanLine {
          0%, 100% { top: 18%; opacity: 0; }
          10% { opacity: 1; }
          50% { top: 58%; opacity: 1; }
          90% { opacity: 1; }
        }
        @keyframes skinMeasureZoneFadeIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes skinMeasureDotPulse {
          0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.5); }
        }
      `}</style>
    </div>
  );
}
