import { useState, useEffect, useCallback } from 'react';
import { hapticLight } from '../utils/haptic';
import { saveConditionCheck } from '../storage/ConditionStorage';
import { saveMoodSubCheck, saveSkinSubCheck, saveEnergySubCheck } from '../storage/ConditionStorage';

/* ── 날짜 유틸 ── */
function getTodayKey() {
  const d = new Date();
  const h = d.getHours();
  if (h < 5) { d.setDate(d.getDate() - 1); }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTimeMode() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  return 'evening';
}

/* ── 시간대별 질문 설정 ── */
const QUESTIONS = {
  morning: [
    {
      id: 'sleep_hours', label: '수면 시간', icon: '🌙',
      type: 'single',
      options: [
        { value: 4, label: '4h 이하' },
        { value: 5.5, label: '5~6h' },
        { value: 6.5, label: '6~7h' },
        { value: 7.5, label: '7~8h' },
        { value: 8.5, label: '8h+' },
      ],
    },
    {
      id: 'sleep_quality', label: '수면 질', icon: '😴',
      type: 'single',
      options: [
        { value: 'light', label: '얕았어요' },
        { value: 'normal', label: '보통이에요' },
        { value: 'deep', label: '깊었어요' },
      ],
    },
    {
      id: 'condition', label: '지금 컨디션', icon: '✨',
      type: 'single',
      options: [
        { value: 2, label: '😵‍💫', sub: '힘들어요' },
        { value: 4, label: '😐', sub: '무거워요' },
        { value: 6, label: '🙂', sub: '괜찮아요' },
        { value: 8, label: '😊', sub: '좋아요' },
        { value: 10, label: '✨', sub: '최고에요' },
      ],
    },
    {
      id: 'skin', label: '피부 느낌', icon: '🫧',
      type: 'single',
      options: [
        { value: 'bad', label: '나빠요' },
        { value: 'usual', label: '평소 같아요' },
        { value: 'ok', label: '괜찮아요' },
        { value: 'glow', label: '빛나요' },
      ],
    },
  ],
  afternoon: [
    {
      id: 'lunch', label: '점심 뭐 먹었어요?', icon: '🍚',
      type: 'single',
      options: [
        { value: '한식', label: '한식' },
        { value: '분식', label: '분식' },
        { value: '양식', label: '양식' },
        { value: '샐러드', label: '샐러드' },
        { value: '중·일식', label: '중·일식' },
        { value: '패스트푸드', label: '패스트푸드' },
        { value: '빵·디저트', label: '빵·디저트' },
        { value: '안먹음', label: '안 먹음' },
      ],
    },
    {
      id: 'after_meal', label: '식후 컨디션', icon: '⚡',
      type: 'single',
      options: [
        { value: 'drowsy', label: '🥱 졸려요' },
        { value: 'similar', label: '😐 비슷해요' },
        { value: 'good', label: '🙂 괜찮아요' },
        { value: 'vibrant', label: '⚡ 활기차요' },
      ],
    },
    {
      id: 'water', label: '수분 섭취', icon: '💧',
      type: 'water',
    },
    {
      id: 'stress', label: '스트레스', icon: '😮‍💨',
      type: 'single',
      options: [
        { value: 'low', label: '낮아요' },
        { value: 'mid', label: '보통이에요' },
        { value: 'high', label: '높아요' },
      ],
    },
  ],
  evening: [
    {
      id: 'focus', label: '오늘 집중력', icon: '🎯',
      type: 'single',
      options: [
        { value: 30, label: '🌫️ 흐렸어요' },
        { value: 50, label: '⛅ 오락가락' },
        { value: 70, label: '☀️ 평소만큼' },
        { value: 90, label: '✨ 아주 좋았어요' },
      ],
    },
    {
      id: 'activity', label: '오늘 활동량', icon: '🔥',
      type: 'single',
      options: [
        { value: 1000, label: '거의 없음' },
        { value: 4000, label: '가벼움' },
        { value: 7000, label: '보통' },
        { value: 10000, label: '많음' },
      ],
    },
    {
      id: 'day_mood', label: '하루의 감정', icon: '💭',
      type: 'multi',
      options: [
        { value: 'calm', label: '🌊 잔잔' },
        { value: 'busy', label: '🔥 바빴어' },
        { value: 'hard', label: '😩 힘들었어' },
        { value: 'good', label: '🌸 좋은 일' },
        { value: 'tired', label: '😴 피곤' },
        { value: 'thoughtful', label: '💭 생각 많음' },
      ],
    },
    {
      id: 'skin_evening', label: '저녁 피부', icon: '🫧',
      type: 'single',
      options: [
        { value: 'worse', label: '나빠졌어요' },
        { value: 'same', label: '비슷해요' },
        { value: 'better', label: '괜찮아졌어요' },
      ],
    },
  ],
};

