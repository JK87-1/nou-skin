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
import { getProfile, saveProfile, SKIN_TYPES, SKIN_CONCERNS, GENDER_OPTIONS, getCategories, getEnabledCategories, saveCategories, getCategoryColor } from '../storage/ProfileStorage';
import { getConditionChecks } from '../storage/ConditionStorage';
import AiInsightCard from '../components/AiInsightCard';
import { ChartIcon, CameraIcon, MicroscopeIcon, SparkleIcon, DiamondIcon, DropletIcon, RulerIcon, PaletteIcon, LotionIcon, EyeIcon, BubbleIcon, TargetIcon, ClockIcon, LuaMiniIcon } from '../components/icons/PastelIcons';
import EternalPearl from '../components/icons/EternalPearl';
import { getDefaultTheme } from '../data/BadgeData';
import { getFoodRecords, deleteFoodRecord } from '../storage/FoodStorage';
import { getBodyRecords } from '../storage/BodyStorage';
import DietOnboardingPage from './DietOnboardingPage';
import SupplementOnboardingPage from './SupplementOnboardingPage';
import { getPhotoDB } from '../storage/PhotoDB';

// 식단 사진: IndexedDB photoId면 로드, 기존 base64면 그대로 표시
function FoodPhoto({ photo, style, alt = '' }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (!photo) return;
    if (photo.startsWith('data:')) { setSrc(photo); return; }
    getPhotoDB(photo).then(url => { if (url) setSrc(url); });
  }, [photo]);
  if (!src) return null;
  return <img src={src} alt={alt} style={style} />;
}

// ===== MINI LINE GRAPH (Canvas-based, no dependencies) =====
function TrendGraph({ data, color = '#aed8f7', height = 160, metricKey = 'skinAge', inverse = false, showAllLabels = false }) {
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
        ctx.fillStyle = improving ? '#89cef5' : '#f44336';
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
  const color = improved ? '#89cef5' : '#f44336';
  const arrow = improved ? '↑' : '↓';
  const fs = size === 'small' ? 10 : 12;
  return (
    <span style={{ fontSize: fs, fontWeight: 600, color }}>
      {arrow}{Math.abs(diff)}{unit}
    </span>
  );
}

