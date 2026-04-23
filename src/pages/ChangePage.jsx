import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  getBodyRecords, saveBodyRecord, deleteBodyRecord,
  getBodyGoal, saveBodyGoal, getBodyProfile, saveBodyProfile,
  calcBMI, getLatestWeight, getStartWeight,
} from '../storage/BodyStorage';
import { getProfile, saveProfile, SKIN_TYPES, SKIN_CONCERNS, SENSITIVITY_OPTIONS, GENDER_OPTIONS, getEnabledCategories, getCategoryColor } from '../storage/ProfileStorage';
import { getRecords, getAllThumbnailsAsync } from '../storage/SkinStorage';
import { getLatestCheck, getConditionChecks, getTodayEnergySubCheck, saveEnergySubCheck, getTodayMoodSubCheck, saveMoodSubCheck, getTodayBloodSugar, saveBloodSugar, getTodayEyeBody, saveEyeBody, getTodaySkinSubCheck, saveSkinSubCheck, getEnergySubChecks, getMoodSubChecks, getSkinSubChecks, getBloodSugarChecks, getEyeBodyChecks } from '../storage/ConditionStorage';
import BeforeAfterSlider from '../components/BeforeAfterSlider';

const fadeUp = (delay = 0) => ({ animation: `breatheIn 0.5s ease ${delay}s both` });

function getDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getDateRange(period) {
  const today = new Date();
  const from = new Date(today);
  if (period === '1주') from.setDate(today.getDate() - 7);
  if (period === '1개월') from.setMonth(today.getMonth() - 1);
  if (period === '3개월') from.setMonth(today.getMonth() - 3);
  if (period === '전체') return { from: null, to: today };
  return { from, to: today };
}
function filterByRange(records, from, to, dateField = 'date') {
  if (!from) return records;
  const fromStr = getDateKey(from);
  const toStr = getDateKey(to);
  return records.filter(r => r[dateField] >= fromStr && r[dateField] <= toStr);
}
const changeColor = (diff) => diff < 0 ? '#4A9A7A' : diff > 0 ? '#C4580A' : '#7AAABB';
function loadRecordV2() {
  try { return JSON.parse(localStorage.getItem('lua_record_v2') || '{}'); } catch { return {}; }
}
const DEMO_PATTERNS = [
  { cause: '물 6잔 이상', effect: '수분 충분', result: '피부 점수 +3', desc: '수분을 6잔 이상 마신 날 다음날 피부 점수가 평균 3점 높아요.' },
  { cause: '7시간 이상 수면', effect: '깊은 수면', result: '에너지 상승', desc: '7시간 이상 잔 날은 에너지 수준이 평균 1.2단계 높았어요.' },
  { cause: '걷기 또는 운동', effect: '활동량 증가', result: '몸무게 -0.3kg', desc: '운동한 주는 체중이 평균 0.3kg 감소하는 패턴이 보여요.' },
];
const V2_SEGMENTS = ['결과', '원인→결과'];

