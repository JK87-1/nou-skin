import { useState, useEffect } from 'react';
import GlobalStyles from '../design/GlobalStyles';
import { DropletIcon, SparkleIcon, MicroscopeIcon, CheckIcon, MemoIcon, TargetIcon, ChartIcon, CameraIcon } from '../components/icons/PastelIcons';

/* ══════════════════════════════════════════════════════════════
   LUA 스킨 다이어리 — 통합 목업 v2
   실제 App.jsx 결과 페이지 + HistoryPage UI 구조를 그대로 재현하고,
   다이어리 기능(접이식 컨디션 카드, 인사이트 탭)만 추가
   ══════════════════════════════════════════════════════════════ */

// Demo data
const RECORDS = Array.from({ length: 60 }, (_, i) => {
  const base = 62, trend = i * 0.25;
  const noise = Math.sin(i * 0.8) * 3 + Math.cos(i * 1.2) * 2;
  const serumBoost = i >= 35 ? (i - 35) * 0.4 : 0;
  const drinkDip = (i >= 49 && i <= 52) ? -6 : 0;
  const clamp = v => Math.round(Math.max(35, Math.min(95, v)));
  return {
    day: i + 1,
    overallScore: clamp(base + trend + noise + serumBoost + drinkDip),
    moisture: clamp(55 + trend * 0.8 + noise * 0.6 + serumBoost * 1.5 + drinkDip * 0.8),
    elasticityScore: clamp(60 + trend * 0.5 + noise * 0.4),
    textureScore: clamp(65 + trend * 0.3 + noise * 0.5),
    poreScore: clamp(58 + trend * 0.2 + noise * 0.3),
    routineRate: Math.round(40 + Math.random() * 60),
  };
});

const CONDITIONS = RECORDS.map((_, i) => ({
  day: i + 1,
  alcohol: i === 49 || i === 50 ? 2 : (i >= 45 && Math.random() > 0.8 ? 1 : 0),
}));

const PRODUCTS = [
  { id: 1, name: "시카플라스트 밤 B5+", brand: "라로슈포제", startDay: 1, endDay: null, color: "#89cef5" },
  { id: 2, name: "스네일 뮤신 에센스", brand: "코스알엑스", startDay: 35, endDay: null, color: "#89cef5" },
  { id: 3, name: "그린티 세럼", brand: "이니스프리", startDay: 10, endDay: 34, color: "#F0B870" },
];

const CORRELATIONS = [
  { factor: "루틴 완료율", icon: "✅", corr: 0.68, dir: "+", insight: "루틴 80% 이상 완료한 주, 종합 점수 평균 +5점", source: "auto", dataCount: 60, minRequired: 14 },
  { factor: "습도", icon: "💨", corr: 0.58, dir: "+", insight: "습도 50% 이상일 때 수분 점수 평균 +4점", source: "auto", dataCount: 60, minRequired: 14 },
  { factor: "코스알엑스 에센스", icon: "💧", corr: 0.65, dir: "+", insight: "사용 시작 후 수분 +14점 상승 추세", source: "auto", dataCount: 25, minRequired: 14 },
  { factor: "측정 시간대", icon: "🕐", corr: 0.31, dir: "+", insight: "오전 측정 시 점수가 평균 +2점 높은 경향", source: "auto", dataCount: 60, minRequired: 14 },
  { factor: "수면 시간", icon: "😴", corr: 0.72, dir: "+", insight: "7시간 이상 수면 시 종합 점수 평균 +6점", source: "manual", dataCount: 15, minRequired: 14 },
  { factor: "음주", icon: "🍺", corr: 0.61, dir: "-", insight: "음주 다음날 종합 점수 평균 -7점 하락", source: "manual", dataCount: 15, minRequired: 14 },
  { factor: "스트레스", icon: "😰", corr: 0.38, dir: "-", insight: "데이터 수집 중...", source: "manual", dataCount: 15, minRequired: 21 },
];

