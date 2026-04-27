import { useState, useEffect, useCallback, useRef } from 'react';
import { getBodyRecords } from '../storage/BodyStorage';
import { getWeatherData } from '../storage/WeatherStorage';

const CATEGORY_META = {
  condition: { emoji: '\u2600\uFE0F', label: '컨디션 예측' },
  mood:      { emoji: '\uD83D\uDE0A', label: '기분 상태' },
  energy:    { emoji: '\uD83D\uDD0B', label: '에너지 수준' },
  skin:      { emoji: '\u2728',       label: '피부 관리' },
  tip:       { emoji: '\uD83C\uDF1F', label: '하루 한 가지 실천' },
};

/* ── 신뢰도 점 (라벨 없이 점만) ── */
function ConfidenceDots({ level }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: i <= level ? 'var(--accent-primary, #89cef5)' : 'rgba(0,0,0,0.1)',
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  );
}

/* ── 로컬(KST) 날짜 키 생성 ── */
function getLocalDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

    // 식단 (lua_food_records는 { "날짜": [기록들] } 객체 형태)
    const allFoods = JSON.parse(localStorage.getItem('lua_food_records') || '{}');
    const yFoods = (allFoods[yKey] || []).filter(f => !f.name?.startsWith('물 '));
    if (yFoods.length > 0) {
      const totalCal = yFoods.reduce((s, f) => s + (f.calories || f.kcal || 0), 0);
      const totalCarb = yFoods.reduce((s, f) => s + (f.carb || 0), 0);
      const totalProt = yFoods.reduce((s, f) => s + (f.protein || 0), 0);
      const totalFat = yFoods.reduce((s, f) => s + (f.fat || 0), 0);
      data.diet = yFoods.map(f => f.name).filter(Boolean).slice(0, 5).join(', ');
      data.calories = `${Math.round(totalCal)}kcal`;
      data.macros = `탄${Math.round(totalCarb)}g 단${Math.round(totalProt)}g 지${Math.round(totalFat)}g`;
    }

    if (dayRec.water?.cups > 0) data.water = `${dayRec.water.cups}잔`;
    if (dayRec.steps > 0) data.steps = `${dayRec.steps.toLocaleString()}보`;
    if (dayRec.exercise?.log && Object.keys(dayRec.exercise.log).length > 0) {
      data.exercise = Object.entries(dayRec.exercise.log).map(([n, m]) => `${n} ${m}분`).join(', ');
    }
    if (dayRec.sleep?.hours) data.sleep = `${dayRec.sleep.hours}시간${dayRec.sleep.quality ? ' (' + dayRec.sleep.quality + ')' : ''}`;

    const bodyRecs = getBodyRecords?.() || [];
    const yWeight = bodyRecs.find(r => r.date === yKey);
    if (yWeight) data.weight = `${yWeight.weight}kg`;

    if (dayRec.bloodSugar?.value) data.bloodSugar = `${dayRec.bloodSugar.value}mg/dL`;

    // 컨디션 체크
    const allChecks = JSON.parse(localStorage.getItem('nou_condition_checks') || '[]');
    const yChecks = allChecks.filter(c => {
      const cDate = c.date || (c.timestamp ? c.timestamp.slice(0, 10) : '');
      return cDate === yKey;
    });
    if (yChecks.length > 0) {
      const last = yChecks[yChecks.length - 1];
      const eLabels = ['', '매우 낮음', '낮음', '약간 낮음', '조금 부족', '보통', '괜찮음', '좋음', '활발', '높음', '활기참'];
      const mLabels = ['', '우울', '기분 다운', '침울', '약간 다운', '평온', '무난', '좋음', '기분 좋음', '매우 좋음', '행복'];
      data.condition = `에너지 ${eLabels[last.energy] || last.energy}, 기분 ${mLabels[last.mood] || last.mood}`;
    }

    // 피부 분석
    const skinRecs = JSON.parse(localStorage.getItem('nou_records') || '[]');
    const ySkin = skinRecs.filter(r => r.date === yKey);
    if (ySkin.length > 0) {
      const s = ySkin[ySkin.length - 1];
      data.skin = `종합 ${s.overallScore}점, 수분 ${s.moisture}%, 피부결 ${s.textureScore}점`;
    }
  } catch (e) {
    console.warn('[DailyInsight] gatherYesterdayData error:', e);
  }

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

    let totalSleep = 0, sleepDays = 0;
    let totalSteps = 0, stepDays = 0;
    let totalWater = 0, waterDays = 0;
    let totalCal = 0, calDays = 0;
    let totalEnergy = 0, totalMood = 0, checkDays = 0;
    const weights = [];

    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = getLocalDateKey(d);
      const dayRec = records[key] || {};
      let hasData = false;

      if (dayRec.sleep?.hours) { totalSleep += dayRec.sleep.hours; sleepDays++; hasData = true; }
      if (dayRec.steps > 0) { totalSteps += dayRec.steps; stepDays++; hasData = true; }
      if (dayRec.water?.cups > 0) { totalWater += dayRec.water.cups; waterDays++; hasData = true; }

      const dayFoods = (allFoods[key] || []).filter(f => !f.name?.startsWith('물 '));
      if (dayFoods.length > 0) {
        totalCal += dayFoods.reduce((s, f) => s + (f.calories || f.kcal || 0), 0);
        calDays++;
        hasData = true;
      }

      const dayChecks = allChecks.filter(c => {
        const cDate = c.date || (c.timestamp ? c.timestamp.slice(0, 10) : '');
        return cDate === key;
      });
      if (dayChecks.length > 0) {
        const last = dayChecks[dayChecks.length - 1];
        totalEnergy += last.energy || 3;
        totalMood += last.mood || 3;
        checkDays++;
        hasData = true;
      }

      const w = bodyRecs.find(r => r.date === key);
      if (w) { weights.push(w.weight); hasData = true; }

      if (hasData) daysWithData++;
    }

    if (sleepDays > 0) week.avgSleep = `${(totalSleep / sleepDays).toFixed(1)}시간`;
    if (stepDays > 0) week.avgSteps = `${Math.round(totalSteps / stepDays).toLocaleString()}보`;
    if (waterDays > 0) week.avgWater = `${(totalWater / waterDays).toFixed(1)}잔`;
    if (calDays > 0) week.avgCalories = `${Math.round(totalCal / calDays)}kcal`;
    if (checkDays > 0) {
      week.avgEnergy = `${(totalEnergy / checkDays).toFixed(1)}/10`;
      week.avgMood = `${(totalMood / checkDays).toFixed(1)}/10`;
    }
    if (weights.length >= 2) {
      const diff = weights[0] - weights[weights.length - 1];
      week.weightTrend = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}kg (7일)`;
    }
    week.daysWithData = daysWithData;
  } catch { /* ignore */ }

  return week;
}

/* ── 환경 데이터 수집 (날씨·요일·계절) ── */
function gatherEnvData() {
  const now = new Date();
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const month = now.getMonth() + 1;
  const season = month >= 3 && month <= 5 ? '봄' : month >= 6 && month <= 8 ? '여름' : month >= 9 && month <= 11 ? '가을' : '겨울';

  const env = {
    dayOfWeek: days[now.getDay()],
    season,
  };

  try {
    const weather = getWeatherData();
    if (weather) {
      if (weather.condition) env.weather = weather.condition;
      if (weather.temperature != null) env.temperature = weather.temperature;
      if (weather.humidity != null) env.humidity = weather.humidity;
    }
  } catch { /* ignore */ }

  return env;
}

export default function DailyInsightSlider() {
  const [insights, setInsights] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef(null);

  const fetchInsight = useCallback((skipCache = false) => {
    const todayKey = getLocalDateKey(new Date());

    if (!skipCache) {
      try {
        const cached = JSON.parse(localStorage.getItem('lua_daily_insight_v3') || 'null');
        if (cached?.date === todayKey && cached.insights?.length > 0) {
          setInsights(cached.insights);
          setConfidence(cached.confidence || 1);
          return;
        }
      } catch { /* ignore */ }
    }

    setLoading(true);
    const yesterday = gatherYesterdayData();
    const weekData = gatherWeekData();
    const env = gatherEnvData();

    fetch('/api/condition-briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'daily-insight', yesterday, weekData, env }),
    })
      .then(r => {
        if (!r.ok) { console.warn('[DailyInsight] API error:', r.status); return null; }
        return r.json();
      })
      .then(data => {
        if (data?.insights?.length > 0) {
          setInsights(data.insights);
          setConfidence(data.confidence || 1);
          localStorage.setItem('lua_daily_insight_v3', JSON.stringify({
            date: todayKey, insights: data.insights, confidence: data.confidence,
          }));
        } else {
          console.warn('[DailyInsight] No insights in response:', data);
        }
      })
      .catch(e => { console.warn('[DailyInsight] fetch error:', e); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchInsight(); }, [fetchInsight]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    const idx = Math.round(scrollLeft / (clientWidth * 0.78));
    setActiveIdx(idx);
  };

  if (!insights && !loading) return null;

  return (
    <div style={{ margin: '12px 0 8px' }}>
      <style>{`
        .insight-scroll::-webkit-scrollbar { display: none; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* 섹션 헤더 */}
      <div style={{ padding: '0 22px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
          오늘의 인사이트
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {confidence > 0 && <ConfidenceDots level={confidence} />}
          <div
            onClick={() => !loading && fetchInsight(true)}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.04)',
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.4 : 0.6,
              transition: 'opacity 0.2s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted, #8B95A1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '20px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', opacity: 0.6 }}>인사이트를 준비하고 있어요...</div>
        </div>
      ) : (
        <>
          {/* 가로 스크롤 카드 */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="insight-scroll"
            style={{
              display: 'flex', gap: 10, overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              paddingLeft: 22, paddingRight: 22, paddingBottom: 8,
              scrollbarWidth: 'none', msOverflowStyle: 'none',
            }}
          >
            {insights.map((item, i) => {
              const meta = CATEGORY_META[item.category] || { emoji: '\uD83D\uDCA1', label: item.category };
              return (
                <div key={i} style={{
                  minWidth: '78%', maxWidth: '78%',
                  scrollSnapAlign: 'start',
                  background: 'var(--bg-card, rgba(255,255,255,0.04))',
                  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                  borderRadius: 20, padding: '18px 20px',
                  boxShadow: 'var(--shadow-elevated, none), inset 0 1px 1px rgba(255,255,255,0.05)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 20 }}>{meta.emoji}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.title || meta.label}</span>
                  </div>
                  <div style={{
                    fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary, #4E5968)',
                    wordBreak: 'keep-all',
                  }}>
                    {item.body}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 도트 인디케이터 */}
          {insights.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 8 }}>
              {insights.map((_, i) => (
                <div key={i} style={{
                  width: activeIdx === i ? 16 : 5,
                  height: 5,
                  borderRadius: 99,
                  background: activeIdx === i ? 'var(--accent-primary, #89cef5)' : 'rgba(0,0,0,0.1)',
                  transition: 'all 0.3s ease',
                }} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
