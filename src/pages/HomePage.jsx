import { useState, useEffect, useMemo } from 'react';
import SkinWeather from '../components/SkinWeather';
import { getLatestRecord } from '../storage/SkinStorage';
import { getProfile, saveProfile, SKIN_TYPES, SKIN_CONCERNS, GENDER_OPTIONS, getCategoryColor } from '../storage/ProfileStorage';
import { getTodayNutrition, getTodayFoods, getFoodGoal, saveFoodRecord } from '../storage/FoodStorage';
import { AddFoodModal } from './RecordPage';
import { getWeatherData } from '../storage/WeatherStorage';
import { getTodayProgress } from '../storage/RoutineCheckStorage';
import { getLatestWeight, getBodyRecords, saveBodyRecord } from '../storage/BodyStorage';
import {
  getTodayChecks, getLatestCheck, saveConditionCheck,
  shouldResetCheck, getMinutesSinceLastCheck,
  getTodayBloodSugar,
} from '../storage/ConditionStorage';
import { getSupplementItems, getSupplementChecks } from '../storage/SupplementStorage';

function getGreeting() {
  const h = new Date().getHours();
  const greets = [
    { from:5,  to:7,  main:'이른 아침,\n몸이 깨어나는 시간이에요',           sub:'오늘 에너지를 어떻게 시작할지 정해봐요' },
    { from:7,  to:9,  main:'좋은 아침이에요\n오늘 컨디션은 어때요?',          sub:'하루의 첫 체크가 하루를 바꿔줘요' },
    { from:9,  to:11, main:'오전 집중력이\n가장 높은 시간이에요',             sub:'지금 에너지 상태를 기록해봐요' },
    { from:11, to:13, main:'점심 전,\n에너지가 떨어질 수 있어요',             sub:'식사 전 컨디션을 체크해봐요' },
    { from:13, to:15, main:'식사 후 몸이\n어떻게 반응하고 있나요?',           sub:'식단이 에너지에 미치는 영향을 확인해봐요' },
    { from:15, to:17, main:'오후 슬럼프\n느껴지고 있나요?',                   sub:'지금 컨디션을 기록하면 패턴이 보여요' },
    { from:17, to:19, main:'하루 에너지의\n마무리 시간이에요',                sub:'오늘 컨디션 변화를 돌아봐요' },
    { from:19, to:21, main:'저녁 시간,\n몸의 긴장이 풀리나요?',              sub:'식사 후 기분과 에너지를 체크해봐요' },
    { from:21, to:23, main:'오늘 하루\n몸이 수고했어요',                      sub:'마지막 컨디션을 기록하고 마무리해봐요' },
    { from:23, to:29, main:'좋은 수면이\n내일의 에너지를 만들어요',           sub:'오늘 컨디션 기록을 완성해봐요' },
  ];
  return greets.find(g => h >= g.from && h < g.to) || greets[greets.length - 1];
}

const ENERGY_LABELS = ['매우 낮음', '낮음', '약간 낮음', '조금 부족', '보통', '괜찮음', '좋음', '활발', '높음', '활기참'];
const MOOD_LABELS = ['우울', '기분 다운', '침울', '약간 다운', '평온', '무난', '좋음', '기분 좋음', '매우 좋음', '행복'];
const WATER_LABELS = ['갈증', '많이 부족', '부족', '약간 부족', '보통', '괜찮음', '적당', '충분', '넉넉', '매우 충분'];

const STATUS_MAP = {
  1: { text: '저하', bg: 'rgba(255,143,171,.1)', color: '#C2185B' },
  2: { text: '약간 저하', bg: 'rgba(255,179,71,.1)', color: '#C4580A' },
  3: { text: '보통', bg: 'rgba(255,243,176,.4)', color: '#8A6A00' },
  4: { text: '안정', bg: 'rgba(78,184,160,.1)', color: '#0F6E56' },
  5: { text: '매우 안정', bg: 'rgba(78,184,160,.1)', color: '#0F6E56' },
};

const HERO_GRAD = {
  high: 'linear-gradient(160deg, #B8F0E0, #6ECFB8, #4DB8A0)',
  mid: 'linear-gradient(160deg, #FFF9E0, #FFE8C0, #FFD1A1)',
  low: 'linear-gradient(160deg, #FFE8D0, #FFD1A1, #FF8FAB)',
};

function getTier(energy, mood) {
  const avg = (energy + mood) / 2;
  if (avg >= 7) return 'high';
  if (avg >= 4) return 'mid';
  return 'low';
}

const TIER_STATUS = {
  high: '에너지 안정 상태, 집중 유지 가능',
  mid: '보통 상태, 가벼운 식사 추천',
  low: '에너지 저하, 식단 영향 가능성',
};

const TIER_INSIGHT = {
  high: { flow: ['균형 식단', '에너지 충전', '집중력 유지'], desc: '지금 상태가 좋아요. 규칙적인 식사 타이밍이 이 흐름을 유지하는 핵심이에요.' },
  mid: { flow: ['탄수화물 식사', '2시간 후', '졸림 가능성'], desc: '점심 이후 혈당 변화로 에너지가 출렁일 수 있어요. 단백질 간식이 도움이 돼요.' },
  low: { flow: ['불규칙 식사', '혈당 저하', '에너지·기분 영향'], desc: '식사 패턴이 에너지와 기분에 영향을 주고 있을 수 있어요. 지금 가볍게 드세요.' },
};

const TIER_CTA = {
  high: '지금 식단 기록하기',
  mid: '가벼운 단백질 간식 추천',
  low: '지금 바로 식단 기록하기',
};

