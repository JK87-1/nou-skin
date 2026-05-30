/**
 * PrecisionResultView.jsx — 정밀 측정 결과 화면
 *
 * 일반 측정과 차별되는 정밀 모드 전용 표시:
 *  - 좌·우 비대칭 카드 (5종)
 *  - 9 부위 점수 히트맵 (SVG 얼굴 도식)
 *  - 임상 발견(clinical_findings)
 *  - 시술 후보(treatment_candidates)
 *  - 의사 톤 상세 판독(detailed_analysis)
 *  - 12 메트릭 그리드 (참조)
 *  - 3장 미니 프리뷰 + 공유(html-to-image)
 *
 * props:
 *   - result: runPrecisionMeasure 결과 (precision JSON)
 *   - images: { front, left, right } (base64)
 *   - onClose()
 */

import { useRef, useState } from 'react';
import { hapticLight, hapticSuccess } from '../utils/haptics';

const SEVERITY_LABEL = { none: '대칭', minor: '약간 차이', moderate: '뚜렷한 차이', severe: '큰 차이' };
const SEVERITY_COLOR = { none: '#58aefe', minor: '#7fb6ec', moderate: '#f5a85c', severe: '#ec6b6b' };

function scoreColor(score) {
  if (score == null || isNaN(score)) return '#6b7280';
  if (score >= 80) return '#58aefe';
  if (score >= 65) return '#7fb6ec';
  if (score >= 50) return '#f0c264';
  if (score >= 35) return '#f5a85c';
  return '#ec6b6b';
}

function scoreLabel(score) {
  if (score == null) return '—';
  if (score >= 80) return '우수';
  if (score >= 65) return '양호';
  if (score >= 50) return '보통';
  if (score >= 35) return '주의';
  return '관리 필요';
}

const METRIC_LABEL = {
  moisture: '수분',
  skinTone: '피부톤',
  oilBalance: '유분 균형',
  wrinkles: '주름',
  elasticity: '탄력',
  texture: '피부결',
  pores: '모공',
  pigmentation: '색소·잡티',
  darkCircles: '다크서클',
  redness: '붉은기',
  oilMoistureBalance: '유수분 밸런스',
};

const ASYMMETRY_LABEL = {
  darkCircles: '다크서클',
  pigmentation: '색소·잡티',
  redness: '붉은기',
  nasolabial: '팔자주름',
  pores: '모공',
};