const TIME_META = {
  morning: { icon: '⛅', label: '아침', color: '#89cef5' },
  afternoon: { icon: '☀️', label: '오후', color: '#FFBB80' },
  evening: { icon: '🌙', label: '저녁', color: '#C5B3D9' },
};

const MODES = ['morning', 'afternoon', 'evening'];

const QUICK_KEY = 'lua_quick_checkin';

/* ── 저장/로드 ── */
function loadQuickCheckin(mode) {
  try {
    const all = JSON.parse(localStorage.getItem(QUICK_KEY) || '{}');
    const today = all[getTodayKey()];
    if (today?.[mode]?.completedAt) return today[mode];
  } catch {}
  return null;
}

function saveQuickCheckin(mode, data) {
  try {
    const all = JSON.parse(localStorage.getItem(QUICK_KEY) || '{}');
    const key = getTodayKey();
    if (!all[key]) all[key] = {};
    all[key][mode] = { ...data, completedAt: new Date().toISOString() };
    localStorage.setItem(QUICK_KEY, JSON.stringify(all));
  } catch {}
}

/* ── 데이터 브릿지: 체크인 → 기록 카드 ── */
function bridgeMorning(answers) {
  const todayKey = getTodayKey();
  // 수면 → lua_record_v2
  if (answers.sleep_hours != null) {
    try {
      const allRec = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
      const rec = allRec[todayKey] || { date: todayKey };
      const qualMap = { light: '얕은 수면', normal: '보통', deep: '깊은 수면' };
      rec.sleep = {
        hours: answers.sleep_hours,
        quality: answers.sleep_quality ? qualMap[answers.sleep_quality] : rec.sleep?.quality || null,
        bedtime: rec.sleep?.bedtime || null,
        wakeTime: rec.sleep?.wakeTime || null,
      };
      allRec[todayKey] = rec;
      localStorage.setItem('lua_record_v2', JSON.stringify(allRec));
    } catch {}
  }
  // 컨디션 → nou_condition_checks
  if (answers.condition != null) {
    const v = answers.condition;
    saveConditionCheck({ energy: v, mood: v, skin: null, gut: null, vitality: null, focus: null });
  }
  // 피부 → nou_skin_sub_checks
  if (answers.skin) {
    const skinMap = { bad: 3, usual: 5, ok: 7, glow: 9 };
    saveSkinSubCheck({ overall: skinMap[answers.skin] || 5 });
  }
  // 기존 체크인 키에도 기록 (호환)
  try {
    const all = JSON.parse(localStorage.getItem('lua_morning_checkin') || '{}');
    all[todayKey] = {
      ...all[todayKey],
      type: 'morning',
      completedAt: new Date().toISOString(),
      condition: Math.ceil(answers.condition / 2) || 3,
      sleep: { duration: answers.sleep_hours >= 8 ? '8+' : answers.sleep_hours >= 7 ? '7-8' : answers.sleep_hours >= 6 ? '6-7' : answers.sleep_hours >= 5 ? '5-6' : '0-5' },
      energy: (answers.condition || 5) * 10,
      mood: (answers.condition || 5) * 10,
      source: 'quick',
    };
    localStorage.setItem('lua_morning_checkin', JSON.stringify(all));
  } catch {}
}

function bridgeAfternoon(answers) {
  const todayKey = getTodayKey();
  // 수분 → lua_record_v2
  if (answers.water != null) {
    try {
      const allRec = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
      const rec = allRec[todayKey] || { date: todayKey };
      rec.water = { cups: answers.water };
      allRec[todayKey] = rec;
      localStorage.setItem('lua_record_v2', JSON.stringify(allRec));
    } catch {}
  }
  // 식후 컨디션 → nou_condition_checks 업데이트
  if (answers.after_meal) {
    const map = { drowsy: 3, similar: 5, good: 7, vibrant: 9 };
    saveConditionCheck({ energy: map[answers.after_meal] || 5, mood: null, skin: null, gut: null, vitality: null, focus: null });
  }
  // 스트레스 → nou_mood_sub_checks
  if (answers.stress) {
    const stressMap = { low: 2, mid: 5, high: 8 };
    saveMoodSubCheck([], stressMap[answers.stress] || 5);
  }
  // 기존 체크인 키 호환
  try {
    const all = JSON.parse(localStorage.getItem('lua_afternoon_checkin') || '{}');
    all[todayKey] = {
      ...all[todayKey],
      completedAt: new Date().toISOString(),
      afterMealCondition: answers.after_meal,
      lunchCategory: answers.lunch,
      source: 'quick',
    };
    localStorage.setItem('lua_afternoon_checkin', JSON.stringify(all));
  } catch {}
}

