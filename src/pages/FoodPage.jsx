import { useState, useCallback, useRef, useEffect } from 'react';
import { getTodayFoods, getTodayNutrition, getFoodRecords, getNutritionForDate, getTimeAdjustedGoal, getFoodGoal, saveFoodRecord, deleteFoodRecord } from '../storage/FoodStorage';
import WeekDateHeader from '../components/WeekDateHeader';
import { getRecords, getChanges, getTotalChanges, getAllThumbnailsAsync } from '../storage/SkinStorage';
import { getBodyRecords, getLatestWeight, getStartWeight, getBodyGoal, getBodyProfile, calcBMI, saveBodyRecord, deleteBodyRecord } from '../storage/BodyStorage';

const fadeUp = (delay = 0) => ({ animation: `breatheIn 0.5s ease ${delay}s both` });
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
  { key: 'protein', icon: NutrientIcons.protein, label: '단백질', unit: 'g', goalKey: 'protein', grad: ['#FDE8EC', '#F9CDD5'] },
  { key: 'carb', icon: NutrientIcons.carb, label: '탄수화물', unit: 'g', goalKey: 'carb', grad: ['#FFF6E0', '#FAEAC0'] },
  { key: 'vitamin', icon: NutrientIcons.vitamin, label: '비타민', unit: '%', goalKey: 'vitamin', grad: ['#FFFBE0', '#FBF0A0'] },
  { key: 'mineral', icon: NutrientIcons.mineral, label: '미네랄', unit: '%', goalKey: 'mineral', grad: ['#E8F4FF', '#D8EEFF'] },
  { key: 'kcal', icon: NutrientIcons.kcal, label: '칼로리', unit: '', goalKey: 'kcal', grad: ['#FFF0EC', '#FFCEC0'] },
];

function getStatus(value, goal) {
  if (!goal || !value) return '부족';
  const ratio = value / goal;
  if (ratio < 0.7) return '부족';
  if (ratio > 1.2) return '과잉';
  return '적정';
}

const statusStyle = {
  '적정': { background: '#E8F8F0', color: '#0F6E56' },
  '부족': { background: '#FBEAF0', color: '#993556' },
  '과잉': { background: '#FFF3E0', color: '#E65100' },
};

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

