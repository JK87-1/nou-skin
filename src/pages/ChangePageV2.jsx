import { useState, useEffect, useMemo } from 'react';
import { getBodyRecords, getLatestWeight, getStartWeight, getBodyGoal, calcBMI } from '../storage/BodyStorage';
import { getRecords, getAllThumbnailsAsync } from '../storage/SkinStorage';

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
  return records.filter(r => {
    const d = r[dateField];
    return d >= fromStr && d <= toStr;
  });
}

const changeColor = (diff) => {
  if (diff < 0) return '#4A9A7A';
  if (diff > 0) return '#C4580A';
  return '#7AAABB';
};

// Load record_v2 data
function loadRecordV2() {
  try { return JSON.parse(localStorage.getItem('lua_record_v2') || '{}'); } catch { return {}; }
}

// Demo patterns (static until API is wired)
const DEMO_PATTERNS = [
  {
    cause: '물 6잔 이상',
    effect: '수분 충분',
    result: '피부 점수 +3',
    desc: '수분을 6잔 이상 마신 날 다음날 피부 점수가 평균 3점 높아요.',
  },
  {
    cause: '7시간 이상 수면',
    effect: '깊은 수면',
    result: '에너지 상승',
    desc: '7시간 이상 잔 날은 에너지 수준이 평균 1.2단계 높았어요.',
  },
  {
    cause: '산책 또는 운동',
    effect: '활동량 증가',
    result: '몸무게 -0.3kg',
    desc: '운동한 주는 체중이 평균 0.3kg 감소하는 패턴이 보여요.',
  },
];

const PERIODS = ['1주', '1개월', '3개월', '전체'];
const SEGMENTS = ['결과', '원인→결과'];