export default function PrecisionResultView({ result, images, onClose }) {
  const sheetRef = useRef(null);
  const [sharing, setSharing] = useState(false);

  if (!result) return null;

  const overallScore = (() => {
    const keys = ['moisture','skinTone','oilBalance','wrinkles','elasticity','texture','pores','pigmentation','darkCircles','redness'];
    const vals = keys.map(k => result[k]).filter(v => typeof v === 'number');
    if (vals.length === 0) return null;
    return Math.round(vals.reduce((a,b)=>a+b,0) / vals.length);
  })();

  const handleShare = async () => {
    hapticLight();
    setSharing(true);
    try {
      const htmlToImage = await import('html-to-image');
      const dataUrl = await htmlToImage.toPng(sheetRef.current, { pixelRatio: 2, backgroundColor: '#0e1530' });
      const blob = await (await fetch(dataUrl)).blob();
      if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'lua-precision.png', { type: 'image/png' })] })) {
        await navigator.share({ files: [new File([blob], 'lua-precision.png', { type: 'image/png' })], title: 'LUA 정밀 측정 결과' });
      } else {
        const a = document.createElement('a');
        a.href = dataUrl; a.download = 'lua-precision.png'; a.click();
      }
      hapticSuccess();
    } catch (e) {
      console.warn('[precision] share failed:', e);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div style={pageWrap}>
      {/* 상단 헤더 */}
      <div style={topBar}>
        <button onClick={onClose} style={iconBtn} aria-label="닫기">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fff', fontSize: 14, fontWeight: 600, letterSpacing: -0.2 }}>
          <span style={{ color: '#58aefe' }}>✦</span> 정밀 측정 결과
        </div>
        <button onClick={handleShare} disabled={sharing} style={iconBtn} aria-label="공유">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        </button>
      </div>

      <div ref={sheetRef} style={scrollArea}>
        {/* 1) 종합 점수 + 3장 미니 프리뷰 */}
        <section style={{ ...card, padding: 24, marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <ScoreOrb score={overallScore} />
            <div style={{ flex: 1 }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 4 }}>종합 점수</div>
              <div style={{ color: '#fff', fontSize: 30, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1 }}>
                {overallScore ?? '—'}<span style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}> / 100</span>
              </div>
              <div style={{ color: scoreColor(overallScore), fontSize: 13, fontWeight: 600, marginTop: 6 }}>{scoreLabel(overallScore)}</div>
            </div>
          </div>
          {images && (
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              {['front','left','right'].map(k => images[k] && (
                <div key={k} style={miniThumb}>
                  <img src={`data:image/jpeg;base64,${images[k]}`} alt={k} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={miniLabel}>{k === 'front' ? '정면' : k === 'left' ? '좌측' : '우측'}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 2) AI 정밀 판독 (의사 톤) — 가장 위에 노출 */}
        {result.detailed_analysis && (
          <section style={card}>
            <SectionTitle icon="stethoscope">AI 정밀 판독</SectionTitle>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 1.75, letterSpacing: -0.2, whiteSpace: 'pre-wrap' }}>
              {result.detailed_analysis}
            </div>
          </section>
        )}

        {/* 3) 좌·우 비대칭 카드 — 정밀 측정의 핵심 차별점 */}
        {result.asymmetry && (
          <section style={card}>
            <SectionTitle icon="symmetry">좌·우 비대칭 분석</SectionTitle>
            {result.asymmetry.summary && (
              <div style={{ background: 'rgba(88,174,254,0.12)', border: '1px solid rgba(88,174,254,0.25)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, color: '#bfdcfb', fontSize: 13, lineHeight: 1.55 }}>
                {result.asymmetry.summary}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.keys(ASYMMETRY_LABEL).map(key => {
                const a = result.asymmetry[key];
                if (!a) return null;
                return <AsymmetryRow key={key} label={ASYMMETRY_LABEL[key]} data={a} />;
              })}
            </div>
          </section>
        )}

        {/* 4) 부위별 9 영역 히트맵 */}
        {result.regional_scores && (
          <section style={card}>
            <SectionTitle icon="map">부위별 정밀 점수</SectionTitle>
            <FaceHeatmap regional={result.regional_scores} />
            <RegionalList regional={result.regional_scores} />
          </section>
        )}

        {/* 5) 임상 발견 */}
        {Array.isArray(result.clinical_findings) && result.clinical_findings.length > 0 && (
          <section style={card}>
            <SectionTitle icon="clinical">임상 발견</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {result.clinical_findings.map((f, i) => (
                <div key={i} style={findingRow}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: SEVERITY_COLOR[f.severity] || '#7fb6ec', marginTop: 7, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, marginBottom: 4 }}>{f.finding}</div>
                    {Array.isArray(f.regions) && f.regions.length > 0 && (
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11.5, fontWeight: 500 }}>{f.regions.join(' · ')}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 6) 시술 후보 (정보 제공) */}
        {Array.isArray(result.treatment_candidates) && result.treatment_candidates.length > 0 && (
          <section style={card}>
            <SectionTitle icon="syringe">고려 가능한 시술 카테고리</SectionTitle>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11.5, marginBottom: 12, lineHeight: 1.55 }}>
              ※ 정보 제공 목적의 일반 카테고리 안내입니다. 진단·처방이 아니며 전문의 상담을 권장합니다.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {result.treatment_candidates.map((t, i) => (
                <div key={i} style={treatmentCard}>
                  <div style={{ color: '#bfdcfb', fontSize: 13, fontWeight: 700, letterSpacing: -0.2, marginBottom: 6 }}>{t.category}</div>
                  {t.rationale && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 1.55, marginBottom: 8 }}>{t.rationale}</div>}
                  {Array.isArray(t.options) && t.options.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {t.options.map((o, j) => (
                        <span key={j} style={chip}>{o}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 7) 12 메트릭 그리드 (참조용) */}
        <section style={card}>
          <SectionTitle icon="grid">전체 메트릭</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {Object.entries(METRIC_LABEL).map(([k, label]) => {
              const v = result[k];
              if (typeof v !== 'number') return null;
              return (
                <div key={k} style={metricCell}>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11.5, fontWeight: 500, marginBottom: 4 }}>{label}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>{Math.round(v)}</div>
                    <div style={{ color: scoreColor(v), fontSize: 11, fontWeight: 600 }}>{scoreLabel(v)}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {typeof result.troubleCount === 'number' && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
              트러블 개수: <span style={{ color: '#fff', fontWeight: 700 }}>{result.troubleCount}</span>개
              {result.troubleBreakdown && (
                <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.5)' }}>
                  ({Object.entries(result.troubleBreakdown).filter(([,n]) => n > 0).map(([k,n]) => `${k} ${n}`).join(' · ') || '세부 없음'})
                </span>
              )}
            </div>
          )}
        </section>

        <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }} />
      </div>
    </div>
  );
}

// ===== Sub Components =====

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
    case 'stethoscope': return <svg {...props}><path d="M6 4v6a4 4 0 0 0 8 0V4"/><path d="M10 18a4 4 0 0 0 4-4v-2"/><circle cx="18" cy="18" r="2"/></svg>;
    case 'symmetry': return <svg {...props}><path d="M12 3v18"/><path d="M5 8l7 4 7-4"/><path d="M5 16l7-4 7 4"/></svg>;
    case 'map': return <svg {...props}><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>;
    case 'clinical': return <svg {...props}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>;
    case 'syringe': return <svg {...props}><path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/></svg>;
    case 'grid': return <svg {...props}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>;
    default: return null;
  }
}

function ScoreOrb({ score }) {
  const color = scoreColor(score);
  return (
    <div style={{ position: 'relative', width: 92, height: 92, flexShrink: 0 }}>
      <svg width="92" height="92" viewBox="0 0 92 92">
        <circle cx="46" cy="46" r="40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6"/>
        <circle cx="46" cy="46" r="40" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${(score || 0) / 100 * 251.3} 251.3`} transform="rotate(-90 46 46)"/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ color: '#fff', fontSize: 24, fontWeight: 700, lineHeight: 1, letterSpacing: -0.5 }}>{score ?? '—'}</div>
      </div>
    </div>
  );
}

function AsymmetryRow({ label, data }) {
  const left = Math.round(data.left ?? 0);
  const right = Math.round(data.right ?? 0);
  const diff = Math.round(data.diff ?? Math.abs(left - right));
  const sev = data.severity || (diff < 3 ? 'none' : diff < 6 ? 'minor' : diff < 10 ? 'moderate' : 'severe');
  const sevColor = SEVERITY_COLOR[sev] || '#7fb6ec';

  // 좌·우 막대 (큰 쪽 기준 정규화)
  const max = Math.max(left, right, 1);
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 600 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ background: `${sevColor}33`, color: sevColor, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
            {SEVERITY_LABEL[sev]}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11.5 }}>Δ {diff}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, color: 'rgba(255,255,255,0.55)', fontSize: 11, textAlign: 'right' }}>좌 {left}</div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, display: 'flex', justifyContent: 'flex-end', overflow: 'hidden' }}>
            <div style={{ width: `${(left/max)*100}%`, height: '100%', background: scoreColor(left), borderRadius: 3 }} />
          </div>
          <div style={{ width: 2, height: 10, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${(right/max)*100}%`, height: '100%', background: scoreColor(right), borderRadius: 3 }} />
          </div>
        </div>
        <div style={{ width: 28, color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>우 {right}</div>
      </div>
    </div>
  );
}

function regionAvg(r) {
  if (!r) return null;
  const nums = Object.values(r).filter(v => typeof v === 'number');
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a,b)=>a+b,0) / nums.length);
}

