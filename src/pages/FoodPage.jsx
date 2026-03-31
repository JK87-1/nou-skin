import { useState, useCallback, useRef, useEffect } from 'react';
import { getTodayFoods, getTodayNutrition, getFoodGoal, saveFoodRecord, deleteFoodRecord } from '../storage/FoodStorage';
import { getRecords, getChanges, getTotalChanges } from '../storage/SkinStorage';

const fadeUp = (delay = 0) => ({ animation: `breatheIn 0.5s ease ${delay}s both` });
const MEAL_LABELS = ['아침', '점심', '저녁'];
const MEAL_GRADIENTS = [
  'var(--accent-primary)',
  'var(--accent-primary)',
  'var(--accent-primary)',
  'var(--accent-primary)',
];

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const NUTRIENT_META = [
  { key: 'protein', icon: '🥩', label: '단백질', unit: 'g', goalKey: 'protein', grad: ['#D1FAE5', '#81E4BD'] },
  { key: 'carb', icon: '🍚', label: '탄수화물', unit: 'g', goalKey: 'carb', grad: ['#E0F2FE', '#93C5FD'] },
  { key: 'vitamin', icon: '⭐', label: '비타민', unit: '%', goalKey: 'vitamin', grad: ['#FEF3C7', '#FCD34D'] },
  { key: 'mineral', icon: '💎', label: '미네랄', unit: '%', goalKey: 'mineral', grad: ['#D4F0FF', '#74C0FC'] },
  { key: 'kcal', icon: '⚡', label: '칼로리', unit: '', goalKey: 'kcal', grad: ['#E0F2FE', '#81E4BD'] },
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

export default function FoodPage({ onTabChange }) {
  const [foodTab, setFoodTab] = useState('food');
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const [foods, setFoods] = useState(getTodayFoods);
  const [nutrition, setNutrition] = useState(getTodayNutrition);
  const goal = getFoodGoal();
  const [showAdd, setShowAdd] = useState(false);
  const [addMeal, setAddMeal] = useState(null);
  const [coachMsg, setCoachMsg] = useState(null);

  const refresh = useCallback(() => {
    setFoods(getTodayFoods());
    setNutrition(getTodayNutrition());
  }, []);

  const handleAddFood = useCallback((food) => {
    saveFoodRecord(dateStr, food);
    refresh();
    setShowAdd(false);
    setAddMeal(null);
  }, [dateStr, refresh]);

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

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>분석</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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

      {/* Spacer — matches HistoryPage profile header height */}
      <div style={{ height: 118 }} />

      {/* Category Tabs */}
      <div style={{ padding: '12px 20px 16px' }}>
        <div className="segment-control">
          <button className={`segment-btn${foodTab === 'skin' ? ' active' : ''}`}
            onClick={() => setFoodTab('skin')}>피부</button>
          <button className={`segment-btn${foodTab === 'food' ? ' active' : ''}`}
            onClick={() => setFoodTab('food')}>식단</button>
          <button className={`segment-btn${foodTab === 'body' ? ' active' : ''}`}
            onClick={() => onTabChange?.('body')}>바디</button>
        </div>
      </div>

      {/* Skin Insights */}
      {foodTab === 'skin' && <SkinInsightsSection />}

      {/* Food content */}
      {foodTab === 'food' && <>
      {/* Date subtitle */}
      <div style={{ padding: '0 16px 8px' }}>
        <div style={{ fontSize: 11, color: '#888' }}>
          {today.getFullYear()}년 {today.getMonth() + 1}월 {today.getDate()}일 {DAY_NAMES[today.getDay()]}요일
        </div>
      </div>

      {/* 2. Meal Thumbnail Row */}
      <div style={{ display: 'flex', gap: 8, margin: '0 16px 12px', ...fadeUp(0.05) }}>
        {MEAL_LABELS.map(meal => {
          const items = mealFoods[meal];
          if (items.length > 0) {
            return (
              <div key={meal} onClick={() => { setAddMeal(meal); setShowAdd(true); }} style={{
                flex: 1, height: 72, borderRadius: 14, overflow: 'hidden',
                background: MEAL_GRADIENTS[MEAL_LABELS.indexOf(meal)],
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                position: 'relative', cursor: 'pointer',
              }}>
                {items[0].photo ? (
                  <img src={items[0].photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                ) : null}
                <div style={{
                  fontSize: 10, color: '#fff', fontWeight: 600, padding: '3px 8px',
                  background: 'rgba(0,0,0,0.35)', borderRadius: '0 0 14px 14px', width: '100%', textAlign: 'center',
                  position: 'relative', zIndex: 1,
                }}>{items.map(f => f.name?.slice(0, 6)).join(', ')}</div>
              </div>
            );
          }
          return (
            <div key={meal} onClick={() => { setAddMeal(meal); setShowAdd(true); }} style={{
              flex: 1, height: 72, borderRadius: 14,
              border: '1.5px dashed var(--accent-primary)',
              background: 'rgba(129,228,189,0.08)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              cursor: 'pointer',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 11,
                background: 'var(--accent-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: '#fff', fontSize: 15, lineHeight: 1 }}>+</span>
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{meal}</span>
            </div>
          );
        })}
      </div>

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
              width: 24, height: 24, borderRadius: 8,
              background: `linear-gradient(135deg, ${n.grad[0]}, ${n.grad[1]})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13,
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

      {/* 5. LUA AI Coach Card */}
      <div style={{
        margin: '0 16px 14px', borderRadius: 16, padding: '12px 14px',
        background: 'var(--bg-card)',
        ...fadeUp(0.2),
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 12,
            background: 'rgba(129,228,189,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13,
          }}>✨</div>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>LUA AI 코치</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {coachMsg || (lacking.length > 0
            ? `${lacking.join(', ')}이(가) 부족해요. ${lacking.includes('단백질') ? '닭가슴살이나 두부를 추가해보세요.' : '과일이나 채소를 더 먹어보세요.'}`
            : score > 0 ? '오늘 식단 균형이 좋아요! 이 패턴을 유지해보세요.' : '식사를 기록하면 맞춤 코칭을 받을 수 있어요.'
          )}
        </div>
      </div>

      </>}

      {/* Add Food Modal */}
      {showAdd && <AddFoodModal onAdd={handleAddFood} onClose={() => { setShowAdd(false); setAddMeal(null); }} initialMeal={addMeal} />}
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
      water: 0,
    });
  };

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);
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
  const first = records[0];
  const overallDiff = totalChanges?.overallScore || 0;
  const skinAgeDiff = totalChanges?.skinAge || 0;
  const period = totalChanges?.period || 0;

  const metrics = [
    { key: 'moisture', label: '수분도', icon: '💧' },
    { key: 'oilBalance', label: '유분', icon: '🫧' },
    { key: 'skinTone', label: '피부톤', icon: '✨' },
    { key: 'wrinkleScore', label: '주름', icon: '📐' },
    { key: 'poreScore', label: '모공', icon: '🔬' },
    { key: 'elasticityScore', label: '탄력', icon: '💎' },
    { key: 'darkCircleScore', label: '다크서클', icon: '👁️' },
  ];

  return (
    <div style={{ padding: '8px 20px', animation: 'breatheIn 0.5s ease both' }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>종합 점수</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', marginTop: 4 }}>
            {latest.overallScore}<span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 400 }}>점</span>
          </div>
          {overallDiff !== 0 && (
            <div style={{ fontSize: 11, color: overallDiff > 0 ? '#34d399' : '#f87171', marginTop: 4 }}>
              {overallDiff > 0 ? '▲' : '▼'} {Math.abs(overallDiff)}점 {period > 0 ? `(${period}일)` : ''}
            </div>
          )}
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>피부 나이</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', marginTop: 4 }}>
            {latest.skinAge}<span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 400 }}>세</span>
          </div>
          {skinAgeDiff !== 0 && (
            <div style={{ fontSize: 11, color: skinAgeDiff < 0 ? '#34d399' : '#f87171', marginTop: 4 }}>
              {skinAgeDiff < 0 ? '▼' : '▲'} {Math.abs(skinAgeDiff)}세
            </div>
          )}
        </div>
      </div>

      {/* Metric bars */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>항목별 분석</div>
      {metrics.map(m => {
        const val = latest[m.key];
        if (val == null) return null;
        const change = changes?.[m.key];
        return (
          <div key={m.key} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.icon} {m.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{val}</span>
                {change && Math.abs(change.diff) >= 1 && (
                  <span style={{ fontSize: 10, color: change.improved ? '#34d399' : '#f87171' }}>
                    {change.diff > 0 ? '+' : ''}{change.diff}
                  </span>
                )}
              </div>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'var(--bar-track)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3, width: `${Math.min(100, val)}%`,
                background: 'var(--accent-primary)',
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        );
      })}

      {/* Recent timeline */}
      {changes && (() => {
        const improved = Object.values(changes).filter(c => c.improved && Math.abs(c.diff) >= 2);
        const worsened = Object.values(changes).filter(c => !c.improved && Math.abs(c.diff) >= 2);
        if (improved.length === 0 && worsened.length === 0) return null;
        return (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>최근 변화</div>
            {improved.map(c => (
              <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.label} +{Math.abs(c.diff)}점 향상</span>
              </div>
            ))}
            {worsened.map(c => (
              <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.label} {c.diff}점 하락</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