// ===== AI 인사이트 생성 (로컬) =====
function generateInsight(check, skinResult, nutrition, weather) {
  const e = check?.energy || 7, s = check?.skin || 7, m = check?.mood || 7, g = check?.gut || 7;
  const avg = (e + s + m + g) / 4;

  // 인과관계 흐름 생성
  const flows = [];
  const descs = [];

  if (e <= 4 && g <= 4) {
    flows.push({ flow: ['장 불편', '영양 흡수 저하', '피로 + 피부 예민'], desc: '장 컨디션이 에너지와 피부에 영향을 줄 수 있어요' });
  }
  if (e <= 4 && nutrition?.kcal > 800) {
    flows.push({ flow: ['식후 혈당 변화', '에너지 저하', '집중력 감소'], desc: '식사 후 혈당 변화가 피로감의 원인일 수 있어요' });
  }
  if (s <= 4 && weather?.humidity < 40) {
    flows.push({ flow: ['낮은 습도', '수분 증발', '피부 예민'], desc: '건조한 환경이 피부 컨디션에 영향을 줘요' });
  }
  if (s <= 4 && skinResult?.moisture < 50) {
    flows.push({ flow: ['수분 부족', '피부 장벽 약화', '피부 예민'], desc: '피부 수분도가 낮아 예민해질 수 있어요' });
  }
  if (m <= 4 && e <= 4) {
    flows.push({ flow: ['수면 부족', '피로 누적', '기분 저하'], desc: '충분한 휴식이 기분 회복에 도움이 돼요' });
  }
  if (e >= 7 && s >= 7) {
    flows.push({ flow: ['충분한 휴식', '좋은 컨디션', '피부 회복'], desc: '현재 컨디션이 좋아서 피부도 안정적이에요' });
  }

  if (flows.length === 0) {
    if (avg >= 6) {
      flows.push({ flow: ['균형 잡힌 생활', '안정적 컨디션', '좋은 상태 유지'], desc: '전반적으로 균형 잡힌 상태예요' });
    } else {
      flows.push({ flow: ['컨디션 변화 감지', '원인 분석 중', '맞춤 케어 필요'], desc: '데이터를 더 모으면 정확한 분석이 가능해요' });
    }
  }

  return flows[0];
}

function generateHeroStatus(check) {
  if (!check) return { status: '오늘 컨디션을 체크해보세요', sub: '체크하면 AI가 원인을 분석해드려요' };
  const e = check.energy, s = check.skin, m = check.mood, g = check.gut;
  const avg = (e + s + m + g) / 4;

  const lowItems = [];
  if (e <= 4) lowItems.push('피로');
  if (s <= 4) lowItems.push('피부 예민');
  if (m <= 4) lowItems.push('기분 저하');
  if (g <= 4) lowItems.push('장 불편');

  const highItems = [];
  if (e >= 7) highItems.push('에너지 좋음');
  if (s >= 7) highItems.push('피부 좋음');
  if (m >= 7) highItems.push('기분 좋음');
  if (g >= 7) highItems.push('장 상태 좋음');

  let status, sub;
  if (avg >= 7) {
    status = '오늘 컨디션이 아주 좋아요';
    sub = highItems.slice(0, 2).join(' · ');
  } else if (avg >= 5) {
    status = '오늘 전반적으로 괜찮아요';
    sub = lowItems.length > 0 ? `${lowItems[0]}만 좀 신경 쓰면 돼요` : '무난한 하루를 보내고 있어요';
  } else {
    status = lowItems.length > 0 ? `지금 ${lowItems.slice(0, 2).join(' · ')} 느껴져요` : '컨디션이 좀 낮아요';
    sub = '원인을 분석해서 케어 방법을 알려드릴게요';
  }
  return { status, sub };
}

function generateAction(check) {
  if (!check) return '지금 → 컨디션 체크 시작 →';
  const e = check.energy, s = check.skin, g = check.gut;

  if (e <= 4 && g <= 4) return '지금 → 따뜻한 물 + 가벼운 산책 →';
  if (e <= 4) return '지금 → 10분 스트레칭 추천 →';
  if (s <= 4) return '지금 → 물 한 잔 + 수분크림 →';
  if (g <= 4) return '지금 → 따뜻한 차 한 잔 →';
  if (check.mood <= 4) return '지금 → 5분 심호흡 추천 →';
  return '지금 → 현재 루틴 유지 추천 →';
}

