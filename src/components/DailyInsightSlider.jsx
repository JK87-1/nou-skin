import { useState, useEffect, useCallback, useRef } from 'react';
import { getBodyRecords } from '../storage/BodyStorage';
import { getWeatherData } from '../storage/WeatherStorage';

/* ── 카드 설정 ── */
const CARDS = [
  { id: 'weather',   emoji: '🌤️', title: '오늘의 날씨·기본', unlockKeys: null },
  { id: 'condition', emoji: '☀️',  title: '컨디션 예측',      unlockKeys: ['sleep', 'water'],          lockMsg: '수면과 수분을 기록하면 열려요' },
  { id: 'mood',      emoji: '😊', title: '기분 예측',         unlockKeys: ['sleep', 'water', 'meal'],  lockMsg: '식단을 기록하면 열려요' },
  { id: 'energy',    emoji: '🔋', title: '에너지 예측',       unlockKeys: ['sleep', 'water', 'meal'],  lockMsg: '식단을 기록하면 열려요' },
  { id: 'skin',      emoji: '✨', title: '피부 예측',         unlockKeys: ['sleep', 'water', 'meal', 'skin'], lockMsg: '피부 상태를 기록하면 열려요' },
  { id: 'tip',       emoji: '🌟', title: '하루 한 가지 실천', unlockKeys: ['sleep', 'water', 'meal'],  lockMsg: '더 기록할수록 정확해져요' },
];

/* ── 신뢰도 점 ── */
function ConfidenceDots({ level }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: i <= level ? 'var(--accent-primary, #89cef5)' : 'rgba(0,0,0,0.1)',
        }} />
      ))}
    </div>
  );
}

/* ── 로컬 날짜 키 ── */
function getLocalDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ── 오늘 기록된 데이터 확인 (잠금 해제용) ── */
function checkTodayRecords() {
  const todayKey = getLocalDateKey(new Date());
  const yKey = getLocalDateKey((() => { const d = new Date(); d.setDate(d.getDate() - 1); return d; })());
  const result = { sleep: false, water: false, meal: false, skin: false };

  try {
    const records = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
    // 수면: 오늘 또는 어제 기록
    if (records[todayKey]?.sleep?.hours > 0 || records[yKey]?.sleep?.hours > 0) result.sleep = true;
    // 수분: 오늘 또는 어제
    if (records[todayKey]?.water?.cups > 0 || records[yKey]?.water?.cups > 0) result.water = true;

    // 식단: 오늘 또는 어제
    const foods = JSON.parse(localStorage.getItem('lua_food_records') || '{}');
    const todayFoods = (foods[todayKey] || []).filter(f => !f.name?.startsWith('물 '));
    const yFoods = (foods[yKey] || []).filter(f => !f.name?.startsWith('물 '));
    if (todayFoods.length > 0 || yFoods.length > 0) result.meal = true;

    // 피부: 어제 분석
    const skinRecs = JSON.parse(localStorage.getItem('nou_records') || '[]');
    if (skinRecs.some(r => r.date === yKey || r.date === todayKey)) result.skin = true;
  } catch {}

  return result;
}

/* ── 잠금 해제 확인 ── */
function getUnlockedCards(todayRecords) {
  return CARDS.filter(c => {
    if (!c.unlockKeys) return true; // weather는 항상
    return c.unlockKeys.every(k => todayRecords[k]);
  }).map(c => c.id);
}

