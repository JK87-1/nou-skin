import { useState, useEffect, useCallback } from 'react';
import { getBodyRecords } from '../storage/BodyStorage';
import { getWeatherData } from '../storage/WeatherStorage';

/* ── 로컬 날짜 키 ── */
function getLocalDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ── 오늘 + 최근 데이터 수집 ── */
function gatherData() {
  const todayKey = getLocalDateKey(new Date());
  const data = { today: {}, recent: { sleepDays: [], waterDays: [], stepDays: [], calDays: [], condDays: [] } };

  try {
    const records = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
    const allFoods = JSON.parse(localStorage.getItem('lua_food_records') || '{}');
    const allChecks = JSON.parse(localStorage.getItem('nou_condition_checks') || '[]');
    const wSettings = (() => { try { return { cupMl: 250, goalMl: 2000, ...JSON.parse(localStorage.getItem('lua_water_settings') || '{}') }; } catch { return { cupMl: 250, goalMl: 2000 }; } })();

    // 오늘 데이터
    const todayRec = records[todayKey] || {};
    data.today.sleep = todayRec.sleep?.hours || 0;
    data.today.sleepQuality = todayRec.sleep?.quality || null;
    data.today.sleepBedtime = todayRec.sleep?.bedtime || null;
    data.today.waterCups = todayRec.water?.cups || 0;
    data.today.waterGoalCups = Math.ceil(wSettings.goalMl / wSettings.cupMl);
    data.today.steps = todayRec.steps || 0;
    data.today.exerciseLog = todayRec.exercise?.log || {};
    const todayFoods = (allFoods[todayKey] || []).filter(f => !f.name?.startsWith('물 '));
    data.today.mealCount = todayFoods.length;
    data.today.calories = todayFoods.reduce((s, f) => s + (f.calories || f.kcal || 0), 0);

    const todayChecks = allChecks.filter(c => (c.date || c.timestamp?.slice(0, 10)) === todayKey);
    if (todayChecks.length > 0) {
      const last = todayChecks[todayChecks.length - 1];
      data.today.energy = last.energy || 5;
      data.today.mood = last.mood || 5;
      data.today.water = last.water || 5;
    }

    // 최근 7일
    for (let i = 1; i <= 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = getLocalDateKey(d);
      const dayRec = records[key] || {};
      if (dayRec.sleep?.hours) data.recent.sleepDays.push(dayRec.sleep.hours);
      if (dayRec.water?.cups > 0) data.recent.waterDays.push(dayRec.water.cups);
      if (dayRec.steps > 0) data.recent.stepDays.push(dayRec.steps);
      const dayFoods = (allFoods[key] || []).filter(f => !f.name?.startsWith('물 '));
      if (dayFoods.length > 0) data.recent.calDays.push(dayFoods.reduce((s, f) => s + (f.calories || f.kcal || 0), 0));
      const dayChecks = allChecks.filter(c => (c.date || c.timestamp?.slice(0, 10)) === key);
      if (dayChecks.length > 0) {
        const l = dayChecks[dayChecks.length - 1];
        data.recent.condDays.push({ energy: l.energy || 5, mood: l.mood || 5 });
      }
    }
  } catch {}

  return data;
}