export default function HomePage({ onMeasure, onTabChange, onOpenRoutine }) {
  const [profile] = useState(getProfile);
  const latest = getLatestRecord();
  const weather = getWeatherData();
  const nutrition = getTodayNutrition();
  const skinRoutine = getTodayProgress('skin');
  const foodRoutine = getTodayProgress('food');
  const bodyRoutine = getTodayProgress('body');
  const totalRoutine = skinRoutine.total + foodRoutine.total + bodyRoutine.total;
  const doneRoutine = skinRoutine.done + foodRoutine.done + bodyRoutine.done;
  const routinePct = totalRoutine > 0 ? Math.round((doneRoutine / totalRoutine) * 100) : 0;

  const [showSettings, setShowSettings] = useState(false);
  const [showAccountPage, setShowAccountPage] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [weightRefreshKey, setWeightRefreshKey] = useState(0);
  const [userProfile, setUserProfile] = useState(getProfile);

  // Condition check state
  const latestCheck = getLatestCheck();
  const resetNeeded = shouldResetCheck();
  const [selections, setSelections] = useState(() => {
    if (!resetNeeded && latestCheck) {
      return { energy: latestCheck.energy || 7, mood: latestCheck.mood || 7, water: latestCheck.water || 7 };
    }
    return { energy: 7, mood: 7, water: 7 };
  });
  // Continuous slider positions (0~100%) for smooth visual
  const [sliderPcts, setSliderPcts] = useState(() => {
    const init = (!resetNeeded && latestCheck)
      ? { energy: latestCheck.energy || 7, mood: latestCheck.mood || 7, water: latestCheck.water || 7 }
      : { energy: 7, mood: 7, water: 7 };
    return { energy: ((init.energy - 1) / 9) * 100, mood: ((init.mood - 1) / 9) * 100, water: ((init.water - 1) / 9) * 100 };
  });
  const [justUpdated, setJustUpdated] = useState(false);
  const [todayChecks, setTodayChecks] = useState(getTodayChecks);
  const [minutesAgo, setMinutesAgo] = useState(getMinutesSinceLastCheck);
  const [bodyBriefing, setBodyBriefing] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('lua_body_briefing') || '{}');
      if (saved.date === new Date().toISOString().slice(0, 10)) return saved.text || '';
    } catch {}
    return '';
  });
  const [briefingTime, setBriefingTime] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('lua_body_briefing') || '{}');
      if (saved.date === new Date().toISOString().slice(0, 10)) return saved.time || '';
    } catch {}
    return '';
  });
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingFailed, setBriefingFailed] = useState(false);

  // Update minutes ago every 60s
  useEffect(() => {
    const timer = setInterval(() => setMinutesAgo(getMinutesSinceLastCheck()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 앱 로드 시 최근 3시간 내 기록 데이터 기반 상단 브리핑 자동 호출
  useEffect(() => {
    // 이미 캐시된 브리핑이 있으면 스킵
    try {
      const saved = JSON.parse(localStorage.getItem('lua_body_briefing') || '{}');
      if (saved.date === new Date().toISOString().slice(0, 10) && saved.text && saved.fromAuto) return;
    } catch {}

    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const dayRec = (() => { try { return (JSON.parse(localStorage.getItem('lua_record_v2') || '{}'))[todayKey] || {}; } catch { return {}; } })();
    const foods = getTodayFoods().filter(f => !f.name?.startsWith('물 '));
    const todayNut = getTodayNutrition();
    const todayBS = getTodayBloodSugar();
    // 활력 기록
    const energySub = (() => { try { const checks = JSON.parse(localStorage.getItem('nou_energy_sub_checks') || '[]'); return checks.find(c => c.date === todayKey); } catch { return null; } })();

    const recentData = {};
    if (foods.length > 0) recentData.diet = `${foods.map(f => f.name).filter(Boolean).join(', ')} (${Math.round(todayNut.kcal)}kcal, 탄${Math.round(todayNut.carb)}g 단${Math.round(todayNut.protein)}g 지${Math.round(todayNut.fat)}g)`;
    if (dayRec.water?.cups > 0) recentData.water = `${dayRec.water.cups}잔`;
    if (dayRec.steps > 0) recentData.steps = `${dayRec.steps.toLocaleString()}보`;
    if (dayRec.exercise?.log && Object.keys(dayRec.exercise.log).length > 0) recentData.exercise = Object.entries(dayRec.exercise.log).map(([n, m]) => `${n} ${m}분`).join(', ');
    if (dayRec.sleep?.hours) recentData.sleep = `${dayRec.sleep.hours}시간${dayRec.sleep.quality ? ' (' + dayRec.sleep.quality + ')' : ''}`;
    if (todayBS?.value) recentData.bloodSugar = `${todayBS.value}mg/dL (${todayBS.timing})`;
    if (energySub?.vitality) recentData.vitality = `${energySub.vitality}/10`;

    // 기록된 데이터가 하나도 없으면 스킵
    if (Object.keys(recentData).length === 0) return;

    setBriefingLoading(true);
    fetch('/api/condition-briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'body', recentData }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.briefing) {
          const time = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });
          setBodyBriefing(data.briefing);
          setBriefingTime(time);
          localStorage.setItem('lua_body_briefing', JSON.stringify({ date: todayKey, text: data.briefing, time, fromAuto: true }));
        }
      })
      .catch(() => {})
      .finally(() => setBriefingLoading(false));
  }, []);

  const activeCheck = justUpdated ? todayChecks[todayChecks.length - 1] : (resetNeeded ? null : latestCheck);
  const tier = activeCheck ? getTier(activeCheck.energy || 3, activeCheck.mood || 3) : getTier(selections.energy, selections.mood);
  const liveTier = getTier(selections.energy, selections.mood);

  const handleUpdate = () => {
    const saved = saveConditionCheck({ ...selections, skin: 7, gut: 7 });
    setTodayChecks(getTodayChecks());
    setJustUpdated(true);
    setMinutesAgo(0);

    // Body briefing API 호출 — 최근 5시간 내 기록 수집
    setBriefingLoading(true);
    setBriefingFailed(false);
    setBodyBriefing('');
    setBriefingTime('');
    const sliderTo100 = v => Math.round(((v - 1) / 9) * 100);
    const now = new Date();
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);

    // 식단
    const foods = getTodayFoods().filter(f => !f.name?.startsWith('물 '));
    const todayNut = getTodayNutrition();
    // 수분/걸음수/운동/수면 from day record
    const todayKey = now.toISOString().slice(0, 10);
    const dayRec = (() => { try { return (JSON.parse(localStorage.getItem('lua_record_v2') || '{}'))[todayKey] || {}; } catch { return {}; } })();
    // 영양제
    const suppItems = getSupplementItems();
    const suppChecks = getSupplementChecks();
    const suppDone = suppItems.filter(s => suppChecks[s.id]);
    const suppUndone = suppItems.filter(s => !suppChecks[s.id]);
    // 몸무게
    const latestW = getLatestWeight();
    // 혈당
    const todayBS = getTodayBloodSugar();

    const recentData = {};
    if (foods.length > 0) recentData.diet = `${foods.map(f => f.name).filter(Boolean).join(', ')} (${Math.round(todayNut.kcal)}kcal, 탄${Math.round(todayNut.carb)}g 단${Math.round(todayNut.protein)}g 지${Math.round(todayNut.fat)}g)`;
    if (dayRec.water?.cups > 0) recentData.water = `${dayRec.water.cups}잔`;
    if (dayRec.steps > 0) recentData.steps = `${dayRec.steps.toLocaleString()}보`;
    if (dayRec.exercise?.log && Object.keys(dayRec.exercise.log).length > 0) recentData.exercise = Object.entries(dayRec.exercise.log).map(([n, m]) => `${n} ${m}분`).join(', ');
    if (suppItems.length > 0) recentData.supplements = `완료: ${suppDone.map(s => s.name).join(', ') || '없음'} / 미완료: ${suppUndone.map(s => s.name).join(', ') || '없음'}`;
    if (latestW?.weight) recentData.weight = `${latestW.weight}kg`;
    if (todayBS?.value) recentData.bloodSugar = `${todayBS.value}mg/dL (${todayBS.timing})`;
    if (dayRec.sleep?.hours) recentData.sleep = `${dayRec.sleep.hours}시간${dayRec.sleep.quality ? ' (' + dayRec.sleep.quality + ')' : ''}`;

    fetch('/api/condition-briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'body',
        energy: sliderTo100(selections.energy),
        mood: sliderTo100(selections.mood),
        hydration: sliderTo100(selections.water),
        recentData,
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.briefing) {
          const now = new Date();
          const time = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });
          setBodyBriefing(data.briefing);
          setBriefingTime(time);
          localStorage.setItem('lua_body_briefing', JSON.stringify({ date: now.toISOString().slice(0, 10), text: data.briefing, time }));
        } else {
          setBriefingFailed(true);
        }
      })
      .catch(() => { setBriefingFailed(true); })
      .finally(() => setBriefingLoading(false));
  };

  const handleSelect = (id, val) => {
    setSelections(prev => ({ ...prev, [id]: val }));
    setJustUpdated(false);
  };

  // Graph data
  const graphData = useMemo(() => {
    return todayChecks.map(c => {
      const d = new Date(c.timestamp);
      const h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      const vals = [c.energy, c.skin, c.mood, c.gut].filter(v => v > 0);
      const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 3;
      let label;
      if (h < 10) label = '오전';
      else if (h < 13) label = '점심';
      else if (h < 17) label = '오후';
      else label = '저녁';
      return { time: `${h}:${m}`, label, avg };
    });
  }, [todayChecks]);

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 90 }}>

      {/* ===== 1. 히어로 영역 ===== */}
      <div style={{
        padding: '28px 22px 24px',
        position: 'relative',
      }}>
        {/* 상단 row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40, position: 'relative' }}>
          <div onClick={() => setShowWeather(true)} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.8)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
          </div>
          <img src="/luasky.svg" alt="lua" style={{ height: 30, objectFit: 'contain', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }} />
          <div onClick={onMeasure} style={{
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.8)" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
        </div>

        {/* 날짜 + 인사/브리핑 */}
        {(() => {
          const now = new Date();
          const days = ['일','월','화','수','목','금','토'];
          const dateStr = `${now.getFullYear()}. ${String(now.getMonth()+1).padStart(2,'0')}. ${String(now.getDate()).padStart(2,'0')}  ${days[now.getDay()]}요일`;
          const greeting = getGreeting();
          return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#ffffff', marginBottom: 12 }}>
                {dateStr}
              </div>
              {bodyBriefing ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 500, color: '#0D3028', lineHeight: 1.65, marginBottom: 12 }}>
                    {bodyBriefing}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(0,0,0,0.25)' }}>
                    {briefingTime ? `${briefingTime} 기준 AI 브리핑` : ''}
                  </div>
                </>
              ) : briefingLoading ? (
                <>
                  <div style={{ fontSize: 26, fontWeight: 500, color: '#0D3028', lineHeight: 1.35, whiteSpace: 'pre-line', marginBottom: 12 }}>
                    {greeting.main}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(0,0,0,0.3)' }}>
                    AI 브리핑 준비 중...
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 26, fontWeight: 500, color: '#0D3028', lineHeight: 1.35, whiteSpace: 'pre-line', marginBottom: 12 }}>
                    {greeting.main}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: 'rgba(0,0,0,0.3)', marginBottom: 24 }}>
                    {greeting.sub}
                  </div>
                </>
              )}
            </div>
          );
        })()}
        <div style={{ fontSize: 9, color: '#ffffff' }}>
          {minutesAgo !== null
            ? minutesAgo < 1 ? '방금 업데이트' : `${minutesAgo}분 전 업데이트`
            : ''}
        </div>
      </div>

      {/* ===== 1.5 영양·체중·활동 요약 카드 ===== */}
      {(() => {
        const todayNut = getTodayNutrition();
        const fullGoal = getFoodGoal();
        const eaten = Math.round(todayNut.kcal || 0);
        const curWeight = getLatestWeight()?.weight || 55;
        const todayKey_ = new Date().toISOString().slice(0, 10);
        let todaySteps = 0;
        let todayExerciseLog = {};
        try { const v2_ = JSON.parse(localStorage.getItem('lua_record_v2') || '{}'); todaySteps = v2_[todayKey_]?.steps || 0; todayExerciseLog = v2_[todayKey_]?.exercise?.log || {}; } catch {}
        const burnedFromSteps = Math.round(todaySteps * 0.0005 * curWeight);
        const burnedFromExercise = Object.entries(todayExerciseLog).reduce((sum, [name, mins]) => {
          const met = ALL_EXERCISES.find(e => e.name === name)?.met || 4.0;
          return sum + Math.round(met * curWeight * (mins / 60));
        }, 0);
        const totalBurned = burnedFromSteps + burnedFromExercise;
        const netCal = eaten - totalBurned;
        const remaining = Math.max(0, fullGoal.kcal - netCal);
        const pct = fullGoal.kcal > 0 ? Math.min(netCal / fullGoal.kcal, 1) : 0;
        const circR = 32, circC = 2 * Math.PI * circR, circDash = circC * Math.max(pct, 0);
        const macros = [
          { label: '탄수화물', cur: Math.round(todayNut.carb || 0), goal: fullGoal.carb, color: '#F5C2CB' },
          { label: '단백질', cur: Math.round(todayNut.protein || 0), goal: fullGoal.protein, color: '#F5E6A3' },
          { label: '지방', cur: Math.round(todayNut.fat || 0), goal: fullGoal.fat, color: '#F5C4A0' },
        ];
        const latestW = getLatestWeight();
        const bodyRecs = getBodyRecords();
        const prevW = bodyRecs.length >= 2 ? bodyRecs[bodyRecs.length - 2] : null;
        const wDiff = latestW && prevW ? (latestW.weight - prevW.weight).toFixed(1) : null;
        // 걸음수
        const todayKey = new Date().toISOString().slice(0, 10);
        let stepCount = 0;
        try { const v2 = JSON.parse(localStorage.getItem('lua_record_v2') || '{}'); stepCount = v2[todayKey]?.steps || 0; } catch {}
        // 최근 7일 걸음 데이터
        const stepBars = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          const dk = d.toISOString().slice(0, 10);
          try { const v2 = JSON.parse(localStorage.getItem('lua_record_v2') || '{}'); stepBars.push(v2[dk]?.steps || 0); } catch { stepBars.push(0); }
        }
        const maxStep = Math.max(...stepBars, 1);
        // 최근 7일 체중
        const last7w = bodyRecs.slice(-7);
        const wMin = last7w.length > 0 ? Math.min(...last7w.map(r => r.weight)) : 0;
        const wMax = last7w.length > 0 ? Math.max(...last7w.map(r => r.weight)) : 0;
        const wRange = wMax - wMin || 1;
        const cardStyle = {
          background: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: '20px 18px',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.3)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
        };
        return (
          <div style={{ margin: '0 18px', marginTop: 12, position: 'relative', zIndex: 1 }}>
            {/* 체중 + 활동 */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              {/* 체중 */}
              <div onClick={() => onTabChange?.('record')} style={{ ...cardStyle, flex: 1, cursor: 'pointer', padding: '16px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>체중</span>
                  <div onClick={(e) => { e.stopPropagation(); setShowWeightModal(true); }} style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--text-muted)' }}>+</div>
                </div>
                {latestW ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{latestW.weight}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kg</span>
                    </div>
                    {wDiff !== null && (
                      <div style={{ fontSize: 11, color: Number(wDiff) > 0 ? '#E05050' : '#22C55E', marginTop: 2 }}>
                        {Number(wDiff) > 0 ? '↑' : '↓'} {Math.abs(Number(wDiff))} kg
                      </div>
                    )}
                    {last7w.length >= 2 && (
                      <svg width="100%" height="30" viewBox={`0 0 ${(last7w.length - 1) * 20} 30`} style={{ marginTop: 8 }}>
                        <path d={(() => {
                          const pts = last7w.map((r, i) => ({ x: i * 20, y: 28 - ((r.weight - wMin) / wRange) * 24 }));
                          if (pts.length < 2) return `M${pts[0].x},${pts[0].y}`;
                          let d = `M${pts[0].x},${pts[0].y}`;
                          for (let i = 0; i < pts.length - 1; i++) {
                            const cx = (pts[i].x + pts[i + 1].x) / 2;
                            d += ` C${cx},${pts[i].y} ${cx},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`;
                          }
                          return d;
                        })()} fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" />
                        <circle cx={(last7w.length - 1) * 20} cy={28 - ((last7w[last7w.length - 1].weight - wMin) / wRange) * 24} r="3" fill="var(--text-primary)" />
                      </svg>
                    )}
                  </>
                ) : <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>기록 없음</div>}
              </div>
              {/* 활동 */}
              <div onClick={() => onTabChange?.('record')} style={{ ...cardStyle, flex: 1, cursor: 'pointer', padding: '16px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>활동</span>
                  <div onClick={(e) => { e.stopPropagation(); setShowActivityModal(true); }} style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--text-muted)' }}>+</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <img src="/icons/fire.svg" alt="" style={{ width: 20, height: 20, opacity: 0.5, filter: 'invert(60%) sepia(90%) saturate(500%) hue-rotate(350deg)' }} />
                  <span style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{(burnedFromSteps + burnedFromExercise) > 0 ? (burnedFromSteps + burnedFromExercise).toLocaleString() : '—'}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kcal</span>
                </div>
                {stepCount > 0 && (
                  <div style={{ marginTop: 4, fontSize: 10, color: '#22C55E' }}>🚶 {stepCount.toLocaleString()}걸음</div>
                )}
                {/* 7일 바 차트 */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 30, marginTop: 8 }}>
                  {stepBars.map((s, i) => (
                    <div key={i} style={{
                      flex: 1, borderRadius: 2,
                      height: s > 0 ? Math.max(4, (s / maxStep) * 28) : 4,
                      background: i === 6 ? 'var(--text-primary)' : 'rgba(0,0,0,0.12)',
                    }} />
                  ))}
                </div>
              </div>
            </div>
            {/* 칼로리 카드 */}
            <div style={{ ...cardStyle }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>칼로리</span>
                <div onClick={(e) => { e.stopPropagation(); setShowFoodModal(true); }} style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--text-muted)', cursor: 'pointer' }}>+</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 36, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{remaining}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>kcal 남음</span>
                  </div>
                  <div onClick={() => onTabChange?.('record')} style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ opacity: 0.5 }}>⊙</span> {fullGoal.kcal} 목표 <span style={{ fontSize: 10 }}>›</span>
                  </div>
                </div>
                {/* 원형 진행률 */}
                <div style={{ position: 'relative', width: 76, height: 76 }}>
                  <svg width="76" height="76" viewBox="0 0 76 76">
                    <circle cx="38" cy="38" r={circR} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="6" />
                    <circle cx="38" cy="38" r={circR} fill="none" stroke={eaten > fullGoal.kcal ? '#E05050' : '#7BC8F0'} strokeWidth="6"
                      strokeDasharray={`${circDash} ${circC}`} strokeLinecap="round"
                      transform="rotate(-90 38 38)" style={{ transition: 'stroke-dasharray 0.3s ease' }} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{eaten}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>먹음</span>
                  </div>
                </div>
              </div>
              {/* 섭취·소모 요약 */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 14, padding: '10px 0', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                {[
                  { label: '섭취', value: eaten, color: 'var(--text-primary)' },
                  { label: '총 소모', value: totalBurned, color: '#22C55E' },
                  { label: '순 칼로리', value: netCal, color: netCal > fullGoal.kcal ? '#E05050' : '#5AAABB' },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: item.color, fontFamily: 'var(--font-display)' }}>{item.value}</div>
                  </div>
                ))}
              </div>
              {/* 매크로 */}
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                {macros.map(m => {
                  const ratio = m.goal > 0 ? Math.min(m.cur / m.goal, 1) : 0;
                  return (
                    <div key={m.label} style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textAlign: 'center' }}>{m.label}</div>
                      <div style={{ height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.06)', position: 'relative' }}>
                        <div style={{ height: '100%', borderRadius: 2, background: m.color, width: `${ratio * 100}%`, transition: 'width 0.3s ease' }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.cur}</span>/{m.goal}g
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== 2. 컨디션 체크 카드 ===== */}
      <div style={{
        margin: '0 18px', marginTop: 10, position: 'relative', zIndex: 1,
        background: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: '20px 14px',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.3)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16 }}>컨디션</div>

        {[
          { key: 'mood', label: '기분', get color() { return getCategoryColor('mood'); }, rgb: [245,194,203], get textColor() { return getCategoryColor('mood'); }, labels: MOOD_LABELS, ends: ['우울', '행복'],
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(212,112,126,0.3))' }}><defs><linearGradient id="heartG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F0B8C0"/><stop offset="100%" stopColor="#D4707E"/></linearGradient></defs><path d="M12 4.5C10 2 6.5 1.5 4.5 4c-2 2.5-1.5 6 1 8.5L12 20l6.5-7.5c2.5-2.5 3-6 1-8.5C17.5 1.5 14 2 12 4.5z" fill="url(#heartG)" opacity="0.6"/></svg> },
          { key: 'energy', label: '에너지', get color() { return getCategoryColor('energy'); }, rgb: [245,230,163], get textColor() { return getCategoryColor('energy'); }, labels: ENERGY_LABELS, ends: ['매우 낮음', '활기참'],
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(232,161,53,0.3))' }}><defs><linearGradient id="boltG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F5DFA0"/><stop offset="100%" stopColor="#E8A135"/></linearGradient></defs><path d="M14 1L3 14h8l-3 9 12-13h-8l2-9z" fill="url(#boltG)" opacity="0.6"/></svg> },
          { key: 'water', label: '수분', get color() { return getCategoryColor('water'); }, rgb: [194,234,255], get textColor() { return getCategoryColor('water'); }, labels: WATER_LABELS, ends: ['갈증', '충분'],
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(91,163,212,0.3))' }}><defs><linearGradient id="dropG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#B8E0F5"/><stop offset="100%" stopColor="#5BA3D4"/></linearGradient></defs><path d="M12 2.5c0 0-7.5 8-7.5 13a7.5 7.5 0 0015 0c0-5-7.5-13-7.5-13z" fill="url(#dropG)" opacity="0.6"/></svg> },
        ].map((s, si) => {
          const val = selections[s.key];
          const pct = sliderPcts[s.key];
          const trackH = 9;
          let cachedRect = null;
          const handleTouch = (e) => {
            if (e.type === 'touchstart' || e.type === 'click') {
              cachedRect = e.currentTarget.getBoundingClientRect();
            }
            const rect = cachedRect || e.currentTarget.getBoundingClientRect();
            const clientX = (e.type === 'touchstart' || e.type === 'touchmove') ? e.touches[0].clientX : e.clientX;
            const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
            const rawPct = (x / rect.width) * 100;
            setSliderPcts(prev => ({ ...prev, [s.key]: rawPct }));
            const v = Math.round((x / rect.width) * 9) + 1;
            handleSelect(s.key, Math.max(1, Math.min(10, v)));
          };
          return (
            <div key={s.key} style={{ marginBottom: si < 2 ? 18 : 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 500, color: 'var(--text-muted)' }}>{s.icon}{s.label}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: s.textColor }}>{s.labels[val - 1]}</span>
              </div>
              <div
                onTouchStart={handleTouch}
                onTouchMove={handleTouch}
                onClick={handleTouch}
                style={{
                  position: 'relative', width: '100%', height: trackH, borderRadius: trackH / 2,
                  background: 'rgba(0,0,0,0.06)',
                  cursor: 'pointer', touchAction: 'none',
                }}
              >
                <div style={{
                  position: 'absolute', top: 0, left: 0, height: '100%',
                  width: `${Math.max(pct, 5)}%`,
                  borderRadius: trackH / 2,
                  background: `linear-gradient(90deg, rgba(255,255,255,0.3), ${s.color}40)`,
                  boxShadow: 'none',
                  transition: 'none',
                }} />
                {/* 동그라미 핸들 */}
                <div style={{
                  position: 'absolute', top: '50%', left: `${Math.max(pct, 2)}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 20, height: 20, borderRadius: '50%',
                  background: `rgb(${Math.round(255+(s.rgb[0]-255)*pct/100)},${Math.round(255+(s.rgb[1]-255)*pct/100)},${Math.round(255+(s.rgb[2]-255)*pct/100)})`,
                  border: '1px solid rgba(255,255,255,0.9)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                  transition: 'none',
                  pointerEvents: 'none',
                }} />
              </div>
            </div>
          );
        })}

        {/* 업데이트 버튼 */}
        <button onClick={handleUpdate} style={{
          marginTop: 30, width: '100%', padding: '10px 0',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0.7))',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          color: '#0D3028', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 10,
          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>업데이트 →</button>
      </div>

      {/* ===== 인사이트 + 오늘 흐름 모달 (업데이트 후 표시) ===== */}
      {justUpdated && (
        <div onClick={() => setJustUpdated(false)} style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: 430,
            background: '#fff', borderRadius: '22px 22px 0 0',
            padding: '24px 20px calc(env(safe-area-inset-bottom, 0px) + 24px)',
            animation: 'slideUp 0.3s ease',
          }}>
            <style>{`
              @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
              @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
            `}</style>

            {/* 핸들 바 */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#ddd', margin: '0 auto 20px' }} />

            {/* 인사이트 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(0,0,0,0.8)' }}>인사이트</span>
              <span style={{ fontSize: 11, color: '#4DB8A0', fontWeight: 500 }}>
                {briefingLoading ? '● AI 분석 중...' : bodyBriefing && briefingTime ? `${briefingTime} 기준` : briefingFailed ? '' : '● 분석 중'}
              </span>
            </div>
            {briefingLoading ? (
              <div style={{ fontSize: 13, color: '#999', lineHeight: 1.6 }}>
                분석 중...
              </div>
            ) : bodyBriefing ? (
              <div style={{ fontSize: 13, color: '#0D3028', lineHeight: 1.6 }}>
                {bodyBriefing}
              </div>
            ) : briefingFailed ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                  {(TIER_INSIGHT[activeCheck ? tier : liveTier].flow).map((step, i) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{
                        fontSize: 12, fontWeight: 600, color: '#0D3028',
                        background: i === 0 ? 'rgba(255,179,71,0.2)' : i === 2 ? 'rgba(78,184,160,0.2)' : 'rgba(255,243,176,0.4)',
                        padding: '3px 8px', borderRadius: 8,
                      }}>{step}</span>
                      {i < 2 && <span style={{ fontSize: 12, color: '#ccc' }}>→</span>}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {TIER_INSIGHT[activeCheck ? tier : liveTier].desc}
                </div>
              </>
            ) : null}

            {/* 구분선 */}
            <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '18px 0' }} />

            {/* 오늘 흐름 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(0,0,0,0.8)' }}>오늘 흐름</span>
              <span onClick={() => { setJustUpdated(false); onTabChange('body'); }} style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>분석 탭 →</span>
            </div>
            <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
              {[{ c: getCategoryColor('mood'), l: '기분' }, { c: getCategoryColor('energy'), l: '에너지' }, { c: getCategoryColor('water'), l: '수분' }].map(x => (
                <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 12, height: 2, borderRadius: 1, background: x.c }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{x.l}</span>
                </div>
              ))}
            </div>

            {graphData.length < 2 ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 20, marginBottom: 6, opacity: 0.4 }}>📈</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {graphData.length === 0 ? '업데이트하면 흐름이 기록돼요' : '한 번 더 체크하면 그래프가 나타나요'}
                </div>
              </div>
            ) : (() => {
              const svgW = Math.max(graphData.length * 70, 220);
              const H = 56;
              const toY = (val) => Math.round(H - (val / 10) * (H - 12) - 6);
              const pad = 16;
              const moodPts = graphData.map((d, i) => ({ x: (i / (graphData.length - 1)) * (svgW - pad * 2) + pad, y: toY(todayChecks[i]?.mood || 7) }));
              const energyPts = graphData.map((d, i) => ({ x: (i / (graphData.length - 1)) * (svgW - pad * 2) + pad, y: toY(todayChecks[i]?.energy || 7) }));
              const waterPts = graphData.map((d, i) => ({ x: (i / (graphData.length - 1)) * (svgW - pad * 2) + pad, y: toY(todayChecks[i]?.water || 7) }));
              const makePath = (pts) => { let d = `M${pts[0].x} ${pts[0].y}`; for (let i = 1; i < pts.length; i++) { const cp = (pts[i].x + pts[i-1].x)/2; d += ` C${cp} ${pts[i-1].y} ${cp} ${pts[i].y} ${pts[i].x} ${pts[i].y}`; } return d; };
              const makeAreaPath = (pts) => makePath(pts) + ` L${pts[pts.length-1].x} ${H} L${pts[0].x} ${H} Z`;
              return (
                <>
                  <svg width="100%" height={H} viewBox={`0 0 ${svgW} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', overflow: 'visible' }}>
                    <defs><linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D4707E" stopOpacity="0.12" /><stop offset="100%" stopColor="#D4707E" stopOpacity="0" /></linearGradient></defs>
                    <path d={makeAreaPath(moodPts)} fill="url(#moodFill)" />
                    <path d={makePath(moodPts)} fill="none" stroke="#D4707E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d={makePath(energyPts)} fill="none" stroke="#E8A135" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3" />
                    <path d={makePath(waterPts)} fill="none" stroke="#5BA3D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 3" />
                    {moodPts.map((p, i) => <circle key={`m${i}`} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#D4707E" strokeWidth="1.5" />)}
                    {energyPts.map((p, i) => <circle key={`e${i}`} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#E8A135" strokeWidth="1.5" />)}
                    {waterPts.map((p, i) => <circle key={`w${i}`} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#5BA3D4" strokeWidth="1.5" />)}
                  </svg>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', marginTop: 4 }}>
                    {graphData.map((d, i) => <span key={i} style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.time}</span>)}
                  </div>
                </>
              );
            })()}

            {/* 닫기 버튼 */}
            <button onClick={() => setJustUpdated(false)} style={{
              marginTop: 20, width: '100%', padding: '12px 0',
              background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 12,
              fontSize: 14, fontWeight: 600, color: '#0D3028', cursor: 'pointer', fontFamily: 'inherit',
            }}>닫기</button>
          </div>
        </div>
      )}

      {/* Skin Weather Page */}
      {showWeather && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: 'linear-gradient(to bottom, #ace2fc, #ffffff)',
          overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        }}>
          <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
            <div onClick={() => setShowWeather(false)} style={{
              width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </div>
            <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>날씨</span>
          </div>
          <SkinWeather />
        </div>
      )}

      {/* Account Page */}
      {showAccountPage && (
        <AccountPage
          profile={userProfile}
          onUpdate={(key, val) => { const next = saveProfile({ [key]: val }); setUserProfile(next); }}
          onClose={() => setShowAccountPage(false)}
        />
      )}

      {showWeightModal && (
        <AddWeightModal
          latest={getLatestWeight()}
          onSave={(w) => { saveBodyRecord(w); setShowWeightModal(false); setWeightRefreshKey(k => k + 1); }}
          onClose={() => setShowWeightModal(false)}
        />
      )}

      {showActivityModal && (
        <AddActivityModal
          onSave={() => { setShowActivityModal(false); setWeightRefreshKey(k => k + 1); }}
          onClose={() => setShowActivityModal(false)}
        />
      )}

      {showFoodModal && (
        <AddFoodModal
          onAdd={(food) => {
            const today = new Date().toISOString().slice(0, 10);
            saveFoodRecord(today, food);
            setShowFoodModal(false);
            setWeightRefreshKey(k => k + 1);
          }}
          onClose={() => setShowFoodModal(false)}
        />
      )}

    </div>
  );

  function getIncompleteText() {
    const names = [];
    if (skinRoutine.done < skinRoutine.total) names.push('피부');
    if (foodRoutine.done < foodRoutine.total) names.push('식단');
    if (bodyRoutine.done < bodyRoutine.total) names.push('바디');
    return names.length > 0 ? `${names.join(' · ')} 루틴이 남았어요` : '';
  }
}

function AddWeightModal({ onSave, onClose, latest }) {
  const [weight, setWeight] = useState(latest ? String(latest.weight) : '');
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
          style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: 'var(--bg-input, #F2F3F5)', fontSize: 20, fontWeight: 600,
            color: 'var(--text-primary)', fontFamily: 'var(--font-display)',
            textAlign: 'center', outline: 'none',
          }}
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

