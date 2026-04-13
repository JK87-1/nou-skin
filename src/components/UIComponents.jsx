import { useState, useRef, useEffect } from 'react';
import { SCIENCE } from '../data/ScienceData';
import { RulerIcon, GearIcon, BooksIcon } from './icons/PastelIcons';

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
            <stop offset="0%" stopColor="#89cef5"/>
            <stop offset="50%" stopColor="#89cef5"/>
            <stop offset="100%" stopColor="#aed8f7"/>
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
export function MetricBar({ label, value, unit = '%', color, icon, description, onClick, delay = 0 }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(value), 200 + delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return (
    <div
      onClick={onClick}
      style={{
        marginBottom: 8,
        cursor: onClick ? 'pointer' : 'default',
        padding: '12px 14px',
        borderRadius: 14,
        border: 'none',
        transition: 'background 0.2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>{icon} {label}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
          <AnimatedNumber target={value} suffix={unit} />
          {onClick && <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 5 }}>→</span>}
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
        {width > 0 && (
          <div style={{
            position: 'absolute', top: '50%', left: `${width}%`,
            transform: 'translate(-50%, -50%)',
            width: 3, height: 3, borderRadius: '50%',
            background: 'rgba(255,255,255,0.5)',
            boxShadow: '0 0 3px rgba(255,255,255,0.3)',
            transition: 'left 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: 'none',
          }} />
        )}
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
    skinAge: '세', moisture: '%', skinTone: '점', trouble: '개', oilBalance: '%'
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Hero Header */}
      <div style={{
        background: data.gradient,
        padding: '48px 22px 30px',
        borderRadius: '0 0 32px 32px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 150, height: 150, borderRadius: '50%', background: 'var(--bg-input)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div onClick={onBack} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', marginBottom: 20 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></div>
          <div style={{ fontSize: 40, marginBottom: 10 }}>{data.icon}</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)', marginBottom: 4 }}>
            {data.title}
          </h1>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', letterSpacing: 1, marginBottom: 12 }}>
            {data.subtitle}
          </div>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 1.7 }}>{data.hero}</p>

          {value != null && (
            <div style={{
              marginTop: 16,
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 4,
              background: 'rgba(255,255,255,0.2)',
              borderRadius: 16,
              padding: '8px 20px',
            }}>
              <span style={{ fontSize: 32, fontWeight: 900, color: '#fff', fontFamily: 'var(--font-display)' }}>{value}</span>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>{unitMap[metricKey]}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginLeft: 8 }}>나의 측정값</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 16px' }}>
        {/* Methodology */}
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><RulerIcon size={15} /></span> 측정 원리</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.85, whiteSpace: 'pre-line' }}>{data.methodology}</p>
        </div>

        {/* Analysis Steps */}
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><GearIcon size={15} /></span> 분석 과정</div>
          {data.steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, marginBottom: i < data.steps.length - 1 ? 18 : 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: data.gradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0,
              }}>{i + 1}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{step.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.65 }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Score Ranges */}
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: 'var(--text-primary)' }}>📊 결과 해석</div>
          {data.ranges.map((r, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', marginBottom: 5, borderRadius: 12,
              background: `${r.color}08`,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: r.color, minWidth: 80 }}>{r.range}</span>
              <span style={{ fontSize: 11, color: r.color, background: `${r.color}15`, padding: '2px 10px', borderRadius: 8 }}>{r.label}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{r.description}</span>
            </div>
          ))}
        </div>

        {/* Scientific References */}
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><BooksIcon size={15} /></span> 과학적 근거</div>
          {data.references.map((ref, i) => (
            <div key={i} style={{
              marginBottom: i < data.references.length - 1 ? 14 : 0,
              padding: 14, background: 'var(--bg-card)', borderRadius: 14,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: data.color, marginBottom: 5 }}>{ref.name}</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 8 }}>{ref.description}</p>
              <div style={{
                fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic',
                borderLeft: `3px solid ${data.color}40`, paddingLeft: 10,
              }}>{ref.source}</div>
            </div>
          ))}
        </div>

        {/* Gut-Brain-Skin */}
        <div className="gbs-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🧬</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#aed8f7' }}>장-뇌-피부 축 (Gut-Brain-Skin Axis)</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 10 }}>{data.gutBrainSkin}</p>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>{data.gutBrainSkinSource}</div>
        </div>

        {/* Disclaimer */}
        <div style={{ padding: 14, background: 'var(--bg-card)', borderRadius: 14, marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            ⚠️ 루아 AI 비전 기반 추정치이며, 의료기기 정밀 측정과 차이가 있습니다.
            정확한 진단은 피부과 전문의와 상담해주세요.
          </p>
        </div>

        <button className="btn-primary" onClick={onBack} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>돌아가기</button>
      </div>
    </div>
  );
}