/* ── 오늘의 상태 점수 계산 ── */
function calcStatus(data) {
  const { today, recent } = data;
  const indicators = [];

  // 에너지
  let energyScore = 50;
  let energyLabel = '보통';
  if (today.energy) {
    energyScore = today.energy * 10;
    energyLabel = today.energy >= 7 ? '좋음' : today.energy >= 4 ? '보통' : '낮음';
  } else if (today.sleep >= 7) {
    energyScore = 65;
    energyLabel = '보통';
  } else if (today.sleep > 0 && today.sleep < 5) {
    energyScore = 30;
    energyLabel = '낮음';
  }
  indicators.push({ key: 'energy', label: '에너지', icon: '⚡', score: energyScore, status: energyLabel });

  // 감정
  let moodScore = 50;
  let moodLabel = '보통';
  if (today.mood) {
    moodScore = today.mood * 10;
    moodLabel = today.mood >= 7 ? '좋음' : today.mood >= 4 ? '보통' : '낮음';
  }
  indicators.push({ key: 'mood', label: '감정', icon: '😊', score: moodScore, status: moodLabel });

  // 집중 (수면+에너지 기반 추정)
  let focusScore = 50;
  let focusLabel = '보통';
  const avgRecentSleep = recent.sleepDays.length > 0 ? recent.sleepDays.reduce((a, b) => a + b, 0) / recent.sleepDays.length : 0;
  if (today.sleep >= 7 && energyScore >= 60) { focusScore = 75; focusLabel = '좋음'; }
  else if (today.sleep < 5 || energyScore < 40) { focusScore = 30; focusLabel = '낮음'; }
  else if (avgRecentSleep > 0 && avgRecentSleep < 6) { focusScore = 40; focusLabel = '낮음'; }
  indicators.push({ key: 'focus', label: '집중', icon: '🎯', score: focusScore, status: focusLabel });

  // 몸 상태 (수분+활동+수면 기반)
  let bodyScore = 50;
  let bodyLabel = '보통';
  const waterPct = today.waterGoalCups > 0 ? today.waterCups / today.waterGoalCups : 0;
  const hasExercise = Object.keys(today.exerciseLog).length > 0 || today.steps > 3000;
  if (waterPct >= 0.7 && hasExercise && today.sleep >= 6) { bodyScore = 80; bodyLabel = '좋음'; }
  else if (waterPct < 0.3 && !hasExercise && today.sleep < 5) { bodyScore = 25; bodyLabel = '주의'; }
  else if (waterPct < 0.5 || today.sleep < 5) { bodyScore = 40; bodyLabel = '주의'; }
  indicators.push({ key: 'body', label: '몸', icon: '🫧', score: bodyScore, status: bodyLabel });

  const overall = Math.round(indicators.reduce((s, i) => s + i.score, 0) / indicators.length);
  let overallLabel = '좋은 상태';
  if (overall >= 70) overallLabel = '좋은 상태';
  else if (overall >= 50) overallLabel = '보통';
  else if (overall >= 35) overallLabel = '회복 필요';
  else overallLabel = '관리 필요';

  return { overall, overallLabel, indicators };
}

/* ── 상태에 영향을 준 요소 계산 ── */
function calcFactors(data) {
  const { today, recent } = data;
  const factors = [];

  // 수면
  let sleepPct = 0, sleepLabel = '미입력';
  if (today.sleep > 0) {
    sleepPct = Math.min(today.sleep / 8, 1);
    sleepLabel = today.sleep >= 7 ? '충분' : today.sleep >= 5 ? '보통' : '부족';
  } else if (recent.sleepDays.length > 0) {
    const avg = recent.sleepDays.reduce((a, b) => a + b, 0) / recent.sleepDays.length;
    sleepPct = Math.min(avg / 8, 1);
    sleepLabel = avg >= 7 ? '충분' : avg >= 5 ? '보통' : '부족';
  }
  factors.push({ key: 'sleep', label: '수면', icon: '🌙', pct: sleepPct, status: sleepLabel, color: '#5B6AAF' });

  // 식사
  let mealPct = 0, mealLabel = '미입력';
  if (today.mealCount > 0) {
    mealPct = Math.min(today.mealCount / 3, 1);
    mealLabel = today.mealCount >= 3 ? '규칙적' : today.mealCount === 2 ? '보통' : '불규칙';
  }
  factors.push({ key: 'meal', label: '식사', icon: '🍎', pct: mealPct, status: mealLabel, color: '#C4885B' });

  // 활동
  let actPct = 0, actLabel = '미입력';
  const exMins = Object.values(today.exerciseLog).reduce((s, m) => s + m, 0);
  if (today.steps > 0 || exMins > 0) {
    const stepScore = Math.min(today.steps / 8000, 1) * 0.5;
    const exScore = Math.min(exMins / 30, 1) * 0.5;
    actPct = stepScore + exScore;
    actLabel = actPct >= 0.6 ? '활발' : actPct >= 0.3 ? '보통' : '부족';
  }
  factors.push({ key: 'activity', label: '활동', icon: '🔥', pct: actPct, status: actLabel, color: '#C4580A' });

  // 수분
  let waterPct = 0, waterLabel = '미입력';
  if (today.waterCups > 0) {
    waterPct = Math.min(today.waterCups / today.waterGoalCups, 1);
    waterLabel = waterPct >= 0.8 ? '충분' : waterPct >= 0.5 ? '보통' : '부족';
  }
  factors.push({ key: 'water', label: '수분', icon: '💧', pct: waterPct, status: waterLabel, color: '#2D8E6E' });

  return factors;
}

