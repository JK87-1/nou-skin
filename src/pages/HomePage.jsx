import { useState, useEffect, useMemo, useCallback } from 'react';
import DailyInsightSlider from '../components/DailyInsightSlider';
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
  const [showCalorieExplain, setShowCalorieExplain] = useState(false);
  const [weightRefreshKey, setWeightRefreshKey] = useState(0);

  // 카드 순서/편집 관리
  const CARD_REGISTRY = [
    { id: 'weight-activity', label: '체중·활동' },
    { id: 'calories', label: '칼로리·수분' },
    { id: 'condition-sleep', label: '컨디션·수면' },
  ];
  // v3: condition 슬라이더를 인사이트 아래로 분리
  const CARD_ORDER_VERSION = 3;
  const DEFAULT_CARD_ORDER = CARD_REGISTRY.map(c => c.id);
  const [cardOrder, setCardOrder] = useState(() => {
    try {
      const savedVer = localStorage.getItem('lua_home_card_order_ver');
      if (savedVer !== String(CARD_ORDER_VERSION)) {
        localStorage.setItem('lua_home_card_order_ver', String(CARD_ORDER_VERSION));
        localStorage.removeItem('lua_home_card_order');
        return DEFAULT_CARD_ORDER;
      }
      const saved = JSON.parse(localStorage.getItem('lua_home_card_order') || '[]');
      const known = new Set(saved);
      const merged = [...saved.filter(id => CARD_REGISTRY.some(c => c.id === id))];
      CARD_REGISTRY.forEach(c => { if (!known.has(c.id)) merged.push(c.id); });
      return merged;
    } catch { return DEFAULT_CARD_ORDER; }
  });
  const [editMode, setEditMode] = useState(false);
  const [userProfile, setUserProfile] = useState(getProfile);

  const saveCardOrder = useCallback((order) => {
    setCardOrder(order);
    localStorage.setItem('lua_home_card_order', JSON.stringify(order));
  }, []);

  const moveCard = useCallback((fromIdx, toIdx) => {
    setCardOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      localStorage.setItem('lua_home_card_order', JSON.stringify(next));
      return next;
    });
  }, []);

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
  const [briefingRefreshKey, setBriefingRefreshKey] = useState(0);

  // Update minutes ago every 60s
  useEffect(() => {
    const timer = setInterval(() => setMinutesAgo(getMinutesSinceLastCheck()), 60000);
    return () => clearInterval(timer);
  }, []);

  // localStorage 변경 감지 → 기록 추가 시 브리핑 갱신 (1초 디바운스)
  useEffect(() => {
    const WATCH_KEYS = ['lua_food_records', 'lua_record_v2', 'lua_body_records', 'lua_blood_sugar', 'nou_energy_sub_checks'];
    let debounceTimer = null;
    const triggerRefresh = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => setBriefingRefreshKey(k => k + 1), 1000);
    };
    const onStorage = (e) => { if (WATCH_KEYS.includes(e.key)) triggerRefresh(); };
    const origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
      origSetItem(key, value);
      if (WATCH_KEYS.includes(key)) triggerRefresh();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('storage', onStorage);
      localStorage.setItem = origSetItem;
    };
  }, []);

  // 기록 데이터 변경 시 상단 브리핑 자동 호출
  useEffect(() => {
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
    if (energySub?.vitality) recentData.vitality = ['','매우 낮음','낮음','약간 낮음','조금 부족','보통','괜찮음','좋음','활발','높음','최고'][energySub.vitality] || `${energySub.vitality}`;

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
  }, [briefingRefreshKey]);

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
          <div onClick={() => setEditMode(e => !e)} style={{
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1,
          }}>
            {editMode ? (
              <span style={{ fontSize: 14, fontWeight: 600, color: '#4DB8A0' }}>완료</span>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.8)" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )}
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

      {/* ===== 카드 영역 (순서 변경 가능) ===== */}
      {editMode && (
        <style>{`
          @keyframes cardWiggle {
            0% { transform: rotate(-0.5deg); }
            50% { transform: rotate(0.5deg); }
            100% { transform: rotate(-0.5deg); }
          }
        `}</style>
      )}
      {cardOrder.map((cardId, cardIdx) => {
        const isEditing = editMode;
        const isFirst = cardIdx === 0;
        const isLast = cardIdx === cardOrder.length - 1;
        const arrowBtn = (dir) => {
          const isUp = dir === 'up';
          return (
            <div
              onClick={(e) => { e.stopPropagation(); moveCard(cardIdx, isUp ? cardIdx - 1 : cardIdx + 1); }}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {isUp ? <path d="M18 15l-6-6-6 6"/> : <path d="M6 9l6 6 6-6"/>}
              </svg>
            </div>
          );
        };
        const editWrap = (label, content) => (
          <div
            key={cardId}
            style={{
              animation: isEditing ? 'cardWiggle 0.3s ease-in-out infinite' : 'none',
              position: 'relative',
            }}
          >
            {isEditing && (
              <div style={{
                position: 'absolute', top: 6, left: 0, right: 0, zIndex: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>
                {!isFirst && arrowBtn('up')}
                <div style={{
                  background: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: '4px 14px',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                  </svg>
                  <span style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>{label}</span>
                </div>
                {!isLast && arrowBtn('down')}
              </div>
            )}
            {content}
          </div>
        );

        if (cardId === 'weight-activity') {
          return editWrap('체중·활동', (() => {
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
            const latestW = getLatestWeight();
            const bodyRecs = getBodyRecords();
            const prevW = bodyRecs.length >= 2 ? bodyRecs[bodyRecs.length - 2] : null;
            const wDiff = latestW && prevW ? (latestW.weight - prevW.weight).toFixed(1) : null;
            const todayKey = new Date().toISOString().slice(0, 10);
            let stepCount = 0;
            try { const v2 = JSON.parse(localStorage.getItem('lua_record_v2') || '{}'); stepCount = v2[todayKey]?.steps || 0; } catch {}
            const stepBars = [];
            for (let i = 6; i >= 0; i--) {
              const d = new Date(); d.setDate(d.getDate() - i);
              const dk = d.toISOString().slice(0, 10);
              try { const v2 = JSON.parse(localStorage.getItem('lua_record_v2') || '{}'); stepBars.push(v2[dk]?.steps || 0); } catch { stepBars.push(0); }
            }
            const maxStep = Math.max(...stepBars, 1);
            const last7w = bodyRecs.slice(-7);
            const wMin = last7w.length > 0 ? Math.min(...last7w.map(r => r.weight)) : 0;
            const wMax = last7w.length > 0 ? Math.max(...last7w.map(r => r.weight)) : 0;
            const wRange = wMax - wMin || 1;
            const cs = {
              background: 'rgba(255,255,255,0.2)', borderRadius: 22, padding: '20px 18px',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.3)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
            };
            return (
              <div style={{ margin: '0 18px', marginTop: 15, position: 'relative', zIndex: 1, pointerEvents: isEditing ? 'none' : 'auto' }}>
                <div style={{ display: 'flex', gap: 15 }}>
                  <div onClick={() => onTabChange?.('record')} style={{ ...cs, flex: 1, cursor: 'pointer', padding: '16px 14px' }}>
                    {/* 상단: 아이콘 + 제목 + 버튼 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <img src="/icons/scale.svg" width="18" height="18" alt="" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(180,180,180,0.3))' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>체중</span>
                      </div>
                      <div onClick={(e) => { e.stopPropagation(); setShowWeightModal(true); }} style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'rgba(0,0,0,0.2)' }}>+</div>
                    </div>
                    {/* 하단: 숫자(좌) + 그래프(우) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        {latestW ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                              <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{latestW.weight}</span>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kg</span>
                            </div>
                            {wDiff !== null && (
                              <div style={{ fontSize: 10, color: Number(wDiff) > 0 ? '#E05050' : '#22C55E', marginTop: 4 }}>
                                {Number(wDiff) > 0 ? '↑' : '↓'} {Math.abs(Number(wDiff))}kg
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>—</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>kg</div>
                          </>
                        )}
                      </div>
                      {/* 미니 그래프 (우측) */}
                      {last7w.length >= 2 && (() => {
                        const pad = 5;
                        const w = (last7w.length - 1) * 10 + pad * 2;
                        const h = 40;
                        const pts = last7w.map((r, i) => ({ x: pad + i * 10, y: pad + (h - pad * 2) - ((r.weight - wMin) / wRange) * (h - pad * 2) }));
                        let d = `M${pts[0].x},${pts[0].y}`;
                        for (let i = 0; i < pts.length - 1; i++) {
                          const cx = (pts[i].x + pts[i + 1].x) / 2;
                          d += ` C${cx},${pts[i].y} ${cx},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`;
                        }
                        const last = pts[pts.length - 1];
                        return (
                          <svg width="65" height={h} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0 }}>
                            <defs>
                              <linearGradient id="wLineGrad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#6ECFB8" />
                                <stop offset="100%" stopColor="#4AA870" />
                              </linearGradient>
                            </defs>
                            <path d={d} fill="none" stroke="url(#wLineGrad)" strokeWidth="2.5" strokeLinecap="round" />
                            <circle cx={last.x} cy={last.y} r="3.5" fill="#4AA870" />
                          </svg>
                        );
                      })()}
                    </div>
                  </div>
                  <div onClick={() => onTabChange?.('record')} style={{ ...cs, flex: 1, cursor: 'pointer', padding: '16px 14px' }}>
                    {/* 상단: 아이콘 + 제목 + 버튼 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(232,130,53,0.3))' }}><defs><linearGradient id="fireCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F5C8A0"/><stop offset="100%" stopColor="#E87835"/></linearGradient></defs><path d="M9.28,0l.46.29c2.08,1.04,3.6,2.7,4.6,4.79.77,1.62,1.22,3.24,1.18,5.12,1.33-.89,1.7-3.24,1.92-3.19.1.02.26.14.39.24,3.09,2.49,4.39,6.5,3.11,10.36-1.15,3.47-4.42,6.09-8.15,6.39l-1.59-.03c-3.19-.29-6.04-2.11-7.57-4.99-2.14-4.06-1.01-8.98,2.62-11.77,1.25-.96,2.15-2.26,2.61-3.77.26-.85.19-1.71.17-2.59l.02-.85h.22,0Z" fill="url(#fireCard)" opacity="0.6"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>활동</span>
                      </div>
                      <div onClick={(e) => { e.stopPropagation(); setShowActivityModal(true); }} style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'rgba(0,0,0,0.2)' }}>+</div>
                    </div>
                    {/* 하단: 숫자(좌) + 막대그래프(우) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{(burnedFromSteps + burnedFromExercise) > 0 ? (burnedFromSteps + burnedFromExercise).toLocaleString() : '—'}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kcal</span>
                        </div>
                        {stepCount > 0 && (
                          <div style={{ fontSize: 10, color: '#22C55E', marginTop: 4 }}>{stepCount.toLocaleString()}걸음</div>
                        )}
                      </div>
                      {/* 슬림 막대그래프 */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 36, flexShrink: 0 }}>
                        {stepBars.map((s, i) => (
                          <div key={i} style={{
                            width: 6, borderRadius: 3,
                            height: s > 0 ? Math.max(6, (s / maxStep) * 34) : 6,
                            background: i === 6
                              ? 'linear-gradient(180deg, #FF9F43, #F07030)'
                              : s > 0 ? 'rgba(255,159,67,0.25)' : 'rgba(0,0,0,0.06)',
                            transition: 'height 0.3s ease',
                          }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })());
        }

        if (cardId === 'calories') {
          return editWrap('칼로리', (() => {
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

            // 수분 데이터
            let waterCups = 0;
            try { const v2_ = JSON.parse(localStorage.getItem('lua_record_v2') || '{}'); waterCups = v2_[todayKey_]?.water?.cups || 0; } catch {}
            const waterGoal = 8;
            const waterPct = Math.min(Math.round((waterCups / waterGoal) * 100), 100);

            const cs = {
              background: 'rgba(255,255,255,0.2)', borderRadius: 22,
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.3)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
            };

            return (
              <div style={{ margin: '0 18px', marginTop: 15, position: 'relative', zIndex: 1, pointerEvents: isEditing ? 'none' : 'auto' }}>
                <div style={{ display: 'flex', gap: 15 }}>
                  {/* 칼로리 카드 (왼쪽 반) */}
                  <div onClick={(e) => { e.stopPropagation(); setShowCalorieExplain(true); }} style={{ ...cs, flex: 1, cursor: 'pointer', padding: '16px 14px' }}>
                    {/* 상단: 아이콘 + 제목 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="16" height="16" viewBox="0 0 1254 1254" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(220,60,60,0.3))' }}><defs><linearGradient id="appleCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F5A0A0"/><stop offset="100%" stopColor="#DC3C3C"/></linearGradient></defs><path d="M852.51,1114.52C822.56,1133.36,790.72,1145.62,755.49,1148.31C718.9,1151.11,684.66,1142.94,652.14,1126.65C645.15,1123.15,638.33,1119.22,631.86,1114.87C628.65,1112.72,626.65,1113.54,623.94,1115.2C596.76,1131.87,567.54,1143,535.83,1147.21C491.83,1153.05,450.67,1143.99,411.83,1123.23C369.95,1100.84,336.1,1069,306.69,1032.31C243.86,953.89,200.68,865.58,176.61,768.11C162.75,711.98,159.24,654.92,166.15,597.45C172.23,546.91,187.01,499.36,216.16,456.92C248.57,409.71,292.47,378.61,347.36,363.01C391.12,350.57,435.67,348.92,480.62,354.47C518.12,359.11,554.54,368.34,590.23,380.63C592.44,381.39,594.82,381.67,596.97,382.14C598.41,359.44,599.8,337.56,601.19,315.63C590.93,317.2,580.22,319.19,569.43,320.44C526.57,325.37,485.28,320.34,446.56,300.15C418.24,285.37,395.38,264.25,376.51,238.74C348.56,200.95,330.22,158.8,320.39,112.9C320.08,111.43,319.84,109.95,319.62,108.47C317.74,95.9,321.66,89.96,334.08,88.2C347.93,86.24,361.84,84.4,375.79,83.56C419.19,80.94,462.16,83.39,503.56,98.09C553.43,115.79,593.86,145.54,620.07,192.46C625.39,201.98,629.27,212.29,633.88,222.38C636.78,217.79,639.84,212.77,643.09,207.87C661.04,180.78,683.41,157.84,709.46,138.56C726.51,125.95,748.78,135.42,751.3,156.2C752.54,166.47,747.98,174.47,739.69,180.66C720.61,194.88,703.83,211.44,689.71,230.67C669.45,258.27,657.8,289.38,653.28,323.02C650.87,340.97,650.42,359.18,649.28,377.29C648.95,382.59,649.99,383.17,655.09,381.34C690.88,368.52,727.35,358.25,764.96,352.44C818.12,344.21,870.99,344.39,922.73,361.04C987.39,381.84,1032.33,424.8,1060.25,486.13C1080.83,531.32,1087.87,579.32,1088.93,628.47C1090.56,703.51,1074.69,775.27,1047.53,844.76C1022.21,909.55,989.75,970.49,946.75,1025.43C919.92,1059.72,889.78,1090.66,852.51,1114.52z" fill="url(#appleCard)" opacity="0.6"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>식사</span>
                      </div>
                      <div onClick={(e) => { e.stopPropagation(); setShowFoodModal(true); }} style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'rgba(0,0,0,0.2)' }}>+</div>
                    </div>
                    {/* 하단: 숫자 + 링 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{eaten.toLocaleString()}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kcal</span>
                        </div>
                        <div style={{ fontSize: 10, color: eaten > fullGoal.kcal ? '#E85B5B' : 'var(--text-muted)', marginTop: 4 }}>
                          {eaten > fullGoal.kcal ? `${(eaten - fullGoal.kcal).toLocaleString()}kcal 초과` : `${remaining.toLocaleString()}kcal 남음`}
                        </div>
                      </div>
                      {(() => {
                        const ringR = 22, ringC = 2 * Math.PI * ringR;
                        const remainPct = fullGoal.kcal > 0 ? Math.max(0, Math.round((remaining / fullGoal.kcal) * 100)) : 100;
                        const ratio = fullGoal.kcal > 0 ? eaten / fullGoal.kcal : 0;
                        const isOver = ratio > 1;
                        const baseFill = ringC * Math.min(ratio, 1);
                        const overFill = isOver ? ringC * Math.min(ratio - 1, 1) : 0;
                        return (
                          <svg width="52" height="52" viewBox="0 0 52 52">
                            <defs>
                              <linearGradient id="calRingGrad" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor={isOver ? '#E85B5B' : remainPct <= 20 ? '#E8A830' : remainPct <= 70 ? '#4DBDA0' : '#6AB8D8'} />
                                <stop offset="100%" stopColor={isOver ? '#F5A0A0' : remainPct <= 20 ? '#FFDB70' : remainPct <= 70 ? '#6ECFB8' : '#90CCE8'} />
                              </linearGradient>
                            </defs>
                            <circle cx="26" cy="26" r={ringR} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
                            {/* 기본 링 (100%까지, 투명도 적용) */}
                            <circle cx="26" cy="26" r={ringR} fill="none" stroke="url(#calRingGrad)" strokeWidth="5"
                              strokeDasharray={`${baseFill} ${ringC - baseFill}`} strokeLinecap="round"
                              opacity={isOver ? 0.35 : 1}
                              transform="rotate(-90 26 26)" style={{ transition: 'stroke-dasharray 0.3s ease' }} />
                            {/* 초과 링 (겹쳐서 표시) */}
                            {isOver && (
                              <circle cx="26" cy="26" r={ringR} fill="none" stroke="#E85B5B" strokeWidth="5"
                                strokeDasharray={`${overFill} ${ringC - overFill}`} strokeLinecap="round"
                                transform="rotate(-90 26 26)" style={{ transition: 'stroke-dasharray 0.3s ease' }} />
                            )}
                          </svg>
                        );
                      })()}
                    </div>
                  </div>

                  {/* 수분 카드 (오른쪽 반) */}
                  <div onClick={() => onTabChange?.('record')} style={{ ...cs, flex: 1, cursor: 'pointer', padding: '16px 14px' }}>
                    {/* 상단: 아이콘 + 제목 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(91,163,212,0.3))' }}><defs><linearGradient id="dropCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#B8E0F5"/><stop offset="100%" stopColor="#5BA3D4"/></linearGradient></defs><path d="M12 2.5c0 0-7.5 8-7.5 13a7.5 7.5 0 0015 0c0-5-7.5-13-7.5-13z" fill="url(#dropCard)" opacity="0.6"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>수분</span>
                      </div>
                      <div onClick={(e) => { e.stopPropagation(); onTabChange?.('record'); }} style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'rgba(0,0,0,0.2)' }}>+</div>
                    </div>
                    {/* 하단: 숫자 + 링 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{(waterCups * 250).toLocaleString()}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ml</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>목표 {(waterGoal * 250).toLocaleString()}ml</div>
                      </div>
                      {(() => {
                        const ringR = 22, ringC = 2 * Math.PI * ringR;
                        const fillPct = Math.min(waterCups / waterGoal, 1);
                        const ringDash = ringC * fillPct;
                        return (
                          <svg width="52" height="52" viewBox="0 0 52 52">
                            <defs>
                              <linearGradient id="waterRingGrad" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#5BA3D4" />
                                <stop offset="100%" stopColor="#B8E0F5" />
                              </linearGradient>
                            </defs>
                            <circle cx="26" cy="26" r={ringR} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
                            <circle cx="26" cy="26" r={ringR} fill="none" stroke="url(#waterRingGrad)" strokeWidth="5"
                              strokeDasharray={`${ringDash} ${ringC - ringDash}`} strokeLinecap="round"
                              transform="rotate(-90 26 26)" style={{ transition: 'stroke-dasharray 0.3s ease' }} />
                          </svg>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })());
        }

        if (cardId === 'condition-sleep') {
          return editWrap('컨디션·수면', (() => {
            const cs = {
              background: 'rgba(255,255,255,0.2)', borderRadius: 22,
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.3)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
            };
            const todayKey_ = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

            // 컨디션 7일 데이터
            const allChecks = JSON.parse(localStorage.getItem('nou_condition_checks') || '[]');
            const cond7 = [];
            for (let i = 6; i >= 0; i--) {
              const d = new Date(); d.setDate(d.getDate() - i);
              const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
              const dayChecks = allChecks.filter(c => (c.date || c.timestamp?.slice(0,10)) === dk);
              if (dayChecks.length > 0) {
                const last = dayChecks[dayChecks.length - 1];
                cond7.push({ date: dk, avg: ((last.energy || 5) + (last.mood || 5)) / 2 });
              } else {
                cond7.push({ date: dk, avg: null });
              }
            }
            const todayCond = cond7[6]?.avg;
            const condLabel = todayCond ? (todayCond >= 7 ? '좋음' : todayCond >= 4 ? '보통' : '낮음') : null;

            // 수면 7일 데이터
            const allV2 = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
            const sleep7 = [];
            for (let i = 6; i >= 0; i--) {
              const d = new Date(); d.setDate(d.getDate() - i);
              const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
              const rec = allV2[dk];
              if (rec?.sleep?.hours > 0) {
                const bedHour = rec.sleep.bedtime ? parseInt(rec.sleep.bedtime.split(':')[0]) : null;
                sleep7.push({ date: dk, hours: rec.sleep.hours, bedHour });
              } else {
                sleep7.push({ date: dk, hours: null, bedHour: null });
              }
            }
            const todaySleep = sleep7[6]?.hours;

            return (
              <div style={{ margin: '0 18px', marginTop: 15, position: 'relative', zIndex: 1, pointerEvents: isEditing ? 'none' : 'auto' }}>
                <div style={{ display: 'flex', gap: 15 }}>
                  {/* 컨디션 카드 */}
                  <div onClick={() => onTabChange?.('record')} style={{ ...cs, flex: 1, cursor: 'pointer', padding: '16px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(240,208,96,0.3))' }}><defs><linearGradient id="starCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFE066"/><stop offset="100%" stopColor="#E8B800"/></linearGradient></defs><path d="M10.48,23.25c-.15.41-.5.71-.86.75-.27.03-.78-.29-.9-.59l-1.53-4.02c-.48-1.26-1.41-2.1-2.67-2.58l-3.91-1.48c-.29-.11-.59-.51-.6-.76-.01-.39.23-.79.6-.93l3.9-1.49c1.27-.48,2.19-1.31,2.68-2.59l1.57-4.14c.08-.2.52-.44.74-.46.24-.02.77.21.86.46l1.57,4.14c.5,1.32,1.47,2.15,2.78,2.63l3.7,1.37c.31.11.66.55.67.83.02.42-.29.82-.68.97l-3.8,1.44c-1.26.48-2.2,1.32-2.67,2.58l-1.45,3.86z" fill="url(#starCard)" opacity="0.8"/><path d="M21.48,6.29c-1.03.59-.9,2.91-2.01,2.98-1.23.08-.99-1.68-1.94-2.78-.77-.88-2.68-.63-2.74-1.78-.07-1.27,2.01-1.1,2.74-1.91.87-.95.73-2.72,1.78-2.8,1.29-.1.98,1.81,1.95,2.77.87.86,2.67.71,2.73,1.8.07,1.08-1.29,1.02-2.51,1.72z" fill="url(#starCard)" opacity="0.8"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>컨디션</span>
                      </div>
                      <div onClick={(e) => { e.stopPropagation(); onTabChange?.('record'); }} style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'rgba(0,0,0,0.2)' }}>+</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{todayCond ? todayCond.toFixed(1) : '—'}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/10</span>
                        </div>
                        {condLabel && <div style={{ fontSize: 10, color: todayCond >= 7 ? '#22C55E' : todayCond >= 4 ? 'var(--text-muted)' : '#E05050', marginTop: 4 }}>{condLabel}</div>}
                      </div>
                      {/* 도트 라인 그래프 */}
                      {(() => {
                        const pad = 5, w = 6 * 10 + pad * 2, h = 40;
                        const valid = cond7.filter(c => c.avg !== null);
                        if (valid.length < 2) return null;
                        const pts = cond7.map((c, i) => c.avg !== null ? { x: pad + i * 10, y: pad + (h - pad * 2) - ((c.avg - 1) / 9) * (h - pad * 2) } : null);
                        const validPts = pts.filter(Boolean);
                        let d = `M${validPts[0].x},${validPts[0].y}`;
                        for (let i = 0; i < validPts.length - 1; i++) {
                          const cx = (validPts[i].x + validPts[i + 1].x) / 2;
                          d += ` C${cx},${validPts[i].y} ${cx},${validPts[i + 1].y} ${validPts[i + 1].x},${validPts[i + 1].y}`;
                        }
                        const last = validPts[validPts.length - 1];
                        return (
                          <svg width="65" height={h} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0 }}>
                            <defs>
                              <linearGradient id="condLineGrad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#FFF0B8" />
                                <stop offset="100%" stopColor="#F0D060" />
                              </linearGradient>
                            </defs>
                            <path d={d} fill="none" stroke="url(#condLineGrad)" strokeWidth="2.5" strokeLinecap="round" />
                            <circle cx={last.x} cy={last.y} r="3.5" fill="#F0D060" />
                          </svg>
                        );
                      })()}
                    </div>
                  </div>

                  {/* 수면 카드 */}
                  <div onClick={() => onTabChange?.('record')} style={{ ...cs, flex: 1, cursor: 'pointer', padding: '16px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(91,106,175,0.3))' }}><defs><linearGradient id="moonCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C8D0F0"/><stop offset="100%" stopColor="#5B6AAF"/></linearGradient></defs><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="url(#moonCard)" opacity="0.6"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>수면</span>
                      </div>
                      <div onClick={(e) => { e.stopPropagation(); onTabChange?.('record'); }} style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'rgba(0,0,0,0.2)' }}>+</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{todaySleep || '—'}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>시간</span>
                        </div>
                        {todaySleep && <div style={{ fontSize: 10, color: todaySleep >= 7 ? '#22C55E' : todaySleep >= 5 ? 'var(--text-muted)' : '#E05050', marginTop: 4 }}>{todaySleep >= 7 ? '충분' : todaySleep >= 5 ? '보통' : '부족'}</div>}
                      </div>
                      {/* 플로팅 바 차트 (취침시간+수면시간) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 40, flexShrink: 0 }}>
                        {sleep7.map((s, i) => {
                          if (!s.hours) return <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.06)', alignSelf: 'center' }} />;
                          // 바 높이 = 수면 시간 (최대 10시간 기준)
                          const barH = Math.max(8, (s.hours / 10) * 36);
                          // 바 위치 = 취침 시각 (22시=상단, 2시=하단)
                          let topOffset = 0;
                          if (s.bedHour !== null) {
                            // 22시=0, 23시=1, 0시=2, 1시=3, 2시=4, 3시=5
                            const normalized = s.bedHour >= 18 ? s.bedHour - 18 : s.bedHour + 6;
                            topOffset = Math.min(normalized * 3, 20); // 최대 20px 아래로
                          }
                          const isToday = i === 6;
                          return (
                            <div key={i} style={{
                              width: 6, borderRadius: 3,
                              height: barH,
                              marginTop: topOffset,
                              background: isToday
                                ? 'linear-gradient(180deg, #5B6AAF, #8B6AAF)'
                                : s.hours >= 7 ? 'rgba(91,106,175,0.3)' : 'rgba(91,106,175,0.15)',
                              transition: 'height 0.3s ease',
                            }} />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })());
        }

        return null;
      })}

      {/* ===== 데일리 인사이트 슬라이더 ===== */}
      <DailyInsightSlider />

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

      {/* 칼로리 목표 설명 모달 */}
      {showCalorieExplain && (() => {
        const p = getProfile();
        const goalCal = getFoodGoal().kcal;
        const tdee = p.dietTDEE || 0;
        const objective = p.dietObjective || '';
        const speed = p.dietSpeed || 'normal';
        const objLabel = { lose: '감량', gain: '증량', tone: '체형 유지', maintain: '유지' }[objective] || '설정 없음';
        const speedLabel = { slow: '느리게', normal: '보통', fast: '빠르게' }[speed] || speed;
        const actLabel = { sedentary: '좌식 생활', light: '가벼운 활동', moderate: '보통 활동' }[p.dietActivityLevel] || p.dietActivityLevel || '-';
        const exLabel = { none: '없음', walking: '걷기', pilates: '필라테스', gym: '헬스', mixed: '복합' }[p.dietExerciseType] || p.dietExerciseType || '-';
        const freqLabel = { none: '없음', '1-2': '주 1-2회', '3-4': '주 3-4회', '5+': '주 5회+' }[p.dietExerciseFreq] || p.dietExerciseFreq || '-';
        const calAdjust = goalCal - tdee;
        const highCalDays = p.dietHighCalDays || [];
        const hasCycleCal = highCalDays.length > 0;
        const highCal = hasCycleCal ? Math.round(goalCal * 1.15) : null;
        const lowCal = hasCycleCal ? Math.round((goalCal * 7 - highCal * highCalDays.length) / (7 - highCalDays.length)) : null;

        return (
          <div onClick={() => setShowCalorieExplain(false)} style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            animation: 'fadeIn 0.2s ease',
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              width: '100%', maxWidth: 440, maxHeight: '80vh', overflowY: 'auto',
              background: 'var(--bg-primary, #fff)', borderRadius: '24px 24px 0 0',
              padding: '28px 24px 36px',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
            }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.1)', margin: '0 auto 20px' }} />
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>내 목표 칼로리</div>

              {/* 목표 칼로리 큰 숫자 */}
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <span style={{ fontSize: 36, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{goalCal.toLocaleString()}</span>
                <span style={{ fontSize: 14, color: 'var(--text-muted)', marginLeft: 4 }}>kcal/일</span>
              </div>

              {/* 계산 과정 */}
              <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>계산 과정</div>
                {[
                  { label: '기초대사량(TDEE)', value: `${tdee.toLocaleString()} kcal` },
                  { label: '목표', value: objLabel },
                  { label: '칼로리 조정', value: `${calAdjust >= 0 ? '+' : ''}${calAdjust} kcal` },
                  { label: '= 일일 목표', value: `${goalCal.toLocaleString()} kcal`, bold: true },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: row.bold ? 700 : 500, color: row.bold ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* 내 설정 */}
              <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>내 설정</div>
                {[
                  { label: '현재 체중', value: `${p.currentWeight || '-'}kg` },
                  { label: '목표 체중', value: `${p.goalWeight || '-'}kg` },
                  { label: '활동 수준', value: actLabel },
                  { label: '운동', value: `${exLabel} · ${freqLabel}` },
                  { label: '속도', value: speedLabel },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* 칼로리 사이클링 (설정된 경우) */}
              {hasCycleCal && (
                <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>칼로리 사이클링</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>고칼로리 ({highCalDays.join('·')})</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{highCal?.toLocaleString()} kcal</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>저칼로리 (나머지)</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{lowCal?.toLocaleString()} kcal</span>
                  </div>
                </div>
              )}

              {!p.dietOnboardingDone && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 16, lineHeight: 1.6 }}>
                  다이어트 프로그램을 아직 설정하지 않았어요.<br/>
                  마이페이지에서 설정할 수 있어요.
                </div>
              )}

              <button onClick={() => setShowCalorieExplain(false)} style={{
                width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
                background: 'var(--accent-primary, #89cef5)', color: '#fff',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>확인</button>
            </div>
          </div>
        );
      })()}

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
