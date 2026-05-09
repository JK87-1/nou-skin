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
import { getConditionChecks, getEyeBodyChecks, getSkinSubChecks } from '../storage/ConditionStorage';
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
export default function MyPage({ onBack, onMeasure, onOpenConsult, onTabChange, initialMode, galleryOnly, colorMode, setColorMode }) {
  const [mode, setMode] = useState(initialMode || 'gallery');
  const PHOTO_CATS = [
    { key: 'all', label: '전체' },
    { key: 'food', label: '식단', color: getCategoryColor('food') },
    { key: 'skin_scan', label: '피부스캔', color: getCategoryColor('skin') },
    { key: 'face', label: '얼굴', color: '#D8A0E0' },
    { key: 'eye_body', label: '눈바디', color: getCategoryColor('body') },
  ];
  const [enabledCats, setEnabledCats] = useState(() => getEnabledCategories('result'));
  const [albumCategory, setAlbumCategory] = useState('all');
  const refreshCategories = () => {
    const cats = getEnabledCategories('result');
    setEnabledCats(cats);
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

  const [profileTab, setProfileTab] = useState('album');

  // 사진 수 계산
  const photoCount = (() => {
    let count = 0;
    const allFoods = getFoodRecords();
    Object.values(allFoods).forEach(foods => { count += foods.filter(f => f.photo && !f.name?.startsWith('물 ')).length; });
    count += records.filter(r => thumbs[String(r.id)] || thumbs[r.date]).length;
    const skinSubs = getSkinSubChecks();
    count += skinSubs.filter(s => s.photos?.face).length;
    const eyeBodyAll = getEyeBodyChecks();
    count += eyeBodyAll.filter(eb => eb.photos && Object.values(eb.photos).some(Boolean)).length;
    return count;
  })();

  // 저널 수 (컨디션 체크 일수)
  const journalCount = (() => {
    try {
      const checks = JSON.parse(localStorage.getItem('nou_condition_checks') || '[]');
      const dates = new Set(checks.map(c => c.date || (c.timestamp && c.timestamp.slice(0, 10))).filter(Boolean));
      return dates.size;
    } catch { return 0; }
  })();

  // 함께한 일수
  const daysTogether = (() => {
    try {
      const recs = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
      const foods = JSON.parse(localStorage.getItem('lua_food_records') || '{}');
      const checks = JSON.parse(localStorage.getItem('nou_condition_checks') || '[]');
      const allDates = [...Object.keys(recs), ...Object.keys(foods), ...checks.map(c => c.date).filter(Boolean)].filter(Boolean).sort();
      if (allDates.length === 0) return 1;
      const first = new Date(allDates[0]);
      const today = new Date();
      return Math.max(1, Math.ceil((today - first) / 86400000) + 1);
    } catch { return 1; }
  })();

  // 함께한 개월수
  const monthsTogether = Math.max(1, Math.ceil(daysTogether / 30));

  // 연속 기록일수
  const streakDays = (() => {
    try {
      const recs = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
      const foods = JSON.parse(localStorage.getItem('lua_food_records') || '{}');
      const checks = JSON.parse(localStorage.getItem('nou_condition_checks') || '[]');
      const checkDates = new Set(checks.map(c => c.date).filter(Boolean));
      const allDates = [...new Set([...Object.keys(recs), ...Object.keys(foods), ...checkDates])].sort().reverse();
      if (allDates.length === 0) return 0;
      const today = new Date().toISOString().slice(0, 10);
      if (allDates[0] !== today) return 0;
      let count = 1;
      for (let i = 0; i < allDates.length - 1; i++) {
        const d1 = new Date(allDates[i]), d2 = new Date(allDates[i + 1]);
        if ((d1 - d2) / 86400000 === 1) count++;
        else break;
      }
      return count;
    } catch { return 0; }
  })();

  // 빛나는 모습 메시지
  const shiningMsg = (() => {
    const parts = [];
    if (streakDays >= 2) parts.push(`${streakDays}일 연속 기록 중`);
    if (journalCount >= 7) parts.push(`이번 달 컨디션 체크 ${journalCount}회`);
    if (parts.length === 0) parts.push('꾸준한 기록이 빛나는 변화를 만들어요');
    return parts.join(' · ');
  })();

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 40 }}>

      {/* 1. 최상단 바 */}
      {(() => {
        const profileData = getProfile();
        return (
          <div style={{ padding: '16px 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ width: 34 }} />
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Pretendard, sans-serif' }}>{profileData.nickname || 'MY'}</span>
            <div onClick={() => setShowSettingsPage(true)} style={{ width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </div>
          </div>
        );
      })()}

      {/* 2. 프로필 영역 */}
      {(() => {
        const latestRecord = records.length > 0 ? records[records.length - 1] : null;
        const profileImg = getProfile().profileImage;
        const avatarSrc = profileImg || (latestRecord ? (thumbs[String(latestRecord.id)] || thumbs[latestRecord.date]) : null);
        const tabs = [
          { key: 'album', icon: <img src="/album.svg" alt="앨범" style={{ width: 18, height: 18, opacity: 0.3 }} />, label: '앨범', count: photoCount },
          { key: 'journal', icon: <img src="/memo.svg" alt="저널" style={{ width: 18, height: 18, opacity: 0.3 }} />, label: '저널', count: journalCount },
          { key: 'journey', icon: <img src="/spot.svg" alt="여정" style={{ width: 18, height: 18, opacity: 0.3 }} />, label: '여정', count: `${monthsTogether}개월` },
        ];
        return (
          <div style={{ margin: '0 16px 12px', padding: '0 2px' }}>
            {/* 2-1. 가로 배치: 아바타 + 진입카드 3개 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              {/* 프로필 사진 */}
              <div style={{ width: 86, height: 86, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.15)', flexShrink: 0, border: '2px solid rgba(255,255,255,0.1)' }}>
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                      <circle cx="12" cy="10" r="4" /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
                    </svg>
                  </div>
                )}
              </div>
              {/* 진입 카드 3개 */}
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {tabs.map(t => {
                  const active = profileTab === t.key;
                  return (
                    <div key={t.key} onClick={() => setProfileTab(t.key)}
                      style={{
                        background: 'transparent',
                        borderRadius: 10, padding: '10px 4px', textAlign: 'center', cursor: 'pointer',
                        transition: 'background 0.2s ease', WebkitTapHighlightColor: 'transparent',
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>{t.icon}</div>
                      <div style={{ fontSize: 11, marginTop: 4, color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: active ? 500 : 400 }}>{t.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{t.count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* 3. 통합 텍스트 영역 */}
            <div style={{ paddingTop: 4 }}>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>lua와 함께한지 {daysTogether}일째 🌙</div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 6 }}>{shiningMsg}</div>
            </div>
          </div>
        );
      })()}

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

      {/* ===== 저널 탭 ===== */}
      {profileTab === 'journal' && <JournalTab nickname={getProfile().nickname} />}

      {/* ===== 여정 탭 ===== */}
      {profileTab === 'journey' && <JourneyTab daysTogether={daysTogether} />}

      {/* ===== Photo Album Tabs ===== */}
      {profileTab === 'album' && <><div style={{ padding: '16px 10px 0' }}>
        {(() => {
          const idx = PHOTO_CATS.findIndex(t => t.key === albumCategory);
          const pos = idx === 0 ? 'first' : idx === PHOTO_CATS.length - 1 ? 'last' : 'mid';
          return (
            <div className="segment-control" data-active={pos}>
              {PHOTO_CATS.map(cat => (
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

      <div className="tab-content-panel" data-active={
        (() => {
          const idx = PHOTO_CATS.findIndex(t => t.key === albumCategory);
          return idx === 0 ? 'first' : idx === PHOTO_CATS.length - 1 ? 'last' : 'mid';
        })()
      }>

      {/* ===== 전체: 모든 사진 통합 앨범 ===== */}
      {albumCategory === 'all' && (() => {
        const allPhotos = [];
        // 식단 사진 (f.id = Date.now() timestamp)
        const allFoods = getFoodRecords();
        Object.entries(allFoods).forEach(([date, foods]) => {
          foods.filter(f => f.photo && !f.name?.startsWith('물 ')).forEach(f => {
            allPhotos.push({ ...f, type: 'food', date, ts: f.id || new Date(date).getTime() });
          });
        });
        // 피부 스캔 (r.timestamp = ISO string)
        records.forEach(r => {
          const thumb = thumbs[String(r.id)] || thumbs[r.date];
          if (thumb) allPhotos.push({ type: 'skin_scan', date: r.date, photo: thumb, label: `${r.overallScore}점`, sub: '피부스캔', id: r.id, ts: r.timestamp ? new Date(r.timestamp).getTime() : new Date(r.date).getTime() });
        });
        // 얼굴 사진
        const skinSubAll = getSkinSubChecks();
        skinSubAll.forEach(s => {
          if (s.photos?.face) allPhotos.push({ type: 'face', date: s.date, photo: s.photos.face, label: '얼굴', sub: s.score ? `${s.score}점` : '', id: `face_${s.date}`, ts: s.timestamp ? new Date(s.timestamp).getTime() : new Date(s.date).getTime() });
        });
        // 눈바디
        const eyeBodyAll = getEyeBodyChecks();
        eyeBodyAll.forEach(eb => {
          const photo = eb.photos?.['정면'] || Object.values(eb.photos || {})[0];
          if (photo) allPhotos.push({ type: 'eye_body', date: eb.date, photo, label: '눈바디', sub: '정면', id: `eb_${eb.date}`, ts: eb.timestamp ? new Date(eb.timestamp).getTime() : new Date(eb.date).getTime() });
        });
        allPhotos.sort((a, b) => b.ts - a.ts);
        return (
          <div style={{ padding: '8px 18px 0' }}>
            {allPhotos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📷</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>사진 기록이 없어요</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>식단, 피부, 눈바디 사진을 기록해보세요</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                {allPhotos.map((p, i) => (
                  <div key={p.id || i} onClick={() => { if (p.type === 'food') setSelectedFood({ ...p, _date: p.date }); else if (p.type === 'skin_scan') { const rec = records.find(r => r.id === p.id || r.date === p.date); if (rec) handleSelectRecord(rec); } }} style={{ aspectRatio: '1', borderRadius: 4, overflow: 'hidden', position: 'relative', cursor: 'pointer', background: 'var(--bg-card-hover)' }}>
                    {p.type === 'food' ? <FoodPhoto photo={p.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                ))}
              </div>
            )}
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

      {/* ===== 피부스캔 앨범 ===== */}
      {(albumCategory === 'skin_scan') && (() => {
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
      {(albumCategory === 'skin_scan') && mode === 'insights' && (() => {
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

      {/* ===== 얼굴 앨범 ===== */}
      {albumCategory === 'face' && (() => {
        const skinSubAll = getSkinSubChecks().filter(s => s.photos?.face).reverse();
        return (
          <div style={{ padding: '8px 18px 0' }}>
            {skinSubAll.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🤳</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>얼굴 사진이 없어요</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>돌아보기-피부에서 얼굴 사진을 기록해보세요</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                {skinSubAll.map((s, i) => {
                  const d = new Date(s.date);
                  return (
                    <div key={i} style={{ aspectRatio: '1', borderRadius: 4, overflow: 'hidden', position: 'relative', background: 'var(--bg-card-hover)' }}>
                      <img src={s.photos.face} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <span style={{ position: 'absolute', bottom: 3, left: 5, fontSize: 9, color: '#fff', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>{d.getMonth() + 1}/{d.getDate()}</span>
                      {s.score && <span style={{ position: 'absolute', bottom: 3, right: 5, fontSize: 10, color: '#fff', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>{s.score}점</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ===== 눈바디 앨범 ===== */}
      {albumCategory === 'eye_body' && (() => {
        const eyeBodyAll = getEyeBodyChecks().reverse();
        return (
          <div style={{ padding: '8px 18px 0' }}>
            {eyeBodyAll.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>👁️</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>눈바디 사진이 없어요</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>돌아보기-바디에서 눈바디 사진을 기록해보세요</div>
              </div>
            ) : (
              eyeBodyAll.map((eb, i) => {
                const d = new Date(eb.date);
                const photos = eb.photos || {};
                const angles = ['정면', '측면', '후면'].filter(a => photos[a]);
                if (angles.length === 0) return null;
                return (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{d.getMonth() + 1}월 {d.getDate()}일</div>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(angles.length, 3)}, 1fr)`, gap: 4 }}>
                      {angles.map(angle => (
                        <div key={angle} style={{ aspectRatio: '3/4', borderRadius: 8, overflow: 'hidden', position: 'relative', background: 'var(--bg-card-hover)' }}>
                          <img src={photos[angle]} alt={angle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <span style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 10, color: '#fff', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>{angle}</span>
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

      </div>{/* end tab-content-panel */}
      </>}{/* end profileTab === album */}

      {/* Food Detail Modal — outside tab-content-panel to avoid backdrop-filter stacking context */}
      {selectedFood && (
        <HistoryFoodDetailModal food={selectedFood} onClose={() => setSelectedFood(null)} onDelete={() => {
          deleteFoodRecord(selectedFood._date, selectedFood.id);
          setSelectedFood(null);
          setFoodRefreshKey(k => k + 1);
        }} />
      )}

      {/* Settings Drawer */}
      <SettingsPage open={showSettingsPage} onClose={() => setShowSettingsPage(false)} onCategoriesChanged={refreshCategories} onTabChange={onTabChange} colorMode={colorMode} setColorMode={setColorMode} />
    </div>
  );
}

// ===== JOURNAL TAB =====
import { IconX, IconChevronLeft, IconDots, IconSparkles, IconBulb, IconPhoto, IconMicrophone, IconMoodSmile, IconMoon, IconChartDots, IconHistory, IconEdit, IconShare, IconDownload, IconTrash, IconFeather } from '@tabler/icons-react';

const JOURNAL_KEY = 'lua_journal_entries';
const JOURNAL_DRAFT_KEY = 'lua_journal_draft';
const MOOD_TAGS = ['편안함', '설렘', '피곤함', '평온', '활력', '차분함'];

function getJournalEntries() {
  try { return JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]'); } catch { return []; }
}
function saveJournalEntry(entry) {
  const entries = getJournalEntries();
  const idx = entries.findIndex(e => e.id === entry.id);
  if (idx >= 0) entries[idx] = entry; else entries.unshift(entry);
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
  return entries;
}
function deleteJournalEntry(id) {
  const entries = getJournalEntries().filter(e => e.id !== id);
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
  return entries;
}

function getConditionForDate(dateStr) {
  try {
    const checks = JSON.parse(localStorage.getItem('nou_condition_checks') || '[]');
    const c = checks.filter(c => (c.date || (c.timestamp && c.timestamp.slice(0, 10))) === dateStr).pop();
    if (!c) return null;
    const energy = c.energy || c.에너지 || 0, mood = c.mood || c.기분 || 0, skin = c.skin || c.피부 || 0, gut = c.gut || c.소화 || 0;
    return { avg: (energy + mood + skin + gut) / 4, energy, mood, skin, gut };
  } catch { return null; }
}

function getDayRecord(dateStr) {
  try {
    const recs = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
    const rec = recs[dateStr] || {};
    const drinks = JSON.parse(localStorage.getItem('lua_drink_records') || '{}');
    const cafItems = drinks[dateStr]?.caffeine || [];
    const cafMg = cafItems.reduce((s, d) => {
      const mgMap = { espresso: 150, americano: 150, latte: 150, drip: 130, coldbrew: 200, matcha: 70, green_tea: 30, black_tea: 50, energy_drink: 160 };
      return s + (mgMap[d.key] || 100) * (d.count || 0);
    }, 0);
    return { sleep: rec.sleep?.hours || 0, cafMg, steps: rec.steps || 0 };
  } catch { return { sleep: 0, cafMg: 0, steps: 0 }; }
}

function getDayChips(dateStr) {
  const d = getDayRecord(dateStr);
  const chips = [];
  if (d.sleep > 0) chips.push(`수면 ${d.sleep}h`);
  if (d.cafMg > 0) chips.push(`카페인 ${d.cafMg}mg`);
  if (d.steps > 0) chips.push(`${d.steps.toLocaleString()}보`);
  return chips.slice(0, 2);
}

function getRelativeTime(dateStr) {
  const today = new Date().toISOString().slice(0, 10);
  if (dateStr === today) return '오늘';
  const diff = Math.ceil((new Date(today) - new Date(dateStr)) / 86400000);
  if (diff === 1) return '어제';
  if (diff <= 7) return `${diff}일 전`;
  if (diff <= 30) return `${Math.ceil(diff / 7)}주 전`;
  return `${Math.ceil(diff / 30)}달 전`;
}

function getSeasonLabel(dateStr) {
  const diff = Math.ceil((new Date() - new Date(dateStr)) / 86400000);
  const m = new Date(dateStr).getMonth() + 1;
  const season = m <= 2 || m === 12 ? '겨울' : m <= 5 ? '봄' : m <= 8 ? '여름' : '가을';
  if (diff <= 7) return '이번 주';
  if (diff <= 30) return `${Math.ceil(diff / 7)}주 전`;
  if (diff <= 365) return season;
  return `작년 ${season}`;
}

function getLuaMessage(dateStr) {
  const cond = getConditionForDate(dateStr);
  const rec = getDayRecord(dateStr);
  if (cond && cond.avg >= 7) return `컨디션 ${cond.avg.toFixed(1)}, 좋은 하루였네요. 오늘의 어떤 점이 좋았나요?`;
  if (cond && cond.avg < 5) return '오늘은 좀 힘드셨나요? 무슨 일이 있었는지 들려주세요';
  if (rec.cafMg > 300) return '오늘 카페인이 평소보다 많았네요. 어떤 일이 있었어요?';
  if (cond) return `컨디션 ${cond.avg.toFixed(1)}점인 하루, 어떤 색이었나요?`;
  return '오늘은 어떤 색이었나요?';
}

const DAY_NAMES_J = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

function JournalTab({ nickname }) {
  const [entries, setEntries] = useState(() => getJournalEntries());
  const [showWrite, setShowWrite] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [editEntry, setEditEntry] = useState(null);
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [filterMonth, setFilterMonth] = useState('all');
  const [showCount, setShowCount] = useState(10);

  const handleSave = (entry) => {
    const updated = saveJournalEntry(entry);
    setEntries(updated);
    setShowWrite(false);
    setEditEntry(null);
    localStorage.removeItem(JOURNAL_DRAFT_KEY);
  };

  const handleDelete = (id) => {
    const updated = deleteJournalEntry(id);
    setEntries(updated);
    setShowDetail(null);
  };

  const months = (() => {
    const set = new Set(entries.map(e => e.date.slice(0, 7)));
    return [...set].sort().reverse();
  })();

  const filtered = filterMonth === 'all' ? entries : entries.filter(e => e.date.slice(0, 7) === filterMonth);
  const visible = filtered.slice(0, showCount);
  const hasMore = filtered.length > showCount;

  // 빈 상태 (케이스 A)
  if (entries.length === 0 && !showWrite) {
    const prompts = ['지금 마음에 떠오르는 것', '오늘의 작은 발견', '몸이 보낸 신호'];
    return (
      <div style={{ padding: '28px 20px 20px', textAlign: 'center' }}>
        <svg width="64" height="64" viewBox="0 0 64 64" style={{ marginBottom: 22 }}>
          <circle cx="32" cy="32" r="3" fill="var(--text-muted)" opacity="0.9" />
          <circle cx="14" cy="20" r="1" fill="var(--text-muted)" opacity="0.4" />
          <circle cx="50" cy="22" r="1.2" fill="var(--text-muted)" opacity="0.45" />
          <circle cx="46" cy="46" r="0.9" fill="var(--text-muted)" opacity="0.35" />
          <circle cx="18" cy="48" r="1" fill="var(--text-muted)" opacity="0.4" />
          <circle cx="32" cy="10" r="0.7" fill="var(--text-muted)" opacity="0.3" />
          <circle cx="32" cy="54" r="0.7" fill="var(--text-muted)" opacity="0.3" />
        </svg>
        <div style={{ fontSize: 17, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: -0.2, marginBottom: 24 }}>오늘의 한 줄</div>
        <div style={{ maxWidth: 280, margin: '0 auto 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {prompts.map((p, i) => (
            <div key={i} onClick={() => { setSelectedPrompt(p); setShowWrite(true); }}
              style={{ background: 'var(--card-bg)', padding: '12px 16px', borderRadius: 10, fontSize: 12, color: 'var(--text-primary)', textAlign: 'left', lineHeight: 1.5, cursor: 'pointer', border: 'var(--card-border)', WebkitTapHighlightColor: 'transparent' }}>
              {p}
            </div>
          ))}
          <div onClick={() => { setSelectedPrompt(''); setShowWrite(true); }}
            style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', cursor: 'pointer' }}>
            자유롭게 쓰기 →
          </div>
        </div>
        <button onClick={() => setShowWrite(true)} style={{
          background: 'var(--text-primary)', color: 'var(--bg-primary, #fff)', border: 'none',
          fontSize: 13, fontWeight: 500, padding: '13px 28px', borderRadius: 12,
          letterSpacing: -0.2, cursor: 'pointer', fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          <IconFeather size={14} />
          한 줄 남기기
        </button>
        <div style={{ marginTop: 16, fontSize: 10, color: 'var(--text-dim)' }}>한 단어여도 충분해요</div>
        {showWrite && <JournalWriteScreen onSave={handleSave} onClose={() => setShowWrite(false)} initialPrompt={selectedPrompt} />}
      </div>
    );
  }

  // 케이스 B
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthEntries = entries.filter(e => e.date.slice(0, 7) === thisMonth);
  const thisMonthCond = thisMonthEntries.map(e => getConditionForDate(e.date)).filter(Boolean);
  const avgCond = thisMonthCond.length > 0 ? (thisMonthCond.reduce((s, c) => s + c.avg, 0) / thisMonthCond.length).toFixed(1) : null;

  return (
    <div style={{ padding: '0 18px 20px' }}>
      {/* 이번 달 커버 */}
      <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: 'var(--card-border)', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{now.getMonth() + 1}월 · {thisMonthEntries.length}편의 저널</div>
            {thisMonthEntries.length > 0 && (
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.5, marginTop: 6, fontFamily: "'Noto Sans KR', 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                "{thisMonthEntries[0].content.slice(0, 40)}{thisMonthEntries[0].content.length > 40 ? '...' : ''}"
              </div>
            )}
          </div>
          {avgCond && (
            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>{avgCond}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>평균 컨디션</div>
            </div>
          )}
        </div>
      </div>

      {/* 월별 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {[{ key: 'all', label: '전체' }, ...months.map(m => ({ key: m, label: `${parseInt(m.split('-')[1])}월` }))].map(m => (
          <div key={m.key} onClick={() => setFilterMonth(m.key)} style={{
            fontSize: 11, padding: '6px 14px', borderRadius: 14, whiteSpace: 'nowrap', cursor: 'pointer',
            background: filterMonth === m.key ? 'var(--text-primary)' : 'var(--card-bg)',
            color: filterMonth === m.key ? 'var(--bg-primary, #fff)' : 'var(--text-muted)',
            border: filterMonth === m.key ? 'none' : 'var(--card-border)',
          }}>{m.label}</div>
        ))}
      </div>

      {/* 저널 카드 리스트 */}
      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 13 }}>이 달엔 아직 결이 없어요</div>
          <button onClick={() => setShowWrite(true)} style={{ marginTop: 12, background: 'var(--text-primary)', color: 'var(--bg-primary, #fff)', border: 'none', fontSize: 12, fontWeight: 500, padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}>한 줄 남기기</button>
        </div>
      ) : visible.map(entry => {
        const dt = new Date(entry.date + 'T00:00:00');
        const cond = getConditionForDate(entry.date);
        const chips = getDayChips(entry.date);
        const condColor = cond ? (cond.avg >= 7 ? '#639922' : cond.avg >= 5 ? '#FAC775' : '#E05050') : null;
        return (
          <div key={entry.id} onClick={() => setShowDetail(entry)} style={{
            background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: 'var(--card-border)', borderRadius: 12, padding: 16, marginBottom: 8, cursor: 'pointer',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{dt.getMonth() + 1}월 {dt.getDate()}일 {DAY_NAMES_J[dt.getDay()]}</div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 1 }}>{getRelativeTime(entry.date)}</div>
              </div>
              {cond && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{cond.avg.toFixed(1)}</span>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: condColor }} />
                </div>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, fontFamily: "'Noto Sans KR', 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif" }}>{entry.content}</div>
            {(entry.mood_tags?.length > 0 || chips.length > 0) && (
              <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
                {(entry.mood_tags || []).map((tag, i) => (
                  <span key={`m${i}`} style={{ fontSize: 9, color: 'var(--text-primary)', background: 'var(--surface-light, rgba(255,255,255,0.08))', padding: '3px 8px', borderRadius: 8 }}>{tag}</span>
                ))}
                {chips.map((chip, i) => (
                  <span key={`c${i}`} style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--surface-medium, rgba(255,255,255,0.06))', padding: '3px 8px', borderRadius: 8 }}>{chip}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {hasMore && (
        <div onClick={() => setShowCount(s => s + 10)} style={{ textAlign: 'center', padding: 16, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>
          더 보기 ({filtered.length - showCount}편) ↓
        </div>
      )}

      {/* FAB */}
      <div onClick={() => { setSelectedPrompt(''); setShowWrite(true); }} style={{
        position: 'fixed', bottom: 90, right: 20, zIndex: 100,
        width: 48, height: 48, borderRadius: '50%',
        background: 'var(--text-primary)', color: 'var(--bg-primary, #fff)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      }}>
        <IconFeather size={20} />
      </div>

      {showWrite && <JournalWriteScreen onSave={handleSave} onClose={() => setShowWrite(false)} initialPrompt={selectedPrompt} editEntry={editEntry} />}
      {showDetail && <JournalDetailScreen entry={showDetail} entries={entries} onClose={() => setShowDetail(null)} onEdit={(e) => { setEditEntry(e); setShowDetail(null); setShowWrite(true); }} onDelete={handleDelete} />}
    </div>
  );
}

// ===== 화면 A: 저널 작성 =====
function JournalWriteScreen({ onSave, onClose, initialPrompt, editEntry }) {
  const [content, setContent] = useState(editEntry?.content || '');
  const [prompt, setPrompt] = useState(editEntry?.prompt || initialPrompt || '');
  const [moodTags, setMoodTags] = useState(editEntry?.mood_tags || []);
  const [showData, setShowData] = useState(true);
  const today = new Date();
  const dateStr = editEntry?.date || today.toISOString().slice(0, 10);
  const dt = new Date(dateStr + 'T00:00:00');
  const cond = getConditionForDate(dateStr);
  const rec = getDayRecord(dateStr);
  const luaMsg = getLuaMessage(dateStr);

  // 임시 저장
  useEffect(() => {
    if (editEntry) return;
    const draft = (() => { try { return JSON.parse(localStorage.getItem(JOURNAL_DRAFT_KEY)); } catch { return null; } })();
    if (draft?.content && !content) setContent(draft.content);
  }, []);
  useEffect(() => {
    if (editEntry) return;
    const t = setTimeout(() => { if (content) localStorage.setItem(JOURNAL_DRAFT_KEY, JSON.stringify({ content, prompt, moodTags })); }, 1000);
    return () => clearTimeout(t);
  }, [content, prompt, moodTags]);

  const handleSave = () => {
    if (!content.trim()) return;
    onSave({
      id: editEntry?.id || `j_${Date.now()}`,
      date: dateStr,
      content: content.trim(),
      prompt: prompt || '',
      mood_tags: moodTags,
      created_at: editEntry?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  };

  const defaultPrompts = ['오늘 가장 기억에 남는 순간은 뭐였나요?', '몸이 가장 편했던 순간은 언제였나요?', '내일은 어떤 하루를 보내고 싶나요?'];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2003, background: 'var(--page-gradient, linear-gradient(to bottom, #ace2fc, #ffffff))', display: 'flex', flexDirection: 'column', overflowY: 'auto', WebkitOverflowScrolling: 'touch', animation: 'breatheIn 0.3s ease both' }}>
      {/* A-1 헤더 */}
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div onClick={onClose} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <IconX size={20} color="var(--text-muted)" />
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{dt.getMonth() + 1}월 {dt.getDate()}일 {DAY_NAMES_J[dt.getDay()]}</span>
        <div onClick={handleSave} style={{ padding: '6px 12px', cursor: 'pointer' }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: content.trim() ? 'var(--accent-primary)' : 'var(--text-dim)' }}>저장</span>
        </div>
      </div>

      <div style={{ padding: '0 16px', flex: 1 }}>
        {/* A-2 lua 한마디 */}
        <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 12, padding: 16, marginBottom: 12, border: 'var(--card-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <IconSparkles size={14} color="var(--accent-primary)" />
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)' }}>오늘의 lua 한마디</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{luaMsg}</div>
        </div>

        {/* A-3 프롬프트 카드 */}
        {!prompt && (
          <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 12, padding: 16, marginBottom: 12, border: 'var(--card-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <IconBulb size={12} color="var(--text-muted)" />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>이런 질문은 어때요</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {defaultPrompts.map((p, i) => (
                <div key={i} onClick={() => setPrompt(p)} style={{ background: 'var(--surface-light, rgba(255,255,255,0.08))', padding: '10px 12px', borderRadius: 10, fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, fontFamily: "'Noto Sans KR', 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", cursor: 'pointer' }}>{p}</div>
              ))}
              <div onClick={() => setPrompt(' ')} style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', cursor: 'pointer' }}>자유롭게 쓰기 →</div>
            </div>
          </div>
        )}

        {/* A-4 글 작성 */}
        <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 12, padding: 16, marginBottom: 12, minHeight: 180, border: 'var(--card-border)' }}>
          {prompt && prompt.trim() && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', fontFamily: "'Noto Sans KR', 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", marginBottom: 8, paddingBottom: 8, borderBottom: '0.5px solid var(--border-light)' }}>"{prompt}"</div>
          )}
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="여기에 마음을 적어주세요..." autoFocus
            style={{ width: '100%', minHeight: 100, border: 'none', outline: 'none', resize: 'none', background: 'transparent', fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)', fontFamily: "'Noto Sans KR', 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif" }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '0.5px solid var(--border-light)' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <IconPhoto size={16} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
              <IconMicrophone size={16} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
              <IconMoodSmile size={16} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{content.length} / 자유</span>
          </div>
        </div>

        {/* A-5 무드 태그 */}
        <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 12, padding: '14px 16px', marginBottom: 12, border: 'var(--card-border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>오늘 어떤 기분이었어요?</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MOOD_TAGS.map(tag => {
              const sel = moodTags.includes(tag);
              return (
                <div key={tag} onClick={() => setMoodTags(sel ? moodTags.filter(t => t !== tag) : [...moodTags, tag])}
                  style={{ background: sel ? 'var(--surface-light)' : 'transparent', border: sel ? 'none' : '0.5px solid var(--border-light)', padding: '6px 12px', borderRadius: 14, fontSize: 11, color: sel ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer' }}>
                  {tag}
                </div>
              );
            })}
          </div>
        </div>

        {/* A-6 오늘의 데이터 */}
        {showData && (
          <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, border: 'var(--card-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>오늘의 데이터</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { label: '컨디션', value: cond ? cond.avg.toFixed(1) : '—' },
                { label: '수면', value: rec.sleep > 0 ? `${rec.sleep}h` : '—' },
                { label: '카페인', value: rec.cafMg > 0 ? `${rec.cafMg}mg` : '—' },
              ].map(d => (
                <div key={d.label} style={{ background: 'var(--surface-light, rgba(255,255,255,0.08))', padding: 8, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{d.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{d.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 화면 B: 저널 상세 =====
function JournalDetailScreen({ entry, entries, onClose, onEdit, onDelete }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const dt = new Date(entry.date + 'T00:00:00');
  const cond = getConditionForDate(entry.date);
  const rec = getDayRecord(entry.date);
  const condColor = cond ? (cond.avg >= 7 ? '#639922' : cond.avg >= 5 ? '#FAC775' : '#E05050') : null;
  const createdAt = entry.created_at ? new Date(entry.created_at) : null;
  const timeStr = createdAt ? `${createdAt.getHours() >= 21 ? '밤' : createdAt.getHours() >= 18 ? '저녁' : createdAt.getHours() >= 12 ? '오후' : '오전'} ${createdAt.getHours() > 12 ? createdAt.getHours() - 12 : createdAt.getHours()}시 ${createdAt.getMinutes()}분에 작성` : '';

  // 이 시기의 다른 흔적
  const nearbyEntries = entries.filter(e => e.id !== entry.id && Math.abs((new Date(e.date) - new Date(entry.date)) / 86400000) <= 7).slice(0, 3);

  // 이날의 사진
  const dayPhotos = (() => {
    try {
      const foods = JSON.parse(localStorage.getItem('lua_food_records') || '{}');
      return (foods[entry.date] || []).filter(f => f.photo && !f.name?.startsWith('물 ')).map(f => ({ url: f.photo, caption: f.meal || '' })).slice(0, 6);
    } catch { return []; }
  })();

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2003, background: 'var(--page-gradient, linear-gradient(to bottom, #ace2fc, #ffffff))', overflowY: 'auto', WebkitOverflowScrolling: 'touch', animation: 'breatheIn 0.3s ease both' }}>
      {/* B-1 헤더 */}
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div onClick={onClose} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <IconChevronLeft size={20} color="var(--text-muted)" />
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>저널</span>
        <div onClick={() => setShowMenu(!showMenu)} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
          <IconDots size={18} color="var(--text-muted)" />
        </div>
      </div>

      <div style={{ padding: '0 16px', paddingBottom: 40 }}>
        {/* B-2 시간 헤더 */}
        <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 12, padding: '18px 16px', marginBottom: 12, border: 'var(--card-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <IconMoon size={11} color="var(--text-muted)" />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{getRelativeTime(entry.date)} · {getSeasonLabel(entry.date)}</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>{dt.getMonth() + 1}월 {dt.getDate()}일 {DAY_NAMES_J[dt.getDay()]}</div>
          {timeStr && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeStr}</div>}
          {entry.mood_tags?.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              {entry.mood_tags.map((tag, i) => (
                <span key={i} style={{ background: 'var(--surface-light, rgba(255,255,255,0.15))', padding: '4px 10px', borderRadius: 12, fontSize: 11, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {condColor && <span style={{ width: 6, height: 6, borderRadius: '50%', background: condColor }} />}
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* B-3 본문 */}
        <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 12, padding: '20px 18px', marginBottom: 12, border: 'var(--card-border)' }}>
          {entry.prompt && entry.prompt.trim() && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', fontFamily: "'Noto Sans KR', 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", marginBottom: 12, paddingBottom: 10, borderBottom: '0.5px solid var(--border-light)' }}>"{entry.prompt}"</div>
          )}
          <div style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.9, fontFamily: "'Noto Sans KR', 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", whiteSpace: 'pre-wrap' }}>{entry.content}</div>
        </div>

        {/* B-4 그날의 데이터 */}
        {(cond || rec.sleep > 0 || rec.cafMg > 0 || rec.steps > 0) && (
          <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 12, padding: 16, marginBottom: 12, border: 'var(--card-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <IconChartDots size={13} color="var(--text-muted)" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>이 글을 쓰던 날</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 10 }}>
              {[
                cond && { label: '컨디션', value: cond.avg.toFixed(1), ctx: cond.avg >= 7 ? '좋은 날' : '보통' },
                rec.sleep > 0 && { label: '수면', value: `${rec.sleep}h`, ctx: rec.sleep >= 7 ? '충분' : '부족' },
                rec.cafMg > 0 && { label: '카페인', value: `${rec.cafMg}mg`, ctx: `아메리카노 ${Math.round(rec.cafMg / 150)}잔` },
                rec.steps > 0 && { label: '활동', value: rec.steps.toLocaleString(), ctx: `걸음` },
              ].filter(Boolean).map(d => (
                <div key={d.label} style={{ background: 'var(--surface-light, rgba(255,255,255,0.08))', padding: 10, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{d.label}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>{d.value}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{d.ctx}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* B-5 이날의 사진 */}
        {dayPhotos.length > 0 && (
          <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 12, padding: 16, marginBottom: 12, border: 'var(--card-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconPhoto size={13} color="var(--text-muted)" />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>이날의 사진</span>
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{dayPhotos.length}장</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {dayPhotos.map((p, i) => (
                <div key={i} style={{ aspectRatio: '1', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                  <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {p.caption && <span style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: 8, padding: '1px 4px', borderRadius: 3 }}>{p.caption}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* B-6 다른 흔적 */}
        {nearbyEntries.length > 0 && (
          <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 12, padding: 16, marginBottom: 12, border: 'var(--card-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <IconHistory size={13} color="var(--text-muted)" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>이 시기의 다른 흔적들</span>
            </div>
            {nearbyEntries.map((ne, i) => {
              const ned = new Date(ne.date + 'T00:00:00');
              const neCond = getConditionForDate(ne.date);
              return (
                <div key={ne.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < nearbyEntries.length - 1 ? '0.5px solid var(--border-light)' : 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{ned.getMonth() + 1}월</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{ned.getDate()}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{DAY_NAMES_J[ned.getDay()].slice(0, 1)}</span>
                  </div>
                  <div style={{ flex: 1, paddingLeft: 10, borderLeft: '0.5px solid var(--border-light)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5, fontFamily: "'Noto Sans KR', 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", marginBottom: 3 }}>{ne.content.slice(0, 50)}{ne.content.length > 50 ? '...' : ''}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{neCond ? `컨디션 ${neCond.avg.toFixed(1)}` : ''} · {getRelativeTime(ne.date)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* B-7 액션 바 */}
        <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'var(--card-border)' }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <IconEdit size={16} color="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={() => onEdit(entry)} />
            <IconShare size={16} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
            <IconDownload size={16} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
          </div>
          <IconTrash size={16} color="var(--text-dim)" style={{ cursor: 'pointer' }} onClick={() => setShowDeleteConfirm(true)} />
        </div>
      </div>

      {/* 삭제 확인 */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-primary, #fff)', borderRadius: 16, padding: '24px 20px', width: 280, textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>이 저널을 삭제할까요?</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>삭제 후 복구할 수 없어요.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--surface-light, #f0f0f0)', fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
              <button onClick={() => onDelete(entry.id)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#E05050', fontSize: 13, color: '#fff', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== JOURNEY TAB =====
import { IconArrowRight, IconTrophy, IconTrendingUp, IconFlag, IconCamera } from '@tabler/icons-react';

function JourneyTab({ daysTogether }) {
  // 월별 데이터 수집
  const buildMonthlyChapters = () => {
    const recs = (() => { try { return JSON.parse(localStorage.getItem('lua_record_v2') || '{}'); } catch { return {}; } })();
    const foods = (() => { try { return JSON.parse(localStorage.getItem('lua_food_records') || '{}'); } catch { return {}; } })();
    const checks = (() => { try { return JSON.parse(localStorage.getItem('nou_condition_checks') || '[]'); } catch { return []; } })();
    const drinks = (() => { try { return JSON.parse(localStorage.getItem('lua_drink_records') || '{}'); } catch { return {}; } })();
    const journals = getJournalEntries();

    // 모든 날짜 수집
    const allDates = [...new Set([...Object.keys(recs), ...Object.keys(foods), ...checks.map(c => c.date).filter(Boolean)])].sort();
    if (allDates.length === 0) return { chapters: [], startScore: 0, currentScore: 0 };

    const firstDate = allDates[0];
    const firstMonth = firstDate.slice(0, 7);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 월 목록 생성 (현재 → 시작)
    const monthList = [];
    let d = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstD = new Date(firstDate);
    while (d >= new Date(firstD.getFullYear(), firstD.getMonth(), 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthList.push(key);
      d.setMonth(d.getMonth() - 1);
    }

    const chapters = monthList.map((monthKey, idx) => {
      const [y, m] = monthKey.split('-').map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      const monthDates = allDates.filter(d => d.startsWith(monthKey));
      const daysRecorded = new Set(monthDates).size;

      // 컨디션 평균
      const monthChecks = checks.filter(c => (c.date || '').startsWith(monthKey));
      const condScores = monthChecks.map(c => {
        const e = c.energy || c.에너지 || 0, mo = c.mood || c.기분 || 0, s = c.skin || c.피부 || 0, g = c.gut || c.소화 || 0;
        return (e + mo + s + g) / 4;
      }).filter(v => v > 0);
      const avgCond = condScores.length > 0 ? (condScores.reduce((a, b) => a + b, 0) / condScores.length) : 0;

      // 수면 평균
      const sleepVals = monthDates.map(d => recs[d]?.sleep?.hours).filter(h => h > 0);
      const avgSleep = sleepVals.length > 0 ? (sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length) : 0;

      // 전월 컨디션 (변화량 계산용)
      let prevCond = null;
      if (idx < monthList.length - 1) {
        const prevKey = monthList[idx + 1];
        const prevChecks = checks.filter(c => (c.date || '').startsWith(prevKey));
        const prevScores = prevChecks.map(c => ((c.energy || c.에너지 || 0) + (c.mood || c.기분 || 0) + (c.skin || c.피부 || 0) + (c.gut || c.소화 || 0)) / 4).filter(v => v > 0);
        prevCond = prevScores.length > 0 ? prevScores.reduce((a, b) => a + b, 0) / prevScores.length : null;
      }

      const isStart = monthKey === firstMonth;
      const isCurrent = monthKey === currentMonth;
      const status = isCurrent ? 'current' : isStart ? 'start' : 'past';

      // 마일스톤 생성
      const milestones = [];
      if (isStart) {
        const fd = new Date(firstDate);
        milestones.push({ type: 'start', icon: 'flag', text: `lua와의 첫 만남 · ${fd.getMonth() + 1}월 ${fd.getDate()}일`, primary: true });
      }
      if (prevCond !== null && avgCond > 0 && avgCond - prevCond >= 0.3) {
        milestones.push({ type: 'improvement', icon: 'trending', text: `컨디션 +${(avgCond - prevCond).toFixed(1)} 상승`, primary: milestones.length === 0 });
      }
      // 연속 기록 체크 (해당 월)
      const sortedDates = [...new Set(monthDates)].sort();
      let maxStreak = 0, streak = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        if ((new Date(sortedDates[i]) - new Date(sortedDates[i - 1])) / 86400000 === 1) { streak++; maxStreak = Math.max(maxStreak, streak); }
        else streak = 1;
      }
      maxStreak = Math.max(maxStreak, streak);
      if (maxStreak >= 7) milestones.push({ type: 'achievement', icon: 'trophy', text: `${maxStreak}일 연속 기록 달성`, primary: milestones.length === 0 });

      // 그달의 한 줄 (간단 생성)
      let quote = '';
      if (isCurrent) {
        if (avgCond >= 7) quote = '좋은 흐름을 이어가고 있는 달';
        else if (avgSleep >= 7) quote = '잠을 잘 자는 법을 배워가고 있는 달';
        else quote = '꾸준히 기록하며 나를 알아가는 달';
      } else if (isStart) {
        quote = '내 몸을 처음 들여다본 달';
      } else {
        if (avgCond >= 7) quote = '컨디션이 안정되기 시작한 달';
        else quote = '기록의 리듬을 찾아가던 달';
      }

      return { monthKey, year: y, month: m, status, daysRecorded, daysInMonth, avgCond, avgSleep, condChange: prevCond !== null && avgCond > 0 ? avgCond - prevCond : null, milestones, quote };
    });

    const startChapter = chapters[chapters.length - 1];
    const currentChapter = chapters[0];

    return {
      chapters,
      startScore: startChapter?.avgCond || 0,
      currentScore: currentChapter?.avgCond || 0,
      startMonth: startChapter?.month || 1,
      currentMonth: currentChapter?.month || now.getMonth() + 1,
    };
  };

  const { chapters, startScore, currentScore, startMonth, currentMonth: curMonth } = buildMonthlyChapters();
  const scoreChange = currentScore - startScore;

  // 큰 그림 메시지
  const bigPictureMsg = scoreChange > 0.5 ? '매일이 비슷해 보이지만, 천천히 좋아지고 있어요'
    : scoreChange < -0.5 ? '쉬어가는 시간도 여정의 일부예요'
    : '꾸준히 기록하는 것 자체가 변화의 시작이에요';

  const DOT_COLORS = { current: '#042C53', past: '#B5D4F4', start: '#DCEEFB' };
  const MILESTONE_ICONS = {
    trophy: <IconTrophy size={11} color="#BA7517" />,
    trending: <IconTrendingUp size={11} color="#639922" />,
    bulb: <IconBulb size={11} color="#BA7517" />,
    camera: <IconCamera size={11} color="var(--text-muted)" />,
    flag: <IconFlag size={11} color="#534AB7" />,
  };

  if (chapters.length === 0) {
    return (
      <div style={{ padding: '40px 18px', textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>🛤</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>여정이 시작되면 여기에 표시돼요</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>기록을 시작하면 당신만의 여정이 만들어져요</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 20px' }}>
      {/* 3. 큰 그림 카드 */}
      <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: 'var(--card-border)', borderRadius: 12, padding: 16, marginBottom: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
          {chapters.length >= 2 ? `${chapters.length}개월 전과 지금` : '지금까지의 기록'}
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: "'Noto Sans KR', 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", lineHeight: 1.5, marginBottom: 14 }}>
          "{bigPictureMsg}"
        </div>
        {startScore > 0 && currentScore > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{startMonth}월 시작</div>
              <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-muted)' }}>{startScore.toFixed(1)}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>평균 컨디션</div>
            </div>
            <IconArrowRight size={16} color="var(--text-muted)" />
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{curMonth}월 지금</div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
                <span style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>{currentScore.toFixed(1)}</span>
                {scoreChange !== 0 && <span style={{ fontSize: 10, color: scoreChange > 0 ? '#639922' : '#A32D2D' }}>{scoreChange > 0 ? '↑' : '↓'}{Math.abs(scoreChange).toFixed(1)}</span>}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>평균 컨디션</div>
            </div>
          </div>
        )}
      </div>

      {/* 4. 연도 구분선 */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
        <span style={{ fontSize: 9, color: 'var(--text-primary)', background: 'var(--card-bg)', padding: '4px 12px', borderRadius: 12, border: 'var(--card-border)' }}>{new Date().getFullYear()}년</span>
      </div>

      {/* 5. 월별 챕터 타임라인 */}
      <div style={{ position: 'relative', paddingLeft: 20, paddingBottom: 20 }}>
        {/* 세로선 */}
        <div style={{ position: 'absolute', left: 8, top: 8, bottom: 0, width: 1, background: 'linear-gradient(180deg, #B5D4F4 0%, #B5D4F4 70%, transparent 100%)' }} />

        {chapters.map((ch, i) => (
          <div key={ch.monthKey} style={{ position: 'relative', marginBottom: i < chapters.length - 1 ? 14 : 0 }}>
            {/* 점 */}
            <div style={{ position: 'absolute', left: -16, top: 4, width: 10, height: 10, background: DOT_COLORS[ch.status], borderRadius: '50%', border: '2px solid var(--bg-primary, #fff)', zIndex: 1 }} />

            {/* 카드 */}
            <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: 'var(--card-border)', borderRadius: 12, padding: 16 }}>
              {/* 헤더 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{ch.month}월</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {ch.status === 'current' ? `현재 · ${daysTogether}일째` : ch.status === 'start' ? `시작 · ${ch.daysRecorded}일간 기록` : `${ch.daysRecorded}일간 기록`}
                  </div>
                </div>
                {ch.status === 'current' && <span style={{ background: 'rgba(250,238,218,0.3)', color: 'var(--text-muted)', fontSize: 9, padding: '3px 8px', borderRadius: 8 }}>진행 중</span>}
                {ch.status === 'start' && <span style={{ background: 'rgba(238,237,254,0.3)', color: 'var(--text-muted)', fontSize: 9, padding: '3px 8px', borderRadius: 8 }}>시작</span>}
              </div>

              {/* 한 줄 */}
              <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6, fontFamily: "'Noto Sans KR', 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", marginBottom: 12 }}>"{ch.quote}"</div>

              {/* 지표 3개 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: ch.milestones.length > 0 ? 12 : 0 }}>
                {[
                  { label: '컨디션', value: ch.avgCond > 0 ? ch.avgCond.toFixed(1) : '—', change: ch.condChange },
                  { label: '수면', value: ch.avgSleep > 0 ? `${ch.avgSleep.toFixed(1)}h` : '—' },
                  { label: '기록일', value: ch.daysRecorded },
                ].map(met => (
                  <div key={met.label} style={{ background: 'var(--surface-light, rgba(255,255,255,0.08))', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: ch.status === 'start' ? 'var(--text-muted)' : 'var(--text-primary)' }}>{met.value}</span>
                      {met.change != null && met.change !== 0 && (
                        <span style={{ fontSize: 9, color: met.change > 0 ? '#639922' : '#A32D2D' }}>{met.change > 0 ? '↑' : '↓'}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 9, color: ch.status === 'start' ? 'var(--text-dim)' : 'var(--text-muted)' }}>{met.label}</div>
                  </div>
                ))}
              </div>

              {/* 마일스톤 */}
              {ch.milestones.length > 0 && (
                <div style={{ borderTop: '0.5px solid var(--border-light)', paddingTop: 10 }}>
                  {ch.milestones.map((ms, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: j < ch.milestones.length - 1 ? 4 : 0 }}>
                      {MILESTONE_ICONS[ms.icon] || <IconFlag size={11} color="var(--text-muted)" />}
                      <span style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: ms.primary ? 500 : 400 }}>{ms.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== SETTINGS PAGE =====
function SettingsPage({ open, onClose, onCategoriesChanged, onTabChange, colorMode, setColorMode }) {
  const [showProfilePage, setShowProfilePage] = useState(false);
  const [showCategoryPage, setShowCategoryPage] = useState(false);
  const [showGoalPage, setShowGoalPage] = useState(false);
  const [showDisplayPage, setShowDisplayPage] = useState(false);

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
        { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>, label: '화면 모드', action: () => setShowDisplayPage(true), right: <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{colorMode === 'dark' ? '다크' : '라이트'}</span> },
        { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>, label: '카테고리', action: () => setShowCategoryPage(true) },
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
        background: 'var(--page-gradient, linear-gradient(to bottom, #ace2fc, #ffffff))',
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
                  {item.right || null}
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
      {showDisplayPage && <DisplaySettingsPage onClose={() => setShowDisplayPage(false)} colorMode={colorMode} setColorMode={setColorMode} />}
    </>
  );
}

// ===== DISPLAY SETTINGS PAGE =====
function DisplaySettingsPage({ onClose, colorMode, setColorMode }) {
  const modes = [
    { key: 'light', label: '라이트 모드', icon: '☀️', desc: '밝은 배경' },
    { key: 'dark', label: '다크 모드', icon: '🌙', desc: '어두운 배경' },
  ];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2002,
      background: 'var(--page-gradient, linear-gradient(to bottom, #ace2fc, #ffffff))',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      {/* 헤더 */}
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
        <div onClick={onClose} style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>화면 모드</span>
      </div>

      {/* 모드 선택 */}
      <div style={{ padding: '24px 20px' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {modes.map(m => {
            const selected = colorMode === m.key;
            return (
              <div
                key={m.key}
                onClick={() => setColorMode(m.key)}
                style={{
                  flex: 1, padding: '20px 14px', borderRadius: 20, cursor: 'pointer',
                  background: selected ? (m.key === 'dark' ? '#1a1a24' : '#fff') : 'rgba(255,255,255,0.4)',
                  border: selected ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  WebkitTapHighlightColor: 'transparent',
                  boxShadow: selected ? '0 4px 16px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 10 }}>{m.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: selected ? (m.key === 'dark' ? '#f0f0f5' : '#191F28') : '#6b7684', marginBottom: 4 }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 11, color: selected ? (m.key === 'dark' ? '#8888a0' : '#8B95A1') : '#B0B8C1' }}>
                  {m.desc}
                </div>
                {selected && (
                  <div style={{ marginTop: 10 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
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
      background: 'var(--page-gradient, linear-gradient(to bottom, #ace2fc, #ffffff))',
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
      background: 'var(--page-gradient, linear-gradient(to bottom, #ace2fc, #ffffff))',
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
              width: 36, height: 18, borderRadius: 7, position: 'relative', cursor: 'pointer',
              background: expandAll ? 'linear-gradient(120deg, #90CCE8, #60AADD)' : 'rgba(180,200,210,.3)',
              transition: 'background 0.2s ease',
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: 5, background: '#fff',
                position: 'absolute', top: 2,
                left: expandAll ? 20 : 2,
                transition: 'left 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }} />
            </div>
          </div>
        </div>
        {[
          { group: 'cause', label: '내가 하는 것', desc: '' },
          { group: 'result', label: '나의 상태', desc: '' },
        ].map(({ group, label, desc }) => {
          const groupCats = categories.filter(c => c.group === group);
          if (groupCats.length === 0) return null;
          return (
            <div key={group} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 14px', marginBottom: 16 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#1A3A4A' }}>{label}</span>
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
                        style={{ cursor: 'grab', flexShrink: 0, touchAction: 'none', userSelect: 'none', padding: '4px 2px', WebkitTapHighlightColor: 'transparent', outline: 'none' }}
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
                        background: 'rgba(255,255,255,0.6)',
                        borderRadius: '0 0 14px 14px',
                        padding: '12px 32px',
                        borderTop: 'none',
                        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px 0', justifyItems: 'center',
                      }}>
                        {COLOR_OPTIONS.map(c => (
                          <div key={c} onClick={() => selectColor(cat.key, c)} style={{
                            width: 26, height: 26, borderRadius: 7, cursor: 'pointer',
                            background: c,
                            border: cat.color === c ? '2px solid #1A3A4A' : '2px solid transparent',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                            transition: 'border 0.15s ease',
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
      background: 'var(--page-gradient, linear-gradient(to bottom, #ace2fc, #ffffff))',
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

        {/* Bio */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>자기소개</div>
          <textarea value={profile.bio || ''} onChange={e => onUpdate('bio', e.target.value)}
            placeholder="자기소개를 입력하세요" maxLength={150} rows={3}
            style={{ ...inputStyle, resize: 'none', lineHeight: 1.5, fontFamily: 'inherit' }} />
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
            {profile.currentWeightDate && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, opacity: 0.7 }}>
                ({profile.currentWeightDate.replace(/-/g, '.')} 기준)
              </div>
            )}
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

        {/* 관심사 */}
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '24px 0 12px' }}>관심사</div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>웰니스 관심사 (중복 선택)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { icon: '\u26A1', label: '에너지·컨디션' },
              { icon: '\u2728', label: '피부 관리' },
              { icon: '\u2696\uFE0F', label: '체중 관리' },
              { icon: '\uD83D\uDE34', label: '수면 개선' },
              { icon: '\uD83E\uDDD8', label: '스트레스' },
              { icon: '\uD83D\uDC8A', label: '영양 관리' },
            ].map(item => {
              const active = (profile.onboardingInterests || []).includes(item.label);
              return (
                <button key={item.label} onClick={() => {
                  const list = active
                    ? profile.onboardingInterests.filter(x => x !== item.label)
                    : [...(profile.onboardingInterests || []), item.label];
                  onUpdate('onboardingInterests', list);
                }} style={{
                  padding: '8px 14px', borderRadius: 10, border: 'none',
                  background: active ? 'var(--accent-primary)' : 'var(--bg-input, #F2F3F5)',
                  color: active ? '#fff' : 'var(--text-muted)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>{item.icon} {item.label}</button>
              );
            })}
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
const historyFilterIngredients = (list) => {
  if (!list || list.length === 0) return [];
  if (list.length < 5) return list;
  return list.filter(ing => {
    if ((ing.kcal || 0) >= 5) return true;
    const amt = ing.amount || '';
    const gMatch = amt.match(/(\d+)\s*g/);
    const mlMatch = amt.match(/(\d+)\s*ml/);
    if (gMatch && parseInt(gMatch[1]) >= 50) return true;
    if (mlMatch && parseInt(mlMatch[1]) >= 100) return true;
    return false;
  });
};

const HISTORY_IMPACT_STYLE = {
  '낮음': { bg: '#E8F8F0', color: '#0F6E56' },
  '보통': { bg: '#FFF8E1', color: '#F59E0B' },
  '높음': { bg: '#FBEAF0', color: '#993556' },
  '좋음': { bg: '#E8F8F0', color: '#0F6E56' },
  '주의': { bg: '#FBEAF0', color: '#993556' },
};

function HistoryFoodDetailModal({ food, onClose, onDelete }) {
  const [showConfirm, setShowConfirm] = useState(false);

  const impactItems = [
    { icon: '📈', label: '혈당 상승', value: food.bloodSugar, note: food.bloodSugarNote },
    { icon: '😴', label: '졸림 확률', value: food.drowsiness, note: food.drowsinessNote },
    { icon: '✨', label: '피부 영향', value: food.skinImpact, note: food.skinImpactNote },
  ];

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-secondary, #fff)', borderRadius: '24px 24px 0 0',
        padding: '12px 20px 40px', width: '100%', maxWidth: 430,
        maxHeight: '88vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        {/* Handle bar + back/delete */}
        <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', marginBottom: 28 }}>
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

        {/* Photo + Name header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          {food.photo ? (
            <FoodPhoto photo={food.photo} style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(137,206,245,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🍽️</div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{food.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{food.meal}</div>
          </div>
        </div>

        {/* Nutrition grid */}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>영양 정보</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          {[
            { icon: '🔥', label: '칼로리', value: food.kcal, unit: 'kcal' },
            { icon: '🥩', label: '단백질', value: food.protein, unit: 'g' },
            { icon: '🍞', label: '탄수화물', value: food.carb, unit: 'g' },
            { icon: '🥑', label: '지방', value: food.fat, unit: 'g' },
          ].map(n => (
            <div key={n.label} style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 12 }}>
              <div style={{ fontSize: 16, marginBottom: 4 }}>{n.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 400, color: 'rgba(0,0,0,0.7)' }}>{n.label}</div>
              <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.5)', marginTop: 2 }}>{n.value}<span>{n.unit}</span></div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
          {[
            { icon: '🥕', label: '식이섬유', value: food.fiber || 0, unit: 'g' },
            { icon: '🥦', label: '철분', value: food.iron || 0, unit: 'mg' },
            { icon: '🐟', label: '칼슘', value: food.calcium || 0, unit: 'mg' },
            { icon: '🍯', label: '당류', value: food.sugar || 0, unit: 'g' },
          ].map(n => (
            <div key={n.label} style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 12 }}>
              <div style={{ fontSize: 16, marginBottom: 4 }}>{n.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 400, color: 'rgba(0,0,0,0.7)' }}>{n.label}</div>
              <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.5)', marginTop: 2 }}>{n.value}<span>{n.unit}</span></div>
            </div>
          ))}
        </div>

        {/* Ingredients breakdown */}
        {historyFilterIngredients(food.ingredients).length > 0 && (() => {
          const filtered = historyFilterIngredients(food.ingredients);
          return (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>재료 구성</div>
            <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--bg-card)', marginBottom: 20 }}>
              {filtered.map((ing, i) => (
                <div key={i} style={{
                  padding: '8px 0', borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{ing.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-primary)' }}>{ing.kcal}kcal</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ing.amount}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>탄<span style={{ fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 2 }}>{ing.carb}g</span></span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>단<span style={{ fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 2 }}>{ing.protein}g</span></span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>지<span style={{ fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 2 }}>{ing.fat}g</span></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
          );
        })()}

        {/* Impact analysis */}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>식후 영향 분석</div>
        {(food.bloodSugar || food.drowsiness || food.skinImpact) ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {impactItems.filter(i => i.value).map(item => {
              const s = HISTORY_IMPACT_STYLE[item.value] || HISTORY_IMPACT_STYLE['보통'];
              return (
                <div key={item.label} style={{
                  padding: '14px 16px', borderRadius: 14,
                  background: 'var(--bg-card)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.icon} {item.label}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8,
                      background: s.bg, color: s.color,
                    }}>{item.value}</span>
                  </div>
                  {item.note && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.note}</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            padding: '16px', borderRadius: 14, background: 'var(--bg-card)',
            fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 20, lineHeight: 1.6,
          }}>
            이전 방식으로 기록된 식사예요.<br />새로 기록하면 혈당·졸림·피부 영향까지 분석해드려요.
          </div>
        )}

      </div>
    </div>
  );
}