/* ── 어제 + 주간 데이터 (AI 인사이트용) ── */
function gatherYesterdayData() {
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yKey = getLocalDateKey(y);
  const data = {};
  try {
    const records = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
    const dayRec = records[yKey] || {};
    const allFoods = JSON.parse(localStorage.getItem('lua_food_records') || '{}');
    const yFoods = (allFoods[yKey] || []).filter(f => !f.name?.startsWith('물 '));
    if (yFoods.length > 0) {
      data.diet = yFoods.map(f => f.name).filter(Boolean).slice(0, 5).join(', ');
      data.calories = `${Math.round(yFoods.reduce((s, f) => s + (f.calories || f.kcal || 0), 0))}kcal`;
      data.macros = `탄${Math.round(yFoods.reduce((s, f) => s + (f.carb || 0), 0))}g 단${Math.round(yFoods.reduce((s, f) => s + (f.protein || 0), 0))}g 지${Math.round(yFoods.reduce((s, f) => s + (f.fat || 0), 0))}g`;
    }
    if (dayRec.water?.cups > 0) data.water = `${dayRec.water.cups}잔`;
    if (dayRec.steps > 0) data.steps = `${dayRec.steps.toLocaleString()}보`;
    if (dayRec.exercise?.log && Object.keys(dayRec.exercise.log).length > 0) data.exercise = Object.entries(dayRec.exercise.log).map(([n, m]) => `${n} ${m}분`).join(', ');
    if (dayRec.sleep?.hours) data.sleep = `${dayRec.sleep.hours}시간${dayRec.sleep.quality ? ' (' + dayRec.sleep.quality + ')' : ''}`;
    if (!data.sleep) {
      const todayKey = getLocalDateKey(new Date());
      const todayRec = records[todayKey] || {};
      if (todayRec.sleep?.hours) data.sleep = `${todayRec.sleep.hours}시간${todayRec.sleep.quality ? ' (' + todayRec.sleep.quality + ')' : ''}`;
    }
    const allChecks = JSON.parse(localStorage.getItem('nou_condition_checks') || '[]');
    const yChecks = allChecks.filter(c => (c.date || c.timestamp?.slice(0, 10)) === yKey);
    if (yChecks.length > 0) {
      const last = yChecks[yChecks.length - 1];
      const eLabels = ['', '매우 낮음', '낮음', '약간 낮음', '조금 부족', '보통', '괜찮음', '좋음', '활발', '높음', '활기참'];
      const mLabels = ['', '우울', '기분 다운', '침울', '약간 다운', '평온', '무난', '좋음', '기분 좋음', '매우 좋음', '행복'];
      data.condition = `에너지 ${eLabels[last.energy] || last.energy}, 기분 ${mLabels[last.mood] || last.mood}`;
    }
  } catch {}
  return data;
}

