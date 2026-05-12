import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { hapticLight } from '../utils/haptic';
import InsightCard from '../components/InsightCard';
import SkinWeather from '../components/SkinWeather';
import { getLatestRecord } from '../storage/SkinStorage';
import { getProfile, saveProfile, SKIN_TYPES, SKIN_CONCERNS, GENDER_OPTIONS, getCategoryColor } from '../storage/ProfileStorage';
import { getTodayNutrition, getTodayFoods, getFoodGoal, saveFoodRecord } from '../storage/FoodStorage';
import { AddFoodModal } from './RecordPage';
import { getWeatherData, refreshWeatherIfNeeded } from '../storage/WeatherStorage';
import { calculateCycleState, getActivePosition, getCycleData, saveCycleData } from '../utils/cycleUtils';
import { getTodayProgress } from '../storage/RoutineCheckStorage';
import { getLatestWeight, getBodyRecords, saveBodyRecord } from '../storage/BodyStorage';
import { calculateCaffeineState } from '../utils/caffeineUtils';
import { calculateSkinScore, getScoreState, getTopImpactSignals, getDotColors } from '../utils/skinCheckUtils';
import {
  getTodayChecks, getLatestCheck, saveConditionCheck,
  shouldResetCheck, getMinutesSinceLastCheck,
  getTodayBloodSugar, saveBloodSugar, getBloodSugarChecks,
  getTodaySkinSubCheck, saveSkinSubCheck,
} from '../storage/ConditionStorage';
import { getSupplementItems, getSupplementChecks, toggleSupplementCheck, addSupplementItem, deleteSupplementItem } from '../storage/SupplementStorage';

function useSwipeDown(onClose) {
  const startY = useRef(0);
  const currentY = useRef(0);
  const dragging = useRef(false);
  const elRef = useRef(null);

  const onTouchStart = useCallback((e) => {
    const el = elRef.current;
    if (el && el.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    currentY.current = 0;
    dragging.current = true;
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!dragging.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy < 0) { currentY.current = 0; if (elRef.current) elRef.current.style.transform = ''; return; }
    currentY.current = dy;
    if (elRef.current) elRef.current.style.transform = `translateY(${dy}px)`;
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    if (currentY.current > 120) {
      if (elRef.current) elRef.current.style.transition = 'transform 0.25s ease';
      if (elRef.current) elRef.current.style.transform = 'translateY(100%)';
      setTimeout(() => onClose(), 200);
    } else {
      if (elRef.current) { elRef.current.style.transition = 'transform 0.2s ease'; elRef.current.style.transform = ''; }
      setTimeout(() => { if (elRef.current) elRef.current.style.transition = ''; }, 200);
    }
  }, [onClose]);

  return { elRef, onTouchStart, onTouchMove, onTouchEnd };
}

function getTimeMode() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 21) return 'afternoon';
  return 'evening'; // 21:00~04:59
}

function getTimeAccent(mode) {
  if (mode === 'morning') return '#FFE082';
  if (mode === 'afternoon') return '#FFBB80';
  return '#C5B3D9';
}