function MiniChart({ data, h = 50, color = "#89cef5", markers = [], products = [] }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data) + 3, min = Math.min(...data) - 3;
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v - min) / range) * 80 - 10}`).join(" ");
  const uid = `c${(Math.random() * 1e5 | 0)}`;
  return (
    <svg width="100%" height={h} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id={`${uid}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {products.map((p, i) => {
        const x = ((p.startDay - 1) / (data.length - 1)) * 100;
        return <line key={i} x1={x} y1="0" x2={x} y2="100" stroke={p.color} strokeWidth="0.8" strokeDasharray="2,2" opacity="0.5" vectorEffect="non-scaling-stroke" />;
      })}
      <polygon points={`0,100 ${pts} 100,100`} fill={`url(#${uid}f)`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {markers.map((m, i) => <circle key={i} cx={(m.day / (data.length - 1)) * 100} cy="8" r="3" fill="#f87171" opacity="0.8" />)}
    </svg>
  );
}

function Bar({ value, max = 1, color = "#89cef5", h = 4 }) {
  return (
    <div style={{ height: h, borderRadius: h / 2, background: 'var(--bar-track)', overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, Math.abs(value / max) * 100)}%`, height: "100%", borderRadius: h / 2, background: color, transition: "width 0.8s ease-out" }} />
    </div>
  );
}

function QuickSlider({ icon, label, min, max, step, def, unit, color }) {
  const [val, setVal] = useState(def);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "8px 0" }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', width: 30, flexShrink: 0 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={val}
        onChange={e => setVal(Number(e.target.value))}
        style={{ flex: 1, accentColor: color }}
      />
      <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'var(--font-display)', width: 36, textAlign: "right" }}>
        {val}{unit}
      </span>
    </div>
  );
}

// MetricBar — matches actual App.jsx MetricBar pattern
function MockMetricBar({ label, value, unit = '점', icon, color, description }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 12px', borderRadius: 14,
      cursor: 'pointer',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color, fontFamily: 'var(--font-display)' }}>{value}{unit}</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'var(--bar-track)', overflow: 'hidden' }}>
          <div style={{ width: `${value}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 1s ease-out' }} />
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{description}</div>
      </div>
    </div>
  );
}