const ALL_EXERCISES = [
  { id: 'walk', icon: '🚶', name: '걷기', met: 3.5 },
  { id: 'weight', icon: '🏋️', name: '근력', met: 5.0 },
  { id: 'run', icon: '🏃', name: '달리기', met: 8.0 },
  { id: 'hike', icon: '🥾', name: '등산', met: 6.0 },
  { id: 'cycle', icon: '🚴', name: '사이클', met: 6.8 },
  { id: 'yoga', icon: '🧘', name: '요가', met: 3.0 },
  { id: 'pilates', icon: '🤸', name: '필라테스', met: 3.5 },
  { id: 'home', icon: '🏠', name: '홈트', met: 4.5 },
  { id: 'swim', icon: '🏊', name: '수영', met: 7.0 },
  { id: 'badminton', icon: '🏸', name: '배드민턴', met: 5.5 },
  { id: 'golf', icon: '⛳', name: '골프', met: 3.5 },
  { id: 'tennis', icon: '🎾', name: '테니스', met: 7.0 },
  { id: 'stretch', icon: '🙆', name: '스트레칭', met: 2.5 },
  { id: 'crossfit', icon: '🔥', name: '크로스핏', met: 8.0 },
  { id: 'aerobic', icon: '💃', name: '에어로빅', met: 6.5 },
];
function getHomeExercises() {
  try {
    const ids = JSON.parse(localStorage.getItem('lua_exercise_settings')) || ['walk', 'weight', 'run', 'cycle', 'yoga', 'swim'];
    return ids.map(id => ALL_EXERCISES.find(e => e.id === id)).filter(Boolean);
  } catch { return ALL_EXERCISES.slice(0, 6); }
}