function MiniChart({ data, color = '#80CCE8', height = 36, labels, xPositions }) {
  if (!data || data.length < 2) return null;
  const pad = 8;
  const w = 300, h = height;
  const min = Math.min(...data) * 0.995, max = Math.max(...data) * 1.005;
  const range = max - min || 1;
  const points = data.map((v, i) => ({
    x: xPositions ? pad + xPositions[i] * (w - pad * 2) : pad + (i / (data.length - 1)) * (w - pad * 2),
    y: h - ((v - min) / range) * (h - 8) - 4,
  }));
  let pathD = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const cx = (points[i].x + points[i + 1].x) / 2;
    pathD += ` C${cx},${points[i].y} ${cx},${points[i + 1].y} ${points[i + 1].x},${points[i + 1].y}`;
  }
  const last = points[points.length - 1];
  const areaD = pathD + ` L${points[points.length - 1].x},${h} L${points[0].x},${h} Z`;
  const cid = color.replace('#', '');
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height }}>
        <defs>
          <linearGradient id={`lc-${cid}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={color} stopOpacity="0.1" /><stop offset="100%" stopColor={color} /></linearGradient>
          <linearGradient id={`fill-${cid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient>
        </defs>
        <path d={areaD} fill={`url(#fill-${cid})`} />
        <path d={pathD} fill="none" stroke={`url(#lc-${cid})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last.x} cy={last.y} r="3" fill={color} stroke="#fff" strokeWidth="1.5" />
      </svg>
      {labels && labels.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, padding: `0 ${(pad / w * 100).toFixed(1)}%` }}>
          {labels.map((l, i) => {
            const isObj = typeof l === 'object';
            const text = isObj ? l.text : l;
            const bold = isObj && l.bold;
            return <span key={i} style={{ fontSize: 9, color: '#9ABBC8', flex: 1, textAlign: 'center', fontWeight: bold ? 700 : 400 }}>{text}</span>;
          })}
        </div>
      )}
    </div>
  );
}

export default function ChangePage({ onTabChange }) {
  const [records, setRecords] = useState(getBodyRecords);
  const [goal, setGoal] = useState(getBodyGoal);
  const [profile, setProfile] = useState(getBodyProfile);
  const [showAdd, setShowAdd] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [userProfile, setUserProfile] = useState(getProfile);
  const [activePeriod, setActivePeriod] = useState('1주');
  const [enabledCats, setEnabledCats] = useState(() => getEnabledCategories('result'));
  const [insightTab, setInsightTab] = useState('all');
  useEffect(() => {
    const handler = () => {
      const cats = getEnabledCategories('result');
      setEnabledCats(cats);
      if (insightTab !== 'all' && !cats.find(c => c.key === insightTab)) setInsightTab('all');
    };
    window.addEventListener('lua:categories-changed', handler);
    return () => window.removeEventListener('lua:categories-changed', handler);
  }, [insightTab]);
  const todayKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [showCal, setShowCal] = useState(false);
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [changeViewMode, setChangeViewMode] = useState('기록');
  const [showConditionHistory, setShowConditionHistory] = useState(false);
  const DAY_NAMES_C = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
  const changeDateLabel = (() => {
    const d = new Date(selectedDate + 'T00:00:00');
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const yestStr = `${yest.getFullYear()}-${String(yest.getMonth()+1).padStart(2,'0')}-${String(yest.getDate()).padStart(2,'0')}`;
    const prefix = selectedDate === todayKey ? '오늘' : selectedDate === yestStr ? '어제' : `${d.getMonth()+1}월 ${d.getDate()}일`;
    return `${prefix} / ${d.getMonth()+1}월 ${d.getDate()}일 ${DAY_NAMES_C[d.getDay()]}`;
  })();
  const isChangeToday = selectedDate === todayKey;
  const goChangePrev = () => {
    const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() - 1);
    setSelectedDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  };
  const goChangeNext = () => {
    if (isChangeToday) return;
    const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() + 1);
    const s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (s <= todayKey) setSelectedDate(s);
  };
  const [skinRecords, setSkinRecords] = useState([]);
  const [skinThumbs, setSkinThumbs] = useState({});
  const [compareTab, setCompareTab] = useState('monthly');
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [latestCondition] = useState(() => getLatestCheck());
  const [energySub, setEnergySub] = useState(() => getTodayEnergySubCheck());
  const handleEnergySub = useCallback((key, value) => {
    const cur = energySub || {};
    const v = cur[key] === value ? null : value;
    const newVitality = key === 'vitality' ? v : (cur.vitality ?? null);
    const newFocus = key === 'focus' ? v : (cur.focus ?? null);
    const saved = saveEnergySubCheck(newVitality, newFocus);
    setEnergySub(saved);
  }, [energySub]);
  const [moodSub, setMoodSub] = useState(() => getTodayMoodSubCheck());
  const [bloodSugar, setBloodSugar] = useState(() => getTodayBloodSugar());
  const [bsInput, setBsInput] = useState(bloodSugar?.value ?? '');
  const [bsTiming, setBsTiming] = useState(bloodSugar?.timing ?? '공복');
  const [bsGraphData, setBsGraphData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nou_bs_graph') || 'null'); } catch { return null; }
  });
  const [bsGraphLoading, setBsGraphLoading] = useState(false);
  const [bsGraphError, setBsGraphError] = useState(null);
  const [eyeBody, setEyeBody] = useState(() => getTodayEyeBody());
  const [skinSub, setSkinSub] = useState(() => getTodaySkinSubCheck());
  const handleSkinTag = useCallback((tag) => {
    const cur = skinSub || {};
    const tags = cur.tags || [];
    const next = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
    const saved = saveSkinSubCheck({ ...cur, tags: next });
    setSkinSub(saved);
  }, [skinSub]);
  const handleSkinScore = useCallback((score) => {
    const cur = skinSub || {};
    const saved = saveSkinSubCheck({ ...cur, score });
    setSkinSub(saved);
  }, [skinSub]);
  const handleSkinPhoto = useCallback((key, dataUrl) => {
    const cur = skinSub || {};
    const photos = { ...(cur.photos || {}), [key]: dataUrl };
    const saved = saveSkinSubCheck({ ...cur, photos });
    setSkinSub(saved);
  }, [skinSub]);
  const handleMoodEmotion = useCallback((emoji) => {
    const cur = moodSub || {};
    const emotions = cur.emotions || [];
    const next = emotions.includes(emoji) ? emotions.filter(e => e !== emoji) : [...emotions, emoji];
    const saved = saveMoodSubCheck(next, cur.stress ?? null);
    setMoodSub(saved);
  }, [moodSub]);
  const handleMoodStress = useCallback((value) => {
    const cur = moodSub || {};
    const saved = saveMoodSubCheck(cur.emotions || [], value);
    setMoodSub(saved);
  }, [moodSub]);

  // V2 state
  const [v2Segment, setV2Segment] = useState('결과');
  const [recordV2] = useState(() => loadRecordV2());
  const { from: v2From, to: v2To } = useMemo(() => getDateRange(activePeriod), [activePeriod]);
  const conditionChecks = useMemo(() => {
    const checks = getConditionChecks().filter(c => c.energy != null);
    if (!v2From) return checks;
    const fromStr = getDateKey(v2From);
    const toStr = getDateKey(v2To);
    return checks.filter(c => {
      const d = c.timestamp.slice(0, 10);
      return d >= fromStr && d <= toStr;
    });
  }, [v2From, v2To]);
  const filteredBody = useMemo(() => filterByRange(records, v2From, v2To), [records, v2From, v2To]);
  const filteredSkin = useMemo(() => filterByRange(skinRecords, v2From, v2To), [skinRecords, v2From, v2To]);
  const v2LatestWeight = filteredBody.length > 0 ? filteredBody[filteredBody.length - 1].weight : null;
  const v2StartWeight = filteredBody.length > 0 ? filteredBody[0].weight : null;
  const v2WeightDiff = v2LatestWeight && v2StartWeight ? Math.round((v2LatestWeight - v2StartWeight) * 10) / 10 : 0;
  const v2LatestSkin = filteredSkin.length > 0 ? filteredSkin[filteredSkin.length - 1] : null;
  const v2StartSkin = filteredSkin.length > 0 ? filteredSkin[0] : null;
  const v2SkinDiff = v2LatestSkin && v2StartSkin ? v2LatestSkin.overallScore - v2StartSkin.overallScore : 0;
  const recordEntries = useMemo(() => {
    const entries = [];
    const fromStr = v2From ? getDateKey(v2From) : null;
    const toStr = v2To ? getDateKey(v2To) : null;
    Object.entries(recordV2).forEach(([date, data]) => {
      if (fromStr && date < fromStr) return;
      if (toStr && date > toStr) return;
      entries.push({ date, ...data });
    });
    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }, [recordV2, v2From, v2To]);

  const v2CardStyle = { background: 'rgba(255,255,255,.65)', borderRadius: 16, padding: '14px 15px', border: '0.5px solid rgba(255,255,255,.9)', marginBottom: 10 };
  const v2IconBox = (bg) => ({ width: 26, height: 26, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 });

  const latest = records.length > 0 ? records[records.length - 1] : null;
  const start = records.length > 0 ? records[0] : null;
  const diff = start && latest ? (latest.weight - start.weight).toFixed(1) : null;
  const goalDiff = goal && latest ? (latest.weight - goal.target).toFixed(1) : null;
  const bmi = latest ? calcBMI(latest.weight, profile.height) : null;

  const refresh = useCallback(() => {
    setRecords(getBodyRecords());
    setGoal(getBodyGoal());
    setProfile(getBodyProfile());
  }, []);

  const handleSave = useCallback((weight) => {
    saveBodyRecord(weight);
    refresh();
    setShowAdd(false);
  }, [refresh]);

  const handleDelete = useCallback((date) => {
    deleteBodyRecord(date);
    refresh();
  }, [refresh]);

  const handleSaveGoal = useCallback((target) => {
    saveBodyGoal({ target });
    refresh();
    setShowGoalModal(false);
  }, [refresh]);

  useEffect(() => {
    setSkinRecords(getRecords());
    getAllThumbnailsAsync().then(setSkinThumbs);
  }, []);

  // Graph data (last 14 records)
  const graphData = useMemo(() => {
    const slice = records.slice(-14);
    if (slice.length < 2) return null;
    const weights = slice.map(r => r.weight);
    const min = Math.min(...weights) - 1;
    const max = Math.max(...weights) + 1;
    const range = max - min || 1;
    const w = 280;
    const h = 60;
    const points = slice.map((r, i) => {
      const x = (i / (slice.length - 1)) * w;
      const y = h - ((r.weight - min) / range) * h;
      return `${x},${y}`;
    }).join(' ');
    const lastPt = { x: w, y: h - ((weights[weights.length - 1] - min) / range) * h };
    return { points, lastPt, w, h };
  }, [records]);

  const recentRecords = [...records].reverse().slice(0, 10);
  const today = new Date();

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ padding: '16px 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--text-primary)', fontFamily: 'Pretendard, sans-serif' }}>돌아보기</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div onClick={() => setShowAdd(true)} style={{ width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div onClick={() => onTabChange && onTabChange('album')} style={{ width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </div>
        </div>
      </div>
      <div style={{ padding: '10px 18px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div onClick={goChangePrev} style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(255,255,255,.5)', border: '0.5px solid rgba(100,180,220,.2)' }}>
          <span style={{ fontSize: 13, color: '#3A8AAA', fontWeight: 600 }}>‹</span>
        </div>
        <div onClick={() => setShowCal(!showCal)} style={{
          flex: 1, background: 'rgba(255,255,255,.5)', border: '0.5px solid rgba(100,180,220,.2)',
          borderRadius: 99, padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer',
        }}>
          <span style={{ fontSize: 11, color: '#2A6A8A', fontWeight: 500 }}>{changeDateLabel}</span>
        </div>
        <div onClick={goChangeNext} style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isChangeToday ? 'default' : 'pointer', background: 'rgba(255,255,255,.5)', border: '0.5px solid rgba(100,180,220,.2)', opacity: isChangeToday ? 0.3 : 1 }}>
          <span style={{ fontSize: 13, color: '#3A8AAA', fontWeight: 600 }}>›</span>
        </div>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,.5)', borderRadius: 99, border: '0.5px solid rgba(100,180,220,.2)', overflow: 'hidden', flexShrink: 0 }}>
          {['기록', '흐름'].map(m => (
            <div key={m} onClick={() => setChangeViewMode(m)} style={{
              padding: '6px 10px', fontSize: 10, fontWeight: changeViewMode === m ? 600 : 400, cursor: 'pointer',
              background: changeViewMode === m ? 'rgba(100,180,220,.15)' : 'transparent',
              color: changeViewMode === m ? '#2A6A8A' : '#7AAABB',
            }}>{m}</div>
          ))}
        </div>
      </div>
      {/* Inline Calendar */}
      {showCal && (() => {
        const firstDay = new Date(calYear, calMonth, 1).getDay();
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const cells = [];
        for (let i = 0; i < firstDay; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        return (
          <div style={{ background: 'rgba(255,255,255,.95)', borderRadius: 16, margin: '8px 14px', padding: '12px 14px', border: '0.5px solid rgba(100,180,220,.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div onClick={() => { if (calMonth === 0) { setCalYear(calYear - 1); setCalMonth(11); } else setCalMonth(calMonth - 1); }} style={{ cursor: 'pointer', padding: '2px 8px', fontSize: 14, color: '#5A9AAA' }}>‹</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#2A6A8A' }}>{calYear}년 {calMonth + 1}월</span>
              <div onClick={() => { if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0); } else setCalMonth(calMonth + 1); }} style={{ cursor: 'pointer', padding: '2px 8px', fontSize: 14, color: '#5A9AAA' }}>›</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: 4 }}>
              {['일','월','화','수','목','금','토'].map(d => <div key={d} style={{ fontSize: 9, color: '#9ABBC8', padding: '2px 0' }}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', gap: '2px 0' }}>
              {cells.map((day, i) => {
                if (!day) return <div key={`e${i}`} />;
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isFuture = dateStr > todayKey;
                const isSelected = dateStr === selectedDate;
                const isTodayDate = dateStr === todayKey;
                return (
                  <div key={day} onClick={() => { if (isFuture) return; setSelectedDate(dateStr); setShowCal(false); }}
                    style={{
                      width: 22, height: 22, borderRadius: '50%', margin: '0 auto',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, cursor: isFuture ? 'default' : 'pointer',
                      background: isTodayDate ? '#3A8AAA' : isSelected ? 'rgba(100,180,220,.2)' : 'transparent',
                      color: isFuture ? 'rgba(90,150,170,.3)' : isTodayDate ? '#fff' : isSelected ? '#2A6A8A' : '#5A9AAA',
                      fontWeight: isSelected ? 500 : 400,
                    }}>{day}</div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Category Tabs */}
      {(() => {
        const allTabs = [{ key: 'all', label: '전체' }, ...enabledCats];
        const idx = allTabs.findIndex(t => t.key === insightTab);
        const pos = idx === 0 ? 'first' : idx === allTabs.length - 1 ? 'last' : 'mid';
        return (
          <div style={{ padding: '12px 10px 0' }}>
            <div className="segment-control" data-active={pos}>
              {allTabs.map(cat => (
                <button key={cat.key} className={`segment-btn${insightTab === cat.key ? ' active' : ''}`}
                  onClick={() => setInsightTab(cat.key)}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {cat.key !== 'all' && cat.color && (
                      <span style={{ width: 8, height: 8, borderRadius: 3, background: cat.color, flexShrink: 0 }} />
                    )}
                    {cat.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}
      <div className="tab-content-panel" data-active={
        (() => {
          const allTabs = [{ key: 'all', label: '전체' }, ...enabledCats];
          const idx = allTabs.findIndex(t => t.key === insightTab);
          return idx === 0 ? 'first' : idx === allTabs.length - 1 ? 'last' : 'mid';
        })()
      }>

      {/* ===== 전체 탭 ===== */}
      {insightTab === 'all' && (
        <div style={{ padding: '0 14px' }}>
          {/* Summary Bar */}
          <div style={{
            background: 'transparent', borderRadius: 14, padding: '10px 13px',
            border: 'none', marginBottom: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            ...fadeUp(0.03),
          }}>
            {[
              { icon: '⚡', value: latestCondition?.energy ? `${latestCondition.energy}단계` : '—', label: '에너지' },
              { icon: '😊', value: latestCondition?.mood ? `${latestCondition.mood}단계` : '—', label: '기분' },
              { icon: '⚖️', value: v2LatestWeight ? `${v2LatestWeight}kg` : '—', label: '몸무게' },
            ].map((item, idx) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {idx > 0 && <div style={{ width: 0.5, height: 28, background: 'rgba(100,180,220,.2)', marginRight: 0 }} />}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 60 }}>
                  <span style={{ fontSize: 14 }}>{item.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#1A3A4A', marginTop: 1 }}>{item.value}</span>
                  <span style={{ fontSize: 9, color: '#7AAABB' }}>{item.label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ===== 기록 모드: 전체 체크 카드 인라인 ===== */}
          {changeViewMode === '기록' && <>
            {enabledCats.map((cat, ci) => {
              const delay = 0.05 + ci * 0.03;
              if (cat.key === 'energy') return (
                <div key="energy" style={{ ...v2CardStyle, ...fadeUp(delay) }}>
                  {[
                    { subKey: 'vitality', label: '활력', labels: ['매우 낮음','낮음','약간 낮음','조금 부족','보통','괜찮음','좋음','활발','높음','최고'], min: 1, max: 10, rgb: [245,200,112], value: energySub?.vitality ?? null },
                    { subKey: 'focus', label: '집중력', labels: ['매우 낮음','낮음','약간 낮음','조금 부족','보통','괜찮음','좋음','집중됨','높음','최고'], min: 1, max: 10, rgb: [245,200,112], value: energySub?.focus ?? null },
                  ].map((s, si) => {
                    const val = s.value ?? 7;
                    const pct = ((val - s.min) / (s.max - s.min)) * 100;
                    const trackH = 9;
                    const color = getCategoryColor('energy');
                    const handleTouch = (e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
                      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
                      const v = Math.round((x / rect.width) * (s.max - s.min)) + s.min;
                      handleEnergySub(s.subKey, Math.max(s.min, Math.min(s.max, v)));
                    };
                    return (
                      <div key={s.subKey} style={{ marginBottom: si === 0 ? 18 : 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 3, height: 14, borderRadius: 2, background: color }} />
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>{s.label}</span>
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 600, color }}>{s.value ? s.labels[s.value - s.min] : '—'}</span>
                        </div>
                        <div
                          onTouchStart={handleTouch} onTouchMove={handleTouch} onClick={handleTouch}
                          style={{ position: 'relative', width: '100%', height: trackH, borderRadius: trackH / 2, background: 'rgba(0,0,0,0.06)', cursor: 'pointer', touchAction: 'none' }}
                        >
                          <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.max(pct, 5)}%`, borderRadius: trackH / 2, background: `linear-gradient(90deg, rgba(255,255,255,0.3), ${color}40)`, transition: 'none' }} />
                          <div style={{ position: 'absolute', top: '50%', left: `${Math.max(pct, 2)}%`, transform: 'translate(-50%, -50%)', width: 20, height: 20, borderRadius: '50%', background: `rgb(${Math.round(255+(s.rgb[0]-255)*pct/100)},${Math.round(255+(s.rgb[1]-255)*pct/100)},${Math.round(255+(s.rgb[2]-255)*pct/100)})`, border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', transition: 'none', pointerEvents: 'none' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
              if (cat.key === 'mood') return (() => {
                const EMOTIONS = [
                  { key: '평온', icon: '😌' }, { key: '행복', icon: '😊' }, { key: '우울', icon: '😔' }, { key: '짜증', icon: '😤' },
                  { key: '불안', icon: '😰' }, { key: '피곤', icon: '🥱' }, { key: '설렘', icon: '🥰' }, { key: '무감각', icon: '😶' },
                ];
                const selectedEmotions = moodSub?.emotions || [];
                const stressVal = moodSub?.stress ?? null;
                const stressLabels = ['매우 낮음','낮음','약간 낮음','조금 있음','보통','약간 높음','높음','꽤 높음','매우 높음','극심'];
                const sVal = stressVal ?? 7;
                const sPct = ((sVal - 1) / 9) * 100;
                const sColor = getCategoryColor('mood');
                const sRgb = [240,160,112];
                const trackH = 9;
                const handleStressTouch = (e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
                  const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
                  const v = Math.round((x / rect.width) * 9) + 1;
                  handleMoodStress(Math.max(1, Math.min(10, v)));
                };
                return (
                  <div key="mood" style={{ ...v2CardStyle, ...fadeUp(delay) }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 3, height: 14, borderRadius: 2, background: sColor }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>감정</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {EMOTIONS.map(em => {
                        const sel = selectedEmotions.includes(em.key);
                        return (
                          <div key={em.key} onClick={() => handleMoodEmotion(em.key)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              padding: '8px 14px', borderRadius: 99, cursor: 'pointer',
                              background: sel ? 'rgba(200,230,210,.4)' : 'rgba(255,255,255,.5)',
                              border: sel ? '1.5px solid rgba(100,180,130,.5)' : '1.5px solid rgba(200,220,230,.3)',
                              transition: 'all 0.15s ease',
                            }}>
                            <span style={{ fontSize: 15 }}>{em.icon}</span>
                            <span style={{ fontSize: 12, color: sel ? '#2A6A4A' : '#7AAABB', fontWeight: sel ? 600 : 400 }}>{em.key}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ marginTop: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 3, height: 14, borderRadius: 2, background: sColor }} />
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>스트레스</span>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: sColor }}>{stressVal != null ? stressLabels[stressVal - 1] : '—'}</span>
                      </div>
                      <div
                        onTouchStart={handleStressTouch} onTouchMove={handleStressTouch} onClick={handleStressTouch}
                        style={{ position: 'relative', width: '100%', height: trackH, borderRadius: trackH / 2, background: 'rgba(0,0,0,0.06)', cursor: 'pointer', touchAction: 'none' }}
                      >
                        <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.max(sPct, 5)}%`, borderRadius: trackH / 2, background: `linear-gradient(90deg, rgba(255,255,255,0.3), ${sColor}40)`, transition: 'none' }} />
                        <div style={{ position: 'absolute', top: '50%', left: `${Math.max(sPct, 2)}%`, transform: 'translate(-50%, -50%)', width: 20, height: 20, borderRadius: '50%', background: `rgb(${Math.round(255+(sRgb[0]-255)*sPct/100)},${Math.round(255+(sRgb[1]-255)*sPct/100)},${Math.round(255+(sRgb[2]-255)*sPct/100)})`, border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', transition: 'none', pointerEvents: 'none' }} />
                      </div>
                    </div>
                  </div>
                );
              })();
              if (cat.key === 'skin') return (() => {
                const SKIN_TAGS = [
                  { key: '촉촉', icon: '💧' }, { key: '건조', icon: '🏜' }, { key: '맑음', icon: '✨' }, { key: '트러블', icon: '🔴' },
                  { key: '칙칙', icon: '🟡' }, { key: '탄력', icon: '🌊' }, { key: '번들', icon: '🌊' }, { key: '예민', icon: '😤' },
                ];
                const selectedTags = skinSub?.tags || [];
                return (
                  <div key="skin" style={{ ...v2CardStyle, ...fadeUp(delay) }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 3, height: 14, borderRadius: 2, background: getCategoryColor('skin') }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>피부 상태</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {SKIN_TAGS.map(tag => {
                        const sel = selectedTags.includes(tag.key);
                        return (
                          <div key={tag.key} onClick={() => handleSkinTag(tag.key)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              padding: '8px 14px', borderRadius: 99, cursor: 'pointer',
                              background: sel ? 'rgba(200,230,210,.4)' : 'rgba(255,255,255,.5)',
                              border: sel ? '1.5px solid rgba(100,180,130,.5)' : '1.5px solid rgba(200,220,230,.3)',
                              transition: 'all 0.15s ease',
                            }}>
                            <span style={{ fontSize: 14 }}>{tag.icon}</span>
                            <span style={{ fontSize: 12, color: sel ? '#2A6A4A' : '#7AAABB', fontWeight: sel ? 600 : 400 }}>{tag.key}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })();
              if (cat.key === 'body') return (
                <div key="body" onClick={() => setInsightTab('body')} style={{ ...v2CardStyle, cursor: 'pointer', ...fadeUp(delay) }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 3, height: 14, borderRadius: 2, background: getCategoryColor('body') }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>바디</span>
                    </div>
                    <span style={{ fontSize: 12, color: v2LatestWeight ? '#2A6A4A' : '#9ABBC8', fontWeight: 500 }}>
                      {v2LatestWeight ? `${v2LatestWeight}kg` : '기록하기'}
                      {bloodSugar?.value ? ` · 혈당 ${bloodSugar.value}` : ''}
                      {!v2LatestWeight && ' ›'}
                    </span>
                  </div>
                </div>
              );
              return null;
            })}
          </>}

          {/* ===== 흐름 모드 ===== */}
          {changeViewMode === '흐름' && (() => {
            const DAY_NAMES = ['일','월','화','수','목','금','토'];
            const days7 = [];
            for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days7.push(getDateKey(d)); }
            const dayLabels = days7.map((dk, i) => i === 6 ? '오늘' : DAY_NAMES[new Date(dk + 'T00:00:00').getDay()]);

            // Energy sub data per day
            const energySubAll = getEnergySubChecks();
            const vitalityByDay = days7.map(dk => { const e = energySubAll.find(c => c.date === dk); return e?.vitality ?? null; });
            const focusByDay = days7.map(dk => { const e = energySubAll.find(c => c.date === dk); return e?.focus ?? null; });
            const validVit = vitalityByDay.filter(v => v != null);
            const avgVit = validVit.length > 0 ? (validVit.reduce((a, b) => a + b, 0) / validVit.length).toFixed(1) : '—';

            // Mood sub data per day
            const moodSubAll = getMoodSubChecks();
            const moodByDay = days7.map(dk => { const m = moodSubAll.find(c => c.date === dk); return m?.emotions?.length > 0 ? conditionChecks.filter(c => c.timestamp.slice(0, 10) === dk && c.mood != null).map(c => c.mood).pop() ?? 3 : null; });
            const stressByDay = days7.map(dk => { const m = moodSubAll.find(c => c.date === dk); return m?.stress ?? null; });
            const validMood = conditionChecks.filter(c => c.mood != null && days7.includes(c.timestamp.slice(0, 10)));
            const avgMood = validMood.length > 0 ? (validMood.reduce((a, b) => a + b.mood, 0) / validMood.length).toFixed(1) : '—';

            // Emotion frequency
            const emotionFreq = {};
            const EMOTION_ICONS = { '평온': '😌', '행복': '😊', '우울': '😔', '짜증': '😤', '불안': '😰', '피곤': '🥱', '설렘': '🥰', '무감각': '😶' };
            moodSubAll.filter(m => days7.includes(m.date)).forEach(m => {
              (m.emotions || []).forEach(e => { emotionFreq[e] = (emotionFreq[e] || 0) + 1; });
            });
            const topEmotions = Object.entries(emotionFreq).sort((a, b) => b[1] - a[1]).slice(0, 4);

            // Skin sub data
            const skinSubAll = getSkinSubChecks();
            const skinScoreByDay = days7.map(dk => { const s = skinSubAll.find(c => c.date === dk); return s?.score ?? null; });
            const validSkinScore = skinScoreByDay.filter(v => v != null);
            const avgSkinScore = validSkinScore.length > 0 ? Math.round(validSkinScore.reduce((a, b) => a + b, 0) / validSkinScore.length) : null;
            const latestSkinScore = validSkinScore.length > 0 ? validSkinScore[validSkinScore.length - 1] : null;
            const skinScoreDiff = validSkinScore.length >= 2 ? validSkinScore[validSkinScore.length - 1] - Math.round(validSkinScore.slice(0, -1).reduce((a, b) => a + b, 0) / (validSkinScore.length - 1)) : null;
            const skinTagFreq = {};
            const SKIN_TAG_ICONS = { '촉촉': '💧', '건조': '🏜', '맑음': '✨', '트러블': '🔴', '칙칙': '🟡', '탄력': '🌊', '번들': '🌊', '예민': '😤' };
            skinSubAll.filter(s => days7.includes(s.date)).forEach(s => {
              (s.tags || []).forEach(t => { skinTagFreq[t] = (skinTagFreq[t] || 0) + 1; });
            });
            const topSkinTags = Object.entries(skinTagFreq).sort((a, b) => b[1] - a[1]).slice(0, 4);

            // Blood sugar graph data
            const bsGraph = (() => { try { return JSON.parse(localStorage.getItem('nou_bs_graph') || 'null'); } catch { return null; } })();

            // Eye body history
            const eyeBodyAll = getEyeBodyChecks().slice(-4);

            // Dual line chart helper
            const DualLineChart = ({ data1, data2, color1, color2, label1, label2, dashed2 = true, yMin = 1, yMax = 5 }) => {
              const chartH = 100, padL = 20, padR = 8, padT = 10, padB = 4;
              const innerW = 300 - padL - padR, innerH = chartH - padT - padB;
              const range = yMax - yMin || 1;
              const mkPts = (data) => data.map((v, i) => v != null ? { x: padL + (i / 6) * innerW, y: padT + innerH - ((v - yMin) / range) * innerH } : null);
              const pts1 = mkPts(data1), pts2 = mkPts(data2);
              const validPts = (pts) => pts.filter(Boolean);
              return (
                <div>
                  <svg viewBox={`0 0 300 ${chartH + 24}`} style={{ width: '100%' }}>
                    {[1, 2, 3, 4, 5].filter(v => v >= yMin && v <= yMax).map(v => {
                      const y = padT + innerH - ((v - yMin) / range) * innerH;
                      return <g key={v}><line x1={padL} y1={y} x2={300 - padR} y2={y} stroke="rgba(200,220,230,.2)" strokeWidth="0.5" /><text x={padL - 4} y={y + 3} textAnchor="end" fontSize="8" fill="#B0C8C0">{v}</text></g>;
                    })}
                    {validPts(pts1).length >= 2 && <polyline points={validPts(pts1).map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color1} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
                    {validPts(pts2).length >= 2 && <polyline points={validPts(pts2).map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color2} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={dashed2 ? '5 3' : 'none'} />}
                    {validPts(pts1).map((p, i) => <circle key={`a${i}`} cx={p.x} cy={p.y} r={i === validPts(pts1).length - 1 ? 4 : 2} fill={i === validPts(pts1).length - 1 ? color1 : '#fff'} stroke={color1} strokeWidth="1.5" />)}
                    {validPts(pts2).map((p, i) => <circle key={`b${i}`} cx={p.x} cy={p.y} r={i === validPts(pts2).length - 1 ? 3.5 : 2} fill={i === validPts(pts2).length - 1 ? color2 : '#fff'} stroke={color2} strokeWidth="1.5" />)}
                    {dayLabels.map((l, i) => <text key={i} x={padL + (i / 6) * innerW} y={chartH + 14} textAnchor="middle" fontSize="9" fill="#7AAABB">{l}</text>)}
                  </svg>
                  <div style={{ display: 'flex', gap: 14, paddingLeft: padL, marginTop: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 14, height: 2, background: color1, borderRadius: 1 }} /><span style={{ fontSize: 10, color: '#7AAABB' }}>{label1}</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 14, height: 2, background: color2, borderRadius: 1, borderTop: dashed2 ? 'none' : undefined }} /><span style={{ fontSize: 10, color: '#7AAABB' }}>{label2}</span></div>
                  </div>
                </div>
              );
            };

            const CorrelationBar = ({ label, level, color }) => {
              const pct = level === '높음' ? 85 : level === '중간' ? 55 : 25;
              const levelColor = level === '높음' ? '#3A7A5A' : level === '중간' ? '#8A7A00' : '#9ABBC8';
              return (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1A3A4A' }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: levelColor }}>상관도 {level}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'rgba(200,220,230,.2)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: color, width: `${pct}%`, transition: 'width 0.3s' }} />
                  </div>
                </div>
              );
            };

            const showAll = insightTab === 'all';
            const showEnergy = showAll || insightTab === 'energy';
            const showMood = showAll || insightTab === 'mood';
            const showBody = showAll || insightTab === 'body' || insightTab === 'shape';
            const showSkin = showAll || insightTab === 'skin';

            return <>
            {/* 이번 주 요약 */}
            {showAll && <div style={{ ...v2CardStyle, ...fadeUp(0.05) }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A', marginBottom: 10 }}>이번 주 요약</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', background: 'rgba(255,255,255,.5)', borderRadius: 12 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#1A3A4A' }}>⚡ {avgVit}</div>
                  <div style={{ fontSize: 10, color: '#7AAABB', marginTop: 2 }}>평균 활력</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', background: 'rgba(255,255,255,.5)', borderRadius: 12 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#1A3A4A' }}>😊 {avgMood}</div>
                  <div style={{ fontSize: 10, color: '#7AAABB', marginTop: 2 }}>평균 기분</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', background: 'rgba(255,255,255,.5)', borderRadius: 12 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: v2WeightDiff < 0 ? '#4A9A7A' : v2WeightDiff > 0 ? '#C4580A' : '#1A3A4A' }}>{v2WeightDiff !== 0 ? `${v2WeightDiff > 0 ? '+' : ''}${v2WeightDiff}kg` : '—'}</div>
                  <div style={{ fontSize: 10, color: '#7AAABB', marginTop: 2 }}>체중 변화</div>
                </div>
              </div>
            </div>}

            {/* 발견한 패턴 */}
            {showAll && <div style={{ ...v2CardStyle, ...fadeUp(0.08) }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>발견한 패턴</span>
                <span style={{ fontSize: 9, color: '#80C0E8', fontWeight: 500 }}>● LIVE</span>
              </div>
              {DEMO_PATTERNS.map((p, idx) => (
                <div key={idx} style={{ padding: '8px 0', borderTop: idx > 0 ? '0.5px solid rgba(100,180,220,.12)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(255,210,80,.15)', color: '#8A6000' }}>{p.cause}</span>
                    <span style={{ fontSize: 10, color: '#AAC8D8' }}>→</span>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(100,180,220,.12)', color: '#2A6A8A' }}>{p.effect}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#5A8AAA', lineHeight: 1.5 }}>{p.desc}</div>
                </div>
              ))}
            </div>}

            {/* 컨디션 흐름 카드 */}
            {showAll && (() => {
              const allChecks = getConditionChecks();
              const byDate = {};
              allChecks.forEach(c => { const d = c.timestamp.slice(0, 10); if (!byDate[d]) byDate[d] = []; byDate[d].push(c); });
              const dates = Object.keys(byDate).sort().reverse().slice(0, 14);
              const chartDates = [...dates].reverse();
              const dailyAvg = chartDates.map(d => {
                const checks = byDate[d];
                return { date: d, mood: Math.round(checks.reduce((s, c) => s + (c.mood || 0), 0) / checks.length * 10) / 10, energy: Math.round(checks.reduce((s, c) => s + (c.energy || 0), 0) / checks.length * 10) / 10 };
              });
              const makePath = (pts) => { if (pts.length < 2) return ''; let d = `M${pts[0].x} ${pts[0].y}`; for (let i = 1; i < pts.length; i++) { const cp = (pts[i].x + pts[i-1].x)/2; d += ` C${cp} ${pts[i-1].y} ${cp} ${pts[i].y} ${pts[i].x} ${pts[i].y}`; } return d; };
              return (
                <div onClick={() => setShowConditionHistory(true)} style={{ ...v2CardStyle, cursor: 'pointer', ...fadeUp(0.1) }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>컨디션 흐름</span>
                    <span style={{ fontSize: 11, color: '#7AAABB' }}>탭하여 상세보기 ›</span>
                  </div>
                  <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
                    {[{ c: getCategoryColor('mood'), l: '기분' }, { c: getCategoryColor('energy'), l: '에너지' }].map(x => (
                      <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 12, height: 2, borderRadius: 1, background: x.c }} /><span style={{ fontSize: 10, color: '#7AAABB' }}>{x.l}</span>
                      </div>
                    ))}
                  </div>
                  {dailyAvg.length >= 2 ? (() => {
                    const svgW = Math.max(dailyAvg.length * 40, 220), H = 60, pad = 16;
                    const toY = (val) => Math.round(H - (val / 10) * (H - 12) - 6);
                    const moodPts = dailyAvg.map((d, i) => ({ x: (i / (dailyAvg.length - 1)) * (svgW - pad * 2) + pad, y: toY(d.mood) }));
                    const energyPts = dailyAvg.map((d, i) => ({ x: (i / (dailyAvg.length - 1)) * (svgW - pad * 2) + pad, y: toY(d.energy) }));
                    return <>
                      <svg width="100%" height={H} viewBox={`0 0 ${svgW} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', overflow: 'visible' }}>
                        <path d={makePath(moodPts)} fill="none" stroke={getCategoryColor('mood')} strokeWidth="2" strokeLinecap="round" />
                        <path d={makePath(energyPts)} fill="none" stroke={getCategoryColor('energy')} strokeWidth="2" strokeLinecap="round" strokeDasharray="5 3" />
                        {moodPts.map((p, i) => <circle key={`m${i}`} cx={p.x} cy={p.y} r="3" fill="#fff" stroke={getCategoryColor('mood')} strokeWidth="1.5" />)}
                        {energyPts.map((p, i) => <circle key={`e${i}`} cx={p.x} cy={p.y} r="3" fill="#fff" stroke={getCategoryColor('energy')} strokeWidth="1.5" />)}
                      </svg>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', marginTop: 4 }}>
                        {dailyAvg.filter((_, i) => i === 0 || i === dailyAvg.length - 1 || i === Math.floor(dailyAvg.length / 2)).map((d, i) => (
                          <span key={i} style={{ fontSize: 9, color: '#9ABBC8' }}>{d.date.slice(5)}</span>
                        ))}
                      </div>
                    </>;
                  })() : <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: '#9ABBC8' }}>메인에서 컨디션을 기록하면 흐름이 나타나요</div>}
                </div>
              );
            })()}

            {/* 컨디션 기록 히스토리 모달 */}
            {showConditionHistory && (() => {
              const allChecks = getConditionChecks();
              const byDate = {};
              allChecks.forEach(c => { const d = c.timestamp.slice(0, 10); if (!byDate[d]) byDate[d] = []; byDate[d].push(c); });
              const dates = Object.keys(byDate).sort().reverse().slice(0, 30);
              return (
                <div onClick={() => setShowConditionHistory(false)} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '20px 20px 40px', width: '100%', maxWidth: 420, maxHeight: '75vh', overflowY: 'auto' }}>
                    <div style={{ width: 40, height: 4, borderRadius: 2, background: '#D0D0D0', margin: '0 auto 16px' }} />
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#1A3A4A', marginBottom: 16 }}>기록 히스토리</div>
                    {dates.length > 0 ? dates.map(date => {
                      const checks = byDate[date];
                      const latest = checks[checks.length - 1];
                      const d = new Date(date + 'T00:00:00');
                      return (
                        <div key={date} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '0.5px solid rgba(200,220,230,.3)' }}>
                          <div style={{ minWidth: 40, fontSize: 12, fontWeight: 600, color: '#5AAABB' }}>{d.getMonth() + 1}/{d.getDate()}</div>
                          <div style={{ display: 'flex', gap: 10, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <div style={{ width: 6, height: 6, borderRadius: 3, background: getCategoryColor('mood') }} />
                              <span style={{ fontSize: 12, color: '#1A3A4A' }}>{latest.mood || '—'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <div style={{ width: 6, height: 6, borderRadius: 3, background: getCategoryColor('energy') }} />
                              <span style={{ fontSize: 12, color: '#1A3A4A' }}>{latest.energy || '—'}</span>
                            </div>
                          </div>
                          <span style={{ fontSize: 10, color: '#9ABBC8' }}>{checks.length}회</span>
                        </div>
                      );
                    }) : <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: '#9ABBC8' }}>기록이 없어요</div>}
                  </div>
                </div>
              );
            })()}

            {/* 에너지 카드 */}
            {showEnergy && <div style={{ ...v2CardStyle, ...fadeUp(0.12) }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 3, background: getCategoryColor('energy') }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>에너지</span>
                </div>
                <span style={{ fontSize: 11, color: '#7AAABB' }}>평균 {avgVit} / 5</span>
              </div>
              <DualLineChart data1={vitalityByDay} data2={focusByDay} color1={getCategoryColor('energy')} color2="#6AA8D0" label1="활력" label2="집중력" />
              <div style={{ marginTop: 12, fontSize: 12, color: '#7AAABB', marginBottom: 6 }}>에너지에 영향 준 요소</div>
              <CorrelationBar label="수면 시간" level="높음" color={getCategoryColor('energy')} />
              <CorrelationBar label="영양제 복용" level="중간" color={getCategoryColor('energy')} />
              <CorrelationBar label="수분 섭취" level="낮음" color={getCategoryColor('energy')} />
            </div>}

            {/* 기분 카드 */}
            {showMood && <div style={{ ...v2CardStyle, ...fadeUp(0.16) }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 3, background: getCategoryColor('mood') }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>기분</span>
                </div>
                <span style={{ fontSize: 11, color: '#7AAABB' }}>평균 {avgMood} / 5</span>
              </div>
              <DualLineChart data1={days7.map((dk, i) => { const c = conditionChecks.filter(c => c.timestamp.slice(0, 10) === dk && c.mood != null); return c.length > 0 ? c[c.length - 1].mood : null; })} data2={stressByDay} color1="#E8A88A" color2="#D4A030" label1="기분" label2="스트레스" />
              {topEmotions.length > 0 && <>
                <div style={{ fontSize: 12, color: '#7AAABB', marginTop: 10, marginBottom: 6 }}>이번 주 자주 느낀 감정</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {topEmotions.map(([emotion, count]) => (
                    <span key={emotion} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 99, background: 'rgba(240,200,180,.2)', border: '1px solid rgba(240,180,150,.3)', color: '#8A5A3A', fontWeight: 500 }}>
                      {EMOTION_ICONS[emotion] || ''} {emotion} {count}회
                    </span>
                  ))}
                </div>
              </>}
            </div>}

            {/* 바디 카드 */}
            {showBody && <div style={{ ...v2CardStyle, ...fadeUp(0.2) }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: 3, background: getCategoryColor('body') }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>바디</span>
              </div>
              {/* 몸무게 */}
              <div style={{ fontSize: 12, color: '#7AAABB', marginBottom: 4 }}>몸무게</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                <div><span style={{ fontSize: 32, fontWeight: 600, color: '#1A3A4A' }}>{v2LatestWeight ?? '—'}</span><span style={{ fontSize: 14, color: '#7AAABB', marginLeft: 2 }}>kg</span></div>
                {v2WeightDiff !== 0 && <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#9ABBC8' }}>이번주</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: v2WeightDiff < 0 ? '#4A9A7A' : '#C4580A' }}>{v2WeightDiff > 0 ? '+' : ''}{v2WeightDiff}kg {v2WeightDiff < 0 ? '↓' : '↑'}</div>
                </div>}
              </div>
              {filteredBody.length >= 2 && <>
                <div style={{ position: 'relative', height: 60, marginBottom: 6 }}>
                  {goal?.target && (() => {
                    const vals = filteredBody.map(r => r.weight);
                    const allVals = [...vals, goal.target];
                    const mn = Math.min(...allVals), mx = Math.max(...allVals);
                    const rng = mx - mn || 1;
                    const goalY = ((mx - goal.target) / rng) * 50 + 5;
                    return <><div style={{ position: 'absolute', top: goalY, left: 0, right: 0, borderTop: '1.5px dashed rgba(150,180,170,.4)' }} /><span style={{ position: 'absolute', top: goalY - 14, right: 0, fontSize: 9, color: '#9ABBC8' }}>목표</span></>;
                  })()}
                  <svg viewBox="0 0 300 60" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
                    {(() => {
                      const vals = filteredBody.map(r => r.weight);
                      const mn = Math.min(...vals, goal?.target || Infinity), mx = Math.max(...vals, goal?.target || 0);
                      const rng = mx - mn || 1;
                      const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * 290 + 5},${((mx - v) / rng) * 50 + 5}`);
                      return <polyline points={pts.join(' ')} fill="none" stroke={getCategoryColor('body')} strokeWidth="2.5" strokeLinejoin="round" />;
                    })()}
                  </svg>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ABBC8', marginBottom: 10 }}>
                  <span>시작 {v2StartWeight}kg</span>
                  {goal?.target && <span>목표 {goal.target}kg</span>}
                </div>
              </>}

              {/* 눈바디 히스토리 */}
              {eyeBodyAll.length > 0 && <>
                <div style={{ borderTop: '0.5px solid rgba(200,220,230,.3)', paddingTop: 10, marginTop: 6 }}>
                  <div style={{ fontSize: 12, color: '#7AAABB', marginBottom: 8 }}>눈바디 히스토리</div>
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
                    {eyeBodyAll.map(eb => {
                      const d = new Date(eb.date);
                      const label = `${d.getMonth() + 1}월 ${d.getDate()}일`;
                      const photo = eb.photos?.['정면'] || Object.values(eb.photos || {})[0];
                      return (
                        <div key={eb.date} style={{ flex: '0 0 90', textAlign: 'center' }}>
                          <div style={{ width: 90, height: 100, borderRadius: 10, overflow: 'hidden', background: 'rgba(230,240,235,.4)', marginBottom: 4 }}>
                            {photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B0C8C0', fontSize: 11 }}>사진 없음</div>}
                          </div>
                          <div style={{ fontSize: 10, color: '#7AAABB' }}>{label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>}

              {/* 혈당 그래프 */}
              {bsGraph?.readings?.length > 0 && (() => {
                const readings = bsGraph.readings;
                const vals = readings.map(r => r.value);
                const spike = readings.reduce((a, b) => b.value > a.value ? b : a, readings[0]);
                const mn = Math.min(...vals, 70), mx = Math.max(...vals, 140);
                const rng = mx - mn || 1;
                const padL = 5, padR = 5, chartW = 300, chartH = 70;
                const innerW = chartW - padL - padR;
                return (
                  <div style={{ borderTop: '0.5px solid rgba(200,220,230,.3)', paddingTop: 10, marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: '#7AAABB', marginBottom: 8 }}>혈당 사진 업로드로 자동 분석</div>
                    <svg viewBox={`0 0 ${chartW} ${chartH + 20}`} style={{ width: '100%' }}>
                      <rect x={padL} y={chartH - ((140 - mn) / rng) * chartH} width={innerW} height={((140 - 70) / rng) * chartH} fill="rgba(100,180,130,.06)" />
                      <line x1={padL} y1={chartH - ((140 - mn) / rng) * chartH} x2={chartW - padR} y2={chartH - ((140 - mn) / rng) * chartH} stroke="rgba(150,180,170,.3)" strokeWidth="0.8" strokeDasharray="4 2" />
                      <text x={chartW - padR + 2} y={chartH - ((140 - mn) / rng) * chartH + 3} fontSize="8" fill="#9ABBC8">140</text>
                      <line x1={padL} y1={chartH - ((70 - mn) / rng) * chartH} x2={chartW - padR} y2={chartH - ((70 - mn) / rng) * chartH} stroke="rgba(150,180,170,.3)" strokeWidth="0.8" strokeDasharray="4 2" />
                      <text x={chartW - padR + 2} y={chartH - ((70 - mn) / rng) * chartH + 3} fontSize="8" fill="#9ABBC8">70</text>
                      {readings.map((r, i) => {
                        if (i === 0) return null;
                        const prev = readings[i - 1];
                        const x1 = padL + ((i - 1) / (readings.length - 1)) * innerW;
                        const y1 = chartH - ((prev.value - mn) / rng) * chartH;
                        const x2 = padL + (i / (readings.length - 1)) * innerW;
                        const y2 = chartH - ((r.value - mn) / rng) * chartH;
                        const normal = prev.value <= 140 && r.value <= 140;
                        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={normal ? '#4A9A7A' : '#E8944A'} strokeWidth="2" strokeLinecap="round" />;
                      })}
                      {readings.map((r, i) => {
                        const x = padL + (i / (readings.length - 1)) * innerW;
                        const y = chartH - ((r.value - mn) / rng) * chartH;
                        const isSpike = r.value > 140;
                        return <circle key={i} cx={x} cy={y} r={isSpike ? 4 : 2} fill={isSpike ? '#E8944A' : '#4A9A7A'} stroke="#fff" strokeWidth="1" />;
                      })}
                      {spike.value > 140 && (() => {
                        const idx = readings.indexOf(spike);
                        const x = padL + (idx / (readings.length - 1)) * innerW;
                        const y = chartH - ((spike.value - mn) / rng) * chartH;
                        return <text x={x} y={y - 8} textAnchor="middle" fontSize="9" fontWeight="600" fill="#C4700A">{spike.value}</text>;
                      })()}
                      {readings.filter((_, i) => i === 0 || i === Math.floor(readings.length / 3) || i === Math.floor(readings.length * 2 / 3) || i === readings.length - 1).map((r, i) => {
                        const idx = readings.indexOf(r);
                        return <text key={i} x={padL + (idx / (readings.length - 1)) * innerW} y={chartH + 14} textAnchor="middle" fontSize="8" fill="#9ABBC8">{r.time}</text>;
                      })}
                    </svg>
                    {spike.value > 140 && (
                      <div style={{ background: 'rgba(232,148,74,.08)', borderRadius: 10, padding: '10px 12px', marginTop: 4 }}>
                        <div style={{ fontSize: 12, color: '#8A5A2A', lineHeight: 1.6 }}>
                          {spike.time}경 혈당이 {spike.value}로 급상승했어요.
                        </div>
                        <div style={{ fontSize: 12, color: '#8A5A2A', lineHeight: 1.6 }}>이 시간대 식단을 확인해보세요.</div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>}

            {/* 피부 카드 */}
            {showSkin && <div style={{ ...v2CardStyle, ...fadeUp(0.24) }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 3, background: getCategoryColor('skin') }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>피부</span>
                </div>
                <span style={{ fontSize: 11, color: '#7AAABB' }}>평균 {avgSkinScore ?? '—'}점</span>
              </div>
              {latestSkinScore != null && <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                  <div><span style={{ fontSize: 32, fontWeight: 600, color: '#1A3A4A' }}>{latestSkinScore}</span><span style={{ fontSize: 14, color: '#7AAABB' }}>점</span></div>
                  {skinScoreDiff != null && <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: '#9ABBC8' }}>이번주 평균 대비</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: skinScoreDiff >= 0 ? '#4A9A7A' : '#C4580A' }}>{skinScoreDiff > 0 ? '+' : ''}{skinScoreDiff}점 {skinScoreDiff >= 0 ? '↑' : '↓'}</div>
                  </div>}
                </div>
              </>}
              {/* 피부 점수 추이 */}
              {validSkinScore.length >= 2 && (() => {
                const mn = Math.min(...validSkinScore) * 0.9, mx = Math.max(...validSkinScore) * 1.05;
                const rng = mx - mn || 1;
                const pts = skinScoreByDay.map((v, i) => v != null ? { x: 10 + (i / 6) * 280, y: 10 + (1 - (v - mn) / rng) * 60 } : null).filter(Boolean);
                return (
                  <div style={{ marginBottom: 8 }}>
                    <svg viewBox="0 0 300 90" style={{ width: '100%' }}>
                      {pts.length >= 2 && <polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={getCategoryColor('skin')} strokeWidth="2" strokeLinejoin="round" />}
                      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4 : 2} fill={i === pts.length - 1 ? getCategoryColor('skin') : '#fff'} stroke={getCategoryColor('skin')} strokeWidth="1.5" />)}
                      {dayLabels.map((l, i) => <text key={i} x={10 + (i / 6) * 280} y={85} textAnchor="middle" fontSize="9" fill="#7AAABB">{l}</text>)}
                    </svg>
                  </div>
                );
              })()}
              {/* 자주 나타난 피부 상태 */}
              {topSkinTags.length > 0 && <>
                <div style={{ fontSize: 12, color: '#7AAABB', marginTop: 6, marginBottom: 6 }}>이번 주 자주 나타난 피부 상태</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {topSkinTags.map(([tag, count]) => (
                    <span key={tag} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 99, background: 'rgba(216,160,224,.15)', border: '1px solid rgba(216,160,224,.3)', color: '#7A4A8A', fontWeight: 500 }}>
                      {SKIN_TAG_ICONS[tag] || ''} {tag} {count}회
                    </span>
                  ))}
                </div>
              </>}
              {/* 피부 영향 요소 */}
              <div style={{ fontSize: 12, color: '#7AAABB', marginBottom: 6 }}>피부에 영향 준 요소</div>
              <CorrelationBar label="수분 섭취" level="높음" color={getCategoryColor('skin')} />
              <CorrelationBar label="수면 시간" level="중간" color={getCategoryColor('skin')} />
              <CorrelationBar label="스킨케어 루틴" level="중간" color={getCategoryColor('skin')} />

              {/* 얼굴 사진 히스토리 */}
              {filteredSkin.length > 0 && <>
                <div style={{ borderTop: '0.5px solid rgba(200,220,230,.3)', paddingTop: 10, marginTop: 10 }}>
                  <div style={{ fontSize: 12, color: '#7AAABB', marginBottom: 8 }}>얼굴 사진 히스토리</div>
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
                    {filteredSkin.slice(-3).map(r => {
                      const thumb = skinThumbs[String(r.id)] || skinThumbs[r.date];
                      const d = new Date(r.date);
                      return (
                        <div key={r.id || r.date} style={{ flex: '0 0 90', textAlign: 'center' }}>
                          <div style={{ width: 90, height: 100, borderRadius: 10, overflow: 'hidden', background: 'rgba(230,240,235,.4)', marginBottom: 4 }}>
                            {thumb ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B0C8C0', fontSize: 11 }}>사진</div>}
                          </div>
                          <div style={{ fontSize: 10, color: '#7AAABB' }}>{d.getMonth() + 1}월 {d.getDate()}일</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#1A3A4A' }}>{r.overallScore}점</div>
                        </div>
                      );
                    })}
                    <div style={{ flex: '0 0 70', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 20, color: '#B0C8C0' }}>+</span>
                      <span style={{ fontSize: 10, color: '#9ABBC8' }}>추가</span>
                    </div>
                  </div>
                </div>
              </>}
            </div>}
            </>;
          })()}

        </div>
      )}

      {/* Energy Sub Tab */}
      {(insightTab === 'energy') && (
        <div style={{ padding: '0 14px' }}>
          <div style={{ ...v2CardStyle, ...fadeUp(0.05) }}>
            {[
              { subKey: 'vitality', label: '활력', labels: ['매우 낮음','낮음','약간 낮음','조금 부족','보통','괜찮음','좋음','활발','높음','최고'], rgb: [245,200,112], value: energySub?.vitality ?? null },
              { subKey: 'focus', label: '집중력', labels: ['매우 낮음','낮음','약간 낮음','조금 부족','보통','괜찮음','좋음','집중됨','높음','최고'], rgb: [245,200,112], value: energySub?.focus ?? null },
            ].map((s, si) => {
              const val = s.value ?? 7;
              const pct = ((val - 1) / 9) * 100;
              const trackH = 9;
              const color = getCategoryColor('energy');
              const ht = (e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
                const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
                const v = Math.round((x / rect.width) * 9) + 1;
                handleEnergySub(s.subKey, Math.max(1, Math.min(10, v)));
              };
              return (
                <div key={s.subKey} style={{ marginBottom: si === 0 ? 18 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 3, height: 14, borderRadius: 2, background: color }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>{s.label}</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color }}>{s.value ? s.labels[s.value - 1] : '—'}</span>
                  </div>
                  <div onTouchStart={ht} onTouchMove={ht} onClick={ht}
                    style={{ position: 'relative', width: '100%', height: trackH, borderRadius: trackH / 2, background: 'rgba(0,0,0,0.06)', cursor: 'pointer', touchAction: 'none' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.max(pct, 5)}%`, borderRadius: trackH / 2, background: `linear-gradient(90deg, rgba(255,255,255,0.3), ${color}40)`, transition: 'none' }} />
                    <div style={{ position: 'absolute', top: '50%', left: `${Math.max(pct, 2)}%`, transform: 'translate(-50%, -50%)', width: 20, height: 20, borderRadius: '50%', background: `rgb(${Math.round(255+(s.rgb[0]-255)*pct/100)},${Math.round(255+(s.rgb[1]-255)*pct/100)},${Math.round(255+(s.rgb[2]-255)*pct/100)})`, border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', transition: 'none', pointerEvents: 'none' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {(energySub?.vitality || energySub?.focus) && (
            <div style={{ background: 'rgba(200,230,210,.2)', borderRadius: 16, padding: '14px 16px', border: '0.5px solid rgba(100,180,130,.2)', ...fadeUp(0.15) }}>
              <div style={{ fontSize: 11, color: '#7AAABB', marginBottom: 6 }}>오늘 에너지 요약</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A', lineHeight: 1.6 }}>
                {energySub.vitality && `활력 ${['','매우 낮음','낮음','약간 낮음','조금 부족','보통','괜찮음','좋음','활발','높음','최고'][energySub.vitality]}`}
                {energySub.vitality && energySub.focus && ' · '}
                {energySub.focus && `집중력 ${['','매우 낮음','낮음','약간 낮음','조금 부족','보통','괜찮음','좋음','집중됨','높음','최고'][energySub.focus]}`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mood Tab */}
      {(insightTab === 'mood') && (() => {
        const EMOTIONS = [
          { key: '평온', icon: '😌' }, { key: '행복', icon: '😊' }, { key: '우울', icon: '😔' }, { key: '짜증', icon: '😤' },
          { key: '불안', icon: '😰' }, { key: '피곤', icon: '🥱' }, { key: '설렘', icon: '🥰' }, { key: '무감각', icon: '😶' },
        ];
        const STRESS_ICONS = ['😌', '😐', '😤', '😣', '😫', '🤯'];
        const selectedEmotions = moodSub?.emotions || [];
        const stressVal = moodSub?.stress ?? null;
        return (
          <div style={{ padding: '0 14px' }}>
            {/* 감정 카드 */}
            <div style={{ ...v2CardStyle, ...fadeUp(0.05) }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 3, height: 14, borderRadius: 2, background: getCategoryColor('mood') }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>감정</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {EMOTIONS.map(em => {
                  const sel = selectedEmotions.includes(em.key);
                  return (
                    <div key={em.key} onClick={() => handleMoodEmotion(em.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '8px 14px', borderRadius: 99, cursor: 'pointer',
                        background: sel ? 'rgba(200,230,210,.4)' : 'rgba(255,255,255,.5)',
                        border: sel ? '1.5px solid rgba(100,180,130,.5)' : '1.5px solid rgba(200,220,230,.3)',
                        transition: 'all 0.15s ease',
                      }}>
                      <span style={{ fontSize: 15 }}>{em.icon}</span>
                      <span style={{ fontSize: 12, color: sel ? '#2A6A4A' : '#7AAABB', fontWeight: sel ? 600 : 400 }}>{em.key}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 스트레스 카드 (슬라이더) */}
            {(() => {
              const sLabels = ['매우 낮음','낮음','약간 낮음','조금 있음','보통','약간 높음','높음','꽤 높음','매우 높음','극심'];
              const sVal = stressVal ?? 7;
              const sPct = ((sVal - 1) / 9) * 100;
              const sColor = getCategoryColor('mood');
              const sRgb = [240,160,112];
              const trackH = 9;
              const ht = (e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
                const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
                const v = Math.round((x / rect.width) * 9) + 1;
                handleMoodStress(Math.max(1, Math.min(10, v)));
              };
              return (
                <div style={{ ...v2CardStyle, ...fadeUp(0.1) }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 3, height: 14, borderRadius: 2, background: sColor }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>스트레스</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: sColor }}>{stressVal != null ? sLabels[stressVal - 1] : '—'}</span>
                  </div>
                  <div onTouchStart={ht} onTouchMove={ht} onClick={ht}
                    style={{ position: 'relative', width: '100%', height: trackH, borderRadius: trackH / 2, background: 'rgba(0,0,0,0.06)', cursor: 'pointer', touchAction: 'none' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.max(sPct, 5)}%`, borderRadius: trackH / 2, background: `linear-gradient(90deg, rgba(255,255,255,0.3), ${sColor}40)`, transition: 'none' }} />
                    <div style={{ position: 'absolute', top: '50%', left: `${Math.max(sPct, 2)}%`, transform: 'translate(-50%, -50%)', width: 20, height: 20, borderRadius: '50%', background: `rgb(${Math.round(255+(sRgb[0]-255)*sPct/100)},${Math.round(255+(sRgb[1]-255)*sPct/100)},${Math.round(255+(sRgb[2]-255)*sPct/100)})`, border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', transition: 'none', pointerEvents: 'none' }} />
                  </div>
                </div>
              );
            })()}

            {/* 오늘 기분 요약 */}
            {(selectedEmotions.length > 0 || stressVal != null) && (
              <div style={{
                background: 'rgba(200,230,210,.2)', borderRadius: 16, padding: '14px 16px',
                border: '0.5px solid rgba(100,180,130,.2)', ...fadeUp(0.15),
              }}>
                <div style={{ fontSize: 11, color: '#7AAABB', marginBottom: 6 }}>오늘 기분 요약</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A', lineHeight: 1.6 }}>
                  {selectedEmotions.length > 0 && selectedEmotions.join(' · ')}
                  {selectedEmotions.length > 0 && stressVal != null && ' · '}
                  {stressVal != null && `스트레스 ${['','매우 낮음','낮음','약간 낮음','조금 있음','보통','약간 높음','높음','꽤 높음','매우 높음','극심'][stressVal]}`}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Body shape placeholder */}
      {(insightTab === 'shape') && (
        <div style={{ padding: '80px 24px', textAlign: 'center', ...fadeUp(0.05) }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💪</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>바디 분석</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>곧 출시 예정이에요</div>
        </div>
      )}

      {/* Skin Tab */}
      {(insightTab === 'skin') && (() => {
        const SKIN_TAGS = [
          { key: '촉촉', icon: '💧' }, { key: '건조', icon: '🏜' }, { key: '맑음', icon: '✨' }, { key: '트러블', icon: '🔴' },
          { key: '칙칙', icon: '🟡' }, { key: '탄력', icon: '🌊' }, { key: '번들', icon: '🌊' }, { key: '예민', icon: '😤' },
        ];
        const selectedTags = skinSub?.tags || [];
        const skinScore = skinSub?.score ?? null;
        const skinPhotos = skinSub?.photos || {};
        const prevSkin = skinRecords.length >= 2 ? skinRecords[skinRecords.length - 2]?.overallScore : null;
        const scoreDiff = skinScore && prevSkin ? skinScore - prevSkin : null;

        const PhotoSlot = ({ slotKey, label, height = 130, flex = 1 }) => (
          <label style={{
            flex, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height, borderRadius: 14, cursor: 'pointer', overflow: 'hidden',
            background: skinPhotos[slotKey] ? 'none' : 'rgba(230,240,235,.4)',
            border: '1.5px dashed rgba(180,210,200,.5)',
          }}>
            {skinPhotos[slotKey] ? (
              <img src={skinPhotos[slotKey]} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <>
                <span style={{ fontSize: 20, color: '#B0C8C0' }}>+</span>
                <span style={{ fontSize: 11, color: '#9ABBC8', marginTop: 4 }}>{label}</span>
              </>
            )}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = ev => {
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement('canvas');
                  canvas.width = 300; canvas.height = 300;
                  const ctx = canvas.getContext('2d');
                  const size = Math.min(img.width, img.height);
                  const sx = (img.width - size) / 2, sy = (img.height - size) / 2;
                  ctx.drawImage(img, sx, sy, size, size, 0, 0, 300, 300);
                  handleSkinPhoto(slotKey, canvas.toDataURL('image/jpeg', 0.7));
                };
                img.src = ev.target.result;
              };
              reader.readAsDataURL(file);
            }} />
          </label>
        );

        return (
          <div style={{ padding: '0 14px' }}>
            {/* 얼굴 사진 카드 */}
            <div style={{ ...v2CardStyle, ...fadeUp(0.05) }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 3, height: 14, borderRadius: 2, background: getCategoryColor('skin') }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>얼굴 사진</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <PhotoSlot slotKey="face" label="오늘 얼굴 사진" height={130} flex={2} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <PhotoSlot slotKey="forehead" label="이마" height={60} />
                  <PhotoSlot slotKey="cheek" label="볼" height={60} />
                </div>
              </div>
            </div>

            {/* 오늘 피부 상태 카드 */}
            <div style={{ ...v2CardStyle, ...fadeUp(0.1) }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 3, height: 14, borderRadius: 2, background: getCategoryColor('skin') }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>오늘 피부 상태</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {SKIN_TAGS.map(tag => {
                  const sel = selectedTags.includes(tag.key);
                  return (
                    <div key={tag.key} onClick={() => handleSkinTag(tag.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '8px 14px', borderRadius: 99, cursor: 'pointer',
                        background: sel ? 'rgba(200,230,210,.4)' : 'rgba(255,255,255,.5)',
                        border: sel ? '1.5px solid rgba(100,180,130,.5)' : '1.5px solid rgba(200,220,230,.3)',
                        transition: 'all 0.15s ease',
                      }}>
                      <span style={{ fontSize: 14 }}>{tag.icon}</span>
                      <span style={{ fontSize: 12, color: sel ? '#2A6A4A' : '#7AAABB', fontWeight: sel ? 600 : 400 }}>{tag.key}</span>
                    </div>
                  );
                })}
              </div>
              {/* 피부 점수 */}
              <div style={{ fontSize: 11, color: '#9ABBC8', marginBottom: 6 }}>오늘 피부 점수</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input value={skinScore ?? ''} onChange={e => { const v = Number(e.target.value); if (v >= 0 && v <= 100) handleSkinScore(v); }}
                  placeholder="0" type="number" min="0" max="100" style={{
                    width: 70, padding: '8px 0', border: 'none', background: 'transparent',
                    fontSize: 36, fontWeight: 700, color: '#1A3A4A', fontFamily: 'inherit', outline: 'none',
                  }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 8, borderRadius: 4, background: 'rgba(200,220,230,.3)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #A8E0C0, #4A9A7A)', width: `${skinScore || 0}%`, transition: 'width 0.3s' }} />
                  </div>
                  {scoreDiff != null && (
                    <div style={{ fontSize: 11, color: '#9ABBC8', marginTop: 4 }}>
                      어제보다 <span style={{ color: scoreDiff >= 0 ? '#4A9A7A' : '#C4580A', fontWeight: 600 }}>{scoreDiff > 0 ? '+' : ''}{scoreDiff}점</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 오늘 피부 요약 */}
            {(selectedTags.length > 0 || skinScore) && (
              <div style={{
                background: 'rgba(200,230,210,.2)', borderRadius: 16, padding: '14px 16px',
                border: '0.5px solid rgba(100,180,130,.2)', ...fadeUp(0.15),
              }}>
                <div style={{ fontSize: 11, color: '#7AAABB', marginBottom: 6 }}>오늘 피부 요약</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A', lineHeight: 1.6 }}>
                  {selectedTags.length > 0 && selectedTags.join(' · ')}
                  {selectedTags.length > 0 && skinScore && ' · '}
                  {skinScore && `점수 ${skinScore}점`}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Compare Modal */}
      {showCompareModal && skinRecords.length >= 2 && (() => {
        const oldest = skinRecords[0];
        const newest = skinRecords[skinRecords.length - 1];
        const bThumb = skinThumbs[String(oldest.id)] || skinThumbs[oldest.date];
        const aThumb = skinThumbs[String(newest.id)] || skinThumbs[newest.date];
        const diff = newest.overallScore - oldest.overallScore;

        return (
          <div onClick={() => setShowCompareModal(false)} style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0',
              padding: '24px 24px 40px', width: '100%', maxWidth: 420,
              maxHeight: '85vh', overflowY: 'auto',
            }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 16px', opacity: 0.3 }} />

              <div className="segment-control" style={{ marginBottom: 20 }}>
                <button className={`segment-btn${compareTab === 'monthly' ? ' active' : ''}`}
                  onClick={() => setCompareTab('monthly')}>1개월 변화</button>
                <button className={`segment-btn${compareTab === 'beforeafter' ? ' active' : ''}`}
                  onClick={() => setCompareTab('beforeafter')}>Before&After</button>
              </div>

              {compareTab === 'monthly' && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ aspectRatio: '1', borderRadius: 16, overflow: 'hidden', background: 'var(--bg-secondary)', marginBottom: 8 }}>
                        {bThumb ? <img src={bThumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 11 }}>사진 없음</div>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(oldest.date).getMonth() + 1}/{new Date(oldest.date).getDate()}</div>
                      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{oldest.overallScore}점</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: 22, color: 'var(--text-dim)' }}>→</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ aspectRatio: '1', borderRadius: 16, overflow: 'hidden', background: 'var(--bg-secondary)', marginBottom: 8 }}>
                        {aThumb ? <img src={aThumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 11 }}>사진 없음</div>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(newest.date).getMonth() + 1}/{new Date(newest.date).getDate()}</div>
                      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{newest.overallScore}점</div>
                    </div>
                  </div>
                  <div style={{
                    padding: '12px 16px', borderRadius: 14,
                    background: diff >= 0 ? 'rgba(137,206,245,0.08)' : 'rgba(248,113,113,0.08)',
                    color: diff >= 0 ? '#89cef5' : '#f87171',
                    fontSize: 14, fontWeight: 600,
                  }}>
                    {diff >= 0 ? '▲' : '▼'} {Math.abs(diff)}점 {diff >= 0 ? '향상' : '하락'}
                  </div>
                </div>
              )}

              {compareTab === 'beforeafter' && (
                <BeforeAfterSlider />
              )}

              <button onClick={() => setShowCompareModal(false)} style={{
                marginTop: 20, padding: '12px 0', width: '100%',
                background: 'var(--bg-secondary)', border: 'none', borderRadius: 14,
                fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>닫기</button>
            </div>
          </div>
        );
      })()}

      {/* Food Tab */}
      {(insightTab === 'food') && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>식단 분석 준비 중</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>곧 영양 트렌드 분석이 제공됩니다</div>
        </div>
      )}

      {/* Body Tab */}
      {(insightTab === 'body') && <div style={{ padding: '0 14px' }}>
        {/* 몸무게 카드 */}
        {(() => {
          const prevWeight = records.length >= 2 ? records[records.length - 2].weight : null;
          const todayWeight = latest?.weight ?? null;
          const wDiff = todayWeight && prevWeight ? Math.round((todayWeight - prevWeight) * 10) / 10 : null;
          const startW = start?.weight ?? null;
          const goalW = goal?.target ?? null;
          const progress = startW && goalW && todayWeight ? Math.min(1, Math.max(0, (startW - todayWeight) / (startW - goalW))) : 0;
          return (
            <div style={{ ...v2CardStyle, ...fadeUp(0.05) }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 3, height: 14, borderRadius: 2, background: getCategoryColor('body') }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>몸무게</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div onClick={() => setShowAdd(true)} style={{
                  flex: 1, background: 'rgba(255,255,255,.7)', borderRadius: 12, padding: '14px',
                  textAlign: 'center', cursor: 'pointer', border: '1px solid rgba(200,220,230,.3)',
                }}>
                  <span style={{ fontSize: 24, fontWeight: 600, color: '#1A3A4A' }}>{todayWeight ?? '—'}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 13, color: '#7AAABB' }}>kg</span>
                  {wDiff != null && (
                    <div style={{ marginTop: 2 }}>
                      <div style={{ fontSize: 9, color: '#9ABBC8' }}>어제보다</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: wDiff < 0 ? '#4A9A7A' : wDiff > 0 ? '#C4580A' : '#7AAABB' }}>
                        {wDiff > 0 ? '+' : ''}{wDiff}kg
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {startW && goalW && (
                <>
                  <div style={{ height: 6, borderRadius: 3, background: 'rgba(200,220,230,.3)', overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #A8E0C0, #4A9A7A)', width: `${progress * 100}%`, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ABBC8' }}>
                    <span>시작 {startW}kg</span>
                    <span>목표 {goalW}kg</span>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* 눈바디 카드 */}
        <div style={{ ...v2CardStyle, ...fadeUp(0.1) }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: getCategoryColor('body') }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>눈바디</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {['정면', '측면', '후면'].map((label, idx) => {
              const photos = eyeBody?.photos || {};
              const hasPhoto = !!photos[label];
              return (
                <div key={label} style={{ flex: 1, position: 'relative' }}>
                  <label style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    height: 100, borderRadius: 14, cursor: 'pointer',
                    background: hasPhoto ? 'none' : 'rgba(230,240,235,.4)',
                    border: '1.5px dashed rgba(180,210,200,.5)',
                    overflow: 'hidden',
                  }}>
                    {hasPhoto ? (
                      <img src={photos[label]} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <>
                        <span style={{ fontSize: 20, color: '#B0C8C0' }}>+</span>
                        <span style={{ fontSize: 11, color: '#9ABBC8', marginTop: 4 }}>{label}</span>
                      </>
                    )}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => {
                        const img = new Image();
                        img.onload = () => {
                          const canvas = document.createElement('canvas');
                          canvas.width = 300; canvas.height = 300;
                          const ctx = canvas.getContext('2d');
                          const size = Math.min(img.width, img.height);
                          const sx = (img.width - size) / 2, sy = (img.height - size) / 2;
                          ctx.drawImage(img, sx, sy, size, size, 0, 0, 300, 300);
                          const newPhotos = { ...(eyeBody?.photos || {}), [label]: canvas.toDataURL('image/jpeg', 0.7) };
                          const saved = saveEyeBody(newPhotos);
                          setEyeBody(saved);
                        };
                        img.src = ev.target.result;
                      };
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        {/* 혈당 카드 */}
        <div style={{ ...v2CardStyle, ...fadeUp(0.15) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: getCategoryColor('body') }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>혈당</span>
            <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
              {['공복', '식후'].map(t => (
                <span key={t} onClick={() => setBsTiming(t)} style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 99, cursor: 'pointer',
                  background: bsTiming === t ? 'rgba(200,230,210,.4)' : 'rgba(255,255,255,.5)',
                  border: bsTiming === t ? '1px solid rgba(100,180,130,.4)' : '1px solid rgba(200,220,230,.3)',
                  color: bsTiming === t ? '#2A6A4A' : '#9ABBC8', fontWeight: bsTiming === t ? 600 : 400,
                }}>{t}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <input value={bsInput} onChange={e => setBsInput(e.target.value)}
              placeholder="0" type="number" style={{
                width: 90, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(200,220,230,.3)',
                background: 'rgba(255,255,255,.7)', fontSize: 22, fontWeight: 600, color: '#1A3A4A',
                fontFamily: 'inherit', outline: 'none', textAlign: 'center',
              }} />
            <span style={{ fontSize: 13, color: '#7AAABB' }}>mg/dL</span>
            <div style={{ flex: 1 }} />
            {bsInput && (() => {
              const v = Number(bsInput);
              const isPost = bsTiming === '식후';
              const status = isPost
                ? (v < 140 ? '정상' : v < 200 ? '주의' : '높음')
                : (v < 100 ? '정상' : v < 126 ? '주의' : '높음');
              const color = status === '정상' ? '#4A9A7A' : status === '주의' ? '#D4A030' : '#C4580A';
              return <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: `${color}18`, color }}>{status}</span>;
            })()}
          </div>
        </div>

        {/* 혈당 그래프 분석 카드 */}
        <div style={{ ...v2CardStyle, ...fadeUp(0.2) }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: getCategoryColor('body') }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>혈당 그래프</span>
            </div>
            <label style={{ fontSize: 11, color: '#5AAABB', fontWeight: 500, cursor: 'pointer' }}>
              {bsGraphLoading ? '분석중...' : '사진 업로드'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBsGraphLoading(true);
                setBsGraphError(null);
                try {
                  const dataUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const img = new Image();
                      img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const maxW = 1024;
                        const scale = Math.min(1, maxW / img.width);
                        canvas.width = img.width * scale;
                        canvas.height = img.height * scale;
                        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                        resolve(canvas.toDataURL('image/jpeg', 0.8));
                      };
                      img.src = ev.target.result;
                    };
                    reader.readAsDataURL(file);
                  });
                  const resp = await fetch('/api/blood-sugar-graph', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: dataUrl }),
                  });
                  const result = await resp.json();
                  if (result.error) throw new Error(result.error);
                  if (!result.readings?.length) throw new Error('그래프에서 수치를 읽지 못했어요');
                  const graphData = { ...result, uploadedAt: new Date().toISOString() };
                  localStorage.setItem('nou_bs_graph', JSON.stringify(graphData));
                  setBsGraphData(graphData);
                } catch (err) {
                  setBsGraphError(err.message);
                } finally {
                  setBsGraphLoading(false);
                  e.target.value = '';
                }
              }} />
            </label>
          </div>

          {bsGraphError && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(200,100,80,.1)', marginBottom: 10, fontSize: 12, color: '#C4580A' }}>
              {bsGraphError}
            </div>
          )}

          {bsGraphLoading && (
            <div style={{ padding: '30px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#7AAABB' }}>AI가 그래프를 분석하고 있어요...</div>
            </div>
          )}

          {!bsGraphLoading && bsGraphData?.readings?.length > 0 && (() => {
            const readings = bsGraphData.readings;
            const values = readings.map(r => r.value);
            const minVal = Math.min(...values, 70);
            const maxVal = Math.max(...values, 140);
            const padTop = 20, padBottom = 30, padLeft = 36, padRight = 10;
            const chartW = 300, chartH = 140;
            const innerW = chartW - padLeft - padRight;
            const innerH = chartH - padTop - padBottom;
            const range = maxVal - minVal || 1;

            // Normal range Y positions
            const y70 = padTop + innerH - ((70 - minVal) / range) * innerH;
            const y140 = padTop + innerH - ((140 - minVal) / range) * innerH;

            const points = readings.map((r, i) => ({
              x: padLeft + (i / Math.max(readings.length - 1, 1)) * innerW,
              y: padTop + innerH - ((r.value - minVal) / range) * innerH,
              value: r.value,
              time: r.time,
              normal: r.value >= 70 && r.value <= 140,
            }));

            return (
              <div>
                <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: 'auto' }}>
                  {/* Normal range band */}
                  <rect x={padLeft} y={y140} width={innerW} height={y70 - y140}
                    fill="rgba(100,180,130,.08)" />
                  {/* 140 line */}
                  <line x1={padLeft} y1={y140} x2={chartW - padRight} y2={y140}
                    stroke="rgba(100,180,130,.3)" strokeWidth="0.8" strokeDasharray="4 2" />
                  <text x={padLeft - 4} y={y140 + 3} textAnchor="end" fontSize="8" fill="#7AAABB">140</text>
                  {/* 70 line */}
                  <line x1={padLeft} y1={y70} x2={chartW - padRight} y2={y70}
                    stroke="rgba(100,180,130,.3)" strokeWidth="0.8" strokeDasharray="4 2" />
                  <text x={padLeft - 4} y={y70 + 3} textAnchor="end" fontSize="8" fill="#7AAABB">70</text>

                  {/* Line segments with color coding */}
                  {points.map((p, i) => {
                    if (i === 0) return null;
                    const prev = points[i - 1];
                    const segNormal = prev.normal && p.normal;
                    return (
                      <line key={`seg-${i}`}
                        x1={prev.x} y1={prev.y} x2={p.x} y2={p.y}
                        stroke={segNormal ? '#4A9A7A' : '#E8944A'}
                        strokeWidth="2.5" strokeLinecap="round" />
                    );
                  })}

                  {/* Dots */}
                  {points.map((p, i) => (
                    <circle key={`dot-${i}`} cx={p.x} cy={p.y} r="3"
                      fill={p.normal ? '#4A9A7A' : '#E8944A'}
                      stroke="#fff" strokeWidth="1" />
                  ))}

                  {/* Value labels for key points (min, max, first, last) */}
                  {points.map((p, i) => {
                    const isFirst = i === 0;
                    const isLast = i === points.length - 1;
                    const isMax = p.value === Math.max(...values);
                    const isMin = p.value === Math.min(...values);
                    if (!isFirst && !isLast && !isMax && !isMin) return null;
                    return (
                      <text key={`val-${i}`} x={p.x} y={p.y - 6}
                        textAnchor="middle" fontSize="8" fontWeight="600"
                        fill={p.normal ? '#3A7A5A' : '#C4700A'}>
                        {p.value}
                      </text>
                    );
                  })}

                  {/* Time labels */}
                  {points.map((p, i) => {
                    // Show every few labels to avoid overlap
                    const showEvery = points.length > 10 ? 3 : points.length > 6 ? 2 : 1;
                    if (i % showEvery !== 0 && i !== points.length - 1) return null;
                    return (
                      <text key={`time-${i}`} x={p.x} y={chartH - 6}
                        textAnchor="middle" fontSize="7.5" fill="#9ABBC8">
                        {p.time}
                      </text>
                    );
                  })}
                </svg>

                {/* Legend */}
                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 3, borderRadius: 2, background: '#4A9A7A' }} />
                    <span style={{ fontSize: 10, color: '#7AAABB' }}>정상 (70-140)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 3, borderRadius: 2, background: '#E8944A' }} />
                    <span style={{ fontSize: 10, color: '#7AAABB' }}>초과</span>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 10, padding: '10px 0', borderTop: '0.5px solid rgba(200,220,230,.3)' }}>
                  {[
                    { label: '최저', value: Math.min(...values), unit: '' },
                    { label: '평균', value: Math.round(values.reduce((a, b) => a + b, 0) / values.length), unit: '' },
                    { label: '최고', value: Math.max(...values), unit: '' },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#9ABBC8', marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: s.value > 140 ? '#E8944A' : '#1A3A4A' }}>
                        {s.value}<span style={{ fontSize: 10, color: '#9ABBC8', marginLeft: 2 }}>mg/dL</span>
                      </div>
                    </div>
                  ))}
                </div>

                {bsGraphData.source && (
                  <div style={{ fontSize: 10, color: '#9ABBC8', textAlign: 'center', marginTop: 4 }}>
                    출처: {bsGraphData.source}
                  </div>
                )}
              </div>
            );
          })()}

          {!bsGraphLoading && !bsGraphData && (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>📊</div>
              <div style={{ fontSize: 12, color: '#9ABBC8' }}>혈당 그래프 사진을 올리면</div>
              <div style={{ fontSize: 12, color: '#9ABBC8' }}>AI가 수치를 읽어 그래프로 보여줘요</div>
            </div>
          )}
        </div>

        {/* 저장 버튼 */}
        <div style={{ marginTop: 10, ...fadeUp(0.25) }}>
          <button onClick={() => {
            if (bsInput) { const saved = saveBloodSugar(Number(bsInput), bsTiming); setBloodSugar(saved); }
          }} style={{
            width: '100%', padding: '14px 0', background: '#1A3A4A',
            border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 600,
            color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
          }}>저장</button>
        </div>
      </div>}

      </div>{/* end tab-content-panel */}

      {/* Add Weight Modal */}
      {showAdd && <AddWeightModal onSave={handleSave} onClose={() => setShowAdd(false)} latest={latest} />}

      {/* Goal Modal */}
      {showGoalModal && <GoalModal onSave={handleSaveGoal} onClose={() => setShowGoalModal(false)} current={goal} />}

    </div>
  );
}

function StatBox({ label, value, unit, color, onTap }) {
  return (
    <div onClick={onTap} style={{
      background: 'var(--bg-card)', borderRadius: 'var(--card-border-radius)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
      padding: '14px 16px', cursor: onTap ? 'pointer' : 'default',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: color || 'var(--text-primary)', marginTop: 4, fontFamily: 'var(--font-display)' }}>
        {value} {unit && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-dim)' }}>{unit}</span>}
      </div>
      {onTap && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>탭하여 설정</div>}
    </div>
  );
}

function AddWeightModal({ onSave, onClose, latest }) {
  const [weight, setWeight] = useState(latest ? String(latest.weight) : '');

  const inputStyle = {
    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
    background: 'var(--bg-input, #F2F3F5)', fontSize: 20, fontWeight: 600,
    color: 'var(--text-primary)', fontFamily: 'var(--font-display)',
    textAlign: 'center', outline: 'none',
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0',
        padding: '24px 24px 40px', width: '100%', maxWidth: 420,
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20, textAlign: 'center' }}>오늘 몸무게</div>

        <input
          value={weight} onChange={e => setWeight(e.target.value)}
          placeholder="0.0" type="number" step="0.1"
          style={inputStyle}
          autoFocus
        />
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>kg</div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
            border: 'none', background: 'var(--bg-input, #F2F3F5)',
            color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>취소</button>
          <button onClick={() => { if (weight) onSave(Number(weight)); }} style={{
            flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
            border: 'none', background: 'var(--accent-primary)',
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>저장</button>
        </div>
      </div>
    </div>
  );
}

function GoalModal({ onSave, onClose, current }) {
  const [target, setTarget] = useState(current ? String(current.target) : '');

  const inputStyle = {
    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
    background: 'var(--bg-input, #F2F3F5)', fontSize: 20, fontWeight: 600,
    color: 'var(--text-primary)', fontFamily: 'var(--font-display)',
    textAlign: 'center', outline: 'none',
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0',
        padding: '24px 24px 40px', width: '100%', maxWidth: 420,
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20, textAlign: 'center' }}>목표 몸무게</div>

        <input
          value={target} onChange={e => setTarget(e.target.value)}
          placeholder="0.0" type="number" step="0.1"
          style={inputStyle}
          autoFocus
        />
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>kg</div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
            border: 'none', background: 'var(--bg-input, #F2F3F5)',
            color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>취소</button>
          <button onClick={() => { if (target) onSave(Number(target)); }} style={{
            flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
            border: 'none', background: 'var(--accent-primary)',
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>저장</button>
        </div>
      </div>
    </div>
  );
}

// ===== Profile Settings Modal =====
function ProfileSettingsModal({ profile, onUpdate, onClose }) {
  const currentYear = new Date().getFullYear();
  const age = profile.birthYear ? currentYear - parseInt(profile.birthYear) : null;

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 12, border: 'none',
    background: 'var(--bg-input, #F2F3F5)', fontSize: 14,
    color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0',
        padding: '24px 24px 40px', width: '100%', maxWidth: 420,
        maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>프로필 설정</div>

        {/* Profile photo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div onClick={() => document.getElementById('profile-photo-input')?.click()} style={{
            position: 'relative', width: 72, height: 72, borderRadius: '50%', cursor: 'pointer',
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
                // Resize to 200px for storage
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

        {/* ── 기본 정보 ── */}
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

        {/* ── 피부 정보 ── */}
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

        <button onClick={onClose} style={{
          width: '100%', padding: '14px 0', borderRadius: 'var(--btn-radius)',
          border: 'none', background: 'var(--accent-primary)',
          color: '#fff', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>완료</button>
      </div>
    </div>
  );
}