function bridgeEvening(answers) {
  const todayKey = getTodayKey();
  // 집중력 → nou_energy_sub_checks
  if (answers.focus != null) {
    saveEnergySubCheck(null, answers.focus);
  }
  // 활동량 → lua_record_v2 steps
  if (answers.activity != null) {
    try {
      const allRec = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
      const rec = allRec[todayKey] || { date: todayKey };
      if (!rec.steps || rec.steps < answers.activity) rec.steps = answers.activity;
      allRec[todayKey] = rec;
      localStorage.setItem('lua_record_v2', JSON.stringify(allRec));
    } catch {}
  }
  // 감정 → nou_mood_sub_checks
  if (answers.day_mood?.length > 0) {
    saveMoodSubCheck(answers.day_mood, null);
  }
  // 피부 저녁 → nou_skin_sub_checks
  if (answers.skin_evening) {
    const map = { worse: 3, same: 5, better: 8 };
    saveSkinSubCheck({ evening: map[answers.skin_evening] || 5 });
  }
  // 기존 체크인 키 호환
  try {
    const all = JSON.parse(localStorage.getItem('lua_evening_checkin') || '{}');
    all[todayKey] = {
      ...all[todayKey],
      completedAt: new Date().toISOString(),
      focus: { value: answers.focus <= 30 ? 'cloudy' : answers.focus <= 50 ? 'mixed' : answers.focus <= 70 ? 'normal' : 'sharp', score: answers.focus },
      dayMood: answers.day_mood || [],
      source: 'quick',
    };
    localStorage.setItem('lua_evening_checkin', JSON.stringify(all));
  } catch {}
}

const BRIDGE = { morning: bridgeMorning, afternoon: bridgeAfternoon, evening: bridgeEvening };

/* ── 카드 스타일 ── */
const glassCard = {
  background: 'rgba(255,255,255,0.2)',
  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: 24,
  boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
};

