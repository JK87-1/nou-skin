import { useState, useCallback, useRef, useEffect } from 'react';
import { getTodayFoods, getTodayNutrition, getFoodRecords, getNutritionForDate, getTimeAdjustedGoal, getFoodGoal, saveFoodRecord, deleteFoodRecord } from '../storage/FoodStorage';
import { getRecords, getChanges, getTotalChanges, getAllThumbnailsAsync } from '../storage/SkinStorage';
import { getBodyRecords, getLatestWeight, getStartWeight, getBodyGoal, getBodyProfile, calcBMI, saveBodyRecord, deleteBodyRecord } from '../storage/BodyStorage';
import { getEnabledCategories, getCategoryColor } from '../storage/ProfileStorage';
import { savePhotoDB, getPhotoDB, resizeImage } from '../storage/PhotoDB';
import { getRoutineItems, getChecks } from '../storage/RoutineCheckStorage';
import { getSupplementItems, addSupplementItem, deleteSupplementItem, getSupplementChecks, toggleSupplementCheck } from '../storage/SupplementStorage';
import { getProducts, saveProduct, deleteProduct, getTrackerChecks, toggleTrackerCheck, getProductsForMode, TRACKER_CATEGORIES } from '../storage/TrackerStorage';

const fadeUp = (delay = 0) => ({ animation: `breatheIn 0.5s ease ${delay}s both` });

const RECORD_V2_KEY = 'lua_record_v2';
function loadDayRecord(dateKey) {
  try { return (JSON.parse(localStorage.getItem(RECORD_V2_KEY) || '{}'))[dateKey] || null; } catch { return null; }
}
function saveDayRecord(dateKey, data) {
  try { const all = JSON.parse(localStorage.getItem(RECORD_V2_KEY) || '{}'); all[dateKey] = data; localStorage.setItem(RECORD_V2_KEY, JSON.stringify(all)); } catch {}
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
const DEFAULT_EXERCISE_IDS = ['walk', 'weight', 'run', 'cycle', 'yoga', 'swim'];
const EX_SETTINGS_KEY = 'lua_exercise_settings';
function getSelectedExerciseIds() {
  try { return JSON.parse(localStorage.getItem(EX_SETTINGS_KEY)) || DEFAULT_EXERCISE_IDS; } catch { return DEFAULT_EXERCISE_IDS; }
}
function saveSelectedExerciseIds(ids) { localStorage.setItem(EX_SETTINGS_KEY, JSON.stringify(ids)); }
function getExercises() {
  const ids = getSelectedExerciseIds();
  return ids.map(id => ALL_EXERCISES.find(e => e.id === id)).filter(Boolean);
}
const EXERCISES = getExercises();
const EX_DURATIONS = [15, 30, 45, 60];
function calcExMET(met, weight, mins) { return Math.round(met * weight * (mins / 60)); }
const SLEEP_QUALITIES = ['깊은 수면', '보통', '얕은 수면'];
const WATER_SETTINGS_KEY = 'lua_water_settings';
function getWaterSettings() {
  try { return { cupMl: 250, goalMl: 2000, ...JSON.parse(localStorage.getItem(WATER_SETTINGS_KEY) || '{}') }; } catch { return { cupMl: 250, goalMl: 2000 }; }
}
function saveWaterSettings(s) { localStorage.setItem(WATER_SETTINGS_KEY, JSON.stringify(s)); }

// 식단 사진: IndexedDB photoId면 로드, 기존 base64면 그대로 표시
function FoodPhoto({ photo, style, alt = '' }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (!photo) return;
    if (photo.startsWith('data:')) { setSrc(photo); return; }
    // IndexedDB photoId
    getPhotoDB(photo).then(url => { if (url) setSrc(url); });
  }, [photo]);
  if (!src) return null;
  return <img src={src} alt={alt} style={style} />;
}
const MEAL_LABELS = ['아침', '점심', '저녁', '간식'];
const MEAL_GRADIENTS = [
  'var(--accent-primary)',
  'var(--accent-primary)',
  'var(--accent-primary)',
  'var(--accent-primary)',
];

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const NutrientIcons = {
  protein: (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
      <path d="M7 21c-1-1.5-1-3.5 0-5.5l1.5-3c1-1.8 2.5-2.8 4.5-3.5h6c2 0 3.5 1 4.5 2.8l1.5 3c.8 2 .5 4.2-.5 5.5l-2.5 2c-1.2.8-3 1.2-5.5 1.2s-4-.4-5.5-1.2z" fill="#F2A5B3" />
      <path d="M9 20c-.6-1.2-.5-2.8.2-4.5l1-2c.7-1.2 1.8-2 3-2.5h5c1.6 0 2.6.7 3.3 2l1 2.5c.5 1.5.2 3.2-.5 4l-2 1.2c-1 .6-2.4 1-4.5 1s-3.2-.4-4.2-.8z" fill="#F7BAC5" />
      <ellipse cx="14" cy="15" rx="3" ry="2" fill="#FCD0D8" opacity="0.6" />
    </svg>
  ),
  carb: (
    <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
      <path d="M6 26V12c0-2 1-4 3-5.5C11 5 13 4 16 4s5 1 7 2.5c2 1.5 3 3.5 3 5.5v14a1 1 0 01-1 1H7a1 1 0 01-1-1z" fill="#EAC87A" />
      <path d="M8 25V13c0-1.6.8-3 2.2-4C12 8 13.8 7 16 7s4 1 5.8 2c1.4 1 2.2 2.4 2.2 4v12z" fill="#F0D898" />
      <path d="M10 24V14c0-1.3.6-2.4 1.8-3.2C13 10 14.4 9.2 16 9.2s3 .8 4.2 1.6c1.2.8 1.8 1.9 1.8 3.2v10" fill="#F8E8B8" opacity="0.5" />
    </svg>
  ),
  vitamin: (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
      <ellipse cx="16" cy="16" rx="13" ry="10.5" transform="rotate(-35 16 16)" fill="#F5D86A" />
      <ellipse cx="15" cy="14.5" rx="11" ry="8.5" transform="rotate(-35 15 14.5)" fill="#FAE48A" />
      <ellipse cx="13" cy="12.5" rx="4" ry="2.5" transform="rotate(-35 13 12.5)" fill="#FFF0A8" opacity="0.7" />
    </svg>
  ),
  mineral: (
    <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
      <path d="M16 5L27 11 16 17 5 11z" fill="#C0DEFF" />
      <path d="M5 11L16 17v12L5 23z" fill="#A8D0FA" />
      <path d="M27 11L16 17v12l11-6z" fill="#90C2F5" />
      <path d="M16 6.5L25 11.5 16 16 7 11.5z" fill="#D8ECFF" opacity="0.5" />
    </svg>
  ),
  kcal: (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
      <path d="M18 3L9 17h6.5L13 29l10.5-16H17z" fill="#F5A898" />
      <path d="M18 3L9 17h6.5L13 29 15.5 17H11z" fill="#FAB8AC" />
      <path d="M17 6l-4 8h2.5z" fill="#FDD0C8" opacity="0.6" />
    </svg>
  ),
};

const NUTRIENT_META = [
  { key: 'kcal', icon: NutrientIcons.kcal, label: '칼로리', unit: '', goalKey: 'kcal', grad: ['#FFF0EC', '#FFCEC0'] },
  { key: 'protein', icon: NutrientIcons.protein, label: '단백질', unit: 'g', goalKey: 'protein', grad: ['#FDE8EC', '#F9CDD5'] },
  { key: 'carb', icon: NutrientIcons.carb, label: '탄수화물', unit: 'g', goalKey: 'carb', grad: ['#FFF6E0', '#FAEAC0'] },
  { key: 'fat', label: '지방', unit: 'g', goalKey: 'fat', grad: ['#FFFBE0', '#FBF0A0'] },
  { key: 'fiber', label: '식이섬유', unit: 'g', goalKey: 'fiber', grad: ['#E8F8E8', '#C8ECC8'] },
  { key: 'iron', label: '철분', unit: 'mg', goalKey: 'iron', grad: ['#FFF0E8', '#FFE0D0'] },
  { key: 'calcium', label: '칼슘', unit: 'mg', goalKey: 'calcium', grad: ['#F0F0FF', '#E0E0F8'] },
  { key: 'sugar', label: '당류', unit: 'g', goalKey: 'sugar', grad: ['#FFF0E8', '#FFE0D0'] },
];

function getStatus(value, goal) {
  if (!goal || !value) return '-';
  const ratio = value / goal;
  if (ratio < 0.7) return '부족';
  if (ratio > 1.2) return '과잉';
  return '적정';
}

const STATUS_COLOR = { '적정': '#1D9E75', '부족': '#E5C100', '과잉': '#5F5E5A', '-': '#fff' };
function StatusIcon({ status }) {
  const c = STATUS_COLOR[status] || '#fff';
  const s = 14;
  if (status === '적정') return <svg width={s} height={s} viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" fill="none" stroke={c} strokeWidth="1.8"/></svg>;
  if (status === '부족') return <svg width={s} height={s} viewBox="0 0 14 14"><path d="M7 2.5 L12.5 11.5 Q12.5 12.5 11.5 12.5 L2.5 12.5 Q1.5 12.5 1.5 11.5 Z" fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round"/></svg>;
  if (status === '과잉') return <svg width={s} height={s} viewBox="0 0 14 14"><path d="M7 2 L7 9 M7 2 L4 5.5 M7 2 L10 5.5" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  return <span style={{ fontSize: 13, fontWeight: 600, color: c }}>-</span>;
}

function getScoreComment(score) {
  if (score >= 90) return '완벽한 하루예요! 🌟';
  if (score >= 75) return '좋은 식습관이에요!';
  if (score >= 60) return '조금만 더 신경써봐요';
  return '식단 개선이 필요해요';
}

function calcFoodScore(nutrition, goal) {
  if (!nutrition.kcal && !nutrition.protein && !nutrition.carb) return 0;
  let score = 50;
  const kcalR = goal.kcal ? nutrition.kcal / goal.kcal : 0;
  if (kcalR >= 0.7 && kcalR <= 1.1) score += 20;
  else if (kcalR > 0 && kcalR < 0.7) score += 5;
  const protR = goal.protein ? nutrition.protein / goal.protein : 0;
  if (protR >= 0.8) score += 15;
  else if (protR >= 0.5) score += 8;
  const carbR = goal.carb ? nutrition.carb / goal.carb : 0;
  if (carbR >= 0.6 && carbR <= 1.2) score += 10;
  const fatR = goal.fat ? nutrition.fat / goal.fat : 0;
  if (fatR >= 0.5 && fatR <= 1.1) score += 5;
  return Math.min(100, Math.max(0, Math.round(score)));
}

function getDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function RecordPage({ onTabChange, autoOpenAdd, onMeasure }) {
  const [enabledCats, setEnabledCats] = useState(() => getEnabledCategories('cause'));
  const [foodTab, setFoodTab] = useState('all');
  useEffect(() => {
    const handler = () => {
      const cats = getEnabledCategories('cause');
      setEnabledCats(cats);
      if (foodTab !== 'all' && !cats.find(c => c.key === foodTab)) setFoodTab('all');
    };
    window.addEventListener('lua:categories-changed', handler);
    return () => window.removeEventListener('lua:categories-changed', handler);
  }, [foodTab]);
  const today = new Date();
  const todayStr = getDateKey(today);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const isToday = selectedDate === todayStr;
  const [foods, setFoods] = useState(() => getFoodRecords(selectedDate));
  const [nutrition, setNutrition] = useState(() => getNutritionForDate(selectedDate));
  const goal = isToday ? getTimeAdjustedGoal() : { ...getFoodGoal(selectedDate), _ratio: 1, _mealLabel: '하루' };
  const [showAdd, setShowAdd] = useState(false);
  const [addMeal, setAddMeal] = useState(null);
  const [detailFood, setDetailFood] = useState(null);
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [showBodyAdd, setShowBodyAdd] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [nutrientOpen, setNutrientOpen] = useState(false);
  const [bodyWeight, setBodyWeight] = useState('');

  // Exercise / Sleep / Water state (shared with RecordPageV2 via localStorage)
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [exerciseLog, setExerciseLog] = useState({}); // { name: minutes }
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState(null);
  const [sleepBedtime, setSleepBedtime] = useState(null);
  const [sleepWakeTime, setSleepWakeTime] = useState(null);
  const [sleepMode, setSleepMode] = useState('simple'); // 'simple' | 'time'
  const [stepsGuideOpen, setStepsGuideOpen] = useState(false);
  const [waterCount, setWaterCount] = useState(0);
  const [waterSettings, setWaterSettings] = useState(getWaterSettings);
  const [showRecordSettings, setShowRecordSettings] = useState(false);
  const [exercises, setExercises] = useState(getExercises);
  const [selectedExIds, setSelectedExIds] = useState(getSelectedExerciseIds);
  const cupMl = waterSettings.cupMl;
  const goalMl = waterSettings.goalMl;
  const TOTAL_CUPS = Math.ceil(goalMl / cupMl);
  const [stepCount, setStepCount] = useState(0);
  const [meditationMin, setMeditationMin] = useState(0);
  const [exCalOverrides, setExCalOverrides] = useState({}); // { exerciseName: manualCal }
  const [stepCalOverride, setStepCalOverride] = useState(null);

  const loadV2Data = useCallback((dateKey) => {
    const saved = loadDayRecord(dateKey);
    if (saved) {
      setSelectedExercise(saved.exercise?.type || null);
      setExerciseLog(saved.exercise?.log || {});
      setSleepHours(saved.sleep?.hours ?? 7);
      setSleepQuality(saved.sleep?.quality || null);
      setSleepBedtime(saved.sleep?.bedtime || null);
      setSleepWakeTime(saved.sleep?.wakeTime || null);
      setWaterCount(saved.water?.cups ?? 0);
      setStepCount(saved.steps ?? 0);
      setMeditationMin(saved.meditation ?? 0);
    } else {
      setSelectedExercise(null); setExerciseLog({});
      setSleepHours(7); setSleepQuality(null);
      setSleepBedtime(null); setSleepWakeTime(null);
      setWaterCount(0); setStepCount(0); setMeditationMin(0);
    }
  }, []);

  useEffect(() => { loadV2Data(selectedDate); }, [selectedDate, loadV2Data]);

  // Calculate hours from bedtime/wakeTime
  const calcSleepFromTime = useCallback((bed, wake) => {
    if (!bed || !wake) return;
    const [bh, bm] = bed.split(':').map(Number);
    const [wh, wm] = wake.split(':').map(Number);
    let bedMin = bh * 60 + bm;
    let wakeMin = wh * 60 + wm;
    if (wakeMin <= bedMin) wakeMin += 24 * 60; // crossed midnight
    const diff = (wakeMin - bedMin) / 60;
    setSleepHours(Math.round(diff * 2) / 2); // round to 0.5
  }, []);

  const saveV2 = useCallback(() => {
    saveDayRecord(selectedDate, {
      date: selectedDate,
      exercise: selectedExercise || Object.keys(exerciseLog).length > 0 ? { type: selectedExercise, log: exerciseLog } : null,
      sleep: { hours: sleepHours, quality: sleepQuality, bedtime: sleepBedtime, wakeTime: sleepWakeTime },
      water: { cups: waterCount },
      steps: stepCount,
      meditation: meditationMin,
    });
  }, [selectedDate, selectedExercise, exerciseLog, sleepHours, sleepQuality, sleepBedtime, sleepWakeTime, waterCount, stepCount, meditationMin]);

  // Auto-save when exercise/sleep/water/steps/meditation changes
  useEffect(() => { saveV2(); }, [selectedExercise, exerciseLog, sleepHours, sleepQuality, sleepBedtime, sleepWakeTime, waterCount, stepCount, meditationMin]);

  useEffect(() => {
    if (autoOpenAdd) {
      setFoodTab('food');
      setAddMeal(null); setShowAdd(true);
    }
  }, [autoOpenAdd]);

  const refresh = useCallback(() => {
    setFoods(getFoodRecords(selectedDate));
    setNutrition(getNutritionForDate(selectedDate));
  }, [selectedDate]);

  const handleSelectDate = useCallback((dateKey) => {
    setSelectedDate(dateKey);
    setFoods(getFoodRecords(dateKey));
    setNutrition(getNutritionForDate(dateKey));
  }, []);

  const handleAddFood = useCallback((food) => {
    saveFoodRecord(selectedDate, food);
    refresh();
    setShowAdd(false);
    setAddMeal(null);
  }, [selectedDate, refresh]);

  const handleDeleteFood = useCallback((food) => {
    deleteFoodRecord(selectedDate, food.id);
    refresh();
  }, [selectedDate, refresh]);

  const score = calcFoodScore(nutrition, goal);

  // Group foods by meal
  const mealFoods = {};
  MEAL_LABELS.forEach(m => { mealFoods[m] = foods.filter(f => f.meal === m && !f.name?.startsWith('물 ')); });

  // Which meals are not recorded yet
  const unrecordedMeals = MEAL_LABELS.filter(m => mealFoods[m].length === 0);

  // Nutrients for card
  const nutrients = NUTRIENT_META.map(n => {
    let value, displayVal;
    if (n.key === 'kcal') { value = nutrition.kcal; displayVal = nutrition.kcal.toLocaleString(); }
    else { value = nutrition[n.key] || 0; displayVal = `${value}${n.unit}`; }
    const goalVal = n.goalKey ? goal[n.goalKey] : 0;
    return { ...n, value, displayVal, status: getStatus(value, goalVal) };
  });

  const lacking = nutrients.filter(n => n.status === '부족').map(n => n.label);

  // Score ring
  const r = 24, circ = 2 * Math.PI * r;
  const dashFill = circ * (score / 100);
  const [showCal, setShowCal] = useState(false);
  const [recordViewMode, setRecordViewMode] = useState('기록');
  const [flowPeriod, setFlowPeriod] = useState('1주');
  // Supplement & Skincare state
  const [suppItems, setSuppItems] = useState(() => getSupplementItems());
  const [suppChecks, setSuppChecks] = useState(() => getSupplementChecks());
  const [suppAddTiming, setSuppAddTiming] = useState(null); // null | 'morning' | 'lunch' | 'evening'
  const [suppAddName, setSuppAddName] = useState('');
  const [skincareProducts, setSkincareProducts] = useState(() => getProducts());
  const [skincareChecks, setSkincareChecks] = useState(() => getTrackerChecks());
  const [skincareMode, setSkincareMode] = useState('morning'); // 'morning' | 'night'
  const [showSkincareAdd, setShowSkincareAdd] = useState(false);
  const [scAddStep, setScAddStep] = useState('');
  const [scAddName, setScAddName] = useState('');
  const [scAddBrand, setScAddBrand] = useState('');
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

  const DAY_NAMES_R = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
  const dateLabelFull = (() => {
    const d = new Date(selectedDate + 'T00:00:00');
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const yestStr = `${yest.getFullYear()}-${String(yest.getMonth()+1).padStart(2,'0')}-${String(yest.getDate()).padStart(2,'0')}`;
    const prefix = selectedDate === todayStr ? '오늘' : selectedDate === yestStr ? '어제' : `${d.getMonth()+1}월 ${d.getDate()}일`;
    return `${prefix} / ${d.getMonth()+1}월 ${d.getDate()}일 ${DAY_NAMES_R[d.getDay()]}`;
  })();
  const goPrevDate = () => {
    const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() - 1);
    const s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    handleSelectDate(s);
  };
  const goNextDate = () => {
    if (isToday) return;
    const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() + 1);
    const s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (s <= todayStr) handleSelectDate(s);
  };

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ padding: '16px 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--text-primary)', fontFamily: 'Pretendard, sans-serif' }}>오늘</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <div onClick={() => { setAddMeal(null); setShowAdd(true); }} style={{ width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div onClick={() => setShowRecordSettings(true)} style={{ width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </div>
        </div>
      </div>
      <div style={{ padding: '10px 18px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div onClick={goPrevDate} style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(255,255,255,.5)', border: '0.5px solid rgba(100,180,220,.2)' }}>
          <span style={{ fontSize: 13, color: '#3A8AAA', fontWeight: 600 }}>‹</span>
        </div>
        <div onClick={() => setShowCal(!showCal)} style={{
          flex: 1, background: 'rgba(255,255,255,.5)', border: '0.5px solid rgba(100,180,220,.2)',
          borderRadius: 99, padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer',
        }}>
          <span style={{ fontSize: 11, color: '#2A6A8A', fontWeight: 500 }}>{dateLabelFull}</span>
        </div>
        <div onClick={goNextDate} style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isToday ? 'default' : 'pointer', background: 'rgba(255,255,255,.5)', border: '0.5px solid rgba(100,180,220,.2)', opacity: isToday ? 0.3 : 1 }}>
          <span style={{ fontSize: 13, color: '#3A8AAA', fontWeight: 600 }}>›</span>
        </div>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,.5)', borderRadius: 99, border: '0.5px solid rgba(100,180,220,.2)', overflow: 'hidden', flexShrink: 0 }}>
          {['기록', '흐름'].map(m => (
            <div key={m} onClick={() => setRecordViewMode(m)} style={{
              padding: '6px 10px', fontSize: 10, fontWeight: recordViewMode === m ? 600 : 400, cursor: 'pointer',
              background: recordViewMode === m ? 'rgba(100,180,220,.15)' : 'transparent',
              color: recordViewMode === m ? '#2A6A8A' : '#7AAABB',
            }}>{m}</div>
          ))}
        </div>
      </div>

      {/* Inline Calendar */}
      {showCal && (() => {
        const firstDay = new Date(calYear, calMonth, 1).getDay();
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const todayObj = new Date();
        const todayDateStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
        const cells = [];
        for (let i = 0; i < firstDay; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        return (
          <div style={{
            background: 'rgba(255,255,255,.95)', borderRadius: 16, margin: '0 14px 8px',
            padding: '12px 14px', border: '0.5px solid rgba(100,180,220,.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div onClick={() => { if (calMonth === 0) { setCalYear(calYear - 1); setCalMonth(11); } else setCalMonth(calMonth - 1); }}
                style={{ cursor: 'pointer', padding: '2px 8px', fontSize: 14, color: '#5A9AAA' }}>‹</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#2A6A8A' }}>{calYear}년 {calMonth + 1}월</span>
              <div onClick={() => { if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0); } else setCalMonth(calMonth + 1); }}
                style={{ cursor: 'pointer', padding: '2px 8px', fontSize: 14, color: '#5A9AAA' }}>›</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: 4 }}>
              {['일','월','화','수','목','금','토'].map(d => (
                <div key={d} style={{ fontSize: 9, color: '#9ABBC8', padding: '2px 0' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', gap: '2px 0' }}>
              {cells.map((day, i) => {
                if (!day) return <div key={`e${i}`} />;
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isFuture = dateStr > todayDateStr;
                const isSelected = dateStr === selectedDate;
                const isTodayDate = dateStr === todayDateStr;
                return (
                  <div key={day} onClick={() => { if (isFuture) return; handleSelectDate(dateStr); setShowCal(false); }}
                    style={{
                      width: 22, height: 22, borderRadius: '50%', margin: '0 auto',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, cursor: isFuture ? 'default' : 'pointer',
                      background: isTodayDate ? '#3A8AAA' : isSelected ? 'rgba(100,180,220,.2)' : 'transparent',
                      color: isFuture ? 'rgba(90,150,170,.3)' : isTodayDate ? '#fff' : isSelected ? '#2A6A8A' : '#5A9AAA',
                      fontWeight: isSelected ? 500 : 400,
                    }}>{day}</div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ===== 흐름 모드 ===== */}
      {recordViewMode === '흐름' && (() => {
        const DAY_NAMES = ['일','월','화','수','목','금','토'];
        const periodDays = flowPeriod === '1주' ? 7 : flowPeriod === '1개월' ? 30 : flowPeriod === '3개월' ? 90 : 365;
        const last7 = [];
        for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); last7.push(getDateKey(d)); }
        const dayLabels = last7.map((dk, i) => {
          if (i === 6) return '오늘';
          return DAY_NAMES[new Date(dk + 'T00:00:00').getDay()];
        });

        const allV2 = (() => { try { return JSON.parse(localStorage.getItem(RECORD_V2_KEY) || '{}'); } catch { return {}; } })();
        const weeklyNutrition = last7.map(dk => getNutritionForDate(dk));
        const weeklyWater = last7.map(dk => allV2[dk]?.water?.cups ?? null);
        const weeklySteps = last7.map(dk => allV2[dk]?.steps ?? null);
        const weeklySleep = last7.map(dk => allV2[dk]?.sleep?.hours ?? null);

        const avg = (arr) => { const v = arr.filter(x => x != null && x > 0); return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
        const avgKcal = Math.round(avg(weeklyNutrition.map(n => n.kcal || null)));
        const avgWater = avg(weeklyWater).toFixed(1);
        const avgSteps = Math.round(avg(weeklySteps));
        const avgSleep = avg(weeklySleep).toFixed(1);

        const fullGoal = getFoodGoal();
        const stepGoal = 10000;

        const weekExercises = [];
        last7.forEach((dk, i) => {
          const rec = allV2[dk];
          if (rec?.exercise?.log) {
            Object.entries(rec.exercise.log).forEach(([name, mins]) => {
              const ex = ALL_EXERCISES.find(e => e.name === name);
              const cal = ex ? calcExMET(ex.met, 60, mins) : Math.round(mins * 5);
              weekExercises.push({ name, mins, cal, icon: ex?.icon || '🏋️', day: dayLabels[i] });
            });
          }
        });

        const weekFoods = [];
        last7.forEach(dk => {
          getFoodRecords(dk).forEach(f => { if (f.photo && !f.name?.startsWith('물 ')) weekFoods.push({ ...f, date: dk }); });
        });

        const suppItems = [...getRoutineItems('food'), ...getRoutineItems('skin'), ...getRoutineItems('body'), ...getRoutineItems('mood')];
        const totalSupp = suppItems.length;

        const flowCardStyle = { background: 'rgba(255,255,255,.72)', borderRadius: 16, padding: '14px 15px', border: '0.5px solid rgba(255,255,255,.95)', marginBottom: 10 };
        const flowCardHeader = (color, title, status) => (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: color }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>{title}</span>
            </div>
            {status && <span style={{ fontSize: 11, color: '#5AAABB', fontWeight: 500 }}>{status}</span>}
          </div>
        );

        const BarChart = ({ data, color, labels, todayVal, todayLabel, goalVal, goalLabel, nullLabel = '미기록' }) => {
          const max = Math.max(...data.map(v => v ?? 0), goalVal || 0, 1);
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 90, marginBottom: 6 }}>
                {data.map((val, i) => {
                  const isToday = i === data.length - 1;
                  const h = val != null && val > 0 ? Math.max(8, (val / max) * 80) : 0;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                      {val != null && val > 0 ? (
                        <div style={{ width: '100%', maxWidth: 40, height: h, borderRadius: 6, background: isToday ? color : `${color}88`, transition: 'height 0.3s' }} />
                      ) : (
                        <div style={{ width: '100%', maxWidth: 40, height: 8, borderRadius: 6, background: 'rgba(200,210,200,.3)' }} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {labels.map((l, i) => (<div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#7AAABB' }}>{l}</div>))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {goalVal != null && <span style={{ fontSize: 11, color: '#9ABBC8' }}>{goalLabel}</span>}
                <span style={{ fontSize: 13, fontWeight: 600, color: todayVal != null && todayVal > 0 ? '#1A3A4A' : '#9ABBC8', marginLeft: 'auto' }}>
                  {todayVal != null && todayVal > 0 ? todayLabel : nullLabel}
                </span>
              </div>
            </div>
          );
        };

        const LineChart = ({ data, labels, goalVal, color }) => {
          const validData = data.filter(v => v != null && v > 0);
          const minV = validData.length > 0 ? Math.min(...validData) * 0.8 : 0;
          const maxV = Math.max(...(validData.length > 0 ? validData : [8]), goalVal || 8) * 1.1;
          const range = maxV - minV || 1;
          const chartH = 90;
          const pad = 6; // padding for dots
          const points = data.map((v, i) => {
            if (v == null || v <= 0) return null;
            const xPct = data.length > 1 ? (i / (data.length - 1)) * 100 : 50;
            const yPx = pad + (1 - (v - minV) / range) * (chartH - pad * 2);
            return { xPct, yPx, val: v, idx: i };
          });
          const validPoints = points.filter(Boolean);
          const goalYPx = goalVal ? pad + (1 - (goalVal - minV) / range) * (chartH - pad * 2) : null;
          // Build SVG path using percentage x converted at render
          return (
            <div style={{ position: 'relative', marginBottom: 6 }}>
              <div style={{ position: 'relative', height: chartH }}>
                {/* Goal line */}
                {goalYPx != null && (
                  <>
                    <div style={{ position: 'absolute', top: goalYPx, left: 0, right: 0, borderTop: '1.5px dashed rgba(150,180,170,.4)' }} />
                    <span style={{ position: 'absolute', top: goalYPx - 16, right: 0, fontSize: 10, color: '#9ABBC8' }}>{goalVal}h</span>
                  </>
                )}
                {/* Line segments using CSS */}
                {validPoints.map((p, i) => {
                  if (i === 0) return null;
                  const prev = validPoints[i - 1];
                  return (
                    <svg key={`line-${i}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                      <line
                        x1={`${prev.xPct}%`} y1={prev.yPx}
                        x2={`${p.xPct}%`} y2={p.yPx}
                        stroke={color} strokeWidth="2" strokeLinecap="round"
                      />
                    </svg>
                  );
                })}
                {/* Dots */}
                {validPoints.map((p, i) => {
                  const isLast = i === validPoints.length - 1;
                  const r = isLast ? 5 : 3.5;
                  return (
                    <div key={`dot-${i}`} style={{
                      position: 'absolute', left: `${p.xPct}%`, top: p.yPx,
                      width: r * 2, height: r * 2, borderRadius: '50%',
                      background: isLast ? color : '#fff',
                      border: `2px solid ${color}`,
                      transform: 'translate(-50%, -50%)',
                      zIndex: 2,
                    }} />
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                {labels.map((l, i) => (<div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#7AAABB' }}>{l}</div>))}
              </div>
            </div>
          );
        };

        const todayNut = weeklyNutrition[6];
        const todayWater = weeklyWater[6];
        const todaySteps = weeklySteps[6];

        const showFood = foodTab === 'all' || foodTab === 'food';
        const showActivity = foodTab === 'all' || foodTab === 'activity';
        const showSupplement = foodTab === 'all' || foodTab === 'supplement';
        const showSleep = foodTab === 'all' || foodTab === 'sleep';

        const allTabs = [{ key: 'all', label: '전체' }, ...enabledCats];
        const idx = allTabs.findIndex(t => t.key === foodTab);
        const pos = idx === 0 ? 'first' : idx === allTabs.length - 1 ? 'last' : 'mid';

        return (
          <>
            {/* Category Tabs */}
            <div style={{ padding: '12px 10px 0' }}>
              <div className="segment-control" data-active={pos}>
                {allTabs.map(cat => (
                  <button key={cat.key} className={`segment-btn${foodTab === cat.key ? ' active' : ''}`}
                    onClick={() => setFoodTab(cat.key)}>
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

            <div className="tab-content-panel" data-active={pos}>
            <div style={{ padding: '0 14px' }}>
              {/* Period filter */}
              <div style={{ display: 'flex', gap: 8, padding: '12px 0 8px', ...fadeUp(0.02) }}>
                {['1주', '1개월', '3개월', '전체'].map(p => (
                  <div key={p} onClick={() => setFlowPeriod(p)} style={{
                    padding: '6px 14px', borderRadius: 99, cursor: 'pointer', fontSize: 12, fontWeight: flowPeriod === p ? 600 : 400,
                    background: flowPeriod === p ? '#fff' : 'transparent',
                    color: flowPeriod === p ? '#1A3A4A' : '#9ABBC8',
                    border: flowPeriod === p ? '1px solid rgba(200,220,230,.5)' : '1px solid transparent',
                  }}>
                    {p}
                  </div>
                ))}
              </div>

              {/* 식사 칼로리 */}
              {showFood && <div style={{ ...flowCardStyle, ...fadeUp(0.05) }}>
                {flowCardHeader(getCategoryColor('food'), '식사 칼로리', `평균 ${avgKcal.toLocaleString()} kcal`)}
                <BarChart data={weeklyNutrition.map(n => n.kcal || null)} color={getCategoryColor('food')} labels={dayLabels}
                  goalVal={fullGoal.kcal} goalLabel={`목표 ${fullGoal.kcal?.toLocaleString()} kcal`}
                  todayVal={todayNut.kcal} todayLabel={`오늘 ${Math.round(todayNut.kcal).toLocaleString()} kcal`} nullLabel="오늘 미기록" />
              </div>}

              {/* 수분 */}
              {showFood && <div style={{ ...flowCardStyle, ...fadeUp(0.08) }}>
                {flowCardHeader(getCategoryColor('food'), '수분', `평균 ${avgWater}잔`)}
                <BarChart data={weeklyWater} color="#8BB8D0" labels={dayLabels}
                  goalVal={TOTAL_CUPS} goalLabel={`목표 ${TOTAL_CUPS}잔`}
                  todayVal={todayWater} todayLabel={`오늘 ${todayWater || 0}잔`} nullLabel="오늘 0잔" />
              </div>}

              {/* 걸음수 */}
              {showActivity && <div style={{ ...flowCardStyle, ...fadeUp(0.11) }}>
                {flowCardHeader(getCategoryColor('activity'), '걸음수', `평균 ${avgSteps.toLocaleString()}보`)}
                <BarChart data={weeklySteps} color={getCategoryColor('activity')} labels={dayLabels}
                  goalVal={stepGoal} goalLabel={`목표 ${stepGoal.toLocaleString()}보`}
                  todayVal={todaySteps} todayLabel={`오늘 ${(todaySteps || 0).toLocaleString()}보`} nullLabel="오늘 미기록" />
              </div>}

              {/* 운동 */}
              {showActivity && <div style={{ ...flowCardStyle, ...fadeUp(0.14) }}>
                {flowCardHeader(getCategoryColor('activity'), '운동', `이번주 ${weekExercises.length}회`)}
                {weekExercises.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {weekExercises.map((ex, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{ex.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#1A3A4A', flex: 1 }}>{ex.name} {ex.mins}분</span>
                        <span style={{ fontSize: 12, color: '#7AAABB', marginRight: 4 }}>{ex.day}</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#4A9A7A', background: 'rgba(100,180,130,.1)', padding: '3px 10px', borderRadius: 99 }}>-{ex.cal} kcal</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: '#9ABBC8' }}>이번주 운동 기록이 없어요</div>
                )}
              </div>}

              {/* 수면 */}
              {showSleep && <div style={{ ...flowCardStyle, ...fadeUp(0.17) }}>
                {flowCardHeader(getCategoryColor('sleep'), '수면', `평균 ${avgSleep}시간`)}
                <LineChart data={weeklySleep} labels={dayLabels} goalVal={8} color={getCategoryColor('sleep')} />
              </div>}

              {/* 식단 앨범 */}
              {showFood && <div style={{ ...flowCardStyle, ...fadeUp(0.2) }}>
                {flowCardHeader(getCategoryColor('food'), '식단 앨범', weekFoods.length > 0 ? '전체보기' : null)}
                {weekFoods.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {weekFoods.slice(0, 7).map((f, i) => (
                      <div key={i} style={{ aspectRatio: '1', borderRadius: 12, overflow: 'hidden', background: 'rgba(230,240,235,.4)' }}>
                        <FoodPhoto photo={f.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                    {weekFoods.length > 7 && (
                      <div style={{ aspectRatio: '1', borderRadius: 12, background: 'rgba(230,240,235,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#7AAABB', cursor: 'pointer' }}>+더보기</div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: '#9ABBC8' }}>이번주 식단 사진이 없어요</div>
                )}
              </div>}

              {/* 영양제 루틴 달성률 */}
              {showSupplement && totalSupp > 0 && (
                <div style={{ ...flowCardStyle, ...fadeUp(0.23) }}>
                  {flowCardHeader(getCategoryColor('supplement'), '영양제 루틴 달성률')}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {last7.map((dk, i) => {
                      let totalAll = 0, doneAll = 0;
                      for (const cat of ['food', 'skin', 'body', 'mood']) {
                        const items = getRoutineItems(cat);
                        const chk = getChecks(cat, dk);
                        totalAll += items.length;
                        doneAll += items.filter(it => chk[it.id]).length;
                      }
                      const pct = totalAll > 0 ? (doneAll / totalAll) * 100 : 0;
                      const isGood = totalAll > 0 && doneAll === totalAll;
                      return (
                        <div key={dk} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 12, color: '#7AAABB', width: 28, textAlign: 'center' }}>{dayLabels[i]}</span>
                          <div style={{ flex: 1, position: 'relative', height: 22, borderRadius: 6, background: 'rgba(200,220,230,.2)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 6, width: `${pct}%`, transition: 'width 0.3s',
                              background: isGood ? getCategoryColor('activity') : pct >= 50 ? getCategoryColor('activity') : '#E8B84A',
                            }} />
                            {totalAll > 0 && (
                              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 600, color: '#fff' }}>
                                {doneAll}/{totalAll}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ height: 20 }} />
            </div>
            </div>
          </>
        );
      })()}

      {/* Category Tabs */}
      {recordViewMode === '기록' && (() => {
        const allTabs = [{ key: 'all', label: '전체' }, ...enabledCats];
        const idx = allTabs.findIndex(t => t.key === foodTab);
        const pos = idx === 0 ? 'first' : idx === allTabs.length - 1 ? 'last' : 'mid';
        return (
          <div style={{ padding: '12px 10px 0' }}>
            <div className="segment-control" data-active={pos}>
              {allTabs.map(cat => (
                <button key={cat.key} className={`segment-btn${foodTab === cat.key ? ' active' : ''}`}
                  onClick={() => setFoodTab(cat.key)}>
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
      {recordViewMode === '기록' && <div className="tab-content-panel" data-active={
        (() => {
          const allTabs = [{ key: 'all', label: '전체' }, ...enabledCats];
          const idx = allTabs.findIndex(t => t.key === foodTab);
          return idx === 0 ? 'first' : idx === allTabs.length - 1 ? 'last' : 'mid';
        })()
      }>

      {/* ===== 전체 탭: 기록2 스타일 카드 ===== */}
      {foodTab === 'all' && (() => {
        const todayMeals = foods.filter(f => !f.name?.startsWith('물 '));
        const totalKcal = Math.round(nutrition.kcal || 0);
        const allCardStyle = { background: 'rgba(255,255,255,.72)', borderRadius: 16, padding: '14px 15px', border: '0.5px solid rgba(255,255,255,.95)', marginBottom: 10 };
        const allCardHeader = (color, title, _icon, status, statusColor = '#5AAABB') => (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: color }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>{title}</span>
            </div>
            <span style={{ fontSize: 11, color: statusColor, fontWeight: 500 }}>{status}</span>
          </div>
        );
        return (
          <div style={{ padding: '8px 14px 0' }}>
            {/* Summary Bar */}
            <div style={{
              background: 'transparent', borderRadius: 14, padding: '10px 13px',
              border: 'none', marginBottom: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              ...fadeUp(0.03),
            }}>
              {[
                { icon: '🍽', value: todayMeals.length > 0 ? `${todayMeals.length}끼` : '—', label: '식단' },
                { icon: '🏃', value: selectedExercise || '—', label: '운동' },
                { icon: '😴', value: `${sleepHours}h`, label: '수면' },
                { icon: '💧', value: waterCount > 0 ? `${waterCount}잔` : '—', label: '수분' },
              ].map((item, idx) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  {idx > 0 && <div style={{ width: 0.5, height: 28, background: 'rgba(100,180,220,.2)', marginRight: 0 }} />}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 50 }}>
                    <span style={{ fontSize: 14 }}>{item.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#1A3A4A', marginTop: 1 }}>{item.value}</span>
                    <span style={{ fontSize: 9, color: '#7AAABB' }}>{item.label}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Food + Water Card */}
            <div style={{ ...allCardStyle, padding: '18px 15px', ...fadeUp(0.1) }}>
              {allCardHeader(getCategoryColor('food'), '식사', null,
                todayMeals.length > 0 ? `${todayMeals.length}끼 기록됨` : '미기록',
                todayMeals.length > 0 ? '#5AAABB' : '#9ABBC8'
              )}
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                {todayMeals.slice(0, 5).map((food, i) => (
                  <div key={food.id || i} onClick={() => setDetailFood(food)} style={{
                    width: 52, height: 52, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
                    background: 'linear-gradient(135deg, #FFF3D0, #FFE8A0)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}>
                    {food.photo ? (
                      <FoodPhoto photo={food.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 20 }}>🍽</span>
                    )}
                  </div>
                ))}
                {(
                  <div onClick={() => { setAddMeal(null); setShowAdd(true); }} style={{
                    width: 52, height: 52, borderRadius: 10, flexShrink: 0,
                    border: '1.5px dashed rgba(100,180,220,.4)', background: 'rgba(100,180,220,.06)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', gap: 2,
                  }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(100,180,220,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 11, color: '#5A9AAA', lineHeight: 1 }}>+</span>
                    </div>
                    <span style={{ fontSize: 8, color: '#7AAABB' }}>추가</span>
                  </div>
                )}
              </div>
              {totalKcal > 0 && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#1A3A4A' }}>{totalKcal.toLocaleString()} kcal</span>
                  {(() => { const fullGoal = getFoodGoal(selectedDate); return fullGoal.kcal > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: totalKcal / fullGoal.kcal > 1 ? '#E05050' : '#5AAABB' }}>{Math.round((totalKcal / fullGoal.kcal) * 100)}%</span>; })()}
                  {nutrition.protein > 0 && (
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 99, background: 'rgba(100,180,220,.12)', color: '#4A8AAA' }}>단백질 {Math.round(nutrition.protein)}g</span>
                  )}
                  {nutrition.carb > 0 && (
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 99, background: 'rgba(255,190,70,.15)', color: '#B08000' }}>탄수화물 {Math.round(nutrition.carb)}g</span>
                  )}
                  {nutrition.fat > 0 && (
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 99, background: 'rgba(200,160,224,.12)', color: '#7A5A9A' }}>지방 {Math.round(nutrition.fat)}g</span>
                  )}
                </div>
              )}

              {/* 수분 섹션 */}
              <div style={{ marginTop: 22 }}>
                {allCardHeader(getCategoryColor('food'), '수분', null,
                  waterCount > 0 ? `${waterCount}잔(${waterCount * cupMl}ml)` : '미기록',
                  waterCount > 0 ? '#5AAABB' : '#9ABBC8'
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                    {Array.from({ length: TOTAL_CUPS }).map((_, i) => {
                      const filled = i < waterCount;
                      return (
                        <div key={i} onClick={() => setWaterCount(i + 1 === waterCount ? 0 : i + 1)}
                          style={{
                            width: 20, height: 26, borderRadius: 5, overflow: 'hidden',
                            border: `1px solid ${filled ? 'rgba(100,180,220,.4)' : 'rgba(100,180,220,.2)'}`,
                            background: filled ? 'transparent' : 'rgba(100,180,220,.08)',
                            cursor: 'pointer', position: 'relative', transition: 'all 0.15s ease',
                          }}>
                          {filled && (
                            <div style={{
                              position: 'absolute', bottom: 0, left: 0, right: 0,
                              background: 'linear-gradient(180deg, #90CCEE, #60AADD)', borderRadius: 4,
                              animation: 'waterFill 0.3s ease-out forwards',
                            }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#5AAABB', minWidth: 32, textAlign: 'right' }}>{waterCount}잔</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 9, color: '#9ABBC8' }}>1잔 = {cupMl}ml</span>
                  <span style={{ fontSize: 9, color: '#9ABBC8' }}>목표 {goalMl.toLocaleString()}ml</span>
                </div>
              </div>
            </div>

            {/* 활동 + 운동 Card */}
            <div style={{ ...allCardStyle, padding: '18px 15px', ...fadeUp(0.25) }}>
              {allCardHeader(getCategoryColor('activity'), '걸음수', null,
                stepCount > 0 ? `${stepCount.toLocaleString()}걸음` : '미기록',
                stepCount > 0 ? '#5AAABB' : '#9ABBC8'
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                    <span style={{ fontSize: 28, fontWeight: 600, color: '#1A3A4A', fontFamily: 'var(--font-display)' }}>
                      {stepCount > 0 ? stepCount.toLocaleString() : '—'}
                    </span>
                    <span style={{ fontSize: 11, color: '#7AAABB' }}>걸음</span>
                  </div>
                  {/* Step progress bar */}
                  <div style={{ height: 6, borderRadius: 3, background: 'rgba(168,216,168,0.2)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      background: 'linear-gradient(90deg, #A8D8A8, #78C878)',
                      width: `${Math.min(100, (stepCount / 10000) * 100)}%`,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 9, color: '#9ABBC8' }}>0</span>
                    <span style={{ fontSize: 9, color: '#9ABBC8' }}>목표 10,000</span>
                  </div>
                </div>
              </div>
              {(
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  {[1000, 3000, 5000, 8000, 10000].map(v => {
                    const active = stepCount === v;
                    return (
                      <button key={v} onClick={() => setStepCount(active ? 0 : v)}
                        style={{
                          flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 9, fontWeight: active ? 600 : 400,
                          border: `1px solid ${active ? 'rgba(168,216,168,.5)' : 'rgba(100,180,220,.15)'}`,
                          background: active ? 'rgba(168,216,168,.15)' : 'rgba(255,255,255,.5)',
                          color: active ? '#4A8A5A' : '#7AAABB',
                          cursor: 'pointer', transition: 'all 0.15s ease', fontFamily: 'inherit',
                        }}>{v >= 10000 ? '1만' : `${v / 1000}천`}</button>
                    );
                  })}
                </div>
              )}

              {/* 운동 섹션 */}
              <div style={{ marginTop: 22 }}>
                {(() => {
                  const logEntries = Object.entries(exerciseLog).filter(([, m]) => m > 0);
                  const totalMin = logEntries.reduce((s, [, m]) => s + m, 0);
                  const statusText = logEntries.length > 0
                    ? logEntries.map(([name, mins]) => `${name} ${mins}분`).join(' · ')
                    : '오늘 미기록';
                  return allCardHeader(getCategoryColor('activity'), '운동', null,
                    totalMin > 0 ? statusText : '오늘 미기록',
                    totalMin > 0 ? '#5AAABB' : '#9ABBC8'
                  );
                })()}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                  {exercises.map(ex => {
                    const hasLog = exerciseLog[ex.name] > 0;
                    const active = hasLog || selectedExercise === ex.name;
                    return (
                      <div key={ex.id} onClick={() => {
                        if (hasLog) {
                          const next = { ...exerciseLog };
                          delete next[ex.name];
                          setExerciseLog(next);
                          if (selectedExercise === ex.name) setSelectedExercise(null);
                        } else {
                          setExerciseLog({ ...exerciseLog, [ex.name]: 30 });
                          setSelectedExercise(ex.name);
                        }
                      }}
                        style={{
                          padding: '10px 4px', borderRadius: 10, textAlign: 'center',
                          border: `1px solid ${active ? 'rgba(100,180,220,.6)' : 'rgba(100,180,220,.15)'}`,
                          background: active ? 'rgba(100,180,220,.12)' : 'rgba(255,255,255,.5)',
                          cursor: 'pointer', transition: 'all 0.15s ease',
                        }}>
                        <div style={{ fontSize: 18, marginBottom: 2 }}>{ex.icon}</div>
                        <div style={{ fontSize: 10, fontWeight: active ? 600 : 400, color: active ? '#3A8AAA' : '#7AAABB' }}>{ex.name}</div>
                        {hasLog && <div style={{ fontSize: 9, color: '#5AAABB', marginTop: 2 }}>{exerciseLog[ex.name]}분</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 휴식 Card (수면 + 명상) */}
            <div style={{ ...allCardStyle, padding: '18px 15px', ...fadeUp(0.3) }}>
              {allCardHeader(getCategoryColor('sleep'), '수면', null,
                sleepQuality ? `${sleepHours}시간 · ${sleepQuality}` : `${sleepHours}시간`, '#5AAABB'
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 24, fontWeight: 500, color: '#1A3A4A' }}>{sleepHours}</span>
                  <span style={{ fontSize: 11, color: '#7AAABB', marginLeft: 3 }}>시간</span>
                </div>
                <div style={{ flex: 1 }}>
                  <input type="range" min="2" max="12" step="0.5" value={sleepHours}
                    onChange={e => setSleepHours(parseFloat(e.target.value))}
                    disabled={false}
                    style={{
                      width: '100%', height: 4, appearance: 'none', WebkitAppearance: 'none',
                      background: `linear-gradient(90deg, #C8A0E0 ${((sleepHours - 2) / 10) * 100}%, rgba(200,160,224,.2) ${((sleepHours - 2) / 10) * 100}%)`,
                      borderRadius: 2, outline: 'none',
                    }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {SLEEP_QUALITIES.map(q => {
                  const active = sleepQuality === q;
                  return (
                    <button key={q} onClick={() => setSleepQuality(active ? null : q)}
                      style={{
                        flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 10, fontWeight: active ? 600 : 400,
                        border: `1px solid ${active ? 'rgba(200,160,224,.4)' : 'rgba(100,180,220,.15)'}`,
                        background: active ? 'rgba(200,160,224,.15)' : 'rgba(255,255,255,.5)',
                        color: active ? '#9060B0' : '#7AAABB',
                        cursor: 'pointer', transition: 'all 0.15s ease',
                        fontFamily: 'inherit',
                      }}>{q}</button>
                  );
                })}
              </div>

              {/* 명상 섹션 */}
              <div style={{ marginTop: 22 }}>
                {allCardHeader(getCategoryColor('sleep'), '명상', null,
                  meditationMin > 0 ? `${meditationMin}분` : '미기록',
                  meditationMin > 0 ? '#5AAABB' : '#9ABBC8'
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  {[5, 10, 15, 20, 30].map(v => {
                    const active = meditationMin === v;
                    return (
                      <button key={v} onClick={() => setMeditationMin(active ? 0 : v)}
                        style={{
                          flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 10, fontWeight: active ? 600 : 400,
                          border: `1px solid ${active ? 'rgba(200,160,224,.4)' : 'rgba(100,180,220,.15)'}`,
                          background: active ? 'rgba(200,160,224,.15)' : 'rgba(255,255,255,.5)',
                          color: active ? '#9060B0' : '#7AAABB',
                          cursor: 'pointer', transition: 'all 0.15s ease',
                          fontFamily: 'inherit',
                        }}>{v}분</button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Save Button */}
            {(
              <button onClick={saveV2} style={{
                width: '100%', padding: 12, borderRadius: 14,
                background: 'rgba(255,255,255,.65)', border: '1px solid rgba(100,180,220,.25)',
                color: '#3A8AAA', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', marginBottom: 10,
                fontFamily: 'inherit',
                ...fadeUp(0.35),
              }}>
                오늘 기록 저장 →
              </button>
            )}
          </div>
        );
      })()}

      {/* Water content */}
      {/* Sleep content */}
      {foodTab === 'sleep' && (
        <div style={{ padding: '8px 14px 0' }}>
          <div style={{ background: 'rgba(255,255,255,.72)', borderRadius: 16, padding: '14px 15px', border: '0.5px solid rgba(255,255,255,.95)', ...fadeUp(0.05) }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 3, height: 14, borderRadius: 2, background: getCategoryColor('sleep') }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>수면</span>
              </div>
              <span style={{ fontSize: 11, color: '#5AAABB', fontWeight: 500 }}>
                {sleepQuality ? `${sleepHours}시간 · ${sleepQuality}` : `${sleepHours}시간`}
              </span>
            </div>

            {/* 입력 모드 토글 */}
            <div style={{ display: 'flex', background: 'rgba(200,160,224,.1)', borderRadius: 8, padding: 2, marginBottom: 14 }}>
              {[{ key: 'simple', label: '간단 입력' }, { key: 'time', label: '시간 입력' }].map(m => (
                <button key={m.key} onClick={() => setSleepMode(m.key)} style={{
                  flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 10, fontWeight: sleepMode === m.key ? 600 : 400,
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: sleepMode === m.key ? 'rgba(255,255,255,.9)' : 'transparent',
                  color: sleepMode === m.key ? '#9060B0' : '#7AAABB',
                  boxShadow: sleepMode === m.key ? '0 1px 3px rgba(200,160,224,.2)' : 'none',
                  transition: 'all 0.15s ease',
                }}>{m.label}</button>
              ))}
            </div>

            {/* 간단 입력 */}
            {sleepMode === 'simple' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 24, fontWeight: 500, color: '#1A3A4A' }}>{sleepHours}</span>
                  <span style={{ fontSize: 11, color: '#7AAABB', marginLeft: 3 }}>시간</span>
                </div>
                <div style={{ flex: 1 }}>
                  <input type="range" min="2" max="12" step="0.5" value={sleepHours}
                    onChange={e => setSleepHours(parseFloat(e.target.value))}
                    disabled={false}
                    style={{
                      width: '100%', height: 4, appearance: 'none', WebkitAppearance: 'none',
                      background: `linear-gradient(90deg, #C8A0E0 ${((sleepHours - 2) / 10) * 100}%, rgba(200,160,224,.2) ${((sleepHours - 2) / 10) * 100}%)`,
                      borderRadius: 2, outline: 'none',
                    }} />
                </div>
              </div>
            )}

            {/* 시간 입력 */}
            {sleepMode === 'time' && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: '#9ABBC8', marginBottom: 4 }}>잠든 시간</div>
                    <input type="time" value={sleepBedtime || ''}
                      onChange={e => {
                        const v = e.target.value;
                        setSleepBedtime(v);
                        if (v && sleepWakeTime) calcSleepFromTime(v, sleepWakeTime);
                      }}
                      style={{
                        width: '100%', padding: '6px 8px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                        border: '1px solid rgba(200,160,224,.3)', background: 'rgba(200,160,224,.06)',
                        color: '#1A3A4A', fontFamily: 'inherit', outline: 'none',
                        boxSizing: 'border-box', height: 36,
                        WebkitAppearance: 'none', MozAppearance: 'none',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 13, color: '#C8A0E0', paddingBottom: 8 }}>→</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: '#9ABBC8', marginBottom: 4 }}>일어난 시간</div>
                    <input type="time" value={sleepWakeTime || ''}
                      onChange={e => {
                        const v = e.target.value;
                        setSleepWakeTime(v);
                        if (sleepBedtime && v) calcSleepFromTime(sleepBedtime, v);
                      }}
                      style={{
                        width: '100%', padding: '6px 8px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                        border: '1px solid rgba(200,160,224,.3)', background: 'rgba(200,160,224,.06)',
                        color: '#1A3A4A', fontFamily: 'inherit', outline: 'none',
                        boxSizing: 'border-box', height: 36,
                        WebkitAppearance: 'none', MozAppearance: 'none',
                      }}
                    />
                  </div>
                </div>
                {sleepBedtime && sleepWakeTime && (
                  <div style={{
                    textAlign: 'center', padding: '6px 0', borderRadius: 8,
                    background: 'rgba(200,160,224,.06)',
                  }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: '#1A3A4A' }}>{sleepHours}</span>
                    <span style={{ fontSize: 11, color: '#7AAABB', marginLeft: 3 }}>시간 수면</span>
                  </div>
                )}
              </div>
            )}

            {/* 수면 질 */}
            <div style={{ fontSize: 10, color: '#9ABBC8', marginBottom: 6 }}>수면의 질</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {SLEEP_QUALITIES.map(q => {
                const active = sleepQuality === q;
                return (
                  <button key={q} onClick={() => setSleepQuality(active ? null : q)}
                    style={{
                      flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 10, fontWeight: active ? 600 : 400,
                      border: `1px solid ${active ? 'rgba(200,160,224,.4)' : 'rgba(100,180,220,.15)'}`,
                      background: active ? 'rgba(200,160,224,.15)' : 'rgba(255,255,255,.5)',
                      color: active ? '#9060B0' : '#7AAABB',
                      cursor: 'pointer', transition: 'all 0.15s ease',
                      fontFamily: 'inherit',
                    }}>{q}</button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Exercise content */}
      {foodTab === 'activity' && (() => {
        const userWeight = getLatestWeight()?.weight || 55;
        const stepCalAuto = Math.round(stepCount * 0.0005 * userWeight);
        const stepCalDisplay = stepCalOverride !== null ? stepCalOverride : stepCalAuto;
        const stepCalEdited = stepCalOverride !== null;
        const exCalTotal = Object.entries(exerciseLog).reduce((sum, [name, mins]) => {
          const ex = ALL_EXERCISES.find(e => e.name === name);
          if (!ex || !mins) return sum;
          const auto = calcExMET(ex.met, userWeight, mins);
          return sum + (exCalOverrides[name] !== undefined ? exCalOverrides[name] : auto);
        }, 0);
        const totalBurned = stepCalDisplay + exCalTotal;
        return (
        <div style={{ padding: '8px 14px 0' }}>
          {/* 걸음수 카드 */}
          <div style={{ background: 'rgba(255,255,255,.72)', borderRadius: 16, padding: '14px 15px', border: '0.5px solid rgba(255,255,255,.95)', ...fadeUp(0.05) }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 3, height: 14, borderRadius: 2, background: getCategoryColor('activity') }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>걸음수</span>
              </div>
              <span style={{ fontSize: 11, color: stepCount > 0 ? '#5AAABB' : '#9ABBC8', fontWeight: 500 }}>
                {stepCount > 0 ? `${stepCount.toLocaleString()}걸음` : '미기록'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 600, color: '#1A3A4A', fontFamily: 'var(--font-display)' }}>
                {stepCount > 0 ? stepCount.toLocaleString() : '—'}
              </span>
              <span style={{ fontSize: 11, color: '#7AAABB' }}>걸음</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(168,216,168,0.2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #A8D8A8, #78C878)', width: `${Math.min(100, (stepCount / 10000) * 100)}%`, transition: 'width 0.3s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 9, color: '#9ABBC8' }}>0</span>
              <span style={{ fontSize: 9, color: '#9ABBC8' }}>목표 10,000</span>
            </div>
            {(
              <>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  {[1000, 3000, 5000, 8000, 10000].map(v => {
                    const active = stepCount === v;
                    return (
                      <button key={v} onClick={() => { setStepCount(active ? 0 : v); setStepCalOverride(null); }}
                        style={{
                          flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 9, fontWeight: active ? 600 : 400,
                          border: `1px solid ${active ? 'rgba(168,216,168,.5)' : 'rgba(100,180,220,.15)'}`,
                          background: active ? 'rgba(168,216,168,.15)' : 'rgba(255,255,255,.5)',
                          color: active ? '#4A8A5A' : '#7AAABB',
                          cursor: 'pointer', transition: 'all 0.15s ease', fontFamily: 'inherit',
                        }}>{v >= 10000 ? '1만' : `${v / 1000}천`}</button>
                    );
                  })}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="number" inputMode="numeric" placeholder="직접 입력"
                    value={stepCount > 0 && ![1000,3000,5000,8000,10000].includes(stepCount) ? stepCount : ''}
                    onChange={e => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 0 && v <= 200000) setStepCount(v);
                      else if (e.target.value === '') setStepCount(0);
                      setStepCalOverride(null);
                    }}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 12, border: '1px solid rgba(168,216,168,.3)', background: 'rgba(168,216,168,.06)', color: '#1A3A4A', fontFamily: 'inherit', outline: 'none' }}
                  />
                  <span style={{ fontSize: 10, color: '#7AAABB', flexShrink: 0 }}>걸음</span>
                </div>
              </>
            )}
            {/* 걸음 소모 칼로리 */}
            {stepCount > 0 && (
              <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(34,197,94,.06)', border: '0.5px solid rgba(34,197,94,.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#22C55E' }}>🔥 소모 칼로리</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" inputMode="numeric"
                    value={stepCalDisplay}
                    onChange={e => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 0) setStepCalOverride(v);
                      else if (e.target.value === '') setStepCalOverride(0);
                    }}
                    style={{ width: 50, textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#22C55E', border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-display)' }}
                  />
                  <span style={{ fontSize: 11, color: '#22C55E' }}>kcal</span>
                  {stepCalEdited && <span style={{ fontSize: 8, color: '#9ABBC8', marginLeft: 2 }}>직접 수정됨</span>}
                </div>
              </div>
            )}
          </div>

          {/* 운동 카드 */}
          <div style={{ background: 'rgba(255,255,255,.72)', borderRadius: 16, padding: '14px 15px', border: '0.5px solid rgba(255,255,255,.95)', marginTop: 10, ...fadeUp(0.1) }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 3, height: 14, borderRadius: 2, background: getCategoryColor('activity') }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>운동</span>
              </div>
              {(() => {
                const totalMin = Object.values(exerciseLog).reduce((s, m) => s + (m || 0), 0);
                return <span style={{ fontSize: 11, color: totalMin > 0 ? '#5AAABB' : '#9ABBC8', fontWeight: 500 }}>{totalMin > 0 ? `총 ${totalMin}분` : '오늘 미기록'}</span>;
              })()}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
              {exercises.map(ex => {
                const hasLog = exerciseLog[ex.name] > 0;
                return (
                  <div key={ex.id} onClick={() => {
                    if (hasLog) {
                      const next = { ...exerciseLog }; delete next[ex.name];
                      setExerciseLog(next);
                      const nextOv = { ...exCalOverrides }; delete nextOv[ex.name]; setExCalOverrides(nextOv);
                    } else {
                      setExerciseLog({ ...exerciseLog, [ex.name]: 30 });
                    }
                  }}
                    style={{
                      padding: '10px 4px', borderRadius: 10, textAlign: 'center',
                      border: `1px solid ${hasLog ? 'rgba(100,180,220,.6)' : 'rgba(100,180,220,.15)'}`,
                      background: hasLog ? 'rgba(100,180,220,.12)' : 'rgba(255,255,255,.5)',
                      cursor: 'pointer', transition: 'all 0.15s ease',
                    }}>
                    <div style={{ fontSize: 18, marginBottom: 2 }}>{ex.icon}</div>
                    <div style={{ fontSize: 10, fontWeight: hasLog ? 600 : 400, color: hasLog ? '#3A8AAA' : '#7AAABB' }}>{ex.name}</div>
                    {hasLog && <div style={{ fontSize: 9, color: '#5AAABB', marginTop: 2 }}>{exerciseLog[ex.name]}분</div>}
                  </div>
                );
              })}
            </div>
            {/* 선택된 운동 시간·칼로리 */}
            {Object.keys(exerciseLog).length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(exerciseLog).map(([name, mins]) => {
                  const ex = ALL_EXERCISES.find(e => e.name === name);
                  const autoCal = ex ? calcExMET(ex.met, userWeight, mins) : 0;
                  const displayCal = exCalOverrides[name] !== undefined ? exCalOverrides[name] : autoCal;
                  const isEdited = exCalOverrides[name] !== undefined;
                  return (
                    <div key={name} style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(100,180,220,.06)', border: '0.5px solid rgba(100,180,220,.15)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{ex?.icon || '🏃'}</span>
                        <span style={{ fontSize: 11, fontWeight: 500, color: '#1A3A4A', flex: 1 }}>{name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        {EX_DURATIONS.map(v => (
                          <button key={v} onClick={() => {
                            setExerciseLog({ ...exerciseLog, [name]: v });
                            const nextOv = { ...exCalOverrides }; delete nextOv[name]; setExCalOverrides(nextOv);
                          }}
                            style={{
                              flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 9, fontWeight: mins === v ? 600 : 400,
                              border: `1px solid ${mins === v ? 'rgba(100,180,220,.5)' : 'rgba(100,180,220,.15)'}`,
                              background: mins === v ? 'rgba(100,180,220,.15)' : 'transparent',
                              color: mins === v ? '#2A6A8A' : '#7AAABB',
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}>{v}분</button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                        <span style={{ fontSize: 10, color: '#22C55E' }}>🔥</span>
                        <input type="number" inputMode="numeric" value={displayCal}
                          onChange={e => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v) && v >= 0) setExCalOverrides({ ...exCalOverrides, [name]: v });
                            else if (e.target.value === '') setExCalOverrides({ ...exCalOverrides, [name]: 0 });
                          }}
                          style={{ width: 45, textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#22C55E', border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-display)' }}
                        />
                        <span style={{ fontSize: 10, color: '#22C55E' }}>kcal</span>
                        {isEdited && <span style={{ fontSize: 8, color: '#9ABBC8', marginLeft: 2 }}>직접 수정됨</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 오늘 총 소모 합계 */}
          {(stepCount > 0 || Object.keys(exerciseLog).length > 0) && (
            <div style={{ background: 'rgba(34,197,94,.08)', borderRadius: 16, padding: '14px 15px', border: '0.5px solid rgba(34,197,94,.2)', marginTop: 10, ...fadeUp(0.15), display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1A3A4A' }}>오늘 총 소모</span>
              <span style={{ fontSize: 20, fontWeight: 600, color: '#22C55E', fontFamily: 'var(--font-display)' }}>{totalBurned} <span style={{ fontSize: 12 }}>kcal</span></span>
            </div>
          )}

        </div>
        );
      })()}

      {/* ===== 영양 탭 ===== */}
      {foodTab === 'supplement' && (() => {
        const timings = [
          { key: 'morning', label: '아침' },
          { key: 'lunch', label: '점심' },
          { key: 'evening', label: '저녁' },
        ];
        const totalPills = suppItems.length;
        const donePills = suppItems.filter(it => suppChecks[it.id]).length;
        const pillPct = totalPills > 0 ? Math.round((donePills / totalPills) * 100) : 0;
        const undone = suppItems.filter(it => !suppChecks[it.id]);
        const cardStyle = { background: 'rgba(255,255,255,.72)', borderRadius: 16, padding: '14px 15px', border: '0.5px solid rgba(255,255,255,.95)', marginBottom: 10 };

        // Skincare
        const mornProds = skincareProducts.filter(p => p.timeSlot === 'morning' || p.timeSlot === 'both');
        const nightProds = skincareProducts.filter(p => p.timeSlot === 'night' || p.timeSlot === 'both');
        const currentProds = skincareMode === 'morning' ? mornProds : nightProds;
        const allSkincareProds = [...mornProds, ...nightProds];
        const scDone = allSkincareProds.filter(p => skincareChecks[p.timeSlot === 'both' ? skincareMode : (p.timeSlot === 'morning' ? 'morning' : 'night')]?.[p.id]).length;
        // Simpler: count done across both modes
        const scTotalDone = skincareProducts.filter(p => {
          if (p.timeSlot === 'morning' || p.timeSlot === 'both') {
            if (skincareChecks.morning?.[p.id]) return true;
          }
          if (p.timeSlot === 'night' || p.timeSlot === 'both') {
            if (skincareChecks.night?.[p.id]) return true;
          }
          return false;
        }).length;
        const scTotal = skincareProducts.length;
        const scPct = scTotal > 0 ? Math.round((scTotalDone / scTotal) * 100) : 0;
        const scUndone = currentProds.filter(p => !skincareChecks[skincareMode]?.[p.id]);

        const STEP_LABELS = ['클렌저','토너','세럼','에센스','크림','선크림','마스크팩','기타'];

        return (
          <div style={{ padding: '8px 14px 0' }}>
            {/* 영양제 카드 */}
            <div style={{ ...cardStyle, ...fadeUp(0.05) }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 3, height: 14, borderRadius: 2, background: getCategoryColor('supplement') }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>영양제</span>
                </div>
                <span style={{ fontSize: 11, color: '#5AAABB', fontWeight: 500 }}>{donePills} / {totalPills} 완료</span>
              </div>
              {/* Progress bar */}
              {totalPills > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ height: 6, borderRadius: 3, background: 'rgba(200,220,230,.3)', overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ height: '100%', borderRadius: 3, background: getCategoryColor('supplement'), width: `${pillPct}%`, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#7AAABB' }}>{pillPct}%</div>
                </div>
              )}
              {/* Time slots */}
              {timings.map(t => {
                const items = suppItems.filter(it => it.timing === t.key);
                return (
                  <div key={t.key} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: '#7AAABB', marginBottom: 6 }}>{t.label}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {items.map(it => {
                        const checked = !!suppChecks[it.id];
                        return (
                          <div key={it.id} onClick={() => {
                            const next = toggleSupplementCheck(it.id);
                            setSuppChecks(next);
                          }} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '7px 14px', borderRadius: 99, cursor: 'pointer',
                            background: checked ? 'rgba(200,230,210,.4)' : 'rgba(255,255,255,.5)',
                            border: checked ? '1.5px solid rgba(100,180,130,.5)' : '1.5px solid rgba(200,220,230,.3)',
                          }}>
                            <div style={{
                              width: 14, height: 14, borderRadius: '50%',
                              background: checked ? '#4A9A7A' : 'transparent',
                              border: checked ? 'none' : '1.5px solid #B0C8C0',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {checked && <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>✓</span>}
                            </div>
                            <span style={{ fontSize: 13, color: checked ? '#2A6A4A' : '#5A8A9A', fontWeight: checked ? 600 : 400 }}>{it.name}</span>
                          </div>
                        );
                      })}
                      {/* + 추가 버튼 */}
                      {suppAddTiming === t.key ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input value={suppAddName} onChange={e => setSuppAddName(e.target.value)}
                            placeholder="영양제 이름" autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter' && suppAddName.trim()) {
                                setSuppItems(addSupplementItem(suppAddName.trim(), t.key));
                                setSuppAddName(''); setSuppAddTiming(null);
                              }
                            }}
                            style={{
                              width: 100, padding: '7px 10px', borderRadius: 99, border: '1.5px solid rgba(100,180,220,.3)',
                              background: 'rgba(255,255,255,.7)', fontSize: 12, color: '#1A3A4A', outline: 'none', fontFamily: 'inherit',
                            }} />
                          <div onClick={() => {
                            if (suppAddName.trim()) {
                              setSuppItems(addSupplementItem(suppAddName.trim(), t.key));
                              setSuppAddName(''); setSuppAddTiming(null);
                            }
                          }} style={{ padding: '7px 10px', borderRadius: 99, background: 'rgba(100,180,130,.2)', cursor: 'pointer', fontSize: 11, color: '#2A6A4A', fontWeight: 600 }}>확인</div>
                          <div onClick={() => { setSuppAddTiming(null); setSuppAddName(''); }}
                            style={{ padding: '7px 8px', cursor: 'pointer', fontSize: 11, color: '#9ABBC8' }}>취소</div>
                        </div>
                      ) : (
                        <div onClick={() => setSuppAddTiming(t.key)} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '7px 14px', borderRadius: 99, cursor: 'pointer',
                          background: 'transparent', border: '1.5px dashed rgba(180,210,200,.5)',
                          color: '#9ABBC8', fontSize: 12,
                        }}>+ 추가</div>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Undone guidance */}
              {undone.length > 0 && totalPills > 0 && (
                <div style={{
                  background: 'rgba(200,230,210,.15)', borderRadius: 12, padding: '12px 14px', marginTop: 6,
                }}>
                  <div style={{ fontSize: 13, color: '#3A7A5A', lineHeight: 1.6 }}>
                    {undone.map(u => u.name).join('·')}를 아직 못 드셨어요.
                  </div>
                  <div style={{ fontSize: 13, color: '#3A7A5A', lineHeight: 1.6 }}>
                    {undone.some(u => u.timing === 'evening') ? '저녁' : undone.some(u => u.timing === 'lunch') ? '점심' : '아침'} 식후에 챙겨보세요 💊
                  </div>
                </div>
              )}
            </div>

            {/* 스킨케어 카드 */}
            <div style={{ ...cardStyle, ...fadeUp(0.1) }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 3, height: 14, borderRadius: 2, background: getCategoryColor('supplement') }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>스킨케어</span>
                </div>
                <span style={{ fontSize: 11, color: '#5AAABB', fontWeight: 500 }}>{scTotalDone} / {scTotal} 완료</span>
              </div>
              {/* Progress bar */}
              {scTotal > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ height: 6, borderRadius: 3, background: 'rgba(200,220,230,.3)', overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ height: '100%', borderRadius: 3, background: getCategoryColor('supplement'), width: `${scPct}%`, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#7AAABB' }}>{scPct}%</div>
                </div>
              )}
              {/* Morning/Night tabs */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 14 }}>
                {[{ key: 'morning', label: '아침 루틴' }, { key: 'night', label: '저녁 루틴' }].map(tab => (
                  <div key={tab.key} onClick={() => setSkincareMode(tab.key)} style={{
                    flex: 1, textAlign: 'center', padding: '8px 0', cursor: 'pointer',
                    fontSize: 12, fontWeight: skincareMode === tab.key ? 600 : 400,
                    color: skincareMode === tab.key ? '#1A3A4A' : '#9ABBC8',
                    borderBottom: skincareMode === tab.key ? '2px solid #1A3A4A' : '1px solid rgba(200,220,230,.3)',
                  }}>{tab.label}</div>
                ))}
              </div>
              {/* Product cards grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 10 }}>
                {currentProds.map((prod, idx) => {
                  const checked = !!skincareChecks[skincareMode]?.[prod.id];
                  const catInfo = TRACKER_CATEGORIES[prod.category] || TRACKER_CATEGORIES['기타'];
                  return (
                    <div key={prod.id} onClick={() => {
                      const next = toggleTrackerCheck(skincareMode, prod.id);
                      setSkincareChecks(next);
                    }} style={{
                      position: 'relative', padding: '12px 14px', borderRadius: 14, cursor: 'pointer',
                      background: checked ? 'rgba(200,230,210,.25)' : 'rgba(255,255,255,.5)',
                      border: checked ? '1.5px solid rgba(100,180,130,.4)' : '1.5px solid rgba(200,220,230,.3)',
                      transition: 'all 0.15s',
                    }}>
                      {/* Check circle */}
                      <div style={{
                        position: 'absolute', top: -6, right: -2,
                        width: 22, height: 22, borderRadius: '50%',
                        background: checked ? '#4A9A7A' : 'rgba(200,220,230,.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: checked ? 'none' : '1.5px solid rgba(180,210,200,.5)',
                      }}>
                        {checked && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
                      </div>
                      <div style={{ fontSize: 10, color: '#9ABBC8', marginBottom: 2 }}>{idx + 1}단계</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A', marginBottom: 2 }}>{prod.category}</div>
                      <div style={{ fontSize: 11, color: '#7AAABB' }}>{prod.brand || prod.name}</div>
                    </div>
                  );
                })}
                {/* 단계 추가 */}
                {showSkincareAdd ? (
                  <div style={{
                    padding: '10px 12px', borderRadius: 14,
                    background: 'rgba(255,255,255,.5)', border: '1.5px dashed rgba(180,210,200,.5)',
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                    <select value={scAddStep} onChange={e => setScAddStep(e.target.value)} style={{
                      padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(200,220,230,.3)',
                      background: '#fff', fontSize: 11, color: '#1A3A4A', fontFamily: 'inherit', outline: 'none',
                    }}>
                      <option value="">카테고리</option>
                      {STEP_LABELS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input value={scAddBrand} onChange={e => setScAddBrand(e.target.value)}
                      placeholder="브랜드" style={{
                        padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(200,220,230,.3)',
                        background: '#fff', fontSize: 11, color: '#1A3A4A', fontFamily: 'inherit', outline: 'none',
                      }} />
                    <div style={{ display: 'flex', gap: 4 }}>
                      <div onClick={() => {
                        if (scAddStep) {
                          saveProduct({ category: scAddStep, name: scAddStep, brand: scAddBrand, timeSlot: skincareMode });
                          setSkincareProducts(getProducts());
                          setScAddStep(''); setScAddBrand(''); setShowSkincareAdd(false);
                        }
                      }} style={{ flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 8, background: 'rgba(100,180,130,.2)', fontSize: 11, color: '#2A6A4A', fontWeight: 600, cursor: 'pointer' }}>추가</div>
                      <div onClick={() => { setShowSkincareAdd(false); setScAddStep(''); setScAddBrand(''); }}
                        style={{ padding: '6px 8px', fontSize: 11, color: '#9ABBC8', cursor: 'pointer' }}>취소</div>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => setShowSkincareAdd(true)} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '12px 14px', borderRadius: 14, cursor: 'pointer', minHeight: 70,
                    background: 'transparent', border: '1.5px dashed rgba(180,210,200,.5)',
                  }}>
                    <span style={{ fontSize: 18, color: '#B0C8C0' }}>+</span>
                    <span style={{ fontSize: 11, color: '#9ABBC8', marginTop: 2 }}>단계 추가</span>
                  </div>
                )}
              </div>
              {/* Undone guidance */}
              {scUndone.length > 0 && scTotal > 0 && (
                <div style={{
                  background: 'rgba(200,230,210,.15)', borderRadius: 12, padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 13, color: '#3A7A5A', lineHeight: 1.6 }}>
                    {scUndone.map(p => p.category).join('·')}이 남았어요.
                  </div>
                  <div style={{ fontSize: 13, color: '#3A7A5A', lineHeight: 1.6 }}>
                    {skincareMode === 'morning' ? '선크림은 외출 전에 꼭 챙겨요' : '클렌징부터 시작해보세요'} ✨
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Skin content */}
      {(foodTab === 'skin') && <>
        {/* Skin Thumbnail Row — 3칸 그리드 */}
        {(() => {
          const skinRecords = getRecords();
          const slots = [];
          const recent = [...skinRecords].reverse().slice(0, 2);
          recent.forEach(r => {
            const thumb = null; // thumbnails loaded async in MyPage, here just show score
            slots.push({ type: 'record', record: r });
          });
          const addCount = Math.max(1, 3 - slots.length);
          for (let i = 0; i < addCount; i++) slots.push({ type: 'add', key: `skin-add-${i}` });
          return (
            <div style={{
              display: 'flex', gap: 1, margin: '0 16px 12px',
              ...fadeUp(0.05),
            }}>
              {slots.map((slot) => slot.type === 'record' ? (
                <div key={slot.record.id || slot.record.date} style={{
                  flex: '1', aspectRatio: '1/1', borderRadius: 5, overflow: 'hidden', flexShrink: 0,
                  background: 'var(--accent-primary)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 600, color: '#fff' }}>{slot.record.overallScore}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
                    {new Date(slot.record.date).getMonth() + 1}/{new Date(slot.record.date).getDate()}
                  </div>
                </div>
              ) : (
                <div key={slot.key} onClick={() => onMeasure && onMeasure()} style={{
                  flex: '1', aspectRatio: '1/1', borderRadius: 5, flexShrink: 0,
                  border: 'none',
                  background: 'rgba(137,206,245,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 14,
                    background: 'var(--accent-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ color: '#fff', fontSize: 18, lineHeight: 1 }}>+</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
        <SkinInsightsSection onMeasure={onMeasure} />
      </>}

      {/* Food content */}
      {(foodTab === 'food') && <>
      {/* Date subtitle */}
      <div style={{ padding: '0 18px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: '#888' }}>
          {(() => { const d = new Date(selectedDate + 'T00:00:00'); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${DAY_NAMES[d.getDay()]}요일`; })()}
        </div>
        <div style={{ fontSize: 10, color: 'var(--accent-primary)', fontWeight: 600 }}>
          {goal._mealLabel} 기준
        </div>
      </div>

      {/* 2. Meal Thumbnail Row — 3칸 그리드 */}
      {(() => {
        const recorded = foods.filter(f => !f.name?.startsWith('물 '));
        const slots = [];
        // 기록된 음식 (최대 3개 표시, 나머지는 스크롤)
        recorded.forEach(food => slots.push({ type: 'food', food }));
        // 빈 슬롯은 + 버튼으로 채움 (최소 1개)
        const addCount = Math.max(1, 3 - slots.length);
        for (let i = 0; i < addCount; i++) slots.push({ type: 'add', key: `add-${i}` });

        return (
          <div style={{
            display: 'flex', gap: 1, margin: '0 16px 12px',
            overflowX: slots.length > 3 ? 'auto' : 'hidden',
            ...fadeUp(0.05),
          }}>
            {slots.map((slot, idx) => slot.type === 'food' ? (
              <div key={slot.food.id} onClick={() => setDetailFood(slot.food)} style={{
                flex: slots.length <= 3 ? '1' : undefined,
                width: slots.length > 3 ? 'calc((100% - 16px) / 3)' : undefined,
                aspectRatio: '1/1', borderRadius: 5, overflow: 'hidden', flexShrink: 0,
                background: 'var(--accent-primary)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                position: 'relative', cursor: 'pointer',
              }}>
                {slot.food.photo ? (
                  <FoodPhoto photo={slot.food.photo} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                ) : null}
                <div style={{
                  fontSize: 9, color: '#fff', fontWeight: 600, padding: '3px 6px',
                  background: 'rgba(0,0,0,0.35)', borderRadius: '0 0 5px 5px', width: '100%', textAlign: 'center',
                  position: 'relative', zIndex: 1,
                }}>{slot.food.name?.slice(0, 8)}</div>
              </div>
            ) : (
              <div key={slot.key} onClick={() => { setAddMeal(null); setShowAdd(true); }} style={{
                flex: slots.length <= 3 ? '1' : undefined,
                width: slots.length > 3 ? 'calc((100% - 16px) / 3)' : undefined,
                aspectRatio: '1/1', borderRadius: 5, flexShrink: 0,
                border: 'none',
                background: 'rgba(137,206,245,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 14,
                  background: 'var(--accent-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: '#fff', fontSize: 18, lineHeight: 1 }}>+</span>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Meal Picker */}
      {showMealPicker && (
        <div onClick={() => setShowMealPicker(false)} style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0',
            padding: '24px 24px 36px', width: '100%', maxWidth: 420,
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 16px', opacity: 0.3 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>언제 먹었나요?</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {MEAL_LABELS.map(m => (
                <button key={m} onClick={() => { setShowMealPicker(false); setAddMeal(m); setShowAdd(true); }} style={{
                  padding: '16px 0', borderRadius: 14, border: 'none',
                  background: 'var(--bg-input, #F2F3F5)',
                  color: 'var(--text-primary)', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>{m}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. 오늘 식단 요약 + AI 인사이트 통합 */}
      {(() => {
        // AI 생성 키워드 수집 (각 음식의 tags 합산, 중복 제거)
        const aiTags = [...new Set(foods.flatMap(f => f.tags || []))];
        const summaryTags = aiTags.map(t => ({ text: t, type: 'ai' }));

        const carbN = nutrients.find(n => n.key === 'carb');
        const fiberN = nutrients.find(n => n.key === 'fiber');
        const proteinN = nutrients.find(n => n.key === 'protein');
        const fatN = nutrients.find(n => n.key === 'fat');
        const sugarN = nutrients.find(n => n.key === 'sugar');
        const calciumN = nutrients.find(n => n.key === 'calcium');
        const ironN = nutrients.find(n => n.key === 'iron');

        // 내 몸에 미치는 영향: 식품 특성 + 영양소 기반, 긍정 먼저 → 주의
        const impacts = [];
        // 식품 특성 기반 (음식별 AI 분석 데이터)
        const hasLowSugar = foods.some(f => f.bloodSugar === '낮음');
        const hasHighSugar = foods.some(f => f.bloodSugar === '높음');
        const hasLowDrowsy = foods.some(f => f.drowsiness === '낮음');
        const hasHighDrowsy = foods.some(f => f.drowsiness === '높음');
        const hasGoodSkin = foods.some(f => f.skinImpact === '좋음');
        const hasBadSkin = foods.some(f => f.skinImpact === '주의');
        // 긍정 영향
        if (hasLowSugar) impacts.push({ icon: '📉', text: '혈당 안정 예상', type: 'ok' });
        if (hasGoodSkin) impacts.push({ icon: '✨', text: '피부 건강에 도움', type: 'ok' });
        if (hasLowDrowsy) impacts.push({ icon: '⚡', text: '식후 활력 유지', type: 'ok' });
        if (proteinN?.status === '적정') impacts.push({ icon: '💪', text: '근육·회복에 도움', type: 'ok' });
        if (fatN?.status === '적정' && proteinN?.status === '적정') impacts.push({ icon: '🧴', text: '피부 보습 유지', type: 'ok' });
        if (fiberN?.status === '적정') impacts.push({ icon: '🌿', text: '장 건강 도움', type: 'ok' });
        if (calciumN?.status === '적정') impacts.push({ icon: '🦴', text: '뼈 건강 유지', type: 'ok' });
        if (ironN?.status === '적정') impacts.push({ icon: '🩸', text: '빈혈 예방', type: 'ok' });
        // 주의 영향
        if (hasHighSugar) impacts.push({ icon: '📈', text: '혈당 상승 가능', type: 'warn' });
        if (hasHighDrowsy) impacts.push({ icon: '😴', text: '식후 졸림 가능', type: 'warn' });
        if (hasBadSkin) impacts.push({ icon: '⚠️', text: '피부 트러블 주의', type: 'caution' });
        if (proteinN?.status === '부족' || carbN?.status === '과잉') impacts.push({ icon: '⚡', text: '에너지 하락 가능', type: 'warn' });
        if (sugarN?.status === '과잉' || carbN?.status === '과잉') impacts.push({ icon: '🍬', text: '당류 과다 주의', type: 'caution' });

        const tagStyle = {
          ok: { background: '#fff', color: '#0F6E56', border: '1px solid rgba(78,184,160,0.25)' },
          ai: { background: '#fff', color: '#0F6E56', border: '1px solid rgba(78,184,160,0.25)' },
        };
        const impactStyle = {
          warn: { background: 'rgba(255,143,171,0.1)', border: '0.5px solid rgba(255,143,171,0.3)', color: '#C2185B' },
          caution: { background: 'rgba(255,179,71,0.1)', border: '0.5px solid rgba(255,179,71,0.3)', color: '#C4580A' },
          ok: { background: 'rgba(78,184,160,0.1)', border: '0.5px solid rgba(78,184,160,0.3)', color: '#0F6E56' },
        };

        // AI 인사이트 메시지 생성 (FoodCoachCard 로직 통합)
        const latestFood = foods.length > 0 ? foods[foods.length - 1] : null;
        const coachMessages = [];
        if (latestFood) {
          const recordedMeals = [...new Set(foods.filter(f => !f.name?.startsWith('물 ')).map(f => f.meal))];
          const allMeals = ['아침', '점심', '저녁'];
          const mealBasis = recordedMeals.length > 0 ? `${recordedMeals.join('·')} 기준` : '';

          const positives = [];
          const foodNames = foods.filter(f => !f.name?.startsWith('물 ')).map(f => f.name).filter(Boolean);
          const goodSkin = foods.filter(f => f.skinImpact === '좋음');
          const lowSugarF = foods.filter(f => f.bloodSugar === '낮음');
          const noSleepy = foods.filter(f => f.drowsiness === '낮음');
          const goodNutrients = NUTRIENT_META.filter(n => {
            const val = nutrition[n.key] || 0;
            const goalVal = n.goalKey ? goal[n.goalKey] : 0;
            return goalVal && (val / goalVal) >= 0.7;
          }).map(n => n.label);

          if (goodSkin.length > 0) positives.push(`${goodSkin[0].name}은 피부 건강에 좋은 선택이에요`);
          if (lowSugarF.length > 0 && positives.length === 0) positives.push(`${lowSugarF[0].name}은 혈당에 부담이 적어요`);
          if (noSleepy.length > 0 && positives.length === 0) positives.push('식후에도 활력을 유지할 수 있는 식단이에요');
          if (goodNutrients.length >= 3 && positives.length === 0) positives.push(`${goodNutrients.slice(0, 3).join('·')} 섭취가 잘 되고 있어요`);
          if (score >= 70 && positives.length === 0) positives.push('영양 균형이 잘 맞는 식사예요');
          if (positives.length === 0 && foodNames.length > 0) positives.push(`${foodNames[foodNames.length - 1]}, 괜찮은 선택이에요`);

          const warnings = [];
          const kcalRatio = goal.kcal ? nutrition.kcal / goal.kcal : 0;
          if (kcalRatio > 1.2) warnings.push({ icon: '🍽️', text: `${mealBasis} 칼로리가 ${Math.round((kcalRatio - 1) * 100)}% 초과했어요.` });
          if (latestFood.bloodSugar === '높음') warnings.push({ icon: '📈', text: latestFood.bloodSugarNote || `${latestFood.name}은 혈당을 빠르게 올릴 수 있어요.` });
          if (latestFood.drowsiness === '높음') warnings.push({ icon: '😴', text: latestFood.drowsinessNote || `${latestFood.name} 식후 졸릴 수 있어요.` });
          if (latestFood.skinImpact === '주의') warnings.push({ icon: '⚠️', text: latestFood.skinImpactNote || `${latestFood.name}은 피부 트러블에 영향을 줄 수 있어요.` });

          const hour = new Date().getHours();
          const futureMeals = allMeals.filter(m => {
            if (m === '아침') return hour < 10;
            if (m === '점심') return hour < 14;
            if (m === '저녁') return hour < 21;
            return false;
          });
          const nextMeal = futureMeals.find(m => !recordedMeals.includes(m));
          let suggestion = '';
          if (lacking.length > 0 && nextMeal) suggestion = `${nextMeal}에 ${lacking.slice(0, 2).join('·')}을 보충하면 균형이 맞아요.`;
          else if (lacking.length > 0 && !nextMeal) suggestion = `내일 아침에 ${lacking.slice(0, 2).join('·')}을 챙겨보세요.`;

          if (positives.length > 0) coachMessages.push({ icon: '✨', text: positives[0] + (suggestion ? ` ${suggestion}` : '') });
          if (warnings.length > 0) coachMessages.push(warnings[0]);
          else if (suggestion && positives.length === 0) coachMessages.push({ icon: '💡', text: suggestion });
          if (!latestFood.bloodSugar && !latestFood.drowsiness && !latestFood.skinImpact && coachMessages.length === 0) {
            coachMessages.push({ icon: '💡', text: `${latestFood.name} — 새로 기록하면 혈당·졸림·피부 영향까지 분석해드려요.` });
          }
          if (coachMessages.length === 0) coachMessages.push({ icon: '👍', text: `${latestFood.name}, 괜찮은 선택이에요!` });
        }

        return (
          <div style={{
            margin: '0 16px 10px', borderRadius: 16, padding: '16px 20px',
            background: 'rgba(255,255,255,0.3)',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.3)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
            ...fadeUp(0.1),
          }}>
            <div onClick={() => setSummaryOpen(!summaryOpen)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
              marginBottom: summaryOpen ? 12 : 0,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(0,0,0,0.8)' }}>오늘 식단 요약</span>
              <svg width="16" height="16" viewBox="0 0 16 16" style={{
                transition: 'transform 0.25s ease',
                transform: summaryOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}>
                <path d="M4 6 L8 10 L12 6" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {summaryOpen && (
              foods.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>식사를 기록하면 맞춤 분석을 받을 수 있어요</div>
              ) : (
                <>
                  {/* AI 인사이트 메시지 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: summaryTags.length > 0 || impacts.length > 0 ? 14 : 0 }}>
                    {coachMessages.map((m, i) => (
                      <div key={i} style={{ fontSize: 13, color: '#4E5968', lineHeight: 1.6 }}>
                        {m.text}
                      </div>
                    ))}
                  </div>

                  {/* AI 키워드 태그 */}
                  {summaryTags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {summaryTags.map((t, i) => (
                        <span key={i} style={{
                          fontSize: 10, fontWeight: 500, borderRadius: 99, padding: '4px 10px',
                          ...tagStyle[t.type],
                        }}>{t.text}</span>
                      ))}
                    </div>
                  )}

                  {/* 구분선 + 내 몸에 미치는 영향 */}
                  {impacts.length > 0 && (
                    <>
                      <div style={{ height: 1, background: 'rgba(78,184,160,0.15)', margin: '12px 0' }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(0,0,0,0.8)', marginBottom: 8 }}>내 몸에 미치는 영향</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {impacts.slice(0, 2).map((imp, i) => (
                          <span key={i} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 10, fontWeight: 500, borderRadius: 99, padding: '5px 12px',
                            ...impactStyle[imp.type],
                          }}>
                            <span style={{ fontSize: 12 }}>{imp.icon}</span>{imp.text}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )
            )}
          </div>
        );
      })()}

      {/* 4. Nutrient Card (접기/펼치기) */}
      <div style={{
        margin: '0 16px 10px', borderRadius: 16, padding: '16px 20px',
        background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
        ...fadeUp(0.15),
      }}>
        <div onClick={() => setNutrientOpen(!nutrientOpen)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(0,0,0,0.8)' }}>영양소 상세</span>
          <svg width="16" height="16" viewBox="0 0 16 16" style={{
            transition: 'transform 0.25s ease',
            transform: nutrientOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            <path d="M4 6 L8 10 L12 6" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        {nutrientOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {nutrients.slice(0, 4).map(n => (
                <div key={n.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{n.key === 'kcal' ? <span style={{ fontSize: 14 }}>🔥</span> : n.key === 'protein' ? <span style={{ fontSize: 14 }}>🥩</span> : n.key === 'carb' ? <span style={{ fontSize: 14 }}>🍞</span> : n.key === 'fat' ? <span style={{ fontSize: 14 }}>🥑</span> : '·'}</div>
                  <div style={{ fontSize: 13, fontWeight: 400, color: 'rgba(0,0,0,0.7)' }}>{n.label}</div>
                  <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.5)', fontFamily: 'var(--font-display)' }}>{n.displayVal}</div>
                  <StatusIcon status={n.status} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              {nutrients.slice(4).map(n => (
                <div key={n.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                  }}>
                    {n.key === 'fiber' ? '🥕' : n.key === 'sugar' ? '🍯' : n.key === 'iron' ? '🥦' : '🐟'}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 400, color: 'rgba(0,0,0,0.7)' }}>{n.label}</div>
                  <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.5)', fontFamily: 'var(--font-display)' }}>{n.displayVal}</div>
                  <StatusIcon status={n.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FoodCoachCard 통합됨 — 첫번째 카드에 포함 */}

      {/* Water Card (in food tab) */}
      <div style={{ padding: '8px 14px 0' }}>
        <div style={{ background: 'rgba(255,255,255,.72)', borderRadius: 16, padding: '14px 15px', border: '0.5px solid rgba(255,255,255,.95)', ...fadeUp(0.3) }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: getCategoryColor('food') }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>수분</span>
            </div>
            <span style={{ fontSize: 11, color: waterCount > 0 ? '#5AAABB' : '#9ABBC8', fontWeight: 500 }}>
              {waterCount > 0 ? `${waterCount}잔(${waterCount * cupMl}ml)` : '미기록'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 4, flex: 1 }}>
              {Array.from({ length: TOTAL_CUPS }).map((_, i) => {
                const filled = i < waterCount;
                return (
                  <div key={i} onClick={() => setWaterCount(i + 1 === waterCount ? 0 : i + 1)}
                    style={{
                      width: 20, height: 26, borderRadius: 5, overflow: 'hidden',
                      border: `1px solid ${filled ? 'rgba(100,180,220,.4)' : 'rgba(100,180,220,.2)'}`,
                      background: filled ? 'transparent' : 'rgba(100,180,220,.08)',
                      cursor: 'pointer', position: 'relative', transition: 'all 0.15s ease',
                    }}>
                    {filled && (
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%',
                        background: 'linear-gradient(180deg, #90CCEE, #60AADD)', borderRadius: 4,
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#5AAABB', minWidth: 32, textAlign: 'right' }}>{waterCount}잔</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 9, color: '#9ABBC8' }}>1잔 = {cupMl}ml</span>
            <span style={{ fontSize: 9, color: '#9ABBC8' }}>목표 {goalMl.toLocaleString()}ml</span>
          </div>
        </div>
      </div>

      </>}

      {/* Body content */}
      {(foodTab === 'body') && <>
        {/* Body Thumbnail Row — 3칸 그리드 */}
        {(() => {
          const bodyRecords = getBodyRecords();
          const slots = [];
          const recent = [...bodyRecords].reverse().slice(0, 2);
          recent.forEach(r => {
            slots.push({ type: 'record', record: r });
          });
          const addCount = Math.max(1, 3 - slots.length);
          for (let i = 0; i < addCount; i++) slots.push({ type: 'add', key: `body-add-${i}` });
          return (
            <div style={{
              display: 'flex', gap: 1, margin: '0 16px 12px',
              ...fadeUp(0.05),
            }}>
              {slots.map((slot) => slot.type === 'record' ? (
                <div key={slot.record.date} style={{
                  flex: '1', aspectRatio: '1/1', borderRadius: 5, overflow: 'hidden', flexShrink: 0,
                  background: 'var(--accent-primary)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 600, color: '#fff' }}>{slot.record.weight}<span style={{ fontSize: 11 }}>kg</span></div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
                    {new Date(slot.record.date).getMonth() + 1}/{new Date(slot.record.date).getDate()}
                  </div>
                </div>
              ) : (
                <div key={slot.key} onClick={() => setShowBodyAdd(true)} style={{
                  flex: '1', aspectRatio: '1/1', borderRadius: 5, flexShrink: 0,
                  border: 'none',
                  background: 'rgba(137,206,245,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 14,
                    background: 'var(--accent-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ color: '#fff', fontSize: 18, lineHeight: 1 }}>+</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
        <BodyInsightsSection />
      </>}

      {/* Body shape content (placeholder) */}
      {(foodTab === 'shape') && (
        <div style={{ padding: '60px 24px', textAlign: 'center', ...fadeUp(0.05) }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>💪</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>바디 기록</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>곧 출시 예정이에요</div>
        </div>
      )}

      </div>}{/* end tab-content-panel */}

      {/* Body Weight Quick Add — 그리드 + 아이콘 클릭 시 */}
      {showBodyAdd && (
        <WeightInputModal
          value={bodyWeight}
          onChange={setBodyWeight}
          onConfirm={() => {
            const w = parseFloat(bodyWeight);
            if (w && w >= 20 && w <= 300) {
              saveBodyRecord(w);
              setShowBodyAdd(false);
              setBodyWeight('');
            }
          }}
          onClose={() => setShowBodyAdd(false)}
        />
      )}

      {/* Record Settings Page */}
      {showRecordSettings && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2002,
          background: 'linear-gradient(to bottom, #ace2fc, #ffffff)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
            <div onClick={() => setShowRecordSettings(false)} style={{
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </div>
            <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>기록 설정</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '28px 24px' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>💧 수분 설정</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>1잔 기준과 하루 목표를 설정해요</div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>1잔 기준</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[250, 500].map(ml => (
                  <div key={ml} onClick={() => {
                    const next = { ...waterSettings, cupMl: ml };
                    setWaterSettings(next);
                    saveWaterSettings(next);
                  }} style={{
                    flex: 1, padding: '16px 0', borderRadius: 16, textAlign: 'center', cursor: 'pointer',
                    background: cupMl === ml ? 'rgba(137,206,245,0.1)' : 'var(--bg-card, #fff)',
                    border: cupMl === ml ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    transition: 'all 0.15s ease',
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{ml}ml</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>하루 목표</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1500, 2000, 2500, 3000, 3500].map(ml => (
                  <div key={ml} onClick={() => {
                    const next = { ...waterSettings, goalMl: ml };
                    setWaterSettings(next);
                    saveWaterSettings(next);
                  }} style={{
                    padding: '14px 20px', borderRadius: 16, cursor: 'pointer',
                    background: goalMl === ml ? 'rgba(137,206,245,0.1)' : 'var(--bg-card, #fff)',
                    border: goalMl === ml ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    transition: 'all 0.15s ease',
                  }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{ml.toLocaleString()}ml</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{Math.ceil(ml / waterSettings.cupMl)}잔</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', margin: '28px 0' }} />

            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>🏃 운동 종류 설정</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>6개를 선택해주세요 ({selectedExIds.length}/6)</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {ALL_EXERCISES.map(ex => {
                const selected = selectedExIds.includes(ex.id);
                const full = selectedExIds.length >= 6 && !selected;
                return (
                  <div key={ex.id} onClick={() => {
                    if (selected) {
                      if (selectedExIds.length <= 1) return;
                      const next = selectedExIds.filter(id => id !== ex.id);
                      setSelectedExIds(next);
                      saveSelectedExerciseIds(next);
                      setExercises(next.map(id => ALL_EXERCISES.find(e => e.id === id)).filter(Boolean));
                    } else if (!full) {
                      const next = [...selectedExIds, ex.id];
                      setSelectedExIds(next);
                      saveSelectedExerciseIds(next);
                      setExercises(next.map(id => ALL_EXERCISES.find(e => e.id === id)).filter(Boolean));
                    }
                  }} style={{
                    padding: '16px 8px', borderRadius: 16, textAlign: 'center', cursor: full ? 'default' : 'pointer',
                    background: selected ? 'rgba(137,206,245,0.1)' : 'var(--bg-card, #fff)',
                    border: selected ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    opacity: full ? 0.35 : 1,
                    transition: 'all 0.15s ease',
                  }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{ex.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{ex.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Food Modal */}
      {showAdd && <AddFoodModal onAdd={handleAddFood} onClose={() => { setShowAdd(false); setAddMeal(null); }} initialMeal={addMeal} />}

      {/* Food Detail Modal */}
      {detailFood && <FoodDetailModal food={detailFood} onClose={() => setDetailFood(null)} onDelete={handleDeleteFood} />}
    </div>
  );
}

export function AddFoodModal({ onAdd, onClose, initialMeal }) {
  const [mode, setMode] = useState(null); // null = selection, 'text' = name input, 'photo' = photo analysis
  const [foodItems, setFoodItems] = useState([{ name: '', qty: 1, unit: '인분' }]);
  const [meal, setMeal] = useState(initialMeal || '아침');
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const fileRef = useRef(null);
  const albumRef = useRef(null);
  const contentRef = useRef(null);
  const nameInputRef = useRef(null);
  const [cropSrc, setCropSrc] = useState(null);
  const [photoHint, setPhotoHint] = useState(''); // optional food name hint
  const [photoPortionLabel, setPhotoPortionLabel] = useState('전체'); // how much eaten

  // Handle mobile keyboard: adjust modal position when keyboard appears
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      if (contentRef.current) {
        const keyboardHeight = window.innerHeight - vv.height;
        contentRef.current.style.transform = keyboardHeight > 50 ? `translateY(-${keyboardHeight}px)` : 'translateY(0)';
      }
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  const saveThumbToDB = async () => {
    if (!preview) return null;
    try {
      const photoId = `food_photo_${Date.now()}`;
      const resized = await resizeImage(preview, 512, 0.82);
      await savePhotoDB(photoId, resized);
      return photoId;
    } catch { return null; }
  };

  const handleAnalyze = async () => {
    const validItems = foodItems.filter(f => f.name.trim());
    if (validItems.length === 0) return;
    setAnalyzing(true);
    setAiResult(null);
    try {
      const nameStr = validItems.map(f => `${f.name.trim()} ${f.qty}${f.unit}`).join(', ');
      const res = await fetch('/api/food-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameStr, servings: 1 }),
      });
      if (res.ok) {
        const result = await res.json();
        setAiResult(result);
      }
    } catch (err) {}
    setAnalyzing(false);
  };

  const handlePhotoAnalyze = async (imageData) => {
    setAnalyzing(true);
    setAiResult(null);
    try {
      const payload = { image: imageData || preview };
      if (photoHint.trim()) payload.hint = photoHint.trim();
      if (photoPortionLabel !== '전체') payload.portion = photoPortionLabel;
      const res = await fetch('/api/food-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const result = await res.json();
        setAiResult(result);
      }
    } catch (err) {}
    setAnalyzing(false);
  };

  const handleSubmit = async () => {
    if (!aiResult) return;
    const photoId = await saveThumbToDB();
    onAdd({
      name: aiResult.name, meal, photo: photoId,
      kcal: aiResult.kcal || 0,
      carb: aiResult.carb || 0,
      protein: aiResult.protein || 0,
      fat: aiResult.fat || 0,
      vitamin: aiResult.vitamin || 0,
      mineral: aiResult.mineral || 0,
      fiber: aiResult.fiber || 0,
      iron: aiResult.iron || 0,
      calcium: aiResult.calcium || 0,
      sugar: aiResult.sugar || 0,
      bloodSugar: aiResult.bloodSugar || '',
      bloodSugarNote: aiResult.bloodSugarNote || '',
      drowsiness: aiResult.drowsiness || '',
      drowsinessNote: aiResult.drowsinessNote || '',
      skinImpact: aiResult.skinImpact || '',
      skinImpactNote: aiResult.skinImpactNote || '',
      tags: aiResult.tags || [],
      ingredients: aiResult.ingredients || [],
      water: 0,
    });
  };

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCropSrc(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    border: 'none', background: 'var(--bg-input, #F2F3F5)',
    fontSize: 14, color: 'var(--text-primary)', fontFamily: 'inherit',
    outline: 'none',
  };

  const aiResultBlock = aiResult && (
    <div style={{
      padding: '14px 16px', borderRadius: 14, marginBottom: 16,
      background: 'rgba(137,206,245,0.08)', border: '1px solid rgba(137,206,245,0.2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 13 }}>✨</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{aiResult.name}</span>
        {mode === 'text' && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{foodItems.filter(f => f.name.trim()).map(f => `${f.qty}${f.unit}`).join(' + ')}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
        {[
          { icon: '🔥', label: '칼로리', value: aiResult.kcal, unit: 'kcal' },
          { icon: '🥩', label: '단백질', value: aiResult.protein, unit: 'g' },
          { icon: '🍞', label: '탄수화물', value: aiResult.carb, unit: 'g' },
          { icon: '🥑', label: '지방', value: aiResult.fat, unit: 'g' },
        ].map(n => (
          <div key={n.label} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 10 }}>
            <div style={{ fontSize: 14, marginBottom: 3 }}>{n.icon}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>{n.label}</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{n.value}<span style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-muted)' }}>{n.unit}</span></div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
        {[
          { icon: '🥕', label: '식이섬유', value: aiResult.fiber || 0, unit: 'g' },
          { icon: '🥦', label: '철분', value: aiResult.iron || 0, unit: 'mg' },
          { icon: '🐟', label: '칼슘', value: aiResult.calcium || 0, unit: 'mg' },
          { icon: '🍯', label: '당류', value: aiResult.sugar || 0, unit: 'g' },
        ].map(n => (
          <div key={n.label} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 10 }}>
            <div style={{ fontSize: 14, marginBottom: 3 }}>{n.icon}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>{n.label}</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{n.value}<span style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-muted)' }}>{n.unit}</span></div>
          </div>
        ))}
      </div>
      {/* Ingredients breakdown */}
      {filterIngredients(aiResult.ingredients).length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(137,206,245,0.15)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>재료 구성</div>
          {filterIngredients(aiResult.ingredients).map((ing, i, arr) => (
            <div key={i} style={{
              padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{ing.name}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-primary)' }}>{ing.kcal}kcal</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ing.amount}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>탄<span style={{ fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 2 }}>{ing.carb}g</span></span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>단<span style={{ fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 2 }}>{ing.protein}g</span></span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>지<span style={{ fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 2 }}>{ing.fat}g</span></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Post-meal impact analysis */}
      {(aiResult.bloodSugar || aiResult.drowsiness || aiResult.skinImpact) && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(137,206,245,0.15)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>식후 영향 분석</div>
          {[
            { icon: '📈', label: '혈당 상승', value: aiResult.bloodSugar, note: aiResult.bloodSugarNote },
            { icon: '😴', label: '졸림 확률', value: aiResult.drowsiness, note: aiResult.drowsinessNote },
            { icon: '✨', label: '피부 영향', value: aiResult.skinImpact, note: aiResult.skinImpactNote },
          ].filter(i => i.value).map(item => {
            const s = IMPACT_STYLE[item.value] || IMPACT_STYLE['보통'];
            return (
              <div key={item.label} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.02)', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: item.note ? 4 : 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.icon} {item.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: s.bg, color: s.color }}>{item.value}</span>
                </div>
                {item.note && <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item.note}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div ref={contentRef} onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0',
        padding: '24px 24px 40px', width: '100%', maxWidth: 420,
        maxHeight: '85dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        transition: 'transform 0.2s ease',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />

        {/* Title + back button */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          {mode && (
            <div onClick={() => { setMode(null); setAiResult(null); setPreview(null); setAnalyzing(false); }} style={{ cursor: 'pointer', marginRight: 10, color: 'var(--text-muted)', fontSize: 18 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          )}
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>식사 기록</div>
        </div>

        {/* Meal selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {MEAL_LABELS.map(m => (
            <button key={m} onClick={() => setMeal(m)} style={{
              flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
              background: meal === m ? 'var(--accent-primary)' : 'var(--bg-input, #F2F3F5)',
              color: meal === m ? '#fff' : 'var(--text-muted)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>{m}</button>
          ))}
        </div>

        {/* Mode selection */}
        {!mode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <button onClick={() => setMode('photo')} style={{
              width: '100%', padding: '20px 16px', borderRadius: 16, border: '1.5px solid rgba(137,206,245,0.3)',
              background: 'rgba(137,206,245,0.06)', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(137,206,245,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="3" stroke="var(--accent-primary)" strokeWidth="1.5" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>사진으로 자동 분석</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>음식 사진을 찍으면 AI가 자동으로 영양소를 분석해요</div>
              </div>
            </button>
            <button onClick={() => setMode('text')} style={{
              width: '100%', padding: '20px 16px', borderRadius: 16, border: '1.5px solid rgba(0,0,0,0.06)',
              background: 'var(--bg-input, #F2F3F5)', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>음식 이름으로 기록</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>음식 이름을 직접 입력하면 AI가 영양소를 분석해요</div>
              </div>
            </button>
          </div>
        )}

        {/* Photo mode */}
        {mode === 'photo' && (
          <>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
            <input ref={albumRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />

            {!preview && !analyzing && !aiResult && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button onClick={() => fileRef.current?.click()} style={{
                  flex: 1, padding: '18px 0', borderRadius: 14, border: 'none',
                  background: 'rgba(137,206,245,0.12)', color: 'var(--accent-primary)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#89cef5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="13" r="3" stroke="#89cef5" strokeWidth="1.5" />
                  </svg>
                  사진 촬영
                </button>
                <button onClick={() => albumRef.current?.click()} style={{
                  flex: 1, padding: '18px 0', borderRadius: 14, border: 'none',
                  background: 'var(--bg-input, #F2F3F5)', color: 'var(--text-secondary)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M3 16l5-4 4 3 3-2 6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  앨범에서 선택
                </button>
              </div>
            )}

            {/* Photo preview */}
            {preview && (
              <div style={{ marginBottom: 12, borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
                <img src={preview} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
                {!analyzing && !aiResult && (
                  <div onClick={() => { setPreview(null); setPhotoHint(''); setPhotoPortionLabel('전체'); }} style={{
                    position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#fff', fontSize: 14,
                  }}>×</div>
                )}
              </div>
            )}

            {/* Hint inputs - shown after photo, before analysis */}
            {preview && !analyzing && !aiResult && (
              <>
                <input
                  value={photoHint}
                  onChange={e => setPhotoHint(e.target.value)}
                  placeholder="음식 이름 (선택사항, 예: 오차즈케)"
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12, marginBottom: 10,
                    border: 'none', background: 'var(--bg-input, #F2F3F5)',
                    fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>먹은 양</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                  {['전체', '3/4', '2/3', '1/2', '1/3', '1/4', '1/5'].map(p => (
                    <button key={p} onClick={() => setPhotoPortionLabel(p)} style={{
                      padding: '7px 14px', borderRadius: 10, border: 'none',
                      background: photoPortionLabel === p ? 'var(--accent-primary)' : 'var(--bg-input, #F2F3F5)',
                      color: photoPortionLabel === p ? '#fff' : 'var(--text-muted)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}>{p}</button>
                  ))}
                </div>
                <button onClick={() => handlePhotoAnalyze(preview)} style={{
                  width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
                  background: 'var(--accent-primary)', color: '#fff',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  marginBottom: 12,
                }}>AI 분석하기</button>
              </>
            )}

            {/* Analyzing indicator */}
            {analyzing && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '16px 0', marginBottom: 12, color: 'var(--text-muted)', fontSize: 13,
              }}>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', width: 16, height: 16, border: '2px solid var(--text-muted)', borderTopColor: 'transparent', borderRadius: '50%' }} />
                AI가 음식을 분석하고 있어요...
              </div>
            )}

            {aiResultBlock}

            {/* Re-take photo after result */}
            {aiResult && (
              <div onClick={() => { setAiResult(null); setPreview(null); setPhotoHint(''); setPhotoPortionLabel('전체'); }} style={{
                textAlign: 'center', fontSize: 12, color: 'var(--accent-primary)', cursor: 'pointer', marginBottom: 12,
              }}>다시 촬영하기</div>
            )}
          </>
        )}

        {/* Text mode */}
        {mode === 'text' && (
          <>
            {/* Optional photo */}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
            <input ref={albumRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={() => fileRef.current?.click()} style={{
                flex: 1, padding: '14px 0', borderRadius: 14, border: 'none',
                background: 'rgba(137,206,245,0.12)', color: 'var(--accent-primary)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#89cef5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="3" stroke="#89cef5" strokeWidth="1.5" />
                </svg>
                사진 촬영
              </button>
              <button onClick={() => albumRef.current?.click()} style={{
                flex: 1, padding: '14px 0', borderRadius: 14, border: 'none',
                background: 'var(--bg-input, #F2F3F5)', color: 'var(--text-secondary)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M3 16l5-4 4 3 3-2 6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                앨범에서 선택
              </button>
            </div>

            {/* Photo preview */}
            {preview && (
              <div style={{ marginBottom: 12, borderRadius: 14, overflow: 'hidden' }}>
                <img src={preview} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
              </div>
            )}

            {/* Food name input + servings */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>음식 이름</div>
            {foodItems.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                <input
                  ref={idx === 0 ? nameInputRef : null}
                  value={item.name}
                  onChange={e => {
                    const next = [...foodItems];
                    next[idx].name = e.target.value;
                    setFoodItems(next);
                    setAiResult(null);
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                  onFocus={() => setTimeout(() => nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                  placeholder={idx === 0 ? '예: 연어포케' : '추가 음식'}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <select
                  value={item.qty}
                  onChange={e => {
                    const next = [...foodItems];
                    next[idx].qty = Number(e.target.value);
                    setFoodItems(next);
                    setAiResult(null);
                  }}
                  style={{
                    width: 52, padding: '10px 2px', borderRadius: 12, border: 'none',
                    background: 'var(--bg-input, #F2F3F5)', fontSize: 13,
                    color: 'var(--text-primary)', fontFamily: 'inherit', textAlign: 'center',
                    outline: 'none',
                  }}
                >
                  {[0.5, 0.8, 1, 1.5, 2, 3, 4, 5].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <select
                  value={item.unit}
                  onChange={e => {
                    const next = [...foodItems];
                    next[idx].unit = e.target.value;
                    setFoodItems(next);
                    setAiResult(null);
                  }}
                  style={{
                    width: 56, padding: '10px 2px', borderRadius: 12, border: 'none',
                    background: 'var(--bg-input, #F2F3F5)', fontSize: 13,
                    color: 'var(--text-primary)', fontFamily: 'inherit', textAlign: 'center',
                    outline: 'none',
                  }}
                >
                  {['인분', '개', '줄', '조각', '잔', '그릇', '봉'].map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                {foodItems.length > 1 && (
                  <div onClick={() => setFoodItems(foodItems.filter((_, i) => i !== idx))} style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#ccc', fontSize: 16,
                  }}>×</div>
                )}
              </div>
            ))}
            <div onClick={() => setFoodItems([...foodItems, { name: '', qty: 1, unit: '인분' }])} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '8px 0', marginBottom: 12, cursor: 'pointer',
              borderRadius: 10, border: '1px dashed rgba(0,0,0,0.12)',
              fontSize: 12, color: 'var(--text-muted)',
            }}>
              <span style={{ fontSize: 16 }}>+</span> 음식 추가
            </div>

            {/* Analyze button */}
            <button onClick={handleAnalyze} disabled={analyzing || !foodItems.some(f => f.name.trim())} style={{
              width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
              background: analyzing ? 'var(--bg-input, #F2F3F5)' : 'rgba(137,206,245,0.15)',
              color: analyzing ? 'var(--text-muted)' : 'var(--accent-primary)',
              fontSize: 13, fontWeight: 600, cursor: analyzing ? 'default' : 'pointer',
              fontFamily: 'inherit', marginBottom: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {analyzing ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', width: 14, height: 14, border: '2px solid var(--text-muted)', borderTopColor: 'transparent', borderRadius: '50%' }} />
                  AI 영양소 분석 중...
                </>
              ) : '✨ AI 영양소 분석'}
            </button>

            {aiResultBlock}
          </>
        )}

        {/* Buttons */}
        {mode && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
              border: 'none', background: 'var(--bg-input, #F2F3F5)',
              color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>취소</button>
            <button onClick={handleSubmit} disabled={!aiResult} style={{
              flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
              border: 'none',
              background: aiResult ? 'var(--accent-primary)' : 'var(--bg-input, #F2F3F5)',
              color: aiResult ? '#fff' : 'var(--text-dim)',
              fontSize: 14, fontWeight: 600,
              cursor: aiResult ? 'pointer' : 'default', fontFamily: 'inherit',
            }}>추가</button>
          </div>
        )}

        {/* Cancel button for mode selection */}
        {!mode && (
          <button onClick={onClose} style={{
            width: '100%', padding: '14px 0', borderRadius: 'var(--btn-radius)',
            border: 'none', background: 'var(--bg-input, #F2F3F5)',
            color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>취소</button>
        )}

        {/* Crop Modal */}
        {cropSrc && <PhotoCropModal src={cropSrc} onConfirm={(cropped) => {
          setPreview(cropped);
          setCropSrc(null);
        }} onCancel={() => setCropSrc(null)} />}
      </div>
    </div>
  );
}

// ===== 1:1 Photo Crop Modal =====
function PhotoCropModal({ src, onConfirm, onCancel }) {
  const canvasRef = useRef(null);
  const [img, setImg] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const dragRef = useRef(null);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      setImg(image);
      // 초기 스케일: 짧은 변이 cropSize에 맞도록
      const cropSize = 280;
      const s = cropSize / Math.min(image.width, image.height);
      setScale(s);
      setOffset({
        x: (cropSize - image.width * s) / 2,
        y: (cropSize - image.height * s) / 2,
      });
    };
    image.src = src;
  }, [src]);

  const cropSize = 280;

  const handleTouchStart = (e) => {
    const t = e.touches[0];
    dragRef.current = { startX: t.clientX - offset.x, startY: t.clientY - offset.y };
  };
  const handleTouchMove = (e) => {
    if (!dragRef.current || !img) return;
    e.preventDefault();
    const t = e.touches[0];
    const w = img.width * scale, h = img.height * scale;
    let x = t.clientX - dragRef.current.startX;
    let y = t.clientY - dragRef.current.startY;
    x = Math.min(0, Math.max(cropSize - w, x));
    y = Math.min(0, Math.max(cropSize - h, y));
    setOffset({ x, y });
  };
  const handleTouchEnd = () => { dragRef.current = null; };

  const handleMouseDown = (e) => {
    dragRef.current = { startX: e.clientX - offset.x, startY: e.clientY - offset.y };
    const onMove = (ev) => {
      if (!dragRef.current || !img) return;
      const w = img.width * scale, h = img.height * scale;
      let x = ev.clientX - dragRef.current.startX;
      let y = ev.clientY - dragRef.current.startY;
      x = Math.min(0, Math.max(cropSize - w, x));
      y = Math.min(0, Math.max(cropSize - h, y));
      setOffset({ x, y });
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleConfirm = () => {
    if (!img) return;
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const ratio = 1024 / cropSize;
    ctx.drawImage(img, offset.x * ratio, offset.y * ratio, img.width * scale * ratio, img.height * scale * ratio);
    onConfirm(canvas.toDataURL('image/jpeg', 1.0));
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1300,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ fontSize: 14, color: '#fff', fontWeight: 600, marginBottom: 16 }}>사진 위치 조정</div>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        style={{
          width: cropSize, height: cropSize, overflow: 'hidden',
          borderRadius: 16, position: 'relative', cursor: 'grab',
          border: '2px solid rgba(255,255,255,0.3)',
        }}
      >
        {img && (
          <img src={src} alt="" draggable={false} style={{
            position: 'absolute',
            left: offset.x, top: offset.y,
            width: img.width * scale, height: img.height * scale,
            pointerEvents: 'none', userSelect: 'none',
          }} />
        )}
      </div>

      {/* Scale slider */}
      {img && (
        <input type="range" min={Math.max(cropSize / img.width, cropSize / img.height)} max={Math.max(cropSize / img.width, cropSize / img.height) * 3} step={0.01}
          value={scale}
          onChange={e => {
            const newScale = Number(e.target.value);
            const w = img.width * newScale, h = img.height * newScale;
            setScale(newScale);
            setOffset(o => ({
              x: Math.min(0, Math.max(cropSize - w, o.x)),
              y: Math.min(0, Math.max(cropSize - h, o.y)),
            }));
          }}
          style={{ width: cropSize, marginTop: 16, accentColor: '#89cef5' }}
        />
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button onClick={onCancel} style={{
          padding: '12px 32px', borderRadius: 14, border: 'none',
          background: 'rgba(255,255,255,0.15)', color: '#fff',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>취소</button>
        <button onClick={handleConfirm} style={{
          padding: '12px 32px', borderRadius: 14, border: 'none',
          background: '#89cef5', color: '#fff',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>확인</button>
      </div>
    </div>
  );
}

// ===== Food Coach Card (AiInsightCard 디자인 통일) =====
function FoodCoachCard({ foods, nutrition, goal, score, lacking }) {
  // 최신 식사 찾기
  const latestFood = foods.length > 0 ? foods[foods.length - 1] : null;

  // 코칭 메시지 생성
  const messages = [];

  if (!latestFood) {
    return (
      <div style={{ margin: '0 16px 14px', padding: '20px', borderRadius: 16, background: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CoachStarIcon />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#8B95A1' }}>AI 인사이트</div>
            <div style={{ fontSize: 14, color: '#4E5968', marginTop: 4, lineHeight: 1.5 }}>
              식사를 기록하면 맞춤 코칭을 받을 수 있어요.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 기록된 끼니 분석
  const recordedMeals = [...new Set(foods.filter(f => !f.name?.startsWith('물 ')).map(f => f.meal))];
  const mealCount = recordedMeals.length;
  const allMeals = ['아침', '점심', '저녁'];
  const unrecordedMeals = allMeals.filter(m => !recordedMeals.includes(m));
  const mealBasis = mealCount > 0 ? `${recordedMeals.join('·')} 기준` : '';

  // 1단계: 오늘 먹은 음식의 좋은 점 찾기
  const positives = [];
  const foodNames = foods.filter(f => !f.name?.startsWith('물 ')).map(f => f.name).filter(Boolean);

  // 긍정 속성 확인
  const goodSkin = foods.filter(f => f.skinImpact === '좋음');
  const lowSugar = foods.filter(f => f.bloodSugar === '낮음');
  const noSleepy = foods.filter(f => f.drowsiness === '낮음');
  const goodNutrients = NUTRIENT_META.filter(n => {
    const val = nutrition[n.key] || 0;
    const goalVal = n.goalKey ? goal[n.goalKey] : 0;
    return goalVal && (val / goalVal) >= 0.7;
  }).map(n => n.label);

  if (goodSkin.length > 0) positives.push(`${goodSkin[0].name}은 피부 건강에 좋은 선택이에요`);
  if (lowSugar.length > 0 && positives.length === 0) positives.push(`${lowSugar[0].name}은 혈당에 부담이 적어요`);
  if (noSleepy.length > 0 && positives.length === 0) positives.push('식후에도 활력을 유지할 수 있는 식단이에요');
  if (goodNutrients.length >= 3 && positives.length === 0) positives.push(`${goodNutrients.slice(0, 3).join('·')} 섭취가 잘 되고 있어요`);
  if (score >= 70 && positives.length === 0) positives.push('영양 균형이 잘 맞는 식사예요');
  if (positives.length === 0 && foodNames.length > 0) positives.push(`${foodNames[foodNames.length - 1]}, 괜찮은 선택이에요`);

  // 2단계: 주의사항 (경고)
  const warnings = [];
  const kcalRatio = goal.kcal ? nutrition.kcal / goal.kcal : 0;
  if (kcalRatio > 1.2) warnings.push({ icon: '🍽️', text: `${mealBasis} 칼로리가 ${Math.round((kcalRatio - 1) * 100)}% 초과했어요.` });
  if (latestFood.bloodSugar === '높음') warnings.push({ icon: '📈', text: latestFood.bloodSugarNote || `${latestFood.name}은 혈당을 빠르게 올릴 수 있어요.` });
  if (latestFood.drowsiness === '높음') warnings.push({ icon: '😴', text: latestFood.drowsinessNote || `${latestFood.name} 식후 졸릴 수 있어요.` });
  if (latestFood.skinImpact === '주의') warnings.push({ icon: '⚠️', text: latestFood.skinImpactNote || `${latestFood.name}은 피부 트러블에 영향을 줄 수 있어요.` });

  // 3단계: 현재 시간 기준 앞으로 남은 끼니에서만 보충 제안
  const hour = new Date().getHours();
  const futureMeals = allMeals.filter(m => {
    if (m === '아침') return hour < 10;
    if (m === '점심') return hour < 14;
    if (m === '저녁') return hour < 21;
    return false;
  });
  const nextMeal = futureMeals.find(m => !recordedMeals.includes(m));
  let suggestion = '';
  if (lacking.length > 0 && nextMeal) {
    suggestion = `${nextMeal}에 ${lacking.slice(0, 2).join('·')}을 보충하면 균형이 맞아요.`;
  } else if (lacking.length > 0 && !nextMeal) {
    suggestion = `내일 아침에 ${lacking.slice(0, 2).join('·')}을 챙겨보세요.`;
  }

  // 메시지 조합: 좋은 점 → 경고 → 보충 제안
  if (positives.length > 0) {
    messages.push({ icon: '✨', text: positives[0] + (suggestion ? ` ${suggestion}` : '') });
  }
  if (warnings.length > 0) {
    messages.push(warnings[0]);
  } else if (suggestion && positives.length === 0) {
    messages.push({ icon: '💡', text: suggestion });
  }

  // 데이터 없는 기존 기록
  if (!latestFood.bloodSugar && !latestFood.drowsiness && !latestFood.skinImpact && messages.length === 0) {
    messages.push({ icon: '💡', text: `${latestFood.name} — 새로 기록하면 혈당·졸림·피부 영향까지 분석해드려요.` });
  }

  // 아무 메시지도 없으면 기본
  if (messages.length === 0) {
    messages.push({ icon: '👍', text: `${latestFood.name}, 괜찮은 선택이에요!` });
  }

  return (
    <div style={{ margin: '0 16px 14px', padding: '20px', borderRadius: 16, background: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <CoachStarIcon />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: '#8B95A1' }}>AI 인사이트</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ fontSize: 13, color: '#4E5968', lineHeight: 1.6 }}>
                <span style={{ marginRight: 6 }}>{m.icon}</span>
                {m.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CoachStarIcon() {
  return (
    <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="26" height="26" viewBox="0 0 36 36" fill="none">
        <defs>
          <linearGradient id="coach-g1" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#FFF3B0" />
            <stop offset="100%" stopColor="#FFE082" />
          </linearGradient>
          <linearGradient id="coach-g2" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#FFF9D0" />
            <stop offset="100%" stopColor="#FFF3B0" />
          </linearGradient>
        </defs>
        <path d="M18 2 L21 12 L31 15.5 L21 19 L18 29 L15 19 L5 15.5 L15 12 Z" fill="url(#coach-g1)" />
        <path d="M28 3 L29 6.5 L32.5 7.5 L29 8.5 L28 12 L27 8.5 L23.5 7.5 L27 6.5 Z" fill="url(#coach-g2)" />
        <path d="M8 24 L9 27 L12 28 L9 29 L8 32 L7 29 L4 28 L7 27 Z" fill="url(#coach-g2)" />
        <ellipse cx="15" cy="12" rx="3" ry="2" fill="white" opacity="0.3" />
      </svg>
    </div>
  );
}

// ===== Food Detail Modal =====
const filterIngredients = (list) => {
  if (!list || list.length === 0) return [];
  if (list.length < 5) return list;
  return list.filter(ing => {
    if ((ing.kcal || 0) >= 5) return true;
    const amt = ing.amount || '';
    const gMatch = amt.match(/(\d+)\s*g/);
    const mlMatch = amt.match(/(\d+)\s*ml/);
    if (gMatch && parseInt(gMatch[1]) >= 50) return true;
    if (mlMatch && parseInt(mlMatch[1]) >= 100) return true;
    return false;
  });
};

const IMPACT_STYLE = {
  '낮음': { bg: '#E8F8F0', color: '#0F6E56' },
  '보통': { bg: '#FFF8E1', color: '#F59E0B' },
  '높음': { bg: '#FBEAF0', color: '#993556' },
  '좋음': { bg: '#E8F8F0', color: '#0F6E56' },
  '주의': { bg: '#FBEAF0', color: '#993556' },
};

function FoodDetailModal({ food, onClose, onDelete }) {
  const [showConfirm, setShowConfirm] = useState(false);

  const impactItems = [
    { icon: '📈', label: '혈당 상승', value: food.bloodSugar, note: food.bloodSugarNote },
    { icon: '😴', label: '졸림 확률', value: food.drowsiness, note: food.drowsinessNote },
    { icon: '✨', label: '피부 영향', value: food.skinImpact, note: food.skinImpactNote },
  ];

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-secondary, #fff)', borderRadius: '24px 24px 0 0',
        padding: '12px 20px 40px', width: '100%', maxWidth: 430,
        maxHeight: '88vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        {/* Handle bar + back/delete buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', marginBottom: 28 }}>
          <div onClick={onClose} style={{
            position: 'absolute', left: -4, top: 0,
            width: 36, height: 36, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--bg-input, #E0E0E0)', marginTop: 10 }} />
          <div onClick={() => setShowConfirm(true)} style={{
            position: 'absolute', right: -4, top: 2,
            width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
            background: 'var(--bg-card-hover, #F2F3F5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 12h12" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Delete confirm popup */}
        {showConfirm && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1200,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={() => setShowConfirm(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: 'var(--bg-card, #fff)',
              borderRadius: 20, padding: '28px 24px',
              width: 280, textAlign: 'center',
              border: '1px solid var(--border-subtle, #eee)',
            }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>이 기록을 삭제할까요?</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>삭제된 기록은 복구할 수 없습니다.</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowConfirm(false)} style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                  background: 'var(--bg-input, #F2F3F5)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>아니오</button>
                <button onClick={() => { onDelete?.(food); setShowConfirm(false); onClose(); }} style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                  background: '#e05545', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>삭제</button>
              </div>
            </div>
          </div>
        )}

        {/* Photo + Name header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          {food.photo ? (
            <FoodPhoto photo={food.photo} style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(137,206,245,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🍽️</div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{food.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{food.meal}</div>
          </div>
        </div>

        {/* Nutrition grid */}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>영양 정보</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          {[
            { icon: '🔥', label: '칼로리', value: food.kcal, unit: 'kcal' },
            { icon: '🥩', label: '단백질', value: food.protein, unit: 'g' },
            { icon: '🍞', label: '탄수화물', value: food.carb, unit: 'g' },
            { icon: '🥑', label: '지방', value: food.fat, unit: 'g' },
          ].map(n => (
            <div key={n.label} style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 12 }}>
              <div style={{ fontSize: 16, marginBottom: 4 }}>{n.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 400, color: 'rgba(0,0,0,0.7)' }}>{n.label}</div>
              <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.5)', marginTop: 2 }}>{n.value}<span>{n.unit}</span></div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
          {[
            { icon: '🥕', label: '식이섬유', value: food.fiber || 0, unit: 'g' },
            { icon: '🥦', label: '철분', value: food.iron || 0, unit: 'mg' },
            { icon: '🐟', label: '칼슘', value: food.calcium || 0, unit: 'mg' },
            { icon: '🍯', label: '당류', value: food.sugar || 0, unit: 'g' },
          ].map(n => (
            <div key={n.label} style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 12 }}>
              <div style={{ fontSize: 16, marginBottom: 4 }}>{n.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 400, color: 'rgba(0,0,0,0.7)' }}>{n.label}</div>
              <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.5)', marginTop: 2 }}>{n.value}<span>{n.unit}</span></div>
            </div>
          ))}
        </div>

        {/* Ingredients breakdown */}
        {filterIngredients(food.ingredients).length > 0 && (() => {
          const filtered = filterIngredients(food.ingredients);
          return (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>재료 구성</div>
            <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--bg-card)', marginBottom: 20 }}>
              {filtered.map((ing, i) => (
                <div key={i} style={{
                  padding: '8px 0', borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{ing.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-primary)' }}>{ing.kcal}kcal</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ing.amount}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>탄<span style={{ fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 2 }}>{ing.carb}g</span></span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>단<span style={{ fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 2 }}>{ing.protein}g</span></span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>지<span style={{ fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 2 }}>{ing.fat}g</span></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
          );
        })()}

        {/* Impact analysis */}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>식후 영향 분석</div>
        {(food.bloodSugar || food.drowsiness || food.skinImpact) ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {impactItems.filter(i => i.value).map(item => {
              const s = IMPACT_STYLE[item.value] || IMPACT_STYLE['보통'];
              return (
                <div key={item.label} style={{
                  padding: '14px 16px', borderRadius: 14,
                  background: 'var(--bg-card)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.icon} {item.label}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8,
                      background: s.bg, color: s.color,
                    }}>{item.value}</span>
                  </div>
                  {item.note && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.note}</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            padding: '16px', borderRadius: 14, background: 'var(--bg-card)',
            fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 20, lineHeight: 1.6,
          }}>
            이전 방식으로 기록된 식사예요.<br />새로 기록하면 혈당·졸림·피부 영향까지 분석해드려요.
          </div>
        )}

      </div>
    </div>
  );
}

// ===== Skin Insights Section =====
function SkinInsightsSection({ onMeasure }) {
  const records = getRecords();
  const changes = getChanges();
  const totalChanges = getTotalChanges();

  if (records.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>아직 피부 기록이 없어요</div>
        <div style={{ fontSize: 12, marginTop: 6, marginBottom: 16 }}>피부 측정을 시작하면 분석을 확인할 수 있어요</div>
        <button onClick={() => onMeasure && onMeasure()} style={{
          padding: '12px 28px', borderRadius: 14, border: 'none',
          background: 'var(--accent-primary)', color: '#fff',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>첫 기록하기</button>
      </div>
    );
  }

  const latest = records[records.length - 1];
  const overallDiff = totalChanges?.overallScore || 0;
  const skinAgeDiff = totalChanges?.skinAge || 0;
  const period = totalChanges?.period || 0;

  const scoreR = 24, scoreCirc = 2 * Math.PI * scoreR;
  const scoreDash = scoreCirc * (latest.overallScore / 100);

  const metrics = [
    { key: 'moisture', label: '수분도', icon: '💧', grad: ['#D4F0FF', '#A8DEFF'] },
    { key: 'oilBalance', label: '유분', icon: '🫧', grad: ['#FEF3C7', '#FCD34D'] },
    { key: 'skinTone', label: '피부톤', icon: '✨', grad: ['#FFF3C7', '#FFE082'] },
    { key: 'wrinkleScore', label: '주름', icon: '📐', grad: ['#F5E6D8', '#E8C8B0'] },
    { key: 'poreScore', label: '모공', icon: '🔬', grad: ['#E8D8C8', '#D0C0A8'] },
    { key: 'elasticityScore', label: '탄력', icon: '💎', grad: ['#e2f2fc', '#89cef5'] },
    { key: 'darkCircleScore', label: '다크서클', icon: '👁️', grad: ['#E8E0F0', '#C8B8E8'] },
  ];

  const improved = changes ? Object.values(changes).filter(c => c.improved && Math.abs(c.diff) >= 2) : [];
  const worsened = changes ? Object.values(changes).filter(c => !c.improved && Math.abs(c.diff) >= 2) : [];

  // AI insight message
  let insightMsg = '';
  if (worsened.length > 0) {
    const worst = worsened.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];
    insightMsg = `${worst.label}이 ${Math.abs(worst.diff)}점 하락했어요. 집중 관리가 필요해요.`;
  } else if (improved.length > 0) {
    insightMsg = `${improved[0].label} 등 ${improved.length}개 지표가 개선 중이에요!`;
  } else {
    insightMsg = `종합 ${latest.overallScore}점 — 꾸준한 관리로 더 좋아질 수 있어요.`;
  }

  return (
    <div style={{ animation: 'breatheIn 0.5s ease both' }}>
      {/* Score Card */}
      <div style={{
        margin: '0 16px 10px', borderRadius: 16, padding: 13,
        background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ position: 'relative', width: 62, height: 62, flexShrink: 0 }}>
          <svg viewBox="0 0 62 62" style={{ width: 62, height: 62 }}>
            <circle cx="31" cy="31" r={scoreR} fill="none" stroke="#F0EDE8" strokeWidth="6" />
            {latest.overallScore > 0 && <circle cx="31" cy="31" r={scoreR} fill="none" stroke="var(--accent-primary)" strokeWidth="6"
              strokeLinecap="round" strokeDasharray={`${scoreDash} ${scoreCirc - scoreDash}`} transform="rotate(-90 31 31)" />}
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--accent-primary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>{latest.overallScore}</span>
            <span style={{ fontSize: 9, color: '#888' }}>점</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
            피부나이 {latest.skinAge}세 {skinAgeDiff !== 0 && <span style={{ fontSize: 11, color: skinAgeDiff < 0 ? '#89cef5' : '#f87171' }}>{skinAgeDiff < 0 ? '▼' : '▲'}{Math.abs(skinAgeDiff)}세</span>}
          </div>
          <div style={{ fontSize: 10, color: '#888', lineHeight: 1.5, marginTop: 3 }}>
            {overallDiff !== 0 ? `종합 ${overallDiff > 0 ? '+' : ''}${overallDiff}점 ${period > 0 ? `(${period}일간)` : ''}` : '꾸준히 측정하면 변화를 추적할 수 있어요'}
          </div>
        </div>
      </div>

      {/* Metric Cards — 5 columns */}
      <div style={{
        margin: '0 16px 10px', borderRadius: 16, padding: '12px 8px',
        background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
        display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
      }}>
        {metrics.map(m => {
          const val = latest[m.key];
          if (val == null) return null;
          const change = changes?.[m.key];
          return (
            <div key={m.key} style={{ flex: '0 0 18%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 8,
                background: `linear-gradient(135deg, ${m.grad[0]}, ${m.grad[1]})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
              }}>{m.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{val}</div>
              <div style={{ fontSize: 8, color: '#888' }}>{m.label}</div>
              {change && Math.abs(change.diff) >= 1 ? (
                <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 6, background: change.improved ? '#E8F8F0' : '#FBEAF0', color: change.improved ? '#0F6E56' : '#993556' }}>
                  {change.diff > 0 ? '+' : ''}{change.diff}
                </span>
              ) : (
                <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 6, background: '#f5f5f5', color: '#aaa' }}>—</span>
              )}
            </div>
          );
        })}
      </div>

      {/* AI Insight */}
      <div style={{ margin: '0 16px 14px', padding: '20px', borderRadius: 16, background: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CoachStarIcon />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#8B95A1' }}>AI 인사이트</div>
            <div style={{ fontSize: 14, color: '#4E5968', marginTop: 4, lineHeight: 1.5 }}>{insightMsg}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Body Insights Section =====
function BodyInsightsSection() {
  const [records, setRecords] = useState(getBodyRecords);
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [newWeight, setNewWeight] = useState('');

  const latest = records.length > 0 ? records[records.length - 1] : null;
  const start = records.length > 0 ? records[0] : null;
  const goal = getBodyGoal();
  const profile = getBodyProfile();
  const bmi = latest ? calcBMI(latest.weight, profile.height) : null;
  const weightDiff = (start && latest) ? (latest.weight - start.weight).toFixed(1) : 0;
  const recent = [...records].reverse().slice(0, 7);

  const handleAdd = () => {
    const w = parseFloat(newWeight);
    if (!w || w < 20 || w > 300) return;
    saveBodyRecord(w);
    setRecords(getBodyRecords());
    setShowAddWeight(false);
    setNewWeight('');
  };

  const handleDelete = (date) => {
    if (!confirm('이 기록을 삭제할까요?')) return;
    deleteBodyRecord(date);
    setRecords(getBodyRecords());
  };

  if (!latest) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>아직 바디 기록이 없어요</div>
        <div style={{ fontSize: 12, marginTop: 6, marginBottom: 16 }}>체중을 기록하면 변화를 추적할 수 있어요</div>
        <button onClick={() => setShowAddWeight(true)} style={{
          padding: '12px 28px', borderRadius: 14, border: 'none',
          background: 'var(--accent-primary)', color: '#fff',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>첫 기록하기</button>
        {showAddWeight && <WeightInputModal value={newWeight} onChange={setNewWeight} onConfirm={handleAdd} onClose={() => setShowAddWeight(false)} />}
      </div>
    );
  }

  const scoreR = 24, scoreCirc = 2 * Math.PI * scoreR;
  const bmiNum = parseFloat(bmi) || 0;
  const bmiPct = Math.min(100, Math.max(0, ((bmiNum - 15) / 20) * 100));
  const bmiDash = scoreCirc * (bmiPct / 100);
  const bmiLabel = bmiNum < 18.5 ? '저체중' : bmiNum < 23 ? '정상' : bmiNum < 25 ? '과체중' : '비만';

  // ===== Body Insights 분석 =====
  const today = new Date();
  const daysAgo = (n) => {
    const d = new Date(today); d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const recordsByDate = Object.fromEntries(records.map(r => [r.date, r.weight]));
  const allDates = records.map(r => r.date).sort();
  const firstDate = allDates[0];
  const daysTracking = firstDate ? Math.max(1, Math.round((today - new Date(firstDate)) / 86400000) + 1) : 0;

  // 최근 7일/14일 평균
  const recentN = (n) => {
    const cutoff = daysAgo(n);
    return records.filter(r => r.date >= cutoff).map(r => r.weight);
  };
  const last7 = recentN(6);
  const last14 = recentN(13);
  const avg7 = last7.length > 0 ? (last7.reduce((a, b) => a + b, 0) / last7.length) : null;
  const avg14 = last14.length > 0 ? (last14.reduce((a, b) => a + b, 0) / last14.length) : null;

  // 7일 변화 (최근7일 평균 - 그 이전7일 평균)
  const prev7 = records.filter(r => r.date >= daysAgo(13) && r.date < daysAgo(6)).map(r => r.weight);
  const prev7Avg = prev7.length > 0 ? (prev7.reduce((a, b) => a + b, 0) / prev7.length) : null;
  const weeklyChange = (avg7 != null && prev7Avg != null) ? (avg7 - prev7Avg) : null;

  // 변동성 (표준편차) - 최근 14일
  const volatility = (() => {
    if (last14.length < 2) return null;
    const mean = last14.reduce((a, b) => a + b, 0) / last14.length;
    const variance = last14.reduce((s, v) => s + (v - mean) ** 2, 0) / last14.length;
    return Math.sqrt(variance);
  })();

  // 최저/최고
  const minWeight = records.length > 0 ? Math.min(...records.map(r => r.weight)) : null;
  const maxWeight = records.length > 0 ? Math.max(...records.map(r => r.weight)) : null;

  // 목표 진척도
  let goalProgress = null;
  let goalRemaining = null;
  let goalETA = null;
  if (goal && latest && start) {
    const totalGap = start.weight - goal;
    const currentGap = latest.weight - goal;
    if (Math.abs(totalGap) > 0.01) {
      goalProgress = Math.max(0, Math.min(100, ((totalGap - currentGap) / totalGap) * 100));
    }
    goalRemaining = (latest.weight - goal).toFixed(1);
    // 주간 변화량으로 ETA 계산 (감량 방향이 일치할 때만)
    if (weeklyChange != null && Math.abs(weeklyChange) > 0.1) {
      const dirMatch = (totalGap > 0 && weeklyChange < 0) || (totalGap < 0 && weeklyChange > 0);
      if (dirMatch) {
        const weeksToGoal = Math.abs(currentGap / weeklyChange);
        goalETA = Math.round(weeksToGoal);
      }
    }
  }

  // 스마트 인사이트 메시지
  let bodyInsight = '';
  if (records.length === 1) {
    bodyInsight = '첫 기록을 시작했어요! 일주일 이상 꾸준히 기록하면 변화 패턴이 보여요.';
  } else if (weeklyChange != null) {
    const wcAbs = Math.abs(weeklyChange).toFixed(1);
    if (volatility != null && volatility > 1.5) {
      bodyInsight = `최근 변동이 ±${volatility.toFixed(1)}kg로 큰 편이에요. 같은 시간(아침 공복)에 측정하면 더 정확해요.`;
    } else if (Math.abs(weeklyChange) < 0.2) {
      bodyInsight = `지난주 대비 거의 변화가 없어요(${weeklyChange > 0 ? '+' : ''}${wcAbs}kg). 안정적으로 유지 중입니다.`;
    } else if (weeklyChange < 0) {
      bodyInsight = `지난주 대비 ${wcAbs}kg 감소했어요. 건강한 감량 속도(주 0.5~1kg)인지 점검해보세요.`;
    } else {
      bodyInsight = `지난주 대비 ${wcAbs}kg 증가했어요. 식단·수분·수면을 함께 살펴볼 시점이에요.`;
    }
  } else if (goal) {
    bodyInsight = `목표 ${goal}kg 설정됨. 일주일 더 기록하면 도달 예상 시기를 알려드릴게요.`;
  } else {
    bodyInsight = '꾸준히 기록하면 주간 변화 트렌드를 분석해드려요.';
  }

  return (
    <div style={{ animation: 'breatheIn 0.5s ease both' }}>
      {/* Weight + BMI + Stats Card (merged) */}
      <div style={{
        margin: '0 16px 10px', borderRadius: 16, padding: 13,
        background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              {latest.weight}kg · {bmiLabel}
            </div>
            <div style={{ fontSize: 10, color: '#888', lineHeight: 1.5, marginTop: 3 }}>
              {goal ? `목표 ${goal}kg · 시작 대비 ${weightDiff > 0 ? '+' : ''}${weightDiff}kg` : `시작 대비 ${weightDiff > 0 ? '+' : ''}${weightDiff}kg`}
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '12px 0 10px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
          {[
            { label: '현재', value: `${latest.weight}`, unit: 'kg' },
            { label: '시작', value: `${start.weight}`, unit: 'kg' },
            { label: '변화', value: `${weightDiff > 0 ? '+' : ''}${weightDiff}`, unit: 'kg' },
            { label: '기록', value: `${records.length}`, unit: '회' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{s.value}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>{s.unit}</span></div>
              <div style={{ fontSize: 9, color: '#888' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Records */}
      <div style={{ margin: '0 16px 10px', borderRadius: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>최근 기록</div>
        {recent.map(r => {
          const d = new Date(r.date);
          const isToday = r.date === new Date().toISOString().slice(0, 10);
          return (
            <div key={r.date} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #f5f5f5' }}>
              <span style={{ fontSize: 12, color: isToday ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: isToday ? 600 : 400 }}>
                {isToday ? '오늘' : `${d.getMonth() + 1}/${d.getDate()}`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.weight}kg</span>
                <button onClick={() => handleDelete(r.date)} style={{ background: 'none', border: 'none', color: '#ccc', fontSize: 14, cursor: 'pointer', padding: '0 2px' }}>×</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== Body Insights Card ===== */}
      <div style={{ margin: '0 16px 14px', padding: '16px 18px', borderRadius: 16, background: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <CoachStarIcon />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>몸무게 인사이트</span>
        </div>

        {/* 메트릭 그리드 (2x2) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {/* 7일 변화 */}
          <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>지난주 대비</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: weeklyChange == null ? '#bbb' : weeklyChange < -0.1 ? '#0F6E56' : weeklyChange > 0.1 ? '#C2185B' : 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              {weeklyChange == null ? '—' : `${weeklyChange > 0 ? '+' : ''}${weeklyChange.toFixed(1)}`}
              <span style={{ fontSize: 10, fontWeight: 400, color: '#999', marginLeft: 2 }}>kg</span>
            </div>
          </div>

          {/* 7일 평균 */}
          <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>최근 7일 평균</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              {avg7 == null ? '—' : avg7.toFixed(1)}
              <span style={{ fontSize: 10, fontWeight: 400, color: '#999', marginLeft: 2 }}>kg</span>
            </div>
          </div>

          {/* 변동성 */}
          <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>변동성 (14일)</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              {volatility == null ? '—' : `±${volatility.toFixed(1)}`}
              <span style={{ fontSize: 10, fontWeight: 400, color: '#999', marginLeft: 2 }}>kg</span>
            </div>
          </div>

          {/* 최저/최고 */}
          <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>최저 · 최고</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              {minWeight == null ? '—' : `${minWeight.toFixed(1)} · ${maxWeight.toFixed(1)}`}
              <span style={{ fontSize: 10, fontWeight: 400, color: '#999', marginLeft: 2 }}>kg</span>
            </div>
          </div>
        </div>

        {/* 목표 진척도 (목표 설정 시) */}
        {goal && goalProgress != null && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#888' }}>목표 {goal}kg 진척도</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-primary)' }}>
                {goalProgress.toFixed(0)}%{goalETA != null && goalETA > 0 && ` · 약 ${goalETA}주 후`}
              </span>
            </div>
            <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${goalProgress}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: 3, transition: 'width 0.3s ease' }} />
            </div>
            <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
              남은 거리 {Math.abs(goalRemaining)}kg · 시작 {start.weight}kg → 현재 {latest.weight}kg → 목표 {goal}kg
            </div>
          </div>
        )}

        {/* 스마트 인사이트 메시지 */}
        <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(137,206,245,0.12)', border: '1px solid rgba(137,206,245,0.2)' }}>
          <div style={{ fontSize: 12, color: '#4E5968', lineHeight: 1.5 }}>{bodyInsight}</div>
        </div>

        {/* 푸터 메타 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 10, color: '#aaa' }}>
          <span>기록 시작 {daysTracking}일째</span>
          <span>총 {records.length}회 측정</span>
        </div>
      </div>

      {/* Weight Input Modal */}
      {showAddWeight && <WeightInputModal value={newWeight} onChange={setNewWeight} onConfirm={handleAdd} onClose={() => setShowAddWeight(false)} />}
    </div>
  );
}

function WeightInputModal({ value, onChange, onConfirm, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0',
        padding: '24px 24px 36px', width: '100%', maxWidth: 420,
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>오늘 체중</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input type="number" value={value} onChange={e => onChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onConfirm()}
            placeholder="예: 65.5" step="0.1"
            style={{
              flex: 1, padding: '14px 16px', borderRadius: 14, border: 'none',
              background: 'var(--bg-input, #F2F3F5)', fontSize: 16, fontWeight: 600,
              color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none',
            }}
            autoFocus
          />
          <span style={{ display: 'flex', alignItems: 'center', fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>kg</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '14px 0', borderRadius: 14, border: 'none',
            background: 'var(--bg-input, #F2F3F5)', color: 'var(--text-muted)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>취소</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '14px 0', borderRadius: 14, border: 'none',
            background: 'var(--accent-primary)', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>저장</button>
        </div>
      </div>
    </div>
  );
}
