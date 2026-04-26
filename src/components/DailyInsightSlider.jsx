import { useState, useEffect, useRef } from 'react';
import { getTodayFoods, getTodayNutrition } from '../storage/FoodStorage';
import { getLatestRecord } from '../storage/SkinStorage';
import { getBodyRecords, getLatestWeight } from '../storage/BodyStorage';
import { getTodayChecks } from '../storage/ConditionStorage';

const CATEGORY_META = {
  condition: { emoji: '\u2600\uFE0F', label: '오늘의 컨디션' },
  mood:      { emoji: '\uD83D\uDE0A', label: '기분' },
  energy:    { emoji: '\uD83D\uDD0B', label: '에너지' },
  skin:      { emoji: '\u2728',       label: '피부' },
  tip:       { emoji: '\uD83C\uDF1F', label: '오늘의 팁' },
};

const CONFIDENCE_LABELS = [
  '',
  '데이터 거의 없음',
  '데이터 부족 · 일반적 흐름 기반',
  '데이터 보통 · 참고 수준',
  '데이터 충분 · 높은 신뢰도',
  '데이터 매우 충분 · 높은 신뢰도',
];

function ConfidenceDots({ level }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 3 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: i <= level ? 'var(--accent-primary, #89cef5)' : 'rgba(0,0,0,0.1)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-muted, #8B95A1)' }}>
        {CONFIDENCE_LABELS[level] || ''}
      </span>
    </div>
  );
}

function gatherYesterdayData() {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yKey = y.toISOString().slice(0, 10);

  const data = {};
  try {
    const records = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
    const dayRec = records[yKey] || {};

    // 식단
    const allFoods = JSON.parse(localStorage.getItem('lua_food_records') || '[]');
    const yFoods = allFoods.filter(f => f.date === yKey && !f.name?.startsWith('물 '));
    if (yFoods.length > 0) {
      const totalCal = yFoods.reduce((s, f) => s + (f.calories || 0), 0);
      const totalCarb = yFoods.reduce((s, f) => s + (f.carb || 0), 0);
      const totalProt = yFoods.reduce((s, f) => s + (f.protein || 0), 0);
      const totalFat = yFoods.reduce((s, f) => s + (f.fat || 0), 0);
      data.diet = yFoods.map(f => f.name).filter(Boolean).slice(0, 5).join(', ');
      data.calories = `${Math.round(totalCal)}kcal`;
      data.macros = `탄${Math.round(totalCarb)}g 단${Math.round(totalProt)}g 지${Math.round(totalFat)}g`;
    }

    // 수분
    if (dayRec.water?.cups > 0) data.water = `${dayRec.water.cups}잔`;

    // 걸음수
    if (dayRec.steps > 0) data.steps = `${dayRec.steps.toLocaleString()}보`;

    // 운동
    if (dayRec.exercise?.log && Object.keys(dayRec.exercise.log).length > 0) {
      data.exercise = Object.entries(dayRec.exercise.log).map(([n, m]) => `${n} ${m}분`).join(', ');
    }

    // 수면
    if (dayRec.sleep?.hours) data.sleep = `${dayRec.sleep.hours}시간${dayRec.sleep.quality ? ' (' + dayRec.sleep.quality + ')' : ''}`;

    // 체중
    const bodyRecs = getBodyRecords?.() || [];
    const yWeight = bodyRecs.find(r => r.date === yKey);
    if (yWeight) data.weight = `${yWeight.weight}kg`;

    // 혈당
    if (dayRec.bloodSugar?.value) data.bloodSugar = `${dayRec.bloodSugar.value}mg/dL`;

    // 컨디션 체크
    const allChecks = JSON.parse(localStorage.getItem('nou_condition_checks') || '[]');
    const yChecks = allChecks.filter(c => c.date === yKey);
    if (yChecks.length > 0) {
      const last = yChecks[yChecks.length - 1];
      const eLabels = ['', '매우 낮음', '낮음', '보통', '좋음', '활기참'];
      const mLabels = ['', '우울', '기분 다운', '평온', '좋음', '행복'];
      data.condition = `에너지 ${eLabels[last.energy] || last.energy}, 기분 ${mLabels[last.mood] || last.mood}`;
    }

    // 피부 분석
    const skinRecs = JSON.parse(localStorage.getItem('nou_records') || '[]');
    const ySkin = skinRecs.filter(r => r.date === yKey);
    if (ySkin.length > 0) {
      const s = ySkin[ySkin.length - 1];
      data.skin = `종합 ${s.overallScore}점, 수분 ${s.moisture}%, 피부결 ${s.textureScore}점`;
    }
  } catch (e) { /* ignore */ }

  return data;
}