export default function DiaryMockup() {
  const [screen, setScreen] = useState("result");
  const [conditionOpen, setConditionOpen] = useState(false);
  const [conditionSaved, setConditionSaved] = useState(false);
  const [activeMetric, setActiveMetric] = useState("overallScore");
  const [historyMode, setHistoryMode] = useState("mission");
  const [alcoholVal, setAlcoholVal] = useState(0);
  const [stressVal, setStressVal] = useState(2);

  const drinkDays = CONDITIONS.filter(c => c.alcohol > 0).map(c => ({ day: c.day - 1 }));
  const chartData = RECORDS.map(r => r[activeMetric]);
  const latestRecord = RECORDS[RECORDS.length - 1];

  const accentColor = '#aed8f7';

  return (
    <div className="app-container">
      <GlobalStyles />

      {/* ─── Mockup screen switcher (목업 확인용 토글) ─── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '8px 16px', display: 'flex', gap: 6,
        background: 'var(--bg-modal)', backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ fontSize: 10, color: '#888', alignSelf: 'center', marginRight: 4 }}>MOCKUP</div>
        {[
          { id: "result", label: "결과 페이지" },
          { id: "history", label: "기록 탭" },
        ].map(t => (
          <button key={t.id}
            onClick={() => { setScreen(t.id); if (t.id === "history") setHistoryMode("insight"); }}
            style={{
              flex: 1, padding: '7px 6px', borderRadius: 8,
              border: screen === t.id ? '1.5px solid rgba(240,144,112,0.4)' : '1.5px solid rgba(255,255,255,0.1)',
              background: screen === t.id ? 'rgba(240,144,112,0.15)' : 'transparent',
              color: screen === t.id ? '#89cef5' : '#666',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════
          RESULT PAGE — 실제 App.jsx 결과 화면 구조 그대로
          Photo Hero → Bottom Sheet → 각 섹션
          ═══════════════════════════════════════════════════════ */}
      {screen === "result" && (
        <div style={{ minHeight: '100dvh', background: 'var(--bg-secondary)', paddingTop: 44 }}>

          {/* ── Photo Hero ── */}
          <div style={{
            position: 'relative', width: '100%', height: 430,
            background: 'linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-secondary) 60%, var(--bg-secondary) 100%)',
            overflow: 'hidden',
          }}>
            {/* Nav buttons */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              padding: '48px 20px 0', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center', zIndex: 10,
              animation: 'fadeUp 0.5s ease-out',
            }}>
              <button style={{
                width: 42, height: 42, borderRadius: '50%',
                background: 'rgba(240,144,112,0.9)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'none',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>
              <button style={{
                width: 42, height: 42, borderRadius: '50%',
                background: 'rgba(240,144,112,0.9)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'none',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              </button>
            </div>

            {/* Face photo placeholder */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
              <div style={{
                width: '100%', height: '100%',
                background: 'linear-gradient(180deg, #1a1028 0%, #12101a 50%, #08080c 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ fontSize: 80, opacity: 0.15 }}>👤</div>
              </div>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.3))' }} />
            </div>

            {/* Floating metric labels */}
            {[
              { text: '유분존: ', val: '58%', c: '#4ecb71', pos: { left: 12, top: 148 } },
              { text: '수분: ', val: '정상', c: '#4ecb71', pos: { left: 12, bottom: 80 } },
              { text: '트러블: ', val: '2개', c: '#4ecb71', pos: { right: 12, bottom: 110 } },
            ].map((l, i) => (
              <div key={i} style={{
                position: 'absolute', ...l.pos, zIndex: 8,
                background: 'var(--float-pill-bg)', backdropFilter: 'var(--card-backdrop)', WebkitBackdropFilter: 'var(--card-backdrop)',
                borderRadius: 50, padding: '7px 16px',
                boxShadow: 'none',
                animation: `popIn 0.5s ease-out ${0.8 + i * 0.12}s both`,
              }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {l.text}<span style={{ color: l.c, fontWeight: 600 }}>{l.val}</span>
                </span>
              </div>
            ))}
          </div>

          {/* ── Bottom Sheet ── */}
          <div style={{
            position: 'relative',
            background: 'linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
            borderRadius: '24px 24px 0 0',
            marginTop: -28, padding: '0 22px 28px', zIndex: 5,
            boxShadow: 'none',
            animation: 'slideUp 0.6s ease-out 0.4s both',
          }}>
            {/* Handle bar */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 20px' }}>
              <div style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--border-subtle)' }} />
            </div>

            {/* ── Header: 피부 컨디션 (App.jsx dark mode 동일) ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 18, animation: 'fadeUp 0.5s ease-out 0.6s both',
            }}>
              <div>
                <span style={{ fontSize: 12, color: accentColor, fontWeight: 600, letterSpacing: 0.3 }}>분석 완료</span>
                <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0 4px', letterSpacing: -0.3 }}>피부 컨디션</h2>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 300 }}>
                  2026년 3월 11일 · 오전 9:41
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, animation: 'popIn 0.5s ease-out 0.8s both' }}>
                {/* Skin Age card */}
                <div style={{
                  width: 66, height: 72, borderRadius: 14,
                  background: 'var(--bg-card)', backdropFilter: 'var(--card-backdrop)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  boxShadow: 'none',
                }}>
                  <span style={{ fontSize: 24, fontWeight: 650, color: accentColor, lineHeight: 1, fontFamily: 'var(--font-display)' }}>33</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>피부나이</span>
                  <span style={{ fontSize: 8, color: '#89cef5', fontWeight: 600, marginTop: 1 }}>측정값</span>
                </div>
                {/* Overall Score card with gauge */}
                <div style={{
                  width: 66, height: 72, borderRadius: 14,
                  background: 'var(--bg-card)', backdropFilter: 'var(--card-backdrop)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  boxShadow: 'none',
                  position: 'relative',
                }}>
                  <svg width={62} height={62} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
                    <defs>
                      <linearGradient id="miniGauge" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#89cef5" />
                        <stop offset="100%" stopColor={accentColor} />
                      </linearGradient>
                    </defs>
                    <circle cx={31} cy={31} r={25} fill="none" stroke="var(--border-subtle)" strokeWidth={4} />
                    <circle cx={31} cy={31} r={25} fill="none" stroke="url(#miniGauge)" strokeWidth={4}
                      strokeDasharray={157} strokeDashoffset={157 - (78 / 100) * 157}
                      strokeLinecap="round" />
                  </svg>
                  <span style={{ fontSize: 24, fontWeight: 650, color: accentColor, lineHeight: 1, fontFamily: 'var(--font-display)', zIndex: 1 }}>78</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 500, marginTop: 1, zIndex: 1 }}>종합</span>
                  <span style={{ fontSize: 8, fontWeight: 700, color: '#4ecb71', zIndex: 1 }}>+3</span>
                </div>
              </div>
            </div>

            {/* ── Save & Share (App.jsx 동일) ── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, animation: 'fadeUp 0.5s ease-out 0.7s both' }}>
              <button style={{
                flex: 1, padding: '12px 0', borderRadius: 'var(--btn-radius)', border: 'none',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                background: 'rgba(74,222,128,0.15)', color: '#89cef5',
              }}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><CheckIcon size={14} /></span> 저장 완료</button>
              <button style={{
                padding: '12px 20px', borderRadius: 'var(--btn-radius)', fontFamily: 'inherit',
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                backdropFilter: 'var(--card-backdrop)',
                color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>📤 공유</button>
            </div>

            {/* ── 오늘의 피부 컨디션 (App.jsx conditionBriefing 동일) ── */}
            <div className="glass-card" style={{
              animation: 'fadeUp 0.5s ease-out 0.88s both',
              border: `1px solid ${accentColor}4d`,
              background: `linear-gradient(135deg, ${accentColor}0f, ${accentColor}0a)`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: accentColor }}>오늘의 피부 컨디션</span>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: `${accentColor}26`, border: `1px solid ${accentColor}4d` }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: accentColor, fontFamily: 'var(--font-display)' }}>A</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: accentColor }}>78점</span>
                </div>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0 }}>
                전체적으로 안정적이에요. 수분과 피부톤이 개선되고 있어요. 모공 점수만 소폭 하락했는데, 꾸준한 관리로 충분히 회복할 수 있어요.
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'rgba(78,203,113,0.1)', color: '#4ecb71' }}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><DropletIcon size={12} /></span> 수분 +3점</span>
                <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'rgba(78,203,113,0.1)', color: '#4ecb71' }}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><SparkleIcon size={12} /></span> 피부톤 +2점</span>
                <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'rgba(240,160,80,0.1)', color: '#f0a050' }}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><MicroscopeIcon size={12} /></span> 모공 -1점</span>
              </div>
            </div>

            {/* ══════════════════════════════════════════════
                ★★★ NEW: 접이식 컨디션 기록 카드 ★★★
                컨디션 브리핑 바로 아래, AI 분석 바로 위에 삽입
                ══════════════════════════════════════════════ */}
            <div className="glass-card" style={{
              padding: 0, overflow: 'hidden',
              background: conditionSaved ? 'rgba(137,206,245,0.05)' : undefined,
              border: conditionSaved ? '1px solid rgba(137,206,245,0.15)' : undefined,
              transition: 'all 0.3s ease',
              animation: 'fadeUp 0.5s ease-out 0.92s both',
            }}>
              {/* Header */}
              <div
                onClick={() => { if (!conditionSaved) setConditionOpen(!conditionOpen); }}
                style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{conditionSaved ? <CheckIcon size={16} /> : <MemoIcon size={16} />}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: conditionSaved ? '#89cef5' : 'var(--text-primary)' }}>
                      {conditionSaved ? "오늘 컨디션 기록 완료" : "오늘 컨디션도 기록할래요?"}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                      {conditionSaved ? "기록이 분석에 반영될 거예요" : "기록하면 더 정확한 피부 인사이트를 받아요"}
                    </div>
                  </div>
                </div>
                {!conditionSaved && (
                  <span style={{
                    fontSize: 14, color: 'var(--text-dim)',
                    transform: conditionOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease', display: 'inline-block',
                  }}>▾</span>
                )}
              </div>

              {/* Expanded content */}
              {conditionOpen && !conditionSaved && (
                <div style={{ padding: '0 18px 18px' }}>
                  <div style={{ height: 1, background: 'var(--border-separator)', marginBottom: 14 }} />

                  {/* Auto collected tags */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                    {[
                      { icon: "🌤", label: "습도 52%" },
                      { icon: "🌡", label: "18°C" },
                      { icon: "✅", label: `루틴 ${latestRecord.routineRate}%` },
                      { icon: "🧴", label: "제품 2개 사용 중" },
                    ].map((tag, i) => (
                      <div key={i} style={{
                        padding: '4px 10px', borderRadius: 8,
                        background: 'rgba(137,206,245,0.08)', border: '1px solid rgba(137,206,245,0.12)',
                        fontSize: 11, color: '#89cef5', display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        {tag.icon} {tag.label}
                        <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>자동</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, letterSpacing: 0.3 }}>
                    아래 항목은 선택이에요 (기록하면 분석이 더 풍부해져요)
                  </div>

                  <QuickSlider icon="😴" label="수면" min={3} max={10} step={0.5} def={7} unit="h" color="#89cef5" />

                  {/* Alcohol */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '8px 0' }}>
                    <span style={{ fontSize: 16 }}>🍺</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', flex: 1 }}>어제 음주</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {["없음", "가볍게", "많이"].map((opt, i) => (
                        <button key={i} onClick={() => setAlcoholVal(i)} style={{
                          padding: '6px 12px', borderRadius: 10, border: 'none',
                          background: alcoholVal === i ? (i === 0 ? 'rgba(137,206,245,0.12)' : 'rgba(248,113,113,0.12)') : 'var(--bg-input)',
                          color: alcoholVal === i ? (i === 0 ? '#89cef5' : '#f87171') : 'var(--text-dim)',
                          fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        }}>{opt}</button>
                      ))}
                    </div>
                  </div>

                  {/* Stress */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '8px 0' }}>
                    <span style={{ fontSize: 16 }}>😰</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', flex: 1 }}>스트레스</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <div key={n} onClick={() => setStressVal(n)} style={{
                          width: 30, height: 30, borderRadius: 10,
                          background: n <= stressVal ? 'rgba(240,144,112,0.12)' : 'var(--bg-input)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          color: n <= stressVal ? 'var(--accent-primary)' : 'var(--text-dim)',
                          border: n === stressVal ? '1.5px solid rgba(240,144,112,0.3)' : '1.5px solid transparent',
                          transition: 'all 0.15s',
                        }}>{n}</div>
                      ))}
                    </div>
                  </div>

                  <button onClick={() => { setConditionSaved(true); setConditionOpen(false); }} className="btn-primary">
                    기록 저장
                  </button>
                  <button onClick={() => setConditionOpen(false)} className="btn-ghost" style={{ marginTop: 8 }}>
                    건너뛰기
                  </button>
                </div>
              )}

              {/* Saved tags */}
              {conditionSaved && (
                <div style={{ padding: '0 18px 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {["😴 7h", "🍺 없음", "😰 2/5"].map((t, i) => (
                    <span key={i} style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 20,
                      background: 'var(--bg-input)', color: 'var(--text-secondary)',
                      border: '1px solid var(--border-light)',
                    }}>{t}</span>
                  ))}
                  <span style={{
                    padding: '4px 10px', borderRadius: 20,
                    background: 'rgba(137,206,245,0.1)', fontSize: 11, color: '#89cef5', fontWeight: 600,
                  }}>+ 자동 4개</span>
                </div>
              )}
            </div>
            {/* ══════════════════════════════════════════════
                ★★★ END: 접이식 컨디션 기록 카드 ★★★
                ══════════════════════════════════════════════ */}

            {/* ── AI Analysis (App.jsx 동일) ── */}
            <div className="glass-card" style={{ animation: 'fadeUp 0.5s ease-out 0.9s both', boxShadow: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 14 }}>🧠</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: accentColor }}>전체 피부 분석</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, margin: 0 }}>
                수분 지표가 지속적으로 상승하고 있어요. 코스알엑스 에센스 사용 이후 수분 흡수력이 좋아진 것으로 보여요. 모공 점수가 소폭 하락했지만 계절 영향일 수 있어요.
              </p>
              <div style={{
                marginTop: 14, padding: '12px 14px', borderRadius: 12,
                background: 'var(--bg-card)', border: '1px solid var(--border-light)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>지난 측정 대비 변화</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>수분·피부톤 개선, 모공은 조금만 신경 쓰면 돼요</div>
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 11, color: '#4ecb71', fontWeight: 600, marginBottom: 6 }}>개선됨</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'rgba(78,203,113,0.1)', color: '#4ecb71' }}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><DropletIcon size={12} /></span> 수분 +3점</span>
                    <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'rgba(78,203,113,0.1)', color: '#4ecb71' }}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><SparkleIcon size={12} /></span> 피부톤 +2점</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#f0a050', fontWeight: 600, marginBottom: 6 }}>케어 포인트</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'rgba(240,160,80,0.1)', color: '#f0a050' }}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><MicroscopeIcon size={12} /></span> 모공 -1점</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── GROUP 1: 컨디션 지표 (App.jsx MetricBar 패턴) ── */}
            <div className="glass-card" style={{ padding: '18px 10px', animation: 'fadeUp 0.5s ease-out 1.0s both' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, paddingLeft: 8, color: 'var(--text-primary)' }}>
                컨디션 지표 <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>일상 관리 포인트</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', paddingLeft: 8, marginBottom: 14 }}>탭하면 과학적 근거</div>
              <MockMetricBar label="수분도" value={75} unit="%" icon="💧" color="#A8DEFF" description="정상 범위" />
              <MockMetricBar label="유분" value={58} unit="%" icon="🫧" color="#F0E0A8" description="균형 상태" />
              <MockMetricBar label="피부톤" value={68} icon="✨" color="#FFE082" description="색소 관리 추천" />
              <MockMetricBar label="트러블" value={83} icon="🎯" color="#FFB0B0" description="2개 | 깨끗" />
              <MockMetricBar label="다크서클" value={72} icon="👁️" color="#C8B8E8" description="눈 밑 밝음" />
            </div>

            {/* ── GROUP 2: 노화 지표 ── */}
            <div className="glass-card" style={{ padding: '18px 10px', animation: 'fadeUp 0.5s ease-out 1.1s both' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, paddingLeft: 8, color: 'var(--text-primary)' }}>
                노화 지표 <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>피부 나이에 큰 영향</span>
              </div>
              <MockMetricBar label="피부결" value={80} icon="🧴" color="#FFB0C8" description="매끈한 피부" />
              <MockMetricBar label="탄력" value={72} icon="💎" color="#FFD080" description="턱선 선명" />
              <MockMetricBar label="주름" value={70} icon="📐" color="#F5D0B8" description="매끄러운 피부" />
              <MockMetricBar label="모공" value={65} icon="🔬" color="#E8D8C8" description="모공 축소 관리" />
              <MockMetricBar label="색소" value={74} icon="🎨" color="#C0A890" description="맑은 피부" />
            </div>

            {/* ── CTA buttons (App.jsx 동일) ── */}
            <button style={{
              width: '100%', padding: '14px 0', borderRadius: 'var(--btn-radius)', border: 'none',
              background: 'linear-gradient(135deg, rgba(240,144,112,0.12), rgba(240,144,112,0.12))',
              backdropFilter: 'var(--card-backdrop)',
              color: '#aed8f7', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              marginBottom: 14, boxShadow: 'none',
              animation: 'fadeUp 0.5s ease-out 1.25s both',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aed8f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              루아에게 물어보기
            </button>

            <button style={{
              width: '100%', padding: 14, borderRadius: 'var(--btn-radius)', fontFamily: 'inherit',
              background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
              backdropFilter: 'var(--card-backdrop)',
              color: 'var(--text-secondary)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              animation: 'fadeUp 0.5s ease-out 1.4s both',
            }}>🔄 다시 측정하기</button>

            <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 14, marginBottom: 0 }}>
              AI 추정치이며 의료 진단이 아닙니다 · 루아 © 2026
            </p>
            <div style={{ height: 80 }} />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          HISTORY PAGE — 실제 HistoryPage.jsx 구조 그대로
          segment-control 3탭 + 새 "인사이트" 탭 추가
          ═══════════════════════════════════════════════════════ */}
      {screen === "history" && (
        <div style={{ paddingBottom: 40, paddingTop: 44 }}>
          {/* Mode Toggle — 실제 HistoryPage segment-control 동일 */}
          <div style={{ padding: '12px 20px 16px' }}>
            <div className="segment-control">
              <button className={`segment-btn${historyMode === 'mission' ? ' active' : ''}`}
                onClick={() => setHistoryMode('mission')}>미션</button>
              <button className={`segment-btn${historyMode === 'insights' ? ' active' : ''}`}
                onClick={() => setHistoryMode('insights')}>분석</button>
              <button className={`segment-btn${historyMode === 'gallery' ? ' active' : ''}`}
                onClick={() => setHistoryMode('gallery')}>앨범</button>
              <button className={`segment-btn${historyMode === 'insight' ? ' active' : ''}`}
                onClick={() => setHistoryMode('insight')}>인사이트</button>
            </div>
          </div>

          {/* ── 기존 3탭: placeholder ── */}
          {historyMode !== "insight" && (
            <div style={{ padding: '0 20px' }}>
              <div className="glass-card" style={{ textAlign: 'center', padding: '50px 20px' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>
                  {historyMode === "mission" ? <TargetIcon size={40} /> : historyMode === "insights" ? <ChartIcon size={40} /> : <CameraIcon size={40} />}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {historyMode === "mission" ? "미션" : historyMode === "insights" ? "분석" : "앨범"}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6 }}>
                  기존 HistoryPage 콘텐츠 (변경 없음)
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════
              ★ NEW: 인사이트 탭 콘텐츠
              ═════════════════════════════════════════ */}
          {historyMode === "insight" && (
            <div style={{ padding: '0 20px' }}>

              {/* 데이터 수집 현황 */}
              <div className="glass-card" style={{ animation: 'breatheIn 0.6s ease both' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>데이터 수집 현황</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { label: "피부 측정", count: 60, icon: "🪞", status: "good" },
                    { label: "날씨", count: 60, icon: "🌤", status: "good" },
                    { label: "루틴 완료", count: 58, icon: "✅", status: "good" },
                    { label: "제품 기록", count: 3, icon: "🧴", status: "good" },
                    { label: "수면 기록", count: 15, icon: "😴", status: "partial" },
                    { label: "음주 기록", count: 15, icon: "🍺", status: "partial" },
                    { label: "스트레스", count: 15, icon: "😰", status: "building" },
                  ].map((d, i) => (
                    <div key={i} style={{
                      padding: '5px 10px', borderRadius: 8,
                      background: d.status === "good" ? 'rgba(137,206,245,0.08)' : d.status === "partial" ? 'rgba(240,144,112,0.08)' : 'var(--bg-input)',
                      border: `1px solid ${d.status === "good" ? 'rgba(137,206,245,0.15)' : d.status === "partial" ? 'rgba(240,144,112,0.15)' : 'var(--border-light)'}`,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <span style={{ fontSize: 12 }}>{d.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: d.status === "good" ? '#89cef5' : d.status === "partial" ? 'var(--accent-primary)' : 'var(--text-dim)' }}>{d.count}일</span>
                      {d.status === "good" && <span style={{ fontSize: 8, color: '#89cef5', fontWeight: 600 }}>자동</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* 피부 변화 추이 */}
              <div className="glass-card" style={{ animation: 'breatheIn 0.6s ease 0.1s both' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>피부 변화 추이</span>
                  <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>🔴 음주 · --- 제품 시작</span>
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                  {[
                    { id: "overallScore", label: "종합" },
                    { id: "moisture", label: "수분" },
                    { id: "elasticityScore", label: "탄력" },
                    { id: "poreScore", label: "모공" },
                  ].map(m => (
                    <button key={m.id} onClick={() => setActiveMetric(m.id)} style={{
                      padding: '5px 12px', borderRadius: 10, border: 'none',
                      background: activeMetric === m.id ? 'rgba(240,144,112,0.15)' : 'var(--bg-input)',
                      color: activeMetric === m.id ? 'var(--accent-primary)' : 'var(--text-dim)',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}>{m.label}</button>
                  ))}
                </div>
                <MiniChart data={chartData} h={80} color="var(--accent-primary)" markers={drinkDays} products={PRODUCTS} />
                <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                  {PRODUCTS.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color, border: `1px dashed ${p.color}` }} />
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.name.slice(0, 8)}</span>
                      {!p.endDay && <span style={{ fontSize: 8, color: '#89cef5', fontWeight: 600 }}>사용 중</span>}
                      {p.endDay && <span style={{ fontSize: 8, color: '#f87171', fontWeight: 600 }}>중단</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* 상관관계 */}
              <div className="glass-card" style={{ animation: 'breatheIn 0.6s ease 0.2s both' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>내 피부에 영향을 주는 것들</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 14 }}>60일 데이터 기반 · 상관관계 순위</div>

                {CORRELATIONS.map((c, idx) => {
                  const hasEnoughData = c.source === "auto" || c.dataCount >= (c.minRequired || 14);
                  return (
                    <div key={idx} style={{
                      padding: '12px 14px', marginBottom: 6, borderRadius: 16,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      opacity: hasEnoughData ? 1 : 0.5,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 10,
                          background: c.dir === "+" ? 'rgba(137,206,245,0.1)' : 'rgba(248,113,113,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, flexShrink: 0,
                        }}>{c.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.factor}</span>
                            {c.source === "auto" && <span style={{ fontSize: 8, color: '#89cef5', background: 'rgba(137,206,245,0.1)', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>자동</span>}
                            {c.source === "manual" && <span style={{ fontSize: 8, color: 'var(--accent-primary)', background: 'rgba(240,144,112,0.1)', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>수동</span>}
                          </div>
                        </div>
                        {hasEnoughData ? (
                          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-display)', color: c.dir === "+" ? '#89cef5' : '#f87171' }}>
                            {c.dir}{Math.round(c.corr * 100)}%
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{c.dataCount}/{c.minRequired}일</span>
                        )}
                      </div>
                      <Bar value={hasEnoughData ? c.corr : c.dataCount / (c.minRequired || 14)} max={1} color={hasEnoughData ? (c.dir === "+" ? '#89cef5' : '#f87171') : 'var(--text-dim)'} h={3} />
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>
                        {hasEnoughData ? c.insight : `데이터 수집 중... ${c.minRequired - c.dataCount}일 더 기록하면 분석이 시작돼요`}
                      </div>
                    </div>
                  );
                })}

                <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10, background: 'var(--bg-card)', textAlign: 'center', fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  상관관계는 인과관계가 아니에요 · 여러 요인이 복합적으로 작용해요
                </div>
              </div>

              {/* AI 종합 분석 */}
              <div className="glass-card" style={{
                background: 'linear-gradient(135deg, rgba(240,144,112,0.08), rgba(240,144,112,0.03))',
                border: '1px solid rgba(240,144,112,0.15)',
                animation: 'breatheIn 0.6s ease 0.3s both',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 14 }}>🤖</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-primary)' }}>AI 종합 분석</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                  60일간의 데이터를 종합하면, <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>루틴 완료율</span>과 <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>습도</span>가 자동 수집 데이터 중 가장 높은 상관관계를 보여요.
                  <br /><br />
                  최근 15일간 수동 기록 결과, <span style={{ color: '#89cef5', fontWeight: 600 }}>수면 시간</span>이 가장 강한 양의 상관관계(+72%)를 보여요. 다만 아직 15일분이라 더 쌓이면 정확도가 올라가요.
                  <br /><br />
                  <span style={{ color: '#89cef5', fontWeight: 600 }}>코스알엑스 에센스</span> 사용 시작(35일째) 이후 수분이 상승 중이지만, 같은 기간 습도도 올라갔기 때문에 제품 단독 효과는 확정하기 어려워요.
                </div>
                <div style={{
                  marginTop: 14, padding: '12px 14px', borderRadius: 12,
                  background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)', marginBottom: 4 }}>💡 이번 주 추천</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    루틴 완료율 80% 이상 유지 + 수면 7시간 이상 + 에센스 계속 사용
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab Bar (Mock) — 실제 TabBar 위치 ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'var(--tab-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--tab-border)',
        boxShadow: 'none',
        padding: '8px 0 env(safe-area-inset-bottom, 0)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '4px 8px' }}>
          {[
            { icon: "🏠", label: "홈", active: true },
            { icon: "📊", label: "기록", active: false },
            { icon: "", label: "", center: true },
            { icon: "💬", label: "상담", active: false },
            { icon: "👤", label: "마이", active: false },
          ].map((tab, i) => tab.center ? (
            <div key={i} style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'var(--btn-primary-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: -20, boxShadow: 'none',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="3" /><path d="M5 12h14M12 5v14" />
              </svg>
            </div>
          ) : (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              opacity: tab.active ? 1 : 0.5, cursor: 'pointer',
            }}>
              <span style={{ fontSize: 20 }}>{tab.icon}</span>
              <span style={{ fontSize: 10, color: tab.active ? 'var(--accent-primary)' : 'var(--tab-inactive)' }}>{tab.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