/* ── 어제 데이터 수집 ── */
function gatherYesterdayData() {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yKey = getLocalDateKey(y);
  const data = {};

  try {
    const records = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
    const dayRec = records[yKey] || {};

    const allFoods = JSON.parse(localStorage.getItem('lua_food_records') || '{}');
    const yFoods = (allFoods[yKey] || []).filter(f => !f.name?.startsWith('물 '));
    if (yFoods.length > 0) {
      const totalCal = yFoods.reduce((s, f) => s + (f.calories || f.kcal || 0), 0);
      const totalCarb = yFoods.reduce((s, f) => s + (f.carb || 0), 0);
      const totalProt = yFoods.reduce((s, f) => s + (f.protein || 0), 0);
      const totalFat = yFoods.reduce((s, f) => s + (f.fat || 0), 0);
      const totalSodium = yFoods.reduce((s, f) => s + (f.sodium || 0), 0);
      const totalSugar = yFoods.reduce((s, f) => s + (f.sugar || 0), 0);
      const totalFiber = yFoods.reduce((s, f) => s + (f.fiber || 0), 0);
      data.diet = yFoods.map(f => f.name).filter(Boolean).slice(0, 5).join(', ');
      data.calories = `${Math.round(totalCal)}kcal`;
      data.macros = `탄${Math.round(totalCarb)}g 단${Math.round(totalProt)}g 지${Math.round(totalFat)}g`;
      if (totalSodium > 0) data.sodium = `${Math.round(totalSodium)}mg`;
      if (totalSugar > 0) data.sugar = `${Math.round(totalSugar)}g`;
      if (totalFiber > 0) data.fiber = `${Math.round(totalFiber)}g`;
    }

    if (dayRec.water?.cups > 0) data.water = `${dayRec.water.cups}잔`;
    if (dayRec.steps > 0) data.steps = `${dayRec.steps.toLocaleString()}보`;
    if (dayRec.exercise?.log && Object.keys(dayRec.exercise.log).length > 0) {
      data.exercise = Object.entries(dayRec.exercise.log).map(([n, m]) => `${n} ${m}분`).join(', ');
    }
    if (dayRec.sleep?.hours) {
      data.sleep = `${dayRec.sleep.hours}시간${dayRec.sleep.quality ? ' (' + dayRec.sleep.quality + ')' : ''}`;
      if (dayRec.sleep.bedtime) data.sleepBedtime = dayRec.sleep.bedtime;
    }
    if (!data.sleep) {
      const todayKey = getLocalDateKey(new Date());
      const todayRec = records[todayKey] || {};
      if (todayRec.sleep?.hours) {
        data.sleep = `${todayRec.sleep.hours}시간${todayRec.sleep.quality ? ' (' + todayRec.sleep.quality + ')' : ''}`;
        if (todayRec.sleep.bedtime) data.sleepBedtime = todayRec.sleep.bedtime;
      }
    }

    const bodyRecs = getBodyRecords?.() || [];
    const yWeight = bodyRecs.find(r => r.date === yKey);
    if (yWeight) data.weight = `${yWeight.weight}kg`;
    if (dayRec.bloodSugar?.value) data.bloodSugar = `${dayRec.bloodSugar.value}mg/dL`;

    const allChecks = JSON.parse(localStorage.getItem('nou_condition_checks') || '[]');
    const yChecks = allChecks.filter(c => (c.date || c.timestamp?.slice(0, 10)) === yKey);
    if (yChecks.length > 0) {
      const last = yChecks[yChecks.length - 1];
      const eLabels = ['', '매우 낮음', '낮음', '약간 낮음', '조금 부족', '보통', '괜찮음', '좋음', '활발', '높음', '활기참'];
      const mLabels = ['', '우울', '기분 다운', '침울', '약간 다운', '평온', '무난', '좋음', '기분 좋음', '매우 좋음', '행복'];
      data.condition = `에너지 ${eLabels[last.energy] || last.energy}, 기분 ${mLabels[last.mood] || last.mood}`;
    }

    const skinRecs = JSON.parse(localStorage.getItem('nou_records') || '[]');
    const ySkin = skinRecs.filter(r => r.date === yKey);
    if (ySkin.length > 0) {
      const s = ySkin[ySkin.length - 1];
      data.skin = `종합 ${s.overallScore}점, 수분 ${s.moisture}%, 피부결 ${s.textureScore}점`;
    }
  } catch (e) { console.warn('[DailyInsight] gatherYesterdayData error:', e); }

  return data;
}

