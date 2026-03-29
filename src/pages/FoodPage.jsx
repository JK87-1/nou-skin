import { useState, useCallback, useRef } from 'react';
import { getTodayFoods, getTodayNutrition, getFoodGoal, saveFoodRecord, deleteFoodRecord } from '../storage/FoodStorage';
import { compressImage } from '../engine/PixelAnalysis';

const fadeUp = (delay = 0) => ({ animation: `breatheIn 0.5s ease ${delay}s both` });
const MEAL_LABELS = ['아침', '점심', '저녁', '간식'];
const MEAL_GRADIENTS = [
  'linear-gradient(135deg, #F9E84A, #FFB347)',
  'linear-gradient(135deg, #FFB347, #FF8FAB)',
  'linear-gradient(135deg, #FF8FAB, #F9E84A)',
  'linear-gradient(135deg, #F9E84A, #FF8FAB)',
];

export default function FoodPage() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const [foods, setFoods] = useState(getTodayFoods);
  const [nutrition, setNutrition] = useState(getTodayNutrition);
  const goal = getFoodGoal();
  const [showAdd, setShowAdd] = useState(false);
  const [waterCount, setWaterCount] = useState(() => {
    const foods = getTodayFoods();
    return foods.reduce((s, f) => s + (f.water || 0), 0);
  });

  const refresh = useCallback(() => {
    setFoods(getTodayFoods());
    setNutrition(getTodayNutrition());
  }, []);

  const handleAddFood = useCallback((food) => {
    saveFoodRecord(dateStr, food);
    refresh();
    setShowAdd(false);
  }, [dateStr, refresh]);

  const handleDelete = useCallback((id) => {
    deleteFoodRecord(dateStr, id);
    refresh();
  }, [dateStr, refresh]);

  const handleAddWater = useCallback(() => {
    saveFoodRecord(dateStr, { name: '물 1잔', meal: '간식', kcal: 0, carb: 0, protein: 0, fat: 0, water: 0.25 });
    setWaterCount(w => w + 0.25);
    refresh();
  }, [dateStr, refresh]);

  const kcalPct = Math.min(1, nutrition.kcal / goal.kcal);
  const dashTotal = 2 * Math.PI * 44;
  const dashFill = dashTotal * kcalPct;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ padding: '24px 24px 16px' }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>식단 분석</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          오늘 {today.getMonth() + 1}월 {today.getDate()}일
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Calorie Ring */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 16px', ...fadeUp(0.05) }}>
          <div style={{ position: 'relative', width: 120, height: 120 }}>
            <svg viewBox="0 0 100 100" style={{ width: 120, height: 120 }}>
              <defs>
                <linearGradient id="kcalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#F9E84A" />
                  <stop offset="50%" stopColor="#FFB347" />
                  <stop offset="100%" stopColor="#FF8FAB" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="44" fill="none" stroke="var(--bar-track)" strokeWidth="8" />
              <circle cx="50" cy="50" r="44" fill="none" stroke="url(#kcalGrad)" strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${dashFill} ${dashTotal - dashFill}`}
                strokeDashoffset={dashTotal * 0.25}
                transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                {nutrition.kcal.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>/ {goal.kcal.toLocaleString()} kcal</div>
            </div>
          </div>
        </div>

        {/* Macro Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, ...fadeUp(0.1) }}>
          <MacroBox label="탄수화물" value={`${nutrition.carb}g`} color="#C9A800" />
          <MacroBox label="단백질" value={`${nutrition.protein}g`} color="#C4580A" />
          <MacroBox label="지방" value={`${nutrition.fat}g`} color="#C2185B" />
          <MacroBox label="수분" value={`${waterCount.toFixed(1)}L`} color="var(--text-muted)" onTap={handleAddWater} />
        </div>

        {/* Today's Food List */}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: '24px 0 10px', ...fadeUp(0.15) }}>
          오늘 먹은 것
        </div>

        {foods.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '32px 0', color: 'var(--text-dim)',
            fontSize: 13, ...fadeUp(0.2),
          }}>
            아직 기록이 없어요
          </div>
        ) : (
          <div style={fadeUp(0.2)}>
            {foods.filter(f => !f.name?.startsWith('물 ')).map((food, i) => (
              <div key={food.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 0',
                borderBottom: '0.5px solid var(--border-separator)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: MEAL_GRADIENTS[MEAL_LABELS.indexOf(food.meal) % MEAL_GRADIENTS.length],
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{food.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{food.meal}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#C4580A', flexShrink: 0 }}>{food.kcal}</div>
                <button onClick={() => handleDelete(food.id)} style={{
                  background: 'none', border: 'none', color: 'var(--text-dim)',
                  fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
                }}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Add Button */}
        <div style={{ marginTop: 16, ...fadeUp(0.25) }}>
          <button onClick={() => setShowAdd(true)} style={{
            width: '100%', padding: '14px 0',
            background: 'linear-gradient(120deg, #F9E84A, #FFB347, #FF8FAB)',
            border: 'none', borderRadius: 'var(--btn-radius)',
            fontSize: 14, fontWeight: 600,
            color: '#7A3800', cursor: 'pointer', fontFamily: 'inherit',
          }}>식사 기록 추가</button>
        </div>
      </div>

      {/* Add Food Modal */}
      {showAdd && <AddFoodModal onAdd={handleAddFood} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function MacroBox({ label, value, color, onTap }) {
  return (
    <div onClick={onTap} style={{
      background: 'var(--bg-card)', borderRadius: 'var(--card-border-radius)',
      padding: '14px 16px', cursor: onTap ? 'pointer' : 'default',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color, marginTop: 4, fontFamily: 'var(--font-display)' }}>
        {value}
      </div>
      {onTap && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>탭하여 +1잔</div>}
    </div>
  );
}

function AddFoodModal({ onAdd, onClose }) {
  const [name, setName] = useState('');
  const [meal, setMeal] = useState('아침');
  const [kcal, setKcal] = useState('');
  const [carb, setCarb] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [aiItems, setAiItems] = useState(null);
  const [extraInput, setExtraInput] = useState('');
  const [extraServings, setExtraServings] = useState(1);
  const [extraLooking, setExtraLooking] = useState(false);
  const [extraItems, setExtraItems] = useState([]);
  const fileRef = useRef(null);

  // Merge all items for totals
  const allItems = [...(aiItems || []), ...extraItems];

  const updateTotals = (items) => {
    setName(items.map(i => i.name).join(', '));
    setKcal(String(items.reduce((s, i) => s + i.kcal, 0)));
    setCarb(String(items.reduce((s, i) => s + i.carb, 0)));
    setProtein(String(items.reduce((s, i) => s + i.protein, 0)));
    setFat(String(items.reduce((s, i) => s + i.fat, 0)));
  };

  const handleSubmit = () => {
    if (allItems.length > 0) {
      allItems.forEach(item => {
        onAdd({ name: item.name, meal, kcal: item.kcal, carb: item.carb, protein: item.protein, fat: item.fat, water: 0 });
      });
      return;
    }
    if (!name.trim() || !kcal) return;
    onAdd({
      name: name.trim(), meal,
      kcal: Number(kcal) || 0,
      carb: Number(carb) || 0,
      protein: Number(protein) || 0,
      fat: Number(fat) || 0,
      water: 0,
    });
  };

  const handleExtraAdd = async () => {
    if (!extraInput.trim()) return;
    setExtraLooking(true);
    try {
      const res = await fetch('/api/food-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: extraInput.trim(), servings: extraServings }),
      });
      if (res.ok) {
        const result = await res.json();
        const newExtra = [...extraItems, { name: result.name, kcal: result.kcal, carb: result.carb, protein: result.protein, fat: result.fat }];
        setExtraItems(newExtra);
        updateTotals([...(aiItems || []), ...newExtra]);
        setExtraInput('');
        setExtraServings(1);
      }
    } catch (err) {}
    setExtraLooking(false);
  };

  const removeExtra = (idx) => {
    const newExtra = extraItems.filter((_, i) => i !== idx);
    setExtraItems(newExtra);
    updateTotals([...(aiItems || []), ...newExtra]);
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);

    setAnalyzing(true);
    setAiItems(null);
    try {
      // Compress and convert to base64
      const dataUrl = await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = (ev) => resolve(ev.target.result);
        r.readAsDataURL(file);
      });
      const compressed = await compressImage(dataUrl, 800);
      const base64 = compressed.split(',')[1];

      const res = await fetch('/api/food-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.notFood) {
          setAnalyzing(false);
          return;
        }
        if (result.items?.length > 0) {
          setAiItems(result.items);
          updateTotals([...result.items, ...extraItems]);
        }
      }
    } catch (err) {
      // Silently fail — user can fill manually
    }
    setAnalyzing(false);
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
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0',
        padding: '24px 24px 40px', width: '100%', maxWidth: 420,
      }}>
        {/* Handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />

        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>식사 기록</div>

        {/* Meal selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {MEAL_LABELS.map(m => (
            <button key={m} onClick={() => setMeal(m)} style={{
              flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
              background: meal === m ? 'linear-gradient(120deg, #F9E84A, #FFB347, #FF8FAB)' : 'var(--bg-input, #F2F3F5)',
              color: meal === m ? '#7A3800' : 'var(--text-muted)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>{m}</button>
          ))}
        </div>

        {/* Photo button */}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()} disabled={analyzing} style={{
          width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
          background: analyzing ? 'var(--bg-input, #F2F3F5)' : 'linear-gradient(135deg, rgba(249,232,74,0.15), rgba(255,179,71,0.12), rgba(255,143,171,0.12))',
          color: analyzing ? 'var(--text-muted)' : '#C4580A',
          fontSize: 13, fontWeight: 600, cursor: analyzing ? 'default' : 'pointer',
          fontFamily: 'inherit', marginBottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {analyzing ? (
            <>분석 중...</>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#C4580A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="3" stroke="#C4580A" strokeWidth="1.5" />
              </svg>
              식단 사진으로 자동 분석
            </>
          )}
        </button>

        {/* Photo preview */}
        {preview && (
          <div style={{ marginBottom: 12, borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
            <img src={preview} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
            {analyzing && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 13, fontWeight: 600,
              }}>AI 분석 중...</div>
            )}
          </div>
        )}

        {/* AI detected items */}
        {aiItems && aiItems.length > 0 && (
          <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 12, background: 'rgba(249,232,74,0.1)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#C4580A', marginBottom: 6 }}>AI 분석 결과</div>
            {aiItems.map((item, idx) => (
              <div key={idx} style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                {item.name} — {item.kcal}kcal (탄{item.carb}g · 단{item.protein}g · 지{item.fat}g)
              </div>
            ))}
          </div>
        )}

        {/* Extra food input */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
            {allItems.length > 0 ? '추가 음식 입력' : '음식 이름으로 검색'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              value={extraInput}
              onChange={e => setExtraInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleExtraAdd()}
              placeholder="예: 메밀소바, 김치찌개"
              style={{ ...inputStyle, flex: 1 }}
            />
            <select
              value={extraServings}
              onChange={e => setExtraServings(Number(e.target.value))}
              style={{
                width: 64, padding: '10px 4px', borderRadius: 12, border: 'none',
                background: 'var(--bg-input, #F2F3F5)', fontSize: 13,
                color: 'var(--text-primary)', fontFamily: 'inherit', textAlign: 'center',
                outline: 'none',
              }}
            >
              {[0.5, 1, 1.5, 2, 3].map(n => (
                <option key={n} value={n}>{n}인분</option>
              ))}
            </select>
            <button onClick={handleExtraAdd} disabled={extraLooking || !extraInput.trim()} style={{
              padding: '10px 14px', borderRadius: 12, border: 'none',
              background: extraLooking ? 'var(--bg-input)' : 'linear-gradient(120deg, #F9E84A, #FFB347)',
              color: '#7A3800', fontSize: 13, fontWeight: 600,
              cursor: extraLooking ? 'default' : 'pointer', fontFamily: 'inherit',
              flexShrink: 0,
            }}>{extraLooking ? '...' : '추가'}</button>
          </div>

          {/* Extra items list */}
          {extraItems.length > 0 && (
            <div style={{ padding: '8px 12px', borderRadius: 12, background: 'rgba(255,179,71,0.08)', marginBottom: 4 }}>
              {extraItems.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                    {item.name} — {item.kcal}kcal
                  </span>
                  <button onClick={() => removeExtra(idx)} style={{
                    background: 'none', border: 'none', color: 'var(--text-dim)',
                    fontSize: 14, cursor: 'pointer', padding: '0 4px',
                  }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total summary */}
        {allItems.length > 0 && (
          <div style={{
            padding: '12px 16px', borderRadius: 12, marginBottom: 12,
            background: 'linear-gradient(135deg, rgba(249,232,74,0.1), rgba(255,179,71,0.08), rgba(255,143,171,0.08))',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#C4580A', marginBottom: 4 }}>합계</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {kcal}kcal
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                탄{carb}g · 단{protein}g · 지{fat}g
              </span>
            </div>
          </div>
        )}

        {/* Manual input (hidden when items exist, shown as fallback) */}
        {allItems.length === 0 && <>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="음식 이름" style={{ ...inputStyle, marginBottom: 10 }} />
          <input value={kcal} onChange={e => setKcal(e.target.value)} placeholder="칼로리 (kcal)" type="number" style={{ ...inputStyle, marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input value={carb} onChange={e => setCarb(e.target.value)} placeholder="탄수화물(g)" type="number" style={inputStyle} />
            <input value={protein} onChange={e => setProtein(e.target.value)} placeholder="단백질(g)" type="number" style={inputStyle} />
            <input value={fat} onChange={e => setFat(e.target.value)} placeholder="지방(g)" type="number" style={inputStyle} />
          </div>
        </>}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
            border: 'none', background: 'var(--bg-input, #F2F3F5)',
            color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>취소</button>
          <button onClick={handleSubmit} style={{
            flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
            border: 'none', background: 'linear-gradient(120deg, #F9E84A, #FFB347, #FF8FAB)',
            color: '#7A3800', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>추가</button>
        </div>
      </div>
    </div>
  );
}
