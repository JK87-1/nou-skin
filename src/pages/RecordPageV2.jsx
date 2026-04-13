import { useState, useCallback, useEffect } from 'react';
import { getFoodRecords, getNutritionForDate, saveFoodRecord, deleteFoodRecord } from '../storage/FoodStorage';

const fadeUp = (delay = 0) => ({ animation: `breatheIn 0.5s ease ${delay}s both` });

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function getDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const RECORD_STORAGE_KEY = 'lua_record_v2';

function loadDayRecord(dateKey) {
  try {
    const all = JSON.parse(localStorage.getItem(RECORD_STORAGE_KEY) || '{}');
    return all[dateKey] || null;
  } catch { return null; }
}

function saveDayRecord(dateKey, data) {
  try {
    const all = JSON.parse(localStorage.getItem(RECORD_STORAGE_KEY) || '{}');
    all[dateKey] = data;
    localStorage.setItem(RECORD_STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

const EXERCISES = [
  { id: 'walk',   icon: '🚶', name: '산책' },
  { id: 'run',    icon: '🏃', name: '달리기' },
  { id: 'weight', icon: '💪', name: '근력' },
  { id: 'yoga',   icon: '🧘', name: '요가' },
  { id: 'cycle',  icon: '🚴', name: '사이클' },
  { id: 'custom', icon: '➕', name: '직접 입력' },
];

const SLEEP_QUALITIES = ['깊은 수면', '보통', '얕은 수면'];
const TOTAL_CUPS = 8;

export default function RecordPageV2() {
  const today = new Date();
  const todayStr = getDateKey(today);

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [showCal, setShowCal] = useState(false);
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const isToday = selectedDate === todayStr;

  // Food data from existing storage
  const [foods, setFoods] = useState(() => getFoodRecords(todayStr));
  const [nutrition, setNutrition] = useState(() => getNutritionForDate(todayStr));

  // Exercise state
  const [selectedExercise, setSelectedExercise] = useState(null);

  // Sleep state
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState(null);

  // Water state
  const [waterCount, setWaterCount] = useState(0);

  // Load saved record for date
  const loadDataForDate = useCallback((dateKey) => {
    setFoods(getFoodRecords(dateKey));
    setNutrition(getNutritionForDate(dateKey));
    const saved = loadDayRecord(dateKey);
    if (saved) {
      setSelectedExercise(saved.exercise?.type || null);
      setSleepHours(saved.sleep?.hours ?? 7);
      setSleepQuality(saved.sleep?.quality || null);
      setWaterCount(saved.water?.cups ?? 0);
    } else {
      setSelectedExercise(null);
      setSleepHours(7);
      setSleepQuality(null);
      setWaterCount(0);
    }
  }, []);

  useEffect(() => {
    loadDataForDate(selectedDate);
  }, [selectedDate, loadDataForDate]);

  const handleSelectDate = useCallback((dateKey) => {
    setSelectedDate(dateKey);
    setShowCal(false);
  }, []);

  const todayMeals = foods.filter(f => !f.name?.startsWith('물 '));
  const totalKcal = Math.round(nutrition.kcal || 0);

  const dateObj = new Date(selectedDate + 'T00:00:00');
  const dateLabel = isToday ? '오늘' : `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일`;
  const fullDateStr = `${dateObj.getFullYear()}. ${String(dateObj.getMonth() + 1).padStart(2, '0')}. ${String(dateObj.getDate()).padStart(2, '0')}  ${DAY_NAMES[dateObj.getDay()]}요일`;

  // Save handler
  const handleSave = () => {
    const record = {
      date: selectedDate,
      exercise: selectedExercise ? { type: selectedExercise } : null,
      sleep: { hours: sleepHours, quality: sleepQuality },
      water: { cups: waterCount },
    };
    saveDayRecord(selectedDate, record);
  };

  // Summary values
  const summaryItems = [
    { icon: '🍽', value: todayMeals.length > 0 ? `${todayMeals.length}끼` : '—', label: '식단' },
    { icon: '🏃', value: selectedExercise || '—', label: '운동' },
    { icon: '😴', value: `${sleepHours}h`, label: '수면' },
    { icon: '💧', value: waterCount > 0 ? `${waterCount}잔` : '—', label: '수분' },
  ];

  const cardStyle = {
    background: 'rgba(255,255,255,.72)',
    borderRadius: 18, padding: '14px 15px',
    border: '0.5px solid rgba(255,255,255,.95)',
    marginBottom: 10,
  };

  const cardHeader = (iconBg, title, status, statusColor = '#5AAABB') => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
          {title === '식단' ? '🍽' : title === '운동·산책' ? '🏃' : title === '수면' ? '😴' : '💧'}
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>{title}</span>
      </div>
      <span style={{ fontSize: 11, color: statusColor, fontWeight: 500 }}>{status}</span>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 80 }}>
      {/* ===== 1. Header ===== */}
      <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', ...fadeUp(0) }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, color: '#1A3A4A' }}>기록</div>
          <div style={{ fontSize: 10, color: '#5A9AAA', marginTop: 2 }}>{fullDateStr}</div>
          <div onClick={() => setShowCal(!showCal)} style={{
            marginTop: 6, background: 'rgba(255,255,255,.6)', border: '0.5px solid rgba(100,180,220,.2)',
            borderRadius: 99, padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3A8AAA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span style={{ fontSize: 10, color: '#3A8AAA', fontWeight: 500 }}>{dateLabel}</span>
            <span style={{ fontSize: 8, color: '#3A8AAA' }}>▾</span>
          </div>
        </div>
        {isToday && (
          <div style={{
            width: 30, height: 30, borderRadius: 10, background: 'rgba(255,255,255,.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="#5A9AAA" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>

      {/* Calendar Popup */}
      {showCal && (() => {
        const firstDay = new Date(calYear, calMonth, 1).getDay();
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
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
                const isFuture = dateStr > todayStr;
                const isSelected = dateStr === selectedDate;
                const isTodayDate = dateStr === todayStr;
                return (
                  <div key={day} onClick={() => { if (!isFuture) handleSelectDate(dateStr); }}
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

      {/* Not today notice */}
      {!isToday && (
        <div style={{ margin: '0 18px 8px', padding: '8px 14px', borderRadius: 10, background: 'rgba(100,180,220,.08)', textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: '#5A9AAA' }}>{dateObj.getMonth() + 1}월 {dateObj.getDate()}일 기록 보기</span>
        </div>
      )}

      <div style={{ padding: '0 14px' }}>
        {/* ===== 2. Summary Bar ===== */}
        <div style={{
          background: 'rgba(255,255,255,.65)', borderRadius: 14, padding: '10px 13px',
          border: '0.5px solid rgba(255,255,255,.9)', marginBottom: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          ...fadeUp(0.05),
        }}>
          {summaryItems.map((item, idx) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {idx > 0 && <div style={{ width: 0.5, height: 28, background: 'rgba(100,180,220,.2)', marginRight: 0 }} />}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 50 }}>
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1A3A4A', marginTop: 1 }}>{item.value}</span>
                <span style={{ fontSize: 9, color: '#7AAABB' }}>{item.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ===== 3. Food Card ===== */}
        <div style={{ ...cardStyle, ...fadeUp(0.1) }}>
          {cardHeader('linear-gradient(135deg, #FFE8A0, #FFD070)', '식단',
            todayMeals.length > 0 ? `${todayMeals.length}끼 기록됨` : '미기록',
            todayMeals.length > 0 ? '#5AAABB' : '#9ABBC8'
          )}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {todayMeals.slice(0, 5).map((food, i) => (
              <div key={food.id || i} style={{
                width: 52, height: 52, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
                background: 'linear-gradient(135deg, #FFF3D0, #FFE8A0)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {food.photo ? (
                  <img src={food.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 20 }}>🍽</span>
                )}
              </div>
            ))}
            {isToday && (
              <div style={{
                width: 52, height: 52, borderRadius: 10, flexShrink: 0,
                border: '1.5px dashed rgba(100,180,220,.4)', background: 'rgba(100,180,220,.06)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', gap: 2,
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: 'rgba(100,180,220,.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 11, color: '#5A9AAA', lineHeight: 1 }}>+</span>
                </div>
                <span style={{ fontSize: 8, color: '#7AAABB' }}>추가</span>
              </div>
            )}
          </div>
          {totalKcal > 0 && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: '#1A3A4A' }}>{totalKcal.toLocaleString()} kcal</span>
              {nutrition.protein > 0 && (
                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 99, background: 'rgba(100,180,220,.12)', color: '#4A8AAA' }}>
                  단백질 {Math.round(nutrition.protein)}g
                </span>
              )}
              {nutrition.carb > 0 && (
                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 99, background: 'rgba(255,190,70,.15)', color: '#B08000' }}>
                  탄수화물 {Math.round(nutrition.carb)}g
                </span>
              )}
            </div>
          )}
        </div>

        {/* ===== 4. Exercise Card ===== */}
        <div style={{ ...cardStyle, ...fadeUp(0.15) }}>
          {cardHeader('linear-gradient(135deg, #C0E8F8, #80CCE8)', '운동·산책',
            selectedExercise ? `${selectedExercise} 선택됨` : '오늘 미기록',
            selectedExercise ? '#5AAABB' : '#9ABBC8'
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
            {EXERCISES.map(ex => {
              const active = selectedExercise === ex.name;
              return (
                <div key={ex.id} onClick={() => isToday && setSelectedExercise(active ? null : ex.name)}
                  style={{
                    padding: '10px 4px', borderRadius: 10, textAlign: 'center',
                    border: `1px solid ${active ? 'rgba(100,180,220,.6)' : 'rgba(100,180,220,.15)'}`,
                    background: active ? 'rgba(100,180,220,.12)' : 'rgba(255,255,255,.5)',
                    cursor: isToday ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                  }}>
                  <div style={{ fontSize: 18, marginBottom: 2 }}>{ex.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: active ? 600 : 400, color: active ? '#3A8AAA' : '#7AAABB' }}>{ex.name}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== 5. Sleep Card ===== */}
        <div style={{ ...cardStyle, ...fadeUp(0.2) }}>
          {cardHeader('linear-gradient(135deg, #E8D0F0, #C8A0E0)', '수면',
            sleepQuality ? `${sleepHours}시간 · ${sleepQuality}` : `${sleepHours}시간`,
            '#5AAABB'
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 24, fontWeight: 500, color: '#1A3A4A' }}>{sleepHours}</span>
              <span style={{ fontSize: 11, color: '#7AAABB', marginLeft: 3 }}>시간</span>
            </div>
            <div style={{ flex: 1 }}>
              <input type="range" min="2" max="12" step="0.5" value={sleepHours}
                onChange={e => isToday && setSleepHours(parseFloat(e.target.value))}
                disabled={!isToday}
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
                <button key={q} onClick={() => isToday && setSleepQuality(active ? null : q)}
                  style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 10, fontWeight: active ? 600 : 400,
                    border: `1px solid ${active ? 'rgba(200,160,224,.4)' : 'rgba(100,180,220,.15)'}`,
                    background: active ? 'rgba(200,160,224,.15)' : 'rgba(255,255,255,.5)',
                    color: active ? '#9060B0' : '#7AAABB',
                    cursor: isToday ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                  }}>{q}</button>
              );
            })}
          </div>
        </div>

        {/* ===== 6. Water Card ===== */}
        <div style={{ ...cardStyle, ...fadeUp(0.25) }}>
          {cardHeader('linear-gradient(135deg, #C0E0F8, #80C0F0)', '수분',
            waterCount > 0 ? `${waterCount}잔` : '미기록',
            waterCount > 0 ? '#5AAABB' : '#9ABBC8'
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 4, flex: 1 }}>
              {Array.from({ length: TOTAL_CUPS }).map((_, i) => {
                const filled = i < waterCount;
                return (
                  <div key={i} onClick={() => isToday && setWaterCount(i + 1 === waterCount ? 0 : i + 1)}
                    style={{
                      width: 20, height: 26, borderRadius: 5, overflow: 'hidden',
                      border: `1px solid ${filled ? 'rgba(100,180,220,.4)' : 'rgba(100,180,220,.2)'}`,
                      background: filled ? 'transparent' : 'rgba(100,180,220,.08)',
                      cursor: isToday ? 'pointer' : 'default',
                      position: 'relative',
                      transition: 'all 0.15s ease',
                    }}>
                    {filled && (
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%',
                        background: 'linear-gradient(180deg, #90CCEE, #60AADD)',
                        borderRadius: 4,
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#5AAABB', minWidth: 32, textAlign: 'right' }}>
              {waterCount}잔
            </span>
          </div>
        </div>

        {/* ===== 7. Save Button ===== */}
        {isToday && (
          <button onClick={handleSave} style={{
            width: '100%', padding: 12, borderRadius: 14,
            background: 'rgba(255,255,255,.65)', border: '1px solid rgba(100,180,220,.25)',
            color: '#3A8AAA', fontSize: 12, fontWeight: 500,
            cursor: 'pointer', marginBottom: 10,
            ...fadeUp(0.3),
          }}>
            오늘 기록 저장 →
          </button>
        )}
      </div>
    </div>
  );
}
