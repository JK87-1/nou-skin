import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  getBodyRecords, saveBodyRecord, deleteBodyRecord,
  getBodyGoal, saveBodyGoal, getBodyProfile, saveBodyProfile,
  calcBMI, getLatestWeight, getStartWeight,
} from '../storage/BodyStorage';
import { getProfile, saveProfile, SKIN_TYPES, SKIN_CONCERNS, SENSITIVITY_OPTIONS, GENDER_OPTIONS, getEnabledCategories, getCategoryColor } from '../storage/ProfileStorage';
import { getRecords, getAllThumbnailsAsync } from '../storage/SkinStorage';
import { getLatestCheck, getConditionChecks, getTodayEnergySubCheck, saveEnergySubCheck } from '../storage/ConditionStorage';
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
      <div style={{ padding: '10px 18px 0' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {['1주', '1개월', '3개월', '전체'].map(p => (
            <button key={p} onClick={() => setActivePeriod(p)} style={{
              fontSize: 10, padding: '5px 12px', borderRadius: 99, cursor: 'pointer',
              border: `0.5px solid ${activePeriod === p ? 'rgba(100,180,220,.4)' : 'rgba(100,180,220,.2)'}`,
              background: activePeriod === p ? 'rgba(100,180,220,.15)' : 'rgba(255,255,255,.5)',
              color: activePeriod === p ? '#2A6A8A' : '#7AAABB',
              fontWeight: activePeriod === p ? 500 : 400,
              fontFamily: 'inherit',
            }}>{p}</button>
          ))}
          <div onClick={() => setShowSettings(true)} style={{
            background: 'rgba(255,255,255,.5)', border: '0.5px solid rgba(100,180,220,.2)',
            borderRadius: 99, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0,
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7AAABB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span style={{ fontSize: 10, color: '#7AAABB' }}>직접 선택</span>
          </div>
        </div>
      </div>

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

      {/* ===== 전체 탭: 결과 / 원인→결과 ===== */}
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

          {/* Patterns Card */}
            <div style={{ ...v2CardStyle, ...fadeUp(0.1) }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>발견한 패턴</span>
                <span style={{ fontSize: 9, color: '#80C0E8', fontWeight: 500 }}>● LIVE</span>
              </div>
              {DEMO_PATTERNS.map((pattern, idx) => (
                <div key={idx} style={{
                  padding: '8px 0', borderTop: idx > 0 ? '0.5px solid rgba(100,180,220,.12)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(255,210,80,.15)', color: '#8A6000' }}>{pattern.cause}</span>
                    <span style={{ fontSize: 10, color: '#AAC8D8' }}>→</span>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(100,180,220,.12)', color: '#2A6A8A' }}>{pattern.effect}</span>
                    <span style={{ fontSize: 10, color: '#AAC8D8' }}>→</span>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(100,180,220,.12)', color: '#2A6A8A' }}>{pattern.result}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#5A8AAA', lineHeight: 1.5 }}>{pattern.desc}</div>
                </div>
              ))}
              <div style={{ paddingTop: 8, textAlign: 'center', fontSize: 11, color: '#9ABBC8' }}>
                기록이 쌓이면 AI가 더 정확한 패턴을 발견해줘요
              </div>
            </div>

          {/* Energy Card */}
            {(() => {
              // 날짜별 그룹핑
              const grouped = {};
              conditionChecks.forEach(c => {
                const dateKey = c.timestamp.slice(0, 10);
                if (!grouped[dateKey]) grouped[dateKey] = [];
                grouped[dateKey].push(c.energy);
              });
              // 최근 7일 연속 날짜 생성 (빈 날 포함)
              const DAY_NAMES = ['일','월','화','수','목','금','토'];
              const days7 = [];
              for (let i = 6; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                days7.push(getDateKey(d));
              }
              // 각 날짜의 평균값 계산 (기록 있는 날)
              const dayAvg = {};
              days7.forEach(dk => {
                if (grouped[dk] && grouped[dk].length > 0) {
                  dayAvg[dk] = grouped[dk].reduce((a, b) => a + b, 0) / grouped[dk].length;
                }
              });
              // 빈 날은 전후 평균으로 보간
              days7.forEach((dk, i) => {
                if (dayAvg[dk] != null) return;
                let prev = null, next = null;
                for (let j = i - 1; j >= 0; j--) { if (dayAvg[days7[j]] != null) { prev = dayAvg[days7[j]]; break; } }
                for (let j = i + 1; j < 7; j++) { if (dayAvg[days7[j]] != null) { next = dayAvg[days7[j]]; break; } }
                if (prev != null && next != null) dayAvg[dk] = (prev + next) / 2;
                else if (prev != null) dayAvg[dk] = prev;
                else if (next != null) dayAvg[dk] = next;
              });
              // 포인트 및 x 위치 구성
              const allPoints = [];
              const xPos = [];
              days7.forEach((dk, dayIdx) => {
                const vals = grouped[dk] || [];
                if (vals.length === 0) {
                  // 보간된 값 1포인트
                  if (dayAvg[dk] != null) { allPoints.push(dayAvg[dk]); xPos.push(dayIdx / 6); }
                } else {
                  vals.forEach((val, j) => {
                    allPoints.push(val);
                    const dayCenter = dayIdx / 6;
                    const slotWidth = (1 / 6) * 0.4;
                    const offset = vals.length === 1 ? 0 : (j / (vals.length - 1) - 0.5) * slotWidth;
                    xPos.push(Math.max(0, Math.min(1, dayCenter + offset)));
                  });
                }
              });
              const dayLabels = days7.map(dk => {
                const d = new Date(dk + 'T00:00:00');
                const day = d.getDay();
                return { text: DAY_NAMES[day], bold: day === 0 || day === 6 };
              });
              const recordedDays = days7.filter(dk => grouped[dk]?.length > 0).length;
              return (
                <div style={{ ...v2CardStyle, padding: '14px 10px', ...fadeUp(0.15) }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 3, height: 14, borderRadius: 2, background: getCategoryColor('energy') }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>에너지 흐름</span>
                    </div>
                    {recordedDays > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#7AAABB' }}>최근 7일</span>
                    )}
                  </div>
                  {allPoints.length >= 2 ? (
                    <MiniChart data={allPoints} color={getCategoryColor('energy')} height={44} labels={dayLabels} xPositions={xPos} />
                  ) : (
                    <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: '#9ABBC8' }}>
                      {allPoints.length === 1 ? '한 번 더 체크하면 그래프가 나타나요' : '홈에서 컨디션을 체크해보세요'}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Weight Card */}
            {(() => {
              const last7w = filteredBody.slice(-7);
              const DAY_NAMES_W = ['일','월','화','수','목','금','토'];
              const labels7w = last7w.map(r => { const d = new Date(r.date); const day = d.getDay(); return { text: DAY_NAMES_W[day], bold: day === 0 || day === 6 }; });
              return (
                <div style={{ ...v2CardStyle, padding: '14px 10px', ...fadeUp(0.2) }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 3, height: 14, borderRadius: 2, background: getCategoryColor('body') }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>몸무게</span>
                    </div>
                    {v2WeightDiff !== 0 && (
                      <span style={{ fontSize: 11, fontWeight: 500, color: changeColor(v2WeightDiff) }}>
                        {v2WeightDiff > 0 ? '▲' : '▼'} {Math.abs(v2WeightDiff)}kg
                      </span>
                    )}
                  </div>
                  {v2LatestWeight ? (
                    <>
                      <div style={{ textAlign: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 28, fontWeight: 500, color: '#1A3A4A' }}>{v2LatestWeight}</span>
                        <span style={{ fontSize: 13, color: '#7AAABB', marginLeft: 3 }}>kg</span>
                      </div>
                      <div style={{ textAlign: 'center', fontSize: 10, color: '#7AAABB', marginBottom: 10 }}>
                        시작 {v2StartWeight}kg{goal?.target ? ` · 목표 ${goal.target}kg` : ''}
                      </div>
                      <MiniChart data={last7w.map(r => r.weight)} color={getCategoryColor('body')} labels={labels7w} />
                    </>
                  ) : (
                    <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: '#9ABBC8' }}>아직 기록이 없어요</div>
                  )}
                </div>
              );
            })()}

            {/* Skin Card */}
            <div style={{ ...v2CardStyle, ...fadeUp(0.25) }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 3, height: 14, borderRadius: 2, background: getCategoryColor('skin') }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>피부</span>
                </div>
                {v2SkinDiff !== 0 && (
                  <span style={{ fontSize: 11, fontWeight: 500, color: changeColor(-v2SkinDiff) }}>
                    {v2SkinDiff > 0 ? '▲' : '▼'} {Math.abs(v2SkinDiff)}점
                  </span>
                )}
              </div>
              {filteredSkin.length > 0 ? (
                <>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8, overflowX: 'auto' }}>
                    {filteredSkin.slice(-4).map(r => {
                      const thumb = skinThumbs[String(r.id)] || skinThumbs[r.date];
                      return (
                        <div key={r.id || r.date} style={{
                          flex: '1 0 0', height: 44, borderRadius: 6, overflow: 'hidden',
                          background: thumb ? 'none' : 'linear-gradient(135deg, #FFD8E8, #F8A8C0)',
                          position: 'relative', minWidth: 50,
                        }}>
                          {thumb && <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          <span style={{ position: 'absolute', left: 3, bottom: 2, fontSize: 8, fontWeight: 600, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.4)' }}>{r.overallScore}</span>
                        </div>
                      );
                    })}
                  </div>
                  <MiniChart data={filteredSkin.map(r => r.overallScore)} color="#F8A8C0" />
                </>
              ) : (
                <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: '#9ABBC8' }}>아직 측정 기록이 없어요</div>
              )}
            </div>

        </div>
      )}

      {/* Energy Sub Tab */}
      {(insightTab === 'energy') && (
        <div style={{ padding: '0 14px' }}>
          {/* 활력 카드 */}
          <div style={{ ...v2CardStyle, ...fadeUp(0.05) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#1A3A4A' }}>활력</span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              {[
                { value: 1, icon: '🥴', label: '매우낮음' },
                { value: 2, icon: '🙁', label: '낮음' },
                { value: 3, icon: '😐', label: '보통' },
                { value: 4, icon: '🙂', label: '높음' },
                { value: 5, icon: '⚡', label: '최고' },
              ].map(item => {
                const selected = energySub?.vitality === item.value;
                return (
                  <div key={item.value} onClick={() => handleEnergySub('vitality', item.value)}
                    style={{
                      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      padding: '10px 4px', borderRadius: 14, cursor: 'pointer',
                      background: selected ? 'rgba(200,230,210,.4)' : 'rgba(255,255,255,.5)',
                      border: selected ? '1.5px solid rgba(100,180,130,.5)' : '1.5px solid transparent',
                      transition: 'all 0.15s ease',
                    }}>
                    <span style={{ fontSize: 22 }}>{item.icon}</span>
                    <span style={{ fontSize: 10, color: selected ? '#2A6A4A' : '#7AAABB', fontWeight: selected ? 600 : 400 }}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 집중력 카드 */}
          <div style={{ ...v2CardStyle, ...fadeUp(0.1) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <span style={{ fontSize: 16 }}>🧠</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#1A3A4A' }}>집중력</span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              {[
                { value: 1, icon: '🤯', label: '매우낮음' },
                { value: 2, icon: '😑', label: '낮음' },
                { value: 3, icon: '🤔', label: '보통' },
                { value: 4, icon: '💡', label: '높음' },
                { value: 5, icon: '🎯', label: '최고' },
              ].map(item => {
                const selected = energySub?.focus === item.value;
                return (
                  <div key={item.value} onClick={() => handleEnergySub('focus', item.value)}
                    style={{
                      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      padding: '10px 4px', borderRadius: 14, cursor: 'pointer',
                      background: selected ? 'rgba(200,230,210,.4)' : 'rgba(255,255,255,.5)',
                      border: selected ? '1.5px solid rgba(100,180,130,.5)' : '1.5px solid transparent',
                      transition: 'all 0.15s ease',
                    }}>
                    <span style={{ fontSize: 22 }}>{item.icon}</span>
                    <span style={{ fontSize: 10, color: selected ? '#2A6A4A' : '#7AAABB', fontWeight: selected ? 600 : 400 }}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 오늘 에너지 요약 */}
          {(energySub?.vitality || energySub?.focus) && (
            <div style={{
              background: 'rgba(200,230,210,.2)', borderRadius: 16, padding: '14px 16px',
              border: '0.5px solid rgba(100,180,130,.2)', ...fadeUp(0.15),
            }}>
              <div style={{ fontSize: 11, color: '#7AAABB', marginBottom: 6 }}>오늘 에너지 요약</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A', lineHeight: 1.6 }}>
                {energySub.vitality && `활력 ${['','매우낮음','낮음','보통','높음','최고'][energySub.vitality]}`}
                {energySub.vitality && energySub.focus && ' · '}
                {energySub.focus && `집중력 ${['','매우낮음','낮음','보통','높음','최고'][energySub.focus]}`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mood placeholder */}
      {(insightTab === 'mood') && (
        <div style={{ padding: '80px 24px', textAlign: 'center', ...fadeUp(0.05) }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>😊</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>기분 분석</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>곧 출시 예정이에요</div>
        </div>
      )}

      {/* Body shape placeholder */}
      {(insightTab === 'shape') && (
        <div style={{ padding: '80px 24px', textAlign: 'center', ...fadeUp(0.05) }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💪</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>바디 분석</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>곧 출시 예정이에요</div>
        </div>
      )}

      {/* Skin Tab */}
      {(insightTab === 'skin') && (
        <div style={{ padding: '0 18px' }}>
          {skinRecords.length >= 2 ? (
            <div style={{ ...fadeUp(0.05) }}>
              <div
                onClick={() => setShowCompareModal(true)}
                style={{
                  background: 'var(--bg-card)', borderRadius: 'var(--card-border-radius)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
                  padding: '14px 18px', cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>비교 보기</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>1개월 변화 · Before & After</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18l6-6-6-6" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>2회 이상 측정하면 비교 분석을 볼 수 있어요</div>
            </div>
          )}
        </div>
      )}

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
      {(insightTab === 'body') && <div style={{ padding: '0 18px' }}>
        {/* Current Weight Hero */}
        <div style={{ textAlign: 'center', padding: '12px 0 8px', ...fadeUp(0.05) }}>
          {latest ? (
            <>
              <div style={{
                fontSize: 42, fontWeight: 600, fontFamily: 'var(--font-display)',
                color: 'var(--accent-primary)',
              }}>{latest.weight}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>kg · 오늘</div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--text-dim)', padding: '20px 0' }}>
              첫 기록을 시작해보세요
            </div>
          )}
        </div>

        {/* Weight Graph */}
        {graphData && (
          <div style={{ margin: '8px 0 16px', ...fadeUp(0.1) }}>
            <svg viewBox={`0 0 ${graphData.w} ${graphData.h}`} style={{ width: '100%', height: 60 }} preserveAspectRatio="none">
              <defs>
                <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#89cef5" />
                  <stop offset="100%" stopColor="#89cef5" />
                </linearGradient>
              </defs>
              <polyline points={graphData.points} fill="none" stroke="url(#bodyGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={graphData.lastPt.x} cy={graphData.lastPt.y} r="4" fill="#89cef5" />
            </svg>
          </div>
        )}

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, ...fadeUp(0.15) }}>
          <StatBox label="시작 몸무게" value={start ? start.weight : ''} unit="kg" />
          <StatBox
            label="변화"
            value={diff != null ? `${Number(diff) > 0 ? '+' : ''}${diff}` : ''}
            unit="kg"
            color={diff && Number(diff) < 0 ? 'var(--accent-primary)' : 'var(--text-primary)'}
          />
          <StatBox
            label="목표"
            value={goal ? goal.target : ''}
            unit="kg"
            onTap={() => setShowGoalModal(true)}
          />
          <StatBox label="BMI" value={bmi || ''} />
        </div>

        {/* Recent Records */}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: '24px 0 10px', ...fadeUp(0.2) }}>
          최근 기록
        </div>

        {recentRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-dim)', fontSize: 13, ...fadeUp(0.25) }}>
            아직 기록이 없어요
          </div>
        ) : (
          <div style={fadeUp(0.25)}>
            {recentRecords.map((r, i) => {
              const d = new Date(r.date);
              const isToday = r.date === today.toISOString().slice(0, 10);
              return (
                <div key={r.date} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg-card)', borderRadius: 'var(--card-border-radius)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
                  padding: '14px 18px', marginBottom: 8,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {d.getMonth() + 1}월 {d.getDate()}일{isToday ? ' (오늘)' : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 15, fontWeight: 600,
                      color: isToday ? 'var(--accent-primary)' : 'var(--text-muted)',
                    }}>{r.weight} kg</span>
                    <button onClick={() => handleDelete(r.date)} style={{
                      background: 'none', border: 'none', color: 'var(--text-dim)',
                      fontSize: 16, cursor: 'pointer', padding: '0 2px', lineHeight: 1,
                    }}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Button */}
        <div style={{ marginTop: 16, ...fadeUp(0.3) }}>
          <button onClick={() => setShowAdd(true)} style={{
            width: '100%', padding: '14px 0',
            background: 'var(--accent-primary)',
            border: 'none', borderRadius: 'var(--btn-radius)',
            fontSize: 14, fontWeight: 600,
            color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
          }}>오늘 기록하기</button>
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
