/**
 * LUA History Page v2.0
 *
 * Redesigned: compact calendar, trend stats bar, clear photo gallery with hover overlay
 *
 * Sections (top - new design):
 * 1. Page header (Skin Journal)
 * 2. Month navigator + compact calendar
 * 3. Trend stats bar (avg score, change, record days)
 * 4. Photo gallery (3-col grid, score badges, hover overlay)
 *
 * Sections (bottom - preserved from v1):
 * 5. Motivation Card
 * 6. Skin Age Trend Graph
 * 7. Metric Changes
 * 8. Record List
 * 9. Streak & Stats
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  getRecords, getChanges, getTotalChanges, getTimeSeries,
  getMotivation, getNextMeasurementInfo, formatDateFull,
  getAllThumbnailsAsync, saveThumbnail, deleteRecord,
} from '../storage/SkinStorage';
import { AnimatedNumber, ScoreRing, MetricBar } from '../components/UIComponents';
import { getProfile } from '../storage/ProfileStorage';
import AiInsightCard from '../components/AiInsightCard';
import BeforeAfterSlider from '../components/BeforeAfterSlider';
import DailyMission from '../components/DailyMission';
import TossLineChart from '../components/TossLineChart';
import { getProducts, getProductsForMode, getTrackerChecks, toggleTrackerCheck, getTrackerProgress, bulkToggleCheck, deleteProduct } from '../storage/TrackerStorage';
import SwipeableRow from '../components/SwipeableRow';
import { getAllProductThumbs } from '../storage/ImageStore';
import { hapticLight, hapticSelection, hapticMedium } from '../utils/haptics';
// CareRecommendation은 화장대(RoutineTracker)로 이동됨
import { ChartIcon, CameraIcon, MicroscopeIcon, SparkleIcon, DiamondIcon, DropletIcon, RulerIcon, PaletteIcon, LotionIcon, EyeIcon, BubbleIcon, TargetIcon, ClockIcon, LuaMiniIcon } from '../components/icons/PastelIcons';

// ===== MINI LINE GRAPH (Canvas-based, no dependencies) =====
function TrendGraph({ data, color = '#a8c8f8', height = 160, metricKey = 'skinAge', inverse = false, showAllLabels = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const values = data.map(d => d.value);
    const minV = Math.min(...values) - 2;
    const maxV = Math.max(...values) + 2;
    const range = maxV - minV || 1;

    const padL = 36, padR = 16, padT = showAllLabels ? 28 : 20, padB = 32;
    const gW = W - padL - padR;
    const gH = H - padT - padB;

    const getX = (i) => padL + (i / (data.length - 1)) * gW;
    const getY = (v) => padT + (1 - (v - minV) / range) * gH;

    ctx.clearRect(0, 0, W, H);

    // Read CSS variable values for canvas drawing
    const cs = getComputedStyle(document.documentElement);
    const colorGrid = cs.getPropertyValue('--border-light').trim() || 'rgba(255,255,255,0.06)';
    const colorMuted = cs.getPropertyValue('--text-muted').trim() || '#8888a0';
    const colorSecondary = cs.getPropertyValue('--text-secondary').trim() || '#e0e0e8';
    const colorBgCard = cs.getPropertyValue('--bg-card').trim() || 'rgba(255,255,255,0.04)';

    // Grid lines
    ctx.strokeStyle = colorGrid;
    ctx.lineWidth = 1;
    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const y = padT + (i / gridSteps) * gH;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      const val = Math.round(maxV - (i / gridSteps) * range);
      ctx.fillStyle = colorMuted; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(val, padL - 6, y + 3);
    }

    // Gradient fill under line
    const gradient = ctx.createLinearGradient(0, padT, 0, H - padB);
    gradient.addColorStop(0, color + '30');
    gradient.addColorStop(1, color + '05');
    ctx.beginPath();
    ctx.moveTo(getX(0), H - padB);
    data.forEach((d, i) => ctx.lineTo(getX(i), getY(d.value)));
    ctx.lineTo(getX(data.length - 1), H - padB);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    data.forEach((d, i) => {
      if (i === 0) ctx.moveTo(getX(i), getY(d.value));
      else ctx.lineTo(getX(i), getY(d.value));
    });
    ctx.stroke();

    // Points
    data.forEach((d, i) => {
      const x = getX(i), y = getY(d.value);
      ctx.beginPath();
      ctx.arc(x, y, i === data.length - 1 ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = i === data.length - 1 ? color : colorBgCard;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Show value labels above points
      if (showAllLabels || i === data.length - 1) {
        const labelInterval = Math.max(1, Math.ceil(data.length / 8));
        if (!showAllLabels || i % labelInterval === 0 || i === data.length - 1 || i === 0) {
          ctx.fillStyle = colorSecondary;
          ctx.font = 'bold 12px Outfit, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(d.value, x, y - 14);
        }
      }
    });

    // X-axis date labels
    ctx.fillStyle = colorMuted;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const labelInterval = data.length <= 6 ? 1 : Math.ceil(data.length / 6);
    data.forEach((d, i) => {
      if (i % labelInterval === 0 || i === data.length - 1) {
        ctx.fillText(d.label, getX(i), H - padB + 16);
      }
    });

    // Trend arrow (hidden when showAllLabels — shown externally)
    if (!showAllLabels && data.length >= 2) {
      const first = data[0].value, last = data[data.length - 1].value;
      const diff = last - first;
      const improving = inverse ? diff < 0 : diff > 0;
      if (Math.abs(diff) >= 1) {
        ctx.fillStyle = improving ? '#4ade80' : '#f44336';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        const arrow = improving ? '▲' : '▼';
        const text = `${arrow} ${Math.abs(diff)}${inverse ? '세' : '점'}`;
        ctx.fillText(text, padL + 4, padT - 6);
      }
    }

  }, [data, color, height, inverse]);

  if (data.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
        2회 이상 측정하면 그래프가 나타나요 <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><ChartIcon size={13} /></span>
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ width: '100%', height, display: 'block' }} />;
}

// ===== CHANGE INDICATOR =====
function ChangeIndicator({ diff, unit = '점', inverse = false, size = 'normal' }) {
  if (diff === 0 || diff === undefined) return <span style={{ fontSize: size === 'small' ? 10 : 12, color: 'var(--text-muted)' }}>—</span>;
  const improved = inverse ? diff < 0 : diff > 0;
  const color = improved ? '#4ade80' : '#f44336';
  const arrow = improved ? '↑' : '↓';
  const fs = size === 'small' ? 10 : 12;
  return (
    <span style={{ fontSize: fs, fontWeight: 700, color }}>
      {arrow}{Math.abs(diff)}{unit}
    </span>
  );
}

// ===== MAIN HISTORY PAGE =====
export default function HistoryPage({ onBack, onMeasure, onOpenConsult, onAddProduct, initialMode }) {
  const [mode, setMode] = useState(initialMode || 'care');
  const [insightMode, setInsightMode] = useState('timeline');
  const [records, setRecords] = useState([]);
  const [graphMetric, setGraphMetric] = useState('skinAge');
  const [motivation, setMotivation] = useState(null);
  const [changes, setChanges] = useState(null);
  const [totalChanges, setTotalChanges] = useState(null);
  const [nextInfo, setNextInfo] = useState(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [thumbs, setThumbs] = useState({});

  useEffect(() => {
    setRecords(getRecords());
    setMotivation(getMotivation());
    setChanges(getChanges());
    setTotalChanges(getTotalChanges());
    setNextInfo(getNextMeasurementInfo());
    // Load high-res thumbnails from IndexedDB
    getAllThumbnailsAsync().then(setThumbs);
  }, []);

  const graphData = getTimeSeries(graphMetric);
  const graphOptions = [
    { key: 'skinAge', label: '피부나이', color: '#a8c8f8', inverse: true },
    { key: 'overallScore', label: '종합점수', color: '#a8c8f8', inverse: false },
    { key: 'moisture', label: '수분도', color: '#A8DEFF', inverse: false },
    { key: 'wrinkleScore', label: '주름', color: '#F5D0B8', inverse: false },
    { key: 'elasticityScore', label: '탄력', color: '#FFD080', inverse: false },
    { key: 'textureScore', label: '피부결', color: '#FFB0C8', inverse: false },
    { key: 'darkCircleScore', label: '다크서클', color: '#C8B8E8', inverse: false },
  ];
  const currentGraphOption = graphOptions.find(o => o.key === graphMetric) || graphOptions[0];

  // 10개 지표 변화 표시용
  const metricChangeList = changes ? [
    { ...changes.skinAge },
    { ...changes.overallScore },
    { ...changes.moisture },
    { ...changes.skinTone },
    { ...changes.wrinkleScore },
    { ...changes.poreScore },
    { ...changes.elasticityScore },
    { ...changes.pigmentationScore },
    { ...changes.textureScore },
    { ...changes.darkCircleScore },
  ] : [];

  // Trend bar stats (based on calendar month)
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const monthRecords = useMemo(() =>
    records.filter(r => {
      const d = new Date(r.date);
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    }), [records, viewYear, viewMonth]);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const avgScore = monthRecords.length > 0
    ? (monthRecords.reduce((s, r) => s + r.overallScore, 0) / monthRecords.length).toFixed(1) : 0;
  const scoreChange = monthRecords.length >= 2
    ? monthRecords[monthRecords.length - 1].overallScore - monthRecords[0].overallScore : 0;

  // Derive selectedDate for calendar highlighting
  const selectedDate = selectedRecord ? selectedRecord.date : null;

  const handleSelectRecord = (record) => {
    const isSame = selectedRecord && (
      (record.id && selectedRecord.id === record.id) ||
      (!record.id && selectedRecord.date === record.date && selectedRecord.timestamp === record.timestamp)
    );
    if (isSame) {
      setSelectedRecord(null); // toggle off
    } else {
      setSelectedRecord(record);
    }
  };

  // Refresh thumbs when gallery uploads
  const refreshThumbs = () => {
    setTimeout(() => getAllThumbnailsAsync().then(setThumbs), 300);
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Record Detail Modal */}
      {selectedRecord && (
        <RecordDetailModal
          record={selectedRecord}
          thumbnail={thumbs[String(selectedRecord.id)] || thumbs[selectedRecord.date]}
          onClose={() => setSelectedRecord(null)}
          onDelete={(idOrDate) => {
            deleteRecord(idOrDate);
            setSelectedRecord(null);
            setRecords(getRecords());
            refreshThumbs();
          }}
        />
      )}

      {/* ===== GALLERY MODE (Instagram-style profile) ===== */}
      {mode === 'gallery' && (() => {
        const latestRecord = records.length > 0 ? records[records.length - 1] : null;
        const profileImg = getProfile().profileImage;
        const avatarSrc = profileImg || (latestRecord ? (thumbs[String(latestRecord.id)] || thumbs[latestRecord.date]) : null);
        const avgScore = records.length > 0
          ? Math.round(records.reduce((s, r) => s + r.overallScore, 0) / records.length) : 0;
        const sorted = [...records].reverse();

        return (
          <div>
            {/* Profile header */}
            <div style={{ padding: '30px 20px 0', animation: 'breatheIn 0.6s ease both' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                {/* Profile avatar */}
                <div style={{
                  width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--btn-primary-bg)',
                  padding: 3,
                }}>
                  <div style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    overflow: 'hidden', background: 'var(--bg-secondary)',
                  }}>
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                          <circle cx="12" cy="10" r="4" /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: 'flex', flex: 1, justifyContent: 'space-around', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{records.length}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>기록</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{avgScore}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>평균점수</div>
                  </div>
                </div>
              </div>

              {/* Bio line */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>나의 피부 기록</div>
                {latestRecord && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    최근 피부나이 {latestRecord.skinAge}세 · {latestRecord.skinType}
                  </div>
                )}
              </div>

            </div>

            {/* Before & After Slider */}
            {records.length >= 2 && (
              <div style={{ marginTop: 20, animation: 'breatheIn 0.6s ease 0.15s both' }}>
                <BeforeAfterSlider />
              </div>
            )}

            <div style={{ marginTop: 16 }} />

            {/* Photo grid */}
            {records.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.2" strokeLinecap="round" style={{ marginBottom: 12 }}>
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>아직 기록이 없어요</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>첫 측정을 시작해보세요</div>
              </div>
            ) : (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, padding: '0 2px',
              }}>
                {sorted.map((r) => {
                  const thumb = thumbs[String(r.id)] || thumbs[r.date];
                  return (
                    <div key={r.id || r.timestamp || r.date} onClick={() => handleSelectRecord(r)} style={{
                      position: 'relative', aspectRatio: '1', cursor: 'pointer',
                      background: 'var(--bg-card-hover)', overflow: 'hidden', borderRadius: 10,
                    }}>
                      {thumb ? (
                        <img src={thumb} alt={r.date} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div style={{
                          width: '100%', height: '100%',
                          background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.06), rgba(var(--accent-rgb),0.1))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No Photo</span>
                        </div>
                      )}
                      <span style={{
                        position: 'absolute', bottom: 5, left: 6,
                        fontSize: 10, fontWeight: 500, color: '#fff',
                        textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                        pointerEvents: 'none',
                      }}>{String(new Date(r.date).getMonth() + 1).padStart(2, '0')}월 {String(new Date(r.date).getDate()).padStart(2, '0')}일</span>
                      <span style={{
                        position: 'absolute', bottom: 5, right: 6,
                        fontSize: 13, fontWeight: 600, color: '#fff',
                        textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                        pointerEvents: 'none',
                      }}>{r.overallScore}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ===== INSIGHTS MODE (Redesigned: Timeline + Compare) ===== */}
      {mode === 'insights' && (() => {
        const firstRecord = records.length > 0 ? records[0] : null;
        const lastRecord = records.length > 0 ? records[records.length - 1] : null;
        const overallDiff = totalChanges?.overallScore || 0;
        const skinAgeDiff = totalChanges?.skinAge || 0;
        const period = totalChanges?.period || 0;
        const improvementPct = firstRecord && lastRecord && firstRecord.overallScore > 0
          ? ((lastRecord.overallScore - firstRecord.overallScore) / firstRecord.overallScore * 100).toFixed(1)
          : null;
        const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
        const formatShortDate = (dateStr) => {
          const d = new Date(dateStr);
          return `${d.getMonth() + 1}월 ${d.getDate()}일`;
        };
        const compareMetrics = [
          { key: 'moisture', label: '수분', icon: <DropletIcon size={16} /> },
          { key: 'oilBalance', label: '유분', icon: <BubbleIcon size={16} /> },
          { key: 'elasticityScore', label: '탄력', icon: <DiamondIcon size={16} /> },
          { key: 'wrinkleScore', label: '주름', icon: <RulerIcon size={16} /> },
          { key: 'textureScore', label: '피부결', icon: <LotionIcon size={16} /> },
          { key: 'poreScore', label: '모공', icon: <MicroscopeIcon size={16} /> },
          { key: 'skinTone', label: '피부톤', icon: <SparkleIcon size={16} /> },
          { key: 'pigmentationScore', label: '색소', icon: <PaletteIcon size={16} /> },
          { key: 'darkCircleScore', label: '다크서클', icon: <EyeIcon size={16} /> },
        ];
        const sorted = [...records].reverse();

        return (
          <div style={{ padding: '0 16px' }}>
            <div style={{ paddingTop: 30 }} />

            {/* === SUMMARY CARDS === */}
            {totalChanges && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, animation: 'breatheIn 0.6s ease 0.1s both' }}>
                <div style={{
                  flex: 1, background: 'rgba(255,255,255,0.42)',
                  backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
                  border: 'none', borderRadius: 18, padding: '14px 16px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                  }}><ChartIcon size={26} /></div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>총 변화</div>
                    <div style={{
                      fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)',
                      color: overallDiff >= 0 ? '#4ade80' : '#f0a050',
                    }}>{overallDiff > 0 ? '+' : ''}{overallDiff}점</div>
                  </div>
                </div>
                <div style={{
                  flex: 1, background: 'rgba(255,255,255,0.42)',
                  backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
                  border: 'none', borderRadius: 18, padding: '14px 16px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                  }}><ClockIcon size={26} /></div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>피부나이</div>
                    <div style={{
                      fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)',
                      color: skinAgeDiff <= 0 ? '#4ade80' : '#f0a050',
                    }}>{skinAgeDiff > 0 ? '+' : ''}{skinAgeDiff}세</div>
                  </div>
                </div>
              </div>
            )}

            {/* === TREND GRAPH === */}
            <div className="card" style={{ padding: '16px 12px', marginBottom: 16, animation: 'breatheIn 0.6s ease 0.15s both' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>종합 점수 추이</span>
                {improvementPct !== null && Number(improvementPct) !== 0 && (
                  <span style={{
                    fontSize: 12, fontWeight: 600,
                    color: Number(improvementPct) > 0 ? '#4ade80' : '#f0a050',
                  }}>
                    {Number(improvementPct) > 0 ? '▲' : '▼'} {Math.abs(Number(improvementPct))}% {Number(improvementPct) > 0 ? '개선' : '변화'}
                  </span>
                )}
              </div>
              <TossLineChart
                data={getTimeSeries('overallScore')}
                accent="#6598ef"
                height={180}
                valueFormatter={(v) => `${v}점`}
                averageLabel="평균"
              />
            </div>

            {/* === TIMELINE MODE === */}
            {insightMode === 'timeline' && (
              <div style={{ animation: 'breatheIn 0.5s ease both' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>측정 기록</div>
                {records.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}></div>
                    <div style={{ fontSize: 13 }}>아직 기록이 없어요</div>
                  </div>
                ) : (
                  sorted.map((r, i) => {
                    const d = new Date(r.date);
                    const dayNum = d.getDate();
                    const monthLabel = `${d.getMonth() + 1}월`;
                    const dayOfWeek = dayLabels[d.getDay()] + '요일';
                    const thumb = thumbs[String(r.id)] || thumbs[r.date];
                    const prev = sorted[i + 1];
                    const diff = prev ? r.overallScore - prev.overallScore : 0;
                    const isLatest = i === 0;
                    const ringR = 18;
                    const circ = 2 * Math.PI * ringR;

                    return (
                      <div key={r.id || r.timestamp} className="history-record-item" onClick={() => handleSelectRecord(r)} style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '14px 16px', marginBottom: 8,
                        background: isLatest ? 'rgba(129,228,189,0.08)' : 'rgba(255,255,255,0.03)',
                        border: isLatest ? '1px solid rgba(129,228,189,0.25)' : '1px solid var(--border-light)',
                        borderRadius: 16, cursor: 'pointer',
                        transition: 'border-color 0.2s',
                      }}>
                        {/* Date */}
                        <div style={{ textAlign: 'center', minWidth: 36 }}>
                          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1 }}>{dayNum}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{monthLabel}</div>
                        </div>

                        {/* Divider */}
                        <div style={{ width: 1.5, height: 36, background: 'rgba(var(--accent-rgb),0.25)', borderRadius: 1, flexShrink: 0 }} />

                        {/* Thumbnail */}
                        <div style={{
                          width: 44, height: 44, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
                          background: 'var(--bg-card)',
                        }}>
                          {thumb ? (
                            <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CameraIcon size={18} /></div>
                          )}
                        </div>

                        {/* Score info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>종합 {r.overallScore}점</span>
                            {diff !== 0 && (
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
                                background: diff > 0 ? 'rgba(74,222,128,0.15)' : 'rgba(240,160,80,0.15)',
                                color: diff > 0 ? '#4ade80' : '#f0a050',
                              }}>{diff > 0 ? '+' : ''}{diff}</span>
                            )}
                            {diff > 0 && (
                              <div style={{
                                width: 4, height: 4, borderRadius: '50%',
                                background: 'var(--accent-primary)',
                                boxShadow: 'none',
                                flexShrink: 0,
                              }} />
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            피부나이 {r.skinAge}세 · {dayOfWeek}
                          </div>
                        </div>

                        {/* Score ring */}
                        <div style={{ position: 'relative', width: 42, height: 42, flexShrink: 0 }}>
                          <svg width="42" height="42" viewBox="0 0 42 42">
                            <circle cx="21" cy="21" r={ringR} fill="none" stroke="var(--border-light)" strokeWidth="3" />
                            <circle cx="21" cy="21" r={ringR} fill="none" stroke="#a8c8f8" strokeWidth="3"
                              strokeDasharray={`${(r.overallScore / 100) * circ} ${circ}`}
                              strokeLinecap="round" transform="rotate(-90 21 21)"
                            />
                          </svg>
                          <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-secondary)',
                          }}>{r.overallScore}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* === COMPARE MODE === */}
            {insightMode === 'compare' && (() => {
              if (!firstRecord || !lastRecord || records.length < 2) {
                return (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}></div>
                    <div style={{ fontSize: 13 }}>2회 이상 측정하면 비교 분석을 볼 수 있어요</div>
                  </div>
                );
              }
              const bigR = 34, bigCirc = 2 * Math.PI * bigR;
              return (
                <div style={{ animation: 'breatheIn 0.5s ease both' }}>
                  {/* Date comparison row */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 16, marginBottom: 28, padding: '0 8px',
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>시작</div>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
                        background: 'var(--bg-card-hover)', borderRadius: 10, padding: '6px 14px',
                      }}>{formatShortDate(firstRecord.date)}</div>
                    </div>
                    <div style={{ fontSize: 20, color: 'var(--text-dim)' }}>→</div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>현재</div>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
                        background: 'rgba(var(--accent-rgb),0.12)', border: 'none',
                        borderRadius: 10, padding: '6px 14px',
                      }}>{formatShortDate(lastRecord.date)}</div>
                    </div>
                  </div>

                  {/* Score ring comparison */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
                    marginBottom: 32,
                  }}>
                    {/* Start ring */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 6px' }}>
                        <svg width="80" height="80" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r={bigR} fill="none" stroke="var(--border-light)" strokeWidth="5" />
                          <circle cx="40" cy="40" r={bigR} fill="none" stroke="var(--text-dim)" strokeWidth="5"
                            strokeDasharray={`${(firstRecord.overallScore / 100) * bigCirc} ${bigCirc}`}
                            strokeLinecap="round" transform="rotate(-90 40 40)"
                          />
                        </svg>
                        <div style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-secondary)',
                        }}>{firstRecord.overallScore}</div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>시작</div>
                    </div>

                    {/* Diff */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-display)',
                        color: overallDiff >= 0 ? '#4ade80' : '#f0a050',
                      }}>{overallDiff > 0 ? '+' : ''}{overallDiff}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>점 {overallDiff >= 0 ? '상승' : '변화'}</div>
                    </div>

                    {/* Current ring */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 6px' }}>
                        <svg width="80" height="80" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r={bigR} fill="none" stroke="rgba(101,152,239,0.12)" strokeWidth="5" />
                          <circle cx="40" cy="40" r={bigR} fill="none" stroke="#a8c8f8" strokeWidth="5"
                            strokeDasharray={`${(lastRecord.overallScore / 100) * bigCirc} ${bigCirc}`}
                            strokeLinecap="round" transform="rotate(-90 40 40)"
                          />
                        </svg>
                        <div style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)',
                        }}>{lastRecord.overallScore}</div>
                      </div>
                      <div style={{ fontSize: 11, color: '#a8c8f8', fontWeight: 600 }}>현재</div>
                    </div>
                  </div>

                  {/* Metric-by-metric comparison */}
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>항목별 변화</div>
                  <div className="card" style={{ padding: '4px 14px' }}>
                    {compareMetrics.map((m, i) => {
                      const firstVal = firstRecord[m.key] ?? 0;
                      const lastVal = lastRecord[m.key] ?? 0;
                      const diff = lastVal - firstVal;
                      const improved = diff > 0;

                      return (
                        <div key={m.key} style={{
                          padding: '12px 0',
                          borderBottom: i < compareMetrics.length - 1 ? '1px solid var(--border-separator)' : 'none',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', width: 26 }}>{m.icon}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', flex: 1 }}>{m.label}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{firstVal}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 4px' }}>→</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{lastVal}</span>
                            {diff !== 0 && (
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, marginLeft: 6,
                                background: improved ? 'rgba(74,222,128,0.15)' : 'rgba(240,160,80,0.15)',
                                color: improved ? '#4ade80' : '#f0a050',
                              }}>{improved ? '↑' : '↓'}{diff > 0 ? '+' : ''}{diff}</span>
                            )}
                          </div>
                          {/* Progress bar */}
                          <div style={{
                            height: 4, borderRadius: 2, background: 'var(--border-light)',
                            marginLeft: 26,
                          }}>
                            <div style={{
                              height: '100%', borderRadius: 2,
                              width: `${Math.min(100, Math.max(0, lastVal))}%`,
                              background: improved || diff === 0 ? '#a8c8f8' : 'var(--text-dim)',
                              transition: 'width 0.8s ease',
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {records.length > 0 && (
              <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-dim)', marginTop: 16, marginBottom: 8 }}>
                매주 같은 조건(시간, 조명, 맨얼굴)에서 측정하면 정확도가 높아져요
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ===== CALENDAR COMPONENT (v2 - compact, no card wrapper) =====
function CalendarSection({ records, viewDate, onViewDateChange, selectedDate, onSelectRecord }) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

  const recordDates = useMemo(() => new Set(records.map(r => r.date)), [records]);
  const recordMap = useMemo(() => {
    const m = {};
    records.forEach(r => { m[r.date] = r; });
    return m;
  }, [records]);

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => onViewDateChange(new Date(year, month - 1, 1));
  const nextMonth = () => {
    const next = new Date(year, month + 1, 1);
    if (next <= new Date()) onViewDateChange(next);
  };

  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <>
      {/* Month Navigator */}
      <div className="month-nav" style={{ animation: 'breatheIn 0.8s ease 0.1s both' }}>
        <div className="month-label">{monthName}</div>
        <div className="month-arrows">
          <button className="month-arrow" onClick={prevMonth}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button className="month-arrow" onClick={nextMonth}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{ marginBottom: 24, animation: 'breatheIn 0.8s ease 0.15s both' }}>
        <div className="cal-weekdays">
          {['일', '월', '화', '수', '목', '금', '토'].map(d => (
            <span key={d} className="cal-weekday">{d}</span>
          ))}
        </div>
        <div className="cal-days">
          {cells.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === today;
            const isFuture = dateStr > today;
            const hasRecord = recordDates.has(dateStr);
            const isSelected = selectedDate === dateStr;

            let className = 'cal-day';
            if (isToday) className += ' cal-today';
            else if (isFuture) className += ' future';
            else if (hasRecord) className += ' recorded';
            else className += ' missed';
            if (isSelected && !isToday) className += ' cal-selected';

            return (
              <div
                key={dateStr}
                className={className}
                onClick={() => {
                  if (!isFuture && hasRecord) onSelectRecord(recordMap[dateStr]);
                }}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ===== PHOTO GALLERY (v2 - clear photos, hover overlay, score badges) =====
function PhotoGallery({ records, thumbs, onMeasure, onSelectRecord, onThumbsChange }) {
  const fileRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const hasTodayRecord = records.some(r => r.date === today);

  const sorted = [...records].reverse();
  const visiblePhotos = expanded ? sorted : sorted.slice(0, 9);
  const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

  const handleUploadClick = (e, dateStr) => {
    e.stopPropagation(); // prevent triggering record detail
    setUploadTarget(dateStr);
    fileRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/') || !uploadTarget) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      await saveThumbnail(uploadTarget, ev.target.result);
      onThumbsChange();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="gallery-section" style={{ animation: 'breatheIn 0.8s ease 0.35s both' }}>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />

      <div className="card" style={{ padding: '16px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: -0.3 }}>Album</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div onClick={onMeasure} style={{
            width: 34, height: 34, borderRadius: '50%', cursor: 'pointer',
            background: 'rgba(var(--accent-rgb),0.1)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="#a8c8f8" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      <div className="photo-grid">
        {visiblePhotos.map((r) => {
          const thumb = thumbs[String(r.id)] || thumbs[r.date];
          const d = new Date(r.date);
          const dateLabel = `${d.getMonth() + 1}월 ${d.getDate()}일 ${dayLabels[d.getDay()]}`;
          const shortDate = `${String(d.getMonth() + 1).padStart(2, '0')}월${String(d.getDate()).padStart(2, '0')}일`;

          return (
            <div key={r.id || r.timestamp || r.date} className="photo-cell" onClick={() => onSelectRecord(r)}>
              {thumb ? (
                <>
                  <img src={thumb} alt={r.date} />
                  <span style={{
                    position: 'absolute', bottom: 6, left: 6,
                    fontSize: 10, fontWeight: 600, color: '#fff',
                    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                    zIndex: 2, pointerEvents: 'none',
                  }}>{shortDate}</span>
                </>
              ) : null}
              <span className="photo-score-badge">{r.overallScore}</span>
            </div>
          );
        })}
      </div>

      {sorted.length > 9 && (
        <div onClick={() => setExpanded(v => !v)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '10px 0 2px', cursor: 'pointer',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{
            transition: 'transform 0.3s ease',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            <path d="M6 9l6 6 6-6" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      <div className="gallery-hint">사진을 탭하면 그날의 상세 분석을 볼 수 있어요</div>
      </div>
    </div>
  );
}

// ===== RECORD DETAIL MODAL (RPG stat card style) =====
export function RecordDetailModal({ record, thumbnail, onClose, onDelete }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoZoomed, setPhotoZoomed] = useState(false);
  const dragStart = useRef(null);
  const sheetRef = useRef(null);
  const captureRef = useRef(null);

  const handleTouchStart = (e) => {
    const el = sheetRef.current;
    if (el && el.scrollTop > 0) return;
    dragStart.current = e.touches[0].clientY;
    setIsDragging(true);
  };
  const handleTouchMove = (e) => {
    if (dragStart.current === null) return;
    const dy = e.touches[0].clientY - dragStart.current;
    if (dy > 0) setDragY(dy);
  };
  const handleTouchEnd = () => {
    if (dragY > 120) { setClosing(true); setDragY(window.innerHeight); setTimeout(onClose, 250); }
    else setDragY(0);
    dragStart.current = null; setIsDragging(false);
  };

  if (!record) return null;

  // ── 이전 측정 데이터 ──
  const allRecords = getRecords();
  const currentIdx = allRecords.findIndex(r => (r.id || r.date) === (record.id || record.date));
  const prev = currentIdx >= 0 && currentIdx < allRecords.length - 1 ? allRecords[currentIdx + 1] : null;
  const isFirst = !prev;
  const daysSincePrev = prev ? Math.floor((new Date(record.date) - new Date(prev.date)) / 86400000) : null;

  // ── 날짜 ──
  const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
  const d = new Date(record.date);
  const ts = record.timestamp ? new Date(record.timestamp) : d;
  const ampm = ts.getHours() < 12 ? '오전' : '오후';
  const h12 = ts.getHours() === 0 ? 12 : ts.getHours() > 12 ? ts.getHours() - 12 : ts.getHours();
  const dateStr = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${dayLabels[d.getDay()]}요일 ${ampm} ${h12}:${String(ts.getMinutes()).padStart(2, '0')}`;
  const dateShort = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;

  // ── 컬러 시스템 ──
  const C = {
    main: '#042C53', sub: '#185FA5', accent: '#1E90E8',
    positive: '#1976D2', negative: '#A32D2D',
    gradTop: '#DCEEFB', gradMid: '#EAF4FB',
    cardBg: '#FFFFFF', outerBg: '#F5FAFD',
    badgeBg: 'rgba(30,144,232,0.1)', badgeText: '#1976D2',
    tagAccentBg: 'rgba(30,144,232,0.08)', tagAccentBorder: 'rgba(30,144,232,0.2)',
    tagBg: 'rgba(255,255,255,0.7)', tagBorder: 'rgba(24,95,165,0.18)',
    trackBg: 'rgba(24,95,165,0.1)',
    divLight: 'rgba(24,95,165,0.08)', divStrong: 'rgba(24,95,165,0.12)',
  };

  // ── 등급 ──
  const getLevel = (score) => {
    if (score >= 80) return 'A';
    if (score >= 60) return 'B';
    if (score >= 40) return 'C';
    if (score >= 20) return 'D';
    return 'E';
  };
  const level = getLevel(record.overallScore);

  // ── AI 코멘트 ──
  const aiComment = record.conditionBriefing || record.advice?.split(/[.!?]/)[0] || '결을 기록했어요';

  // ── 태그 ──
  const profile = getProfile();
  const tags = [];
  if (profile.skinType) tags.push({ label: profile.skinType, accent: true });
  if (record.analysisMode) tags.push({ label: record.analysisMode === 'hybrid' ? 'AI 하이브리드' : 'CV 분석' });
  if (record.confidence != null) tags.push({ label: `신뢰도 ${Math.min(record.confidence, 95)}%` });
  (record.concerns || []).forEach(c => tags.push({ label: c }));

  // ── 변화량 계산 ──
  const getDiff = (key) => {
    if (!prev || record[key] == null || prev[key] == null) return null;
    return record[key] - prev[key];
  };

  // ── 지표 ──
  const conditionMetrics = [
    { label: '수분도', key: 'moisture', icon: <DropletIcon size={14} />, color: '#a5d8ff', unit: '%' },
    { label: '유분', key: 'oilBalance', icon: <BubbleIcon size={14} />, color: '#ffec99', unit: '%' },
    { label: '피부톤', key: 'skinTone', icon: <LotionIcon size={13} />, color: '#ffd8a8' },
    { label: '트러블', key: 'troubleCount', icon: <TargetIcon size={14} />, color: '#ffc9c9', unit: '개' },
    { label: '다크서클', key: 'darkCircleScore', icon: <EyeIcon size={14} />, color: '#bac8ff' },
  ];
  const agingMetrics = [
    { label: '탄력', key: 'elasticityScore', icon: <DiamondIcon size={14} />, color: '#99e9f2' },
    { label: '피부결', key: 'textureScore', icon: <SparkleIcon size={14} />, color: '#fcc2d7' },
    { label: '주름', key: 'wrinkleScore', icon: <RulerIcon size={14} />, color: '#ffec99' },
    { label: '모공', key: 'poreScore', icon: <MicroscopeIcon size={14} />, color: '#ffd8a8' },
    { label: '색소', key: 'pigmentationScore', icon: <PaletteIcon size={13} />, color: '#e0c0a0' },
  ];

  // ── 공유 ──
  const handleShare = async () => {
    const text = `스킨 리포트 · ${dateShort}\n종합 ${record.overallScore}점 · 스킨 레벨 ${level}\n피부나이 ${record.skinAge}세`;
    if (navigator.share) {
      try { await navigator.share({ title: '스킨 리포트', text }); } catch {}
    } else {
      navigator.clipboard?.writeText(text);
    }
  };

  // ── 저장 (캡처 placeholder) ──
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  // ── 변화 행 ──
  const ChangeRow = ({ label, diff, unit }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.divLight}` }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: C.main }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 500, color: diff > 0 ? C.positive : diff < 0 ? C.negative : C.sub }}>
        {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '0'}{unit || ''}
      </span>
    </div>
  );

  const cardStyle = {
    background: C.cardBg, borderRadius: 22, padding: '16px 18px',
    marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: `rgba(0,0,0,${Math.max(0, 0.15 - dragY * 0.001).toFixed(2)})`,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      animation: closing ? 'none' : 'fadeIn 0.2s ease',
    }} onClick={onClose}>
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          width: '100%', maxWidth: 430,
          background: C.outerBg,
          borderRadius: '24px 24px 0 0',
          overflow: 'hidden',
          maxHeight: '92vh',
          animation: closing ? 'none' : 'slideUp 0.3s cubic-bezier(0.32,0.72,0,1)',
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s ease-out',
        }} onClick={e => e.stopPropagation()}>
        <div style={{ maxHeight: '92vh', overflowY: dragY > 0 ? 'hidden' : 'auto', WebkitOverflowScrolling: 'touch' }}>

        {/* ① 앱 헤더 */}
        {/* 드래그 핸들 */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 8px' }}>
          <div style={{ width: 47, height: 4, borderRadius: 2, background: '#ececec' }} />
        </div>

        {/* ② 시그니처 카드 */}
        <div ref={captureRef} style={{ margin: '0 16px 12px', borderRadius: 24, overflow: 'hidden', background: C.cardBg, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          {/* 상단 그라데이션 */}
          <div style={{ background: `linear-gradient(180deg, ${C.gradTop} 0%, ${C.gradMid} 50%, ${C.cardBg} 100%)`, padding: '20px 20px 0', textAlign: 'center' }}>
            {/* 날짜 + LUA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 10, letterSpacing: 0.4, color: C.sub }}>{dateShort}</span>
              <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: 2.5, color: C.sub }}>LUA</span>
            </div>

            {/* 두 줄 요약 멘트 */}
            {(() => {
              const metricLabels = { moisture: '수분', oilBalance: '유분', skinTone: '피부톤', troubleCount: '트러블', darkCircleScore: '다크서클', textureScore: '피부결', elasticityScore: '탄력', wrinkleScore: '주름', poreScore: '모공', pigmentationScore: '색소' };
              const positiveConn = { moisture: '이 채워지고', oilBalance: '이 안정되고', skinTone: '이 밝아지고', troubleCount: '이 가라앉고', darkCircleScore: '이 밝아지고', textureScore: '이 매끄러워지고', elasticityScore: '이 탄탄해지고', wrinkleScore: '이 부드러워지고', poreScore: '이 잡히고', pigmentationScore: '이 고르게 되고' };
              const positiveEnd = { moisture: '이 촉촉해졌어요', oilBalance: '이 안정됐어요', skinTone: '이 한 톤 깨어났어요', troubleCount: '이 가라앉았어요', darkCircleScore: '이 밝아졌어요', textureScore: '이 매끄러워졌어요', elasticityScore: '이 탄탄해졌어요', wrinkleScore: '이 부드러워졌어요', poreScore: '이 뚜렷이 잡혔어요', pigmentationScore: '이 고르게 정돈됐어요' };
              const positives = Object.keys(metricLabels)
                .map(k => ({ key: k, label: metricLabels[k], diff: getDiff(k) }))
                .filter(m => m.diff !== null && m.diff > 0)
                .sort((a, b) => b.diff - a.diff);
              const top1 = positives[0];
              const top2 = positives[1];
              let text = '';
              if (isFirst) {
                text = '첫 번째 피부 기록이에요. 꾸준히 측정하면 변화가 보여요';
              } else if (top1 && top2) {
                text = `${top1.label}${positiveConn[top1.key]} ${top2.label}${positiveEnd[top2.key]}`;
              } else if (top1) {
                text = `${top1.label}${positiveEnd[top1.key]}`;
              } else {
                text = '지난 측정과 비슷한 상태예요';
              }
              return (
                <div style={{ textAlign: 'center', marginBottom: 16, padding: '0 12px' }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: C.main, lineHeight: 1.6 }}>{text}</div>
                </div>
              );
            })()}

            {/* 셀카 — 탭하면 원본 확대 */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div
                onClick={() => thumbnail && setPhotoZoomed(true)}
                style={{
                  width: 100, height: 100, borderRadius: '50%',
                  background: thumbnail ? 'none' : `linear-gradient(135deg, ${C.gradTop}, ${C.gradMid})`,
                  padding: 3,
                  boxShadow: `0 0 0 3px ${C.accent}30`,
                  cursor: thumbnail ? 'pointer' : 'default',
                  WebkitTapHighlightColor: 'transparent',
                  position: 'relative',
                }}
              >
                {thumbnail ? (
                  <>
                    <img src={thumbnail} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    {/* 확대 가능 시그널 */}
                    <div style={{
                      position: 'absolute', right: -2, bottom: -2,
                      width: 26, height: 26, borderRadius: '50%',
                      background: '#fff', border: `2px solid ${C.accent}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5" />
                      </svg>
                    </div>
                  </>
                ) : (
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: `linear-gradient(135deg, ${C.gradTop}, ${C.gradMid})` }} />
                )}
              </div>
            </div>

            {/* 사진 원본 확대 lightbox — 탭/스와이프로 닫기 */}
            {photoZoomed && thumbnail && createPortal(
              <div
                onClick={() => setPhotoZoomed(false)}
                style={{
                  position: 'fixed', inset: 0, zIndex: 99999,
                  background: 'rgba(0,0,0,0.94)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'zoom-out',
                  animation: 'photoZoomFadeIn 0.2s ease',
                }}
              >
                <style>{`@keyframes photoZoomFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
                <img
                  src={thumbnail}
                  alt=""
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    maxWidth: '96vw', maxHeight: '92vh', objectFit: 'contain',
                    borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                  }}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); setPhotoZoomed(false); }}
                  aria-label="닫기"
                  style={{
                    position: 'absolute', top: 'calc(20px + env(safe-area-inset-top, 0px))', right: 20,
                    width: 40, height: 40, borderRadius: 20,
                    background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(10px)',
                    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
                <div style={{
                  position: 'absolute', bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', left: 0, right: 0,
                  textAlign: 'center', color: 'rgba(255,255,255,0.75)', fontSize: 12,
                  pointerEvents: 'none',
                }}>
                  {dateShort}
                </div>
              </div>,
              document.body
            )}

          </div>

          {/* 점수 영역 */}
          <div style={{ padding: '0 20px 16px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 64, fontWeight: 500, letterSpacing: -2.5, lineHeight: 1, color: C.main }}>{record.overallScore ?? '—'}</span>
              <span style={{ fontSize: 16, letterSpacing: -0.3, color: C.sub, marginBottom: 8 }}>/ 100</span>
            </div>
            {/* 스킨 레벨 배지 */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, background: C.badgeBg, marginBottom: 14 }}>
              <span style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: 0.3, color: C.badgeText }}>스킨 레벨 · {level}</span>
            </div>
            {/* 태그 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
              {tags.map((t, i) => (
                <span key={i} style={{
                  fontSize: 10, fontWeight: 500, padding: '4px 10px', borderRadius: 20,
                  background: t.accent ? C.tagAccentBg : C.tagBg,
                  border: `1px solid ${t.accent ? C.tagAccentBorder : C.tagBorder}`,
                  color: t.accent ? C.accent : C.sub,
                }}>{t.label}</span>
              ))}
            </div>
          </div>

          {/* 지난 측정에서 달라진 점 (시그니처 카드 안) */}
          <div style={{ padding: '0 20px 20px' }}>
            {(() => {
              // 변화량 상위 3개 추출
              const allMetrics = [
                { label: '모공', key: 'poreScore', icon: <MicroscopeIcon size={18} /> },
                { label: '피부톤', key: 'skinTone', icon: <SparkleIcon size={18} /> },
                { label: '수분도', key: 'moisture', icon: <DropletIcon size={18} /> },
                { label: '탄력', key: 'elasticityScore', icon: <DiamondIcon size={18} /> },
                { label: '주름', key: 'wrinkleScore', icon: <RulerIcon size={18} /> },
                { label: '피부결', key: 'textureScore', icon: <LotionIcon size={18} /> },
                { label: '색소', key: 'pigmentationScore', icon: <PaletteIcon size={18} /> },
                { label: '유분', key: 'oilBalance', icon: <BubbleIcon size={18} /> },
                { label: '다크서클', key: 'darkCircleScore', icon: <EyeIcon size={18} /> },
                { label: '트러블', key: 'troubleCount', icon: <TargetIcon size={18} /> },
              ];
              const changes = allMetrics
                .map(m => ({ ...m, value: record[m.key], diff: getDiff(m.key) }))
                .filter(m => m.value != null && m.diff !== null)
                .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
                .slice(0, 3);

              if (changes.length === 0 && !isFirst) return null;

              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: -0.2, color: C.main }}>
                      {isFirst ? '기준선' : '지난 측정에서 달라진 점'}
                    </span>
                    <span style={{ fontSize: 10.5, letterSpacing: 0.3, color: C.sub }}>
                      {isFirst ? '첫 측정' : `${daysSincePrev}일 전`}
                    </span>
                  </div>

                  {isFirst ? (
                    <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6, textAlign: 'center', padding: '16px 0' }}>
                      첫 번째 측정이에요. 다음 측정부터 변화를 추적할 수 있어요.
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        {changes.map(m => (
                          <div key={m.key} style={{
                            flex: 1, padding: '16px 8px 14px', borderRadius: 16,
                            background: '#F5FAFD', textAlign: 'center',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, opacity: 0.5 }}>
                              {m.icon}
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: -1, color: C.main, lineHeight: 1 }}>
                              {m.value ?? '—'}
                            </div>
                            <div style={{
                              fontSize: 12, fontWeight: 500, marginTop: 4,
                              color: m.diff > 0 ? C.positive : m.diff < 0 ? C.negative : C.sub,
                            }}>
                              {m.diff > 0 ? `+${m.diff}` : m.diff}
                            </div>
                            <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{m.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* AI 한줄 요약 */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 14px', borderRadius: 14,
                        background: '#F5FAFD',
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(150,215,248,0.5) 100%)',
                          boxShadow: '0 0 0 1px rgba(255,255,255,0.4), 0 2px 6px rgba(0,0,0,0.06)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          position: 'relative', overflow: 'hidden',
                        }}>
                          <div style={{
                            position: 'absolute', top: 0, left: '-100%', width: '300%', height: '100%',
                            background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.25) 45%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.25) 55%, transparent 70%)',
                            animation: 'fabShine 3.5s ease-in-out infinite',
                            pointerEvents: 'none',
                          }} />
                          <svg width="16" height="16" viewBox="0 0 642.82 626.11" style={{ position: 'relative', zIndex: 1, filter: 'drop-shadow(0 1px 2px rgba(100,180,230,0.5))' }}>
                            <defs>
                              <linearGradient id="rdm-star-fill" x1="0.15" y1="0.05" x2="0.85" y2="0.95"><stop offset="0%" stopColor="#D6EEFB" /><stop offset="45%" stopColor="#a8d8f5" /><stop offset="100%" stopColor="#6bb8e8" /></linearGradient>
                              <linearGradient id="rdm-star-edge" x1="0.5" y1="0" x2="0.5" y2="1"><stop offset="0%" stopColor="#c8e8fa" /><stop offset="100%" stopColor="#5aaad8" /></linearGradient>
                            </defs>
                            <path fill="url(#rdm-star-edge)" stroke="rgba(90,170,216,0.3)" strokeWidth="16" d="M283.39,624.22c-13.36,4.42-27.68.92-38.02-8.6-9.11-8.38-15.79-18.59-19.6-30.36l-11.25-34.71c-5.84-18.02-11.19-35.37-19.86-52.19-18.55-35.99-49.68-62.09-88.22-74.84l-45.43-12.53c-20.65-5.69-45.02-14.73-55.55-33.29-8-14.1-7.19-30.1,2.36-43.17,15.69-21.46,45.08-28.92,69.82-36.01l33.43-9.58c23.08-6.61,43.51-19.41,60.62-36.34l6.6-7.54c14.35-16.41,23.14-36.5,29.38-57.47l9.51-37.53c5.57-21.99,16.02-46.39,38.05-53.68,13.7-4.53,27.46-1.11,38.03,8.53,25.63,23.39,23.97,67.31,40.45,103.36,7.76,16.97,17.54,32.27,31.25,44.71,26.31,23.86,47.15,29.48,77.44,40.68l34.98,12.94c9.87,3.65,18.18,10.09,24.64,18.27,12.32,15.61,12.46,36.51-.08,52.12-8.57,10.67-20.09,17.86-32.88,22.95l-39.33,15.63c-31.62,12.57-58.51,33.68-76.08,63.01-8.47,14.15-14.81,29.08-18.72,45.21l-8.59,35.37c-6.3,25.94-16.47,56.3-42.95,65.05Z"/>
                            <g transform="translate(8,8) scale(0.975)"><path fill="url(#rdm-star-fill)" d="M283.39,624.22c-13.36,4.42-27.68.92-38.02-8.6-9.11-8.38-15.79-18.59-19.6-30.36l-11.25-34.71c-5.84-18.02-11.19-35.37-19.86-52.19-18.55-35.99-49.68-62.09-88.22-74.84l-45.43-12.53c-20.65-5.69-45.02-14.73-55.55-33.29-8-14.1-7.19-30.1,2.36-43.17,15.69-21.46,45.08-28.92,69.82-36.01l33.43-9.58c23.08-6.61,43.51-19.41,60.62-36.34l6.6-7.54c14.35-16.41,23.14-36.5,29.38-57.47l9.51-37.53c5.57-21.99,16.02-46.39,38.05-53.68,13.7-4.53,27.46-1.11,38.03,8.53,25.63,23.39,23.97,67.31,40.45,103.36,7.76,16.97,17.54,32.27,31.25,44.71,26.31,23.86,47.15,29.48,77.44,40.68l34.98,12.94c9.87,3.65,18.18,10.09,24.64,18.27,12.32,15.61,12.46,36.51-.08,52.12-8.57,10.67-20.09,17.86-32.88,22.95l-39.33,15.63c-31.62,12.57-58.51,33.68-76.08,63.01-8.47,14.15-14.81,29.08-18.72,45.21l-8.59,35.37c-6.3,25.94-16.47,56.3-42.95,65.05Z"/></g>
                            <path fill="url(#rdm-star-edge)" stroke="rgba(90,170,216,0.3)" strokeWidth="10" d="M566.24,189.1c-5.51,17.06-12.16,36.33-32.49,34.81-7.19-.54-13.8-4.68-18.36-11.36-9.25-13.54-10.94-33.95-26.05-51.79-18.62-21.99-39.93-22.15-53.83-33-5.85-4.57-9.56-10.02-9.84-16.78-.29-6.71,2.52-12.91,7.73-17.86,11.76-11.16,34.28-13.3,50.87-29.99,18.41-18.52,19.4-40.08,30.52-53.45,7.88-9.48,21.11-12.94,31.78-6.11,14.26,9.13,16.25,29.81,26.68,46.23,9.89,15.56,25.11,25.51,42.3,31.79,7.15,2.61,13.57,5.63,19.28,10.64,7.73,6.79,10.69,18.67,5.07,27.55-4.96,7.84-12.96,12.22-21.47,15.47-28.52,10.89-42.75,24.6-52.2,53.84Z"/>
                            <g transform="translate(4,4) scale(0.988)"><path fill="url(#rdm-star-fill)" d="M566.24,189.1c-5.51,17.06-12.16,36.33-32.49,34.81-7.19-.54-13.8-4.68-18.36-11.36-9.25-13.54-10.94-33.95-26.05-51.79-18.62-21.99-39.93-22.15-53.83-33-5.85-4.57-9.56-10.02-9.84-16.78-.29-6.71,2.52-12.91,7.73-17.86,11.76-11.16,34.28-13.3,50.87-29.99,18.41-18.52,19.4-40.08,30.52-53.45,7.88-9.48,21.11-12.94,31.78-6.11,14.26,9.13,16.25,29.81,26.68,46.23,9.89,15.56,25.11,25.51,42.3,31.79,7.15,2.61,13.57,5.63,19.28,10.64,7.73,6.79,10.69,18.67,5.07,27.55-4.96,7.84-12.96,12.22-21.47,15.47-28.52,10.89-42.75,24.6-52.2,53.84Z"/></g>
                          </svg>
                        </div>
                        <span style={{ fontSize: 12, color: C.main, lineHeight: 1.5 }}>
                          {(() => {
                            const mLabels = { moisture: '수분', oilBalance: '유분', skinTone: '피부톤', troubleCount: '트러블', darkCircleScore: '다크서클', textureScore: '피부결', elasticityScore: '탄력', wrinkleScore: '주름', poreScore: '모공', pigmentationScore: '색소' };
                            const pConn = { moisture: '이 채워지고', oilBalance: '이 안정되고', skinTone: '이 밝아지고', troubleCount: '이 가라앉고', darkCircleScore: '이 밝아지고', textureScore: '이 매끄러워지고', elasticityScore: '이 탄탄해지고', wrinkleScore: '이 부드러워지고', poreScore: '이 잡히고', pigmentationScore: '이 고르게 되고' };
                            const pEnd = { moisture: '이 촉촉해졌어요', oilBalance: '이 안정됐어요', skinTone: '이 한 톤 깨어났어요', troubleCount: '이 가라앉았어요', darkCircleScore: '이 밝아졌어요', textureScore: '이 매끄러워졌어요', elasticityScore: '이 탄탄해졌어요', wrinkleScore: '이 부드러워졌어요', poreScore: '이 뚜렷이 잡혔어요', pigmentationScore: '이 고르게 정돈됐어요' };
                            const pos = Object.keys(mLabels)
                              .map(k => ({ key: k, label: mLabels[k], diff: getDiff(k) }))
                              .filter(m => m.diff !== null && m.diff > 0)
                              .sort((a, b) => b.diff - a.diff);
                            if (pos.length >= 2) return `${pos[0].label}${pConn[pos[0].key]} ${pos[1].label}${pEnd[pos[1].key]}`;
                            if (pos.length === 1) return `${pos[0].label}${pEnd[pos[0].key]}`;
                            return '지난 측정과 비슷한 상태예요';
                          })()}
                        </span>
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* ③ 자세한 측정 토글 + 액션 버튼 */}
        <div style={{
          margin: '0 16px 12px', padding: '14px 20px',
          display: 'flex', alignItems: 'center',
        }}>
          <div onClick={() => setDetailOpen(!detailOpen)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" strokeLinecap="round"
              style={{ transform: detailOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s cubic-bezier(0.32,0.72,0,1)' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <span style={{ fontSize: 11, fontWeight: 500, color: C.main }}>{detailOpen ? '자세한 측정 접기' : '자세한 측정 보기'}</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <div onClick={handleSave} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
            <div onClick={handleShare} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </div>
            <div onClick={() => setShowConfirm(true)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 12l6 0" /></svg>
            </div>
          </div>
        </div>

        {/* ④ 상세 섹션 */}
        {detailOpen && (
          <div style={{ margin: '0 16px', animation: 'fadeUp 0.3s cubic-bezier(0.32,0.72,0,1) both' }}>

            {/* 컨디션 브리핑 */}
            {(() => {
              const cScore = record.conditionScore ?? record.overallScore;
              const cGrade = cScore >= 85 ? { letter: 'S', color: C.accent, bg: 'rgba(30,144,232,0.1)', border: 'rgba(30,144,232,0.2)' }
                : cScore >= 70 ? { letter: 'A', color: C.accent, bg: 'rgba(30,144,232,0.1)', border: 'rgba(30,144,232,0.2)' }
                : cScore >= 55 ? { letter: 'B', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' }
                : cScore >= 40 ? { letter: 'C', color: '#8888a0', bg: 'rgba(136,136,160,0.08)', border: 'rgba(136,136,160,0.15)' }
                : { letter: 'D', color: C.negative, bg: 'rgba(163,45,45,0.08)', border: 'rgba(163,45,45,0.15)' };
              return (
                <div style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: -0.2, color: C.main }}>컨디션 브리핑</span>
                    <div style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 8, background: cGrade.bg, border: `1px solid ${cGrade.border}`, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: cGrade.color, fontFamily: 'var(--font-display)' }}>{cGrade.letter}</span>
                      <span style={{ fontSize: 10, fontWeight: 500, color: cGrade.color }}>{cScore}점</span>
                    </div>
                  </div>
                  {record.conditionBriefing ? (
                    <p style={{ fontSize: 12, color: C.sub, lineHeight: 1.8, margin: 0 }}>{record.conditionBriefing}</p>
                  ) : (
                    <p style={{ fontSize: 12, color: C.sub, lineHeight: 1.8, margin: 0, fontStyle: 'italic' }}>컨디션 브리핑은 이후 측정부터 저장됩니다.</p>
                  )}
                </div>
              );
            })()}

            {/* 전체 피부 분석 + AI 정밀 분석 */}
            {record.advice && (
              <div style={cardStyle}>
                <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: -0.2, color: C.main, marginBottom: 10 }}>전체 피부 분석</div>
                <p style={{ fontSize: 12, color: C.sub, lineHeight: 1.75, margin: 0 }}>{record.advice}</p>
                {record.aiNotes && (() => {
                  const filtered = record.aiNotes
                    .replace(/[^.。!]*(?:동일\s*인물|같은\s*(?:사람|인물)|다른\s*(?:사람|인물)|differentPerson|두\s*사진\s*(?:은|이|를))[^.。!]*[.。!]\s*/gi, '')
                    .trim();
                  if (!filtered) return null;
                  return (
                    <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 12, background: 'rgba(30,144,232,0.04)', border: `1px solid ${C.divLight}` }}>
                      <div style={{ fontSize: 10, fontWeight: 500, color: C.accent, marginBottom: 4 }}>AI 정밀 분석</div>
                      <p style={{ fontSize: 11, color: C.sub, lineHeight: 1.7, margin: 0 }}>{filtered}</p>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* 컨디션 지표 */}
            <div style={{ ...cardStyle, padding: '14px 6px 2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 14, paddingRight: 14, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: -0.2, color: C.main }}>컨디션 지표</span>
                <span style={{ fontSize: 10.5, letterSpacing: 0.3, color: C.sub }}>5가지</span>
              </div>
              {conditionMetrics.map((m, i) => (
                <MetricBar key={m.label} label={m.label} value={record[m.key]} unit={m.unit || ''} color={m.color} icon={m.icon} delay={i * 80} />
              ))}
            </div>

            {/* ④-3 노화 지표 */}
            <div style={{ ...cardStyle, padding: '14px 6px 2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 14, paddingRight: 14, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: -0.2, color: C.main }}>노화 지표</span>
                <span style={{ fontSize: 10.5, letterSpacing: 0.3, color: C.sub }}>5가지</span>
              </div>
              {agingMetrics.map((m, i) => (
                <MetricBar key={m.label} label={m.label} value={record[m.key]} unit="" color={m.color} icon={m.icon} delay={i * 80} />
              ))}
            </div>

          </div>
        )}



        </div>{/* end scroll wrapper */}

        {/* 삭제 확인 팝업 */}
        {showConfirm && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.15s ease',
          }} onClick={() => setShowConfirm(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: '#fff', borderRadius: 20, padding: '28px 24px',
              width: 280, textAlign: 'center',
            }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.main, marginBottom: 8 }}>이 기록을 삭제할까요?</div>
              <div style={{ fontSize: 12, color: C.sub, marginBottom: 20 }}>삭제된 기록은 복구할 수 없습니다.</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowConfirm(false)} style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                  background: '#F0F4F8', color: C.main, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>아니오</button>
                <button onClick={() => { onDelete(record.id || record.date); setShowConfirm(false); }} style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                  background: '#A32D2D', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>삭제</button>
              </div>
            </div>
          </div>
        )}

        {/* 저장 토스트 */}
        {saved && (
          <div style={{
            position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
            background: C.accent, color: '#fff', padding: '10px 22px', borderRadius: 30,
            fontSize: 13, fontWeight: 600, zIndex: 999, animation: 'fadeIn 0.2s ease',
          }}>앨범에 두었어요</div>
        )}
      </div>
    </div>
  );
}

// 날짜 헬퍼 — 케어 페이지 selectedDate용
function _care_dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function _care_todayStr() { return _care_dateStr(new Date()); }
function _care_dateLabel(dateStr) {
  if (dateStr === _care_todayStr()) return '오늘';
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.floor((today.getTime() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000);
  if (diff === 1) return '어제';
  if (diff === 2) return '그제';
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['일','월','화','수','목','금','토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

// ===== Routine Checklist (Morning / Night) =====
function RoutineChecklist() {
  const [mode, setMode] = useState('morning');
  const [selectedDate, setSelectedDate] = useState(() => _care_todayStr());
  const [weekStartOffset, setWeekStartOffset] = useState(0); // 0=이번 주, -1=지난 주, ...
  const [checks, setChecks] = useState(() => getTrackerChecks(_care_todayStr()));
  const [addModal, setAddModal] = useState(false);
  const [addMode, setAddMode] = useState('morning');
  const [customName, setCustomName] = useState('');
  const [detailItem, setDetailItem] = useState(null); // item being configured
  const [, forceTick] = useState(0); // 채팅 카드에서 제품 등록 시 강제 re-render trigger
  const [openSwipeRowId, setOpenSwipeRowId] = useState(null); // 현재 열린 swipe row (한 번에 하나)
  const [thumbMap, setThumbMap] = useState(() => new Map()); // IDB 누끼 이미지
  const thumbBackfillRef = useRef(false);

  // IDB에서 product thumb 로드 + 등록 변경 이벤트 시 새로 받음
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const map = await getAllProductThumbs();
        if (!cancelled) setThumbMap(map);
      } catch {}
    };
    load();
    const onChanged = () => load();
    window.addEventListener('lua:tracker-products-changed', onChanged);
    return () => { cancelled = true; window.removeEventListener('lua:tracker-products-changed', onChanged); };
  }, []);

  // (thumb 백그라운드 보강은 RoutineTracker(화장대) 마운트 시에만 처리 — 그쪽에서 IDB에 저장하면 케어도 자동 반영)

  // 케어 row 삭제 — 두 storage 모두 안전하게 처리 (type 매칭 오류로 누락되는 케이스 방지)
  const handleSwipeDelete = (item) => {
    // 1) TrackerStorage products에서 시도
    try { deleteProduct(item.id); } catch {}
    // 2) myRoutines에서도 같은 id 모두 제거 (mode 무관 — 다른 mode에 남아있어도 클린업)
    try {
      const raw = JSON.parse(localStorage.getItem('lua_my_routines') || '[]');
      const cleaned = raw.filter(r => r.id !== item.id);
      if (cleaned.length !== raw.length) {
        localStorage.setItem('lua_my_routines', JSON.stringify(cleaned));
        setMyRoutines(cleaned);
      }
    } catch {}
    // 3) manual order에서도 제거
    try {
      const orderMap = JSON.parse(localStorage.getItem('lua_care_manual_order') || '{}');
      let changed = false;
      Object.keys(orderMap).forEach(m => {
        const before = orderMap[m]?.length || 0;
        if (Array.isArray(orderMap[m])) {
          orderMap[m] = orderMap[m].filter(id => id !== item.id);
          if (orderMap[m].length !== before) changed = true;
        }
      });
      if (changed) localStorage.setItem('lua_care_manual_order', JSON.stringify(orderMap));
    } catch {}
    forceTick(t => t + 1);
  };

  // 순서 변경 — 사용자 manual order를 localStorage에 저장. allItems 정렬 시 우선 적용.
  const ORDER_KEY = 'lua_care_manual_order';
  const getManualOrder = () => {
    try { return JSON.parse(localStorage.getItem(ORDER_KEY) || '{}'); } catch { return {}; }
  };
  const saveManualOrder = (orderMap) => {
    localStorage.setItem(ORDER_KEY, JSON.stringify(orderMap));
    forceTick(t => t + 1);
  };
  const handleSwipeMove = (item, allItemsList, direction) => {
    const ids = allItemsList.map(i => i.id);
    const idx = ids.indexOf(item.id);
    if (idx < 0) return;
    const target = direction === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= ids.length) return;
    const reordered = [...ids];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    const orderMap = getManualOrder();
    orderMap[mode] = reordered;
    saveManualOrder(orderMap);
  };

  // 채팅에서 saveProduct 등 호출 시 즉시 케어 화면 갱신
  useEffect(() => {
    const onChanged = () => forceTick(t => t + 1);
    window.addEventListener('lua:tracker-products-changed', onChanged);
    return () => window.removeEventListener('lua:tracker-products-changed', onChanged);
  }, []);

  // selectedDate 변경 시 checks 동기화
  useEffect(() => {
    setChecks(getTrackerChecks(selectedDate));
  }, [selectedDate]);

  // Day settings per routine
  const getDaySettings = () => { try { return JSON.parse(localStorage.getItem('lua_routine_days') || '{}'); } catch { return {}; } };
  const [daySettings, setDaySettings] = useState(getDaySettings);
  const dayLabels = ['일','월','화','수','목','금','토'];
  const today = new Date().getDay();

  const toggleDay = (itemId, dayIdx) => {
    const key = `${itemId}_${mode}`;
    const current = daySettings[key] || [true,true,true,true,true,true,true];
    const updated = [...current];
    updated[dayIdx] = !updated[dayIdx];
    const next = { ...daySettings, [key]: updated };
    localStorage.setItem('lua_routine_days', JSON.stringify(next));
    setDaySettings(next);
  };

  const getItemDays = (itemId) => {
    const key = `${itemId}_${mode}`;
    return daySettings[key] || [true,true,true,true,true,true,true]; // default: every day
  };

  const isActiveToday = (itemId) => {
    const days = getItemDays(itemId);
    return days[today];
  };
  const products = getProductsForMode(mode);

  // Recommended routines (user picks from these)
  const recommendedRoutines = [
    { id: '_water', name: '물 한 잔 마시기', icon: '' },
    { id: '_wash', name: '세안', icon: '' },
    { id: '_sunscreen', name: '선크림 바르기', icon: '' },
    { id: '_toner', name: '토너 바르기', icon: '' },
    { id: '_serum', name: '세럼 바르기', icon: '' },
    { id: '_cream', name: '크림 바르기', icon: '' },
    { id: '_cleansing', name: '클렌징', icon: '' },
    { id: '_mask', name: '마스크팩', icon: '' },
    { id: '_vitamin', name: '비타민 먹기', icon: '' },
    { id: '_stretch', name: '스트레칭', icon: '' },
  ];

  // User-added routines (recommend + custom)
  const getMyRoutines = () => { try { return JSON.parse(localStorage.getItem('lua_my_routines') || '[]'); } catch { return []; } };
  const [myRoutines, setMyRoutines] = useState(getMyRoutines);

  const addRoutine = (item, targetMode) => {
    const exists = myRoutines.some(r => r.id === item.id && r.mode === targetMode);
    if (exists) return;
    const entry = { ...item, mode: targetMode, type: item.type || 'recommend' };
    const updated = [...myRoutines, entry];
    localStorage.setItem('lua_my_routines', JSON.stringify(updated));
    setMyRoutines(updated);
  };

  const addCustomRoutine = (name, targetMode) => {
    const entry = { id: `_custom_${Date.now()}`, name, icon: '', type: 'custom', mode: targetMode };
    const updated = [...myRoutines, entry];
    localStorage.setItem('lua_my_routines', JSON.stringify(updated));
    setMyRoutines(updated);
  };

  const removeRoutine = (id, targetMode) => {
    const updated = myRoutines.filter(r => !(r.id === id && r.mode === targetMode));
    localStorage.setItem('lua_my_routines', JSON.stringify(updated));
    setMyRoutines(updated);
  };

  const allItemsRaw = [
    ...myRoutines.filter(r => r.mode === mode),
    ...products.map(p => ({
      id: p.id,
      name: `${p.brand} ${p.name}`,
      icon: '',
      type: 'product',
      category: p.category,
      imageThumb: p.imageThumb || thumbMap.get(String(p.id)) || null,
    })),
  ];

  // ===== 자동 표준 정렬 (스킨케어 순서) =====
  // 클렌저 → 토너 → 에센스 → 세럼 → 크림 → 선크림 → 마스크팩 → 기타
  // 같은 카테고리 내에서는 등록 순서(원본 인덱스) 유지
  const CATEGORY_ORDER = ['클렌저', '토너', '에센스', '세럼', '크림', '선크림', '마스크팩', '기타'];
  const inferCategory = (item) => {
    if (item.category && CATEGORY_ORDER.includes(item.category)) return item.category;
    const text = `${item.name || ''} ${item.id || ''}`;
    if (/클렌저|클렌징|폼|워시|cleans/i.test(text) || item.id === '_wash') return '클렌저';
    if (/토너|toner|스킨/.test(text) && !/선|크림/.test(text)) return '토너';
    if (/에센스|essence/i.test(text)) return '에센스';
    if (/세럼|serum|앰플/i.test(text)) return '세럼';
    if (/선크림|sunscreen|spf|자외선|선블록/i.test(text) || item.id === '_sun') return '선크림';
    if (/마스크|mask|팩/i.test(text) || item.id === '_mask') return '마스크팩';
    if (/크림|cream|로션|lotion|모이스/i.test(text) || item.id === '_moist') return '크림';
    if (item.id === '_water') return '토너';
    return '기타';
  };
  // 사용자가 수동으로 정한 순서가 있으면 우선 (mode별)
  const manualOrder = (() => {
    try { return JSON.parse(localStorage.getItem('lua_care_manual_order') || '{}')[mode] || null; } catch { return null; }
  })();
  let allItemsSorted;
  if (manualOrder && Array.isArray(manualOrder)) {
    const byId = new Map(allItemsRaw.map(i => [i.id, i]));
    const ordered = manualOrder.map(id => byId.get(id)).filter(Boolean);
    // 새로 등록된 (manual order에 없는) 항목은 자동 표준 정렬 규칙으로 뒤에 붙임
    const remaining = allItemsRaw
      .filter(i => !manualOrder.includes(i.id))
      .map((item, originalIdx) => ({ item, originalIdx, catRank: CATEGORY_ORDER.indexOf(inferCategory(item)) }))
      .sort((a, b) => (a.catRank !== b.catRank) ? a.catRank - b.catRank : a.originalIdx - b.originalIdx)
      .map(x => x.item);
    allItemsSorted = [...ordered, ...remaining];
  } else {
    allItemsSorted = allItemsRaw
      .map((item, originalIdx) => ({ item, originalIdx, catRank: CATEGORY_ORDER.indexOf(inferCategory(item)) }))
      .sort((a, b) => (a.catRank !== b.catRank) ? a.catRank - b.catRank : a.originalIdx - b.originalIdx)
      .map(x => x.item);
  }

  // Only show items active today
  const allItems = allItemsSorted.filter(item => isActiveToday(item.id));

  // Drag to reorder
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [reorderMode, setReorderMode] = useState(false);
  const dragStartY = useRef(null);
  const dragItemHeight = useRef(50);

  const reorderRoutines = (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    const modeItems = myRoutines.filter(r => r.mode === mode);
    const otherItems = myRoutines.filter(r => r.mode !== mode);
    const reordered = [...modeItems];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const updated = [...otherItems, ...reordered];
    localStorage.setItem('lua_my_routines', JSON.stringify(updated));
    setMyRoutines(updated);
  };

  const handleDragStart = (idx, e) => {
    e.preventDefault();
    setDragIdx(idx);
    setDragOverIdx(idx);
    dragStartY.current = e.touches[0].clientY;
  };

  const handleDragMove = (e) => {
    if (dragIdx === null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    const offset = Math.round(dy / dragItemHeight.current);
    const newIdx = Math.max(0, Math.min(allItems.length - 1, dragIdx + offset));
    setDragOverIdx(newIdx);
  };

  const handleDragEnd = () => {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      // Map allItems indices back to myRoutines indices for this mode
      const modeItems = myRoutines.filter(r => r.mode === mode);
      const activeIds = allItems.map(i => i.id);
      const fromModeIdx = modeItems.findIndex(r => r.id === activeIds[dragIdx]);
      const toModeIdx = modeItems.findIndex(r => r.id === activeIds[dragOverIdx]);
      if (fromModeIdx >= 0 && toModeIdx >= 0) {
        reorderRoutines(fromModeIdx, toModeIdx);
      }
    }
    setDragIdx(null);
    setDragOverIdx(null);
    dragStartY.current = null;
  };

  // Which recommend items are already added for the addMode
  const addedIds = myRoutines.filter(r => r.mode === addMode).map(r => r.id);

  const handleToggle = (id) => {
    if (id.startsWith('_')) {
      // Recommended routine — selectedDate 기반 키 (지난 날짜 수정 지원)
      const key = `lua_routine_${selectedDate}`;
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      saved[id] = !saved[id];
      localStorage.setItem(key, JSON.stringify(saved));
      setChecks({ ...checks }); // force re-render
    } else {
      const updated = toggleTrackerCheck(mode, id, selectedDate);
      setChecks(updated);
    }
  };

  const isChecked = (id) => {
    if (id.startsWith('_')) {
      const key = `lua_routine_${selectedDate}`;
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      return !!saved[id];
    }
    return !!checks[mode]?.[id];
  };

  const totalDone = allItems.filter(item => isChecked(item.id)).length;
  const totalItems = allItems.length;
  const pct = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0;

  const glass = { background: 'rgba(255,255,255,0.42)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', borderRadius: 18 };

  // 주 단위 weekDays 빌더 — carousel용 3개 주(이전·현재·다음) 렌더에 재사용
  const buildWeek = (offset) => {
    const dayLabels = ['일','월','화','수','목','금','토'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - d.getDay() + i + offset * 7);
      const dateStr = _care_dateStr(d);
      return {
        date: dateStr,
        dayLabel: dayLabels[d.getDay()],
        isToday: dateStr === _care_todayStr(),
        isSelected: dateStr === selectedDate,
        isFuture: dateStr > _care_todayStr(),
      };
    });
  };
  const prevWeek = buildWeek(weekStartOffset - 1);
  const currentWeek = buildWeek(weekStartOffset);
  const nextWeek = buildWeek(weekStartOffset + 1);
  // 기존 코드와 호환
  const weekDays = currentWeek;

  // ── Carousel 드래그 (Apple 캘린더 스타일) ──
  // 3개 주(prev/current/next)를 가로로 렌더하고 dragX만큼 translate.
  // 드래그 종료 시 임계 넘으면 snap + weekStartOffset 변경. 햅틱은 임계 넘는 순간.
  const carouselRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const swipeState = useRef({ x: 0, y: 0, axis: null, moved: false });
  const hapticArmed = useRef(true); // 임계 넘는 순간 한 번만 햅틱

  const onCarouselTouchStart = (e) => {
    const t = e.touches?.[0]; if (!t) return;
    setTransitioning(false);
    swipeState.current = { x: t.clientX, y: t.clientY, axis: null, moved: false };
    hapticArmed.current = true;
  };
  const onCarouselTouchMove = (e) => {
    const t = e.touches?.[0]; if (!t) return;
    const s = swipeState.current;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (!s.axis) {
      if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) * 1.2) s.axis = 'h';
      else if (Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx) * 1.2) s.axis = 'v';
    }
    if (s.axis === 'h') {
      s.moved = true;
      // 미래 차단·과거 8주 한계에서 저항 (rubber band)
      let constrained = dx;
      if (dx < 0 && weekStartOffset >= 0) constrained = dx * 0.25;
      if (dx > 0 && weekStartOffset <= -8) constrained = dx * 0.25;
      setDragX(constrained);
      // 임계 절반 넘는 순간 햅틱 (앱 캘린더처럼 살짝 알림)
      const w = carouselRef.current?.offsetWidth || 320;
      if (hapticArmed.current && Math.abs(dx) > w * 0.18) {
        // 한계가 아닌 경우만
        if (!(dx < 0 && weekStartOffset >= 0) && !(dx > 0 && weekStartOffset <= -8)) {
          hapticSelection();
          hapticArmed.current = false;
        }
      }
    }
  };
  const onCarouselTouchEnd = () => {
    const s = swipeState.current;
    if (s.axis !== 'h') { setDragX(0); return; }
    const w = carouselRef.current?.offsetWidth || 320;
    const THRESHOLD = Math.min(w * 0.28, 90);
    setTransitioning(true);
    if (dragX <= -THRESHOLD && weekStartOffset < 0) {
      // 다음 주로 — 완전히 -w까지 슬라이드한 뒤 weekStartOffset 변경 + dragX 리셋
      setDragX(-w);
      setTimeout(() => {
        setTransitioning(false);
        setWeekStartOffset(o => o + 1);
        setDragX(0);
      }, 280);
    } else if (dragX >= THRESHOLD && weekStartOffset > -8) {
      setDragX(w);
      setTimeout(() => {
        setTransitioning(false);
        setWeekStartOffset(o => o - 1);
        setDragX(0);
      }, 280);
    } else {
      // 원위치 (한계·임계 미달)
      setDragX(0);
      setTimeout(() => setTransitioning(false), 280);
    }
  };

  return (
    <div style={{ padding: '20px 20px 0' }}>
      {/* Weekly Calendar Carousel — 3개 주를 가로로 렌더, 손가락 따라 부드럽게 transform */}
      <div
        ref={carouselRef}
        onTouchStart={onCarouselTouchStart}
        onTouchMove={onCarouselTouchMove}
        onTouchEnd={onCarouselTouchEnd}
        onTouchCancel={onCarouselTouchEnd}
        style={{
          overflow: 'hidden', marginBottom: 16, touchAction: 'pan-y',
          // 인접 주 영역 — 좌우로 살짝 padding 두어 살짝 미리 보이게도 가능. 현재 0.
        }}
      >
        <div style={{
          display: 'flex',
          width: '300%',
          transform: `translateX(calc(-33.3333% + ${dragX}px))`,
          transition: transitioning ? 'transform 0.28s cubic-bezier(0.32,0.72,0,1)' : 'none',
          willChange: 'transform',
        }}>
          {[prevWeek, currentWeek, nextWeek].map((week, weekIdx) => (
            <div key={weekIdx} style={{ flex: '0 0 33.3333%', display: 'flex', gap: 6 }}>
              {week.map(day => (
                <button
                  key={day.date}
                  onClick={() => {
                    if (day.isFuture || swipeState.current.moved) return;
                    hapticLight();
                    setSelectedDate(day.date);
                  }}
                  disabled={day.isFuture}
                  style={{
                    flex: 1, textAlign: 'center', padding: '10px 0 8px', borderRadius: 12,
                    background: day.isSelected ? 'var(--accent-primary, var(--accent-primary))' : day.isToday ? 'var(--day-today-bg)' : 'var(--day-default-bg)',
                    color: day.isSelected ? '#fff' : 'inherit',
                    border: 'none', cursor: day.isFuture ? 'default' : 'pointer',
                    opacity: day.isFuture ? 0.3 : 1,
                    fontFamily: 'inherit',
                    WebkitTapHighlightColor: 'transparent',
                    minWidth: 0, // flex 안 안전
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2,
                    color: day.isSelected ? '#fff' : day.isToday ? 'var(--day-today-accent)' : 'var(--text-muted)',
                  }}>{day.dayLabel}</div>
                  <div style={{ fontSize: 15, fontWeight: 700,
                    color: day.isSelected ? '#fff' : day.isToday ? 'var(--day-today-accent)' : 'var(--text-primary)',
                  }}>{new Date(day.date + 'T12:00:00').getDate()}</div>
                  {day.isToday && !day.isSelected && <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--day-today-accent)', margin: '4px auto 0' }} />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Morning / Day / Night Toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'morning', label: ' 모닝' },
          { key: 'day', label: ' 데이' },
          { key: 'night', label: ' 나이트' },
        ].map(m => (
          <button key={m.key} onClick={() => setMode(m.key)} style={{
            flex: 1, padding: '12px 0', borderRadius: 18, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600, textAlign: 'center',
            background: mode === m.key ? 'rgba(255,255,255,0.42)' : 'transparent',
            color: mode === m.key ? 'var(--text-primary)' : 'var(--text-muted)',
            backdropFilter: mode === m.key ? 'blur(14px)' : 'none', WebkitBackdropFilter: mode === m.key ? 'blur(14px)' : 'none',
            border: 'none',
            boxShadow: mode === m.key ? '0 2px 12px rgba(0,0,0,0.05)' : 'none',
            transition: 'all 0.2s',
          }}>{m.label}</button>
        ))}
      </div>

      {/* Progress + 일괄 체크·정렬 controls */}
      <div style={{ ...glass, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3.5" />
            <circle cx="22" cy="22" r="19" fill="none" stroke="var(--accent-primary, var(--accent-primary))" strokeWidth="3.5"
              strokeDasharray={`${(pct / 100) * 119.38} 119.38`} strokeLinecap="round" transform="rotate(-90 22 22)"
              style={{ transition: 'stroke-dasharray 0.5s ease' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{pct}%</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{mode === 'morning' ? '모닝' : mode === 'day' ? '데이' : '나이트'} 케어 달성률</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{totalDone} / {totalItems} 완료</div>
        </div>
      </div>

      {/* 일괄 체크 — 큰 CTA. 모두 체크 시 색 변경 */}
      {allItems.length > 0 && (() => {
        const allChecked = totalDone === totalItems && totalItems > 0;
        return (
          <button
            onClick={() => {
              hapticMedium();
              const result = bulkToggleCheck(mode === 'day' ? 'morning' : mode, selectedDate);
              setChecks(result.checks);
            }}
            style={{
              width: '100%', padding: '12px 16px', marginBottom: 16,
              background: allChecked ? 'rgba(var(--accent-rgb),0.18)' : 'linear-gradient(135deg, var(--accent-primary), #8ac4fe)',
              border: allChecked ? '1px solid rgba(var(--accent-rgb),0.4)' : 'none',
              borderRadius: 14,
              color: allChecked ? '#3D7CA8' : '#fff',
              fontSize: 14, fontWeight: 700, letterSpacing: -0.2,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: allChecked ? 'none' : '0 4px 14px rgba(var(--accent-rgb),0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {allChecked ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3D7CA8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/>
                </svg>
                <span>모두 체크 해제</span>
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L20 7"/>
                </svg>
                <span>오늘 모두 발랐어요</span>
              </>
            )}
          </button>
        );
      })()}

      {/* Checklist */}
      <div onTouchMove={handleDragMove} onTouchEnd={handleDragEnd} style={{ ...glass, padding: '6px 0', marginBottom: 16 }}>
        {allItems.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            케어 항목 추가 버튼으로 루틴을 추가해보세요
          </div>
        ) : (
          allItems.map((item, i) => {
            const checked = isChecked(item.id);
            const isDragging = dragIdx === i;
            const isOver = dragOverIdx === i && dragIdx !== null && dragIdx !== i;
            return (
              <SwipeableRow
                key={item.id}
                rowId={item.id}
                openRowId={openSwipeRowId}
                setOpenRowId={setOpenSwipeRowId}
                onDelete={() => handleSwipeDelete(item)}
                onMoveUp={i > 0 ? () => handleSwipeMove(item, allItems, 'up') : null}
                onMoveDown={i < allItems.length - 1 ? () => handleSwipeMove(item, allItems, 'down') : null}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '13px 14px 13px 14px',
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,0.15)' : 'none',
                  opacity: isDragging ? 0.4 : checked ? 0.5 : 1,
                  background: isOver ? 'rgba(var(--accent-rgb),0.1)' : 'rgba(255,255,255,0.0)',
                  transition: 'opacity 0.2s, background 0.15s',
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(var(--accent-rgb),0.14)',
                    color: 'var(--accent-primary)', fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'inherit',
                  }}>{i + 1}</div>
                  {/* 누끼 이미지(등록 제품) 또는 카테고리 아이콘/이모지 */}
                  {item.imageThumb ? (
                    <img
                      src={item.imageThumb}
                      alt=""
                      style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: '#fff' }}
                      onError={(e) => {
                        const parent = e.currentTarget.parentNode;
                        if (parent) {
                          const fb = document.createElement('div');
                          fb.style.cssText = 'width:32px;height:32px;border-radius:8px;background:rgba(var(--accent-rgb),0.1);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;';
                          fb.textContent = '';
                          parent.insertBefore(fb, e.currentTarget);
                          e.currentTarget.remove();
                        }
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 18, width: 22, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                  )}
                  <div onClick={() => setDetailItem(item)} style={{ flex: 1, cursor: 'pointer' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textDecoration: checked ? 'line-through' : 'none' }}>{item.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                      {(() => {
                        const days = getItemDays(item.id);
                        const allDays = days.every(Boolean);
                        if (allDays) return '매일';
                        const active = days.map((d, idx) => d ? dayLabels[idx] : null).filter(Boolean);
                        return active.length > 0 ? active.join(' · ') : '비활성';
                      })()}
                    </div>
                  </div>
                  <div onClick={(e) => { e.stopPropagation(); handleToggle(item.id); }} style={{
                    width: 24, height: 24, borderRadius: 8, flexShrink: 0, cursor: 'pointer',
                    border: checked ? 'none' : '2px solid rgba(255,255,255,0.4)',
                    background: checked ? 'var(--accent-primary, var(--accent-primary))' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}>
                    {checked && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                </div>
              </SwipeableRow>
            );
          })
        )}
      </div>

      {/* Routine Detail Modal */}
      {detailItem && createPortal(
        <>
          <div onClick={() => setDetailItem(null)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(4,44,83,0.18)', backdropFilter: 'none', WebkitBackdropFilter: 'none' }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
            background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none',
            border: 'none', borderRadius: '20px 20px 0 0',
            boxShadow: '0 -8px 28px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.4)',
            paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 16px)',
            maxWidth: 430, margin: '0 auto',
            animation: 'careSheetUp 280ms cubic-bezier(0.32,0.72,0,1) forwards',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(var(--accent-rgb),0.4)' }} />
            </div>
            <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{detailItem.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{detailItem.name}</span>
              </div>
              <div onClick={() => setDetailItem(null)} style={{ width: 32, height: 32, borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </div>
            </div>
            <div style={{ padding: '0 16px 16px' }}>
              {/* Day selector */}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 10 }}>반복 요일</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                {dayLabels.map((label, idx) => {
                  const days = getItemDays(detailItem.id);
                  const active = days[idx];
                  return (
                    <div key={idx} onClick={() => toggleDay(detailItem.id, idx)} style={{
                      flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 12, cursor: 'pointer',
                      background: active ? 'rgba(var(--accent-rgb),0.2)' : 'rgba(255,255,255,0.3)',
                      border: active ? '1px solid rgba(var(--accent-rgb),0.4)' : '1px solid rgba(255,255,255,0.3)',
                      transition: 'all 0.2s',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--accent-primary, var(--accent-primary))' : 'var(--text-muted)' }}>{label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Quick presets */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {[
                  { label: '매일', days: [true,true,true,true,true,true,true] },
                  { label: '평일', days: [false,true,true,true,true,true,false] },
                  { label: '주말', days: [true,false,false,false,false,false,true] },
                ].map(preset => (
                  <button key={preset.label} onClick={() => {
                    const key = `${detailItem.id}_${mode}`;
                    const next = { ...daySettings, [key]: preset.days };
                    localStorage.setItem('lua_routine_days', JSON.stringify(next));
                    setDaySettings(next);
                  }} style={{
                    flex: 1, padding: '8px 0', borderRadius: 18, border: 'none', cursor: 'pointer',
                    background: 'rgba(255,255,255,0.42)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                    color: 'var(--text-primary)',
                    fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                  }}>{preset.label}</button>
                ))}
              </div>

              {/* Delete routine */}
              <button onClick={() => {
                removeRoutine(detailItem.id, mode);
                setDetailItem(null);
              }} style={{
                width: '100%', padding: 12, borderRadius: 12, border: 'none',
                background: 'rgba(0,0,0,0.25)', color: '#fff',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              }}>이 루틴 삭제</button>
            </div>
          </div>
        </>,
        document.body,
      )}

      {/* Add Routine Button */}
      <div onClick={() => { setAddMode(mode); setAddModal(true); }} style={{
        padding: '12px 24px', marginBottom: 16, cursor: 'pointer',
        background: 'rgba(255,255,255,0.42)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        border: 'none', borderRadius: 18,
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>케어 항목 추가</span>
      </div>

      {/* Add Routine Modal */}
      {addModal && createPortal(
        <>
          <div onClick={() => setAddModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(4,44,83,0.18)', backdropFilter: 'none', WebkitBackdropFilter: 'none' }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
            background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none',
            border: 'none', borderRadius: '20px 20px 0 0',
            boxShadow: '0 -8px 28px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.4)',
            paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 16px)',
            maxWidth: 430, maxHeight: '70vh', overflowY: 'auto', margin: '0 auto',
            animation: 'careSheetUp 280ms cubic-bezier(0.32,0.72,0,1) forwards',
          }}>
            <style>{`@keyframes careSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(var(--accent-rgb),0.4)' }} />
            </div>
            <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>케어 항목 추가</span>
              <div onClick={() => setAddModal(false)} style={{ width: 32, height: 32, borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </div>
            </div>
            <div style={{ padding: '0 16px' }}>
              {/* Mode selector */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[{ key: 'morning', label: ' 모닝' }, { key: 'day', label: ' 데이' }, { key: 'night', label: ' 나이트' }].map(m => (
                  <button key={m.key} onClick={() => setAddMode(m.key)} style={{
                    flex: 1, padding: '10px 0', borderRadius: 18, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 13, fontWeight: 600, textAlign: 'center',
                    background: addMode === m.key ? 'rgba(255,255,255,0.42)' : 'transparent',
                    color: addMode === m.key ? 'var(--text-primary)' : 'var(--text-muted)',
                    backdropFilter: addMode === m.key ? 'blur(14px)' : 'none', WebkitBackdropFilter: addMode === m.key ? 'blur(14px)' : 'none',
                    border: 'none',
                    boxShadow: addMode === m.key ? '0 2px 12px rgba(0,0,0,0.05)' : 'none',
                  }}>{m.label}</button>
                ))}
              </div>

              {/* Recommended routines */}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 8 }}>추천 루틴</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {recommendedRoutines.map(r => {
                  const added = addedIds.includes(r.id);
                  return (
                    <div key={r.id} onClick={() => {
                      if (added) removeRoutine(r.id, addMode);
                      else addRoutine(r, addMode);
                    }} style={{
                      padding: '8px 14px', borderRadius: 20, cursor: 'pointer',
                      fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6,
                      background: added ? 'rgba(var(--accent-rgb),0.15)' : 'rgba(255,255,255,0.4)',
                      color: added ? 'var(--accent-primary, var(--accent-primary))' : 'var(--text-primary)',
                      border: added ? '1px solid rgba(var(--accent-rgb),0.3)' : '1px solid rgba(255,255,255,0.3)',
                      transition: 'all 0.2s',
                    }}>
                      <span>{r.icon}</span>
                      <span>{r.name}</span>
                      {added && <span style={{ fontSize: 10 }}></span>}
                    </div>
                  );
                })}
              </div>

              {/* My products */}
              {(() => {
                const allProducts = getProducts();
                if (allProducts.length === 0) return null;
                return (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 8 }}>내 화장품</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                      {allProducts.map(p => {
                        const pid = `_product_${p.id}`;
                        const added = addedIds.includes(pid);
                        return (
                          <div key={p.id} onClick={() => {
                            if (added) removeRoutine(pid, addMode);
                            else addRoutine({ id: pid, name: `${p.brand} ${p.name}`, icon: '', type: 'product' }, addMode);
                          }} style={{
                            padding: '8px 14px', borderRadius: 20, cursor: 'pointer',
                            fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6,
                            background: added ? 'rgba(var(--accent-rgb),0.15)' : 'rgba(255,255,255,0.4)',
                            color: added ? 'var(--accent-primary, var(--accent-primary))' : 'var(--text-primary)',
                            border: added ? '1px solid rgba(var(--accent-rgb),0.3)' : '1px solid rgba(255,255,255,0.3)',
                            transition: 'all 0.2s',
                          }}>
                            <span></span>
                            <span>{p.brand} {p.name}</span>
                            {added && <span style={{ fontSize: 10 }}></span>}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}

              {/* Custom input */}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 8 }}>직접 입력</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && customName.trim()) { addCustomRoutine(customName.trim(), addMode); setCustomName(''); } }}
                  placeholder="예: 유산균 먹기"
                  style={{
                    flex: 1, background: '#ffffff', border: 'none',
                    borderRadius: 12, padding: '11px 14px', fontSize: 13, color: 'var(--text-primary)',
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
                <button onClick={() => {
                  if (customName.trim()) { addCustomRoutine(customName.trim(), addMode); setCustomName(''); }
                }} style={{
                  padding: '11px 18px', borderRadius: 12, border: 'none',
                  background: customName.trim() ? 'var(--accent-primary, var(--accent-primary))' : 'rgba(var(--accent-rgb),0.2)',
                  color: customName.trim() ? '#fff' : 'var(--text-muted)',
                  fontSize: 13, fontWeight: 500, cursor: customName.trim() ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                }}>추가</button>
              </div>
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

// ===== Care Embed (CarePage 전체 요소) =====
function CareEmbed({ onOpenConsult, onMeasure, onAddProduct }) {
  const HABIT_KEY = 'lua_habit_';
  const getTodayKey = () => HABIT_KEY + new Date().toISOString().slice(0, 10);
  const getHabitLog = () => { try { return JSON.parse(localStorage.getItem(getTodayKey()) || '{}'); } catch { return {}; } };
  const saveHabitLog = (data) => { const c = getHabitLog(); const m = { ...c, ...data }; localStorage.setItem(getTodayKey(), JSON.stringify(m)); return m; };

  const [habit, setHabit] = useState(getHabitLog);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(false);
  const waterGoal = 2000;
  const recordCount = getRecords().length;
  const refreshHabit = () => setHabit(getHabitLog());
  const showToast = () => { setToast(true); setTimeout(() => setToast(false), 2000); };

  const waterL = ((habit.water_amount || 0) / 1000).toFixed(1);
  const sleepH = habit.sleep_hours;
  const sunscreen = habit.sunscreen_applied;

  const glass = { background: 'rgba(255,255,255,0.42)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', borderRadius: 18 };

  const summaryParts = [];
  if (habit.water_amount) summaryParts.push(`수분 ${waterL}L`);
  if (sleepH != null) summaryParts.push(`어젯밤 ${sleepH}시간 잠`);
  if (sunscreen === true) summaryParts.push('선크림 챙김');
  if (sunscreen === false) summaryParts.push('자외선 아직');

  const HabitCard = ({ icon, label, value, meta, metaHL, progress, onTap }) => (
    <div onClick={onTap} style={{ ...glass, borderRadius: 20, padding: '12px 10px', textAlign: 'center', cursor: 'pointer' }}>
      <div style={{ width: 36, height: 36, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{icon}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginTop: 8 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 10, marginTop: 1, color: metaHL ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: metaHL ? 500 : 400 }}>{meta}</div>
      <div style={{ marginTop: 8, height: 3, borderRadius: 1.5, background: '#ffffff', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 1.5, background: 'var(--accent-primary)', width: `${Math.min(progress, 1) * 100}%`, transition: 'width 0.4s' }} />
      </div>
    </div>
  );

  const closeModal = () => setModal(null);
  const ModalWrap = ({ title, children }) => createPortal(
    <>
      <div onClick={closeModal} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(4,44,83,0.18)', backdropFilter: 'none', WebkitBackdropFilter: 'none' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201, background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none', border: 'none', borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 28px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.4)', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 16px)', maxWidth: 430, margin: '0 auto', animation: 'careSheetUp 280ms cubic-bezier(0.32,0.72,0,1) forwards' }}>
        <style>{`@keyframes careSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}><div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(var(--accent-rgb),0.4)' }} /></div>
        <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</span>
          <button onClick={closeModal} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding: '0 16px 16px' }}>{children}</div>
      </div>
    </>,
    document.body,
  );

  return (
    <div>
      {/* 헤더 + 추가 버튼 */}
      <div style={{ padding: '0 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>케어</span>
        <button onClick={() => setModal('add')} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      {/* 오늘의 기록 요약 */}
      <div style={{ padding: '0 20px 14px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.45 }}>
        {summaryParts.length > 0 ? (<><span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>오늘 두고 있는 것들</span> · {summaryParts.join(' · ')}</>) : '오늘의 기록을 시작해볼까요?'}
      </div>

      {/* 섹션 헤더: 오늘의 기록 */}
      <div style={{ padding: '6px 20px 8px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: 0.3, textTransform: 'uppercase' }}>오늘의 기록</div>

      {/* 습관 카드 3개 */}
      <div style={{ padding: '0 12px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <HabitCard icon="" label="수분" value={`${waterL}L`} meta={`목표 ${waterGoal/1000}L`} progress={(habit.water_amount||0)/waterGoal} onTap={() => setModal('water')} />
        <HabitCard icon="" label="수면" value={sleepH != null ? `${sleepH}h` : '—'} meta={sleepH != null ? '어젯밤' : '어젯밤 두기'} progress={sleepH != null ? sleepH/8 : 0} onTap={() => setModal('sleep')} />
        <HabitCard icon="" label="자외선" value={sunscreen === true ? '' : '—'} meta={sunscreen === true ? '선크림 챙김' : '아직'} metaHL={sunscreen === true} progress={sunscreen === true ? 1 : 0} onTap={() => setModal('sunscreen')} />
      </div>

      {/* lua의 피부 발견 */}
      {recordCount >= 2 && (
        <div onClick={() => onOpenConsult?.()} style={{ padding: '0 16px 12px', cursor: 'pointer' }}>
          <div style={{ ...glass, padding: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.7), rgba(172,226,252,0.35))', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="10" height="10" viewBox="0 0 24 24"><path fill="#6598ef" d="M10.48,23.25c-.15.41-.5.71-.86.75-.27.03-.78-.29-.9-.59l-1.53-4.02c-.48-1.26-1.41-2.1-2.67-2.58l-3.91-1.48c-.29-.11-.59-.51-.6-.76-.01-.39.23-.79.6-.93l3.9-1.49c1.27-.48,2.19-1.31,2.68-2.59l1.57-4.14c.08-.2.52-.44.74-.46.24-.02.77.21.86.46l1.57,4.14c.5,1.32,1.47,2.15,2.78,2.63l3.7,1.37c.31.11.66.55.67.83.02.42-.29.82-.68.97l-3.8,1.44c-1.26.48-2.2,1.32-2.67,2.58l-1.45,3.86Z"/><path fill="#6598ef" d="M21.48,6.29c-1.03.59-.9,2.91-2.01,2.98-1.23.08-.99-1.68-1.94-2.78-.77-.88-2.68-.63-2.74-1.78-.07-1.27,2.01-1.1,2.74-1.91.87-.95.73-2.72,1.78-2.8,1.29-.1.98,1.81,1.95,2.77.87.86,2.67.71,2.73,1.8.07,1.08-1.29,1.02-2.51,1.72Z"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5 }}>수분이 충분한 주에는 모공 점수가 평균 4점 더 좋았어요.</div>
              <span style={{ display: 'inline-block', marginTop: 5, fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 8, background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent-primary)' }}>피부 발견</span>
            </div>
          </div>
        </div>
      )}

      {/* 영역 구분선 */}
      <div style={{ height: 6, background: '#ffffff', margin: '8px 0 4px' }} />

      {/* 섹션 헤더: 화장품 */}
      <div style={{ padding: '6px 20px 8px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: 0.3, textTransform: 'uppercase' }}>화장품</div>

      {/* 화장품 빈 상태 */}
      <div style={{ padding: '0 12px 12px' }}>
        <div style={{ ...glass, padding: '32px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, opacity: 0.3, marginBottom: 8 }}></div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>아직 등록된 화장품이 없어요</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>지금 쓰는 화장품을 등록해보세요</div>
          <button onClick={() => onAddProduct?.()} style={{ background: 'var(--accent-primary)', color: '#fff', fontSize: 11, fontWeight: 500, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>+ 추가하기</button>
        </div>
      </div>

      {/* 입력 모달들 */}
      {modal === 'add' && (
        <ModalWrap title="추가">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[{ label: '수분 두기', icon: '', key: 'water' }, { label: '수면 두기', icon: '', key: 'sleep' }, { label: '자외선 두기', icon: '', key: 'sunscreen' }].map(item => (
              <button key={item.key} onClick={() => setModal(item.key)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#ffffff', border: 'none', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textAlign: 'left' }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
        </ModalWrap>
      )}
      {modal === 'water' && (() => {
        const WF = () => {
          const [amt, setAmt] = useState(habit.water_amount || 0);
          const add = (ml) => { const n = amt + ml; setAmt(n); saveHabitLog({ water_amount: n }); refreshHabit(); showToast(); };
          return (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>한 모금 더 두기</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {[{ml:200,l:'한 컵'},{ml:250,l:'텀블러'},{ml:330,l:'병'},{ml:500,l:'큰 병'}].map(b=>(
                  <button key={b.ml} onClick={()=>add(b.ml)} style={{ flex:1, background:'rgba(255,255,255,0.4)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:12, padding:'10px 4px', fontSize:11, fontWeight:500, color:'var(--text-primary)', cursor:'pointer', fontFamily:'inherit', textAlign:'center' }}>+{b.ml}ml<br/><span style={{fontSize:10,color:'var(--text-muted)',fontWeight:400}}>{b.l}</span></button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>오늘 누적 · {(amt/1000).toFixed(1)}L / {waterGoal/1000}L</div>
              <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: '#ffffff', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent-primary)', width: `${Math.min(amt/waterGoal,1)*100}%` }} />
              </div>
            </div>
          );
        };
        return <ModalWrap title="수분 두기"><WF /></ModalWrap>;
      })()}
      {modal === 'sleep' && (() => {
        const SF = () => {
          const [hrs, setHrs] = useState(habit.sleep_hours ?? 7);
          return (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 16 }}>어젯밤 수면 시간</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 20 }}>
                <button onClick={()=>setHrs(Math.max(0,hrs-0.5))} style={{ width:44,height:44,borderRadius:'50%',border:'none',background:'rgba(255,255,255,0.4)',fontSize:20,cursor:'pointer',color:'var(--text-primary)',display:'flex',alignItems:'center',justifyContent:'center' }}>−</button>
                <div style={{ fontSize:32,fontWeight:500,color:'var(--text-primary)' }}>{hrs}<span style={{fontSize:16,color:'var(--text-muted)'}}>h</span></div>
                <button onClick={()=>setHrs(Math.min(12,hrs+0.5))} style={{ width:44,height:44,borderRadius:'50%',border:'none',background:'rgba(255,255,255,0.4)',fontSize:20,cursor:'pointer',color:'var(--text-primary)',display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
              </div>
              <button onClick={()=>{saveHabitLog({sleep_hours:hrs});refreshHabit();showToast();closeModal();}} style={{ width:'100%',padding:14,borderRadius:10,border:'none',background:'var(--accent-primary)',color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit' }}>두기</button>
            </div>
          );
        };
        return <ModalWrap title="수면 두기"><SF /></ModalWrap>;
      })()}
      {modal === 'sunscreen' && (() => {
        const UF = () => {
          const [applied, setApplied] = useState(habit.sunscreen_applied ?? null);
          return (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button onClick={()=>setApplied(true)} style={{ flex:1, padding:'16px 12px', borderRadius:20, border:applied===true?'none':'1px solid rgba(255,255,255,0.3)', cursor:'pointer', fontFamily:'inherit', background:applied===true?'var(--accent-primary)':'rgba(255,255,255,0.4)', color:applied===true?'#fff':'var(--text-primary)', fontSize:13, fontWeight:500, textAlign:'center' }}>선크림 챙겼어요</button>
                <button onClick={()=>setApplied(false)} style={{ flex:1, padding:'16px 12px', borderRadius:20, border:applied===false?'1px solid var(--accent-primary)':'1px solid rgba(255,255,255,0.3)', cursor:'pointer', fontFamily:'inherit', background:'rgba(255,255,255,0.4)', color:'var(--text-primary)', fontSize:13, fontWeight:500, textAlign:'center' }}>오늘은 못 챙겼어요</button>
              </div>
              <button onClick={()=>{if(applied!==null){saveHabitLog({sunscreen_applied:applied});refreshHabit();showToast();closeModal();}}} disabled={applied===null} style={{ width:'100%',padding:14,borderRadius:10,border:'none',background:applied!==null?'var(--accent-primary)':'rgba(var(--accent-rgb),0.2)',color:applied!==null?'#fff':'var(--text-muted)',fontSize:13,fontWeight:500,cursor:applied!==null?'pointer':'default',fontFamily:'inherit' }}>두기</button>
            </div>
          );
        };
        return <ModalWrap title="자외선 두기"><UF /></ModalWrap>;
      })()}

      {toast && (
        <div style={{ position:'fixed',bottom:120,left:'50%',transform:'translateX(-50%)',background:'var(--accent-primary)',color:'#fff',padding:'10px 24px',borderRadius:20,fontSize:13,fontWeight:500,zIndex:999 }}>기록되었어요</div>
      )}
    </div>
  );
}
