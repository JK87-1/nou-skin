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
import { ChartIcon, CameraIcon, MicroscopeIcon, SparkleIcon, DiamondIcon, DropletIcon, RulerIcon, PaletteIcon, LotionIcon, EyeIcon, BubbleIcon, TargetIcon, ClockIcon, LuaMiniIcon } from '../components/icons/PastelIcons';

// ===== MINI LINE GRAPH (Canvas-based, no dependencies) =====
function TrendGraph({ data, color = '#ADEBB3', height = 160, metricKey = 'skinAge', inverse = false, showAllLabels = false }) {
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
export default function HistoryPage({ onBack, onMeasure, onOpenConsult, initialMode }) {
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
    { key: 'skinAge', label: '피부나이', color: '#ADEBB3', inverse: true },
    { key: 'overallScore', label: '종합점수', color: '#ADEBB3', inverse: false },
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
      {/* Mode Toggle */}
      <div style={{ padding: '12px 20px 16px' }}>
        <div className="segment-control">
          <button className={`segment-btn${mode === 'care' ? ' active' : ''}`}
            onClick={() => setMode('care')}>케어</button>
          <button className={`segment-btn${mode === 'mission' ? ' active' : ''}`}
            onClick={() => setMode('mission')}>미션</button>
          <button className={`segment-btn${mode === 'insights' ? ' active' : ''}`}
            onClick={() => setMode('insights')}>분석</button>
          <button className={`segment-btn${mode === 'gallery' ? ' active' : ''}`}
            onClick={() => setMode('gallery')}>앨범</button>
        </div>
      </div>

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

      {/* ===== CARE MODE (embedded) ===== */}
      {mode === 'care' && (
        <div style={{ animation: 'breatheIn 0.6s ease both' }}>
          <CareEmbed onOpenConsult={onOpenConsult} onMeasure={onMeasure} />
        </div>
      )}

      {/* ===== MISSION MODE ===== */}
      {mode === 'mission' && (
        <div style={{ animation: 'breatheIn 0.6s ease both' }}>
          <DailyMission />
        </div>
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
            <div style={{ padding: '24px 20px 0', animation: 'breatheIn 0.6s ease both' }}>
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
                          background: 'linear-gradient(135deg, rgba(240,144,112,0.06), rgba(240,144,112,0.1))',
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
            {/* === HEADER === */}
            <div style={{ paddingTop: 20, marginBottom: 20, animation: 'breatheIn 0.6s ease both' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text-muted)' }}>SKIN TIMELINE</span>
                {period > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#fff',
                    background: 'rgba(255,120,50,0.2)', border: '1px solid rgba(255,120,50,0.3)',
                    borderRadius: 20, padding: '2px 10px',
                  }}><span style={{ color: '#FF6B35' }}>●</span> {period}일째</span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>나의 피부 여정</h2>
                <div style={{
                  display: 'flex', background: 'var(--bg-card)',
                  borderRadius: 10, padding: 3, gap: 2,
                }}>
                  {['timeline', 'compare'].map(m => (
                    <button key={m} onClick={() => setInsightMode(m)} style={{
                      border: insightMode === m ? '1.5px solid rgba(255,255,255,0.25)' : '1.5px solid transparent',
                      background: insightMode === m ? 'var(--bg-input)' : 'transparent',
                      color: insightMode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                      borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>{m === 'timeline' ? '타임라인' : '비교'}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* === SUMMARY CARDS === */}
            {totalChanges && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, animation: 'breatheIn 0.6s ease 0.1s both' }}>
                <div style={{
                  flex: 1, background: 'var(--bg-card)',
                  border: 'none', borderRadius: 16, padding: '14px 16px',
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
                  flex: 1, background: 'var(--bg-card)',
                  border: 'none', borderRadius: 16, padding: '14px 16px',
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
            <div className="card" style={{ padding: '16px 12px', marginBottom: 16, animation: 'breatheIn 0.6s ease 0.15s both', boxShadow: 'none', border: 'none' }}>
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
              <TrendGraph
                data={getTimeSeries('overallScore')}
                color="#ADEBB3"
                height={180}
                showAllLabels
              />
            </div>

            {/* === TIMELINE MODE === */}
            {insightMode === 'timeline' && (
              <div style={{ animation: 'breatheIn 0.5s ease both' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>측정 기록</div>
                {records.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📸</div>
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
                        <div style={{ width: 1.5, height: 36, background: 'rgba(240,144,112,0.25)', borderRadius: 1, flexShrink: 0 }} />

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
                                background: '#81E4BD',
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
                            <circle cx="21" cy="21" r={ringR} fill="none" stroke="#ADEBB3" strokeWidth="3"
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
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
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
                        background: 'rgba(240,144,112,0.12)', border: '1px solid rgba(240,144,112,0.25)',
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
                        fontSize: 26, fontWeight: 900, fontFamily: 'var(--font-display)',
                        color: overallDiff >= 0 ? '#4ade80' : '#f0a050',
                      }}>{overallDiff > 0 ? '+' : ''}{overallDiff}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>점 {overallDiff >= 0 ? '상승' : '변화'}</div>
                    </div>

                    {/* Current ring */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 6px' }}>
                        <svg width="80" height="80" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r={bigR} fill="none" stroke="rgba(240,144,112,0.12)" strokeWidth="5" />
                          <circle cx="40" cy="40" r={bigR} fill="none" stroke="#ADEBB3" strokeWidth="5"
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
                      <div style={{ fontSize: 11, color: '#ADEBB3', fontWeight: 600 }}>현재</div>
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
                              background: improved || diff === 0 ? '#ADEBB3' : 'var(--text-dim)',
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
            background: 'rgba(240,144,112,0.1)', border: '1.5px solid rgba(240,144,112,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="#ADEBB3" strokeWidth="2.5" strokeLinecap="round" />
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
function RecordDetailModal({ record, thumbnail, onClose, onDelete }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  const dragStart = useRef(null);
  const sheetRef = useRef(null);

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
    if (dragY > 120) {
      setClosing(true);
      setDragY(window.innerHeight);
      setTimeout(onClose, 250);
    } else {
      setDragY(0);
    }
    dragStart.current = null;
    setIsDragging(false);
  };

  if (!record) return null;

  const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
  const d = new Date(record.date);
  const timeStr = record.timestamp ? new Date(record.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';
  const dateStr = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${dayLabels[d.getDay()]}요일${timeStr ? ` ${timeStr}` : ''}`;

  const getGrade = (score) => {
    if (score >= 85) return { letter: 'S', label: '최상', gradient: 'linear-gradient(135deg, #81E4BD, #98FBCB)', color: '#81E4BD', bg: 'rgba(125,255,192,0.12)' };
    if (score >= 70) return { letter: 'A', label: '우수', gradient: 'linear-gradient(135deg, #ADEBB3, #98FBCB)', color: '#ADEBB3', bg: 'rgba(173,235,179,0.12)' };
    if (score >= 55) return { letter: 'B', label: '양호', gradient: 'linear-gradient(135deg, #81E4BD, #ADEBB3)', color: '#81E4BD', bg: 'rgba(125,255,192,0.12)' };
    return { letter: 'C', label: '관리 필요', gradient: 'linear-gradient(135deg, #BDBDBD, #9E9E9E)', color: '#757575', bg: 'rgba(158,158,158,0.12)' };
  };

  const grade = getGrade(record.overallScore);

  const agingMetrics = [
    { label: '피부결', value: record.textureScore, icon: <LotionIcon size={16} />, color: '#FFB0C8' },
    { label: '탄력', value: record.elasticityScore, icon: <DiamondIcon size={16} />, color: '#FFD080' },
    { label: '주름', value: record.wrinkleScore, icon: <RulerIcon size={16} />, color: '#F5D0B8' },
    { label: '모공', value: record.poreScore, icon: <MicroscopeIcon size={16} />, color: '#E8D8C8' },
    { label: '색소', value: record.pigmentationScore, icon: <PaletteIcon size={16} />, color: '#C0A890' },
  ];

  const conditionMetrics = [
    { label: '수분도', value: record.moisture, icon: <DropletIcon size={16} />, color: '#A8DEFF', unit: '%' },
    { label: '유분', value: record.oilBalance, icon: <BubbleIcon size={16} />, color: '#F0E0A8', unit: '%' },
    { label: '피부톤', value: record.skinTone, icon: <SparkleIcon size={16} />, color: '#FFE082' },
    { label: '트러블', value: record.troubleCount, icon: <TargetIcon size={14} />, color: '#FFB0B0', unit: '개' },
    { label: '다크서클', value: record.darkCircleScore, icon: <EyeIcon size={16} />, color: '#C8B8E8' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: `rgba(0,0,0,${Math.max(0, 0.45 - dragY * 0.003).toFixed(2)})`,
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
          background: 'var(--bg-secondary)',
          borderRadius: '24px 24px 0 0',
          padding: '12px 20px 40px',
          maxHeight: '88vh', overflowY: dragY > 0 ? 'hidden' : 'auto',
          animation: closing ? 'none' : 'slideUp 0.3s ease-out',
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s ease-out',
        }} onClick={e => e.stopPropagation()}>
        {/* Handle bar + back/delete buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', marginBottom: 14 }}>
          <div onClick={onClose} style={{
            position: 'absolute', left: -4, top: 2,
            width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
            background: 'var(--bg-card-hover)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--bg-input)', marginTop: 10 }} />
          <div onClick={() => setShowConfirm(true)} style={{
            position: 'absolute', right: -4, top: 2,
            width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
            background: 'var(--bg-card-hover)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 12h12" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Delete confirm popup */}
        {showConfirm && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.15s ease',
          }} onClick={() => setShowConfirm(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: 'var(--bg-card)', backdropFilter: 'var(--card-backdrop)', WebkitBackdropFilter: 'var(--card-backdrop)',
              borderRadius: 20, padding: '28px 24px',
              width: 280, textAlign: 'center',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'none',
            }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>이 기록을 삭제할까요?</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>삭제된 기록은 복구할 수 없습니다.</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowConfirm(false)} style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                  background: 'var(--bg-input)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>아니오</button>
                <button onClick={() => { onDelete(record.id || record.date); setShowConfirm(false); }} style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                  background: '#e05545', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>삭제</button>
              </div>
            </div>
          </div>
        )}

        {/* Header: date */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, letterSpacing: 0.3 }}>{dateStr}</div>
        </div>

        {/* Hero: skinAge + overallScore */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, animation: 'fadeUp 0.3s ease 0.1s both' }}>
          <div style={{
            flex: 1, background: 'var(--bg-card)', borderRadius: 20,
            border: '1px solid var(--border-light)', padding: '16px 14px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>피부나이</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
              <AnimatedNumber target={record.skinAge} duration={1000} />
              <span style={{ fontSize: 16, fontWeight: 600 }}> 세</span>
            </div>
          </div>
          <div style={{
            flex: 1, background: 'var(--bg-card)', borderRadius: 20,
            border: '1px solid var(--border-light)', padding: '16px 14px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>종합 점수</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, lineHeight: 1 }}>
              <span style={{ background: grade.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                <AnimatedNumber target={record.overallScore} duration={1000} />
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}> 점</span>
            </div>
          </div>
        </div>

        {/* Photo */}
        {thumbnail && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, animation: 'popIn 0.4s ease 0.15s both' }}>
            <img src={thumbnail} alt="" style={{
              width: '100%', maxWidth: 320, height: 'auto', aspectRatio: '1/1', borderRadius: 24, objectFit: 'cover',
              border: '3px solid rgba(240,144,112,0.15)',
              boxShadow: 'none',
            }} />
          </div>
        )}

        {/* 피부 타입 정보 */}
        <div style={{
          animation: 'fadeUp 0.3s ease 0.2s both',
          background: 'var(--bg-card)', borderRadius: 22, padding: '16px 18px',
          border: '1px solid var(--border-subtle)', marginBottom: 12,
          boxShadow: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <LuaMiniIcon size={14} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>피부 타입 정보</span>
          </div>
          {/* Skin type */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>피부 타입</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{record.skinType}</span>
          </div>
          {/* Analysis mode */}
          {record.analysisMode && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>{record.analysisMode === 'hybrid' ? '🧠' : '📊'}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>분석 모드</span>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: record.analysisMode === 'hybrid' ? '#81E4BD' : 'var(--text-muted)',
                background: record.analysisMode === 'hybrid' ? 'rgba(124,92,252,0.12)' : 'rgba(184,137,110,0.1)',
                padding: '3px 10px', borderRadius: 10,
              }}>{record.analysisMode === 'hybrid' ? 'AI + CV 하이브리드' : 'CV 비전 분석'}</span>
            </div>
          )}
          {/* Confidence */}
          {record.confidence != null && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>📊</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>측정 신뢰도</span>
              </div>
              <span style={{
                fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)',
                color: record.confidence >= 70 ? '#4ecb71' : record.confidence >= 50 ? '#d4900a' : '#f06050',
              }}>{record.confidence}%</span>
            </div>
          )}
          {/* Concerns */}
          {(record.concerns || []).length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>⚡</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>관심 사항</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
                {record.concerns.map((c, i) => (
                  <span key={i} style={{
                    fontSize: 11, fontWeight: 500,
                    color: i === 0 ? '#e05545' : '#d4900a',
                    background: i === 0 ? 'rgba(240,96,80,0.1)' : 'rgba(245,166,35,0.1)',
                    border: `1px solid ${i === 0 ? 'rgba(240,96,80,0.18)' : 'rgba(245,166,35,0.18)'}`,
                    padding: '3px 10px', borderRadius: 20,
                  }}>{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 컨디션 브리핑 */}
        {(() => {
          const cScore = record.conditionScore ?? record.overallScore;
          const cGrade = cScore >= 85 ? { letter: 'S', color: '#81E4BD', bg: 'rgba(125,255,192,0.15)', border: 'rgba(125,255,192,0.3)' }
            : cScore >= 70 ? { letter: 'A', color: '#81E4BD', bg: 'rgba(124,92,252,0.15)', border: 'rgba(124,92,252,0.3)' }
            : cScore >= 55 ? { letter: 'B', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' }
            : cScore >= 40 ? { letter: 'C', color: '#8888a0', bg: 'rgba(136,136,160,0.12)', border: 'rgba(136,136,160,0.2)' }
            : { letter: 'D', color: '#f06050', bg: 'rgba(240,96,80,0.12)', border: 'rgba(240,96,80,0.2)' };
          return (
            <div style={{
              animation: 'fadeUp 0.3s ease 0.3s both',
              background: 'var(--bg-card)', borderRadius: 22, padding: '16px 18px',
              border: '1px solid var(--border-subtle)', marginBottom: 12,
              boxShadow: 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <LuaMiniIcon size={14} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>컨디션 브리핑</span>
                <div style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 8, background: cGrade.bg, border: `1px solid ${cGrade.border}`, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: cGrade.color, fontFamily: 'var(--font-display)' }}>{cGrade.letter}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: cGrade.color }}>{cScore}점</span>
                </div>
              </div>
              {record.conditionBriefing ? (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0 }}>{record.conditionBriefing}</p>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8, margin: 0, fontStyle: 'italic' }}>
                  컨디션 브리핑은 이후 측정부터 저장됩니다.
                </p>
              )}
            </div>
          );
        })()}

        {/* 전체 피부 분석 (advice) */}
        {record.advice && (
          <div style={{
            animation: 'fadeUp 0.3s ease 0.4s both',
            background: 'var(--bg-card)', borderRadius: 22, padding: '16px 18px',
            border: '1px solid var(--border-subtle)', marginBottom: 12,
            boxShadow: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <LuaMiniIcon size={14} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>전체 피부 분석</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, margin: 0 }}>{record.advice}</p>
            {/* AI 정밀 판독 */}
            {record.aiNotes && (() => {
              const filtered = record.aiNotes
                .replace(/[^.。!]*(?:동일\s*인물|같은\s*(?:사람|인물)|다른\s*(?:사람|인물)|differentPerson|두\s*사진\s*(?:은|이|를))[^.。!]*[.。!]\s*/gi, '')
                .trim();
              if (!filtered) return null;
              return (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 12,
                  background: 'linear-gradient(135deg, rgba(240,144,112,0.08), rgba(240,144,112,0.04))',
                  border: '1px solid rgba(240,144,112,0.15)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#81E4BD', marginBottom: 4 }}>AI 정밀 판독</div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{filtered}</p>
                </div>
              );
            })()}
          </div>
        )}

        {/* Condition metrics group */}
        <div style={{
          animation: 'fadeUp 0.3s ease 0.5s both',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 22, padding: '14px 6px 2px',
          marginBottom: 12,
          boxShadow: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 14, marginBottom: 4 }}>
            <LuaMiniIcon size={14} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>컨디션 지표</span>
          </div>
          {conditionMetrics.map((m, i) => (
            <MetricBar
              key={m.label}
              label={m.label}
              value={m.value}
              unit={m.unit || ''}
              color={m.color}
              icon={m.icon}
              delay={i * 80}
            />
          ))}
        </div>

        {/* Aging metrics group */}
        <div style={{
          animation: 'fadeUp 0.3s ease 0.6s both',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 22, padding: '14px 6px 2px',
          marginBottom: 12,
          boxShadow: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 14, marginBottom: 4 }}>
            <LuaMiniIcon size={14} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>노화 지표</span>
          </div>
          {agingMetrics.map((m, i) => (
            <MetricBar
              key={m.label}
              label={m.label}
              value={m.value}
              unit=""
              color={m.color}
              icon={m.icon}
              delay={i * 80}
            />
          ))}
        </div>

        {/* SKIN LEVEL footer */}
        <div style={{
          animation: 'fadeUp 0.3s ease 0.7s both',
          background: 'linear-gradient(135deg, rgba(240,144,112,0.06), rgba(240,144,112,0.1))',
          borderRadius: 18, padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
          border: '1px solid rgba(240,144,112,0.1)',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 2,
            textTransform: 'uppercase',
          }}>SKIN LEVEL</div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 900,
            background: 'var(--btn-primary-bg)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            lineHeight: 1,
          }}>
            <AnimatedNumber target={record.skinAge} suffix="세" duration={1400} />
          </div>
          <div style={{
            background: grade.gradient, borderRadius: 8,
            padding: '3px 10px',
          }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800,
              color: '#fff',
            }}>{grade.letter}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Care Embed (CarePage 전체 요소) =====
function CareEmbed({ onOpenConsult, onMeasure }) {
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

  const glass = { background: 'rgba(255,255,255,0.35)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)', borderRadius: 20 };

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
      <div style={{ fontSize: 9, marginTop: 1, color: metaHL ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: metaHL ? 500 : 400 }}>{meta}</div>
      <div style={{ marginTop: 8, height: 3, borderRadius: 1.5, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 1.5, background: 'var(--accent-primary)', width: `${Math.min(progress, 1) * 100}%`, transition: 'width 0.4s' }} />
      </div>
    </div>
  );

  const closeModal = () => setModal(null);
  const ModalWrap = ({ title, children }) => (
    <>
      <div onClick={closeModal} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(4,44,83,0.18)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201, background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '22px 22px 0 0', boxShadow: '0 -8px 28px rgba(0,0,0,0.08)', padding: '0 0 calc(env(safe-area-inset-bottom,0px))', maxWidth: 430, margin: '0 auto', animation: 'careSheetUp 280ms cubic-bezier(0.32,0.72,0,1) forwards' }}>
        <style>{`@keyframes careSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}><div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(137,206,245,0.4)' }} /></div>
        <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</span>
          <button onClick={closeModal} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding: '0 16px 16px' }}>{children}</div>
      </div>
    </>
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

      {/* 오늘의 결 요약 */}
      <div style={{ padding: '0 20px 14px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.45 }}>
        {summaryParts.length > 0 ? (<><span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>오늘 두고 있는 것들</span> · {summaryParts.join(' · ')}</>) : '오늘의 결을 시작해볼까요?'}
      </div>

      {/* 섹션 헤더: 오늘의 결 */}
      <div style={{ padding: '6px 20px 8px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: 0.3, textTransform: 'uppercase' }}>오늘의 결</div>

      {/* 습관 카드 3개 */}
      <div style={{ padding: '0 12px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <HabitCard icon="💧" label="수분" value={`${waterL}L`} meta={`목표 ${waterGoal/1000}L`} progress={(habit.water_amount||0)/waterGoal} onTap={() => setModal('water')} />
        <HabitCard icon="🌙" label="수면" value={sleepH != null ? `${sleepH}h` : '—'} meta={sleepH != null ? '어젯밤' : '어젯밤 두기'} progress={sleepH != null ? sleepH/8 : 0} onTap={() => setModal('sleep')} />
        <HabitCard icon="☀️" label="자외선" value={sunscreen === true ? '✓' : '—'} meta={sunscreen === true ? '선크림 챙김' : '아직'} metaHL={sunscreen === true} progress={sunscreen === true ? 1 : 0} onTap={() => setModal('sunscreen')} />
      </div>

      {/* lua의 결의 발견 */}
      {recordCount >= 2 && (
        <div onClick={() => onOpenConsult?.()} style={{ padding: '0 16px 12px', cursor: 'pointer' }}>
          <div style={{ ...glass, padding: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.7), rgba(172,226,252,0.35))', border: '1px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="10" height="10" viewBox="0 0 24 24"><path fill="#89cef5" d="M10.48,23.25c-.15.41-.5.71-.86.75-.27.03-.78-.29-.9-.59l-1.53-4.02c-.48-1.26-1.41-2.1-2.67-2.58l-3.91-1.48c-.29-.11-.59-.51-.6-.76-.01-.39.23-.79.6-.93l3.9-1.49c1.27-.48,2.19-1.31,2.68-2.59l1.57-4.14c.08-.2.52-.44.74-.46.24-.02.77.21.86.46l1.57,4.14c.5,1.32,1.47,2.15,2.78,2.63l3.7,1.37c.31.11.66.55.67.83.02.42-.29.82-.68.97l-3.8,1.44c-1.26.48-2.2,1.32-2.67,2.58l-1.45,3.86Z"/><path fill="#89cef5" d="M21.48,6.29c-1.03.59-.9,2.91-2.01,2.98-1.23.08-.99-1.68-1.94-2.78-.77-.88-2.68-.63-2.74-1.78-.07-1.27,2.01-1.1,2.74-1.91.87-.95.73-2.72,1.78-2.8,1.29-.1.98,1.81,1.95,2.77.87.86,2.67.71,2.73,1.8.07,1.08-1.29,1.02-2.51,1.72Z"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5 }}>수분이 충분한 주에는 모공 점수가 평균 4점 더 좋았어요.</div>
              <span style={{ display: 'inline-block', marginTop: 5, fontSize: 9, fontWeight: 500, padding: '2px 7px', borderRadius: 8, background: 'rgba(137,206,245,0.15)', color: 'var(--accent-primary)' }}>결의 발견</span>
            </div>
          </div>
        </div>
      )}

      {/* 영역 구분선 */}
      <div style={{ height: 6, background: 'rgba(255,255,255,0.15)', margin: '8px 0 4px' }} />

      {/* 섹션 헤더: 화장품 */}
      <div style={{ padding: '6px 20px 8px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: 0.3, textTransform: 'uppercase' }}>화장품</div>

      {/* 화장품 빈 상태 */}
      <div style={{ padding: '0 12px 12px' }}>
        <div style={{ ...glass, padding: '32px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, opacity: 0.3, marginBottom: 8 }}>📦</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>아직 등록된 화장품이 없어요</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>지금 쓰는 화장품을 등록해보세요</div>
          <button style={{ background: 'var(--accent-primary)', color: '#fff', fontSize: 11, fontWeight: 500, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>+ 추가하기</button>
        </div>
      </div>

      {/* 입력 모달들 */}
      {modal === 'add' && (
        <ModalWrap title="추가">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[{ label: '수분 두기', icon: '💧', key: 'water' }, { label: '수면 두기', icon: '🌙', key: 'sleep' }, { label: '자외선 두기', icon: '☀️', key: 'sunscreen' }].map(item => (
              <button key={item.key} onClick={() => setModal(item.key)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textAlign: 'left' }}>
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
                  <button key={b.ml} onClick={()=>add(b.ml)} style={{ flex:1, background:'rgba(255,255,255,0.4)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:12, padding:'10px 4px', fontSize:11, fontWeight:500, color:'var(--text-primary)', cursor:'pointer', fontFamily:'inherit', textAlign:'center' }}>+{b.ml}ml<br/><span style={{fontSize:9,color:'var(--text-muted)',fontWeight:400}}>{b.l}</span></button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>오늘 누적 · {(amt/1000).toFixed(1)}L / {waterGoal/1000}L</div>
              <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
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
                <div style={{ fontSize:36,fontWeight:500,color:'var(--text-primary)' }}>{hrs}<span style={{fontSize:16,color:'var(--text-muted)'}}>h</span></div>
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
              <button onClick={()=>{if(applied!==null){saveHabitLog({sunscreen_applied:applied});refreshHabit();showToast();closeModal();}}} disabled={applied===null} style={{ width:'100%',padding:14,borderRadius:10,border:'none',background:applied!==null?'var(--accent-primary)':'rgba(137,206,245,0.2)',color:applied!==null?'#fff':'var(--text-muted)',fontSize:13,fontWeight:500,cursor:applied!==null?'pointer':'default',fontFamily:'inherit' }}>두기</button>
            </div>
          );
        };
        return <ModalWrap title="자외선 두기"><UF /></ModalWrap>;
      })()}

      {toast && (
        <div style={{ position:'fixed',bottom:120,left:'50%',transform:'translateX(-50%)',background:'var(--accent-primary)',color:'#fff',padding:'10px 24px',borderRadius:20,fontSize:13,fontWeight:500,zIndex:999 }}>오늘의 결에 두었어요</div>
      )}
    </div>
  );
}