function AddActivityModal({ onSave, onClose }) {
  const [tab, setTab] = useState('walk'); // 'walk' | 'exercise'
  const [steps, setSteps] = useState('');
  const [selectedEx, setSelectedEx] = useState(null);
  const [minutes, setMinutes] = useState('30');
  const curWeight = getLatestWeight()?.weight || 55;

  const stepsCalorie = steps ? Math.round(Number(steps) * 0.0005 * curWeight) : 0;
  const exCalorie = selectedEx && minutes
    ? Math.round(selectedEx.met * curWeight * (Number(minutes) / 60))
    : 0;

  const handleSave = () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const all = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
    const today = all[todayKey] || { date: todayKey };

    if (tab === 'walk' && steps) {
      today.steps = (today.steps || 0) + Number(steps);
    } else if (tab === 'exercise' && selectedEx && minutes) {
      const log = today.exercise?.log || {};
      log[selectedEx.name] = (log[selectedEx.name] || 0) + Number(minutes);
      today.exercise = { ...today.exercise, log };
    } else {
      return;
    }

    all[todayKey] = today;
    localStorage.setItem('lua_record_v2', JSON.stringify(all));
    onSave();
  };

  const tabStyle = (active) => ({
    flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
    background: active ? 'var(--accent-primary)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted)',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  });

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
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, textAlign: 'center' }}>활동 기록</div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, background: 'var(--bg-input, #F2F3F5)', borderRadius: 12, padding: 4, marginBottom: 20 }}>
          <button onClick={() => setTab('walk')} style={tabStyle(tab === 'walk')}>걷기</button>
          <button onClick={() => setTab('exercise')} style={tabStyle(tab === 'exercise')}>운동</button>
        </div>

        {tab === 'walk' ? (
          <div>
            <input
              value={steps} onChange={e => setSteps(e.target.value)}
              placeholder="걸음 수 입력" type="number"
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: 'var(--bg-input, #F2F3F5)', fontSize: 20, fontWeight: 600,
                color: 'var(--text-primary)', fontFamily: 'var(--font-display)',
                textAlign: 'center', outline: 'none',
              }}
              autoFocus
            />
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>걸음</div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12 }}>
              {[1000, 3000, 5000, 8000, 10000].map(v => (
                <button key={v} onClick={() => setSteps(String(v))} style={{
                  padding: '6px 10px', borderRadius: 8, border: 'none',
                  background: steps === String(v) ? 'var(--accent-primary)' : 'var(--bg-input, #F2F3F5)',
                  color: steps === String(v) ? '#fff' : 'var(--text-muted)',
                  fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                }}>{v >= 10000 ? '1만' : `${v / 1000}천`}</button>
              ))}
            </div>
            {stepsCalorie > 0 && (
              <div style={{ textAlign: 'center', marginTop: 14, fontSize: 14, color: '#22C55E', fontWeight: 600 }}>
                🔥 {stepsCalorie} kcal 소모
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
              {getHomeExercises().filter(e => e.id !== 'walk').map(ex => (
                <button key={ex.id} onClick={() => setSelectedEx(ex)} style={{
                  padding: '12px 8px', borderRadius: 12, border: selectedEx?.id === ex.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  background: selectedEx?.id === ex.id ? 'rgba(255,140,66,0.1)' : 'var(--bg-input, #F2F3F5)',
                  cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit',
                }}>
                  <div style={{ fontSize: 22 }}>{ex.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>{ex.name}</div>
                </button>
              ))}
            </div>
            {selectedEx && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textAlign: 'center' }}>운동 시간</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 6 }}>
                  {[15, 30, 45, 60].map(m => (
                    <button key={m} onClick={() => setMinutes(String(m))} style={{
                      padding: '8px 14px', borderRadius: 10, border: 'none',
                      background: minutes === String(m) ? 'var(--accent-primary)' : 'var(--bg-input, #F2F3F5)',
                      color: minutes === String(m) ? '#fff' : 'var(--text-muted)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}>{m}분</button>
                  ))}
                </div>
                <input
                  value={minutes} onChange={e => setMinutes(e.target.value)}
                  placeholder="직접 입력" type="number" min="1"
                  style={{
                    width: '100%', padding: '10px', borderRadius: 10, border: 'none',
                    background: 'var(--bg-input, #F2F3F5)', fontSize: 14, fontWeight: 500,
                    color: 'var(--text-primary)', textAlign: 'center', outline: 'none', fontFamily: 'inherit',
                  }}
                />
                <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>분</div>
                {exCalorie > 0 && (
                  <div style={{ textAlign: 'center', marginTop: 12, fontSize: 14, color: '#22C55E', fontWeight: 600 }}>
                    🔥 {exCalorie} kcal 소모
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
            border: 'none', background: 'var(--bg-input, #F2F3F5)',
            color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>취소</button>
          <button onClick={handleSave} style={{
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

// ===== Account Page =====
function AccountPage({ profile, onUpdate, onClose }) {
  const currentYear = new Date().getFullYear();
  const age = profile.birthYear ? currentYear - parseInt(profile.birthYear) : null;

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 12, border: 'none',
    background: 'var(--bg-input, #F2F3F5)', fontSize: 14,
    color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      background: 'var(--bg-primary, #fff)',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      animation: 'slideInRight 0.3s ease',
    }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 1,
        background: 'var(--bg-primary, #fff)',
        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div onClick={onClose} style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>계정</div>
      </div>

      <div style={{ padding: '0 24px 40px' }}>
        {/* Profile photo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div onClick={() => document.getElementById('account-photo-input')?.click()} style={{
            position: 'relative', width: 80, height: 80, borderRadius: '50%', cursor: 'pointer',
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
            <input id="account-photo-input" type="file" accept="image/*" onChange={e => {
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

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>닉네임</div>
          <input value={profile.nickname || ''} onChange={e => onUpdate('nickname', e.target.value)}
            placeholder="닉네임" maxLength={20} style={inputStyle} />
        </div>

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