/* ── 컴포넌트 ── */
export default function QuickCheckIn({ onDataSaved }) {
  const [expanded, setExpanded] = useState(null); // 'morning' | 'afternoon' | 'evening' | null
  const [answers, setAnswers] = useState({});
  const [doneState, setDoneState] = useState({});
  const currentMode = getTimeMode();

  // 초기 로드: 완료 상태 확인
  useEffect(() => {
    const state = {};
    MODES.forEach(m => { if (loadQuickCheckin(m)) state[m] = true; });
    setDoneState(state);
  }, []);

  // 수분 현재값 로드
  const getWaterCups = useCallback(() => {
    try {
      const allRec = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
      return allRec[getTodayKey()]?.water?.cups || 0;
    } catch { return 0; }
  }, []);

  const handleSelect = (qId, value, type) => {
    hapticLight();
    if (type === 'multi') {
      setAnswers(prev => {
        const arr = prev[qId] || [];
        return { ...prev, [qId]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
      });
    } else {
      setAnswers(prev => ({ ...prev, [qId]: value }));
    }
  };

  const handleWaterAdd = () => {
    hapticLight();
    const current = answers.water ?? getWaterCups();
    setAnswers(prev => ({ ...prev, water: current + 1 }));
  };

  const handleWaterSub = () => {
    hapticLight();
    const current = answers.water ?? getWaterCups();
    if (current > 0) setAnswers(prev => ({ ...prev, water: current - 1 }));
  };

  const getAnsweredCount = (mode) => {
    const qs = QUESTIONS[mode];
    return qs.filter(q => {
      if (q.type === 'water') return false; // 수분은 별도
      if (q.type === 'multi') return (answers[q.id] || []).length > 0;
      return answers[q.id] != null;
    }).length;
  };

  const handleComplete = (mode) => {
    if (getAnsweredCount(mode) === 0) return; // 최소 1개 응답 필요
    hapticLight();
    // 데이터 브릿지
    BRIDGE[mode](answers);
    // 퀵 체크인 저장
    saveQuickCheckin(mode, answers);
    // 상태 업데이트
    setDoneState(prev => ({ ...prev, [mode]: true }));
    setExpanded(null);
    setAnswers({});
    // 이벤트 발행
    window.dispatchEvent(new CustomEvent('lua-record-updated'));
    window.dispatchEvent(new CustomEvent('lua-sleep-updated'));
    onDataSaved?.();
  };

  const handleExpand = (mode) => {
    hapticLight();
    if (expanded === mode) {
      setExpanded(null);
      setAnswers({});
    } else {
      setExpanded(mode);
      // 수분은 현재값 로드
      if (mode === 'afternoon') {
        setAnswers({ water: getWaterCups() });
      } else {
        setAnswers({});
      }
    }
  };

  const questions = expanded ? QUESTIONS[expanded] : [];
  const meta = expanded ? TIME_META[expanded] : null;

  return (
    <div style={{ margin: '0 18px 14px' }}>
      {/* 상단 3칸 카드 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: expanded ? 12 : 0 }}>
        {MODES.map(mode => {
          const m = TIME_META[mode];
          const done = doneState[mode];
          const active = expanded === mode;
          const isCurrent = mode === currentMode;
          return (
            <div
              key={mode}
              onClick={() => handleExpand(mode)}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 20, cursor: 'pointer',
                textAlign: 'center', transition: 'all 0.2s ease',
                WebkitTapHighlightColor: 'transparent',
                background: active ? `${m.color}20` : done ? 'rgba(34,197,94,0.08)' : isCurrent ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                border: active ? `1.5px solid ${m.color}50` : done ? '1.5px solid rgba(34,197,94,0.2)' : '1.5px solid rgba(255,255,255,0.15)',
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 4 }}>{done ? '✅' : m.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: done ? '#22C55E' : active ? m.color : 'rgba(0,0,0,0.4)' }}>
                {m.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* 펼침 영역 */}
      {expanded && (
        <div style={{ ...glassCard, padding: '18px 16px', overflow: 'hidden' }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>
            <span style={{ fontSize: 16 }}>{meta.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{meta.label} 체크인</span>
          </div>

          {/* 질문들 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {questions.map(q => (
              <div key={q.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 13 }}>{q.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)' }}>{q.label}</span>
                </div>

                {q.type === 'water' ? (
                  /* 수분 특별 UI */
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div onClick={handleWaterSub} style={{
                      width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.04)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      fontSize: 16, color: 'rgba(0,0,0,0.3)', fontWeight: 600,
                    }}>−</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                      <span style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                        {answers.water ?? getWaterCups()}
                      </span>
                      <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.3)' }}>잔</span>
                    </div>
                    <div onClick={handleWaterAdd} style={{
                      width: 32, height: 32, borderRadius: '50%', background: `${TIME_META.afternoon.color}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      fontSize: 16, color: TIME_META.afternoon.color, fontWeight: 600,
                    }}>+</div>
                  </div>
                ) : (
                  /* 칩 선택 */
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {q.options.map(opt => {
                      const selected = q.type === 'multi'
                        ? (answers[q.id] || []).includes(opt.value)
                        : answers[q.id] === opt.value;
                      return (
                        <div
                          key={opt.value}
                          onClick={() => handleSelect(q.id, opt.value, q.type)}
                          style={{
                            padding: '8px 14px', borderRadius: 20, cursor: 'pointer',
                            fontSize: 12, fontWeight: 500, transition: 'all 0.15s ease',
                            WebkitTapHighlightColor: 'transparent',
                            background: selected ? `${meta.color}25` : 'rgba(0,0,0,0.03)',
                            border: selected ? `1.5px solid ${meta.color}` : '1.5px solid rgba(0,0,0,0.06)',
                            color: selected ? meta.color : 'rgba(0,0,0,0.55)',
                          }}
                        >
                          {opt.sub ? `${opt.label} ${opt.sub}` : opt.label}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 완료 버튼 */}
          {(() => {
            const canComplete = getAnsweredCount(expanded) > 0;
            return (
              <div
                onClick={() => handleComplete(expanded)}
                style={{
                  marginTop: 20, padding: '12px 0', borderRadius: 20, textAlign: 'center',
                  background: canComplete ? meta.color : 'rgba(0,0,0,0.08)',
                  color: canComplete ? '#fff' : 'rgba(0,0,0,0.25)',
                  fontSize: 14, fontWeight: 600,
                  cursor: canComplete ? 'pointer' : 'default',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                완료
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
