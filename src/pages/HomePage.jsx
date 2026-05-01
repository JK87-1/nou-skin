import { useState, useEffect, useMemo, useCallback } from 'react';
import { hapticLight } from '../utils/haptic';
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
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [weightRefreshKey, setWeightRefreshKey] = useState(0);
  const [tappedCard, setTappedCard] = useState(null);
  const handleCardTap = (cardName, callback) => {
    setTappedCard(cardName);
    hapticLight();
    if (navigator.vibrate) navigator.vibrate(8);
    setTimeout(() => setTappedCard(null), 300);
    callback?.();
  };

  // 카드 순서/편집 관리
  const CARD_REGISTRY = [
    { id: 'condition', label: '컨디션' },
    { id: 'activity', label: '활동' },
    { id: 'food', label: '식사' },
    { id: 'water', label: '수분' },
    { id: 'weight', label: '체중' },
    { id: 'sleep', label: '수면' },
  ];
  // v5: 개별 카드 분리 (6개 카드, 2열 그리드)
  const CARD_ORDER_VERSION = 6;
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.8)" strokeWidth="1.6" strokeLinecap="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
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
              <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(0,0,0,0.35)', marginBottom: 12 }}>
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
      </div>

      {/* ===== 카드 영역 (순서 변경 가능, 2열 그리드) ===== */}
      <style>{`
        @keyframes cardWiggle {
          0% { transform: rotate(-0.5deg); }
          50% { transform: rotate(0.5deg); }
          100% { transform: rotate(-0.5deg); }
        }
        @keyframes cardTap {
          0% { transform: scale(1); }
          40% { transform: scale(0.96); }
          70% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
      `}</style>
      {(() => {
        // 공통 데이터를 한 번만 계산
        const _todayKey = new Date().toISOString().slice(0, 10);
        const _allV2 = (() => { try { return JSON.parse(localStorage.getItem('lua_record_v2') || '{}'); } catch { return {}; } })();
        const _todayRec = _allV2[_todayKey] || {};
        const _curWeight = getLatestWeight()?.weight || 55;
        const _todaySteps = _todayRec.steps || 0;
        const _todayExerciseLog = _todayRec.exercise?.log || {};
        const _burnedFromSteps = Math.round(_todaySteps * 0.0005 * _curWeight);
        const _burnedFromExercise = Object.entries(_todayExerciseLog).reduce((sum, [name, mins]) => {
          const met = ALL_EXERCISES.find(e => e.name === name)?.met || 4.0;
          return sum + Math.round(met * _curWeight * (mins / 60));
        }, 0);
        const _cs = {
          background: 'rgba(255,255,255,0.2)', borderRadius: 30,
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.3)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
          minHeight: 140, display: 'flex', flexDirection: 'column',
        };

        // 체중 데이터
        const _latestW = getLatestWeight();
        const _bodyRecs = getBodyRecords();
        const _prevW = _bodyRecs.length >= 2 ? _bodyRecs[_bodyRecs.length - 2] : null;
        const _wDiff = _latestW && _prevW ? (_latestW.weight - _prevW.weight).toFixed(1) : null;
        const _last7w = _bodyRecs.slice(-7);
        const _wMin = _last7w.length > 0 ? Math.min(..._last7w.map(r => r.weight)) : 0;
        const _wMax = _last7w.length > 0 ? Math.max(..._last7w.map(r => r.weight)) : 0;
        const _wRange = _wMax - _wMin || 1;

        // 걸음수 7일 바
        const _stepBars = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          const dk = d.toISOString().slice(0, 10);
          _stepBars.push(_allV2[dk]?.steps || 0);
        }
        const _maxStep = Math.max(..._stepBars, 1);

        // 칼로리 데이터
        const _todayNut = getTodayNutrition();
        const _fullGoal = getFoodGoal();
        const _eaten = Math.round(_todayNut.kcal || 0);
        const _totalBurned = _burnedFromSteps + _burnedFromExercise;
        const _netCal = _eaten - _totalBurned;
        const _remaining = Math.max(0, _fullGoal.kcal - _netCal);

        // 수분 데이터
        const _wSettings = (() => { try { return { cupMl: 250, goalMl: 2000, ...JSON.parse(localStorage.getItem('lua_water_settings') || '{}') }; } catch { return { cupMl: 250, goalMl: 2000 }; } })();
        const _waterCups = _todayRec.water?.cups || 0;
        const _waterGoal = Math.ceil(_wSettings.goalMl / _wSettings.cupMl);
        const _cupMl = _wSettings.cupMl;

        // 컨디션 7일 데이터
        const _allChecks = (() => { try { return JSON.parse(localStorage.getItem('nou_condition_checks') || '[]'); } catch { return []; } })();
        const _cond7 = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          const dayChecks = _allChecks.filter(c => (c.date || c.timestamp?.slice(0,10)) === dk);
          if (dayChecks.length > 0) {
            const last = dayChecks[dayChecks.length - 1];
            _cond7.push({ date: dk, avg: ((last.energy || 5) + (last.mood || 5)) / 2 });
          } else {
            _cond7.push({ date: dk, avg: null });
          }
        }
        const _todayCond = _cond7[6]?.avg;
        const _condLabel = _todayCond ? (_todayCond >= 7 ? '좋음' : _todayCond >= 4 ? '보통' : '낮음') : null;

        // 수면 7일 데이터
        const _sleep7 = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          const rec = _allV2[dk];
          if (rec?.sleep?.hours > 0) {
            const bedHour = rec.sleep.bedtime ? parseInt(rec.sleep.bedtime.split(':')[0]) : null;
            _sleep7.push({ date: dk, hours: rec.sleep.hours, bedHour });
          } else {
            _sleep7.push({ date: dk, hours: null, bedHour: null });
          }
        }
        const _todaySleep = _sleep7[6]?.hours;

        const isEditing = editMode;

        // 오늘의 진행률 계산
        const _recordedItems = [];
        const _missingItems = [];
        if (_todayCond) _recordedItems.push('컨디션'); else _missingItems.push('컨디션');
        if (_todaySleep) _recordedItems.push('수면'); else _missingItems.push('수면');
        if (_eaten > 0) _recordedItems.push('식사'); else _missingItems.push('식사');
        if (_waterCups > 0) _recordedItems.push('수분'); else _missingItems.push('수분');
        if (_latestW) _recordedItems.push('체중'); else _missingItems.push('체중');
        if (_todaySteps > 0) _recordedItems.push('활동'); else _missingItems.push('활동');

        return (
          <>
          {/* 오늘의 진행률 */}
          <div style={{ margin: '0 22px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.3)', fontWeight: 500 }}>
              {_recordedItems.length === 6
                ? '오늘 기록 완료!'
                : _missingItems.length <= 2
                  ? `${_missingItems.join(' · ')} 미입력`
                  : `${_recordedItems.length}/6 기록 완료`}
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{
                  width: i < _recordedItems.length ? 14 : 6, height: 4, borderRadius: 2,
                  background: i < _recordedItems.length ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.06)',
                  transition: 'all 0.3s ease',
                }} />
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, margin: '0 18px' }}>
            {cardOrder.map((cardId, cardIdx) => {
              const isFirst = cardIdx === 0;
              const isLast = cardIdx === cardOrder.length - 1;
              const arrowBtn = (dir) => {
                const isLeft = dir === 'left';
                return (
                  <div
                    onClick={(e) => { e.stopPropagation(); moveCard(cardIdx, isLeft ? cardIdx - 1 : cardIdx + 1); }}
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      {isLeft ? <path d="M15 18l-6-6 6-6"/> : <path d="M9 6l6 6-6 6"/>}
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
                      {!isFirst && arrowBtn('left')}
                      <div style={{
                        background: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: '4px 14px',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                        </svg>
                        <span style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>{label}</span>
                      </div>
                      {!isLast && arrowBtn('right')}
                    </div>
                  )}
                  {content}
                </div>
              );

              if (cardId === 'condition') {
                return editWrap('컨디션', (
                  <div onClick={() => handleCardTap('condition', () => setShowConditionModal(true))} style={{ ..._cs, cursor: 'pointer', padding: '20px', animation: tappedCard === 'condition' ? 'cardTap 0.3s ease' : 'none', pointerEvents: isEditing ? 'none' : 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, flex: '0 0 auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(240,208,96,0.3))' }}><defs><linearGradient id="starCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFE066"/><stop offset="100%" stopColor="#E8B800"/></linearGradient></defs><path d="M10.48,23.25c-.15.41-.5.71-.86.75-.27.03-.78-.29-.9-.59l-1.53-4.02c-.48-1.26-1.41-2.1-2.67-2.58l-3.91-1.48c-.29-.11-.59-.51-.6-.76-.01-.39.23-.79.6-.93l3.9-1.49c1.27-.48,2.19-1.31,2.68-2.59l1.57-4.14c.08-.2.52-.44.74-.46.24-.02.77.21.86.46l1.57,4.14c.5,1.32,1.47,2.15,2.78,2.63l3.7,1.37c.31.11.66.55.67.83.02.42-.29.82-.68.97l-3.8,1.44c-1.26.48-2.2,1.32-2.67,2.58l-1.45,3.86z" fill="url(#starCard)" opacity="0.8"/><path d="M21.48,6.29c-1.03.59-.9,2.91-2.01,2.98-1.23.08-.99-1.68-1.94-2.78-.77-.88-2.68-.63-2.74-1.78-.07-1.27,2.01-1.1,2.74-1.91.87-.95.73-2.72,1.78-2.8,1.29-.1.98,1.81,1.95,2.77.87.86,2.67.71,2.73,1.8.07,1.08-1.29,1.02-2.51,1.72z" fill="url(#starCard)" opacity="0.8"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#b1b8ba' }}>컨디션</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{_todayCond ? _todayCond.toFixed(1) : '0'}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/10</span>
                        </div>
                        <div style={{ fontSize: 10, color: _todayCond ? (_todayCond >= 7 ? '#22C55E' : _todayCond >= 4 ? 'var(--text-muted)' : '#E05050') : 'var(--accent-primary, #89cef5)', marginTop: 4, minHeight: 14 }}>{_condLabel || (_todayCond ? '\u00A0' : '체크하기')}</div>
                      </div>
                      {(() => {
                        const pad = 5, w = 6 * 10 + pad * 2, h = 40;
                        const valid = _cond7.filter(c => c.avg !== null);
                        if (valid.length < 2) return null;
                        const pts = _cond7.map((c, i) => c.avg !== null ? { x: pad + i * 10, y: pad + (h - pad * 2) - ((c.avg - 1) / 9) * (h - pad * 2) } : null);
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
                ));
              }

              if (cardId === 'sleep') {
                return editWrap('수면', (
                  <div onClick={() => handleCardTap('sleep', () => setShowSleepModal(true))} style={{ ..._cs, cursor: 'pointer', padding: '20px', animation: tappedCard === 'sleep' ? 'cardTap 0.3s ease' : 'none', pointerEvents: isEditing ? 'none' : 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, flex: '0 0 auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(91,106,175,0.3))' }}><defs><linearGradient id="moonCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C8D0F0"/><stop offset="100%" stopColor="#5B6AAF"/></linearGradient></defs><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="url(#moonCard)" opacity="0.6"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#b1b8ba' }}>수면</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{_todaySleep || '0'}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>시간</span>
                        </div>
                        <div style={{ fontSize: 10, color: _todaySleep >= 7 ? '#22C55E' : _todaySleep >= 5 ? 'var(--text-muted)' : '#E05050', marginTop: 4, minHeight: 14 }}>{_todaySleep ? (_todaySleep >= 7 ? '충분' : _todaySleep >= 5 ? '보통' : '부족') : '\u00A0'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 3, height: 44, flexShrink: 0, position: 'relative' }}>
                        {_sleep7.map((s, i) => {
                          if (!s.hours) return <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.06)', alignSelf: 'center', marginTop: 19 }} />;
                          const barH = Math.max(8, (s.hours / 10) * 34);
                          let topPos = 4;
                          if (s.bedHour !== null) {
                            // 21시=0(기준), 22시=1, 23시=2, 0시=3, 1시=4, 2시=5
                            const norm = s.bedHour >= 18 ? s.bedHour - 21 : s.bedHour + 3;
                            topPos = Math.max(0, Math.min(norm * 2, 14));
                          }
                          const isToday = i === 6;
                          return (
                            <div key={i} style={{
                              width: 6, borderRadius: 3,
                              height: barH,
                              marginTop: topPos,
                              background: isToday
                                ? 'linear-gradient(180deg, #5B6AAF, #8B6AAF)'
                                : s.hours >= 7 ? 'rgba(91,106,175,0.3)' : 'rgba(91,106,175,0.15)',
                              transition: 'all 0.3s ease',
                            }} />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ));
              }

              if (cardId === 'food') {
                return editWrap('식사', (
                  <div onClick={(e) => { e.stopPropagation(); handleCardTap('food', () => setShowFoodModal(true)); }} style={{ ..._cs, cursor: 'pointer', padding: '20px', animation: tappedCard === 'food' ? 'cardTap 0.3s ease' : 'none', pointerEvents: isEditing ? 'none' : 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, flex: '0 0 auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="16" height="16" viewBox="0 0 1254 1254" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(123,198,123,0.3))' }}><defs><linearGradient id="appleCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A8E6A3"/><stop offset="100%" stopColor="#7BC67B"/></linearGradient></defs><path d="M852.51,1114.52C822.56,1133.36,790.72,1145.62,755.49,1148.31C718.9,1151.11,684.66,1142.94,652.14,1126.65C645.15,1123.15,638.33,1119.22,631.86,1114.87C628.65,1112.72,626.65,1113.54,623.94,1115.2C596.76,1131.87,567.54,1143,535.83,1147.21C491.83,1153.05,450.67,1143.99,411.83,1123.23C369.95,1100.84,336.1,1069,306.69,1032.31C243.86,953.89,200.68,865.58,176.61,768.11C162.75,711.98,159.24,654.92,166.15,597.45C172.23,546.91,187.01,499.36,216.16,456.92C248.57,409.71,292.47,378.61,347.36,363.01C391.12,350.57,435.67,348.92,480.62,354.47C518.12,359.11,554.54,368.34,590.23,380.63C592.44,381.39,594.82,381.67,596.97,382.14C598.41,359.44,599.8,337.56,601.19,315.63C590.93,317.2,580.22,319.19,569.43,320.44C526.57,325.37,485.28,320.34,446.56,300.15C418.24,285.37,395.38,264.25,376.51,238.74C348.56,200.95,330.22,158.8,320.39,112.9C320.08,111.43,319.84,109.95,319.62,108.47C317.74,95.9,321.66,89.96,334.08,88.2C347.93,86.24,361.84,84.4,375.79,83.56C419.19,80.94,462.16,83.39,503.56,98.09C553.43,115.79,593.86,145.54,620.07,192.46C625.39,201.98,629.27,212.29,633.88,222.38C636.78,217.79,639.84,212.77,643.09,207.87C661.04,180.78,683.41,157.84,709.46,138.56C726.51,125.95,748.78,135.42,751.3,156.2C752.54,166.47,747.98,174.47,739.69,180.66C720.61,194.88,703.83,211.44,689.71,230.67C669.45,258.27,657.8,289.38,653.28,323.02C650.87,340.97,650.42,359.18,649.28,377.29C648.95,382.59,649.99,383.17,655.09,381.34C690.88,368.52,727.35,358.25,764.96,352.44C818.12,344.21,870.99,344.39,922.73,361.04C987.39,381.84,1032.33,424.8,1060.25,486.13C1080.83,531.32,1087.87,579.32,1088.93,628.47C1090.56,703.51,1074.69,775.27,1047.53,844.76C1022.21,909.55,989.75,970.49,946.75,1025.43C919.92,1059.72,889.78,1090.66,852.51,1114.52z" fill="url(#appleCard)" opacity="0.6"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#b1b8ba' }}>식사</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{_eaten.toLocaleString()}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kcal</span>
                        </div>
                        <div style={{ fontSize: 10, color: _eaten > _fullGoal.kcal ? '#E85B5B' : 'var(--text-muted)', marginTop: 4, minHeight: 14 }}>
                          {_eaten > _fullGoal.kcal ? `${(_eaten - _fullGoal.kcal).toLocaleString()}kcal 초과` : `${_remaining.toLocaleString()}kcal 남음`}
                        </div>
                      </div>
                      {(() => {
                        const ringR = 22, ringC = 2 * Math.PI * ringR;
                        const remainPct = _fullGoal.kcal > 0 ? Math.max(0, Math.round((_remaining / _fullGoal.kcal) * 100)) : 100;
                        const ratio = _fullGoal.kcal > 0 ? _eaten / _fullGoal.kcal : 0;
                        const isOver = ratio > 1;
                        const baseFill = ringC * Math.min(ratio, 1);
                        const overFill = isOver ? ringC * Math.min(ratio - 1, 1) : 0;
                        return (
                          <svg width="52" height="52" viewBox="0 0 52 52">
                            <defs>
                              <linearGradient id="calRingGrad" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor={isOver ? '#E85B5B' : remainPct <= 20 ? '#E8A830' : remainPct <= 70 ? '#4DBDA0' : '#7BC67B'} />
                                <stop offset="100%" stopColor={isOver ? '#F5A0A0' : remainPct <= 20 ? '#FFDB70' : remainPct <= 70 ? '#6ECFB8' : '#A8E6A3'} />
                              </linearGradient>
                            </defs>
                            <circle cx="26" cy="26" r={ringR} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
                            <circle cx="26" cy="26" r={ringR} fill="none" stroke="url(#calRingGrad)" strokeWidth="5"
                              strokeDasharray={`${baseFill} ${ringC - baseFill}`} strokeLinecap="round"
                              opacity={isOver ? 0.35 : 1}
                              transform="rotate(-90 26 26)" style={{ transition: 'stroke-dasharray 0.3s ease' }} />
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
                ));
              }

              if (cardId === 'water') {
                return editWrap('수분', (
                  <div onClick={() => handleCardTap('water', () => setShowWaterModal(true))} style={{ ..._cs, cursor: 'pointer', padding: '20px', animation: tappedCard === 'water' ? 'cardTap 0.3s ease' : 'none', pointerEvents: isEditing ? 'none' : 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, flex: '0 0 auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(91,163,212,0.3))' }}><defs><linearGradient id="dropCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#B8E0F5"/><stop offset="100%" stopColor="#5BA3D4"/></linearGradient></defs><path d="M12 2.5c0 0-7.5 8-7.5 13a7.5 7.5 0 0015 0c0-5-7.5-13-7.5-13z" fill="url(#dropCard)" opacity="0.6"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#b1b8ba' }}>수분</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{(_waterCups * _cupMl).toLocaleString()}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ml</span>
                        </div>
                        <div style={{ fontSize: 10, color: _waterCups >= _waterGoal ? '#22C55E' : 'var(--text-muted)', marginTop: 4, minHeight: 14 }}>{_waterCups >= _waterGoal ? '목표 달성!' : `${((_waterGoal - _waterCups) * _cupMl).toLocaleString()}ml 남음`}</div>
                      </div>
                      {(() => {
                        const ringR = 22, ringC = 2 * Math.PI * ringR;
                        const fillPct = Math.min(_waterCups / _waterGoal, 1);
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
                ));
              }

              if (cardId === 'weight') {
                return editWrap('체중', (
                  <div onClick={() => handleCardTap('weight', () => setShowWeightModal(true))} style={{ ..._cs, cursor: 'pointer', padding: '20px', animation: tappedCard === 'weight' ? 'cardTap 0.3s ease' : 'none', pointerEvents: isEditing ? 'none' : 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, flex: '0 0 auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <img src="/icons/scale.svg" width="18" height="18" alt="" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(180,180,180,0.3))' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#b1b8ba' }}>체중</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                      <div>
                        {_latestW ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                              <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{_latestW.weight}</span>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kg</span>
                            </div>
                            <div style={{ fontSize: 10, color: _wDiff !== null ? (Number(_wDiff) > 0 ? '#E05050' : '#22C55E') : 'transparent', marginTop: 4, minHeight: 14 }}>
                              {_wDiff !== null ? `${Number(_wDiff) > 0 ? '↑' : '↓'} ${Math.abs(Number(_wDiff))}kg` : '\u00A0'}
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                              <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>0</span>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kg</span>
                            </div>
                            <div style={{ fontSize: 10, marginTop: 4, minHeight: 14 }}>{'\u00A0'}</div>
                          </>
                        )}
                      </div>
                      {_last7w.length >= 2 && (() => {
                        const pad = 5;
                        const w = (_last7w.length - 1) * 10 + pad * 2;
                        const h = 40;
                        const pts = _last7w.map((r, i) => ({ x: pad + i * 10, y: pad + (h - pad * 2) - ((r.weight - _wMin) / _wRange) * (h - pad * 2) }));
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
                                <stop offset="0%" stopColor="#FFFFFF" />
                                <stop offset="100%" stopColor="#D0D0D0" />
                              </linearGradient>
                            </defs>
                            <path d={d} fill="none" stroke="url(#wLineGrad)" strokeWidth="2.5" strokeLinecap="round" />
                            <circle cx={last.x} cy={last.y} r="3.5" fill="#D0D0D0" />
                          </svg>
                        );
                      })()}
                    </div>
                  </div>
                ));
              }

              if (cardId === 'activity') {
                return editWrap('활동', (
                  <div onClick={() => handleCardTap('activity', () => setShowActivityModal(true))} style={{ ..._cs, cursor: 'pointer', padding: '20px', animation: tappedCard === 'activity' ? 'cardTap 0.3s ease' : 'none', pointerEvents: isEditing ? 'none' : 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, flex: '0 0 auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(232,130,53,0.3))' }}><defs><linearGradient id="fireCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F5C8A0"/><stop offset="100%" stopColor="#E87835"/></linearGradient></defs><path d="M9.28,0l.46.29c2.08,1.04,3.6,2.7,4.6,4.79.77,1.62,1.22,3.24,1.18,5.12,1.33-.89,1.7-3.24,1.92-3.19.1.02.26.14.39.24,3.09,2.49,4.39,6.5,3.11,10.36-1.15,3.47-4.42,6.09-8.15,6.39l-1.59-.03c-3.19-.29-6.04-2.11-7.57-4.99-2.14-4.06-1.01-8.98,2.62-11.77,1.25-.96,2.15-2.26,2.61-3.77.26-.85.19-1.71.17-2.59l.02-.85h.22,0Z" fill="url(#fireCard)" opacity="0.6"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#b1b8ba' }}>활동</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{(_burnedFromSteps + _burnedFromExercise) > 0 ? (_burnedFromSteps + _burnedFromExercise).toLocaleString() : '0'}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kcal</span>
                        </div>
                        <div style={{ fontSize: 10, color: '#22C55E', marginTop: 4, minHeight: 14 }}>{_todaySteps > 0 ? `${_todaySteps.toLocaleString()}걸음` : '\u00A0'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 36, flexShrink: 0 }}>
                        {_stepBars.map((s, i) => (
                          <div key={i} style={{
                            width: 6, borderRadius: 3,
                            height: s > 0 ? Math.max(6, (s / _maxStep) * 34) : 6,
                            background: i === 6
                              ? 'linear-gradient(180deg, #FF9F43, #F07030)'
                              : s > 0 ? 'rgba(255,159,67,0.25)' : 'rgba(0,0,0,0.06)',
                            transition: 'height 0.3s ease',
                          }} />
                        ))}
                      </div>
                    </div>
                  </div>
                ));
              }

              return null;
            })}
          </div>
          </>
        );
      })()}

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

      {showWaterModal && (
        <WaterIntakeModal
          onClose={() => setShowWaterModal(false)}
          onUpdate={() => { setShowWaterModal(false); setWeightRefreshKey(k => k + 1); }}
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

      {showConditionModal && (
        <ConditionCheckModal
          selections={selections}
          sliderPcts={sliderPcts}
          onSelect={(id, val) => { handleSelect(id, val); }}
          onSliderChange={(key, pct) => setSliderPcts(prev => ({ ...prev, [key]: pct }))}
          onUpdate={() => { handleUpdate(); setShowConditionModal(false); }}
          onClose={() => setShowConditionModal(false)}
        />
      )}

      {showSleepModal && (
        <SleepInputModal
          onClose={() => setShowSleepModal(false)}
          onUpdate={() => { setShowSleepModal(false); setWeightRefreshKey(k => k + 1); }}
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

function ConditionCheckModal({ selections, sliderPcts, onSelect, onSliderChange, onUpdate, onClose }) {
  const sliders = [
    { key: 'mood', label: '기분', rgb: [245,194,203], labels: MOOD_LABELS,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(212,112,126,0.3))' }}><defs><linearGradient id="heartM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F0B8C0"/><stop offset="100%" stopColor="#D4707E"/></linearGradient></defs><path d="M12 4.5C10 2 6.5 1.5 4.5 4c-2 2.5-1.5 6 1 8.5L12 20l6.5-7.5c2.5-2.5 3-6 1-8.5C17.5 1.5 14 2 12 4.5z" fill="url(#heartM)" opacity="0.6"/></svg> },
    { key: 'energy', label: '에너지', rgb: [245,230,163], labels: ENERGY_LABELS,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(232,161,53,0.3))' }}><defs><linearGradient id="boltM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F5DFA0"/><stop offset="100%" stopColor="#E8A135"/></linearGradient></defs><path d="M14 1L3 14h8l-3 9 12-13h-8l2-9z" fill="url(#boltM)" opacity="0.6"/></svg> },
    { key: 'water', label: '수분', rgb: [194,234,255], labels: WATER_LABELS,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(91,163,212,0.3))' }}><defs><linearGradient id="dropM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#B8E0F5"/><stop offset="100%" stopColor="#5BA3D4"/></linearGradient></defs><path d="M12 2.5c0 0-7.5 8-7.5 13a7.5 7.5 0 0015 0c0-5-7.5-13-7.5-13z" fill="url(#dropM)" opacity="0.6"/></svg> },
  ];

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
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 24, textAlign: 'center' }}>컨디션 체크</div>

        {sliders.map((s, si) => {
          const val = selections[s.key];
          const pct = sliderPcts[s.key];
          const trackH = 9;
          const color = `rgb(${s.rgb.join(',')})`;
          const calcFromEvent = (e, rect) => {
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
            const rawPct = (x / rect.width) * 100;
            onSliderChange(s.key, rawPct);
            const v = Math.round((x / rect.width) * 9) + 1;
            onSelect(s.key, Math.max(1, Math.min(10, v)));
          };
          const handleStart = (e) => {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            calcFromEvent(e, rect);
            const handleMove = (ev) => { ev.preventDefault(); calcFromEvent(ev, rect); };
            const handleEnd = () => {
              window.removeEventListener('touchmove', handleMove);
              window.removeEventListener('touchend', handleEnd);
              window.removeEventListener('mousemove', handleMove);
              window.removeEventListener('mouseup', handleEnd);
            };
            window.addEventListener('touchmove', handleMove, { passive: false });
            window.addEventListener('touchend', handleEnd);
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleEnd);
          };
          return (
            <div key={s.key} style={{ marginBottom: si < 2 ? 22 : 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 500, color: 'var(--text-muted)' }}>{s.icon}{s.label}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color }}>{s.labels[val - 1]}</span>
              </div>
              <div
                onTouchStart={handleStart} onMouseDown={handleStart}
                style={{
                  position: 'relative', width: '100%', height: trackH, borderRadius: trackH / 2,
                  background: 'rgba(0,0,0,0.06)', cursor: 'pointer', touchAction: 'none',
                }}
              >
                <div style={{
                  position: 'absolute', top: 0, left: 0, height: '100%',
                  width: `${Math.max(pct, 5)}%`, borderRadius: trackH / 2,
                  background: `linear-gradient(90deg, rgba(255,255,255,0.3), ${color}40)`,
                  transition: 'width 0.05s ease-out',
                }} />
                <div style={{
                  position: 'absolute', top: '50%', left: `${Math.max(pct, 2)}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 22, height: 22, borderRadius: '50%',
                  background: `rgb(${Math.round(255+(s.rgb[0]-255)*pct/100)},${Math.round(255+(s.rgb[1]-255)*pct/100)},${Math.round(255+(s.rgb[2]-255)*pct/100)})`,
                  border: '1.5px solid rgba(255,255,255,0.9)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                  pointerEvents: 'none',
                  transition: 'left 0.05s ease-out',
                }} />
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
            border: 'none', background: 'var(--bg-input, #F2F3F5)',
            color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>취소</button>
          <button onClick={onUpdate} style={{
            flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
            border: 'none', background: 'var(--accent-primary)',
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>업데이트</button>
        </div>
      </div>
    </div>
  );
}

function AddWeightModal({ onSave, onClose, latest }) {
  const [weight, setWeight] = useState(latest ? latest.weight : 55.0);
  const adjust = (delta) => setWeight(w => Math.round((w + delta) * 10) / 10);
  const btnStyle = {
    width: 48, height: 48, borderRadius: '50%', border: 'none',
    background: 'var(--bg-input, #F2F3F5)', fontSize: 22, fontWeight: 600,
    color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
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
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 24, textAlign: 'center' }}>오늘 몸무게</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 8 }}>
          <button onClick={() => adjust(-1)} style={btnStyle}>−1</button>
          <button onClick={() => adjust(-0.1)} style={{ ...btnStyle, width: 40, height: 40, fontSize: 18 }}>−</button>
          <div style={{ textAlign: 'center', minWidth: 80 }}>
            <span style={{ fontSize: 36, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{weight.toFixed(1)}</span>
          </div>
          <button onClick={() => adjust(0.1)} style={{ ...btnStyle, width: 40, height: 40, fontSize: 18 }}>+</button>
          <button onClick={() => adjust(1)} style={btnStyle}>+1</button>
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>kg</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
            border: 'none', background: 'var(--bg-input, #F2F3F5)',
            color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>취소</button>
          <button onClick={() => onSave(weight)} style={{
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
      today.steps = Number(steps);
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
              placeholder="걸음 수 입력" type="number" inputMode="numeric"
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: 'var(--bg-input, #F2F3F5)', fontSize: 20, fontWeight: 600,
                color: 'var(--text-primary)', fontFamily: 'var(--font-display)',
                textAlign: 'center', outline: 'none',
              }}
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

// ===== Water Intake Modal =====
function WaterIntakeModal({ onClose, onUpdate }) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const getAll = () => { try { return JSON.parse(localStorage.getItem('lua_record_v2') || '{}'); } catch { return {}; } };
  const getSettings = () => { try { return { cupMl: 250, goalMl: 2000, ...JSON.parse(localStorage.getItem('lua_water_settings') || '{}') }; } catch { return { cupMl: 250, goalMl: 2000 }; } };

  const settings = getSettings();
  const { cupMl, goalMl } = settings;
  const totalCups = Math.ceil(goalMl / cupMl);

  const allData = getAll();
  const todayRec = allData[todayKey] || {};
  const [cups, setCups] = useState(todayRec.water?.cups || 0);
  const [ripple, setRipple] = useState(false);
  const [splash, setSplash] = useState(false);

  const fillPct = Math.min(cups / totalCups, 1);
  const currentMl = cups * cupMl;
  const goalReached = cups >= totalCups;

  const addCup = () => {
    const next = cups + 1;
    setCups(next);
    setSplash(true);
    setRipple(true);
    setTimeout(() => setSplash(false), 600);
    setTimeout(() => setRipple(false), 800);
    hapticLight();
    if (navigator.vibrate) navigator.vibrate(8);
    // save
    const all = getAll();
    const rec = all[todayKey] || { date: todayKey };
    rec.water = { cups: next };
    all[todayKey] = rec;
    localStorage.setItem('lua_record_v2', JSON.stringify(all));
  };

  const removeCup = () => {
    if (cups <= 0) return;
    const next = cups - 1;
    setCups(next);
    hapticLight();
    const all = getAll();
    const rec = all[todayKey] || { date: todayKey };
    rec.water = { cups: next };
    all[todayKey] = rec;
    localStorage.setItem('lua_record_v2', JSON.stringify(all));
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
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, textAlign: 'center' }}>수분 섭취</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 24 }}>1잔 = {cupMl}ml</div>

        {/* Water bottle visualization */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <div style={{ position: 'relative', width: 120, height: 160, cursor: 'pointer' }} onClick={addCup}>
            {/* Bottle shape */}
            <svg width="120" height="160" viewBox="0 0 120 160" style={{ position: 'absolute', top: 0, left: 0 }}>
              <defs>
                <clipPath id="bottleClip">
                  <path d="M42 12 Q42 4 50 4 L70 4 Q78 4 78 12 L78 24 Q96 32 96 48 L96 140 Q96 152 84 152 L36 152 Q24 152 24 140 L24 48 Q24 32 42 24 Z" />
                </clipPath>
                <linearGradient id="waterFillGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#4A9BD9" />
                  <stop offset="100%" stopColor="#89CEF5" />
                </linearGradient>
              </defs>
              {/* Bottle outline */}
              <path d="M42 12 Q42 4 50 4 L70 4 Q78 4 78 12 L78 24 Q96 32 96 48 L96 140 Q96 152 84 152 L36 152 Q24 152 24 140 L24 48 Q24 32 42 24 Z"
                fill="none" stroke="rgba(91,163,212,0.3)" strokeWidth="2" />
              {/* Water fill */}
              <g clipPath="url(#bottleClip)">
                <rect x="20" y={152 - (fillPct * 148)}
                  width="80" height={fillPct * 148}
                  fill="url(#waterFillGrad)" opacity="0.7"
                  style={{ transition: 'y 0.5s cubic-bezier(0.4, 0, 0.2, 1), height 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                {/* Wave animation */}
                {fillPct > 0 && (
                  <path d={`M20 ${152 - fillPct * 148} Q40 ${152 - fillPct * 148 - (ripple ? 8 : 3)} 60 ${152 - fillPct * 148} Q80 ${152 - fillPct * 148 + (ripple ? 8 : 3)} 100 ${152 - fillPct * 148} L100 152 L20 152 Z`}
                    fill="url(#waterFillGrad)" opacity="0.5"
                    style={{ transition: 'all 0.5s ease' }} />
                )}
              </g>
              {/* Percentage text inside bottle */}
              <text x="60" y="100" textAnchor="middle" fontSize="14" fontWeight="600"
                fill={fillPct > 0.5 ? '#fff' : 'var(--text-muted)'} fontFamily="var(--font-display)">
                {Math.round(fillPct * 100)}%
              </text>
            </svg>
            {/* Splash effect */}
            {splash && (
              <div style={{
                position: 'absolute', top: Math.max(4, 152 - fillPct * 148 - 20), left: '50%',
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
              }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} style={{
                    position: 'absolute',
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#89CEF5',
                    left: Math.cos(i * Math.PI / 3) * 20,
                    top: Math.sin(i * Math.PI / 3) * 15,
                    animation: 'waterSplash 0.6s ease-out forwards',
                    opacity: 0.8,
                  }} />
                ))}
              </div>
            )}
          </div>

          {/* Current ml display */}
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <span style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              {currentMl.toLocaleString()}
            </span>
            <span style={{ fontSize: 14, color: 'var(--text-muted)', marginLeft: 4 }}>ml</span>
          </div>
          <div style={{ fontSize: 12, color: goalReached ? '#22C55E' : 'var(--text-muted)', marginTop: 4, fontWeight: goalReached ? 600 : 400 }}>
            {goalReached ? '목표 달성!' : `목표 ${goalMl.toLocaleString()}ml (${(goalMl - currentMl).toLocaleString()}ml 남음)`}
          </div>
        </div>

        {/* Cup count display */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 24 }}>
          <button onClick={removeCup} style={{
            width: 40, height: 40, borderRadius: '50%', border: 'none',
            background: cups > 0 ? 'var(--bg-input, #F2F3F5)' : 'transparent',
            fontSize: 20, fontWeight: 600, color: cups > 0 ? 'var(--text-primary)' : 'transparent',
            cursor: cups > 0 ? 'pointer' : 'default', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>-</button>
          <div style={{ textAlign: 'center', minWidth: 60 }}>
            <span style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{cups}</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>잔</span>
          </div>
          <button onClick={addCup} style={{
            width: 40, height: 40, borderRadius: '50%', border: 'none',
            background: 'rgba(91,163,212,0.15)',
            fontSize: 20, fontWeight: 600, color: '#5BA3D4',
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>+</button>
        </div>

        {/* Add water button */}
        <button onClick={addCup} style={{
          width: '100%', padding: '16px 0', borderRadius: 'var(--btn-radius)',
          border: 'none', background: goalReached ? 'linear-gradient(135deg, #22C55E, #4ADE80)' : 'linear-gradient(135deg, #5BA3D4, #89CEF5)',
          color: '#fff', fontSize: 16, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.3s ease',
          transform: splash ? 'scale(0.97)' : 'scale(1)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2.5c0 0-7.5 8-7.5 13a7.5 7.5 0 0015 0c0-5-7.5-13-7.5-13z" fill="#fff" opacity="0.9"/>
          </svg>
          한 잔 마시기 ({cupMl}ml)
        </button>

        <button onClick={onUpdate} style={{
          width: '100%', padding: '14px 0', borderRadius: 'var(--btn-radius)',
          border: 'none', background: 'var(--bg-input, #F2F3F5)',
          color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit', marginTop: 10,
        }}>닫기</button>

        <style>{`
          @keyframes waterSplash {
            0% { transform: scale(1) translateY(0); opacity: 0.8; }
            100% { transform: scale(0.3) translateY(-25px); opacity: 0; }
          }
        `}</style>
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

// ===== Sleep Input Modal =====
const SLEEP_QUALITIES = ['깊은 수면', '보통', '얕은 수면'];

function SleepInputModal({ onClose, onUpdate }) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const getAll = () => { try { return JSON.parse(localStorage.getItem('lua_record_v2') || '{}'); } catch { return {}; } };

  const allData = getAll();
  const todayRec = allData[todayKey] || {};
  const [sleepHours, setSleepHours] = useState(todayRec.sleep?.hours ?? 7);
  const [sleepQuality, setSleepQuality] = useState(todayRec.sleep?.quality || null);
  const [sleepBedtime, setSleepBedtime] = useState(todayRec.sleep?.bedtime || null);
  const [sleepWakeTime, setSleepWakeTime] = useState(todayRec.sleep?.wakeTime || null);
  const [sleepMode, setSleepMode] = useState(todayRec.sleep?.bedtime ? 'time' : 'simple');

  const calcSleepFromTime = (bed, wake) => {
    if (!bed || !wake) return;
    const [bh, bm] = bed.split(':').map(Number);
    const [wh, wm] = wake.split(':').map(Number);
    let bedMin = bh * 60 + bm;
    let wakeMin = wh * 60 + wm;
    if (wakeMin <= bedMin) wakeMin += 24 * 60;
    const diff = (wakeMin - bedMin) / 60;
    setSleepHours(Math.round(diff * 2) / 2);
  };

  const handleSave = () => {
    const all = getAll();
    const rec = all[todayKey] || { date: todayKey };
    rec.sleep = { hours: sleepHours, quality: sleepQuality, bedtime: sleepBedtime, wakeTime: sleepWakeTime };
    all[todayKey] = rec;
    localStorage.setItem('lua_record_v2', JSON.stringify(all));
    hapticLight();
    onUpdate?.();
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="moonModal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C8D0F0"/><stop offset="100%" stopColor="#5B6AAF"/></linearGradient></defs><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="url(#moonModal)" opacity="0.7"/></svg>
          <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>수면 기록</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 24 }}>
          {sleepQuality ? `${sleepHours}시간 · ${sleepQuality}` : `${sleepHours}시간`}
        </div>

        {/* 입력 모드 토글 */}
        <div style={{ display: 'flex', background: 'rgba(91,106,175,.08)', borderRadius: 10, padding: 3, marginBottom: 20 }}>
          {[{ key: 'simple', label: '간단 입력' }, { key: 'time', label: '시간 입력' }].map(m => (
            <button key={m.key} onClick={() => setSleepMode(m.key)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: sleepMode === m.key ? 600 : 400,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: sleepMode === m.key ? 'rgba(255,255,255,.95)' : 'transparent',
              color: sleepMode === m.key ? '#5B6AAF' : 'var(--text-muted)',
              boxShadow: sleepMode === m.key ? '0 1px 4px rgba(91,106,175,.15)' : 'none',
              transition: 'all 0.15s ease',
            }}>{m.label}</button>
          ))}
        </div>

        {/* 간단 입력 */}
        {sleepMode === 'simple' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{ textAlign: 'center', minWidth: 56 }}>
              <span style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{sleepHours}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 2 }}>시간</span>
            </div>
            <div style={{ flex: 1 }}>
              <input type="range" min="2" max="12" step="0.5" value={sleepHours}
                onChange={e => setSleepHours(parseFloat(e.target.value))}
                style={{
                  width: '100%', height: 6, appearance: 'none', WebkitAppearance: 'none',
                  background: `linear-gradient(90deg, #5B6AAF ${((sleepHours - 2) / 10) * 100}%, rgba(91,106,175,.15) ${((sleepHours - 2) / 10) * 100}%)`,
                  borderRadius: 3, outline: 'none',
                }} />
            </div>
          </div>
        )}

        {/* 시간 입력 */}
        {sleepMode === 'time' && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>잠든 시간</div>
                <input type="time" value={sleepBedtime || ''}
                  onChange={e => {
                    const v = e.target.value;
                    setSleepBedtime(v);
                    if (v && sleepWakeTime) calcSleepFromTime(v, sleepWakeTime);
                  }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 14, fontWeight: 500,
                    border: '1px solid rgba(91,106,175,.2)', background: 'rgba(91,106,175,.04)',
                    color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none',
                    boxSizing: 'border-box', height: 42,
                    WebkitAppearance: 'none', MozAppearance: 'none',
                  }}
                />
              </div>
              <div style={{ fontSize: 16, color: '#5B6AAF', paddingBottom: 12, fontWeight: 500 }}>→</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>일어난 시간</div>
                <input type="time" value={sleepWakeTime || ''}
                  onChange={e => {
                    const v = e.target.value;
                    setSleepWakeTime(v);
                    if (sleepBedtime && v) calcSleepFromTime(sleepBedtime, v);
                  }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 14, fontWeight: 500,
                    border: '1px solid rgba(91,106,175,.2)', background: 'rgba(91,106,175,.04)',
                    color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none',
                    boxSizing: 'border-box', height: 42,
                    WebkitAppearance: 'none', MozAppearance: 'none',
                  }}
                />
              </div>
            </div>
            {sleepBedtime && sleepWakeTime && (
              <div style={{
                textAlign: 'center', padding: '10px 0', borderRadius: 10,
                background: 'rgba(91,106,175,.05)',
              }}>
                <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{sleepHours}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>시간 수면</span>
              </div>
            )}
          </div>
        )}

        {/* 수면의 질 */}
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 500 }}>수면의 질</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {SLEEP_QUALITIES.map(q => {
            const active = sleepQuality === q;
            return (
              <button key={q} onClick={() => { setSleepQuality(active ? null : q); hapticLight(); }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: active ? 600 : 400,
                  border: `1.5px solid ${active ? 'rgba(91,106,175,.4)' : 'rgba(91,106,175,.12)'}`,
                  background: active ? 'rgba(91,106,175,.1)' : 'var(--bg-input, #F2F3F5)',
                  color: active ? '#5B6AAF' : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                  fontFamily: 'inherit',
                }}>{q}</button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
            border: 'none', background: 'var(--bg-input, #F2F3F5)',
            color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>취소</button>
          <button onClick={handleSave} style={{
            flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
            border: 'none', background: '#5B6AAF',
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>저장</button>
        </div>
      </div>
    </div>
  );
}