export default function FoodPage({ onTabChange }) {
  const [foodTab, setFoodTab] = useState('food');
  const today = new Date();
  const todayStr = getDateKey(today);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const isToday = selectedDate === todayStr;
  const [foods, setFoods] = useState(() => getFoodRecords(selectedDate));
  const [nutrition, setNutrition] = useState(() => getNutritionForDate(selectedDate));
  const goal = isToday ? getTimeAdjustedGoal() : { ...getFoodGoal(), _ratio: 1, _mealLabel: '하루' };
  const [showAdd, setShowAdd] = useState(false);
  const [addMeal, setAddMeal] = useState(null);
  const [detailFood, setDetailFood] = useState(null);
  const [showMealPicker, setShowMealPicker] = useState(false);

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
  const [headerTitle, setHeaderTitle] = useState('');

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)', fontFamily: 'Pretendard, sans-serif' }}>{headerTitle}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Weekly Date Header */}
      <WeekDateHeader
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
        hideTitle
        onTitleChange={setHeaderTitle}
      />

      {/* Category Tabs */}
      <div style={{ padding: '12px 20px 16px' }}>
        <div className="segment-control">
          <button className={`segment-btn${foodTab === 'skin' ? ' active' : ''}`}
            onClick={() => setFoodTab('skin')}>피부</button>
          <button className={`segment-btn${foodTab === 'food' ? ' active' : ''}`}
            onClick={() => setFoodTab('food')}>식단</button>
          <button className={`segment-btn${foodTab === 'body' ? ' active' : ''}`}
            onClick={() => setFoodTab('body')}>바디</button>
        </div>
      </div>

      {/* Skin Insights */}
      {foodTab === 'skin' && <SkinInsightsSection />}

      {/* Food content */}
      {foodTab === 'food' && <>
      {/* Date subtitle */}
      <div style={{ padding: '0 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
            display: 'flex', gap: 8, margin: '0 16px 12px',
            overflowX: slots.length > 3 ? 'auto' : 'hidden',
            ...fadeUp(0.05),
          }}>
            {slots.map((slot, idx) => slot.type === 'food' ? (
              <div key={slot.food.id} onClick={() => setDetailFood(slot.food)} style={{
                flex: slots.length <= 3 ? '1' : undefined,
                width: slots.length > 3 ? 'calc((100% - 16px) / 3)' : undefined,
                aspectRatio: '1/1', borderRadius: 14, overflow: 'hidden', flexShrink: 0,
                background: 'var(--accent-primary)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                position: 'relative', cursor: 'pointer',
              }}>
                {slot.food.photo ? (
                  <img src={slot.food.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                ) : null}
                <div style={{
                  fontSize: 9, color: '#fff', fontWeight: 600, padding: '3px 6px',
                  background: 'rgba(0,0,0,0.35)', borderRadius: '0 0 14px 14px', width: '100%', textAlign: 'center',
                  position: 'relative', zIndex: 1,
                }}>{slot.food.name?.slice(0, 8)}</div>
              </div>
            ) : (
              <div key={slot.key} onClick={() => setShowMealPicker(true)} style={{
                flex: slots.length <= 3 ? '1' : undefined,
                width: slots.length > 3 ? 'calc((100% - 16px) / 3)' : undefined,
                aspectRatio: '1/1', borderRadius: 14, flexShrink: 0,
                border: '1.5px dashed var(--accent-primary)',
                background: 'rgba(129,228,189,0.08)',
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
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>언제 먹었나요?</div>
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

      {/* 3. Diet Score Card */}
      <div style={{
        margin: '0 16px 10px', borderRadius: 16, padding: 13,
        background: '#fff', border: '0.5px solid #eee',
        display: 'flex', alignItems: 'center', gap: 14,
        ...fadeUp(0.1),
      }}>
        <div style={{ position: 'relative', width: 62, height: 62, flexShrink: 0 }}>
          <svg viewBox="0 0 62 62" style={{ width: 62, height: 62 }}>
            <defs>
              <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#81E4BD" />
                <stop offset="100%" stopColor="#81E4BD" />
              </linearGradient>
            </defs>
            <circle cx="31" cy="31" r={r} fill="none" stroke="#F0EDE8" strokeWidth="6" />
            {score > 0 && <circle cx="31" cy="31" r={r} fill="none" stroke="url(#scoreGrad)" strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${dashFill} ${circ - dashFill}`}
              transform="rotate(-90 31 31)"
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />}
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>{score}</span>
            <span style={{ fontSize: 9, color: '#888' }}>점</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{getScoreComment(score)}</div>
          <div style={{ fontSize: 10, color: '#888', lineHeight: 1.5, marginTop: 3 }}>
            {score > 0 ? `오늘 ${nutrition.kcal}kcal 섭취 · 목표 대비 ${Math.round((nutrition.kcal / goal.kcal) * 100)}%` : '식사를 기록하면 점수가 계산돼요'}
          </div>
        </div>
      </div>

      {/* 4. Nutrient Card */}
      <div style={{
        margin: '0 16px 10px', borderRadius: 16, padding: '12px 8px',
        background: '#fff', border: '0.5px solid #eee',
        display: 'flex', justifyContent: 'space-between',
        ...fadeUp(0.15),
      }}>
        {nutrients.map(n => (
          <div key={n.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: `linear-gradient(135deg, ${n.grad[0]}88, ${n.grad[1]}44)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{n.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{n.displayVal}</div>
            <div style={{ fontSize: 9, color: '#888' }}>{n.label}</div>
            <span style={{
              fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 8,
              ...statusStyle[n.status],
            }}>{n.status}</span>
          </div>
        ))}
      </div>

      {/* 5. LUA AI Coach Card — AiInsightCard 디자인 통일 */}
      <FoodCoachCard foods={foods} nutrition={nutrition} goal={goal} score={score} lacking={lacking} />

      </>}

      {/* Body content */}
      {foodTab === 'body' && <BodyInsightsSection />}

      {/* Add Food Modal */}
      {showAdd && <AddFoodModal onAdd={handleAddFood} onClose={() => { setShowAdd(false); setAddMeal(null); }} initialMeal={addMeal} />}

      {/* Food Detail Modal */}
      {detailFood && <FoodDetailModal food={detailFood} onClose={() => setDetailFood(null)} onDelete={handleDeleteFood} />}
    </div>
  );
}

function AddFoodModal({ onAdd, onClose, initialMeal }) {
  const [name, setName] = useState('');
  const [meal, setMeal] = useState(initialMeal || '아침');
  const [servings, setServings] = useState(1);
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const fileRef = useRef(null);
  const albumRef = useRef(null);
  const contentRef = useRef(null);
  const nameInputRef = useRef(null);
  const [cropSrc, setCropSrc] = useState(null);

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

  const getThumb = () => {
    if (!preview) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 120; canvas.height = 120;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.src = preview;
      ctx.drawImage(img, 0, 0, 120, 120);
      return canvas.toDataURL('image/jpeg', 0.6);
    } catch { return preview; }
  };

  const handleAnalyze = async () => {
    if (!name.trim()) return;
    setAnalyzing(true);
    setAiResult(null);
    try {
      const res = await fetch('/api/food-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), servings }),
      });
      if (res.ok) {
        const result = await res.json();
        setAiResult(result);
      }
    } catch (err) {}
    setAnalyzing(false);
  };

  const handleSubmit = () => {
    if (!aiResult) return;
    const thumb = getThumb();
    onAdd({
      name: aiResult.name, meal, photo: thumb,
      kcal: aiResult.kcal || 0,
      carb: aiResult.carb || 0,
      protein: aiResult.protein || 0,
      fat: aiResult.fat || 0,
      vitamin: aiResult.vitamin || 0,
      mineral: aiResult.mineral || 0,
      bloodSugar: aiResult.bloodSugar || '',
      bloodSugarNote: aiResult.bloodSugarNote || '',
      drowsiness: aiResult.drowsiness || '',
      drowsinessNote: aiResult.drowsinessNote || '',
      skinImpact: aiResult.skinImpact || '',
      skinImpactNote: aiResult.skinImpactNote || '',
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
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>식사 기록</div>

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

        {/* Photo buttons */}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
        <input ref={albumRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={() => fileRef.current?.click()} style={{
            flex: 1, padding: '14px 0', borderRadius: 14, border: 'none',
            background: 'rgba(129,228,189,0.12)',
            color: 'var(--accent-primary)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#81E4BD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="13" r="3" stroke="#81E4BD" strokeWidth="1.5" />
            </svg>
            사진 촬영
          </button>
          <button onClick={() => albumRef.current?.click()} style={{
            flex: 1, padding: '14px 0', borderRadius: 14, border: 'none',
            background: 'var(--bg-input, #F2F3F5)',
            color: 'var(--text-secondary)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit',
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

        {/* Food name input + servings + analyze button */}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>음식 이름</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            ref={nameInputRef}
            value={name}
            onChange={e => { setName(e.target.value); setAiResult(null); }}
            onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
            onFocus={() => setTimeout(() => nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
            placeholder="예: 연어포케, 불고기김밥"
            style={{ ...inputStyle, flex: 1 }}
          />
          <select
            value={servings}
            onChange={e => { setServings(Number(e.target.value)); setAiResult(null); }}
            style={{
              width: 64, padding: '10px 4px', borderRadius: 12, border: 'none',
              background: 'var(--bg-input, #F2F3F5)', fontSize: 13,
              color: 'var(--text-primary)', fontFamily: 'inherit', textAlign: 'center',
              outline: 'none',
            }}
          >
            {[0.5, 0.8, 1, 1.5, 2].map(n => (
              <option key={n} value={n}>{n}인분</option>
            ))}
          </select>
        </div>

        {/* Analyze button */}
        <button onClick={handleAnalyze} disabled={analyzing || !name.trim()} style={{
          width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
          background: analyzing ? 'var(--bg-input, #F2F3F5)' : 'rgba(129,228,189,0.15)',
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

        {/* AI Result */}
        {aiResult && (
          <div style={{
            padding: '14px 16px', borderRadius: 14, marginBottom: 16,
            background: 'rgba(129,228,189,0.08)', border: '1px solid rgba(129,228,189,0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 13 }}>✨</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{aiResult.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{aiResult.servings || servings}인분</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              {[
                { label: '칼로리', value: `${aiResult.kcal}`, unit: 'kcal', color: '#81E4BD' },
                { label: '탄수화물', value: `${aiResult.carb}`, unit: 'g', color: '#93C5FD' },
                { label: '단백질', value: `${aiResult.protein}`, unit: 'g', color: '#D1FAE5' },
              ].map(n => (
                <div key={n.label} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 10, background: '#fff' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{n.value}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>{n.unit}</span></div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{n.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: '지방', value: `${aiResult.fat}`, unit: 'g' },
                { label: '비타민', value: `${aiResult.vitamin || 0}`, unit: '%' },
                { label: '미네랄', value: `${aiResult.mineral || 0}`, unit: '%' },
              ].map(n => (
                <div key={n.label} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 10, background: '#fff' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{n.value}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>{n.unit}</span></div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{n.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Buttons */}
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
            fontSize: 14, fontWeight: 700,
            cursor: aiResult ? 'pointer' : 'default', fontFamily: 'inherit',
          }}>추가</button>
        </div>

        {/* Crop Modal */}
        {cropSrc && <PhotoCropModal src={cropSrc} onConfirm={(cropped) => { setPreview(cropped); setCropSrc(null); }} onCancel={() => setCropSrc(null)} />}
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
    canvas.width = 600; canvas.height = 600;
    const ctx = canvas.getContext('2d');
    const ratio = 600 / cropSize;
    ctx.drawImage(img, offset.x * ratio, offset.y * ratio, img.width * scale * ratio, img.height * scale * ratio);
    onConfirm(canvas.toDataURL('image/jpeg', 0.85));
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
          style={{ width: cropSize, marginTop: 16, accentColor: '#81E4BD' }}
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
          background: '#81E4BD', color: '#fff',
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
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
      <div style={{ margin: '0 16px 14px', padding: '20px', borderRadius: 16, background: '#f9f9f9' }}>
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

  // 우선순위별 후보 생성 (주의/경고 > 긍정 > 보통)
  const all = [];

  // 1. 과식 여부 (가장 중요)
  const kcalRatio = goal.kcal ? nutrition.kcal / goal.kcal : 0;
  if (kcalRatio > 1.2) {
    all.push({ priority: 1, icon: '🍽️', text: `${latestFood.name} — ${goal._mealLabel} 기준 칼로리 ${Math.round((kcalRatio - 1) * 100)}% 초과. 다음 끼니는 가볍게 드세요.` });
  }

  // 2. 혈당 상승
  if (latestFood.bloodSugar === '높음') {
    all.push({ priority: 1, icon: '📈', text: latestFood.bloodSugarNote || `${latestFood.name}은 혈당을 빠르게 올려요. 식이섬유와 함께 드세요.` });
  } else if (latestFood.bloodSugar === '낮음') {
    all.push({ priority: 3, icon: '📉', text: `${latestFood.name}은 혈당에 부담이 적어요. 좋은 선택!` });
  }

  // 3. 졸림 확률
  if (latestFood.drowsiness === '높음') {
    all.push({ priority: 1, icon: '😴', text: latestFood.drowsinessNote || `${latestFood.name} 식후 졸릴 수 있어요. 가벼운 산책을 추천해요.` });
  } else if (latestFood.drowsiness === '낮음') {
    all.push({ priority: 3, icon: '⚡', text: `식후에도 활력이 유지될 거예요.` });
  }

  // 4. 피부 트러블
  if (latestFood.skinImpact === '주의') {
    all.push({ priority: 1, icon: '⚠️', text: latestFood.skinImpactNote || `${latestFood.name}은 피부 트러블에 영향을 줄 수 있어요.` });
  } else if (latestFood.skinImpact === '좋음') {
    all.push({ priority: 3, icon: '✨', text: latestFood.skinImpactNote || `${latestFood.name}은 피부 건강에 도움이 돼요!` });
  }

  // 5. 영양소 균형
  if (lacking.length > 0) {
    all.push({ priority: 2, icon: '⚖️', text: `${lacking.join(', ')}이 부족해요. 다음 식사에서 보충해보세요.` });
  } else if (score >= 70) {
    all.push({ priority: 3, icon: '⚖️', text: `영양 균형이 잘 맞아요! 이 패턴을 유지하세요.` });
  }

  // 우선순위 정렬 후 상위 1~2개 선택
  all.sort((a, b) => a.priority - b.priority);
  const picked = all.slice(0, all.some(m => m.priority === 1) ? 2 : 1);
  picked.forEach(m => messages.push(m));

  // 데이터 없는 기존 기록
  if (!latestFood.bloodSugar && !latestFood.drowsiness && !latestFood.skinImpact && messages.length === 0) {
    messages.push({ icon: '💡', text: `${latestFood.name} — 새로 기록하면 혈당·졸림·피부 영향까지 분석해드려요.` });
  }

  // 아무 메시지도 없으면 기본
  if (messages.length === 0) {
    messages.push({ icon: '👍', text: `${latestFood.name}, 괜찮은 선택이에요!` });
  }

  return (
    <div style={{ margin: '0 16px 14px', padding: '20px', borderRadius: 16, background: '#f9f9f9' }}>
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
            position: 'absolute', left: -4, top: 2,
            width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
            background: 'var(--bg-card-hover, #F2F3F5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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
            <img src={food.photo} alt="" style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(129,228,189,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🍽️</div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{food.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{food.meal}</div>
          </div>
        </div>

        {/* Nutrition grid */}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>영양 정보</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          {[
            { label: '칼로리', value: food.kcal, unit: 'kcal' },
            { label: '탄수화물', value: food.carb, unit: 'g' },
            { label: '단백질', value: food.protein, unit: 'g' },
          ].map(n => (
            <div key={n.label} style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 12, background: 'var(--bg-card)' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{n.value}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>{n.unit}</span></div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{n.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
          {[
            { label: '지방', value: food.fat, unit: 'g' },
            { label: '비타민', value: food.vitamin || 0, unit: '%' },
            { label: '미네랄', value: food.mineral || 0, unit: '%' },
          ].map(n => (
            <div key={n.label} style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 12, background: 'var(--bg-card)' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{n.value}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>{n.unit}</span></div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{n.label}</div>
            </div>
          ))}
        </div>

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
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8,
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
function SkinInsightsSection() {
  const records = getRecords();
  const changes = getChanges();
  const totalChanges = getTotalChanges();

  if (records.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>아직 피부 기록이 없어요</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>피부 측정을 시작하면 분석을 확인할 수 있어요</div>
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
    { key: 'elasticityScore', label: '탄력', icon: '💎', grad: ['#D1FAE5', '#81E4BD'] },
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
        background: '#fff', border: '0.5px solid #eee',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ position: 'relative', width: 62, height: 62, flexShrink: 0 }}>
          <svg viewBox="0 0 62 62" style={{ width: 62, height: 62 }}>
            <circle cx="31" cy="31" r={scoreR} fill="none" stroke="#F0EDE8" strokeWidth="6" />
            {latest.overallScore > 0 && <circle cx="31" cy="31" r={scoreR} fill="none" stroke="var(--accent-primary)" strokeWidth="6"
              strokeLinecap="round" strokeDasharray={`${scoreDash} ${scoreCirc - scoreDash}`} transform="rotate(-90 31 31)" />}
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>{latest.overallScore}</span>
            <span style={{ fontSize: 9, color: '#888' }}>점</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
            피부나이 {latest.skinAge}세 {skinAgeDiff !== 0 && <span style={{ fontSize: 11, color: skinAgeDiff < 0 ? '#34d399' : '#f87171' }}>{skinAgeDiff < 0 ? '▼' : '▲'}{Math.abs(skinAgeDiff)}세</span>}
          </div>
          <div style={{ fontSize: 10, color: '#888', lineHeight: 1.5, marginTop: 3 }}>
            {overallDiff !== 0 ? `종합 ${overallDiff > 0 ? '+' : ''}${overallDiff}점 ${period > 0 ? `(${period}일간)` : ''}` : '꾸준히 측정하면 변화를 추적할 수 있어요'}
          </div>
        </div>
      </div>

      {/* Metric Cards — 5 columns */}
      <div style={{
        margin: '0 16px 10px', borderRadius: 16, padding: '12px 8px',
        background: '#fff', border: '0.5px solid #eee',
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
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{val}</div>
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
      <div style={{ margin: '0 16px 14px', padding: '20px', borderRadius: 16, background: '#f9f9f9' }}>
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

  // AI insight
  let bodyInsight = '';
  if (goal && latest) {
    const diff = (latest.weight - goal).toFixed(1);
    bodyInsight = diff > 0 ? `목표까지 ${diff}kg 남았어요. 꾸준히 관리하세요!` : `목표 체중을 달성했어요! 유지가 중요해요.`;
  } else if (records.length >= 2) {
    bodyInsight = `시작 대비 ${weightDiff > 0 ? '+' : ''}${weightDiff}kg 변화. ${Math.abs(weightDiff) < 0.5 ? '안정적으로 유지 중이에요.' : weightDiff < 0 ? '감량이 진행되고 있어요!' : '식단 조절이 필요할 수 있어요.'}`;
  } else {
    bodyInsight = '꾸준히 기록하면 체중 변화 트렌드를 분석해드려요.';
  }

  return (
    <div style={{ animation: 'breatheIn 0.5s ease both' }}>
      {/* Weight + BMI Card */}
      <div style={{
        margin: '0 16px 10px', borderRadius: 16, padding: 13,
        background: '#fff', border: '0.5px solid #eee',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ position: 'relative', width: 62, height: 62, flexShrink: 0 }}>
          <svg viewBox="0 0 62 62" style={{ width: 62, height: 62 }}>
            <circle cx="31" cy="31" r={scoreR} fill="none" stroke="#F0EDE8" strokeWidth="6" />
            <circle cx="31" cy="31" r={scoreR} fill="none" stroke="var(--accent-primary)" strokeWidth="6"
              strokeLinecap="round" strokeDasharray={`${bmiDash} ${scoreCirc - bmiDash}`} transform="rotate(-90 31 31)" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>{bmi}</span>
            <span style={{ fontSize: 8, color: '#888' }}>BMI</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
            {latest.weight}kg · {bmiLabel}
          </div>
          <div style={{ fontSize: 10, color: '#888', lineHeight: 1.5, marginTop: 3 }}>
            {goal ? `목표 ${goal}kg · 시작 대비 ${weightDiff > 0 ? '+' : ''}${weightDiff}kg` : `시작 대비 ${weightDiff > 0 ? '+' : ''}${weightDiff}kg`}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{
        margin: '0 16px 10px', borderRadius: 16, padding: '12px 8px',
        background: '#fff', border: '0.5px solid #eee',
        display: 'flex', justifyContent: 'space-between',
      }}>
        {[
          { label: '현재', value: `${latest.weight}`, unit: 'kg' },
          { label: '시작', value: `${start.weight}`, unit: 'kg' },
          { label: '변화', value: `${weightDiff > 0 ? '+' : ''}${weightDiff}`, unit: 'kg' },
          { label: '기록', value: `${records.length}`, unit: '회' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{s.value}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>{s.unit}</span></div>
            <div style={{ fontSize: 9, color: '#888' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Records */}
      <div style={{ margin: '0 16px 10px', borderRadius: 16, padding: '12px 16px', background: '#fff', border: '0.5px solid #eee' }}>
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

      {/* Add button */}
      <div style={{ margin: '0 16px 10px' }}>
        <button onClick={() => setShowAddWeight(true)} style={{
          width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
          background: 'rgba(129,228,189,0.15)', color: 'var(--accent-primary)',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>+ 오늘 체중 기록</button>
      </div>

      {/* AI Insight */}
      <div style={{ margin: '0 16px 14px', padding: '20px', borderRadius: 16, background: '#f9f9f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CoachStarIcon />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#8B95A1' }}>AI 인사이트</div>
            <div style={{ fontSize: 14, color: '#4E5968', marginTop: 4, lineHeight: 1.5 }}>{bodyInsight}</div>
          </div>
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
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>오늘 체중</div>
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
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>저장</button>
        </div>
      </div>
    </div>
  );
}
