import { useState, useRef, useEffect } from 'react';
import { SCIENCE } from '../data/ScienceData';
import { RulerIcon, GearIcon, BooksIcon, DropletIcon, BubbleIcon, BalanceIcon, LotionIcon, TargetIcon, RednessIcon, PaletteIcon, SparkleIcon, DiamondIcon, MicroscopeIcon, EyeIcon } from './icons/PastelIcons';

/* ===== Animated Number Counter ===== */
export function AnimatedNumber({ target, suffix = '', duration = 1200 }) {
  const [current, setCurrent] = useState(0);
  const raf = useRef();

  useEffect(() => {
    const start = Date.now();
    const animate = () => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCurrent(Math.round(target * eased));
      if (progress < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return <span>{current}{suffix}</span>;
}

/* ===== Score Ring (circular progress) ===== */
export function ScoreRing({ score, size = 110, label = '종합점수' }) {
  const radius = (size - 12) / 2;
  const circumference = radius * 2 * Math.PI;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    setTimeout(() => setOffset(circumference - (score / 100) * circumference), 300);
  }, [score, circumference]);

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <defs>
          <linearGradient id="scoreRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#81E4BD"/>
            <stop offset="50%" stopColor="#81E4BD"/>
            <stop offset="100%" stopColor="#ADEBB3"/>
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-light)" strokeWidth={11} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="url(#scoreRingGrad)" strokeWidth={11} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div style={{ fontSize: size * 0.26, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
          <AnimatedNumber target={score} />
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

/* ===== Metric Bar ===== */
export function MetricBar({ label, value, unit = '%', color, icon, description, onClick, delay = 0, diff = null }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(value), 200 + delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return (
    <div
      style={{
        marginBottom: 8,
        padding: '12px 0',
        borderRadius: 14,
        border: 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span onClick={onClick} style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: onClick ? 'pointer' : 'default' }}>{icon} {label}</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {diff != null && diff !== 0 && (
            <span style={{
              fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 8,
              background: diff > 0 ? 'rgba(144,196,248,0.15)' : 'rgba(216,168,240,0.15)',
              color: diff > 0 ? '#70B0F0' : '#C090E0',
            }}>{diff > 0 ? '↑' : '↓'}{Math.abs(Math.round(diff))}</span>
          )}
          <AnimatedNumber target={value} suffix={unit} />
        </span>
      </div>
      {description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{description}</div>}
      <div className="metric-bar-track" style={{ position: 'relative' }}>
        <div
          className="metric-bar-fill"
          style={{
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            width: `${width}%`,
          }}
        />
      </div>
    </div>
  );
}

/* ===== Tag ===== */
export function Tag({ children, primary = false }) {
  return (
    <span className={`tag ${primary ? 'tag-primary' : 'tag-secondary'}`}>
      {children}
    </span>
  );
}

/* ===== Detail Page ===== */
export function DetailPage({ metricKey, value, onBack }) {
  const data = SCIENCE[metricKey];
  if (!data) return null;

  const unitMap = {
    skinAge: '세', moisture: '%', skinTone: '점', trouble: '개', oilBalance: '%', oilMoistureBalance: '점', redness: '점'
  };

  const metricIconMap = {
    moisture: <DropletIcon size={22} />, oilBalance: <BubbleIcon size={22} />, oilMoistureBalance: <BalanceIcon size={22} />,
    skinTone: <LotionIcon size={22} />, redness: <TargetIcon size={22} />, pigmentation: <PaletteIcon size={22} />,
    trouble: <RednessIcon size={22} />, texture: <SparkleIcon size={22} />, elasticity: <DiamondIcon size={22} />,
    wrinkles: <RulerIcon size={22} />, pores: <MicroscopeIcon size={22} />, darkCircles: <EyeIcon size={22} />,
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 20px' }}>
        <div onClick={onBack} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 16 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          {metricIconMap[metricKey]}
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'rgba(0,0,0,0.8)', margin: 0 }}>
            {data.title}
          </h1>
          {value != null && (
            <span style={{ fontSize: 22, fontWeight: 600, color: 'rgba(0,0,0,0.8)', marginLeft: 'auto' }}>
              {value}<span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(0,0,0,0.3)', marginLeft: 3 }}>{unitMap[metricKey]}</span>
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.6)', letterSpacing: 0.5, marginBottom: 10, paddingLeft: 32 }}>
          {data.subtitle}
        </div>
        <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)', lineHeight: 1.7, margin: 0 }}>{data.hero}</p>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 16px' }}>
        {/* Methodology + Analysis Steps */}
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'rgba(0,0,0,0.8)' }}>측정 원리</div>
          <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)', lineHeight: 1.85, whiteSpace: 'pre-line', marginBottom: 24 }}>{data.methodology}</p>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'rgba(0,0,0,0.8)' }}>분석 과정</div>
          {data.steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 11, marginBottom: i < data.steps.length - 1 ? 18 : 0 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 8, background: 'rgba(255,255,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#000', fontSize: 13, fontWeight: 600, flexShrink: 0,
              }}>{i + 1}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(0,0,0,0.6)', marginBottom: 3 }}>{step.title}</div>
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', lineHeight: 1.65 }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Score Ranges */}
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: 'rgba(0,0,0,0.8)' }}>결과 해석</div>
          {data.ranges.map((r, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', marginBottom: 5, borderRadius: 12,
              background: `${r.color}08`,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: r.color, minWidth: 80 }}>{r.range}</span>
              <span style={{ fontSize: 11, color: '#fff', background: r.color, padding: '2px 10px', borderRadius: 8, fontWeight: 500 }}>{r.label}</span>
              <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.4)', marginLeft: 'auto' }}>{r.description}</span>
            </div>
          ))}
        </div>

        {/* Scientific References */}
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: 'rgba(0,0,0,0.8)' }}>과학적 근거</div>
          {data.references.map((ref, i) => (
            <div key={i} style={{
              marginBottom: i < data.references.length - 1 ? 10 : 0,
              borderRadius: 5, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden',
            }}>
              <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.1)', fontWeight: 600, fontSize: 12, color: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{ref.name}</div>
              <div style={{ padding: '7px 10px', fontSize: 12, color: 'rgba(0,0,0,0.4)', lineHeight: 1.5, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{ref.description}</div>
              <div style={{ padding: '7px 10px', fontSize: 11, color: 'rgba(0,0,0,0.4)', fontStyle: 'italic', lineHeight: 1.5 }}>{ref.source}</div>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div style={{ padding: 14, background: 'var(--bg-card)', borderRadius: 14, marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', lineHeight: 1.6 }}>
             루아 AI 비전 기반 추정치이며, 의료기기 정밀 측정과 차이가 있습니다.
            정확한 진단은 피부과 전문의와 상담해주세요.
          </p>
        </div>

        <button className="btn-primary" onClick={onBack}>← 돌아가기</button>
      </div>
    </div>
  );
}