function gatherWeekData() {
  const week = {};
  let daysWithData = 0;

  try {
    const records = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
    const allFoods = JSON.parse(localStorage.getItem('lua_food_records') || '[]');
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
      const key = d.toISOString().slice(0, 10);
      const dayRec = records[key] || {};
      let hasData = false;

      if (dayRec.sleep?.hours) { totalSleep += dayRec.sleep.hours; sleepDays++; hasData = true; }
      if (dayRec.steps > 0) { totalSteps += dayRec.steps; stepDays++; hasData = true; }
      if (dayRec.water?.cups > 0) { totalWater += dayRec.water.cups; waterDays++; hasData = true; }

      const dayFoods = allFoods.filter(f => f.date === key && !f.name?.startsWith('물 '));
      if (dayFoods.length > 0) {
        totalCal += dayFoods.reduce((s, f) => s + (f.calories || 0), 0);
        calDays++;
        hasData = true;
      }

      const dayChecks = allChecks.filter(c => c.date === key);
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
      const eLabels = ['', '매우 낮음', '낮음', '보통', '좋음', '활기참'];
      const mLabels = ['', '우울', '기분 다운', '평온', '좋음', '행복'];
      week.avgEnergy = eLabels[Math.round(totalEnergy / checkDays)] || `${(totalEnergy / checkDays).toFixed(1)}`;
      week.avgMood = mLabels[Math.round(totalMood / checkDays)] || `${(totalMood / checkDays).toFixed(1)}`;
    }
    if (weights.length >= 2) {
      const diff = weights[0] - weights[weights.length - 1];
      week.weightTrend = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}kg (7일)`;
    }

    week.daysWithData = daysWithData;
  } catch (e) { /* ignore */ }

  return week;
}

export default function DailyInsightSlider() {
  const [insights, setInsights] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    // 캐시 확인
    try {
      const cached = JSON.parse(localStorage.getItem('lua_daily_insight') || 'null');
      if (cached?.date === todayKey && cached.insights?.length > 0) {
        setInsights(cached.insights);
        setConfidence(cached.confidence || 1);
        return;
      }
    } catch { /* ignore */ }

    // API 호출
    setLoading(true);
    const yesterday = gatherYesterdayData();
    const weekData = gatherWeekData();

    fetch('/api/daily-insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yesterday, weekData }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.insights?.length > 0) {
          setInsights(data.insights);
          setConfidence(data.confidence || 1);
          localStorage.setItem('lua_daily_insight', JSON.stringify({
            date: todayKey, insights: data.insights, confidence: data.confidence,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    const idx = Math.round(scrollLeft / (clientWidth * 0.78));
    setActiveIdx(idx);
  };

  if (!insights && !loading) return null;

  return (
    <div style={{ margin: '12px 0 8px' }}>
      {/* Section title */}
      <div style={{ padding: '0 22px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
          오늘의 인사이트
        </div>
        {confidence > 0 && <ConfidenceDots level={confidence} />}
      </div>

      {loading ? (
        <div style={{ padding: '20px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', opacity: 0.6 }}>인사이트를 준비하고 있어요...</div>
        </div>
      ) : (
        <>
          {/* Horizontal scroll cards */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{
              display: 'flex', gap: 10, overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              paddingLeft: 22, paddingRight: 22, paddingBottom: 8,
              scrollbarWidth: 'none', msOverflowStyle: 'none',
            }}
          >
            <style>{`.insight-scroll::-webkit-scrollbar { display: none; }`}</style>
            {insights.map((item, i) => {
              const meta = CATEGORY_META[item.category] || { emoji: '\uD83D\uDCA1', label: item.category };
              return (
                <div key={i} className="insight-scroll" style={{
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

          {/* Dot indicators */}
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
