/**
 * FaceProportionResult.jsx — 얼굴 비율 분석 + 메이크업·헤어 코칭 결과 화면
 *
 * 흐름:
 *   1) 사진 위 비율 라인 오버레이 (삼정·광대선)
 *   2) 종합 점수 + 얼굴형 카드
 *   3) 4지표 (삼정·오등분·황금비·대칭) 카드
 *   4) AI 코칭 (메이크업 5섹션 + 헤어 + 아이브로우 + 핵심 포인트)
 *   5) PNG 공유
 *
 * props:
 *   - proportion: FaceProportion.analyzeProportion() 결과
 *   - coaching:   FaceCoaching.fetchFaceCoaching() 결과의 coaching
 *   - imageBase64: 정면 사진 (오버레이 배경)
 *   - onClose()
 */

import { useRef, useState } from 'react';
import { hapticLight, hapticSuccess } from '../utils/haptics';

function scoreColor(score) {
  if (score == null) return '#6b7280';
  if (score >= 80) return '#58aefe';
  if (score >= 65) return '#7fb6ec';
  if (score >= 50) return '#f0c264';
  return '#f5a85c';
}

export default function FaceProportionResult({ proportion, coaching, imageBase64, onClose }) {
  const sheetRef = useRef(null);
  const [sharing, setSharing] = useState(false);

  if (!proportion) return null;
  const p = proportion;

  const handleShare = async () => {
    hapticLight();
    setSharing(true);
    try {
      const htmlToImage = await import('html-to-image');
      const dataUrl = await htmlToImage.toPng(sheetRef.current, { pixelRatio: 2, backgroundColor: '#0e1530' });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'lua-face-coach.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'LUA 얼굴 분석' });
      } else {
        const a = document.createElement('a');
        a.href = dataUrl; a.download = 'lua-face-coach.png'; a.click();
      }
      hapticSuccess();
    } catch (e) {
      console.warn('[face-coach] share failed:', e);
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
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>얼굴 분석 · 스타일링</div>
        <button onClick={handleShare} disabled={sharing} style={iconBtn} aria-label="공유">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        </button>
      </div>

      <div ref={sheetRef} style={scrollArea}>
        {/* 1) 사진 + 비율 오버레이 */}
        {imageBase64 && (
          <section style={{ ...card, padding: 0, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <img src={imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`}
                   alt="분석 사진"
                   style={{ width: '100%', display: 'block' }} />
              <ProportionOverlay keyPoints={p.keyPoints} />
            </div>
            <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11.5, marginBottom: 3 }}>얼굴형</div>
                <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>{p.shape.label}</div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 4, lineHeight: 1.5, maxWidth: 220 }}>{p.shape.desc}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10.5, marginBottom: 3 }}>비율 종합</div>
                <div style={{ color: scoreColor(p.overall), fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{p.overall}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9.5, marginTop: 2 }}>/ 100</div>
              </div>
            </div>
          </section>
        )}

        {/* 2) shapeInsight (AI 한 줄 통찰) */}
        {coaching?.shapeInsight && (
          <section style={{ ...card, background: 'rgba(88,174,254,0.08)', border: '1px solid rgba(88,174,254,0.2)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(88,174,254,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#58aefe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17.75l-6.172 3.245l1.179-6.873L2 9.255l6.9-1L12 2.005l3.1 6.25l6.9 1l-5 4.867l1.179 6.873z"/></svg>
              </div>
              <div style={{ color: '#fff', fontSize: 13.5, lineHeight: 1.6, fontWeight: 500 }}>{coaching.shapeInsight}</div>
            </div>
          </section>
        )}

        {/* 3) 4지표 카드 */}
        <section style={card}>
          <SectionTitle icon="ratio">비율 지표</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <RatioRow label="삼정(三停)" sub={`상 ${p.thirds.upper}% · 중 ${p.thirds.middle}% · 하 ${p.thirds.lower}%`} value={p.thirds.balance} hint="이상: 각 33.3%" />
            <RatioRow label="오등분(五等分)" sub={`얼굴폭/눈폭 ${p.fifths.ratio}`} value={p.fifths.balance} hint="이상: 5.0" />
            <RatioRow label="황금비" sub={`높이/폭 ${p.golden.ratio}`} value={p.golden.balance} hint="이상: 1.618" />
            <RatioRow label="좌우 대칭" sub={`midline 기준 6쌍 편차`} value={p.symmetry} hint="이상: 100" />
          </div>
        </section>

        {/* 4) 메이크업 코칭 */}
        {coaching?.makeup && (
          <section style={card}>
            <SectionTitle icon="brush">메이크업 가이드</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CoachingRow label="베이스" text={coaching.makeup.base} />
              <CoachingRow label="컨투어링" text={coaching.makeup.contouring} />
              <CoachingRow label="아이" text={coaching.makeup.eye} />
              <CoachingRow label="블러셔" text={coaching.makeup.blush} />
              <CoachingRow label="립" text={coaching.makeup.lip} />
            </div>
          </section>
        )}

        {/* 5) 헤어 코칭 */}
        {coaching?.hair && (
          <section style={card}>
            <SectionTitle icon="scissors">헤어 추천</SectionTitle>
            {Array.isArray(coaching.hair.best) && coaching.hair.best.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11.5, fontWeight: 600, marginBottom: 6 }}>잘 어울려요</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {coaching.hair.best.map((s, i) => (
                    <span key={i} style={{ ...chip, background: 'rgba(88,174,254,0.15)', color: '#bfdcfb', border: '1px solid rgba(88,174,254,0.3)' }}>{s}</span>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(coaching.hair.avoid) && coaching.hair.avoid.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11.5, fontWeight: 600, marginBottom: 6 }}>피하면 좋아요</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {coaching.hair.avoid.map((s, i) => (
                    <span key={i} style={{ ...chip, background: 'rgba(245,168,92,0.12)', color: '#f5c294', border: '1px solid rgba(245,168,92,0.25)' }}>{s}</span>
                  ))}
                </div>
              </div>
            )}
            {coaching.hair.rationale && (
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5, lineHeight: 1.65, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {coaching.hair.rationale}
              </div>
            )}
          </section>
        )}

        {/* 6) 아이브로우 */}
        {coaching?.eyebrow && (
          <section style={card}>
            <SectionTitle icon="brow">아이브로우</SectionTitle>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11.5 }}>추천 모양</div>
              <div style={{ color: '#bfdcfb', fontSize: 13.5, fontWeight: 700 }}>{coaching.eyebrow.shape}</div>
            </div>
            {coaching.eyebrow.tip && (
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12.5, lineHeight: 1.6 }}>{coaching.eyebrow.tip}</div>
            )}
          </section>
        )}

        {/* 7) 핵심 포인트 */}
        {coaching?.accent && (
          <section style={{ ...card, background: 'linear-gradient(135deg, rgba(88,174,254,0.15) 0%, rgba(101,152,239,0.1) 100%)', border: '1px solid rgba(88,174,254,0.25)' }}>
            <div style={{ color: '#58aefe', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>★ TODAY'S POINT</div>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, lineHeight: 1.55, letterSpacing: -0.2 }}>{coaching.accent}</div>
          </section>
        )}

        <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }} />
      </div>
    </div>
  );
}

// ===== Sub Components =====

function ProportionOverlay({ keyPoints }) {
  if (!keyPoints) return null;
  // 정규화 좌표 → SVG viewBox 0~100. 이미지 비율은 부모 width 기준 auto.
  const to = (v) => +(v * 100).toFixed(2);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      {/* 삼정 가로선 */}
      <line x1="5" y1={to(keyPoints.hairline.y)} x2="95" y2={to(keyPoints.hairline.y)} stroke="#58aefe" strokeWidth="0.4" strokeDasharray="1.5 1" opacity="0.7"/>
      <line x1="5" y1={to(keyPoints.brow.y)} x2="95" y2={to(keyPoints.brow.y)} stroke="#58aefe" strokeWidth="0.4" strokeDasharray="1.5 1" opacity="0.7"/>
      <line x1="5" y1={to(keyPoints.subnasale.y)} x2="95" y2={to(keyPoints.subnasale.y)} stroke="#58aefe" strokeWidth="0.4" strokeDasharray="1.5 1" opacity="0.7"/>
      <line x1="5" y1={to(keyPoints.chin.y)} x2="95" y2={to(keyPoints.chin.y)} stroke="#58aefe" strokeWidth="0.4" strokeDasharray="1.5 1" opacity="0.7"/>

      {/* 광대 폭 세로 선 */}
      <line x1={to(keyPoints.leftCheek.x)} y1="5" x2={to(keyPoints.leftCheek.x)} y2="95" stroke="rgba(88,174,254,0.4)" strokeWidth="0.3" strokeDasharray="1 1"/>
      <line x1={to(keyPoints.rightCheek.x)} y1="5" x2={to(keyPoints.rightCheek.x)} y2="95" stroke="rgba(88,174,254,0.4)" strokeWidth="0.3" strokeDasharray="1 1"/>

      {/* 키 포인트 dots */}
      {[keyPoints.hairline, keyPoints.brow, keyPoints.subnasale, keyPoints.chin].map((pt, i) => (
        <circle key={i} cx={to(pt.x)} cy={to(pt.y)} r="0.7" fill="#58aefe"/>
      ))}

      {/* 라벨 */}
      <text x="3" y={to(keyPoints.hairline.y) - 0.5} fill="#bfdcfb" fontSize="2" fontWeight="600">상정</text>
      <text x="3" y={to(keyPoints.brow.y) - 0.5} fill="#bfdcfb" fontSize="2" fontWeight="600">중정</text>
      <text x="3" y={to(keyPoints.subnasale.y) - 0.5} fill="#bfdcfb" fontSize="2" fontWeight="600">하정</text>
    </svg>
  );
}

function SectionTitle({ children, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <SectionIcon name={icon} />
      <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: -0.3 }}>{children}</div>
    </div>
  );
}

function SectionIcon({ name }) {
  const props = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: '#58aefe', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'ratio': return <svg {...props}><path d="M5 3v18"/><path d="M3 5h18"/><path d="M3 12h18"/><path d="M3 19h18"/></svg>;
    case 'brush': return <svg {...props}><path d="M3 21h18"/><path d="M6 17l3-3 6 6-3 3z"/><path d="M14 6l4 4"/><path d="M14 6l3-3 4 4-3 3"/></svg>;
    case 'scissors': return <svg {...props}><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>;
    case 'brow': return <svg {...props}><path d="M3 9c4-4 14-4 18 0"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/></svg>;
    default: return null;
  }
}

function RatioRow({ label, sub, value, hint }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 600 }}>{label}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>{sub}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: scoreColor(value), fontSize: 20, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1 }}>{value}</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9.5, marginTop: 2 }}>{hint}</div>
        </div>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: scoreColor(value), borderRadius: 2, transition: 'width 600ms ease' }}/>
      </div>
    </div>
  );
}

function CoachingRow({ label, text }) {
  if (!text) return null;
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <div style={{ width: 48, flexShrink: 0, color: '#bfdcfb', fontSize: 11.5, fontWeight: 700, paddingTop: 1, letterSpacing: -0.2 }}>{label}</div>
      <div style={{ flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.65, letterSpacing: -0.2 }}>{text}</div>
    </div>
  );
}

// ===== Styles =====

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

const chip = {
  background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)',
  fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
};
