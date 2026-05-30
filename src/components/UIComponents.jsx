import { useState, useRef, useEffect } from 'react';
import { SCIENCE } from '../data/ScienceData';
import { RulerIcon, GearIcon, BooksIcon, DropletIcon, BubbleIcon, BalanceIcon, LotionIcon, TargetIcon, RednessIcon, PaletteIcon, SparkleIcon, DiamondIcon, MicroscopeIcon, EyeIcon } from './icons/PastelIcons';
import { getProfile } from '../storage/ProfileStorage';
import { getPercentile, bucketLabel } from '../engine/SkinPercentile';

/* ===== Animated Number Counter ===== */
export function AnimatedNumber({ target, suffix = '', duration = 1200, delay = 0 }) {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);
  const raf = useRef();
  const delayTimer = useRef();
  const elRef = useRef();

  useEffect(() => {
    const el = elRef.current;
    if (!el) { setVisible(true); return; }
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    delayTimer.current = setTimeout(() => {
      const start = Date.now();
      const animate = () => {
        const progress = Math.min((Date.now() - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCurrent(Math.round(target * eased));
        if (progress < 1) raf.current = requestAnimationFrame(animate);
      };
      raf.current = requestAnimationFrame(animate);
    }, delay);
    return () => { clearTimeout(delayTimer.current); cancelAnimationFrame(raf.current); };
  }, [target, duration, delay, visible]);

  return <span ref={elRef}>{current}{suffix}</span>;
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
            <stop offset="0%" stopColor="#6598ef"/>
            <stop offset="50%" stopColor="#6598ef"/>
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
              fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 8,
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

/* ===== Detail Accordion ===== */
function DetailAccordion({ title, children, onToggle }) {
  const [open, setOpen] = useState(false);
  const toggle = () => { setOpen(!open); onToggle?.(!open); };
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <button onClick={toggle} style={{
        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0,
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(0,0,0,0.8)' }}>{title}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="2" strokeLinecap="round"
          style={{ transition: 'transform 0.3s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <>
          <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '14px 0' }} />
          <div style={{ animation: 'fadeUp 0.3s ease-out' }}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}

/* ===== Detail Page ===== */
export function DetailPage({ metricKey, value, onBack }) {
  const data = SCIENCE[metricKey];
  const [anyAccordionOpen, setAnyAccordionOpen] = useState(0);
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


  // 또래(연령대) 대비 백분위 — 연령 보정 추정
  const _profile = (() => { try { return getProfile(); } catch { return {}; } })();
  const _age = _profile.birthYear ? (new Date().getFullYear() - parseInt(_profile.birthYear, 10)) : null;
  const _pct = getPercentile(metricKey, value, _age);
  const _peer = bucketLabel(_age, _profile.gender);

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0' }}>
        <div onClick={onBack} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 12 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </div>
        <div style={{ padding: '10px 15px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {metricIconMap[metricKey]}
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'rgba(0,0,0,0.8)', margin: 0 }}>
              {data.title}
            </h1>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)', lineHeight: 1.7, margin: '10px 0 0' }}>{data.hero}</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 16px' }}>
        {/* 1. Score Ranges — 가장 먼저 */}
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: 'rgba(0,0,0,0.8)' }}>결과 해석</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {data.ranges.map((r, i) => (
              <div key={i} style={{
                borderRadius: 12, padding: '12px 10px',
                background: `${r.color}10`,
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <span style={{ fontSize: 10, color: '#fff', background: r.color, padding: '3px 8px', borderRadius: 6, fontWeight: 600, alignSelf: 'flex-start', whiteSpace: 'nowrap' }}>{r.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: r.color, lineHeight: 1.3 }}>{r.range}</span>
                <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(0,0,0,0.4)', lineHeight: 1.5 }}>{r.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Methodology — 아코디언 */}
        <DetailAccordion title="측정 원리" onToggle={(open) => setAnyAccordionOpen(p => p + (open ? 1 : -1))}>
          <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)', lineHeight: 1.85, whiteSpace: 'pre-line', margin: 0 }}>{data.methodology}</p>
        </DetailAccordion>

        {/* 3. Scientific References — 아코디언 */}
        <DetailAccordion title="과학적 근거" onToggle={(open) => setAnyAccordionOpen(p => p + (open ? 1 : -1))}>
          {data.references.map((ref, i) => (
            <div key={i} style={{
              marginBottom: i < data.references.length - 1 ? 10 : 0,
              borderRadius: 5, border: 'none', overflow: 'hidden',
            }}>
              <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.1)', fontWeight: 600, fontSize: 12, color: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{ref.name}</div>
              <div style={{ padding: '7px 10px', fontSize: 12, color: 'rgba(0,0,0,0.4)', lineHeight: 1.5 }}>{ref.description}</div>
              <div style={{ padding: '7px 10px', fontSize: 11, color: 'rgba(0,0,0,0.4)', fontStyle: 'italic', lineHeight: 1.5 }}>{ref.source}</div>
            </div>
          ))}
        </DetailAccordion>

        {/* 4. Disclaimer */}
        <p style={{ fontSize: 10, color: 'rgba(0,0,0,0.25)', lineHeight: 1.5, textAlign: 'center', margin: '0 0 16px', padding: '0 19px' }}>
          피부과 임상 기기(Corneometer, Mexameter 등)의 측정 원리를 컴퓨터 비전으로 구현하였으며, 임상 데이터와의 교차 검증을 통해 정확도를 개선하고 있습니다.
        </p>

        {anyAccordionOpen > 0 && (
          <button onClick={onBack} style={{
            width: '100%', padding: '12px 0', border: 'none', borderRadius: 12,
            background: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.25)',
            fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}>돌아가기</button>
        )}
      </div>
    </div>
  );
}