/* ── 주간 데이터 수집 ── */
function gatherWeekData() {
  const week = {};
  let daysWithData = 0;
  try {
    const records = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
    const allFoods = JSON.parse(localStorage.getItem('lua_food_records') || '{}');
    const allChecks = JSON.parse(localStorage.getItem('nou_condition_checks') || '[]');
    const bodyRecs = getBodyRecords?.() || [];
    let totalSleep = 0, sleepDays = 0, totalSteps = 0, stepDays = 0;
    let totalWater = 0, waterDays = 0, totalCal = 0, calDays = 0;
    let totalEnergy = 0, totalMood = 0, checkDays = 0;
    const weights = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = getLocalDateKey(d);
      const dayRec = records[key] || {};
      let hasData = false;
      if (dayRec.sleep?.hours) { totalSleep += dayRec.sleep.hours; sleepDays++; hasData = true; }
      if (dayRec.steps > 0) { totalSteps += dayRec.steps; stepDays++; hasData = true; }
      if (dayRec.water?.cups > 0) { totalWater += dayRec.water.cups; waterDays++; hasData = true; }
      const dayFoods = (allFoods[key] || []).filter(f => !f.name?.startsWith('물 '));
      if (dayFoods.length > 0) { totalCal += dayFoods.reduce((s, f) => s + (f.calories || f.kcal || 0), 0); calDays++; hasData = true; }
      const dayChecks = allChecks.filter(c => (c.date || c.timestamp?.slice(0, 10)) === key);
      if (dayChecks.length > 0) { const l = dayChecks[dayChecks.length - 1]; totalEnergy += l.energy || 3; totalMood += l.mood || 3; checkDays++; hasData = true; }
      const w = bodyRecs.find(r => r.date === key);
      if (w) { weights.push(w.weight); hasData = true; }
      if (hasData) daysWithData++;
    }
    if (sleepDays > 0) week.avgSleep = `${(totalSleep / sleepDays).toFixed(1)}시간`;
    if (stepDays > 0) week.avgSteps = `${Math.round(totalSteps / stepDays).toLocaleString()}보`;
    if (waterDays > 0) week.avgWater = `${(totalWater / waterDays).toFixed(1)}잔`;
    if (calDays > 0) week.avgCalories = `${Math.round(totalCal / calDays)}kcal`;
    if (checkDays > 0) { week.avgEnergy = `${(totalEnergy / checkDays).toFixed(1)}/10`; week.avgMood = `${(totalMood / checkDays).toFixed(1)}/10`; }
    if (weights.length >= 2) { const diff = weights[0] - weights[weights.length - 1]; week.weightTrend = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}kg`; }
    week.daysWithData = daysWithData;
  } catch {}
  return week;
}

/* ── 취침시각 추정 ── */
function estimateBedtime() {
  try {
    const lastActive = localStorage.getItem('lua_last_active');
    if (!lastActive) return null;
    const lastTime = new Date(lastActive);
    const hour = lastTime.getHours();
    const minute = lastTime.getMinutes();
    const timeStr = `${hour}시 ${minute}분`;
    if (hour >= 0 && hour < 4) return { time: timeStr, quality: '매우 늦은 취침', late: true };
    if (hour >= 23) return { time: timeStr, quality: '다소 늦은 취침', late: true };
    if (hour >= 22) return { time: timeStr, quality: '적정 취침', late: false };
    return null;
  } catch { return null; }
}

/* ── 환경 데이터 수집 ── */
function gatherEnvData() {
  const now = new Date();
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const month = now.getMonth() + 1;
  const season = month >= 3 && month <= 5 ? '봄' : month >= 6 && month <= 8 ? '여름' : month >= 9 && month <= 11 ? '가을' : '겨울';
  const env = { dayOfWeek: days[now.getDay()], season };
  const bedtime = estimateBedtime();
  if (bedtime) env.estimatedBedtime = `어젯밤 마지막 활동 ${bedtime.time} (${bedtime.quality})`;
  try {
    const weather = getWeatherData();
    if (weather) {
      if (weather.condition) env.weather = weather.condition;
      if (weather.temperature != null) env.temperature = weather.temperature;
      if (weather.humidity != null) env.humidity = weather.humidity;
    }
  } catch {}
  return env;
}

/* ── 사용자 프로필 ── */
function getUserProfile() {
  try {
    const p = JSON.parse(localStorage.getItem('nou_profile') || '{}');
    return { skinType: p.skinType || null, skinConcern: p.skinConcern || null };
  } catch { return {}; }
}

export default function DailyInsightSlider() {
  const [insights, setInsights] = useState([]);
  const [confidence, setConfidence] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [todayRecords, setTodayRecords] = useState({ sleep: false, water: false, meal: false, skin: false });
  const scrollRef = useRef(null);

  const refreshRecords = useCallback(() => {
    setTodayRecords(checkTodayRecords());
  }, []);

  const unlockedCardIds = getUnlockedCards(todayRecords);

  const fetchInsight = useCallback((skipCache = false) => {
    const todayKey = getLocalDateKey(new Date());
    const records = checkTodayRecords();
    setTodayRecords(records);
    const unlocked = getUnlockedCards(records);
    const cacheKey = `lua_daily_insight_v4_${unlocked.sort().join(',')}`;

    if (!skipCache) {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (cached?.date === todayKey && cached.insights?.length > 0) {
          setInsights(cached.insights);
          setConfidence(cached.confidence || 1);
          return;
        }
      } catch {}
    }

    setLoading(true);
    const yesterday = gatherYesterdayData();
    const weekData = gatherWeekData();
    const env = gatherEnvData();
    const userProfile = getUserProfile();

    fetch('/api/condition-briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'daily-insight', yesterday, weekData, env, unlockedCards: unlocked, userProfile }),
    })
      .then(r => { if (!r.ok) { console.warn('[DailyInsight] API error:', r.status); return null; } return r.json(); })
      .then(data => {
        if (data?.insights?.length > 0) {
          setInsights(data.insights);
          setConfidence(data.confidence || 1);
          localStorage.setItem(cacheKey, JSON.stringify({ date: todayKey, insights: data.insights, confidence: data.confidence }));
        }
      })
      .catch(e => { console.warn('[DailyInsight] fetch error:', e); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchInsight(); }, [fetchInsight]);

  // 수면/기록 변경 시 자동 갱신
  useEffect(() => {
    const handler = () => fetchInsight(true);
    window.addEventListener('lua-sleep-updated', handler);
    window.addEventListener('lua-record-updated', handler);
    return () => {
      window.removeEventListener('lua-sleep-updated', handler);
      window.removeEventListener('lua-record-updated', handler);
    };
  }, [fetchInsight]);

  // 탭 전환 시 잠금 상태 갱신
  useEffect(() => {
    const handler = () => refreshRecords();
    window.addEventListener('focus', handler);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) handler(); });
    return () => window.removeEventListener('focus', handler);
  }, [refreshRecords]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    setActiveIdx(Math.round(scrollLeft / (clientWidth * 0.78)));
  };

  // 인사이트 매핑 (API 결과를 카드 ID로 매칭)
  const insightMap = {};
  insights.forEach(i => { insightMap[i.category] = i; });

  return (
    <div style={{ margin: '10px 18px 8px' }}>
      <style>{`
        .insight-scroll::-webkit-scrollbar { display: none; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* 헤더 */}
      <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>오늘의 인사이트</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {confidence > 0 && <ConfidenceDots level={confidence} />}
          <div
            onClick={() => !loading && fetchInsight(true)}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.04)', cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.4 : 0.6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted, #8B95A1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
              <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </div>
        </div>
      </div>

      {loading && insights.length === 0 ? (
        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', opacity: 0.6 }}>인사이트를 준비하고 있어요...</div>
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="insight-scroll"
            style={{
              display: 'flex', gap: 10, overflowX: 'auto',
              scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
              paddingBottom: 8, scrollbarWidth: 'none', msOverflowStyle: 'none',
            }}
          >
            {CARDS.map((card, i) => {
              const isUnlocked = unlockedCardIds.includes(card.id);
              const content = insightMap[card.id];

              return (
                <div key={card.id} style={{
                  minWidth: '78%', maxWidth: '78%', scrollSnapAlign: 'start',
                  background: 'var(--bg-card, rgba(255,255,255,0.04))',
                  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                  borderRadius: 20, padding: '18px 20px',
                  boxShadow: 'var(--shadow-elevated, none), inset 0 1px 1px rgba(255,255,255,0.05)',
                  opacity: isUnlocked ? 1 : 0.5,
                  position: 'relative',
                }}>
                  {/* 카드 헤더 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 20 }}>{card.emoji}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {content?.title || card.title}
                    </span>
                  </div>

                  {isUnlocked && content ? (
                    /* 잠금 해제 — 인사이트 표시 */
                    <div style={{
                      fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary, #4E5968)',
                      wordBreak: 'keep-all',
                    }}>
                      {content.body}
                    </div>
                  ) : isUnlocked && loading ? (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', opacity: 0.6 }}>
                      준비 중...
                    </div>
                  ) : !isUnlocked ? (
                    /* 잠금 상태 */
                    <div style={{ textAlign: 'center', padding: '12px 0' }}>
                      <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.4 }}>🔒</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {card.lockMsg}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* 도트 인디케이터 */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 8 }}>
            {CARDS.map((_, i) => (
              <div key={i} style={{
                width: activeIdx === i ? 16 : 5, height: 5, borderRadius: 99,
                background: activeIdx === i ? 'var(--accent-primary, #89cef5)' : 'rgba(0,0,0,0.1)',
                transition: 'all 0.3s ease',
              }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