function gatherWeekData() {
  const week = {};
  try {
    const records = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
    const allFoods = JSON.parse(localStorage.getItem('lua_food_records') || '{}');
    const allChecks = JSON.parse(localStorage.getItem('nou_condition_checks') || '[]');
    let totalSleep = 0, sleepDays = 0, totalSteps = 0, stepDays = 0;
    let totalWater = 0, waterDays = 0, totalCal = 0, calDays = 0;
    let totalEnergy = 0, totalMood = 0, checkDays = 0;
    for (let i = 1; i <= 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = getLocalDateKey(d);
      const dayRec = records[key] || {};
      if (dayRec.sleep?.hours) { totalSleep += dayRec.sleep.hours; sleepDays++; }
      if (dayRec.steps > 0) { totalSteps += dayRec.steps; stepDays++; }
      if (dayRec.water?.cups > 0) { totalWater += dayRec.water.cups; waterDays++; }
      const dayFoods = (allFoods[key] || []).filter(f => !f.name?.startsWith('물 '));
      if (dayFoods.length > 0) { totalCal += dayFoods.reduce((s, f) => s + (f.calories || f.kcal || 0), 0); calDays++; }
      const dayChecks = allChecks.filter(c => (c.date || c.timestamp?.slice(0, 10)) === key);
      if (dayChecks.length > 0) { const l = dayChecks[dayChecks.length - 1]; totalEnergy += l.energy || 3; totalMood += l.mood || 3; checkDays++; }
    }
    if (sleepDays > 0) week.avgSleep = `${(totalSleep / sleepDays).toFixed(1)}시간`;
    if (stepDays > 0) week.avgSteps = `${Math.round(totalSteps / stepDays).toLocaleString()}보`;
    if (waterDays > 0) week.avgWater = `${(totalWater / waterDays).toFixed(1)}잔`;
    if (calDays > 0) week.avgCalories = `${Math.round(totalCal / calDays)}kcal`;
    if (checkDays > 0) { week.avgEnergy = `${(totalEnergy / checkDays).toFixed(1)}/10`; week.avgMood = `${(totalMood / checkDays).toFixed(1)}/10`; }
  } catch {}
  return week;
}