function getGreeting(nickname) {
  const h = new Date().getHours();
  const name = nickname ? `, ${nickname}님` : '';
  if (h >= 5 && h < 12) return { main: `좋은 아침이에요${name} ☀`, sub: '오늘은 어떤 기분이에요?' };
  if (h >= 12 && h < 21) return { main: `오후도 잘 보내고 있나요?${name ? ' ' + nickname + '님' : ''} ☁`, sub: '점심 후 컨디션 어때요?' };
  if (h >= 21 && h < 24) return { main: `오늘 하루 어땠어요?${name ? ' ' + nickname + '님' : ''} 🌙`, sub: '함께 마무리해요 ✨' };
  return { main: `늦게까지 깨어 있네요${name ? ' ' + nickname + '님' : ''} ✨`, sub: '오늘 하루 정리해볼까요?' };
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
  if (!check) return { status: '오늘 컨디션 어때요?', sub: '체크하면 AI가 원인을 분석해줘요' };
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
    sub = '원인을 분석해서 케어 방법 알려줄게요';
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

export default function HomePage({ onMeasure, onTabChange, onOpenRoutine, colorMode }) {
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
  const [detailPage, setDetailPage] = useState(null); // { type: 'sleep'|'condition'|'meal', data: any }
  const [showWeather, setShowWeather] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [showCalorieExplain, setShowCalorieExplain] = useState(false);
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [showBloodSugarModal, setShowBloodSugarModal] = useState(false);
  const [showDrinkModal, setShowDrinkModal] = useState(false);
  const [showEffectCheckModal, setShowEffectCheckModal] = useState(false);
  const [effectCheckDrink, setEffectCheckDrink] = useState(null);
  const [showSupplementModal, setShowSupplementModal] = useState(false);
  const [showSkinCheckModal, setShowSkinCheckModal] = useState(false);
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [homeView, setHomeView] = useState('cards'); // 'cards' | 'briefing'
  const [heroVersion, setHeroVersion] = useState('v2'); // 'v1' | 'v2'
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const isToday = selectedDate === new Date().toISOString().slice(0, 10);
  const [dataRefreshKey, setWeightRefreshKey] = useState(0);
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
    { id: 'blood_sugar', label: '혈당' },
    { id: 'drink', label: '음료' },
    { id: 'supplement', label: '영양제' },
    { id: 'skin_check', label: '피부' },
    { id: 'weather', label: '날씨' },
    { id: 'cycle', label: '주기' },
  ];
  const CARD_ORDER_VERSION = 14;
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
  const [dragState, setDragState] = useState({ dragging: false, cardId: null, startIdx: -1, overIdx: -1, x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const gridRef = useRef(null);
  const longPressTimer = useRef(null);
  const cardRectsRef = useRef([]);

  const saveCardOrder = useCallback((order) => {
    setCardOrder(order);
    localStorage.setItem('lua_home_card_order', JSON.stringify(order));
  }, []);

  // 드래그 중 카드 위치 계산
  const getDropIndex = useCallback((x, y) => {
    const rects = cardRectsRef.current;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (!r) continue;
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    // 가장 가까운 카드 찾기
    let closest = -1, minDist = Infinity;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (!r) continue;
      const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < minDist) { minDist = dist; closest = i; }
    }
    return closest;
  }, []);

  // 롱프레스 시작 → 편집 모드 + 드래그 시작
  const handleLongPressStart = useCallback((e, cardId, cardIdx) => {
    if (editMode && e.type === 'touchstart') {
      // 이미 편집 모드면 바로 드래그 시작
      const touch = e.touches[0];
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      // 카드 위치 캐시
      if (gridRef.current) {
        const cards = gridRef.current.children;
        cardRectsRef.current = Array.from(cards).map(c => c.getBoundingClientRect());
      }
      setDragState({ dragging: true, cardId, startIdx: cardIdx, overIdx: cardIdx, x: touch.clientX, y: touch.clientY, offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top });
      return;
    }
    const startTouch = e.touches?.[0];
    const startX = startTouch?.clientX || 0;
    const startY = startTouch?.clientY || 0;
    // 움직이면 롱프레스 취소
    const cancelOnMove = (ev) => {
      const t = ev.touches[0];
      if (Math.abs(t.clientX - startX) > 10 || Math.abs(t.clientY - startY) > 10) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
        document.removeEventListener('touchmove', cancelOnMove);
      }
    };
    document.addEventListener('touchmove', cancelOnMove, { passive: true });
    longPressTimer.current = setTimeout(() => {
      document.removeEventListener('touchmove', cancelOnMove);
      hapticLight();
      if (navigator.vibrate) navigator.vibrate(20);
      setEditMode(true);
      if (startTouch && gridRef.current) {
        const el = e.currentTarget || e.target.closest('[data-card-id]');
        if (el) {
          const rect = el.getBoundingClientRect();
          const cards = gridRef.current.children;
          cardRectsRef.current = Array.from(cards).map(c => c.getBoundingClientRect());
          setDragState({ dragging: true, cardId, startIdx: cardIdx, overIdx: cardIdx, x: startTouch.clientX, y: startTouch.clientY, offsetX: startTouch.clientX - rect.left, offsetY: startTouch.clientY - rect.top });
        }
      }
    }, 500);
  }, [editMode]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  const handleDragEnd = useCallback(() => {
    handleLongPressEnd();
    if (!dragState.dragging) return;
    const { startIdx, overIdx } = dragState;
    if (startIdx !== overIdx && overIdx >= 0) {
      setCardOrder(prev => {
        const next = [...prev];
        const [moved] = next.splice(startIdx, 1);
        next.splice(overIdx, 0, moved);
        localStorage.setItem('lua_home_card_order', JSON.stringify(next));
        return next;
      });
      hapticLight();
    }
    setDragState({ dragging: false, cardId: null, startIdx: -1, overIdx: -1, x: 0, y: 0, offsetX: 0, offsetY: 0 });
  }, [dragState, handleLongPressEnd]);

  // 드래그 중 전역 touch 이벤트
  useEffect(() => {
    if (!dragState.dragging) return;
    const onMove = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const overIdx = getDropIndex(touch.clientX, touch.clientY);
      setDragState(prev => ({ ...prev, x: touch.clientX, y: touch.clientY, overIdx: overIdx >= 0 ? overIdx : prev.overIdx }));
    };
    const onEnd = () => handleDragEnd();
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, [dragState.dragging, getDropIndex, handleDragEnd]);

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

  // 홈 로드 시 저장된 위치로 날씨 자동 갱신
  useEffect(() => {
    refreshWeatherIfNeeded().then(() => setWeightRefreshKey(k => k + 1));
  }, []);

  // 카페인 효과 체크 예약 확인 (앱 재진입 시)
  useEffect(() => {
    const checkScheduled = () => {
      try {
        const raw = localStorage.getItem('lua_caffeine_effect_scheduled');
        if (!raw) return;
        const scheduled = JSON.parse(raw);
        if (new Date() >= new Date(scheduled.fireAt)) {
          setEffectCheckDrink({
            drunkAt: new Date(new Date(scheduled.fireAt).getTime() - 60 * 60 * 1000).toISOString(),
            drinkName: scheduled.drinkName,
            amount: scheduled.amount,
            caffeineMg: 0,
          });
          setShowEffectCheckModal(true);
        }
      } catch {}
    };
    checkScheduled();
    const interval = setInterval(checkScheduled, 60000);
    return () => clearInterval(interval);
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
    <div style={{
      minHeight: '100dvh', paddingBottom: 90,
    }}>

      {/* ===== 1. 히어로 영역 ===== */}
      {heroVersion === 'v1' ? (
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
          {editMode ? (
            <div onClick={() => setEditMode(false)} style={{
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1,
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#4DB8A0' }}>완료</span>
            </div>
          ) : (
            <div onClick={() => setHeroVersion('v2')} style={{
              width: 28, height: 16, borderRadius: 8, background: 'rgba(0,0,0,0.12)',
              position: 'relative', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1,
            }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }} />
            </div>
          )}
        </div>

        {/* 날짜 + 인사 */}
        {(() => {
          const _selDate = new Date(selectedDate + 'T00:00:00');
          const days = ['일','월','화','수','목','금','토'];
          const dateStr = `${_selDate.getFullYear()}. ${String(_selDate.getMonth()+1).padStart(2,'0')}. ${String(_selDate.getDate()).padStart(2,'0')}  ${days[_selDate.getDay()]}요일`;
          const _tm = getTimeMode();
          const _isDark = _tm === 'evening' && homeView === 'briefing';
          const greeting = getGreeting(profile.nickname);
          const txtP = _isDark ? '#fff' : '#0D3028';
          const txtH = _isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)';
          const txtS = _isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.3)';
          return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div onClick={() => setShowDatePicker(true)} style={{ fontSize: 14, fontWeight: 500, color: txtH, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {dateStr}
                  {!isToday && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-primary, #89cef5)', padding: '2px 8px', borderRadius: 8, background: 'rgba(137,206,245,0.1)' }}>과거</span>}
                  <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.15)' }}>▼</span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
      ) : (
      /* ===== v2 히어로 영역 ===== */
      <div style={{ padding: '28px 22px 20px', position: 'relative' }}>
        {/* 상단 row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, position: 'relative' }}>
          <div onClick={() => setShowWeather(true)} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.8)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
          </div>
          <img src="/luasky.svg" alt="lua" style={{ height: 30, objectFit: 'contain', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }} />
          {editMode ? (
            <div onClick={() => setEditMode(false)} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#4DB8A0' }}>완료</span>
            </div>
          ) : (
            <div onClick={() => setHeroVersion('v1')} style={{
              width: 28, height: 16, borderRadius: 8, background: 'var(--accent-primary, #89cef5)',
              position: 'relative', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1,
            }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }} />
            </div>
          )}
        </div>

        {/* 날짜 */}
        {(() => {
          const _selDate = new Date(selectedDate + 'T00:00:00');
          const days = ['일','월','화','수','목','금','토'];
          const dateStr = `${_selDate.getMonth()+1}월 ${_selDate.getDate()}일 ${days[_selDate.getDay()]}요일`;
          return (
            <div onClick={() => setShowDatePicker(true)} style={{ fontSize: 13, fontWeight: 500, color: 'rgba(0,0,0,0.35)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              {dateStr}
              {!isToday && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-primary, #89cef5)', padding: '2px 8px', borderRadius: 8, background: 'rgba(137,206,245,0.1)' }}>과거</span>}
              <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.12)' }}>▼</span>
            </div>
          );
        })()}

        {/* 인사말 */}
        {(() => {
          const greeting = getGreeting(profile.nickname);
          return (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#0D3028', lineHeight: 1.35, letterSpacing: -0.3 }}>{greeting.main}</div>
              <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.4)', marginTop: 4 }}>{greeting.sub}</div>
            </div>
          );
        })()}

        {/* 오늘 요약 수치 */}
        {(() => {
          const _todayKey = selectedDate;
          const _allV2 = (() => { try { return JSON.parse(localStorage.getItem('lua_record_v2') || '{}'); } catch { return {}; } })();
          const _todayRec = _allV2[_todayKey] || {};
          const _allChecks = (() => { try { return JSON.parse(localStorage.getItem('nou_condition_checks') || '[]'); } catch { return []; } })();
          const _dayChecks = _allChecks.filter(c => (c.date || c.timestamp?.slice(0, 10)) === _todayKey);
          const _lastCheck = _dayChecks.length > 0 ? _dayChecks[_dayChecks.length - 1] : null;
          const _condAvg = _lastCheck ? ((_lastCheck.energy || 5) + (_lastCheck.mood || 5)) / 2 : null;
          const _todaySleep = _todayRec.sleep?.hours || null;
          const _todayNut = getTodayNutrition();
          const _eaten = Math.round(_todayNut.kcal || 0);

          const summaryItems = [];
          if (_condAvg !== null) summaryItems.push({ label: '컨디션', value: _condAvg.toFixed(1), color: _condAvg >= 7 ? '#22C55E' : _condAvg >= 4 ? '#E8A135' : '#E05050' });
          else summaryItems.push({ label: '컨디션', value: '미입력', color: 'var(--accent-primary, #89cef5)', tap: () => setShowConditionModal(true) });

          if (_todaySleep) summaryItems.push({ label: '수면', value: `${_todaySleep % 1 === 0 ? _todaySleep : _todaySleep.toFixed(1)}h`, color: _todaySleep >= 7 ? '#22C55E' : _todaySleep >= 5 ? '#E8A135' : '#E05050' });
          else summaryItems.push({ label: '수면', value: '미입력', color: 'var(--accent-primary, #89cef5)', tap: () => setShowSleepModal(true) });

          if (_eaten > 0) summaryItems.push({ label: '식사', value: `${_eaten.toLocaleString()}kcal`, color: 'var(--text-muted)' });
          else summaryItems.push({ label: '식사', value: '미입력', color: 'var(--accent-primary, #89cef5)', tap: () => setShowFoodModal(true) });

          return (
            <div style={{
              display: 'flex', gap: 6, flexWrap: 'wrap',
            }}>
              {summaryItems.map((item, i) => (
                <div key={i} onClick={item.tap} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 10px', borderRadius: 20,
                  background: 'rgba(255,255,255,0.4)',
                  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.5)',
                  cursor: item.tap ? 'pointer' : 'default',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                  <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', fontWeight: 500 }}>{item.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
      )}

      {/* ===== 카드 그리드 ===== */}
      {<>
      <div style={{ padding: '0 20px', marginBottom: 4 }}>
        <InsightCard />
      </div>
      <style>{`
        @keyframes cardWiggle {
          0% { transform: rotate(-0.8deg) scale(1); }
          25% { transform: rotate(0.8deg) scale(1.01); }
          50% { transform: rotate(-0.6deg) scale(1); }
          75% { transform: rotate(0.6deg) scale(0.99); }
          100% { transform: rotate(-0.8deg) scale(1); }
        }
        @keyframes cardTap {
          0% { transform: scale(1); }
          40% { transform: scale(0.96); }
          70% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
      `}</style>
      {(() => {
        // 공통 데이터를 한 번만 계산 (선택된 날짜 기준)
        const _todayKey = selectedDate;
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
          background: 'var(--card-bg)', borderRadius: 30,
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: 'var(--card-border)',
          boxShadow: 'var(--card-shadow)',
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
          const d = new Date(_todayKey + 'T00:00:00'); d.setDate(d.getDate() - i);
          const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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

        // 컨디션 7일 데이터 (선택 날짜 기준)
        const _allChecks = (() => { try { return JSON.parse(localStorage.getItem('nou_condition_checks') || '[]'); } catch { return []; } })();
        const _cond7 = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(_todayKey + 'T00:00:00'); d.setDate(d.getDate() - i);
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
          const d = new Date(_todayKey + 'T00:00:00'); d.setDate(d.getDate() - i);
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
          <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, margin: '0 18px', position: 'relative' }}>
            {cardOrder.map((cardId, cardIdx) => {
              const isDragging = dragState.dragging && dragState.cardId === cardId;
              const isDropTarget = dragState.dragging && dragState.overIdx === cardIdx && dragState.cardId !== cardId;
              const editWrap = (label, content) => (
                <div
                  key={cardId}
                  data-card-id={cardId}
                  onTouchStart={(e) => handleLongPressStart(e, cardId, cardIdx)}
                  onTouchEnd={handleLongPressEnd}
                  onTouchCancel={handleLongPressEnd}
                  style={{
                    animation: isEditing && !isDragging ? `cardWiggle ${0.25 + (cardIdx % 3) * 0.05}s ease-in-out infinite` : 'none',
                    animationDelay: `${(cardIdx * 0.06)}s`,
                    position: 'relative',
                    opacity: isDragging ? 0.3 : 1,
                    transform: isDropTarget ? 'scale(0.95)' : 'none',
                    transition: isDragging ? 'none' : 'transform 0.2s ease, opacity 0.2s ease',
                    zIndex: isDragging ? 0 : 1,
                  }}
                >
                  {isDropTarget && (
                    <div style={{
                      position: 'absolute', inset: 0, borderRadius: 30,
                      border: '2px dashed rgba(137,206,245,0.6)',
                      background: 'rgba(137,206,245,0.08)',
                      zIndex: 10, pointerEvents: 'none',
                    }} />
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
                          <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{_todayCond ? _todayCond.toFixed(1) : '—'}</span>
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
                          <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{_todaySleep ? (_todaySleep % 1 === 0 ? _todaySleep : _todaySleep.toFixed(1)) : '—'}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>시간</span>
                        </div>
                        <div style={{ fontSize: 10, color: _todaySleep ? (_todaySleep >= 7 ? '#22C55E' : _todaySleep >= 5 ? 'var(--text-muted)' : '#E05050') : 'var(--accent-primary, #89cef5)', marginTop: 4, minHeight: 14 }}>{_todaySleep ? (_todaySleep >= 7 ? '충분' : _todaySleep >= 5 ? '보통' : '부족') : '기록하기'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 3, height: 40, flexShrink: 0, position: 'relative' }}>
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
                          <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{_eaten > 0 ? _eaten.toLocaleString() : '—'}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kcal</span>
                        </div>
                        <div style={{ fontSize: 10, color: _eaten > 0 ? (_eaten > _fullGoal.kcal ? '#E85B5B' : 'var(--text-muted)') : 'var(--accent-primary, #89cef5)', marginTop: 4, minHeight: 14 }}>
                          {_eaten > 0 ? (_eaten > _fullGoal.kcal ? `${(_eaten - _fullGoal.kcal).toLocaleString()}kcal 초과` : `${_remaining.toLocaleString()}kcal 남음`) : '기록하기'}
                        </div>
                      </div>
                      {(() => {
                        const ringR = 22, ringC = 2 * Math.PI * ringR;
                        const ratio = _fullGoal.kcal > 0 ? Math.min(_eaten / _fullGoal.kcal, 1) : 0;
                        const ringDash = ringC * ratio;
                        const isOver = _fullGoal.kcal > 0 && _eaten > _fullGoal.kcal;
                        return (
                          <svg width="52" height="52" viewBox="0 0 52 52">
                            <defs>
                              <linearGradient id="calRingGrad" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor={isOver ? '#E85B5B' : '#7BC67B'} />
                                <stop offset="100%" stopColor={isOver ? '#F5A0A0' : '#A8E6A3'} />
                              </linearGradient>
                            </defs>
                            <circle cx="26" cy="26" r={ringR} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
                            <circle cx="26" cy="26" r={ringR} fill="none" stroke="url(#calRingGrad)" strokeWidth="5"
                              strokeDasharray={`${ringDash} ${ringC - ringDash}`} strokeLinecap="round"
                              transform="rotate(-90 26 26)" style={{ transition: 'stroke-dasharray 0.3s ease' }} />
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
                          <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{_waterCups > 0 ? (_waterCups * _cupMl).toLocaleString() : '—'}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ml</span>
                        </div>
                        <div style={{ fontSize: 10, color: _waterCups > 0 ? (_waterCups >= _waterGoal ? '#22C55E' : 'var(--text-muted)') : 'var(--accent-primary, #89cef5)', marginTop: 4, minHeight: 14 }}>{_waterCups > 0 ? (_waterCups >= _waterGoal ? '목표 달성!' : `${((_waterGoal - _waterCups) * _cupMl).toLocaleString()}ml 남음`) : '기록하기'}</div>
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
                            <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>—</div>
                            <div style={{ fontSize: 10, color: 'var(--accent-primary, #89cef5)', marginTop: 4, minHeight: 14 }}>기록하기</div>
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
                          <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{(_burnedFromSteps + _burnedFromExercise) > 0 ? (_burnedFromSteps + _burnedFromExercise).toLocaleString() : '—'}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kcal</span>
                        </div>
                        <div style={{ fontSize: 10, color: (_burnedFromSteps + _burnedFromExercise) > 0 ? '#22C55E' : 'var(--accent-primary, #89cef5)', marginTop: 4, minHeight: 14 }}>{_todaySteps > 0 ? `${_todaySteps.toLocaleString()}걸음` : (_burnedFromExercise > 0 ? '\u00A0' : '기록하기')}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40, flexShrink: 0 }}>
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

              if (cardId === 'blood_sugar') {
                const _bs = (() => { const checks = getBloodSugarChecks(); return checks.find(c => c.date === _todayKey) || null; })();
                const _bsChecks = getBloodSugarChecks().slice(-7);
                const _bsStatus = _bs ? (_bs.timing === '식후'
                  ? (_bs.value < 140 ? '정상' : _bs.value < 200 ? '주의' : '높음')
                  : (_bs.value < 100 ? '정상' : _bs.value < 126 ? '주의' : '높음')) : null;
                const _bsColor = _bsStatus === '정상' ? '#22C55E' : _bsStatus === '주의' ? '#E8A135' : _bsStatus === '높음' ? '#E05050' : null;
                return editWrap('혈당', (
                  <div onClick={() => handleCardTap('blood_sugar', () => setShowBloodSugarModal(true))} style={{ ..._cs, cursor: 'pointer', padding: '20px', animation: tappedCard === 'blood_sugar' ? 'cardTap 0.3s ease' : 'none', pointerEvents: isEditing ? 'none' : 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, flex: '0 0 auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(224,80,80,0.3))' }}><defs><linearGradient id="dropBS" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#E07060"/><stop offset="100%" stopColor="#C04838"/></linearGradient></defs><path d="M12 2.5c0 0-7.5 8-7.5 13a7.5 7.5 0 0015 0c0-5-7.5-13-7.5-13z" fill="url(#dropBS)" opacity="0.6"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#b1b8ba' }}>혈당</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{_bs ? _bs.value : '—'}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>mg/dL</span>
                        </div>
                        <div style={{ fontSize: 10, color: _bsColor || 'var(--accent-primary, #89cef5)', marginTop: 4, minHeight: 14 }}>
                          {_bs ? `${_bs.timing} · ${_bsStatus}` : '기록하기'}
                        </div>
                      </div>
                      {_bsChecks.length >= 2 && (() => {
                        const vals = _bsChecks.map(c => c.value);
                        const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1;
                        const pts = vals.map((v, i) => ({ x: 5 + i * 10, y: 5 + 30 - ((v - mn) / rng) * 30 }));
                        let d = `M${pts[0].x},${pts[0].y}`;
                        for (let i = 0; i < pts.length - 1; i++) {
                          const cx2 = (pts[i].x + pts[i+1].x) / 2;
                          d += ` C${cx2},${pts[i].y} ${cx2},${pts[i+1].y} ${pts[i+1].x},${pts[i+1].y}`;
                        }
                        const last = pts[pts.length - 1];
                        return (
                          <svg width="65" height={40} viewBox={`0 0 ${5 + vals.length * 10} 40`} style={{ flexShrink: 0 }}>
                            <path d={d} fill="none" stroke="rgba(240,152,136,0.5)" strokeWidth="2.5" strokeLinecap="round" />
                            <circle cx={last.x} cy={last.y} r="3.5" fill="#F09888" />
                          </svg>
                        );
                      })()}
                    </div>
                  </div>
                ));
              }

              if (cardId === 'drink') {
                const _drinkData = (() => { try { const all = JSON.parse(localStorage.getItem('lua_drink_records') || '{}'); const r = all[_todayKey] || {}; return { caffeine: r.caffeine || [], noncaffeine: r.noncaffeine || [], alcohol: r.alcohol || [] }; } catch { return { caffeine: [], noncaffeine: [], alcohol: [] }; } })();
                const _cafTotal = _drinkData.caffeine.reduce((s, d) => s + (d.count || 0), 0);
                const _cafMg = _drinkData.caffeine.reduce((s, d) => { const item = CAFFEINE_ITEMS.find(c => c.key === d.key); return s + (item?.mg || 0) * (d.count || 0); }, 0);
                const _alcTotal = _drinkData.alcohol.reduce((s, d) => s + (d.count || 0), 0);
                const _ncTotal = _drinkData.noncaffeine.reduce((s, d) => s + (d.count || 0), 0);
                const _hasData = _cafTotal > 0 || _alcTotal > 0 || _ncTotal > 0;
                const _userWeight = getLatestWeight()?.weight || 0;
                const _cafState = calculateCaffeineState(_cafMg, _userWeight);
                return editWrap('음료', (
                  <div onClick={() => handleCardTap('drink', () => setShowDrinkModal(true))} style={{ ..._cs, cursor: 'pointer', padding: '20px', animation: tappedCard === 'drink' ? 'cardTap 0.3s ease' : 'none', pointerEvents: isEditing ? 'none' : 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, flex: '0 0 auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <img src="/cup.svg" width="16" height="16" alt="" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(160,120,80,0.3))' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#b1b8ba' }}>음료</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                      {_hasData ? (
                        <div>
                          {_cafMg > 0 ? (
                            <>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{_cafMg}</span>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>mg</span>
                              </div>
                              <div style={{ fontSize: 10, color: _cafState.statusColor, marginTop: 4, fontWeight: 500 }}>{_cafState.status}</div>
                            </>
                          ) : _alcTotal > 0 ? (
                            <>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{_alcTotal}</span>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>잔</span>
                              </div>
                              <div style={{ fontSize: 10, color: '#8A7AAB', marginTop: 4, fontWeight: 500 }}>🍺 알콜</div>
                            </>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{_ncTotal}</span>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>잔</span>
                              </div>
                              <div style={{ fontSize: 10, color: '#7B5E9E', marginTop: 4, fontWeight: 500 }}>🌿 논카페인</div>
                            </>
                          )}
                          {/* 복수 카테고리 기록 시 서브라인 */}
                          {((_cafMg > 0 ? 1 : 0) + (_alcTotal > 0 ? 1 : 0) + (_ncTotal > 0 ? 1 : 0)) > 1 && (
                            <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 2 }}>
                              {[_cafMg > 0 && `☕${_cafTotal}`, _ncTotal > 0 && `🌿${_ncTotal}`, _alcTotal > 0 && `🍺${_alcTotal}`].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>—</div>
                          <div style={{ fontSize: 10, color: 'var(--accent-primary, #89cef5)', marginTop: 4 }}>기록하기</div>
                        </div>
                      )}
                      {_cafMg > 0 && (() => {
                        const ringR = 22, ringC = 2 * Math.PI * ringR;
                        const fillPct = Math.min(_cafState.percent / 100, 1);
                        const ringDash = ringC * fillPct;
                        return (
                          <svg width="52" height="52" viewBox="0 0 52 52">
                            <defs>
                              <linearGradient id="cafRingGrad" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#B8865C" />
                                <stop offset="100%" stopColor="#DEC8A8" />
                              </linearGradient>
                            </defs>
                            <circle cx="26" cy="26" r={ringR} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
                            <circle cx="26" cy="26" r={ringR} fill="none" stroke="url(#cafRingGrad)" strokeWidth="5"
                              strokeDasharray={`${ringDash} ${ringC - ringDash}`} strokeLinecap="round"
                              transform="rotate(-90 26 26)" style={{ transition: 'stroke-dasharray 0.3s ease' }} />
                          </svg>
                        );
                      })()}
                    </div>
                  </div>
                ));
              }

              if (cardId === 'supplement') {
                const _suppItems = getSupplementItems();
                const _suppChecks = getSupplementChecks(_todayKey);
                const _suppDone = _suppItems.filter(s => _suppChecks[s.id]);
                const _suppTotal = _suppItems.length;
                return editWrap('영양제', (
                  <div onClick={() => handleCardTap('supplement', () => setShowSupplementModal(true))} style={{ ..._cs, cursor: 'pointer', padding: '20px', animation: tappedCard === 'supplement' ? 'cardTap 0.3s ease' : 'none', pointerEvents: isEditing ? 'none' : 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, flex: '0 0 auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <img src="/pill.svg" width="16" height="16" alt="" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(200,180,50,0.3))' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#b1b8ba' }}>영양제</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                      {_suppTotal > 0 ? (
                        <>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                              <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{_suppDone.length}</span>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/{_suppTotal}</span>
                            </div>
                            <div style={{ fontSize: 10, color: _suppDone.length === _suppTotal ? '#22C55E' : 'var(--text-muted)', marginTop: 4, minHeight: 14 }}>
                              {_suppDone.length === _suppTotal ? '오늘 완료!' : `${_suppTotal - _suppDone.length}개 남음`}
                            </div>
                          </div>
                          {(() => {
                            const ringR = 22, ringC = 2 * Math.PI * ringR;
                            const fillPct = Math.min(_suppDone.length / _suppTotal, 1);
                            const ringDash = ringC * fillPct;
                            return (
                              <svg width="52" height="52" viewBox="0 0 52 52">
                                <defs>
                                  <linearGradient id="suppRingGrad" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="#C8B040" />
                                    <stop offset="100%" stopColor="#E8D88C" />
                                  </linearGradient>
                                </defs>
                                <circle cx="26" cy="26" r={ringR} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
                                <circle cx="26" cy="26" r={ringR} fill="none" stroke="url(#suppRingGrad)" strokeWidth="5"
                                  strokeDasharray={`${ringDash} ${ringC - ringDash}`} strokeLinecap="round"
                                  transform="rotate(-90 26 26)" style={{ transition: 'stroke-dasharray 0.3s ease' }} />
                              </svg>
                            );
                          })()}
                        </>
                      ) : (
                        <div>
                          <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>—</div>
                          <div style={{ fontSize: 10, color: 'var(--accent-primary, #89cef5)', marginTop: 4 }}>등록하기</div>
                        </div>
                      )}
                    </div>
                  </div>
                ));
              }

              if (cardId === 'skin_check') {
                const _skinLog = (() => { try { const logs = JSON.parse(localStorage.getItem('lua_skin_check_logs') || '{}'); return logs[_todayKey] || null; } catch { return null; } })();
                // Phase 2: 10점 직접 점수 우선, 없으면 기존 100점 호환
                const _skinScore = _skinLog?.score || (_skinLog ? calculateSkinScore(_skinLog) : null);
                const _is10pt = !!_skinLog?.score;
                const _skinState = _skinScore !== null ? (_is10pt ? (_skinScore >= 7 ? 'good' : _skinScore >= 4 ? 'signals' : 'needs_care') : getScoreState(_skinScore)) : 'unchecked';
                const _yesterdayLog = (() => { try { const logs = JSON.parse(localStorage.getItem('lua_skin_check_logs') || '{}'); const yd = new Date(Date.now() - 86400000).toISOString().slice(0, 10); return logs[yd] || null; } catch { return null; } })();
                const _yesterdayScore = _yesterdayLog?.score || (_yesterdayLog ? calculateSkinScore(_yesterdayLog) : null);
                const _delta = (_skinScore !== null && _yesterdayScore !== null) ? _skinScore - _yesterdayScore : null;
                const _signalCount = (_skinLog?.signals || []).length;
                const _scoreColor = _is10pt ? (_skinScore >= 8 ? '#5E9D8A' : _skinScore >= 6 ? '#8A9EAD' : _skinScore >= 4 ? '#C9A065' : '#C97C5E') : 'var(--text-primary)';
                return editWrap('피부', (
                  <div onClick={() => handleCardTap('skin_check', () => setShowSkinCheckModal(true))} style={{ ..._cs, cursor: 'pointer', padding: '20px', position: 'relative', animation: tappedCard === 'skin_check' ? 'cardTap 0.3s ease' : 'none', pointerEvents: isEditing ? 'none' : 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, flex: '0 0 auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(240,160,130,0.3))', opacity: _skinState === 'unchecked' ? 0.7 : 1 }}><defs><linearGradient id="skinCardIc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F8C8A8"/><stop offset="100%" stopColor="#E09870"/></linearGradient></defs><path d="M10.48,23.25c-.15.41-.5.71-.86.75-.27.03-.78-.29-.9-.59l-1.53-4.02c-.48-1.26-1.41-2.1-2.67-2.58l-3.91-1.48c-.29-.11-.59-.51-.6-.76-.01-.39.23-.79.6-.93l3.9-1.49c1.27-.48,2.19-1.31,2.68-2.59l1.57-4.14c.08-.2.52-.44.74-.46.24-.02.77.21.86.46l1.57,4.14c.5,1.32,1.47,2.15,2.78,2.63l3.7,1.37c.31.11.66.55.67.83.02.42-.29.82-.68.97l-3.8,1.44c-1.26.48-2.2,1.32-2.67,2.58l-1.45,3.86z" fill="url(#skinCardIc)" opacity="0.8"/><path d="M21.48,6.29c-1.03.59-.9,2.91-2.01,2.98-1.23.08-.99-1.68-1.94-2.78-.77-.88-2.68-.63-2.74-1.78-.07-1.27,2.01-1.1,2.74-1.91.87-.95.73-2.72,1.78-2.8,1.29-.1.98,1.81,1.95,2.77.87.86,2.67.71,2.73,1.8.07,1.08-1.29,1.02-2.51,1.72z" fill="url(#skinCardIc)" opacity="0.8"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#b1b8ba' }}>피부</span>
                      </div>
                    </div>
                    <div style={{ marginTop: 'auto' }}>
                      {_skinScore !== null ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                            <span style={{ fontSize: 26, fontWeight: 600, color: _scoreColor, fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{_skinScore}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{_is10pt ? '/10' : '점'}</span>
                          </div>
                          {_delta !== null ? (
                            <div style={{ fontSize: 10, color: _delta > 0 ? '#5E9D8A' : _delta < 0 ? '#C97C5E' : '#8A9EAD', marginTop: 4 }}>
                              {_delta > 0 ? '↑' : _delta < 0 ? '↓' : '→'} 어제 {_delta > 0 ? '+' : ''}{_delta}
                            </div>
                          ) : _signalCount > 0 ? (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>신호 {_signalCount}개</div>
                          ) : null}
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>—</div>
                          <div style={{ fontSize: 10, color: 'var(--accent-primary, #89cef5)', marginTop: 4 }}>체크하기</div>
                        </div>
                      )}
                    </div>
                  </div>
                ));
              }

              if (cardId === 'weather') {
                const _w = getWeatherData();
                const _humTag = _w ? (_w.humidity < 40 ? '건조주의' : _w.humidity <= 70 ? '적정' : '습함') : null;
                const _humColor = _w ? (_w.humidity < 40 ? '#f59e0b' : _w.humidity <= 70 ? '#89cef5' : '#38bdf8') : null;
                return editWrap('날씨', (
                  <div onClick={() => { handleCardTap('weather', () => setShowWeather(true)); }} style={{ ..._cs, cursor: 'pointer', padding: '20px', animation: tappedCard === 'weather' ? 'cardTap 0.3s ease' : 'none', pointerEvents: isEditing ? 'none' : 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, flex: '0 0 auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(137,206,245,0.3))' }}><defs><linearGradient id="weatherCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#B8E4F8"/><stop offset="100%" stopColor="#6AB4E0"/></linearGradient></defs><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="url(#weatherCard)" opacity="0.6"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#b1b8ba' }}>날씨</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                      {_w ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                            <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{_w.tempMax}°</span>
                            <span style={{ fontSize: 18, fontWeight: 500, color: '#89cef5', fontFamily: 'var(--font-display)' }}>{_w.tempMin}°</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: _humColor, padding: '1px 6px', borderRadius: 6, background: `${_humColor}15` }}>{_humTag}</span>
                            {_w.uv >= 6 && <span style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', padding: '1px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.1)' }}>UV {_w.uv}</span>}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>—</div>
                          <div style={{ fontSize: 10, color: 'var(--accent-primary, #89cef5)', marginTop: 4 }}>확인하기</div>
                        </div>
                      )}
                      {_w && <span style={{ fontSize: 32 }}>{_w.conditionIcon}</span>}
                    </div>
                  </div>
                ));
              }

              if (cardId === 'cycle') {
                // 여성 사용자만 표시
                if (profile.gender !== '여성') return null;
                const _cycleData = getCycleData();
                const _cs2 = calculateCycleState(_cycleData);
                const _isUnset = _cs2.state === 'unset';
                const _activePos = _cs2.stage ? getActivePosition(_cs2.stage) : -1;
                return editWrap('주기', (
                  <div onClick={() => handleCardTap('cycle', () => setShowCycleModal(true))} style={{
                    ..._cs, cursor: 'pointer', padding: '20px', position: 'relative',
                    animation: tappedCard === 'cycle' ? 'cardTap 0.3s ease' : 'none',
                    pointerEvents: isEditing ? 'none' : 'auto',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0, flex: '0 0 auto' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(200,64,96,0.3))', opacity: _isUnset ? 0.5 : 1 }}><defs><linearGradient id="cycleCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF6080"/><stop offset="100%" stopColor="#A02048"/></linearGradient></defs><path d="M12 2.5c0 0-7.5 8-7.5 13a7.5 7.5 0 0015 0c0-5-7.5-13-7.5-13z" fill="url(#cycleCard)" opacity="0.6"/></svg>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#b1b8ba' }}>주기</span>
                    </div>
                    <div style={{ marginTop: 'auto' }}>
                      {_isUnset ? (
                        <>
                          <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>—</div>
                          <div style={{ fontSize: 10, color: 'var(--accent-primary, #89cef5)', marginTop: 4 }}>체크하기</div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: -0.5, fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{_cs2.label}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{_cs2.subtitle}</div>
                        </>
                      )}
                    </div>
                    {/* 5개 점 인디케이터 */}
                    {!_isUnset && (
                      <div style={{ position: 'absolute', right: 14, bottom: 14, display: 'flex', gap: 3, alignItems: 'center' }}>
                        {[0, 1, 2, 3, 4].map(i => (
                          <div key={i} style={{
                            width: i === _activePos ? 7 : 5,
                            height: i === _activePos ? 7 : 5,
                            borderRadius: '50%',
                            background: i === _activePos ? 'rgba(74,107,133,0.6)' : 'rgba(74,107,133,0.2)',
                            transition: 'all 0.3s ease',
                          }} />
                        ))}
                      </div>
                    )}
                  </div>
                ));
              }

              return null;
            })}
          </div>
          {/* 드래그 중인 카드 플로팅 미리보기 */}
          {dragState.dragging && (() => {
            const dragIdx = cardOrder.indexOf(dragState.cardId);
            const rect = cardRectsRef.current?.[dragIdx];
            if (!rect) return null;
            const cardLabel = CARD_REGISTRY.find(c => c.id === dragState.cardId)?.label || '';
            return (
              <div style={{
                position: 'fixed',
                left: dragState.x - dragState.offsetX,
                top: dragState.y - dragState.offsetY,
                width: rect.width, height: rect.height,
                zIndex: 9999, pointerEvents: 'none',
                transform: 'scale(1.05)',
                transition: 'transform 0.1s ease',
              }}>
                <div style={{
                  width: '100%', height: '100%',
                  background: 'rgba(255,255,255,0.6)',
                  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                  borderRadius: 30,
                  border: '1.5px solid rgba(255,255,255,0.5)',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', opacity: 0.7 }}>{cardLabel}</span>
                </div>
              </div>
            );
          })()}

          {/* 오늘의 진행률 (하단) */}
          <div style={{ margin: '14px 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: _recordedItems.length === 6 ? '#22C55E' : 'rgba(0,0,0,0.45)', fontWeight: 500 }}>
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
                  background: i < _recordedItems.length
                    ? (_recordedItems.length === 6 ? '#22C55E' : 'rgba(0,0,0,0.25)')
                    : 'rgba(0,0,0,0.08)',
                  transition: 'all 0.3s ease',
                }} />
              ))}
            </div>
          </div>

          </>
        );
      })()}

      </>}

      {/* DailyInsightSlider moved to briefing view */}

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
        <WeatherFullModal onClose={() => setShowWeather(false)} />
      )}

      {/* Account Page */}
      {showAccountPage && (
        <AccountPage
          profile={userProfile}
          onUpdate={(key, val) => { const next = saveProfile({ [key]: val }); setUserProfile(next); }}
          onClose={() => setShowAccountPage(false)}
        />
      )}

      {detailPage && (
        <CardDetailPage type={detailPage.type} data={detailPage.data} onClose={() => setDetailPage(null)} />
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
          onDetail={(food) => { setShowFoodModal(false); setDetailPage({ type: 'meal', data: food }); }}
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
          onDetail={(data) => { setShowConditionModal(false); setDetailPage({ type: 'condition', data }); }}
        />
      )}

      {showBloodSugarModal && (
        <BloodSugarModal onClose={() => setShowBloodSugarModal(false)} onUpdate={() => { setShowBloodSugarModal(false); setWeightRefreshKey(k => k + 1); }} />
      )}

      {showDrinkModal && (
        <DrinkModal onClose={() => setShowDrinkModal(false)} onSave={(drinkInfo) => { setShowDrinkModal(false); setWeightRefreshKey(k => k + 1); if (drinkInfo) { setEffectCheckDrink(drinkInfo); setShowEffectCheckModal(true); } }} />
      )}

      {showEffectCheckModal && effectCheckDrink && (
        <CaffeineEffectCheckModal drink={effectCheckDrink} onClose={() => { setShowEffectCheckModal(false); setEffectCheckDrink(null); }} onSave={() => { setShowEffectCheckModal(false); setEffectCheckDrink(null); setWeightRefreshKey(k => k + 1); }} />
      )}


      {showSupplementModal && (
        <SupplementModal onClose={() => setShowSupplementModal(false)} onUpdate={() => { setShowSupplementModal(false); setWeightRefreshKey(k => k + 1); }} onCheck={() => setWeightRefreshKey(k => k + 1)} />
      )}

      {showSkinCheckModal && (
        <SkinCheckModal onClose={() => setShowSkinCheckModal(false)} onUpdate={() => { setShowSkinCheckModal(false); setWeightRefreshKey(k => k + 1); }} />
      )}

      {showCycleModal && (
        <CycleModal onClose={() => setShowCycleModal(false)} onUpdate={() => { setShowCycleModal(false); setWeightRefreshKey(k => k + 1); }} />
      )}

      {/* 날짜 선택 모달 */}
      {showDatePicker && (
        <div onClick={() => setShowDatePicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0', padding: '24px 24px 40px', width: '100%', maxWidth: 420 }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20, textAlign: 'center' }}>날짜 선택</div>
            <input type="date" value={selectedDate} max={new Date().toISOString().slice(0, 10)}
              onChange={e => { setSelectedDate(e.target.value); setShowDatePicker(false); setWeightRefreshKey(k => k + 1); }}
              style={{ width: '100%', padding: '16px', borderRadius: 14, border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)', fontSize: 18, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', textAlign: 'center' }} />
            {!isToday && (
              <button onClick={() => { setSelectedDate(new Date().toISOString().slice(0, 10)); setShowDatePicker(false); setWeightRefreshKey(k => k + 1); }}
                style={{ width: '100%', marginTop: 12, padding: '14px 0', borderRadius: 'var(--btn-radius)', border: 'none', background: 'var(--accent-primary)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>오늘로 돌아가기</button>
            )}
            <button onClick={() => setShowDatePicker(false)}
              style={{ width: '100%', marginTop: 8, padding: '14px 0', borderRadius: 'var(--btn-radius)', border: 'none', background: 'var(--bg-input, #F2F3F5)', color: 'var(--text-muted)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>닫기</button>
          </div>
        </div>
      )}

      {/* 과거 날짜일 때 하단 플로팅 "오늘로" 버튼 */}
      {!isToday && !showDatePicker && (
        <div onClick={() => { setSelectedDate(new Date().toISOString().slice(0, 10)); setWeightRefreshKey(k => k + 1); }}
          style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
            padding: '10px 20px', borderRadius: 99, background: 'var(--accent-primary)', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            WebkitTapHighlightColor: 'transparent',
          }}>오늘로 돌아가기</div>
      )}

      {showSleepModal && (
        <SleepInputModal
          onClose={() => setShowSleepModal(false)}
          onUpdate={() => { setShowSleepModal(false); setWeightRefreshKey(k => k + 1); }}
          onDetail={(data) => { setShowSleepModal(false); setDetailPage({ type: 'sleep', data }); }}
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

function WeatherFullModal({ onClose }) {
  const swipe = useSwipeDown(onClose);
  return (
    <div ref={swipe.elRef} onTouchStart={swipe.onTouchStart} onTouchMove={swipe.onTouchMove} onTouchEnd={swipe.onTouchEnd} style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      background: 'var(--page-gradient, linear-gradient(to bottom, #ace2fc, #ffffff))',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
        <div onClick={onClose} style={{
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
  );
}

function ConditionCheckModal({ selections, sliderPcts, onSelect, onSliderChange, onUpdate, onClose, onDetail }) {
  const swipe = useSwipeDown(onClose);
  const sliders = [
    { key: 'mood', label: '기분', rgb: [245,194,203], labels: MOOD_LABELS,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(212,112,126,0.3))' }}><defs><linearGradient id="heartM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F0B8C0"/><stop offset="100%" stopColor="#D4707E"/></linearGradient></defs><path d="M12 4.5C10 2 6.5 1.5 4.5 4c-2 2.5-1.5 6 1 8.5L12 20l6.5-7.5c2.5-2.5 3-6 1-8.5C17.5 1.5 14 2 12 4.5z" fill="url(#heartM)" opacity="0.6"/></svg> },
    { key: 'energy', label: '에너지', rgb: [245,230,163], labels: ENERGY_LABELS,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(232,161,53,0.3))' }}><defs><linearGradient id="boltM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F5DFA0"/><stop offset="100%" stopColor="#E8A135"/></linearGradient></defs><path d="M14 1L3 14h8l-3 9 12-13h-8l2-9z" fill="url(#boltM)" opacity="0.6"/></svg> },
  ];

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div ref={swipe.elRef} onTouchStart={swipe.onTouchStart} onTouchMove={swipe.onTouchMove} onTouchEnd={swipe.onTouchEnd} onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0',
        padding: '24px 24px 40px', width: '100%', maxWidth: 420,
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 24, textAlign: 'center' }}>컨디션</div>

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

        {onDetail && (
          <div onClick={() => onDetail(selections)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: 9, borderRadius: 10, cursor: 'pointer', marginTop: 20,
            background: 'white', border: '0.5px solid #B8865C',
          }}>
            <span style={{ fontSize: 10, color: '#B8865C', fontWeight: 500 }}>📊 자세히 보기 →</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
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
  const swipe = useSwipeDown(onClose);
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
      <div ref={swipe.elRef} onTouchStart={swipe.onTouchStart} onTouchMove={swipe.onTouchMove} onTouchEnd={swipe.onTouchEnd} onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0',
        padding: '24px 24px 40px', width: '100%', maxWidth: 420,
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 24, textAlign: 'center' }}>체중</div>
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
  const swipe = useSwipeDown(onClose);
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
      today.stepsLoggedAt = new Date().toISOString();
    } else if (tab === 'exercise' && selectedEx && minutes) {
      const log = today.exercise?.log || {};
      log[selectedEx.name] = (log[selectedEx.name] || 0) + Number(minutes);
      today.exercise = { ...today.exercise, log, loggedAt: new Date().toISOString() };
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
      <div ref={swipe.elRef} onTouchStart={swipe.onTouchStart} onTouchMove={swipe.onTouchMove} onTouchEnd={swipe.onTouchEnd} onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0',
        padding: '24px 24px 40px', width: '100%', maxWidth: 420,
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 24, textAlign: 'center' }}>활동</div>

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
  const swipe = useSwipeDown(onClose);
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
    rec.water = { ...(rec.water || {}), cups: next, loggedAt: new Date().toISOString() };
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
    rec.water = { ...(rec.water || {}), cups: next, loggedAt: new Date().toISOString() };
    all[todayKey] = rec;
    localStorage.setItem('lua_record_v2', JSON.stringify(all));
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div ref={swipe.elRef} onTouchStart={swipe.onTouchStart} onTouchMove={swipe.onTouchMove} onTouchEnd={swipe.onTouchEnd} onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0',
        padding: '24px 24px 40px', width: '100%', maxWidth: 420,
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 24, textAlign: 'center' }}>수분</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 24 }}>1잔 = {cupMl}ml</div>

        {/* Water bottle visualization */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <div style={{ position: 'relative', width: 120, height: 160 }}>
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

function SleepInputModal({ onClose, onUpdate, onDetail }) {
  const swipe = useSwipeDown(onClose);
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
    rec.sleep = {
      hours: sleepHours, quality: sleepQuality,
      bedtime: sleepBedtime ? (sleepBedtime.includes('T') ? sleepBedtime : `${todayKey}T${sleepBedtime}:00`) : null,
      wakeTime: sleepWakeTime ? (sleepWakeTime.includes('T') ? sleepWakeTime : `${todayKey}T${sleepWakeTime}:00`) : null,
    };
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
      <div ref={swipe.elRef} onTouchStart={swipe.onTouchStart} onTouchMove={swipe.onTouchMove} onTouchEnd={swipe.onTouchEnd} onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0',
        padding: '24px 24px 40px', width: '100%', maxWidth: 420,
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, textAlign: 'center' }}>수면</div>
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

        {onDetail && (
          <div onClick={() => onDetail({ hours: sleepHours, quality: sleepQuality, bedtime: sleepBedtime, wakeTime: sleepWakeTime })} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: 9, borderRadius: 10, cursor: 'pointer', marginBottom: 12,
            background: 'white', border: '0.5px solid #4A4F7F',
          }}>
            <span style={{ fontSize: 10, color: '#4A4F7F', fontWeight: 500 }}>📊 자세히 보기 →</span>
          </div>
        )}

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

function BloodSugarModal({ onClose, onUpdate }) {
  const swipe = useSwipeDown(onClose);
  const [bsInput, setBsInput] = useState(() => { const t = getTodayBloodSugar(); return t?.value ?? ''; });
  const [bsTiming, setBsTiming] = useState(() => { const t = getTodayBloodSugar(); return t?.timing ?? '공복'; });
  const [graphData, setGraphData] = useState(() => { try { return JSON.parse(localStorage.getItem('nou_bs_graph') || 'null'); } catch { return null; } });
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState(null);

  const bsStatus = bsInput ? (() => {
    const v = Number(bsInput);
    return bsTiming === '식후' ? (v < 140 ? '정상' : v < 200 ? '주의' : '높음') : (v < 100 ? '정상' : v < 126 ? '주의' : '높음');
  })() : null;
  const statusColor = bsStatus === '정상' ? '#22C55E' : bsStatus === '주의' ? '#E8A135' : bsStatus === '높음' ? '#E05050' : null;

  const handleSave = () => { if (bsInput) saveBloodSugar(Number(bsInput), bsTiming); onUpdate?.(); };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setGraphLoading(true); setGraphError(null);
    try {
      const dataUrl = await new Promise(r => { const rd = new FileReader(); rd.onload = ev => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); const s = Math.min(1, 1024 / img.width); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); r(c.toDataURL('image/jpeg', 0.8)); }; img.src = ev.target.result; }; rd.readAsDataURL(file); });
      const resp = await fetch('/api/blood-sugar-graph', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUrl }) });
      const result = await resp.json();
      if (result.error) throw new Error(result.error);
      if (!result.readings?.length) throw new Error('그래프에서 수치를 읽지 못했어요');
      const gd = { ...result, uploadedAt: new Date().toISOString() };
      localStorage.setItem('nou_bs_graph', JSON.stringify(gd)); setGraphData(gd);
    } catch (err) { setGraphError(err.message); }
    finally { setGraphLoading(false); e.target.value = ''; }
  };

  const history = getBloodSugarChecks().slice(-7);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div ref={swipe.elRef} onTouchStart={swipe.onTouchStart} onTouchMove={swipe.onTouchMove} onTouchEnd={swipe.onTouchEnd} onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0', padding: '24px 24px 40px', width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 24, textAlign: 'center' }}>혈당</div>

        {/* 타이밍 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['공복', '식후'].map(t => (
            <div key={t} onClick={() => setBsTiming(t)} style={{
              flex: 1, padding: '10px 0', borderRadius: 14, textAlign: 'center', cursor: 'pointer',
              background: bsTiming === t ? 'rgba(240,152,136,0.12)' : 'rgba(0,0,0,0.03)',
              border: bsTiming === t ? '1.5px solid rgba(240,152,136,0.4)' : '1.5px solid rgba(0,0,0,0.06)',
              fontSize: 13, fontWeight: bsTiming === t ? 600 : 500, color: bsTiming === t ? '#E05050' : 'rgba(0,0,0,0.4)',
            }}>{t}</div>
          ))}
        </div>

        {/* 수치 입력 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <input value={bsInput} onChange={e => setBsInput(e.target.value)} placeholder="0" type="number" inputMode="numeric"
            style={{ flex: 1, padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)', fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', outline: 'none', textAlign: 'center' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>mg/dL</div>
            {bsStatus && <div style={{ fontSize: 12, fontWeight: 600, color: statusColor, marginTop: 4 }}>{bsStatus}</div>}
          </div>
        </div>

        {/* 7일 미니차트 */}
        {history.length >= 2 && (() => {
          const vals = history.map(c => c.value);
          const mn = Math.min(...vals, 70), mx = Math.max(...vals, 140), rng = mx - mn || 1;
          const cW = 300, cH = 60, pd = 10;
          const pts = vals.map((v, i) => ({ x: pd + (i / (vals.length - 1)) * (cW - pd * 2), y: pd + (cH - pd * 2) - ((v - mn) / rng) * (cH - pd * 2), v, ok: v >= 70 && v <= 140 }));
          return (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.3)', marginBottom: 8 }}>최근 기록</div>
              <svg viewBox={`0 0 ${cW} ${cH}`} style={{ width: '100%' }}>
                {pts.map((pt, i) => i > 0 && <line key={i} x1={pts[i-1].x} y1={pts[i-1].y} x2={pt.x} y2={pt.y} stroke={pt.ok && pts[i-1].ok ? '#4A9A7A' : '#E8944A'} strokeWidth="2.5" strokeLinecap="round" />)}
                {pts.map((pt, i) => <circle key={`d${i}`} cx={pt.x} cy={pt.y} r="3" fill={pt.ok ? '#4A9A7A' : '#E8944A'} stroke="#fff" strokeWidth="1" />)}
                {pts.map((pt, i) => (i === 0 || i === pts.length - 1) && <text key={`t${i}`} x={pt.x} y={pt.y - 7} textAnchor="middle" fontSize="9" fontWeight="600" fill={pt.ok ? '#4A9A7A' : '#E8944A'}>{pt.v}</text>)}
              </svg>
            </div>
          );
        })()}

        {/* 혈당 그래프 (사진 업로드) */}
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.3)' }}>혈당 그래프</span>
            <label style={{ fontSize: 12, color: '#89cef5', fontWeight: 500, cursor: 'pointer' }}>
              {graphLoading ? '분석중...' : '📷 사진 업로드'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
            </label>
          </div>
          {graphError && <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(224,80,80,0.08)', marginBottom: 10, fontSize: 12, color: '#E05050' }}>{graphError}</div>}
          {graphLoading && <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'rgba(0,0,0,0.3)' }}>AI가 그래프를 분석하고 있어요...</div>}
          {!graphLoading && graphData?.readings?.length > 0 && (() => {
            const rd = graphData.readings, vl = rd.map(r => r.value);
            const mn = Math.min(...vl, 70), mx = Math.max(...vl, 140), rng = mx - mn || 1;
            const pT = 20, pB = 30, pL = 36, pR = 10, cW = 300, cH = 140;
            const iW = cW - pL - pR, iH = cH - pT - pB;
            const y70 = pT + iH - ((70 - mn) / rng) * iH, y140 = pT + iH - ((140 - mn) / rng) * iH;
            const pts = rd.map((r, i) => ({ x: pL + (i / Math.max(rd.length - 1, 1)) * iW, y: pT + iH - ((r.value - mn) / rng) * iH, value: r.value, time: r.time, ok: r.value >= 70 && r.value <= 140 }));
            return (
              <div>
                <svg viewBox={`0 0 ${cW} ${cH}`} style={{ width: '100%' }}>
                  <rect x={pL} y={y140} width={iW} height={y70 - y140} fill="rgba(100,180,130,.08)" />
                  <line x1={pL} y1={y140} x2={cW - pR} y2={y140} stroke="rgba(100,180,130,.3)" strokeWidth="0.8" strokeDasharray="4 2" />
                  <text x={pL - 4} y={y140 + 3} textAnchor="end" fontSize="8" fill="rgba(0,0,0,0.3)">140</text>
                  <line x1={pL} y1={y70} x2={cW - pR} y2={y70} stroke="rgba(100,180,130,.3)" strokeWidth="0.8" strokeDasharray="4 2" />
                  <text x={pL - 4} y={y70 + 3} textAnchor="end" fontSize="8" fill="rgba(0,0,0,0.3)">70</text>
                  {pts.map((pt, i) => i > 0 && <line key={`s${i}`} x1={pts[i-1].x} y1={pts[i-1].y} x2={pt.x} y2={pt.y} stroke={pts[i-1].ok && pt.ok ? '#4A9A7A' : '#E8944A'} strokeWidth="2.5" strokeLinecap="round" />)}
                  {pts.map((pt, i) => <circle key={`d${i}`} cx={pt.x} cy={pt.y} r="3" fill={pt.ok ? '#4A9A7A' : '#E8944A'} stroke="#fff" strokeWidth="1" />)}
                  {pts.map((pt, i) => { const edge = i === 0 || i === pts.length - 1; const ext = pt.value === Math.max(...vl) || pt.value === Math.min(...vl); if (!edge && !ext) return null; return <text key={`v${i}`} x={pt.x} y={pt.y - 6} textAnchor="middle" fontSize="8" fontWeight="600" fill={pt.ok ? '#3A7A5A' : '#C4700A'}>{pt.value}</text>; })}
                  {pts.map((pt, i) => { const sk = pts.length > 10 ? 3 : pts.length > 6 ? 2 : 1; if (i % sk !== 0 && i !== pts.length - 1) return null; return <text key={`tm${i}`} x={pt.x} y={cH - 6} textAnchor="middle" fontSize="7.5" fill="rgba(0,0,0,0.25)">{pt.time}</text>; })}
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8, padding: '10px 0', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                  {[{ l: '최저', v: Math.min(...vl) }, { l: '평균', v: Math.round(vl.reduce((a, b) => a + b, 0) / vl.length) }, { l: '최고', v: Math.max(...vl) }].map(s => (
                    <div key={s.l} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.3)', marginBottom: 2 }}>{s.l}</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: s.v > 140 ? '#E8944A' : 'var(--text-primary)' }}>{s.v}<span style={{ fontSize: 10, color: 'rgba(0,0,0,0.25)', marginLeft: 2 }}>mg/dL</span></div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {!graphLoading && !graphData && (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>📊</div>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.3)' }}>혈당 그래프 사진을 올리면</div>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.3)' }}>AI가 수치를 읽어 그래프로 보여줘요</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)', border: 'none', background: 'var(--bg-input, #F2F3F5)', color: 'var(--text-muted)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button onClick={handleSave} style={{ flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)', border: 'none', background: 'var(--accent-primary)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>저장</button>
        </div>
      </div>
    </div>
  );
}

const DRINK_CATEGORIES = [
  { key: 'coffee', emoji: '☕', name: '커피' },
  { key: 'tea', emoji: '🍵', name: '차' },
  { key: 'energy_soda', emoji: '⚡', name: '에너지·탄산' },
  { key: 'cafe_drink', emoji: '🥤', name: '카페 음료' },
];

const CAFFEINE_ITEMS = [
  // 커피
  { key: 'americano', name: '아메리카노', icon: '☕', mg: 150, category: 'coffee' },
  { key: 'latte', name: '라떼', icon: '🥛', mg: 100, category: 'coffee' },
  { key: 'cappuccino', name: '카푸치노', icon: '☕', mg: 80, category: 'coffee' },
  { key: 'espresso', name: '에스프레소', icon: '☕', mg: 75, category: 'coffee' },
  { key: 'cold_brew', name: '콜드브루', icon: '🧊', mg: 200, category: 'coffee' },
  { key: 'decaf', name: '디카페인', icon: '☕', mg: 5, category: 'coffee' },
  // 차
  { key: 'green_tea', name: '녹차', icon: '🍵', mg: 30, category: 'tea' },
  { key: 'matcha', name: '말차', icon: '🍵', mg: 70, category: 'tea' },
  { key: 'hojicha', name: '호지차', icon: '🍵', mg: 10, category: 'tea' },
  { key: 'black_tea', name: '홍차', icon: '🍵', mg: 47, category: 'tea' },
  { key: 'oolong', name: '우롱차', icon: '🍵', mg: 38, category: 'tea' },
  // 에너지·탄산
  { key: 'energy_drink', name: '에너지드링크', icon: '⚡', mg: 160, category: 'energy_soda' },
  { key: 'cola', name: '콜라', icon: '🥤', mg: 35, category: 'energy_soda' },
  // 카페 음료
  { key: 'choco_latte', name: '초코라떼', icon: '🍫', mg: 30, category: 'cafe_drink' },
  { key: 'green_tea_latte', name: '그린티라떼', icon: '🍵', mg: 80, category: 'cafe_drink' },
  { key: 'chai_latte', name: '차이라떼', icon: '🥛', mg: 50, category: 'cafe_drink' },
];

const ALCOHOL_ITEMS = [
  { key: 'beer', name: '맥주', icon: '🍺', ml: 500 },
  { key: 'makgeolli', name: '막걸리', icon: '🍶', ml: 300 },
  { key: 'highball', name: '하이볼', icon: '🥃', ml: 350 },
  { key: 'wine', name: '와인', icon: '🍷', ml: 150 },
  { key: 'cocktail', name: '칵테일', icon: '🍸', ml: 200 },
  { key: 'soju', name: '소주', icon: '🍶', ml: 50 },
  { key: 'whiskey', name: '위스키', icon: '🥃', ml: 45 },
];

function DrinkModal({ onClose, onSave }) {
  const swipe = useSwipeDown(onClose);
  const todayKey = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState('caffeine');
  const [drinkCategory, setDrinkCategory] = useState('coffee');
  const [ncCategory, setNcCategory] = useState('herb');
  const [records, setRecords] = useState(() => {
    try { const all = JSON.parse(localStorage.getItem('lua_drink_records') || '{}'); const r = all[todayKey] || {}; return { caffeine: r.caffeine || [], noncaffeine: r.noncaffeine || [], alcohol: r.alcohol || [] }; }
    catch { return { caffeine: [], noncaffeine: [], alcohol: [] }; }
  });
  const [ncIntents, setNcIntents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [drunkTimeMode, setDrunkTimeMode] = useState('now');
  const [customTime, setCustomTime] = useState('');

  const items = tab === 'caffeine' ? CAFFEINE_ITEMS.filter(i => i.category === drinkCategory) : tab === 'noncaffeine' ? NONCAFFEINE_ITEMS.filter(i => i.category === ncCategory) : ALCOHOL_ITEMS;
  const allCafItems = CAFFEINE_ITEMS;
  const list = tab === 'caffeine' ? records.caffeine : tab === 'noncaffeine' ? (records.noncaffeine || []) : records.alcohol;
  const accent = tab === 'noncaffeine' ? '#7B5E9E' : '#B8865C';

  const getCount = (key) => list.find(d => d.key === key)?.count || 0;
  const setCount = (key, count) => {
    const item = (tab === 'caffeine' ? allCafItems : tab === 'noncaffeine' ? NONCAFFEINE_ITEMS : ALCOHOL_ITEMS).find(i => i.key === key);
    let updated;
    if (count <= 0) { updated = list.filter(d => d.key !== key); }
    else {
      const existing = list.find(d => d.key === key);
      if (existing) { updated = list.map(d => d.key === key ? { ...d, count } : d); }
      else { updated = [...list, { key, name: item.name, icon: item.icon, count }]; }
    }
    setRecords(prev => ({ ...prev, [tab]: updated }));
  };

  const getDrunkAt = () => {
    const now = new Date();
    if (drunkTimeMode === '30min') return new Date(now.getTime() - 30 * 60 * 1000);
    if (drunkTimeMode === 'custom' && customTime) { const [h, m] = customTime.split(':').map(Number); const d = new Date(now); d.setHours(h, m, 0, 0); return d; }
    return now;
  };
  const formatTime = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const handleSave = () => {
    if (!selected) return;
    try {
      const all = JSON.parse(localStorage.getItem('lua_drink_records') || '{}');
      const drunkAt = getDrunkAt().toISOString();
      const updatedRecords = { ...records, noncaffeine: records.noncaffeine || [] };
      if (tab === 'caffeine') { updatedRecords.caffeine = records.caffeine.map(d => ({ ...d, drunkAt: d.drunkAt || drunkAt })); }
      else if (tab === 'noncaffeine') { updatedRecords.noncaffeine = (records.noncaffeine || []).map(d => ({ ...d, drunkAt: d.drunkAt || drunkAt, intents: d.intents || ncIntents })); }
      else { updatedRecords.alcohol = records.alcohol.map(d => ({ ...d, drunkAt: d.drunkAt || drunkAt })); }
      all[todayKey] = updatedRecords;
      localStorage.setItem('lua_drink_records', JSON.stringify(all));
      const drinkType = tab === 'caffeine' ? 'drink_caffeine' : tab === 'alcohol' ? 'drink_alcohol' : 'drink_noncaffeine';
      window.dispatchEvent(new CustomEvent('lua-drink-logged', { detail: { type: drinkType, tab } }));
    } catch {}

    if (tab === 'caffeine' && cafMg > 30) {
      const drunkAtDate = getDrunkAt();
      const now = new Date();
      const minutesAgo = (now.getTime() - drunkAtDate.getTime()) / (1000 * 60);
      if (minutesAgo >= 60) {
        const latestDrink = records.caffeine[records.caffeine.length - 1];
        onSave({ drunkAt: drunkAtDate, drinkName: latestDrink?.name || '카페인', amount: cafTotal, caffeineMg: cafMg });
        return;
      } else {
        const delayMs = (60 - minutesAgo) * 60 * 1000;
        const latestDrink = records.caffeine[records.caffeine.length - 1];
        scheduleCaffeineEffectNotification(delayMs, latestDrink?.name || '카페인', cafTotal);
      }
    }
    onSave(null);
  };

  const cafTotal = records.caffeine.reduce((s, d) => s + d.count, 0);
  const alcTotal = records.alcohol.reduce((s, d) => s + d.count, 0);
  const cafMg = records.caffeine.reduce((s, d) => { const item = allCafItems.find(c => c.key === d.key); return s + (item?.mg || 0) * d.count; }, 0);

  const userWeight = getLatestWeight()?.weight || 0;
  const cafState = calculateCaffeineState(cafMg, userWeight, 0);

  const selItem = selected ? (tab === 'caffeine' ? allCafItems : tab === 'noncaffeine' ? NONCAFFEINE_ITEMS : ALCOHOL_ITEMS).find(i => i.key === selected) : null;
  const selCount = selected ? getCount(selected) : 0;

  const nowTime = new Date();
  const thirtyAgo = new Date(nowTime.getTime() - 30 * 60 * 1000);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div ref={swipe.elRef} onTouchStart={swipe.onTouchStart} onTouchMove={swipe.onTouchMove} onTouchEnd={swipe.onTouchEnd} onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '18px 18px 36px', width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.1)', margin: '0 auto 16px' }} />
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 24, textAlign: 'center' }}>음료</div>

        {/* 카페인/논카페인/알콜 토글 */}
        <div style={{ display: 'flex', gap: 3, background: '#F4F4F4', borderRadius: 10, padding: 3, marginBottom: 14 }}>
          {[
            { key: 'caffeine', label: '☕ 카페인', color: '#B8865C' },
            { key: 'noncaffeine', label: '🌿 논카페인', color: '#7B5E9E' },
            { key: 'alcohol', label: '🍺 알콜', color: '#B8865C' },
          ].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setSelected(null); setNcIntents([]); }} style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: 'none', background: tab === t.key ? t.color : 'transparent', color: tab === t.key ? '#fff' : '#6B8499', fontSize: 9, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>{t.label}</button>
          ))}
        </div>

        {/* 카테고리 탭 (카페인) */}
        {tab === 'caffeine' && (
          <>
            <div style={{ fontSize: 10, fontWeight: 500, color: '#4A6B85', marginBottom: 8 }}>어떤 종류 드셨어요?</div>
            <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
              {DRINK_CATEGORIES.map(cat => (
                <div key={cat.key} onClick={() => { setDrinkCategory(cat.key); setSelected(null); }} style={{
                  flex: 1, padding: '9px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: drinkCategory === cat.key ? '#B8865C' : '#F4F4F4',
                  color: drinkCategory === cat.key ? '#fff' : '#6B8499',
                  transition: 'all 0.15s ease',
                }}>
                  <div style={{ fontSize: 14, marginBottom: 2 }}>{cat.emoji}</div>
                  <div style={{ fontSize: 8, fontWeight: drinkCategory === cat.key ? 500 : 400 }}>{cat.name}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 카테고리 탭 (논카페인) */}
        {tab === 'noncaffeine' && (
          <>
            <div style={{ fontSize: 10, fontWeight: 500, color: '#4A6B85', marginBottom: 8 }}>어떤 종류 드셨어요?</div>
            <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
              {NC_CATEGORIES.map(cat => (
                <div key={cat.key} onClick={() => { setNcCategory(cat.key); setSelected(null); }} style={{
                  flex: 1, padding: '9px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  background: ncCategory === cat.key ? '#7B5E9E' : '#F4F4F4',
                  color: ncCategory === cat.key ? '#fff' : '#6B8499',
                  transition: 'all 0.15s ease',
                }}>
                  <div style={{ fontSize: 14, marginBottom: 2 }}>{cat.emoji}</div>
                  <div style={{ fontSize: 8, fontWeight: ncCategory === cat.key ? 500 : 400 }}>{cat.name}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 메뉴 칩 */}
        <div style={{ fontSize: 10, fontWeight: 500, color: '#4A6B85', marginBottom: 8 }}>메뉴 선택</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14, transition: 'opacity 0.15s ease' }}>
          {items.map(item => {
            const active = selected === item.key;
            const hasRecord = getCount(item.key) > 0;
            return (
              <div key={item.key} onClick={() => setSelected(active ? null : item.key)} style={{
                padding: '7px 11px', borderRadius: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                background: active ? '#FAF1E0' : '#F4F4F4',
                border: active ? '0.5px solid #B8865C' : '0.5px solid transparent',
                transition: 'all 0.15s ease',
              }}>
                <span style={{ fontSize: 11 }}>{item.icon}</span>
                <span style={{ fontSize: 10, fontWeight: active ? 500 : 400, color: active ? '#6B4A2A' : '#2C4A5E' }}>{item.name}</span>
                {hasRecord && <span style={{ fontSize: 9, fontWeight: 600, color: '#B8865C' }}>{getCount(item.key)}</span>}
              </div>
            );
          })}
        </div>

        {/* 잔수 조절 */}
        {selItem ? (
          <div style={{ background: tab === 'noncaffeine' ? 'rgba(238,237,254,0.7)' : '#FAF1E0', borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>{selItem.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: tab === 'noncaffeine' ? '#4A3A6B' : '#2C4A5E' }}>{selItem.name}</span>
              </div>
              <span style={{ fontSize: 9, color: tab === 'noncaffeine' ? '#8A7AAB' : '#8A5A3C' }}>{tab === 'noncaffeine' ? '카페인 없음' : `~${selItem.mg}mg/잔`}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div onClick={() => { if (selCount > 0.5) setCount(selected, selCount - 0.5); }} style={{ width: 28, height: 28, borderRadius: '50%', background: tab === 'noncaffeine' ? 'white' : '#F4F4F4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14, color: '#6B8499' }}>−</div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 22, fontWeight: 500, color: tab === 'noncaffeine' ? '#4A3A6B' : '#6B4A2A' }}>{selCount || 0}</span>
                <span style={{ fontSize: 9, color: tab === 'noncaffeine' ? '#8A7AAB' : '#8A5A3C', marginLeft: 4 }}>잔</span>
              </div>
              <div onClick={() => setCount(selected, (selCount || 0) + 0.5)} style={{ width: 28, height: 28, borderRadius: '50%', background: tab === 'noncaffeine' ? 'white' : '#F4F4F4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14, color: accent }}>+</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0.5, 1, 1.5, 2].map(v => (
                <div key={v} onClick={() => setCount(selected, v)} style={{
                  flex: 1, padding: '5px', borderRadius: 7, textAlign: 'center', cursor: 'pointer', fontSize: 9,
                  background: selCount === v ? accent : 'white', color: selCount === v ? '#fff' : '#6B8499', fontWeight: selCount === v ? 500 : 400,
                  transition: 'all 0.15s',
                }}>{v}잔</div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ background: '#F8F8F5', borderRadius: 14, padding: 14, textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 9, color: '#8BA6BD' }}>메뉴를 선택하면</div>
            <div style={{ fontSize: 11, color: '#6B8499', marginTop: 2 }}>잔 수 입력이 나타나요</div>
          </div>
        )}

        {/* 의도 칩 (논카페인 탭) */}
        {tab === 'noncaffeine' && selected && (
          <div style={{ background: 'rgba(123,94,158,0.08)', borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 9, color: '#4A3A6B', marginBottom: 6, fontWeight: 500 }}>🌿 왜 마셨어요? (선택)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {NONCAFFEINE_INTENTS.map(opt => {
                const active = ncIntents.includes(opt.key);
                return (
                  <div key={opt.key} onClick={() => setNcIntents(prev => prev.includes(opt.key) ? prev.filter(k => k !== opt.key) : [...prev, opt.key])} style={{
                    padding: '5px 9px', borderRadius: 10, cursor: 'pointer', fontSize: 9,
                    display: 'flex', alignItems: 'center', gap: 3,
                    background: active ? 'rgba(123,94,158,0.20)' : 'white',
                    border: active ? '0.5px solid rgba(123,94,158,0.4)' : '0.5px solid transparent',
                    color: active ? '#4A3A6B' : '#6B8499', fontWeight: active ? 500 : 400,
                  }}>
                    <span>{opt.emoji}</span><span>{opt.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 카페인 게이지 */}
        {tab === 'caffeine' && (
          <div style={{ background: '#FFF8F0', borderRadius: 12, padding: 11, border: '0.5px solid rgba(184,134,92,0.2)', marginBottom: 12, opacity: selected ? 1 : 0.6, transition: 'opacity 0.2s' }}>
            <div style={{ fontSize: 9, color: '#8A5A3C', letterSpacing: 0.3, marginBottom: 6, fontWeight: 500 }}>📊 오늘 누적</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#2C4A5E' }}>{Math.round(cafState.projectedMg)} <span style={{ fontSize: 9, color: '#8A5A3C' }}>/ {cafState.limitMg}mg</span></span>
              <span style={{ fontSize: 9, color: cafState.statusColor, fontWeight: 500 }}>{cafState.status}</span>
            </div>
            <div style={{ width: '100%', height: 4, background: '#F4F4F4', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${cafState.percent}%`, height: '100%', background: cafState.gaugeColor, borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}

        {/* 수분 보충 안내 (카페인/알콜) */}
        {selected && selCount > 0 && tab !== 'noncaffeine' && (() => {
          const DRINK_ML = { americano: 350, latte: 350, cappuccino: 350, espresso: 60, cold_brew: 350, decaf: 350, green_tea: 250, matcha: 250, hojicha: 250, black_tea: 250, oolong: 250, energy_drink: 250, cola: 355, choco_latte: 350, green_tea_latte: 350, chai_latte: 350, beer: 500, makgeolli: 300, highball: 350, wine: 150, cocktail: 200, soju: 50, whiskey: 45 };
          const drinkMl = DRINK_ML[selected] || 250;
          const totalMl = Math.round(drinkMl * selCount);
          const ratio = tab === 'alcohol' ? 1.5 : 1.0;
          const compensationMl = Math.round(totalMl * ratio);
          const totalCaffeine = selItem?.mg ? selItem.mg * selCount : 0;
          if (tab === 'caffeine' && totalCaffeine < 10) return null;
          const isAlcohol = tab === 'alcohol';
          return (
            <div style={{
              background: isAlcohol ? 'rgba(217,124,94,0.12)' : 'rgba(74,107,133,0.08)',
              border: `0.5px solid ${isAlcohol ? 'rgba(217,124,94,0.4)' : 'rgba(74,107,133,0.25)'}`,
              borderRadius: 12, padding: 11, marginBottom: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                <span style={{ fontSize: 12 }}>💧</span>
                <span style={{ fontSize: 9, fontWeight: 500, color: isAlcohol ? '#8A4A3C' : '#4A6B85' }}>물도 같이 챙기면 좋아요{isAlcohol ? ' 💧' : ''}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 5 }}>
                <span style={{ fontSize: 16, fontWeight: 500, color: '#2C4A5E' }}>+{compensationMl}</span>
                <span style={{ fontSize: 9, color: '#6B8499' }}>ml</span>
              </div>
              <div style={{ fontSize: 8, color: '#6B8499', lineHeight: 1.4 }}>
                {isAlcohol ? '알코올 이뇨작용으로 음료의 1.5배 보충 필요해요' : `이 음료의 카페인 영향으로 물 ${compensationMl}ml 더 챙기면 좋아요`}
              </div>
              {isAlcohol && (
                <div style={{ background: 'white', borderRadius: 8, padding: '6px 8px', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 10 }}>💡</span>
                  <span style={{ fontSize: 8, color: '#4A3A2E', lineHeight: 1.4 }}>자기 전 한 잔, 다음날 아침 한 잔 어때요?</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* 시간 선택 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: '#4A6B85', marginBottom: 6 }}>언제 마셨어요?</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { key: 'now', label: '방금', sub: formatTime(nowTime) },
              { key: '30min', label: '30분 전', sub: formatTime(thirtyAgo) },
              { key: 'custom', label: '시간 선택', sub: '' },
            ].map(opt => (
              <div key={opt.key} onClick={() => setDrunkTimeMode(opt.key)} style={{
                flex: 1, padding: '7px 4px', borderRadius: 9, textAlign: 'center', cursor: 'pointer',
                background: drunkTimeMode === opt.key ? '#FAF1E0' : '#F4F4F4',
                border: drunkTimeMode === opt.key ? '0.5px solid #B8865C' : '0.5px solid transparent',
              }}>
                <div style={{ fontSize: 9, fontWeight: 500, color: drunkTimeMode === opt.key ? '#6B4A2A' : '#6B8499' }}>{opt.label}</div>
                {opt.sub && <div style={{ fontSize: 7, color: '#8A5A3C', marginTop: 1 }}>{opt.sub}</div>}
                {opt.key === 'custom' && drunkTimeMode === 'custom' && (
                  <input type="time" value={customTime} onChange={e => setCustomTime(e.target.value)} style={{ fontSize: 8, border: 'none', background: 'transparent', width: '100%', textAlign: 'center', outline: 'none', color: '#8A5A3C', marginTop: 2 }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', background: '#F4F4F4', color: '#6B8499', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button onClick={handleSave} disabled={!selected || selCount === 0} style={{ flex: 1.5, padding: '9px', borderRadius: 10, border: 'none', background: (selected && selCount > 0) ? '#B8865C' : '#F4F4F4', color: (selected && selCount > 0) ? '#fff' : '#8BA6BD', fontSize: 10, fontWeight: 500, cursor: (selected && selCount > 0) ? 'pointer' : 'default', fontFamily: 'inherit', transition: 'all 0.15s' }}>저장</button>
        </div>
      </div>
    </div>
  );
}

// 상세 페이지 공통 컴포넌트
function CardDetailPage({ type, data, onClose }) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayLabel = (() => {
    const d = new Date();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${days[d.getDay()]}요일`;
  })();

  const headerColor = type === 'sleep' ? '#4A4F7F' : type === 'condition' ? '#B8865C' : '#5E9D8A';

  // 수면 상세
  const renderSleepDetail = () => {
    const allData = (() => { try { return JSON.parse(localStorage.getItem('lua_record_v2') || '{}'); } catch { return {}; } })();
    const todayRec = allData[todayKey]?.sleep || data || {};
    const hours = todayRec.hours || data?.hours || 0;
    const quality = todayRec.quality || data?.quality || '';
    const bedtime = todayRec.bedtime || data?.bedtime || '';
    const wakeTime = todayRec.wakeTime || data?.wakeTime || '';

    // 최근 7일 평균
    const last7 = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const rec = allData[d]?.sleep;
      if (rec?.hours) last7.push(rec.hours);
    }
    const avg7 = last7.length > 0 ? (last7.reduce((a, b) => a + b, 0) / last7.length).toFixed(1) : null;

    // 카페인 데이터 (어제)
    const yesterdayKey = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const cafData = (() => { try { const all = JSON.parse(localStorage.getItem('lua_drink_records') || '{}'); return all[yesterdayKey] || { caffeine: [] }; } catch { return { caffeine: [] }; } })();
    const cafMg = cafData.caffeine.reduce((s, d) => { const item = CAFFEINE_ITEMS.find(c => c.key === d.key); return s + (item?.mg || 0) * (d.count || 0); }, 0);
    const lastCafTime = cafData.caffeine.length > 0 ? cafData.caffeine[cafData.caffeine.length - 1]?.drunkAt : null;

    return (
      <>
        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', marginBottom: 20 }}>{todayLabel} · {bedtime && wakeTime ? `${bedtime} → ${wakeTime}` : ''}</div>

        {/* 수면 정보 */}
        <div style={{ background: 'rgba(91,106,175,0.05)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#5B6AAF', fontWeight: 500, marginBottom: 12 }}>수면 정보</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: '총 수면', value: `${hours}시간`, icon: '⏱' },
              { label: '수면의 질', value: quality || '미입력', icon: '🌊' },
              { label: '취침 시각', value: bedtime || '—', icon: '🛏' },
              { label: '기상 시각', value: wakeTime || '—', icon: '☀' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.4)' }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#2C4A5E' }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 주간 비교 */}
        {avg7 && (
          <div style={{ background: 'rgba(91,106,175,0.05)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#5B6AAF', fontWeight: 500, marginBottom: 10 }}>주간 비교</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.4)' }}>7일 평균</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#2C4A5E' }}>{avg7}시간</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.4)' }}>오늘</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: hours >= parseFloat(avg7) ? '#5E9D8A' : '#C97C5E' }}>
                  {hours}시간 {hours >= parseFloat(avg7) ? '↑' : '↓'}
                </div>
              </div>
            </div>
            {/* 미니 바 차트 */}
            <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', marginTop: 12, height: 40 }}>
              {[...last7].reverse().map((h, i) => (
                <div key={i} style={{ flex: 1, background: 'rgba(91,106,175,0.2)', borderRadius: 3, height: `${Math.max(10, (h / 12) * 100)}%` }} />
              ))}
              <div style={{ flex: 1, background: '#5B6AAF', borderRadius: 3, height: `${Math.max(10, (hours / 12) * 100)}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <span style={{ fontSize: 8, color: 'rgba(0,0,0,0.3)' }}>오늘</span>
            </div>
          </div>
        )}

        {/* 영향 요인 */}
        {cafMg > 0 && (
          <div style={{ background: '#FFF8F0', borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#B8865C', fontWeight: 500, marginBottom: 8 }}>수면 영향 요인</div>
            <div style={{ fontSize: 12, color: '#4A3A2E', lineHeight: 1.6 }}>
              어제 카페인 {cafMg}mg 섭취{lastCafTime ? ` (마지막: ${new Date(lastCafTime).getHours()}시)` : ''}
              {cafMg > 200 ? ' — 수면 질에 영향을 줄 수 있어요' : ''}
            </div>
          </div>
        )}
      </>
    );
  };

  // 컨디션 상세
  const renderConditionDetail = () => {
    const allChecks = (() => { try { return JSON.parse(localStorage.getItem('nou_condition_checks') || '[]'); } catch { return []; } })();
    const todayChecks = allChecks.filter(c => c.date === todayKey);
    const latestCheck = todayChecks[todayChecks.length - 1] || data || {};
    const mood = latestCheck.mood || data?.mood || 5;
    const energy = latestCheck.energy || data?.energy || 5;
    const score = Math.round((mood + energy) / 2 * 10);

    // 최근 7일 점수
    const last7scores = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const dayChecks = allChecks.filter(c => c.date === d);
      const last = dayChecks[dayChecks.length - 1];
      if (last) last7scores.push(Math.round((last.mood + last.energy) / 2 * 10));
    }
    const avg7 = last7scores.length > 0 ? Math.round(last7scores.reduce((a, b) => a + b, 0) / last7scores.length) : null;

    // 수면 (오늘)
    const sleepData = (() => { try { const all = JSON.parse(localStorage.getItem('lua_record_v2') || '{}'); return all[todayKey]?.sleep || null; } catch { return null; } })();

    return (
      <>
        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', marginBottom: 20 }}>{todayLabel}</div>

        {/* 점수 */}
        <div style={{ background: 'rgba(184,134,92,0.06)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#B8865C', fontWeight: 500, marginBottom: 12 }}>컨디션 점수</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.4)' }}>종합</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: '#2C4A5E' }}>{score}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.4)' }}>기분</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: '#D4707E' }}>{mood * 10}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.4)' }}>에너지</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: '#E8A135' }}>{energy * 10}</div>
            </div>
          </div>
        </div>

        {/* 주간 추이 */}
        {last7scores.length > 0 && (
          <div style={{ background: 'rgba(184,134,92,0.06)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#B8865C', fontWeight: 500, marginBottom: 10 }}>7일 추이</div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 50 }}>
              {[...last7scores].reverse().map((s, i) => (
                <div key={i} style={{ flex: 1, background: s >= 70 ? 'rgba(94,157,138,0.4)' : s >= 50 ? 'rgba(184,134,92,0.4)' : 'rgba(201,124,94,0.4)', borderRadius: 3, height: `${Math.max(10, s)}%` }} />
              ))}
              <div style={{ flex: 1, background: score >= 70 ? '#5E9D8A' : score >= 50 ? '#B8865C' : '#C97C5E', borderRadius: 3, height: `${Math.max(10, score)}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 8, color: 'rgba(0,0,0,0.3)' }}>7일 전</span>
              <span style={{ fontSize: 8, color: 'rgba(0,0,0,0.3)' }}>오늘</span>
            </div>
            {avg7 && <div style={{ fontSize: 10, color: '#6B8499', marginTop: 8 }}>7일 평균 {avg7}점 {score > avg7 ? '↑' : score < avg7 ? '↓' : '→'} 오늘 {score}점</div>}
          </div>
        )}

        {/* 영향 요인 */}
        <div style={{ background: '#FFF8F0', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#B8865C', fontWeight: 500, marginBottom: 8 }}>영향 요인</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sleepData && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#4A3A2E' }}>
                <span>{sleepData.hours >= 7 ? '↑' : '↓'}</span>
                <span>수면 {sleepData.hours}시간 {sleepData.hours >= 7 ? '(충분)' : '(부족)'}</span>
              </div>
            )}
            {!sleepData && <div style={{ fontSize: 11, color: '#8A5A3C' }}>수면 데이터를 기록하면 영향 분석을 볼 수 있어요</div>}
          </div>
        </div>
      </>
    );
  };

  // 식단 상세
  const renderMealDetail = () => {
    if (!data) return <div style={{ fontSize: 12, color: '#6B8499' }}>식사 데이터가 없어요</div>;
    const { name, meal, kcal, protein, carb, fat, fiber, iron, calcium, sugar, bloodSugar, bloodSugarNote, drowsiness, drowsinessNote, skinImpact, skinImpactNote, ingredients } = data;

    return (
      <>
        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', marginBottom: 20 }}>{todayLabel} · {meal || '식사'}</div>

        {/* 음식명 */}
        <div style={{ fontSize: 16, fontWeight: 600, color: '#2C4A5E', marginBottom: 16 }}>{name || '식사'}</div>

        {/* 영양 정보 */}
        <div style={{ background: 'rgba(94,157,138,0.06)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#5E9D8A', fontWeight: 500, marginBottom: 12 }}>영양 정보</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { icon: '🔥', label: '칼로리', value: `${kcal || 0}kcal` },
              { icon: '🥩', label: '단백질', value: `${protein || 0}g` },
              { icon: '🍞', label: '탄수화물', value: `${carb || 0}g` },
              { icon: '🥑', label: '지방', value: `${fat || 0}g` },
              { icon: '🥕', label: '식이섬유', value: `${fiber || 0}g` },
              { icon: '🍯', label: '당류', value: `${sugar || 0}g` },
              { icon: '🥦', label: '철분', value: `${iron || 0}mg` },
              { icon: '🐟', label: '칼슘', value: `${calcium || 0}mg` },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.4)' }}>{item.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#2C4A5E' }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 재료 구성 */}
        {ingredients && ingredients.length > 0 && (
          <div style={{ background: 'rgba(94,157,138,0.06)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#5E9D8A', fontWeight: 500, marginBottom: 10 }}>재료 구성</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ingredients.map((ing, i) => (
                <div key={i} style={{ fontSize: 11, color: '#4A3A2E', padding: '4px 0', borderBottom: i < ingredients.length - 1 ? '0.5px solid rgba(0,0,0,0.05)' : 'none' }}>
                  {typeof ing === 'string' ? ing : `${ing.name || ''} ${ing.amount || ''}`}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 식후 영향 분석 */}
        {(bloodSugar || drowsiness || skinImpact) && (
          <div style={{ background: '#FFF8F0', borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#B8865C', fontWeight: 500, marginBottom: 10 }}>식후 영향 분석</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bloodSugar && (
                <div>
                  <div style={{ fontSize: 11, color: '#4A3A2E', fontWeight: 500 }}>📈 혈당 상승 [{bloodSugar}]</div>
                  {bloodSugarNote && <div style={{ fontSize: 10, color: '#6B8499', marginTop: 2, lineHeight: 1.5 }}>{bloodSugarNote}</div>}
                </div>
              )}
              {drowsiness && (
                <div>
                  <div style={{ fontSize: 11, color: '#4A3A2E', fontWeight: 500 }}>😴 졸림 확률 [{drowsiness}]</div>
                  {drowsinessNote && <div style={{ fontSize: 10, color: '#6B8499', marginTop: 2, lineHeight: 1.5 }}>{drowsinessNote}</div>}
                </div>
              )}
              {skinImpact && (
                <div>
                  <div style={{ fontSize: 11, color: '#4A3A2E', fontWeight: 500 }}>✨ 피부 영향 [{skinImpact}]</div>
                  {skinImpactNote && <div style={{ fontSize: 10, color: '#6B8499', marginTop: 2, lineHeight: 1.5 }}>{skinImpactNote}</div>}
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  };

  const titles = { sleep: '수면 분석', condition: '컨디션 분석', meal: '식사 분석' };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      background: '#fff', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      animation: 'slideInRight 0.3s ease',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
        <div onClick={onClose} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 18, color: headerColor }}>←</span>
          <span style={{ fontSize: 12, color: headerColor }}>돌아가기</span>
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 600, color: '#2C4A5E' }}>{titles[type] || '상세'}</div>
        <div style={{ width: 60 }} />
      </div>

      {/* 본문 */}
      <div style={{ padding: '0 20px 40px' }}>
        {type === 'sleep' && renderSleepDetail()}
        {type === 'condition' && renderConditionDetail()}
        {type === 'meal' && renderMealDetail()}
      </div>
    </div>
  );
}

// 카페인 효과 체크 로컬 알림 예약
const NC_CATEGORIES = [
  { key: 'herb', emoji: '🌿', name: '허브차' },
  { key: 'grain', emoji: '🌾', name: '곡물·씨앗차' },
  { key: 'root', emoji: '🫚', name: '뿌리·열매차' },
];

const NONCAFFEINE_ITEMS = [
  // 허브차
  { key: 'chrysanthemum', name: '국화차', icon: '🌼', category: 'herb' },
  { key: 'chamomile', name: '캐모마일', icon: '🌿', category: 'herb' },
  { key: 'hibiscus', name: '히비스커스', icon: '🌺', category: 'herb' },
  { key: 'rooibos', name: '루이보스', icon: '🌹', category: 'herb' },
  { key: 'peppermint', name: '페퍼민트', icon: '🍃', category: 'herb' },
  { key: 'spearmint', name: '스피어민트', icon: '🍃', category: 'herb' },
  { key: 'lemon_balm', name: '레몬밤', icon: '🍋', category: 'herb' },
  { key: 'rosemary', name: '로즈마리', icon: '🌱', category: 'herb' },
  { key: 'jasmine', name: '자스민', icon: '🌸', category: 'herb' },
  // 곡물·씨앗차
  { key: 'barley_tea', name: '보리차', icon: '🌾', category: 'grain' },
  { key: 'brown_rice_tea', name: '현미차', icon: '🍚', category: 'grain' },
  { key: 'corn_tea', name: '옥수수차', icon: '🌽', category: 'grain' },
  { key: 'corn_silk_tea', name: '옥수수수염차', icon: '🌽', category: 'grain' },
  { key: 'cassia_tea', name: '결명자차', icon: '🫘', category: 'grain' },
  // 뿌리·열매차
  { key: 'ginger_tea', name: '생강차', icon: '🫚', category: 'root' },
  { key: 'burdock_tea', name: '우엉차', icon: '🥕', category: 'root' },
  { key: 'pumpkin_tea', name: '호박차', icon: '🎃', category: 'root' },
  { key: 'red_bean_tea', name: '팥차', icon: '🫘', category: 'root' },
];

const NONCAFFEINE_INTENTS = [
  { key: 'sleep', emoji: '😴', label: '잠 잘 자려고' },
  { key: 'calm', emoji: '😌', label: '진정·릴렉스' },
  { key: 'stress', emoji: '💆', label: '스트레스 풀려고' },
  { key: 'pms', emoji: '🌙', label: 'PMS 완화' },
  { key: 'decaffeine', emoji: '☕', label: '카페인 줄이려고' },
  { key: 'just_like', emoji: '🤍', label: '그냥 좋아서' },
];

// NoncaffeineModal - merged into DrinkModal as 논카페인 tab
function _NoncaffeineModal_UNUSED() { return null; /* kept for reference */
  const [timeMode, setTimeMode] = useState('now');
  const [customTime, setCustomTime] = useState('');

  const formatTime = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const nowTime = new Date();
  const thirtyAgo = new Date(nowTime.getTime() - 30 * 60 * 1000);

  const getDrunkAt = () => {
    const now = new Date();
    if (timeMode === '30min') return new Date(now.getTime() - 30 * 60 * 1000);
    if (timeMode === 'custom' && customTime) { const [h, m] = customTime.split(':').map(Number); const d = new Date(now); d.setHours(h, m, 0, 0); return d; }
    return now;
  };

  const toggleIntent = (key) => {
    setIntents(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleSave = () => {
    if (!selected) return;
    try {
      const all = JSON.parse(localStorage.getItem('lua_noncaffeine_records') || '{}');
      const todayLogs = all[todayKey] || [];
      todayLogs.push({ key: selected, name: NONCAFFEINE_ITEMS.find(i => i.key === selected)?.name, amount, intents, drunkAt: getDrunkAt().toISOString(), createdAt: new Date().toISOString() });
      all[todayKey] = todayLogs;
      localStorage.setItem('lua_noncaffeine_records', JSON.stringify(all));
    } catch {}
    onSave();
  };

  // lua 메시지
  const luaMsg = (() => {
    if (!selected || intents.length === 0) return null;
    try {
      const all = JSON.parse(localStorage.getItem('lua_noncaffeine_records') || '{}');
      const allLogs = Object.values(all).flat();
      const thisWeek = allLogs.filter(l => { const d = new Date(l.createdAt); return (Date.now() - d.getTime()) < 7 * 86400000; });
      const count = thisWeek.length + 1;
      if (intents.includes('decaffeine')) {
        const cafData = (() => { try { const dr = JSON.parse(localStorage.getItem('lua_drink_records') || '{}'); const td = dr[todayKey] || { caffeine: [] }; return td.caffeine.reduce((s, d) => { const item = CAFFEINE_ITEMS.find(c => c.key === d.key); return s + (item?.mg || 0) * (d.count || 0); }, 0); } catch { return 0; } })();
        if (cafData > 200) return `오늘 카페인 ${cafData}mg 마셨는데 논카페인으로 균형 잘 잡으셨어요`;
        return `카페인 의식하는 좋은 선택이에요`;
      }
      if (intents.includes('sleep')) return `이번 주 잠용 ${count}번째 · 수면 데이터 쌓이면 효과 분석 가능`;
      if (intents.includes('calm') || intents.includes('stress')) return `이번 주 ${count}번째 진정 음료`;
      return `이번 주 논카페인 ${count}번째`;
    } catch { return null; }
  })();

  const selItem = selected ? NONCAFFEINE_ITEMS.find(i => i.key === selected) : null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '18px 18px 36px', width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.1)', margin: '0 auto 16px' }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: '#2C4A5E', marginBottom: 14, textAlign: 'center' }}>논카페인 기록</div>

        {/* 음료 선택 */}
        <div style={{ fontSize: 10, fontWeight: 500, color: '#4A6B85', marginBottom: 8 }}>어떤 음료 드셨어요?</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
          {NONCAFFEINE_ITEMS.map(item => {
            const active = selected === item.key;
            return (
              <div key={item.key} onClick={() => { setSelected(active ? null : item.key); if (!active) setAmount(1); }} style={{
                padding: '7px 11px', borderRadius: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                background: active ? 'rgba(123,94,158,0.12)' : '#F4F4F4',
                border: active ? '0.5px solid #7B5E9E' : '0.5px solid transparent',
                transition: 'all 0.15s ease',
              }}>
                <span style={{ fontSize: 11 }}>{item.icon}</span>
                <span style={{ fontSize: 10, fontWeight: active ? 500 : 400, color: active ? '#4A3A6B' : '#2C4A5E' }}>{item.name}</span>
              </div>
            );
          })}
        </div>

        {/* 잔수 조절 */}
        {selItem ? (
          <div style={{ background: 'rgba(238,237,254,0.7)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>{selItem.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#4A3A6B' }}>{selItem.name}</span>
              </div>
              <span style={{ fontSize: 9, color: '#8A7AAB' }}>0kcal · 카페인 없음</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div onClick={() => { if (amount > 0.5) setAmount(amount - 0.5); }} style={{ width: 28, height: 28, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14, color: '#6B8499' }}>−</div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 22, fontWeight: 500, color: '#4A3A6B' }}>{amount}</span>
                <span style={{ fontSize: 9, color: '#8A7AAB', marginLeft: 4 }}>잔</span>
              </div>
              <div onClick={() => setAmount(amount + 0.5)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14, color: '#7B5E9E' }}>+</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0.5, 1, 1.5, 2].map(v => (
                <div key={v} onClick={() => setAmount(v)} style={{
                  flex: 1, padding: '5px', borderRadius: 7, textAlign: 'center', cursor: 'pointer', fontSize: 9,
                  background: amount === v ? '#7B5E9E' : 'white', color: amount === v ? '#fff' : '#6B8499', fontWeight: amount === v ? 500 : 400,
                }}>{v}잔</div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ background: '#F8F8F5', borderRadius: 14, padding: 14, textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 9, color: '#8BA6BD' }}>음료를 선택하면</div>
            <div style={{ fontSize: 11, color: '#6B8499', marginTop: 2 }}>잔 수 입력이 나타나요</div>
          </div>
        )}

        {/* 의도 칩 */}
        {selected && (
          <div style={{ background: 'rgba(123,94,158,0.08)', borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 9, color: '#4A3A6B', marginBottom: 6, fontWeight: 500 }}>🌿 왜 마셨어요? (선택)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {NONCAFFEINE_INTENTS.map(opt => {
                const active = intents.includes(opt.key);
                return (
                  <div key={opt.key} onClick={() => toggleIntent(opt.key)} style={{
                    padding: '5px 9px', borderRadius: 10, cursor: 'pointer', fontSize: 9,
                    display: 'flex', alignItems: 'center', gap: 3,
                    background: active ? 'rgba(123,94,158,0.20)' : 'white',
                    border: active ? '0.5px solid rgba(123,94,158,0.4)' : '0.5px solid transparent',
                    color: active ? '#4A3A6B' : '#6B8499', fontWeight: active ? 500 : 400,
                  }}>
                    <span>{opt.emoji}</span><span>{opt.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 시간 선택 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: '#4A6B85', marginBottom: 6 }}>언제 마셨어요?</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { key: 'now', label: '방금', sub: formatTime(nowTime) },
              { key: '30min', label: '30분 전', sub: formatTime(thirtyAgo) },
              { key: 'custom', label: '시간 선택', sub: '' },
            ].map(opt => (
              <div key={opt.key} onClick={() => setTimeMode(opt.key)} style={{
                flex: 1, padding: '7px 4px', borderRadius: 9, textAlign: 'center', cursor: 'pointer',
                background: timeMode === opt.key ? 'rgba(123,94,158,0.12)' : '#F4F4F4',
                border: timeMode === opt.key ? '0.5px solid #7B5E9E' : '0.5px solid transparent',
              }}>
                <div style={{ fontSize: 9, fontWeight: 500, color: timeMode === opt.key ? '#4A3A6B' : '#6B8499' }}>{opt.label}</div>
                {opt.sub && <div style={{ fontSize: 7, color: '#6B4A8A', marginTop: 1 }}>{opt.sub}</div>}
                {opt.key === 'custom' && timeMode === 'custom' && (
                  <input type="time" value={customTime} onChange={e => setCustomTime(e.target.value)} style={{ fontSize: 8, border: 'none', background: 'transparent', width: '100%', textAlign: 'center', outline: 'none', color: '#6B4A8A', marginTop: 2 }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* lua 메시지 */}
        {luaMsg && (
          <div style={{ background: 'rgba(94,157,138,0.08)', borderRadius: 10, padding: 9, marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: '#2E6E5A', lineHeight: 1.4 }}>{luaMsg}</div>
          </div>
        )}

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', background: '#F4F4F4', color: '#6B8499', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button onClick={handleSave} disabled={!selected} style={{ flex: 1.5, padding: '9px', borderRadius: 10, border: 'none', background: selected ? '#7B5E9E' : '#F4F4F4', color: selected ? '#fff' : '#8BA6BD', fontSize: 10, fontWeight: 500, cursor: selected ? 'pointer' : 'default', fontFamily: 'inherit', transition: 'all 0.15s' }}>저장</button>
        </div>
      </div>
    </div>
  );
}

function scheduleCaffeineEffectNotification(delayMs, drinkName, amount) {
  // localStorage에 예약 저장 (앱 재진입 시 체크용)
  const scheduled = {
    fireAt: new Date(Date.now() + delayMs).toISOString(),
    drinkName,
    amount,
  };
  localStorage.setItem('lua_caffeine_effect_scheduled', JSON.stringify(scheduled));

  // 브라우저 Notification API (허용된 경우)
  if ('Notification' in window && Notification.permission === 'granted') {
    setTimeout(() => {
      new Notification('☕ 효과 체크 시간이에요', {
        body: `${drinkName} ${amount}잔 마신 후 1시간 지났어요. 30초만 체크해요`,
        tag: 'caffeine-effect',
      });
    }, delayMs);
  }
}

// 카페인 효과 체크 모달
function CaffeineEffectCheckModal({ drink, onClose, onSave }) {
  const [positiveEffects, setPositiveEffects] = useState([]);
  const [negativeEffects, setNegativeEffects] = useState([]);

  const positiveOptions = [
    { id: 'alert', emoji: '⚡', label: '정신 또렷' },
    { id: 'focus', emoji: '🎯', label: '집중 잘됨' },
    { id: 'refreshed', emoji: '💪', label: '피로 풀림' },
    { id: 'unsure', emoji: '😶', label: '잘 모르겠음' },
  ];

  const negativeOptions = [
    { id: 'heart_pounding', emoji: '💓', label: '심장 두근' },
    { id: 'anxious', emoji: '😰', label: '긴장됨' },
    { id: 'nauseous', emoji: '🤢', label: '속 불편' },
    { id: 'frequent_urine', emoji: '💧', label: '화장실 자주' },
    { id: 'none', emoji: '✨', label: '없어요' },
  ];

  const togglePositive = (id) => {
    setPositiveEffects(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleNegative = (id) => {
    if (id === 'none') {
      setNegativeEffects(['none']);
    } else {
      setNegativeEffects(prev => {
        const without = prev.filter(x => x !== 'none');
        return without.includes(id) ? without.filter(x => x !== id) : [...without, id];
      });
    }
  };

  const getTimeSince = () => {
    if (!drink?.drunkAt) return '';
    const diff = (new Date().getTime() - new Date(drink.drunkAt).getTime()) / (1000 * 60);
    const h = Math.floor(diff / 60);
    const m = Math.round(diff % 60);
    if (h > 0) return `${h}시간 ${m}분 전`;
    return `${m}분 전`;
  };

  const getEffectPhase = () => {
    if (!drink?.drunkAt) return '';
    const diff = (new Date().getTime() - new Date(drink.drunkAt).getTime()) / (1000 * 60);
    if (diff <= 120) return '효과 절정 시간이에요';
    if (diff <= 180) return '효과 슬슬 줄어드는 시간';
    return '효과 거의 끝났어요';
  };

  const handleSave = () => {
    try {
      const checks = JSON.parse(localStorage.getItem('lua_caffeine_effect_checks') || '[]');
      checks.push({
        drunkAt: drink.drunkAt,
        drinkName: drink.drinkName,
        amount: drink.amount,
        caffeineMg: drink.caffeineMg,
        checkedAt: new Date().toISOString(),
        positiveEffects,
        negativeEffects,
        skipped: false,
      });
      localStorage.setItem('lua_caffeine_effect_checks', JSON.stringify(checks));
    } catch {}
    localStorage.removeItem('lua_caffeine_effect_scheduled');
    onSave();
  };

  const handleSkip = () => {
    localStorage.removeItem('lua_caffeine_effect_scheduled');
    onClose();
  };

  // 패턴 분석 (5건 이상)
  const patternInsight = (() => {
    try {
      const checks = JSON.parse(localStorage.getItem('lua_caffeine_effect_checks') || '[]');
      if (checks.length < 5) return null;
      const positiveCount = {};
      const negativeCount = {};
      checks.forEach(c => {
        (c.positiveEffects || []).forEach(e => { positiveCount[e] = (positiveCount[e] || 0) + 1; });
        (c.negativeEffects || []).filter(e => e !== 'none').forEach(e => { negativeCount[e] = (negativeCount[e] || 0) + 1; });
      });
      const topPositive = Object.entries(positiveCount).sort((a, b) => b[1] - a[1])[0];
      const topNegative = Object.entries(negativeCount).sort((a, b) => b[1] - a[1])[0];
      const topPosLabel = topPositive ? positiveOptions.find(o => o.id === topPositive[0])?.label : null;
      const topNegLabel = topNegative ? negativeOptions.find(o => o.id === topNegative[0])?.label : null;
      return { topPosLabel, topNegLabel, totalLogs: checks.length };
    } catch { return null; }
  })();

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px 24px 40px', width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.1)', margin: '0 auto 20px' }} />
        <div style={{ fontSize: 17, fontWeight: 600, color: '#2C4A5E', marginBottom: 16, textAlign: 'center' }}>카페인 효과 체크</div>

        {/* 마신 음료 정보 */}
        <div style={{ background: '#FAF1E0', borderRadius: 14, padding: 14, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>☕</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: '#6B4A2A' }}>
              {drink.drinkName} {drink.amount}잔
            </span>
          </div>
          <div style={{ fontSize: 9, color: '#8A5A3C', marginTop: 4, paddingLeft: 22 }}>
            {getTimeSince()} · {getEffectPhase()}
          </div>
        </div>

        {/* 긍정 효과 */}
        <div style={{ fontSize: 11, fontWeight: 500, color: '#4A6B85', marginBottom: 10 }}>긍정 효과 — 느껴지는 거 있어요?</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {positiveOptions.map(opt => {
            const active = positiveEffects.includes(opt.id);
            return (
              <div key={opt.id} onClick={() => togglePositive(opt.id)} style={{
                padding: '7px 11px', borderRadius: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                background: active ? 'rgba(94, 157, 138, 0.15)' : '#F4F4F4',
                border: active ? '0.5px solid rgba(94, 157, 138, 0.4)' : '0.5px solid transparent',
                transition: 'all 0.15s ease',
              }}>
                <span style={{ fontSize: 11 }}>{opt.emoji}</span>
                <span style={{ fontSize: 10, fontWeight: active ? 500 : 400, color: active ? '#2E6E5A' : '#2C4A5E' }}>{opt.label}</span>
              </div>
            );
          })}
        </div>

        {/* 부정 효과 */}
        <div style={{ fontSize: 11, fontWeight: 500, color: '#4A6B85', marginBottom: 10 }}>불편한 거 있어요?</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {negativeOptions.map(opt => {
            const active = negativeEffects.includes(opt.id);
            const isNone = opt.id === 'none';
            return (
              <div key={opt.id} onClick={() => toggleNegative(opt.id)} style={{
                padding: '7px 11px', borderRadius: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                background: active
                  ? (isNone ? 'rgba(94, 157, 138, 0.15)' : 'rgba(217, 124, 94, 0.15)')
                  : '#F4F4F4',
                border: active
                  ? (isNone ? '0.5px solid rgba(94, 157, 138, 0.4)' : '0.5px solid rgba(217, 124, 94, 0.4)')
                  : '0.5px solid transparent',
                transition: 'all 0.15s ease',
              }}>
                <span style={{ fontSize: 11 }}>{opt.emoji}</span>
                <span style={{ fontSize: 10, fontWeight: active ? 500 : 400, color: active ? (isNone ? '#2E6E5A' : '#8A4A3C') : '#2C4A5E' }}>{opt.label}</span>
              </div>
            );
          })}
        </div>

        {/* 패턴 발견 (5건 이상) */}
        {patternInsight && (
          <div style={{ background: '#FAF8F4', borderRadius: 14, padding: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 9, color: '#8A5A3C', letterSpacing: 0.3, marginBottom: 6, fontWeight: 500 }}>🔍 lua가 발견한 패턴</div>
            <div style={{ fontSize: 11, color: '#4A3A2E', lineHeight: 1.6 }}>
              {patternInsight.topPosLabel && <span>주로 <strong style={{ color: '#2E6E5A' }}>{patternInsight.topPosLabel}</strong>을 느끼는 편이에요. </span>}
              {patternInsight.topNegLabel && <span><strong style={{ color: '#8A4A3C' }}>{patternInsight.topNegLabel}</strong>이 가끔 있어요. </span>}
              <span style={{ fontSize: 9, color: '#8A5A3C' }}>({patternInsight.totalLogs}건 기반)</span>
            </div>
          </div>
        )}

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleSkip} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', background: '#F4F4F4', color: '#6B8499', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>건너뛰기</button>
          <button onClick={handleSave} style={{ flex: 1.5, padding: '11px 0', borderRadius: 12, border: 'none', background: '#B8865C', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>기록하기</button>
        </div>
      </div>
    </div>
  );
}

const SUPP_TIMING_LABELS = {
  morning: { emoji: '🌅', label: '아침', color: '#B8865C' },
  lunch: { emoji: '🌞', label: '점심', color: '#C8A040' },
  evening: { emoji: '🌆', label: '저녁', color: '#8A7060' },
  bedtime: { emoji: '🌙', label: '취침 전', color: '#7B5E9E' },
};

function SupplementModal({ onClose, onUpdate, onCheck }) {
  const swipe = useSwipeDown(onClose);
  const [items, setItems] = useState(getSupplementItems);
  const [checks, setChecks] = useState(() => getSupplementChecks());
  const [newName, setNewName] = useState('');
  const [newTiming, setNewTiming] = useState('morning');
  const [showAdd, setShowAdd] = useState(false);

  const handleToggle = (id) => {
    const updated = toggleSupplementCheck(id);
    setChecks(updated);
    hapticLight();
    onCheck?.();
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    const updated = addSupplementItem(newName.trim(), newTiming);
    setItems(updated);
    setNewName('');
    setShowAdd(false);
  };

  const handleDelete = (id) => {
    const updated = deleteSupplementItem(id);
    setItems(updated);
  };

  const doneCount = items.filter(s => checks[s.id]).length;
  const grouped = {};
  ['morning', 'lunch', 'evening', 'bedtime'].forEach(t => { grouped[t] = items.filter(s => s.timing === t); });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div ref={swipe.elRef} onTouchStart={swipe.onTouchStart} onTouchMove={swipe.onTouchMove} onTouchEnd={swipe.onTouchEnd} onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0', padding: '24px 24px 40px', width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, textAlign: 'center' }}>영양제</div>

        {/* 진행 상황 */}
        {items.length > 0 && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 13, color: doneCount === items.length ? '#22C55E' : 'var(--text-muted)' }}>
              오늘 {doneCount}/{items.length} 완료
            </span>
          </div>
        )}

        {/* 시간대별 체크리스트 */}
        {items.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
            {['morning', 'lunch', 'evening', 'bedtime'].map(timing => {
              const group = grouped[timing];
              if (group.length === 0) return null;
              const tl = SUPP_TIMING_LABELS[timing];
              const groupDone = group.filter(s => checks[s.id]).length;
              return (
                <div key={timing}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 12 }}>{tl.emoji}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: tl.color }}>{tl.label}</span>
                    <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.25)' }}>— {groupDone}/{group.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {group.map(item => {
                      const done = !!checks[item.id];
                      const mealLabel = item.meal === 'before' ? '식전' : item.meal === 'with' ? '식사와 함께' : item.meal === 'any' ? '' : '식후';
                      return (
                        <div key={item.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 12px', borderRadius: 12,
                          background: done ? 'rgba(94,157,138,0.08)' : 'rgba(0,0,0,0.02)',
                          border: done ? '1px solid rgba(94,157,138,0.15)' : '1px solid rgba(0,0,0,0.04)',
                          transition: 'all 0.15s ease',
                        }}>
                          <div onClick={() => handleToggle(item.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: 'pointer' }}>
                            <div style={{
                              width: 20, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: done ? '#5E9D8A' : 'rgba(0,0,0,0.06)', transition: 'all 0.15s ease',
                            }}>
                              {done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                            <span style={{
                              fontSize: 13, fontWeight: 500,
                              color: done ? 'rgba(0,0,0,0.35)' : 'var(--text-primary)',
                              textDecoration: done ? 'line-through' : 'none',
                            }}>{item.name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {mealLabel && <span style={{ fontSize: 9, color: 'rgba(0,0,0,0.25)' }}>{mealLabel}</span>}
                            <div onClick={() => handleDelete(item.id)} style={{ fontSize: 12, color: 'rgba(0,0,0,0.12)', cursor: 'pointer', padding: '2px 4px' }}>✕</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '30px 0', textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💊</div>
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.3)' }}>영양제 등록해두면 매일 체크할 수 있어요</div>
          </div>
        )}

        {/* 추가 영역 */}
        {showAdd ? (
          <div style={{ padding: '16px', borderRadius: 16, background: 'rgba(0,0,0,0.02)', border: '1.5px solid rgba(0,0,0,0.05)', marginBottom: 20 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="영양제 이름"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', fontSize: 14, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {['morning', 'lunch', 'evening', 'bedtime'].map(t => {
                const tl = SUPP_TIMING_LABELS[t];
                return (
                  <div key={t} onClick={() => setNewTiming(t)} style={{
                    flex: 1, padding: '8px 0', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                    background: newTiming === t ? 'rgba(184,134,92,0.1)' : 'rgba(0,0,0,0.03)',
                    border: newTiming === t ? '1.5px solid rgba(184,134,92,0.4)' : '1.5px solid rgba(0,0,0,0.06)',
                    fontSize: 11, fontWeight: newTiming === t ? 600 : 500, color: newTiming === t ? '#B8865C' : 'rgba(0,0,0,0.4)',
                  }}>{tl.label}</div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.4)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
              <button onClick={handleAdd} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: '#B8865C', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>추가</button>
            </div>
          </div>
        ) : (
          <div onClick={() => setShowAdd(true)} style={{
            padding: '12px 0', borderRadius: 14, textAlign: 'center', cursor: 'pointer', marginBottom: 20,
            border: '1.5px dashed rgba(184,134,92,0.2)', color: 'rgba(184,134,92,0.6)', fontSize: 13, fontWeight: 500,
          }}>+ 일회성 영양제 추가</div>
        )}

        {/* 닫기 */}
        <button onClick={() => { onUpdate(); }} style={{
          width: '100%', padding: '14px 0', borderRadius: 'var(--btn-radius)',
          border: 'none', background: '#B8865C', color: '#fff',
          fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>완료</button>
      </div>
    </div>
  );
}

// ===== 피부 자가 체크 모달 (Phase 2) =====
const SCORE_GUIDES = [
  { score: 10, label: '완벽', desc: '빛나고 균일한 피부', color: '#D4A76A' },
  { score: 9, label: '매우 좋음', desc: '트러블 없고 매끄러움', color: '#C9A065' },
  { score: 8, label: '좋음', desc: '전반적으로 안정적', color: '#5E9D8A' },
  { score: 7, label: '괜찮음', desc: '약간 신경쓰이지만 양호', color: '#5E9D8A' },
  { score: 6, label: '평소', desc: '본인 평균 수준', color: '#8A9EAD' },
  { score: 5, label: '보통', desc: '한두 가지 문제 있음', color: '#8A9EAD' },
  { score: 4, label: '약간 안 좋음', desc: '여러 신호 보임', color: '#C9A065' },
  { score: 3, label: '안 좋음', desc: '트러블 + 컨디션 하락', color: '#C97C5E' },
  { score: 2, label: '많이 안 좋음', desc: '여러 부위 트러블', color: '#C97C5E' },
  { score: 1, label: '매우 안 좋음', desc: '심한 트러블이나 염증', color: '#B85C5C' },
];

const FACE_ZONES = [
  { key: 'tZone', label: '이마 (T존)', desc: '이마, 코, 코 주변' },
  { key: 'uZone', label: '볼·광대 (U존)', desc: '양쪽 볼, 광대뼈' },
  { key: 'mouthArea', label: '입 주변', desc: '입 가장자리, 인중' },
  { key: 'jawNeck', label: '턱·목', desc: '턱선, 목 부위' },
];

const SIGNAL_CATEGORIES = [
  { key: 'oilTexture', name: '유분·결', icon: '💧', signals: ['번들거림', '건조함', '결 거칠음', '피지 분비 증가'] },
  { key: 'troubles', name: '트러블', icon: '🔴', signals: ['새 여드름', '화이트헤드', '블랙헤드', '염증성 트러블'] },
  { key: 'colorTone', name: '색조·톤', icon: '🎨', signals: ['칙칙함', '붉어짐', '색소 불균일', '다크서클'] },
  { key: 'irritation', name: '자극·민감', icon: '🌡️', signals: ['가려움', '따끔거림', '홍조·열감', '예민함'] },
  { key: 'other', name: '기타', icon: '✨', signals: ['붓기', '모공 도드라짐', '각질'] },
];

function calculateAutoScore(selectedZones, selectedSignals) {
  let score = 7;
  const serious = ['새 여드름', '염증성 트러블', '홍조·열감'];
  const mild = ['건조함', '번들거림', '칙칙함'];
  for (const z of selectedZones) {
    const sev = z.severity || 1;
    score -= sev === 3 ? 1.5 : sev === 2 ? 1 : 0.5;
  }
  for (const sig of selectedSignals) {
    if (serious.includes(sig)) score -= 1;
    else if (mild.includes(sig)) score -= 0.3;
    else score -= 0.5;
  }
  return Math.max(1, Math.min(10, Math.round(score)));
}

function SkinCheckModal({ onClose, onUpdate }) {
  const swipe = useSwipeDown(onClose);
  const todayKey = new Date().toISOString().slice(0, 10);
  const existingLog = (() => { try { return JSON.parse(localStorage.getItem('lua_skin_check_logs') || '{}')[todayKey] || null; } catch { return null; } })();

  // 어제 + 7일 데이터
  const comparison = useMemo(() => {
    try {
      const logs = JSON.parse(localStorage.getItem('lua_skin_check_logs') || '{}');
      const ydKey = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const yesterdayLog = logs[ydKey];
      const yesterdayScore = yesterdayLog?.score || null;
      const weekScores = [];
      for (let i = 1; i <= 7; i++) {
        const dk = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        if (logs[dk]?.score) weekScores.push(logs[dk].score);
      }
      const weekAvg = weekScores.length >= 2 ? Math.round(weekScores.reduce((a, b) => a + b, 0) / weekScores.length * 10) / 10 : null;
      const weekMin = weekScores.length >= 2 ? Math.min(...weekScores) : null;
      const weekMax = weekScores.length >= 2 ? Math.max(...weekScores) : null;
      return { yesterdayScore, weekAvg, weekMin, weekMax, weekDays: weekScores.length };
    } catch { return { yesterdayScore: null, weekAvg: null, weekMin: null, weekMax: null, weekDays: 0 }; }
  }, []);

  const defaultScore = existingLog?.score || comparison.yesterdayScore || 7;
  const [score, setScore] = useState(defaultScore);
  const [zones, setZones] = useState(existingLog?.zones || []);
  const [selectedSignals, setSelectedSignals] = useState(existingLog?.signals || []);
  const [memo, setMemo] = useState(existingLog?.memo || '');
  const [openCategory, setOpenCategory] = useState('oilTexture');
  const [showAutoHint, setShowAutoHint] = useState(false);
  const sliderRef = useRef(null);

  const guide = SCORE_GUIDES.find(g => g.score === score) || SCORE_GUIDES[3];

  // 자동 점수 계산
  const autoScore = useMemo(() => {
    if (zones.length === 0 && selectedSignals.length === 0) return null;
    return calculateAutoScore(zones, selectedSignals);
  }, [zones, selectedSignals]);

  useEffect(() => {
    if (autoScore !== null && Math.abs(autoScore - score) >= 2) setShowAutoHint(true);
    else setShowAutoHint(false);
  }, [autoScore, score]);

  // 슬라이더 터치/마우스 핸들러
  const handleSliderInteraction = useCallback((clientX) => {
    const el = sliderRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const val = Math.max(1, Math.min(10, Math.round(pct * 9 + 1)));
    setScore(val);
    hapticLight();
  }, []);

  const onSliderTouch = useCallback((e) => { e.preventDefault(); handleSliderInteraction(e.touches[0].clientX); }, [handleSliderInteraction]);
  const onSliderMouse = useCallback((e) => { if (e.buttons === 1) handleSliderInteraction(e.clientX); }, [handleSliderInteraction]);

  // 부위 토글
  const toggleZone = (zoneKey) => {
    setZones(prev => {
      const exists = prev.find(z => z.zone === zoneKey);
      if (exists) return prev.filter(z => z.zone !== zoneKey);
      return [...prev, { zone: zoneKey, signals: [], severity: 1 }];
    });
  };

  // 신호 토글
  const toggleSignal = (sig) => {
    setSelectedSignals(prev => prev.includes(sig) ? prev.filter(s => s !== sig) : [...prev, sig]);
  };

  // 카테고리별 선택 수
  const getCatCount = (cat) => cat.signals.filter(s => selectedSignals.includes(s)).length;

  // 저장
  const handleSave = () => {
    try {
      const logs = JSON.parse(localStorage.getItem('lua_skin_check_logs') || '{}');
      const logData = {
        score,
        autoCalculatedScore: autoScore,
        zones,
        signals: selectedSignals,
        memo: memo.trim() || undefined,
        createdAt: new Date().toISOString(),
        source: 'user',
        // 기존 호환
        overallCondition: score >= 8 ? 'glowing' : score >= 6 ? 'okay' : score >= 4 ? 'normal' : 'bad',
        locations: zones.map(z => z.zone === 'tZone' ? 'forehead' : z.zone === 'uZone' ? 'cheek' : z.zone === 'jawNeck' ? 'chin' : 'nose'),
      };
      logs[todayKey] = logData;
      localStorage.setItem('lua_skin_check_logs', JSON.stringify(logs));
      // 기존 호환
      const legacySignals = selectedSignals.map(s => {
        if (s.includes('여드름') || s.includes('트러블')) return 'new_trouble';
        if (s.includes('건조')) return 'dry';
        if (s.includes('번들')) return 'oily';
        if (s.includes('붓기')) return 'puffy';
        if (s.includes('홍조') || s.includes('붉어')) return 'redness';
        if (s.includes('예민') || s.includes('가려') || s.includes('따끔')) return 'sensitive';
        if (s.includes('칙칙')) return 'dull';
        return null;
      }).filter(Boolean);
      saveSkinSubCheck({ tags: [...new Set(legacySignals)] });
      window.dispatchEvent(new CustomEvent('lua-skin-logged', { detail: logData }));
    } catch {}
    onUpdate();
  };

  const sliderPct = ((score - 1) / 9) * 100;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div ref={swipe.elRef} onTouchStart={swipe.onTouchStart} onTouchMove={swipe.onTouchMove} onTouchEnd={swipe.onTouchEnd} onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '20px 20px 40px', width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.1)', margin: '0 auto 16px' }} />
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>피부</div>
          <div style={{ fontSize: 12, color: '#8A9EAD', marginTop: 2 }}>{new Date().getMonth() + 1}월 {new Date().getDate()}일 {new Date().getHours()}:{String(new Date().getMinutes()).padStart(2, '0')}</div>
        </div>

        {/* [1] 점수 슬라이더 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 14 }}>
            <span style={{ fontSize: 24, fontWeight: 500, color: guide.color }}>{score}</span>
            <span style={{ fontSize: 13, color: '#8A9EAD' }}>/10</span>
          </div>
          <div ref={sliderRef}
            onTouchStart={onSliderTouch} onTouchMove={onSliderTouch}
            onMouseDown={onSliderMouse} onMouseMove={onSliderMouse}
            style={{ position: 'relative', height: 32, cursor: 'pointer', touchAction: 'none', userSelect: 'none' }}>
            <div style={{ position: 'absolute', top: 13, left: 0, right: 0, height: 6, borderRadius: 3, background: '#F0F0F0' }} />
            <div style={{ position: 'absolute', top: 13, left: 0, width: `${sliderPct}%`, height: 6, borderRadius: 3, background: guide.color, transition: 'width 0.05s' }} />
            <div style={{ position: 'absolute', top: 7, left: `${sliderPct}%`, transform: 'translateX(-50%)', width: 18, height: 18, borderRadius: '50%', background: '#fff', border: `2px solid ${guide.color}`, boxShadow: '0 1px 4px rgba(0,0,0,0.15)', transition: 'left 0.05s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: '#B0B8C0' }}>1</span>
            <span style={{ fontSize: 10, color: '#B0B8C0' }}>10</span>
          </div>
          <div style={{ background: `${guide.color}12`, borderRadius: 10, padding: '8px 12px', marginTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: guide.color }}>{guide.label}</span>
            <span style={{ fontSize: 11, color: '#6B8499', marginLeft: 6 }}>{guide.desc}</span>
          </div>
        </div>

        {/* [2] 부위별 체크 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#2C4A5E', marginBottom: 4 }}>부위별로 어때요?</div>
          <div style={{ fontSize: 11, color: '#8A9EAD', marginBottom: 10 }}>신경쓰이는 부위만 탭하세요</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {FACE_ZONES.map(z => {
              const active = zones.some(zz => zz.zone === z.key);
              return (
                <div key={z.key} onClick={() => toggleZone(z.key)} style={{
                  padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                  background: active ? 'rgba(184, 134, 92, 0.08)' : '#FAFAFA',
                  border: active ? '0.5px solid rgba(184, 134, 92, 0.3)' : '0.5px solid #ECECEC',
                  transition: 'all 0.15s',
                }}>
                  <div style={{ fontSize: 12, fontWeight: active ? 500 : 400, color: active ? '#6B4A2A' : '#2C4A5E' }}>{z.label}</div>
                  <div style={{ fontSize: 10, color: '#8A9EAD', marginTop: 2 }}>{active ? '선택됨' : z.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* [3] 눈에 띄는 신호 (카테고리) */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#2C4A5E', marginBottom: 4 }}>눈에 띄는 신호</div>
          <div style={{ fontSize: 11, color: '#8A9EAD', marginBottom: 10 }}>카테고리별로 정리됐어요</div>
          {SIGNAL_CATEGORIES.map(cat => {
            const isOpen = openCategory === cat.key;
            const count = getCatCount(cat);
            return (
              <div key={cat.key} style={{ marginBottom: 6 }}>
                <div onClick={() => setOpenCategory(isOpen ? null : cat.key)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                  background: count > 0 ? 'rgba(184, 134, 92, 0.06)' : '#FAFAFA',
                  border: count > 0 ? '0.5px solid rgba(184, 134, 92, 0.2)' : '0.5px solid #ECECEC',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13 }}>{cat.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#2C4A5E' }}>{cat.name}</span>
                    {count > 0 && <span style={{ fontSize: 10, color: '#B8865C', fontWeight: 500 }}>({count})</span>}
                  </div>
                  <span style={{ fontSize: 10, color: '#B0B8C0', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
                </div>
                {isOpen && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 4px' }}>
                    {cat.signals.map(sig => {
                      const active = selectedSignals.includes(sig);
                      return (
                        <div key={sig} onClick={() => toggleSignal(sig)} style={{
                          padding: '6px 10px', borderRadius: 14, cursor: 'pointer', fontSize: 11,
                          background: active ? 'rgba(184, 134, 92, 0.15)' : 'transparent',
                          border: active ? 'none' : '0.5px solid #ECECEC',
                          color: active ? '#6B4A2A' : '#6B8499', fontWeight: active ? 500 : 400,
                          transition: 'all 0.15s',
                        }}>{sig}</div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* [4] 메모 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#2C4A5E', marginBottom: 4 }}>오늘 특이사항 (선택)</div>
          <div style={{ fontSize: 11, color: '#8A9EAD', marginBottom: 8 }}>새 화장품, 외출, 스트레스 등</div>
          <textarea value={memo} onChange={e => setMemo(e.target.value.slice(0, 200))} placeholder="예: 새 토너 시도, 야외 활동 2시간" style={{
            width: '100%', minHeight: 56, padding: '10px 12px', borderRadius: 12, border: '0.5px solid #ECECEC',
            background: '#FAFAFA', fontSize: 12, color: '#2C4A5E', fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box',
          }} />
          {memo.length > 0 && <div style={{ fontSize: 10, color: '#B0B8C0', textAlign: 'right', marginTop: 2 }}>{memo.length}/200</div>}
        </div>

        {/* [5] 자동 점수 제안 */}
        {showAutoHint && autoScore !== null && (
          <div style={{ background: '#FFF8F0', borderRadius: 12, padding: '10px 14px', border: '0.5px solid rgba(184, 134, 92, 0.2)', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#6B4A2A', lineHeight: 1.5 }}>
              신호들로 보면 <strong>{autoScore}점</strong> 정도가 맞을 수 있어요. 직접 점수가 더 정확하다면 그대로 두셔도 좋아요
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => { setScore(autoScore); setShowAutoHint(false); }} style={{
                padding: '6px 12px', borderRadius: 8, border: 'none', background: '#B8865C', color: '#fff',
                fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              }}>{autoScore}점으로 조정</button>
              <button onClick={() => setShowAutoHint(false)} style={{
                padding: '6px 12px', borderRadius: 8, border: '0.5px solid #ddd', background: '#fff', color: '#6B8499',
                fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
              }}>유지</button>
            </div>
          </div>
        )}

        {/* [6] 어제·평균 비교 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, background: '#FAFAFA', borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: '#8A9EAD', marginBottom: 4 }}>어제 → 오늘</div>
            {comparison.yesterdayScore !== null ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#2C4A5E' }}>
                  {comparison.yesterdayScore} → {score}
                </div>
                <div style={{ fontSize: 11, color: score > comparison.yesterdayScore ? '#5E9D8A' : score < comparison.yesterdayScore ? '#C97C5E' : '#8A9EAD', marginTop: 2 }}>
                  {score > comparison.yesterdayScore ? `↑ +${score - comparison.yesterdayScore}점` : score < comparison.yesterdayScore ? `↓ ${score - comparison.yesterdayScore}점` : '동일'}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: '#B0B8C0' }}>첫 기록이에요!</div>
            )}
          </div>
          <div style={{ flex: 1, background: '#FAFAFA', borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: '#8A9EAD', marginBottom: 4 }}>7일 평균</div>
            {comparison.weekAvg !== null ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#2C4A5E' }}>{comparison.weekAvg}</div>
                <div style={{ fontSize: 11, color: '#8A9EAD', marginTop: 2 }}>{comparison.weekMin}-{comparison.weekMax} 범위</div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: '#B0B8C0' }}>더 기록하면 평균 보여드릴게요</div>
            )}
          </div>
        </div>

        {/* [7] 버튼 */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', background: '#F4F4F4', color: '#6B8499', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button onClick={handleSave} style={{ flex: 1.5, padding: '11px 0', borderRadius: 12, border: 'none', background: '#B8865C', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>저장</button>
        </div>
      </div>
    </div>
  );
}

function CycleModal({ onClose, onUpdate }) {
  const swipe = useSwipeDown(onClose);
  const [data, setData] = useState(getCycleData);
  const isUnset = !data || !data.lastPeriodStart;
  const cycleState = calculateCycleState(data);

  // 온보딩 상태
  const [startDate, setStartDate] = useState('');
  const [cycleLen, setCycleLen] = useState('28');
  const [periodLen, setPeriodLen] = useState('5');

  // 생리 시작/종료 기록
  const [showStartRecord, setShowStartRecord] = useState(false);
  const [startOption, setStartOption] = useState('today');

  const handleSetup = () => {
    if (!startDate) return;
    const newData = { lastPeriodStart: startDate, averageCycleLength: Number(cycleLen), averagePeriodLength: Number(periodLen) };
    saveCycleData(newData);
    setData(newData);
  };

  const handlePeriodStart = () => {
    const dateMap = { today: new Date(), yesterday: new Date(Date.now() - 86400000), '2days': new Date(Date.now() - 172800000) };
    const d = dateMap[startOption] || new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const prev = data || {};
    const newData = { ...prev, lastPeriodStart: dateStr, averageCycleLength: prev.averageCycleLength || 28, averagePeriodLength: prev.averagePeriodLength || 5 };
    saveCycleData(newData);
    setData(newData);
    setShowStartRecord(false);
  };

  const handlePeriodEnd = () => {
    if (!data?.lastPeriodStart) return;
    const start = new Date(data.lastPeriodStart);
    const today = new Date();
    const actualLen = Math.round((today - start) / 86400000);
    const avgLen = Math.round((data.averagePeriodLength + actualLen) / 2);
    const newData = { ...data, averagePeriodLength: Math.max(2, Math.min(10, avgLen)) };
    saveCycleData(newData);
    setData(newData);
  };

  const stageLabels = { menstrual: '생리기', follicular: '난포기', ovulation: '배란기', luteal_early: '황체기 초기', luteal_late: '황체기 후기' };
  const stageTips = {
    menstrual: '철분이 풍부한 음식과 따뜻한 차가 도움돼요',
    follicular: '에스트로겐이 올라가는 시기, 에너지가 좋아요',
    ovulation: '피부가 가장 빛나는 시기예요',
    luteal_early: '프로게스테론이 올라가요, 충분한 수면이 중요해요',
    luteal_late: '수분 섭취를 늘리고 자극적인 음식은 줄여보세요',
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div ref={swipe.elRef} onTouchStart={swipe.onTouchStart} onTouchMove={swipe.onTouchMove} onTouchEnd={swipe.onTouchEnd} onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0', padding: '24px 24px 40px', width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />

        {isUnset ? (
          /* ===== 온보딩 ===== */
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>주기</div>
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)' }}>30초면 끝나요</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.3)', marginBottom: 8 }}>마지막 생리 시작일</div>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)', fontSize: 15, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.3)', marginBottom: 8 }}>평균 주기</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" value={cycleLen} onChange={e => setCycleLen(e.target.value)}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)', fontSize: 18, fontWeight: 600, textAlign: 'center', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-display)' }} />
                  <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.3)', flexShrink: 0 }}>일</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.3)', marginBottom: 8 }}>생리 기간</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" value={periodLen} onChange={e => setPeriodLen(e.target.value)}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)', fontSize: 18, fontWeight: 600, textAlign: 'center', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-display)' }} />
                  <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.3)', flexShrink: 0 }}>일</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
              {[25, 26, 27, 28, 29, 30, 31, 32].map(v => (
                <div key={v} onClick={() => setCycleLen(String(v))} style={{
                  padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                  background: cycleLen === String(v) ? 'rgba(248,215,222,0.5)' : 'rgba(0,0,0,0.03)',
                  border: cycleLen === String(v) ? '1px solid rgba(248,215,222,0.8)' : '1px solid rgba(0,0,0,0.05)',
                  fontSize: 12, fontWeight: 500, color: cycleLen === String(v) ? '#8A4A6B' : 'rgba(0,0,0,0.4)',
                }}>{v}일</div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)', border: 'none', background: 'var(--bg-input, #F2F3F5)', color: 'var(--text-muted)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
              <button onClick={handleSetup} style={{ flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)', border: 'none', background: '#C090A8', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: startDate ? 1 : 0.4 }}>시작하기</button>
            </div>
          </div>
        ) : (
          /* ===== 주기 상세 ===== */
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>주기</div>
              <div style={{ fontSize: 28, fontWeight: 500, color: '#2C4A5E', fontFamily: 'var(--font-display)', letterSpacing: -1 }}>{cycleState.label}</div>
              <div style={{ fontSize: 13, color: '#6B8499', marginTop: 4 }}>{cycleState.subtitle}</div>
            </div>

            {/* 단계 인디케이터 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 20 }}>
              {['menstrual', 'follicular', 'ovulation', 'luteal_early', 'luteal_late'].map((stage, i) => {
                const active = cycleState.stage === stage;
                return (
                  <div key={stage} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: active ? 10 : 6, height: active ? 10 : 6, borderRadius: '50%',
                      background: active ? 'rgba(74,107,133,0.6)' : 'rgba(74,107,133,0.2)',
                      transition: 'all 0.3s ease',
                    }} />
                    {active && <span style={{ fontSize: 9, color: '#6B8499', fontWeight: 600 }}>{stageLabels[stage]}</span>}
                  </div>
                );
              })}
            </div>

            {/* 시기별 팁 */}
            {cycleState.stage && stageTips[cycleState.stage] && (
              <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(248,215,222,0.2)', marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: '#6B8499', lineHeight: 1.6 }}>💡 {stageTips[cycleState.stage]}</div>
              </div>
            )}

            {/* 빠른 기록 */}
            {showStartRecord ? (
              <div style={{ padding: '16px', borderRadius: 16, background: 'rgba(0,0,0,0.02)', border: '1.5px solid rgba(0,0,0,0.05)', marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>생리 시작일</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {[{ key: 'today', label: '오늘' }, { key: 'yesterday', label: '어제' }, { key: '2days', label: '2일 전' }].map(opt => (
                    <div key={opt.key} onClick={() => setStartOption(opt.key)} style={{
                      flex: 1, padding: '10px 0', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                      background: startOption === opt.key ? 'rgba(248,215,222,0.5)' : 'rgba(0,0,0,0.03)',
                      border: startOption === opt.key ? '1.5px solid rgba(248,215,222,0.8)' : '1.5px solid rgba(0,0,0,0.06)',
                      fontSize: 13, fontWeight: startOption === opt.key ? 600 : 500, color: startOption === opt.key ? '#8A4A6B' : 'rgba(0,0,0,0.4)',
                    }}>{opt.label}</div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowStartRecord(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.4)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
                  <button onClick={handlePeriodStart} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: '#C090A8', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>기록</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {cycleState.state === 'active' ? (
                  <div onClick={handlePeriodEnd} style={{
                    padding: '14px 16px', borderRadius: 14, cursor: 'pointer', textAlign: 'center',
                    background: 'rgba(248,215,222,0.3)', border: '1.5px solid rgba(248,215,222,0.5)',
                    fontSize: 14, fontWeight: 600, color: '#8A4A6B',
                  }}>생리 종료 기록</div>
                ) : (
                  <div onClick={() => setShowStartRecord(true)} style={{
                    padding: '14px 16px', borderRadius: 14, cursor: 'pointer', textAlign: 'center',
                    background: 'rgba(248,215,222,0.3)', border: '1.5px solid rgba(248,215,222,0.5)',
                    fontSize: 14, fontWeight: 600, color: '#8A4A6B',
                  }}>{cycleState.state === 'imminent' ? '오늘 시작했어요' : '생리 시작 기록'}</div>
                )}
              </div>
            )}

            <button onClick={() => onUpdate()} style={{
              width: '100%', padding: '14px 0', borderRadius: 'var(--btn-radius)',
              border: 'none', background: 'var(--bg-input, #F2F3F5)', color: 'var(--text-muted)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>닫기</button>
          </div>
        )}
      </div>
    </div>
  );
}