function FaceHeatmap({ regional }) {
  // 정면 얼굴 도식 위에 부위별 점수 dot
  const regions = [
    { key: 'forehead', cx: 50, cy: 22, label: '이마' },
    { key: 'left_cheek', cx: 30, cy: 50, label: '좌볼' },
    { key: 'right_cheek', cx: 70, cy: 50, label: '우볼' },
    { key: 'nose', cx: 50, cy: 45, label: '코' },
    { key: 'nasolabial_left', cx: 36, cy: 60, label: '좌팔자', isNaso: true },
    { key: 'nasolabial_right', cx: 64, cy: 60, label: '우팔자', isNaso: true },
    { key: 'under_eye_left', cx: 36, cy: 38, label: '좌눈밑' },
    { key: 'under_eye_right', cx: 64, cy: 38, label: '우눈밑' },
    { key: 'chin', cx: 50, cy: 76, label: '턱' },
  ];

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 280, margin: '0 auto 16px', aspectRatio: '1 / 1.15' }}>
      <svg viewBox="0 0 100 115" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {/* 얼굴 윤곽 */}
        <ellipse cx="50" cy="55" rx="32" ry="42" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" strokeDasharray="2 2"/>
        {/* 눈 */}
        <ellipse cx="36" cy="32" rx="4" ry="1.5" fill="rgba(255,255,255,0.15)"/>
        <ellipse cx="64" cy="32" rx="4" ry="1.5" fill="rgba(255,255,255,0.15)"/>
        {/* 코 */}
        <path d="M 50 38 L 48 50 L 52 50 Z" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6"/>
        {/* 입 */}
        <path d="M 44 72 Q 50 75 56 72" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8"/>

        {/* 부위별 dot */}
        {regions.map(r => {
          const data = regional[r.key];
          let score = null;
          if (r.isNaso) {
            // nasolabial은 visibility 낮을수록 좋음 → 100-visibility로 변환
            score = data?.visibility != null ? 100 - data.visibility : null;
          } else {
            score = regionAvg(data);
          }
          if (score == null) return null;
          const color = scoreColor(score);
          return (
            <g key={r.key}>
              <circle cx={r.cx} cy={r.cy} r="6" fill={`${color}40`}/>
              <circle cx={r.cx} cy={r.cy} r="3" fill={color}/>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function RegionalList({ regional }) {
  const labelMap = {
    forehead: '이마', left_cheek: '왼쪽 볼', right_cheek: '오른쪽 볼',
    nose: '코', nasolabial_left: '왼쪽 팔자', nasolabial_right: '오른쪽 팔자',
    under_eye_left: '왼쪽 눈밑', under_eye_right: '오른쪽 눈밑', chin: '턱',
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
      {Object.entries(labelMap).map(([key, label]) => {
        const d = regional[key];
        if (!d) return null;
        let score = null;
        let extra = '';
        if (key.startsWith('nasolabial')) {
          score = d.visibility != null ? 100 - d.visibility : null;
          extra = d.depth_label ? ({ mild: '약함', moderate: '보통', deep: '깊음' })[d.depth_label] || d.depth_label : '';
        } else if (key === 'chin') {
          score = regionAvg(d);
          extra = d.sagging_label ? ({ firm: '탱탱', mild_sag: '약간 처짐', moderate_sag: '처짐', pronounced_sag: '뚜렷한 처짐' })[d.sagging_label] || '' : '';
        } else {
          score = regionAvg(d);
        }
        return (
          <div key={key} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 500 }}>{label}</div>
              {extra && <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 2 }}>{extra}</div>}
            </div>
            <div style={{ color: scoreColor(score), fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>{score ?? '—'}</div>
          </div>
        );
      })}
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
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  flexShrink: 0,
};

const iconBtn = {
  width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none',
  cursor: 'pointer', padding: 0,
};

const scrollArea = {
  flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
  padding: '0 16px 16px',
};

const card = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 16,
  padding: 18,
  marginTop: 12,
};

const miniThumb = {
  flex: 1, aspectRatio: '3 / 4', borderRadius: 10, overflow: 'hidden',
  position: 'relative', border: '1px solid rgba(255,255,255,0.1)',
};

const miniLabel = {
  position: 'absolute', bottom: 4, left: 4, right: 4,
  background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 10, fontWeight: 600,
  padding: '2px 6px', borderRadius: 4, textAlign: 'center',
};

const findingRow = {
  display: 'flex', gap: 10, padding: '12px 14px',
  background: 'rgba(255,255,255,0.04)', borderRadius: 12,
};

const treatmentCard = {
  background: 'rgba(88,174,254,0.06)',
  border: '1px solid rgba(88,174,254,0.15)',
  borderRadius: 12, padding: '12px 14px',
};

const chip = {
  background: 'rgba(255,255,255,0.08)',
  color: 'rgba(255,255,255,0.8)',
  fontSize: 11.5, fontWeight: 500,
  padding: '4px 10px', borderRadius: 6,
};

const metricCell = {
  background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px',
};