function gatherEnvData() {
  const now = new Date();
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const month = now.getMonth() + 1;
  const season = month >= 3 && month <= 5 ? '봄' : month >= 6 && month <= 8 ? '여름' : month >= 9 && month <= 11 ? '가을' : '겨울';
  const env = { dayOfWeek: days[now.getDay()], season };
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

/* ── 카드 스타일 ── */
const cardStyle = {
  background: 'rgba(255,255,255,0.2)',
  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: 30, padding: '20px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
};

export default function DailyInsightSlider() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(gatherData);

  const refreshData = useCallback(() => setData(gatherData()), []);

  const fetchInsight = useCallback((skipCache = false) => {
    const todayKey = getLocalDateKey(new Date());
    const cacheKey = 'lua_daily_insight_v6';

    if (!skipCache) {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (cached?.date === todayKey && cached.insights?.length > 0) {
          setInsights(cached.insights);
          return;
        }
      } catch {}
    }

    setLoading(true);
    const yesterday = gatherYesterdayData();
    const weekData = gatherWeekData();
    const env = gatherEnvData();

    fetch('/api/condition-briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'daily-insight-v2',
        yesterday, weekData, env,
        instructions: '사용자의 최근 데이터를 분석해서 오늘의 인사이트 3개를 JSON 배열로 반환해주세요. 각 인사이트는 한 문장으로, 원인→결과 패턴으로 작성해주세요. 예: "최근 3일 수면 부족이 집중력 저하로 이어졌어요". 형식: { "insights": ["문장1","문장2","문장3"] }',
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(res => {
        let parsed = [];
        if (res?.insights && Array.isArray(res.insights)) {
          parsed = res.insights.slice(0, 3);
        } else if (res?.briefing) {
          parsed = res.briefing.split(/\n+/).filter(l => l.trim()).slice(0, 3);
        }
        if (parsed.length > 0) {
          setInsights(parsed);
          localStorage.setItem(cacheKey, JSON.stringify({ date: todayKey, insights: parsed }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchInsight(); }, [fetchInsight]);

  useEffect(() => {
    const handler = () => { refreshData(); fetchInsight(true); };
    window.addEventListener('lua-sleep-updated', handler);
    window.addEventListener('lua-record-updated', handler);
    const visHandler = () => { if (!document.hidden) refreshData(); };
    document.addEventListener('visibilitychange', visHandler);
    return () => {
      window.removeEventListener('lua-sleep-updated', handler);
      window.removeEventListener('lua-record-updated', handler);
      document.removeEventListener('visibilitychange', visHandler);
    };
  }, [fetchInsight, refreshData]);

  // localStorage 변경 감지
  useEffect(() => {
    const WATCH = ['lua_record_v2', 'lua_food_records', 'nou_condition_checks'];
    const origSetItem = localStorage.setItem.bind(localStorage);
    let timer = null;
    localStorage.setItem = function(key, value) {
      origSetItem(key, value);
      if (WATCH.includes(key)) { clearTimeout(timer); timer = setTimeout(refreshData, 500); }
    };
    return () => { localStorage.setItem = origSetItem; clearTimeout(timer); };
  }, [refreshData]);

  const status = calcStatus(data);
  const factors = calcFactors(data);

  const statusColor = status.overall >= 70 ? '#22C55E' : status.overall >= 50 ? '#89cef5' : status.overall >= 35 ? '#E8A135' : '#E05050';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '0 18px 16px' }}>

      {/* ===== 1. 오늘의 상태 ===== */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <span style={{ fontSize: 16 }}>✨</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>오늘의 상태</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 48, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>{status.overall}</span>
            <span style={{ fontSize: 16, color: 'rgba(0,0,0,0.25)', fontWeight: 500 }}>/100</span>
          </div>
          <div style={{
            padding: '5px 14px', borderRadius: 20,
            background: `${statusColor}14`, border: `1px solid ${statusColor}30`,
            fontSize: 12, fontWeight: 600, color: statusColor,
          }}>{status.overallLabel}</div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {status.indicators.map(ind => {
            const indColor = ind.score >= 60 ? '#22C55E' : ind.score >= 40 ? '#E8A135' : '#E05050';
            return (
              <div key={ind.key} style={{
                flex: 1, textAlign: 'center', padding: '12px 0 10px',
                background: 'rgba(0,0,0,0.02)', borderRadius: 14,
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{ind.icon}</div>
                <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', marginBottom: 3 }}>{ind.label}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: indColor }}>{ind.status}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== 2. 오늘의 인사이트 ===== */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🔍</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>오늘의 인사이트</span>
          </div>
          <div
            onClick={() => !loading && fetchInsight(true)}
            style={{
              width: 26, height: 26, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.04)', cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.4 : 0.5,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted, #8B95A1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
              <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </div>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

        {loading && insights.length === 0 ? (
          <div style={{ padding: '8px 0', fontSize: 13, color: 'rgba(0,0,0,0.3)' }}>인사이트를 준비하고 있어요...</div>
        ) : insights.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {insights.map((text, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(0,0,0,0.15)', minWidth: 22, fontFamily: 'var(--font-display)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.6, wordBreak: 'keep-all' }}>
                  {text}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '8px 0', fontSize: 13, color: 'rgba(0,0,0,0.3)', lineHeight: 1.6 }}>
            기록을 추가하면 AI가 패턴을 분석해드려요
          </div>
        )}
      </div>

      {/* ===== 3. 상태에 영향을 준 요소 ===== */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <span style={{ fontSize: 16 }}>📊</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>상태에 영향을 준 요소</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {factors.map(f => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{f.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', width: 36 }}>{f.label}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  width: `${Math.max(f.pct * 100, f.pct > 0 ? 8 : 0)}%`,
                  background: f.color,
                  opacity: 0.7,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, minWidth: 42, textAlign: 'right',
                color: f.status === '미입력' ? 'rgba(0,0,0,0.2)' : f.pct >= 0.6 ? '#22C55E' : f.pct >= 0.3 ? 'rgba(0,0,0,0.4)' : '#E05050',
              }}>{f.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