export default function ChangePageV2() {
  const [activePeriod, setActivePeriod] = useState('1주');
  const [segment, setSegment] = useState('결과');

  // Body data
  const [bodyRecords, setBodyRecords] = useState(() => getBodyRecords());
  const [bodyGoal] = useState(() => getBodyGoal());

  // Skin data
  const [skinRecords, setSkinRecords] = useState([]);
  const [skinThumbs, setSkinThumbs] = useState({});

  // Record v2 data (exercise, sleep, water)
  const [recordV2, setRecordV2] = useState(() => loadRecordV2());

  useEffect(() => {
    setSkinRecords(getRecords());
    getAllThumbnailsAsync().then(setSkinThumbs);
  }, []);

  // Filtered data by period
  const { from, to } = useMemo(() => getDateRange(activePeriod), [activePeriod]);

  const filteredBody = useMemo(() => filterByRange(bodyRecords, from, to), [bodyRecords, from, to]);
  const filteredSkin = useMemo(() => filterByRange(skinRecords, from, to), [skinRecords, from, to]);

  // Body stats
  const latestWeight = filteredBody.length > 0 ? filteredBody[filteredBody.length - 1].weight : null;
  const startWeight = filteredBody.length > 0 ? filteredBody[0].weight : null;
  const weightDiff = latestWeight && startWeight ? Math.round((latestWeight - startWeight) * 10) / 10 : 0;
  const goalWeight = bodyGoal?.targetWeight;

  // Skin stats
  const latestSkin = filteredSkin.length > 0 ? filteredSkin[filteredSkin.length - 1] : null;
  const startSkin = filteredSkin.length > 0 ? filteredSkin[0] : null;
  const skinDiff = latestSkin && startSkin ? latestSkin.overallScore - startSkin.overallScore : 0;

  // Energy/mood from recordV2
  const recordEntries = useMemo(() => {
    const entries = [];
    const fromStr = from ? getDateKey(from) : null;
    const toStr = to ? getDateKey(to) : null;
    Object.entries(recordV2).forEach(([date, data]) => {
      if (fromStr && date < fromStr) return;
      if (toStr && date > toStr) return;
      entries.push({ date, ...data });
    });
    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }, [recordV2, from, to]);

  const cardStyle = {
    background: 'rgba(255,255,255,.65)',
    borderRadius: 16, padding: '14px 15px',
    border: '0.5px solid rgba(255,255,255,.9)',
    marginBottom: 10,
  };

  const iconBox = (bg) => ({
    width: 26, height: 26, borderRadius: 8, background: bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
  });

  // Mini line chart SVG
  const MiniChart = ({ data, color = '#80CCE8', height = 36 }) => {
    if (!data || data.length < 2) return null;
    const w = 200, h = height;
    const min = Math.min(...data) * 0.995;
    const max = Math.max(...data) * 1.005;
    const range = max - min || 1;
    const points = data.map((v, i) => ({
      x: (i / (data.length - 1)) * w,
      y: h - ((v - min) / range) * (h - 8) - 4,
    }));
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const last = points[points.length - 1];
    return (
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height }}>
        <defs>
          <linearGradient id={`lc-${color.replace('#', '')}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <path d={pathD} fill="none" stroke={`url(#lc-${color.replace('#', '')})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last.x} cy={last.y} r="3" fill={color} stroke="#fff" strokeWidth="1.5" />
      </svg>
    );
  };

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 80 }}>
      {/* ===== 1. Header ===== */}
      <div style={{ padding: '16px 18px 0', ...fadeUp(0) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)', fontFamily: 'Pretendard, sans-serif' }}>변화</h1>
          <div style={{
            background: 'rgba(255,255,255,.5)', border: '0.5px solid rgba(100,180,220,.2)',
            borderRadius: 99, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#7AAABB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span style={{ fontSize: 10, color: '#7AAABB' }}>직접 선택</span>
          </div>
        </div>

        {/* ===== 2. Period Buttons ===== */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 0 }}>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setActivePeriod(p)} style={{
              fontSize: 10, padding: '5px 12px', borderRadius: 99, cursor: 'pointer',
              border: `0.5px solid ${activePeriod === p ? 'rgba(100,180,220,.4)' : 'rgba(100,180,220,.2)'}`,
              background: activePeriod === p ? 'rgba(100,180,220,.15)' : 'rgba(255,255,255,.5)',
              color: activePeriod === p ? '#2A6A8A' : '#7AAABB',
              fontWeight: activePeriod === p ? 500 : 400,
            }}>{p}</button>
          ))}
        </div>
      </div>

      {/* ===== 3. Segment Tabs ===== */}
      <div style={{ margin: '8px 14px 0', background: 'rgba(255,255,255,.5)', borderRadius: 10, padding: 3, display: 'flex', ...fadeUp(0.05) }}>
        {SEGMENTS.map(s => (
          <button key={s} onClick={() => setSegment(s)} style={{
            flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 500,
            border: 'none', cursor: 'pointer',
            background: segment === s ? 'rgba(255,255,255,.9)' : 'transparent',
            color: segment === s ? '#1A3A4A' : '#7AAABB',
            boxShadow: segment === s ? '0 1px 3px rgba(100,180,220,.15)' : 'none',
            transition: 'all 0.15s ease',
          }}>{s}</button>
        ))}
      </div>

      <div style={{ padding: '10px 14px 0' }}>

        {/* ===== 4-A. Results View ===== */}
        {segment === '결과' && <>

          {/* Weight Card */}
          <div style={{ ...cardStyle, ...fadeUp(0.1) }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={iconBox('linear-gradient(135deg, #C0E8F8, #80CCE8)')}>⚖️</div>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>몸무게</span>
              </div>
              {weightDiff !== 0 && (
                <span style={{ fontSize: 11, fontWeight: 500, color: changeColor(weightDiff) }}>
                  {weightDiff > 0 ? '▲' : '▼'} {Math.abs(weightDiff)}kg
                </span>
              )}
            </div>

            {latestWeight ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 500, color: '#1A3A4A' }}>{latestWeight}</span>
                  <span style={{ fontSize: 13, color: '#7AAABB', marginLeft: 3 }}>kg</span>
                </div>
                <div style={{ textAlign: 'center', fontSize: 10, color: '#7AAABB', marginBottom: 10 }}>
                  시작 {startWeight}kg{goalWeight ? ` · 목표 ${goalWeight}kg` : ''}
                </div>
                <MiniChart data={filteredBody.map(r => r.weight)} color="#80CCE8" />
              </>
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: '#9ABBC8' }}>
                아직 기록이 없어요
              </div>
            )}
          </div>

          {/* Skin Card */}
          <div style={{ ...cardStyle, ...fadeUp(0.15) }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={iconBox('linear-gradient(135deg, #FFD8E8, #F8A8C0)')}>✨</div>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>피부 상태</span>
              </div>
              {skinDiff !== 0 && (
                <span style={{ fontSize: 11, fontWeight: 500, color: changeColor(-skinDiff) }}>
                  {skinDiff > 0 ? '▲' : '▼'} {Math.abs(skinDiff)}점
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
                        <span style={{
                          position: 'absolute', left: 3, bottom: 2,
                          fontSize: 8, fontWeight: 600, color: '#fff',
                          textShadow: '0 1px 2px rgba(0,0,0,.4)',
                        }}>{r.overallScore}</span>
                      </div>
                    );
                  })}
                </div>
                <MiniChart data={filteredSkin.map(r => r.overallScore)} color="#F8A8C0" />
              </>
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: '#9ABBC8' }}>
                아직 측정 기록이 없어요
              </div>
            )}
          </div>

          {/* Energy/Mood Card */}
          <div style={{ ...cardStyle, ...fadeUp(0.2) }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={iconBox('linear-gradient(135deg, #E8D0F0, #C8A0E0)')}>⚡</div>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>에너지·기분</span>
              </div>
            </div>

            {recordEntries.length > 0 ? (
              <>
                <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#F8A8C0' }} />
                    <span style={{ fontSize: 9, color: '#7AAABB' }}>수면</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#FFD070' }} />
                    <span style={{ fontSize: 9, color: '#7AAABB' }}>수분</span>
                  </div>
                </div>
                {(() => {
                  const sleepData = recordEntries.filter(e => e.sleep?.hours).map(e => e.sleep.hours);
                  const waterData = recordEntries.filter(e => e.water?.cups).map(e => e.water.cups);
                  if (sleepData.length < 2 && waterData.length < 2) return (
                    <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 11, color: '#9ABBC8' }}>기록을 더 쌓으면 그래프가 나타나요</div>
                  );
                  const data = sleepData.length >= 2 ? sleepData : waterData;
                  const color = sleepData.length >= 2 ? '#F8A8C0' : '#FFD070';
                  return <MiniChart data={data} color={color} height={44} />;
                })()}
              </>
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: '#9ABBC8' }}>
                기록 탭에서 수면·수분을 기록해보세요
              </div>
            )}
          </div>
        </>}

        {/* ===== 4-B. Cause → Effect View ===== */}
        {segment === '원인→결과' && <>

          {/* Top Banner */}
          <div style={{
            background: 'linear-gradient(120deg, rgba(100,180,220,.12), rgba(140,200,230,.08))',
            border: '1px solid rgba(100,180,220,.25)',
            borderRadius: 16, padding: '12px 14px', marginBottom: 10,
            ...fadeUp(0.1),
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#2A6A8A' }}>이번 주 발견한 패턴</span>
              <span style={{ fontSize: 9, color: '#80C0E8', fontWeight: 500 }}>● LIVE</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 99, background: 'rgba(255,210,80,.15)', color: '#8A6000' }}>
                물 6잔+
              </span>
              <span style={{ fontSize: 10, color: '#AAC8D8' }}>→</span>
              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 99, background: 'rgba(100,180,220,.12)', color: '#2A6A8A' }}>
                수분 충분
              </span>
              <span style={{ fontSize: 10, color: '#AAC8D8' }}>→</span>
              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 99, background: 'rgba(100,180,220,.12)', color: '#2A6A8A' }}>
                피부 +3점
              </span>
            </div>
            <div style={{ fontSize: 10, color: '#5A8AAA', lineHeight: 1.5, marginTop: 8 }}>
              수분을 충분히 섭취한 날 다음날 피부 점수가 높아지는 패턴이 보여요.
            </div>
          </div>

          {/* Pattern Cards */}
          {DEMO_PATTERNS.map((pattern, idx) => (
            <div key={idx} style={{
              background: 'rgba(255,255,255,.65)', borderRadius: 12, padding: '10px 12px',
              border: '0.5px solid rgba(255,255,255,.9)', marginBottom: 8,
              ...fadeUp(0.15 + idx * 0.05),
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(255,210,80,.15)', color: '#8A6000' }}>
                  {pattern.cause}
                </span>
                <span style={{ fontSize: 10, color: '#AAC8D8' }}>→</span>
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(100,180,220,.12)', color: '#2A6A8A' }}>
                  {pattern.effect}
                </span>
                <span style={{ fontSize: 10, color: '#AAC8D8' }}>→</span>
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(100,180,220,.12)', color: '#2A6A8A' }}>
                  {pattern.result}
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#5A8AAA', lineHeight: 1.5 }}>
                {pattern.desc}
              </div>
            </div>
          ))}

          {/* Empty state if no real data */}
          <div style={{
            padding: '16px 0', textAlign: 'center', fontSize: 11, color: '#9ABBC8',
            ...fadeUp(0.3),
          }}>
            기록이 쌓이면 AI가 더 정확한 패턴을 발견해줘요
          </div>
        </>}
      </div>
    </div>
  );
}