// ===== MAIN HISTORY PAGE =====
export default function MyPage({ onBack, onMeasure, onOpenConsult, onTabChange, initialMode, galleryOnly }) {
  const [mode, setMode] = useState(initialMode || 'gallery');
  const [enabledCats, setEnabledCats] = useState(() => getEnabledCategories('result'));
  const [albumCategory, setAlbumCategory] = useState('all');
  const refreshCategories = () => {
    const cats = getEnabledCategories('result');
    setEnabledCats(cats);
    if (albumCategory !== 'all' && !cats.find(c => c.key === albumCategory)) {
      setAlbumCategory('all');
    }
  };
  useEffect(() => {
    window.addEventListener('lua:categories-changed', refreshCategories);
    return () => window.removeEventListener('lua:categories-changed', refreshCategories);
  });
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
  const [selectedFood, setSelectedFood] = useState(null);
  const [foodRefreshKey, setFoodRefreshKey] = useState(0);
  const [showSettingsPage, setShowSettingsPage] = useState(false);

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
    { key: 'skinAge', label: '피부나이', color: '#aed8f7', inverse: true },
    { key: 'overallScore', label: '종합점수', color: '#aed8f7', inverse: false },
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
    <div style={{ minHeight: '100dvh', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ padding: '16px 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--text-primary)', fontFamily: 'Pretendard, sans-serif' }}>마이 페이지</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <div onClick={() => {
            if ((albumCategory === 'all' || albumCategory === 'food') && onTabChange) onTabChange('food', { openAdd: true });
            else onMeasure();
          }} style={{
            width: 34, height: 34, borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div onClick={() => setShowSettingsPage(true)} style={{
            width: 34, height: 34, borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </div>
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

      {/* ===== Profile + Category Tabs ===== */}
      {(() => {
        const latestRecord = records.length > 0 ? records[records.length - 1] : null;
        const profileImg = getProfile().profileImage;
        const avatarSrc = profileImg || (latestRecord ? (thumbs[String(latestRecord.id)] || thumbs[latestRecord.date]) : null);
        const avgScore = records.length > 0
          ? Math.round(records.reduce((s, r) => s + r.overallScore, 0) / records.length) : 0;
        return (
          <div style={{ padding: '20px 10px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
                background: 'var(--btn-primary-bg)', padding: 2,
              }}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  overflow: 'hidden', background: 'var(--bg-secondary)',
                }}>
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                        <circle cx="12" cy="10" r="4" /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flex: 1, justifyContent: 'space-around', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{records.length}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>기록</div>
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{avgScore}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>평균점수</div>
                </div>
              </div>
            </div>
            {(() => {
              const allTabs = [{ key: 'all', label: '전체' }, ...enabledCats];
              const idx = allTabs.findIndex(t => t.key === albumCategory);
              const pos = idx === 0 ? 'first' : idx === allTabs.length - 1 ? 'last' : 'mid';
              return (
                <div className="segment-control" data-active={pos}>
                  {allTabs.map(cat => (
                    <button key={cat.key} className={`segment-btn${albumCategory === cat.key ? ' active' : ''}`}
                      onClick={() => setAlbumCategory(cat.key)}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {cat.key !== 'all' && cat.color && (
                          <span style={{ width: 8, height: 8, borderRadius: 3, background: cat.color, flexShrink: 0 }} />
                        )}
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
        );
      })()}

      <div className="tab-content-panel" data-active={
        (() => {
          const allTabs = [{ key: 'all', label: '전체' }, ...enabledCats];
          const idx = allTabs.findIndex(t => t.key === albumCategory);
          return idx === 0 ? 'first' : idx === allTabs.length - 1 ? 'last' : 'mid';
        })()
      }>

      {/* ===== 전체: 컨디션 누적 기록 ===== */}
      {albumCategory === 'all' && (() => {
        const allChecks = getConditionChecks();
        // 날짜별 그룹핑
        const byDate = {};
        allChecks.forEach(c => {
          const d = c.timestamp.slice(0, 10);
          if (!byDate[d]) byDate[d] = [];
          byDate[d].push(c);
        });
        const dates = Object.keys(byDate).sort().reverse().slice(0, 14); // 최근 14일
        const chartDates = [...dates].reverse(); // 오래된→최신 순서로 차트용

        // 차트: 날짜별 평균
        const dailyAvg = chartDates.map(d => {
          const checks = byDate[d];
          const avgMood = checks.reduce((s, c) => s + (c.mood || 0), 0) / checks.length;
          const avgEnergy = checks.reduce((s, c) => s + (c.energy || 0), 0) / checks.length;
          return { date: d, mood: Math.round(avgMood * 10) / 10, energy: Math.round(avgEnergy * 10) / 10 };
        });

        const makePath = (pts) => {
          if (pts.length < 2) return '';
          let d = `M${pts[0].x} ${pts[0].y}`;
          for (let i = 1; i < pts.length; i++) { const cp = (pts[i].x + pts[i-1].x)/2; d += ` C${cp} ${pts[i-1].y} ${cp} ${pts[i].y} ${pts[i].x} ${pts[i].y}`; }
          return d;
        };

        return (
          <div style={{ padding: '8px 14px 0' }}>
            {/* 누적 흐름 차트 */}
            <div style={{ background: 'rgba(255,255,255,.72)', borderRadius: 16, padding: '14px 15px', border: '0.5px solid rgba(255,255,255,.95)', marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A', marginBottom: 10 }}>컨디션 흐름</div>
              <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
                {[{ c: getCategoryColor('mood') || '#F5C2CB', l: '기분' }, { c: getCategoryColor('energy') || '#F0C878', l: '에너지' }].map(x => (
                  <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 12, height: 2, borderRadius: 1, background: x.c }} />
                    <span style={{ fontSize: 10, color: '#7AAABB' }}>{x.l}</span>
                  </div>
                ))}
              </div>
              {dailyAvg.length >= 2 ? (() => {
                const svgW = Math.max(dailyAvg.length * 40, 220);
                const H = 60;
                const pad = 16;
                const toY = (val) => Math.round(H - (val / 10) * (H - 12) - 6);
                const moodPts = dailyAvg.map((d, i) => ({ x: (i / (dailyAvg.length - 1)) * (svgW - pad * 2) + pad, y: toY(d.mood) }));
                const energyPts = dailyAvg.map((d, i) => ({ x: (i / (dailyAvg.length - 1)) * (svgW - pad * 2) + pad, y: toY(d.energy) }));
                return (
                  <>
                    <svg width="100%" height={H} viewBox={`0 0 ${svgW} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', overflow: 'visible' }}>
                      <path d={makePath(moodPts)} fill="none" stroke={getCategoryColor('mood') || '#F5C2CB'} strokeWidth="2" strokeLinecap="round" />
                      <path d={makePath(energyPts)} fill="none" stroke={getCategoryColor('energy') || '#F0C878'} strokeWidth="2" strokeLinecap="round" strokeDasharray="5 3" />
                      {moodPts.map((p, i) => <circle key={`m${i}`} cx={p.x} cy={p.y} r="3" fill="#fff" stroke={getCategoryColor('mood') || '#F5C2CB'} strokeWidth="1.5" />)}
                      {energyPts.map((p, i) => <circle key={`e${i}`} cx={p.x} cy={p.y} r="3" fill="#fff" stroke={getCategoryColor('energy') || '#F0C878'} strokeWidth="1.5" />)}
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', marginTop: 4 }}>
                      {dailyAvg.filter((_, i) => i === 0 || i === dailyAvg.length - 1 || i === Math.floor(dailyAvg.length / 2)).map((d, i) => (
                        <span key={i} style={{ fontSize: 9, color: '#9ABBC8' }}>{d.date.slice(5)}</span>
                      ))}
                    </div>
                  </>
                );
              })() : (
                <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: '#9ABBC8' }}>
                  메인에서 컨디션을 기록하면 흐름이 나타나요
                </div>
              )}
            </div>

            {/* 날짜별 기록 리스트 */}
            <div style={{ background: 'rgba(255,255,255,.72)', borderRadius: 16, padding: '14px 15px', border: '0.5px solid rgba(255,255,255,.95)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A', marginBottom: 10 }}>기록 히스토리</div>
              {dates.length > 0 ? dates.map(date => {
                const checks = byDate[date];
                const latest = checks[checks.length - 1];
                const d = new Date(date + 'T00:00:00');
                const dayLabel = `${d.getMonth() + 1}/${d.getDate()}`;
                return (
                  <div key={date} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 0', borderBottom: '0.5px solid rgba(100,180,220,.1)',
                  }}>
                    <div style={{ minWidth: 36, fontSize: 12, fontWeight: 600, color: '#5AAABB' }}>{dayLabel}</div>
                    <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 3, background: getCategoryColor('mood') || '#F5C2CB' }} />
                        <span style={{ fontSize: 11, color: '#1A3A4A' }}>{latest.mood || '—'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 3, background: getCategoryColor('energy') || '#F0C878' }} />
                        <span style={{ fontSize: 11, color: '#1A3A4A' }}>{latest.energy || '—'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 3, background: getCategoryColor('water') || '#7BC8F0' }} />
                        <span style={{ fontSize: 11, color: '#1A3A4A' }}>{latest.water || latest.gut || '—'}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 9, color: '#9ABBC8' }}>{checks.length}회</span>
                  </div>
                );
              }) : (
                <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: '#9ABBC8' }}>
                  아직 기록이 없어요
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ===== FOOD ALBUM ===== */}
      {(albumCategory === 'food') && (() => {
        const _refresh = foodRefreshKey; // trigger re-render on delete
        const allFoods = getFoodRecords();
        const dates = Object.keys(allFoods).sort().reverse();
        return (
          <div style={{ padding: '16px 18px 0', animation: 'breatheIn 0.5s ease both' }}>
            {dates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>식단 기록이 없어요</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>식단 탭에서 기록을 시작해보세요</div>
              </div>
            ) : (
              dates.map(date => {
                const foods = allFoods[date].filter(f => !f.name?.startsWith('물 '));
                if (foods.length === 0) return null;
                const d = new Date(date);
                const totalKcal = foods.reduce((s, f) => s + (f.kcal || 0), 0);
                return (
                  <div key={date} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{d.getMonth() + 1}월 {d.getDate()}일</span>
                      <span style={{ fontSize: 12, color: 'var(--accent-primary)', fontWeight: 600 }}>{totalKcal}kcal</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, padding: '0' }}>
                      {foods.map(food => (
                        <div key={food.id} onClick={() => setSelectedFood({ ...food, _date: date })} style={{ aspectRatio: '1', borderRadius: 5, overflow: 'hidden', background: 'var(--bg-card-hover)', position: 'relative', cursor: 'pointer' }}>
                          {food.photo ? (
                            <FoodPhoto photo={food.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(137,206,245,0.08)' }}>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 4 }}>{food.name}</span>
                            </div>
                          )}
                          <span style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 10, color: '#fff', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{food.meal}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        );
      })()}

      {/* Food Detail Modal */}
      {selectedFood && (
        <HistoryFoodDetailModal food={selectedFood} onClose={() => setSelectedFood(null)} onDelete={() => {
          deleteFoodRecord(selectedFood._date, selectedFood.id);
          setSelectedFood(null);
          setFoodRefreshKey(k => k + 1);
        }} />
      )}

      {/* ===== BODY ALBUM ===== */}
      {(albumCategory === 'body') && (() => {
        const bodyRecords = getBodyRecords();
        const sorted = [...bodyRecords].reverse();
        return (
          <div style={{ padding: '16px 18px 0', animation: 'breatheIn 0.5s ease both' }}>
            {sorted.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>몸무게 기록이 없어요</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>바디 탭에서 기록을 시작해보세요</div>
              </div>
            ) : (
              <div>
                {sorted.length >= 2 && (() => {
                  const data = [...bodyRecords].slice(-14);
                  const weights = data.map(r => r.weight);
                  const min = Math.min(...weights) - 1, max = Math.max(...weights) + 1;
                  const range = max - min || 1;
                  const w = 280, h = 60;
                  const points = data.map((r, i) => `${(i / (data.length - 1)) * w},${h - ((r.weight - min) / range) * h}`).join(' ');
                  return (
                    <div style={{ marginBottom: 16 }}>
                      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 60 }} preserveAspectRatio="none">
                        <defs><linearGradient id="bgAlbum" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#89cef5" /><stop offset="100%" stopColor="#89cef5" /></linearGradient></defs>
                        <polyline points={points} fill="none" stroke="url(#bgAlbum)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  );
                })()}
                {sorted.map(r => {
                  const d = new Date(r.date);
                  return (
                    <div key={r.date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', borderRadius: 16, padding: '14px 18px', marginBottom: 8, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)' }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{d.getMonth() + 1}월 {d.getDate()}일</span>
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent-primary)' }}>{r.weight} kg</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ===== BODY SHAPE PLACEHOLDER ===== */}
      {(albumCategory === 'shape') && (
        <div style={{ padding: '80px 24px', textAlign: 'center', animation: 'breatheIn 0.5s ease both' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💪</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>바디 앨범</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>곧 출시 예정이에요</div>
        </div>
      )}

      {/* ===== SKIN GALLERY ===== */}
      {(albumCategory === 'skin') && (() => {
        const sorted = [...records].reverse();
        return (
          <div>
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
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, padding: '0 18px',
              }}>
                {sorted.map((r) => {
                  const thumb = thumbs[String(r.id)] || thumbs[r.date];
                  return (
                    <div key={r.id || r.timestamp || r.date} onClick={() => handleSelectRecord(r)} style={{
                      position: 'relative', aspectRatio: '1', cursor: 'pointer',
                      background: 'var(--bg-card-hover)', overflow: 'hidden', borderRadius: 5,
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

            {/* Skin Analysis CTA — exact copy from skin page */}
            <div onClick={onMeasure} style={{
              margin: '20px 18px 0', padding: '16px 18px',
              background: 'var(--bg-card)', borderRadius: 20, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
              display: 'flex', alignItems: 'center', gap: 14,
              cursor: 'pointer', animation: 'breatheIn 0.6s ease 0.3s both',
              WebkitTapHighlightColor: 'transparent',
            }}>
              <div style={{ width: 48, height: 48, flexShrink: 0 }}>
                <EternalPearl size={48} animated colors={getDefaultTheme('light')} theme="light" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: -0.3 }}>
                  피부 분석하기
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>
                  AI가 10개 지표를 정밀 분석합니다
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        );
      })()}

      {/* ===== INSIGHTS MODE (Redesigned: Timeline + Compare) ===== */}
      {(albumCategory === 'skin') && mode === 'insights' && (() => {
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
          <div style={{ padding: '0 18px' }}>
            {/* === HEADER === */}
            <div style={{ paddingTop: 20, marginBottom: 20, animation: 'breatheIn 0.6s ease both' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: 'var(--text-muted)' }}>SKIN TIMELINE</span>
                {period > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#fff',
                    background: 'rgba(255,120,50,0.2)', border: '1px solid rgba(255,120,50,0.3)',
                    borderRadius: 20, padding: '2px 10px',
                  }}><span style={{ color: '#FF6B35' }}>●</span> {period}일째</span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>나의 피부 여정</h2>
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
                  border: '1px solid rgba(255,255,255,0.3)', borderRadius: 16, padding: '14px 16px',
                  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
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
                      fontSize: 22, fontWeight: 600, fontFamily: 'var(--font-display)',
                      color: overallDiff >= 0 ? '#89cef5' : '#f0a050',
                    }}>{overallDiff > 0 ? '+' : ''}{overallDiff}점</div>
                  </div>
                </div>
                <div style={{
                  flex: 1, background: 'var(--bg-card)',
                  border: '1px solid rgba(255,255,255,0.3)', borderRadius: 16, padding: '14px 16px',
                  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
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
                      fontSize: 22, fontWeight: 600, fontFamily: 'var(--font-display)',
                      color: skinAgeDiff <= 0 ? '#89cef5' : '#f0a050',
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
                    color: Number(improvementPct) > 0 ? '#89cef5' : '#f0a050',
                  }}>
                    {Number(improvementPct) > 0 ? '▲' : '▼'} {Math.abs(Number(improvementPct))}% {Number(improvementPct) > 0 ? '개선' : '변화'}
                  </span>
                )}
              </div>
              <TrendGraph
                data={getTimeSeries('overallScore')}
                color="#aed8f7"
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
                        background: isLatest ? 'rgba(137,206,245,0.08)' : 'rgba(255,255,255,0.03)',
                        border: isLatest ? '1px solid rgba(137,206,245,0.25)' : '1px solid var(--border-light)',
                        borderRadius: 16, cursor: 'pointer',
                        transition: 'border-color 0.2s',
                      }}>
                        {/* Date */}
                        <div style={{ textAlign: 'center', minWidth: 36 }}>
                          <div style={{ fontSize: 22, fontWeight: 600, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1 }}>{dayNum}</div>
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
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>종합 {r.overallScore}점</span>
                            {diff !== 0 && (
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8,
                                background: diff > 0 ? 'rgba(74,222,128,0.15)' : 'rgba(240,160,80,0.15)',
                                color: diff > 0 ? '#89cef5' : '#f0a050',
                              }}>{diff > 0 ? '+' : ''}{diff}</span>
                            )}
                            {diff > 0 && (
                              <div style={{
                                width: 4, height: 4, borderRadius: '50%',
                                background: '#89cef5',
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
                            <circle cx="21" cy="21" r={ringR} fill="none" stroke="#aed8f7" strokeWidth="3"
                              strokeDasharray={`${(r.overallScore / 100) * circ} ${circ}`}
                              strokeLinecap="round" transform="rotate(-90 21 21)"
                            />
                          </svg>
                          <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-display)', color: 'var(--text-secondary)',
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
                          fontSize: 24, fontWeight: 600, fontFamily: 'var(--font-display)', color: 'var(--text-secondary)',
                        }}>{firstRecord.overallScore}</div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>시작</div>
                    </div>

                    {/* Diff */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: 26, fontWeight: 600, fontFamily: 'var(--font-display)',
                        color: overallDiff >= 0 ? '#89cef5' : '#f0a050',
                      }}>{overallDiff > 0 ? '+' : ''}{overallDiff}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>점 {overallDiff >= 0 ? '상승' : '변화'}</div>
                    </div>

                    {/* Current ring */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 6px' }}>
                        <svg width="80" height="80" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r={bigR} fill="none" stroke="rgba(240,144,112,0.12)" strokeWidth="5" />
                          <circle cx="40" cy="40" r={bigR} fill="none" stroke="#aed8f7" strokeWidth="5"
                            strokeDasharray={`${(lastRecord.overallScore / 100) * bigCirc} ${bigCirc}`}
                            strokeLinecap="round" transform="rotate(-90 40 40)"
                          />
                        </svg>
                        <div style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 24, fontWeight: 600, fontFamily: 'var(--font-display)', color: 'var(--text-primary)',
                        }}>{lastRecord.overallScore}</div>
                      </div>
                      <div style={{ fontSize: 11, color: '#aed8f7', fontWeight: 600 }}>현재</div>
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
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{lastVal}</span>
                            {diff !== 0 && (
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, marginLeft: 6,
                                background: improved ? 'rgba(74,222,128,0.15)' : 'rgba(240,160,80,0.15)',
                                color: improved ? '#89cef5' : '#f0a050',
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
                              background: improved || diff === 0 ? '#aed8f7' : 'var(--text-dim)',
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

      </div>{/* end tab-content-panel */}

      {/* Settings Drawer */}
      <SettingsPage open={showSettingsPage} onClose={() => setShowSettingsPage(false)} onCategoriesChanged={refreshCategories} onTabChange={onTabChange} />
    </div>
  );
}

// ===== SETTINGS PAGE =====
function SettingsPage({ open, onClose, onCategoriesChanged, onTabChange }) {
  const [showProfilePage, setShowProfilePage] = useState(false);
  const [showCategoryPage, setShowCategoryPage] = useState(false);
  const [showGoalPage, setShowGoalPage] = useState(false);

  const menuSections = [
    {
      title: '계정',
      items: [
        { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, label: '프로필 설정', action: () => setShowProfilePage(true) },
        { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="22" x2="4" y2="2"/><path d="M4 3c3-1 6 1 9 0s6-2 8 0v10c-2-2-5 0-8 1s-6-1-9 0V3z"/></svg>, label: '목표 설정', action: () => setShowGoalPage(true) },
      ],
    },
    {
      title: '앱 설정',
      items: [
        { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>, label: '카테고리', action: () => setShowCategoryPage(true) },
        { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>, label: '화면' },
        { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>, label: '데이터' },
      ],
    },
    {
      title: '정보',
      items: [
        { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, label: '공지사항' },
        { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, label: '앱 정보' },
        { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, label: '문의하기' },
      ],
    },
  ];

  return (
    <>
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 2001,
        width: '100%',
        background: 'linear-gradient(to bottom, #ace2fc, #ffffff)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
          <div onClick={onClose} style={{
            width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            zIndex: 1,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>설정</span>
        </div>
        <div style={{ flex: 1, padding: '8px 0' }}>
          {menuSections.map((section) => (
            <div key={section.title}>
              <div style={{
                padding: '14px 28px 6px',
                fontSize: 11, fontWeight: 400, color: 'var(--text-dim)',
                letterSpacing: 0.5,
              }}>{section.title}</div>
              {section.items.map((item) => (
                <div key={item.label} onClick={() => item.action ? item.action() : null} style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '11px 28px', cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  color: 'var(--text-primary)',
                }}>
                  {item.icon}
                  <span style={{ fontSize: 15, fontWeight: 500, flex: 1 }}>{item.label}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 28px 40px', borderTop: '1px solid var(--border-light, #eee)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>버전 1.0.0</div>
          <div onClick={() => {}} style={{ fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>로그아웃</div>
        </div>
      </div>
      {showProfilePage && <ProfileSettingsPage onClose={() => setShowProfilePage(false)} />}
      {showCategoryPage && <CategorySettingsPage onClose={() => setShowCategoryPage(false)} onSave={onCategoriesChanged} />}
      {showGoalPage && <GoalSettingsPage onClose={() => setShowGoalPage(false)} onTabChange={onTabChange} />}
    </>
  );
}

// ===== GOAL SETTINGS PAGE =====

const DIET_GOALS = [
  { key: 'balance', name: '밸런스', desc: '탄단지 영양소를 골고루 섭취해요', carb: 32, protein: 35, fat: 32 },
  { key: 'keto', name: '키토', desc: '고지방, 저탄수화물 식단으로 체지방 감소에 집중해요', carb: 6, protein: 35, fat: 58 },
  { key: 'lowfat', name: '저지방', desc: '지방 섭취를 줄이고 탄수화물과 단백질 위주로 먹어요', carb: 50, protein: 35, fat: 15 },
  { key: 'lowcarb', name: '저탄수화물', desc: '탄수화물을 줄이고 단백질과 건강한 지방을 늘려요', carb: 30, protein: 35, fat: 35 },
];

function GoalSettingsPage({ onClose, onTabChange }) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSupplementOnboarding, setShowSupplementOnboarding] = useState(false);
  const profile = getProfile();
  const isDone = profile.dietOnboardingDone;
  const isSupplementDone = profile.supplementOnboardingDone;
  const selected = profile.dietGoal || 'balance';

  return (
    <>
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2002,
      background: 'linear-gradient(to bottom, #ace2fc, #ffffff)',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
        <div onClick={onClose} style={{
          width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>목표 설정</span>
      </div>

      <div style={{ padding: '28px 24px' }}>
        {/* Onboarding CTA */}
        <div onClick={() => setShowOnboarding(true)} style={{
          padding: '24px 20px', borderRadius: 20, cursor: 'pointer', marginBottom: 28,
          background: 'linear-gradient(135deg, rgba(137,206,245,0.15), rgba(137,206,245,0.05))',
          border: '1.5px solid rgba(137,206,245,0.3)',
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            {isDone ? '다이어트 프로그램 수정하기' : '다이어트 프로그램 세팅하기'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
            체형, 운동습관, 목표체중, 식단유형까지 한번에 설정해요
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 12,
            background: 'var(--accent-primary)', color: '#fff',
            fontSize: 13, fontWeight: 600,
          }}>
            {isDone ? '수정하기' : '시작하기'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-4-4l4 4-4 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>

        {/* Current diet goal summary */}
        {isDone && (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>현재 설정</div>
            <div style={{ background: 'var(--bg-card, #fff)', borderRadius: 16, padding: '16px 20px', marginBottom: 12 }}>
              {(() => {
                const allDays = ['월', '화', '수', '목', '금', '토', '일'];
                const highCalDays = profile.dietHighCalDays || [];
                const highCal = highCalDays.length > 0 ? Math.round(profile.dietTargetCal * 1.15) : null;
                const lowCal = highCal ? Math.round((profile.dietTargetCal * 7 - highCal * highCalDays.length) / (7 - highCalDays.length)) : null;
                const lowDays = allDays.filter(d => !highCalDays.includes(d));
                const formatDays = days => days.join('·');
                const items = [
                  { label: '목표', value: profile.dietObjective === 'lose' ? '체중 감량' : profile.dietObjective === 'gain' ? '체중 증량' : '체중 유지' },
                  { label: '목표 체중', value: `${profile.goalWeight}kg` },
                  ...(highCal
                    ? [
                        { label: <>목표 칼로리 <span style={{ fontSize: 10, color: '#bbb' }}>({formatDays(lowDays)})</span></>, value: `${lowCal}kcal` },
                        { label: <>목표 칼로리 <span style={{ fontSize: 10, color: '#bbb' }}>({formatDays(highCalDays)})</span></>, value: `${highCal}kcal` },
                      ]
                    : [{ label: '목표 칼로리', value: `${profile.dietTargetCal}kcal` }]
                  ),
                  { label: 'TDEE', value: `${profile.dietTDEE}kcal`, sub: '운동 포함, 하루에 소모하는 총 칼로리' },
                ];
                return items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: item.sub ? 'flex-start' : 'center', padding: '8px 0', borderBottom: i < items.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                    <div>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{item.label}</span>
                      {item.sub && <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>{item.sub}</div>}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</span>
                  </div>
                ));
              })()}
            </div>
            <div style={{ background: 'var(--bg-card, #fff)', borderRadius: 16, padding: '16px 20px' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>식단 유형</div>
              {(() => {
                const goal = DIET_GOALS.find(g => g.key === selected);
                if (!goal) return null;
                return (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>{goal.name}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <div style={{ flex: goal.carb, padding: '7px 0', borderRadius: 8, textAlign: 'center', background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)', color: '#fff', fontSize: 11, fontWeight: 600 }}>탄 {goal.carb}%</div>
                      <div style={{ flex: goal.protein, padding: '7px 0', borderRadius: 8, textAlign: 'center', background: 'linear-gradient(135deg, #D946EF, #E879F9)', color: '#fff', fontSize: 11, fontWeight: 600 }}>단 {goal.protein}%</div>
                      <div style={{ flex: goal.fat, padding: '7px 0', borderRadius: 8, textAlign: 'center', background: 'linear-gradient(135deg, #06B6D4, #22D3EE)', color: '#fff', fontSize: 11, fontWeight: 600 }}>지 {goal.fat}%</div>
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        )}

        {/* Supplement onboarding CTA */}
        <div onClick={() => setShowSupplementOnboarding(true)} style={{
          padding: '24px 20px', borderRadius: 20, cursor: 'pointer', marginTop: 28,
          background: 'linear-gradient(135deg, rgba(184,216,160,0.2), rgba(184,216,160,0.05))',
          border: '1.5px solid rgba(184,216,160,0.4)',
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            {isSupplementDone ? '영양제 루틴 수정하기' : '영양제 루틴 짜기'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
            증상, 생활패턴 기반으로 나만의 영양제 루틴을 만들어요
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 12,
            background: '#6BAF6B', color: '#fff',
            fontSize: 13, fontWeight: 600,
          }}>
            {isSupplementDone ? '수정하기' : '시작하기'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-4-4l4 4-4 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
      </div>
    </div>
    {showOnboarding && <DietOnboardingPage onClose={() => setShowOnboarding(false)} onComplete={() => setShowOnboarding(false)} />}
    {showSupplementOnboarding && <SupplementOnboardingPage
      onClose={() => setShowSupplementOnboarding(false)}
      onComplete={() => setShowSupplementOnboarding(false)}
      onNavigateRoutine={() => { setShowSupplementOnboarding(false); onClose(); onTabChange?.('routine'); }}
    />}
    </>
  );
}

// ===== CATEGORY SETTINGS PAGE =====

const COLOR_OPTIONS = [
  '#F5F0A0', '#F5C870', '#F0A070', '#F09888',
  '#F07888', '#F078A8', '#D8A0E0',
  '#C8F0C8', '#A0E8C8', '#B0E8E0', '#80E0E0',
  '#80D0F0', '#70A8D8', '#8088C8',
];

function CategorySettingsPage({ onClose, onSave }) {
  const [categories, setCategories] = useState(() => getCategories());
  const [colorOpen, setColorOpen] = useState(null);
  const [expandedCat, setExpandedCat] = useState(null);
  const [expandAll, setExpandAll] = useState(false);
  const [toast, setToast] = useState('');
  const [dragGroup, setDragGroup] = useState(null);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragTo, setDragTo] = useState(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const dragStartY = useRef(0);
  const dragFromRef = useRef(null);
  const dragToRef = useRef(null);
  const dragGroupRef = useRef(null);
  const didDragRef = useRef(false);
  const itemRefs = useRef({});

  const enabledCount = categories.filter(c => c.enabled).length;

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2000); };

  const updateAndSave = (next) => {
    setCategories(next);
    saveCategories(next);
    onSave?.();
  };

  // 드래그 핸들러
  const findOverIdx = (group, y) => {
    const groupCats = categories.filter(c => c.group === group);
    for (let i = 0; i < groupCats.length; i++) {
      const ref = itemRefs.current[groupCats[i].key];
      if (!ref || i === dragFromRef.current) continue;
      const rect = ref.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom) return i;
    }
    return null;
  };

  const startDrag = (group, localIdx, y) => {
    dragStartY.current = y;
    dragFromRef.current = localIdx;
    dragToRef.current = null;
    dragGroupRef.current = group;
    didDragRef.current = false;
    setDragGroup(group);
    setDragFrom(localIdx);
    setDragTo(null);
    setDragOffsetY(0);
    setExpandedCat(null);
  };

  const moveDrag = (y) => {
    if (dragFromRef.current === null) return;
    if (Math.abs(y - dragStartY.current) > 3) didDragRef.current = true;
    setDragOffsetY(y - dragStartY.current);
    const over = findOverIdx(dragGroupRef.current, y);
    if (over !== null) { dragToRef.current = over; setDragTo(over); }
  };

  const endDrag = () => {
    const from = dragFromRef.current;
    const to = dragToRef.current;
    const group = dragGroupRef.current;
    dragFromRef.current = null;
    dragToRef.current = null;
    dragGroupRef.current = null;
    setDragGroup(null); setDragFrom(null); setDragTo(null); setDragOffsetY(0);
    if (from !== null && to !== null && from !== to && group) {
      const next = [...categories];
      const groupCats = next.filter(c => c.group === group);
      const others = next.filter(c => c.group !== group);
      const [item] = groupCats.splice(from, 1);
      groupCats.splice(to, 0, item);
      // 그룹 순서 유지하며 재조합
      const result = [];
      let gi = 0;
      for (const c of next) {
        if (c.group === group) { result.push(groupCats[gi++]); }
        else { result.push(c); }
      }
      updateAndSave(result);
    }
  };

  const bindDragHandle = (el, group, localIdx) => {
    if (!el) return;
    el.ontouchstart = (e) => { e.stopPropagation(); startDrag(group, localIdx, e.touches[0].clientY); };
    el.ontouchmove = (e) => { e.preventDefault(); e.stopPropagation(); moveDrag(e.touches[0].clientY); };
    el.ontouchend = (e) => { e.stopPropagation(); endDrag(); };
    el.onmousedown = (e) => {
      e.stopPropagation(); e.preventDefault();
      startDrag(group, localIdx, e.clientY);
      const onMove = (ev) => { ev.preventDefault(); moveDrag(ev.clientY); };
      const onUp = () => { endDrag(); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };
  };

  // 대분류 토글
  const toggle = (idx) => {
    const next = [...categories];
    const cat = next[idx];
    const turning = !cat.enabled;
    if (!turning && enabledCount <= 1) {
      showToast('최소 1개의 카테고리는 활성화되어야 해요');
      return;
    }
    cat.enabled = turning;
    // 대분류 끄면 소분류 전체 비활성, 켜면 전체 활성
    if (cat.subs) {
      cat.subs = cat.subs.map(s => ({ ...s, enabled: turning }));
    }
    updateAndSave(next);
  };

  // 소분류 토글
  const toggleSub = (catIdx, subIdx) => {
    const next = [...categories];
    const cat = { ...next[catIdx], subs: [...(next[catIdx].subs || [])] };
    cat.subs[subIdx] = { ...cat.subs[subIdx], enabled: !cat.subs[subIdx].enabled };
    // 소분류 전부 꺼지면 대분류도 비활성
    const anySubOn = cat.subs.some(s => s.enabled);
    if (!anySubOn) {
      if (enabledCount <= 1) {
        showToast('최소 1개의 카테고리는 활성화되어야 해요');
        return;
      }
      cat.enabled = false;
    } else {
      cat.enabled = true;
    }
    next[catIdx] = cat;
    updateAndSave(next);
  };

  const selectColor = (key, color) => {
    const next = categories.map(c => c.key === key ? { ...c, color } : c);
    updateAndSave(next);
  };


  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2002,
      background: 'linear-gradient(to bottom, #ace2fc, #ffffff)',
      display: 'flex', flexDirection: 'column',
      animation: 'slideInRight 0.3s ease',
      overflowY: 'auto',
    }}>
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
      {/* Header */}
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
        <div onClick={onClose} style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </div>
        <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 15, fontWeight: 500, color: '#1A3A4A' }}>카테고리 설정</span>
      </div>


      {/* Category list — grouped with sub-categories */}
      <div style={{ padding: '24px 20px', flex: 1, paddingBottom: 120 }}>
        {/* 보기 옵션 토글 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 12, padding: '0 14px' }}>
          <div style={{ width: 40, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
            <div onClick={() => { setExpandAll(!expandAll); if (!expandAll) setExpandedCat(null); }} style={{
              width: 36, height: 18, borderRadius: 4, position: 'relative', cursor: 'pointer',
              background: expandAll ? 'linear-gradient(120deg, #90CCE8, #60AADD)' : 'rgba(180,200,210,.3)',
              transition: 'background 0.2s ease',
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: 3, background: '#fff',
                position: 'absolute', top: 2,
                left: expandAll ? 20 : 2,
                transition: 'left 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }} />
            </div>
          </div>
        </div>
        {[
          { group: 'cause', label: '행동', desc: '내가 하는 것들' },
          { group: 'result', label: '변화', desc: '몸에 나타나는 변화' },
        ].map(({ group, label, desc }) => {
          const groupCats = categories.filter(c => c.group === group);
          if (groupCats.length === 0) return null;
          return (
            <div key={group} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 14px', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1A3A4A' }}>{label}</span>
                <span style={{ fontSize: 10, color: '#9ABBC8' }}>{desc}</span>
              </div>
              {groupCats.map((cat, localIdx) => {
                const idx = categories.findIndex(c => c.key === cat.key);
                const subs = cat.subs || [];
                const hasSubs = subs.length > 0;
                const isDragged = dragGroup === group && dragFrom === localIdx;
                const ITEM_H = 58;
                let shiftY = 0;
                if (dragGroup === group && dragFrom !== null && dragTo !== null && !isDragged && dragFrom !== dragTo) {
                  if (dragFrom < dragTo) {
                    if (localIdx > dragFrom && localIdx <= dragTo) shiftY = -ITEM_H;
                  } else {
                    if (localIdx >= dragTo && localIdx < dragFrom) shiftY = ITEM_H;
                  }
                }
                return (
                  <div key={cat.key} ref={el => itemRefs.current[cat.key] = el} style={{
                    marginBottom: 10,
                    position: 'relative', zIndex: isDragged ? 100 : 1,
                    transform: isDragged ? `translateY(${dragOffsetY}px) scale(1.02)` : shiftY ? `translateY(${shiftY}px)` : 'none',
                    transition: isDragged ? 'box-shadow 0.1s ease' : 'transform 0.2s cubic-bezier(0.2,0,0,1)',
                    boxShadow: isDragged ? '0 8px 24px rgba(0,0,0,0.12)' : 'none',
                    borderRadius: 14,
                  }}>
                    {/* 대분류 */}
                    <div onClick={() => { if (didDragRef.current) return; setExpandedCat(expandedCat === cat.key ? null : cat.key); }} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px',
                      background: 'rgba(255,255,255,0.6)',
                      borderRadius: (expandAll || expandedCat === cat.key || colorOpen === cat.key) ? '14px 14px 0 0' : 14,
                      border: '0.5px solid rgba(255,255,255,0.95)',
                      borderBottom: (expandAll || expandedCat === cat.key || colorOpen === cat.key) ? 'none' : '0.5px solid rgba(255,255,255,0.95)',
                      boxShadow: isDragged ? 'none' : '0 1px 4px rgba(0,0,0,0.03)',
                      opacity: cat.enabled ? 1 : 0.55,
                      transition: 'opacity 0.2s ease, border-radius 0.2s ease',
                      cursor: 'pointer',
                    }}>
                      <svg
                        ref={el => bindDragHandle(el, group, localIdx)}
                        onClick={e => e.stopPropagation()}
                        width="22" height="22" viewBox="0 0 24 24" fill="none"
                        style={{ cursor: 'grab', flexShrink: 0, touchAction: 'none', userSelect: 'none', padding: '4px 2px' }}
                      >
                        <line x1="5" y1="9" x2="19" y2="9" stroke="rgba(0,0,0,0.2)" strokeWidth="2" strokeLinecap="round" />
                        <line x1="5" y1="15" x2="19" y2="15" stroke="rgba(0,0,0,0.2)" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <div style={{ width: 26, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                        <div
                          onClick={(e) => { e.stopPropagation(); setColorOpen(colorOpen === cat.key ? null : cat.key); }}
                          style={{
                            width: 22, height: 22, borderRadius: 6, cursor: 'pointer',
                            background: cat.color || '#D0D0D0',
                            border: '2px solid rgba(255,255,255,0.8)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          }}
                        />
                      </div>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>{cat.label}</span>
                      <div style={{ width: 40, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                        <div onClick={(e) => { e.stopPropagation(); toggle(idx); }} style={{
                          width: 36, height: 18, borderRadius: 10,
                          background: cat.enabled ? 'linear-gradient(120deg, #90CCE8, #60AADD)' : 'rgba(180,200,210,.3)',
                          position: 'relative', cursor: 'pointer',
                          transition: 'background 0.2s ease',
                        }}>
                          <div style={{
                            width: 14, height: 14, borderRadius: '50%', background: '#fff',
                            position: 'absolute', top: 2,
                            left: cat.enabled ? 20 : 2,
                            transition: 'left 0.2s ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                          }} />
                        </div>
                      </div>
                    </div>
                    {/* 색상 선택 */}
                    {colorOpen === cat.key && (
                      <div style={{
                        background: 'rgba(255,255,255,0.9)',
                        borderRadius: hasSubs ? 0 : '0 0 14px 14px',
                        padding: '12px 14px',
                        border: '0.5px solid rgba(100,180,220,0.2)',
                        borderTop: 'none',
                        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8,
                      }}>
                        {COLOR_OPTIONS.map(c => (
                          <div key={c} onClick={() => selectColor(cat.key, c)} style={{
                            width: 26, height: 26, borderRadius: 7, cursor: 'pointer',
                            background: c,
                            border: cat.color === c ? '2px solid #1A3A4A' : '2px solid transparent',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                            transition: 'border 0.15s ease',
                            margin: '0 auto',
                          }} />
                        ))}
                      </div>
                    )}
                    {/* 소분류 */}
                    {hasSubs && (
                      <div style={{
                        background: 'rgba(255,255,255,0.6)',
                        borderRadius: '0 0 14px 14px',
                        padding: (expandAll || expandedCat === cat.key) ? '4px 14px 6px 14px' : '0 14px 0 14px',
                        borderTop: 'none',
                        maxHeight: (expandAll || expandedCat === cat.key) ? 300 : 0,
                        opacity: (expandAll || expandedCat === cat.key) ? 1 : 0,
                        overflow: 'hidden',
                        transition: 'max-height 0.3s ease, opacity 0.2s ease, padding 0.3s ease',
                      }}>
                        {subs.map((sub, si) => (
                          <div key={sub.key} style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '9px 0',
                          }}>
                            {/* 드래그핸들 자리 spacer */}
                            <div style={{ width: 22, padding: '0 2px', flexShrink: 0 }} />
                            <div style={{ width: 26, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                              <div style={{
                                width: 3, height: 12, borderRadius: 2,
                                background: sub.enabled ? (cat.color || '#D0D0D0') : 'rgba(180,200,210,.3)',
                                transition: 'background 0.2s ease',
                              }} />
                            </div>
                            <span style={{
                              flex: 1, fontSize: 13, fontWeight: 500,
                              color: sub.enabled ? '#1A3A4A' : '#9ABBC8',
                              transition: 'color 0.2s ease',
                            }}>{sub.label}</span>
                            <div style={{ width: 40, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                            <div onClick={() => toggleSub(idx, si)} style={{
                              width: 30, height: 14, borderRadius: 7,
                              background: sub.enabled ? 'linear-gradient(120deg, rgba(144,204,232,0.6), rgba(96,170,221,0.6))' : 'rgba(180,190,200,.3)',
                              position: 'relative', cursor: 'pointer',
                              transition: 'background 0.2s ease',
                            }}>
                              <div style={{
                                width: 10, height: 10, borderRadius: '50%', background: '#fff',
                                position: 'absolute', top: 2,
                                left: sub.enabled ? 18 : 2,
                                transition: 'left 0.2s ease',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                              }} />
                            </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(26,58,74,0.9)', color: '#fff', padding: '10px 20px',
          borderRadius: 12, fontSize: 12, fontWeight: 500, zIndex: 9999,
          animation: 'breatheIn 0.3s ease',
        }}>{toast}</div>
      )}

    </div>
  );
}

function AddCategorySheet({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 2100,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: '24px 24px 0 0',
        padding: '24px 24px 40px', width: '100%', maxWidth: 420,
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#ccc', margin: '0 auto 20px', opacity: 0.5 }} />
        <div style={{ fontSize: 17, fontWeight: 600, color: '#1A3A4A', marginBottom: 20 }}>카테고리 추가</div>

        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onSave(name.trim(), color)}
          placeholder="카테고리 이름"
          style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: '#F2F3F5', fontSize: 14, color: '#1A3A4A',
            fontFamily: 'inherit', outline: 'none', marginBottom: 16, boxSizing: 'border-box',
          }}
          autoFocus
        />

        <div style={{ fontSize: 12, fontWeight: 600, color: '#9ABBC8', marginBottom: 8 }}>컬러 선택</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {COLOR_OPTIONS.map(c => (
            <div key={c} onClick={() => setColor(c)} style={{
              width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
              background: c,
              border: color === c ? '2.5px solid #1A3A4A' : '2px solid transparent',
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            }} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '14px 0', borderRadius: 14, border: 'none',
            background: '#F2F3F5', color: '#9ABBC8', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>취소</button>
          <button onClick={() => name.trim() && onSave(name.trim(), color)} style={{
            flex: 1, padding: '14px 0', borderRadius: 14, border: 'none',
            background: 'linear-gradient(120deg, #90CCE8, #60AADD)',
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            opacity: name.trim() ? 1 : 0.4,
          }}>추가</button>
        </div>
      </div>
    </div>
  );
}

// ===== PROFILE SETTINGS PAGE =====
function ProfileSettingsPage({ onClose }) {
  const [profile, setProfile] = useState(getProfile);
  const currentYear = new Date().getFullYear();
  const age = profile.birthYear ? currentYear - parseInt(profile.birthYear) : null;

  const onUpdate = (key, value) => {
    const next = saveProfile({ [key]: value });
    setProfile(next);
  };

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 12, border: 'none',
    background: 'var(--bg-input, #F2F3F5)', fontSize: 14,
    color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2002,
      background: 'linear-gradient(to bottom, #ace2fc, #ffffff)',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      {/* Header */}
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
        <div onClick={onClose} style={{
          width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          zIndex: 1,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>프로필 설정</span>
      </div>

      <div style={{ padding: '20px 24px 40px' }}>
        {/* Profile photo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div onClick={() => document.getElementById('profile-photo-input')?.click()} style={{
            position: 'relative', width: 96, height: 96, borderRadius: '50%', cursor: 'pointer',
            overflow: 'hidden', background: 'var(--bg-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {profile.profileImage ? (
              <img src={profile.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <circle cx="12" cy="10" r="4" /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
              </svg>
            )}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 24,
              background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#fff" strokeWidth="1.5" />
                <circle cx="12" cy="13" r="3" stroke="#fff" strokeWidth="1.5" />
              </svg>
            </div>
            <input id="profile-photo-input" type="file" accept="image/*" onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement('canvas');
                  canvas.width = 200; canvas.height = 200;
                  const ctx = canvas.getContext('2d');
                  const size = Math.min(img.width, img.height);
                  const sx = (img.width - size) / 2, sy = (img.height - size) / 2;
                  ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);
                  onUpdate('profileImage', canvas.toDataURL('image/jpeg', 0.8));
                };
                img.src = ev.target.result;
              };
              reader.readAsDataURL(file);
            }} style={{ display: 'none' }} />
          </div>
        </div>

        {/* Nickname */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>닉네임</div>
          <input value={profile.nickname || ''} onChange={e => onUpdate('nickname', e.target.value)}
            placeholder="닉네임" maxLength={20} style={inputStyle} />
        </div>

        {/* 기본 정보 */}
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '24px 0 12px' }}>기본 정보</div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>생년월일</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input value={profile.birthYear || ''} onChange={e => onUpdate('birthYear', e.target.value)}
              placeholder="예: 1995" type="number" min={1940} max={currentYear} style={{ ...inputStyle, flex: 1 }} />
            {age > 0 && <span style={{ fontSize: 13, color: 'var(--accent-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>만 {age}세</span>}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>성별</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {GENDER_OPTIONS.map(g => (
              <button key={g} onClick={() => onUpdate('gender', g)} style={{
                flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                background: profile.gender === g ? 'var(--accent-primary)' : 'var(--bg-input, #F2F3F5)',
                color: profile.gender === g ? '#fff' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{g}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>키 (cm)</div>
            <input value={profile.height || ''} onChange={e => onUpdate('height', e.target.value)}
              placeholder="165" type="number" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>현재 몸무게 (kg)</div>
            <input value={profile.currentWeight || ''} onChange={e => onUpdate('currentWeight', e.target.value)}
              placeholder="60" type="number" step="0.1" style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>목표 몸무게 (kg)</div>
          <input value={profile.goalWeight || ''} onChange={e => onUpdate('goalWeight', e.target.value)}
            placeholder="55" type="number" step="0.1" style={inputStyle} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>활동 수준</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['거의 없음', '가벼운 활동', '보통', '활발한 활동', '매우 활발'].map(level => (
              <button key={level} onClick={() => onUpdate('activityLevel', level)} style={{
                padding: '8px 14px', borderRadius: 10, border: 'none',
                background: profile.activityLevel === level ? 'var(--accent-primary)' : 'var(--bg-input, #F2F3F5)',
                color: profile.activityLevel === level ? '#fff' : 'var(--text-muted)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{level}</button>
            ))}
          </div>
        </div>

        {/* 피부 정보 */}
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '24px 0 12px' }}>피부 정보</div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>피부 타입</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SKIN_TYPES.map(t => (
              <button key={t} onClick={() => onUpdate('skinType', t)} style={{
                padding: '8px 14px', borderRadius: 10, border: 'none',
                background: profile.skinType === t ? 'var(--accent-primary)' : 'var(--bg-input, #F2F3F5)',
                color: profile.skinType === t ? '#fff' : 'var(--text-muted)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{t}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>주요 피부 고민</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SKIN_CONCERNS.map(c => {
              const active = (profile.skinConcerns || []).includes(c);
              return (
                <button key={c} onClick={() => {
                  const list = active ? profile.skinConcerns.filter(x => x !== c) : [...(profile.skinConcerns || []), c];
                  onUpdate('skinConcerns', list);
                }} style={{
                  padding: '8px 14px', borderRadius: 10, border: 'none',
                  background: active ? 'var(--accent-primary)' : 'var(--bg-input, #F2F3F5)',
                  color: active ? '#fff' : 'var(--text-muted)',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                }}>{c}</button>
              );
            })}
          </div>
        </div>
      </div>
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
    if (score >= 85) return { letter: 'S', label: '최상', gradient: 'linear-gradient(135deg, #89cef5, #d4ecfa)', color: '#89cef5', bg: 'rgba(125,255,192,0.12)' };
    if (score >= 70) return { letter: 'A', label: '우수', gradient: 'linear-gradient(135deg, #aed8f7, #d4ecfa)', color: '#aed8f7', bg: 'rgba(173,235,179,0.12)' };
    if (score >= 55) return { letter: 'B', label: '양호', gradient: 'linear-gradient(135deg, #89cef5, #aed8f7)', color: '#89cef5', bg: 'rgba(125,255,192,0.12)' };
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
            position: 'absolute', left: -4, top: 0,
            width: 36, height: 36, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
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
            flex: 1, background: 'var(--bg-card)', borderRadius: 20, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
            border: '1px solid var(--border-light)', padding: '16px 14px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>피부나이</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>
              <AnimatedNumber target={record.skinAge} duration={1000} />
              <span style={{ fontSize: 16, fontWeight: 600 }}> 세</span>
            </div>
          </div>
          <div style={{
            flex: 1, background: 'var(--bg-card)', borderRadius: 20, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
            border: '1px solid var(--border-light)', padding: '16px 14px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>종합 점수</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 600, lineHeight: 1 }}>
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
          background: 'var(--bg-card)', borderRadius: 22, padding: '16px 18px', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
          border: '1px solid var(--border-subtle)', marginBottom: 12,
          boxShadow: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <LuaMiniIcon size={14} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>피부 타입 정보</span>
          </div>
          {/* Skin type */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>피부 타입</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{record.skinType}</span>
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
                color: record.analysisMode === 'hybrid' ? '#89cef5' : 'var(--text-muted)',
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
                fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-display)',
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
          const cGrade = cScore >= 85 ? { letter: 'S', color: '#89cef5', bg: 'rgba(125,255,192,0.15)', border: 'rgba(125,255,192,0.3)' }
            : cScore >= 70 ? { letter: 'A', color: '#89cef5', bg: 'rgba(124,92,252,0.15)', border: 'rgba(124,92,252,0.3)' }
            : cScore >= 55 ? { letter: 'B', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' }
            : cScore >= 40 ? { letter: 'C', color: '#8888a0', bg: 'rgba(136,136,160,0.12)', border: 'rgba(136,136,160,0.2)' }
            : { letter: 'D', color: '#f06050', bg: 'rgba(240,96,80,0.12)', border: 'rgba(240,96,80,0.2)' };
          return (
            <div style={{
              animation: 'fadeUp 0.3s ease 0.3s both',
              background: 'var(--bg-card)', borderRadius: 22, padding: '16px 18px', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
              border: '1px solid var(--border-subtle)', marginBottom: 12,
              boxShadow: 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <LuaMiniIcon size={14} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>컨디션 브리핑</span>
                <div style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 8, background: cGrade.bg, border: `1px solid ${cGrade.border}`, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: cGrade.color, fontFamily: 'var(--font-display)' }}>{cGrade.letter}</span>
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
            background: 'var(--bg-card)', borderRadius: 22, padding: '16px 18px', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
            border: '1px solid var(--border-subtle)', marginBottom: 12,
            boxShadow: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <LuaMiniIcon size={14} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>전체 피부 분석</span>
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
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#89cef5', marginBottom: 4 }}>AI 정밀 판독</div>
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
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 22, padding: '14px 6px 2px',
          marginBottom: 12,
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 14, marginBottom: 4 }}>
            <LuaMiniIcon size={14} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>컨디션 지표</span>
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
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 22, padding: '14px 6px 2px',
          marginBottom: 12,
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 14, marginBottom: 4 }}>
            <LuaMiniIcon size={14} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>노화 지표</span>
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
            fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 2,
            textTransform: 'uppercase',
          }}>SKIN LEVEL</div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600,
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
              fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600,
              color: '#fff',
            }}>{grade.letter}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== History Food Detail Modal =====
function HistoryFoodDetailModal({ food, onClose, onDelete }) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-secondary, #fff)', borderRadius: '24px 24px 0 0',
        padding: '12px 20px 40px', width: '100%', maxWidth: 430,
        maxHeight: '88vh', overflowY: 'auto',
      }}>
        {/* Handle bar + back/delete */}
        <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', marginBottom: 28 }}>
          <div onClick={onClose} style={{
            position: 'absolute', left: -4, top: 2,
            width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
            background: 'var(--bg-card-hover, #F2F3F5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--bg-input, #E0E0E0)', marginTop: 10 }} />
          <div onClick={() => setShowConfirm(true)} style={{
            position: 'absolute', right: -4, top: 2,
            width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
            background: 'var(--bg-card-hover, #F2F3F5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 12h12" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Delete confirm */}
        {showConfirm && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1200,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={() => setShowConfirm(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: 'var(--bg-card, #fff)',
              borderRadius: 20, padding: '28px 24px',
              width: 280, textAlign: 'center',
              border: '1px solid var(--border-subtle, #eee)',
            }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>이 기록을 삭제할까요?</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>삭제된 기록은 복구할 수 없습니다.</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowConfirm(false)} style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                  background: 'var(--bg-input, #F2F3F5)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>아니오</button>
                <button onClick={() => { onDelete(); setShowConfirm(false); }} style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                  background: '#e05545', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>삭제</button>
              </div>
            </div>
          </div>
        )}

        {/* Food info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          {food.photo ? (
            <FoodPhoto photo={food.photo} style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(137,206,245,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🍽️</div>
          )}
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{food.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{food.meal}</div>
          </div>
        </div>

        {/* Nutrition */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          {[
            { label: '칼로리', value: food.kcal, unit: 'kcal' },
            { label: '탄수화물', value: food.carb, unit: 'g' },
            { label: '단백질', value: food.protein, unit: 'g' },
          ].map(n => (
            <div key={n.label} style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 12, background: 'var(--bg-card)' }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{n.value}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>{n.unit}</span></div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{n.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: '지방', value: food.fat, unit: 'g' },
            { label: '비타민', value: food.vitamin || 0, unit: '%' },
            { label: '미네랄', value: food.mineral || 0, unit: '%' },
          ].map(n => (
            <div key={n.label} style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 12, background: 'var(--bg-card)' }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{n.value}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>{n.unit}</span></div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{n.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

