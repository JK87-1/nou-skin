import { useState, useCallback, useEffect } from 'react';
import { hapticLight } from '../utils/haptic';
import { getProfile } from '../storage/ProfileStorage';

/* ── 상수 ── */
const CHECKIN_KEY = 'lua_morning_checkin';
const CONDITION_OPTIONS = [
  { value: 1, emoji: '😴', label: '많이 피곤해요' },
  { value: 2, emoji: '😐', label: '조금 무거워요' },
  { value: 3, emoji: '🙂', label: '괜찮아요' },
  { value: 4, emoji: '😊', label: '기분 좋아요' },
  { value: 5, emoji: '✨', label: '최고로 좋아요' },
];
const SLEEP_OPTIONS = [
  { value: '0-5', label: '5시간 미만', status: '짧음', color: '#C97C5E' },
  { value: '5-6', label: '5~6시간', status: '조금 부족', color: '#B8865C' },
  { value: '6-7', label: '6~7시간', status: '보통', color: '#4A6B85' },
  { value: '7-8', label: '7~8시간', status: '충분', color: '#5E9D8A' },
  { value: '8+', label: '8시간 이상', status: '푹 잠', color: '#5E9D8A' },
];

const BG_GRADIENT = 'linear-gradient(180deg, #B8DCEF 0%, #D4E8F4 50%, #E8F1F7 100%)';
const RESULT_GRADIENT = 'linear-gradient(180deg, #FFF5EB 0%, #FFE8D6 100%)';

/* ── 유틸 ── */
function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getSliderLabel(val) {
  if (val <= 30) return { text: '낮음', color: '#C97C5E' };
  if (val <= 50) return { text: '조금 낮음', color: '#B8865C' };
  if (val <= 70) return { text: '보통', color: '#5E9D8A' };
  if (val <= 85) return { text: '좋음', color: '#5E9D8A' };
  return { text: '최고', color: '#5E9D8A' };
}

function getTimeGreeting(nickname) {
  const h = new Date().getHours();
  const name = nickname ? `${nickname}님` : '';
  if (h >= 6 && h < 11) return { text: `좋은 아침이에요${name ? ', ' + name : ''} ☀`, sub: '오늘은 어떤 기분이에요?' };
  if (h >= 11 && h < 18) return { text: `오후도 잘 지내고 계세요?${name ? ' ' + name : ''} ☁`, sub: '지금 컨디션을 체크해봐요' };
  if (h >= 18) return { text: `오늘 하루 어떠셨어요?${name ? ' ' + name : ''} 🌙`, sub: '하루를 마무리하며 체크해봐요' };
  return { text: `늦게까지 깨어 있으시네요${name ? ' ' + name : ''} ✨`, sub: '지금 컨디션을 기록해봐요' };
}

export function loadTodayCheckIn() {
  try {
    const all = JSON.parse(localStorage.getItem(CHECKIN_KEY) || '{}');
    const today = all[getTodayKey()];
    if (today?.completedAt) return today;
  } catch {}
  return null;
}

function loadPartialCheckIn() {
  try {
    const all = JSON.parse(localStorage.getItem(CHECKIN_KEY) || '{}');
    return all[getTodayKey()] || null;
  } catch {}
  return null;
}

function saveCheckIn(data) {
  try {
    const all = JSON.parse(localStorage.getItem(CHECKIN_KEY) || '{}');
    all[getTodayKey()] = { ...all[getTodayKey()], ...data, date: getTodayKey() };
    localStorage.setItem(CHECKIN_KEY, JSON.stringify(all));
  } catch {}
}

function getYesterdayScore() {
  try {
    const all = JSON.parse(localStorage.getItem(CHECKIN_KEY) || '{}');
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yKey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    return all[yKey]?.totalScore || null;
  } catch { return null; }
}

function getStreak() {
  try {
    const all = JSON.parse(localStorage.getItem(CHECKIN_KEY) || '{}');
    let count = 0;
    const d = new Date();
    // 오늘 포함
    for (let i = 0; i < 365; i++) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (all[key]?.completedAt) { count++; d.setDate(d.getDate() - 1); }
      else if (i === 0) { d.setDate(d.getDate() - 1); } // 오늘 아직 안했으면 어제부터
      else break;
    }
    return count;
  } catch { return 0; }
}

/* ── 점수 계산 ── */
function calcScore(data) {
  const { condition, sleep, energy, mood, focus } = data;

  // energy score: condition(40%) + sleep(60%)
  let sleepScore = 50;
  if (sleep?.duration) {
    const map = { '0-5': 20, '5-6': 40, '6-7': 60, '7-8': 80, '8+': 90 };
    sleepScore = map[sleep.duration] || 50;
    if (sleep.quality) sleepScore = sleepScore * 0.7 + (sleep.quality * 20) * 0.3;
  }
  let condScore = condition?.value ? condition.value * 20 : 50;

  const energyFinal = energy ?? Math.round(sleepScore * 0.6 + condScore * 0.4);
  const moodFinal = mood ?? (condition?.value ? condition.value * 20 : 50);
  const focusFinal = focus ?? Math.round(sleepScore * 0.5 + condScore * 0.5);
  const bodyFinal = Math.round(sleepScore * 0.5 + 50 * 0.5); // simplified without skin

  const total = Math.round(
    energyFinal * 0.30 + moodFinal * 0.20 + focusFinal * 0.25 + bodyFinal * 0.25
  );

  const getLabel = (v) => v >= 70 ? '좋음' : v >= 50 ? '보통' : v >= 30 ? '조금 낮음' : '낮음';

  return {
    totalScore: Math.max(0, Math.min(100, total)),
    breakdown: {
      energy: { score: energyFinal, label: getLabel(energyFinal) },
      mood: { score: moodFinal, label: getLabel(moodFinal) },
      focus: { score: focusFinal, label: getLabel(focusFinal) },
      body: { score: bodyFinal, label: getLabel(bodyFinal) },
    },
  };
}

/* ── 인사이트 생성 ── */
function generateInsight(data, score, yScore) {
  const { sleep, condition } = data;
  const delta = yScore != null ? score.totalScore - yScore : null;
  const bd = score.breakdown;
  const lowAreas = Object.entries(bd).filter(([, v]) => v.score < 50).map(([k]) => ({ energy: '에너지', mood: '기분', focus: '집중력', body: '몸 상태' }[k]));
  const highAreas = Object.entries(bd).filter(([, v]) => v.score >= 70).map(([k]) => ({ energy: '에너지', mood: '기분', focus: '집중력', body: '몸 상태' }[k]));

  if (score.totalScore >= 70) {
    return `오늘 컨디션이 평소보다 좋아요.${highAreas.length > 0 ? ` ${highAreas.slice(0, 2).join('과 ')}이 특히 좋네요.` : ''} 이 흐름을 유지하려면 충분한 수분과 가벼운 활동을 이어가세요.`;
  }
  if (sleep?.duration === '7-8' || sleep?.duration === '8+') {
    return `어제보다 잘 주무셨네요. 그래서 에너지가 회복되고 있어요.${lowAreas.length > 0 ? ` 다만 ${lowAreas[0]}은 아직 낮으니 오전엔 가벼운 일부터 시작해보세요.` : ''}`;
  }
  if (sleep?.duration === '0-5' || sleep?.duration === '5-6') {
    return `어제 수면이 짧았네요. 그래서 ${lowAreas.length > 0 ? `${lowAreas[0]}이 낮은 상태` : '컨디션이 조금 낮은 상태'}예요. 오늘은 카페인보다 물 한 잔과 5분 스트레칭을 추천해요.`;
  }
  if (condition?.value <= 2) {
    return `오늘 컨디션이 조금 무거운 날이에요. 무리하지 말고, 한 가지씩 천천히 시작해보세요. 작은 움직임이 기분 전환에 도움돼요.`;
  }
  return `오늘의 컨디션을 체크했어요.${delta != null && delta > 0 ? ` 어제보다 ${delta}점 올랐어요.` : ''} 충분한 수분 섭취와 가벼운 움직임으로 컨디션을 유지해보세요.`;
}

/* ── 추천 행동 생성 ── */
function generateRecommendations(data, score) {
  const recs = [];
  const bd = score.breakdown;
  if (bd.energy.score < 60) recs.push({ id: 'water_morning', text: '물 한 컵 마시기', completed: false });
  if (bd.focus.score < 60) recs.push({ id: 'stretch_5min', text: '5분 스트레칭', completed: false });
  if (bd.mood.score < 60) recs.push({ id: 'walk_10min', text: '10분 산책하기', completed: false });
  if (data.sleep?.duration === '0-5' || data.sleep?.duration === '5-6') recs.push({ id: 'nap_20min', text: '낮잠 20분 자기', completed: false });
  if (recs.length === 0) {
    recs.push({ id: 'water_keep', text: '수분 섭취 유지하기', completed: false });
    recs.push({ id: 'routine_keep', text: '루틴 이어가기', completed: false });
  }
  return recs.slice(0, 3);
}

/* ── 공통 스타일 ── */
const glassCard = {
  background: 'rgba(255,255,255,0.6)',
  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  border: '0.5px solid rgba(255,255,255,0.8)',
  borderRadius: 24,
};

/* ============================================= */
/* ============= MAIN COMPONENT =============== */
/* ============================================= */
export default function MorningCheckIn({ onClose, onComplete }) {
  const profile = getProfile();
  const nickname = profile.nickname || '';
  const partial = loadPartialCheckIn();

  const [step, setStep] = useState(() => {
    if (partial && !partial.completedAt) {
      if (partial.condition && partial.sleep && partial.energy != null) return 4;
      if (partial.condition && partial.sleep) return 3;
      if (partial.condition) return 2;
    }
    return 1;
  });
  const [condition, setCondition] = useState(partial?.condition || null);
  const [sleep, setSleep] = useState(partial?.sleep || null);
  const [sleepQuality, setSleepQuality] = useState(partial?.sleep?.quality || null);
  const [energy, setEnergy] = useState(partial?.energy ?? 50);
  const [mood, setMood] = useState(partial?.mood ?? 50);
  const [focus, setFocus] = useState(partial?.focus ?? 50);
  const [result, setResult] = useState(null);
  const [recommendations, setRecommendations] = useState([]);

  const totalSteps = 5;

  // 자동 저장
  useEffect(() => {
    if (step <= 4) {
      saveCheckIn({ condition, sleep, energy, mood, focus, createdAt: partial?.createdAt || new Date().toISOString() });
    }
  }, [condition, sleep, energy, mood, focus, step]);

  const handleConditionSelect = (opt) => {
    hapticLight();
    setCondition(opt);
    saveCheckIn({ condition: opt });
    setTimeout(() => setStep(2), 200);
  };

  const handleSleepSelect = (opt) => {
    hapticLight();
    const s = { duration: opt.value, quality: sleepQuality };
    setSleep(s);
    saveCheckIn({ sleep: s });
    if (sleepQuality != null) {
      setTimeout(() => setStep(3), 200);
    }
  };

  const handleSleepQualitySelect = (val) => {
    hapticLight();
    setSleepQuality(val);
    const s = { duration: sleep?.duration, quality: val };
    setSleep(s);
    saveCheckIn({ sleep: s });
  };

  const handleSleepNext = () => {
    hapticLight();
    setStep(3);
  };

  const handleVitalsNext = () => {
    hapticLight();
    saveCheckIn({ energy, mood, focus });
    setStep(4);
  };

  const handleSkipSkin = () => {
    hapticLight();
    finishCheckIn();
  };

  const handleSkinPhoto = () => {
    // Phase 2: 카메라 연동
    hapticLight();
    finishCheckIn();
  };

  const finishCheckIn = useCallback(() => {
    const data = { condition, sleep, energy, mood, focus };
    const score = calcScore(data);
    const yScore = getYesterdayScore();
    const insight = generateInsight(data, score, yScore);
    const recs = generateRecommendations(data, score);
    const streak = getStreak() + 1;

    const finalData = {
      ...data,
      completedAt: new Date().toISOString(),
      totalScore: score.totalScore,
      breakdown: score.breakdown,
      insight,
      recommendations: recs,
      streak,
      previousScore: yScore,
    };
    saveCheckIn(finalData);

    // 기존 lua_record_v2에도 수면 데이터 동기화
    if (sleep?.duration) {
      try {
        const allRec = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
        const todayKey = getTodayKey();
        const rec = allRec[todayKey] || { date: todayKey };
        const hourMap = { '0-5': 4, '5-6': 5.5, '6-7': 6.5, '7-8': 7.5, '8+': 8.5 };
        const qualMap = { 1: '얕은 수면', 2: '얕은 수면', 3: '보통', 4: '깊은 수면', 5: '깊은 수면' };
        rec.sleep = {
          hours: hourMap[sleep.duration] || 7,
          quality: sleep.quality ? qualMap[sleep.quality] : null,
          bedtime: rec.sleep?.bedtime || null,
          wakeTime: rec.sleep?.wakeTime || null,
        };
        allRec[todayKey] = rec;
        localStorage.setItem('lua_record_v2', JSON.stringify(allRec));
      } catch {}
    }

    setResult({ ...score, insight, recommendations: recs, streak, delta: yScore != null ? score.totalScore - yScore : null });
    setRecommendations(recs);
    setStep(5);
  }, [condition, sleep, energy, mood, focus]);

  const handleSkip = () => {
    hapticLight();
    if (step === 1) { onClose?.(); return; }
    if (step === 4) { finishCheckIn(); return; }
    setStep(s => s + 1);
  };

  const handleClose = () => {
    hapticLight();
    onClose?.();
  };

  const handleDone = () => {
    hapticLight();
    onComplete?.();
  };

  const toggleRec = (id) => {
    setRecommendations(prev => prev.map(r => r.id === id ? { ...r, completed: !r.completed } : r));
    const updated = recommendations.map(r => r.id === id ? { ...r, completed: !r.completed } : r);
    saveCheckIn({ recommendations: updated });
  };

  /* ── Progress Bar ── */
  const ProgressBar = ({ current, total, coral }) => (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: 18, height: 3, borderRadius: 2,
          background: i < current ? (coral ? '#B8865C' : '#4A6B85') : (coral ? 'rgba(184,134,92,0.2)' : 'rgba(74,107,133,0.2)'),
          transition: 'background 0.2s',
        }} />
      ))}
    </div>
  );

  /* ── STEP 1: 컨디션 ── */
  if (step === 1) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: BG_GRADIENT, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
        <div onClick={handleClose} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A6B85" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </div>
        <ProgressBar current={1} total={totalSteps} />
        <div onClick={handleSkip} style={{ fontSize: 12, color: '#8BA6BD', cursor: 'pointer', padding: '8px 0' }}>건너뛰기</div>
      </div>
      <div style={{ padding: '0 30px' }}>
        <div style={{ fontSize: 19, fontWeight: 500, color: '#2C4A5E', lineHeight: 1.4, letterSpacing: -0.3, marginBottom: 10 }}>
          지금 컨디션이{'\n'}어떤 거에 가까워요?
        </div>
        <div style={{ fontSize: 12, color: '#8BA6BD', marginBottom: 32 }}>직감으로 골라주세요. 1초면 충분해요.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {CONDITION_OPTIONS.map(opt => {
            const selected = condition?.value === opt.value;
            return (
              <div key={opt.value} onClick={() => handleConditionSelect(opt)} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderRadius: 16, cursor: 'pointer',
                background: selected ? '#4A6B85' : 'rgba(255,255,255,0.5)',
                border: selected ? 'none' : '0.5px solid rgba(255,255,255,0.8)',
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                transition: 'background 0.15s',
              }}>
                <span style={{ fontSize: 24 }}>{opt.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: selected ? '#fff' : '#2C4A5E' }}>{opt.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  /* ── STEP 2: 수면 ── */
  if (step === 2) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: BG_GRADIENT, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
        <div onClick={handleClose} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A6B85" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </div>
        <ProgressBar current={2} total={totalSteps} />
        <div onClick={handleSkip} style={{ fontSize: 12, color: '#8BA6BD', cursor: 'pointer', padding: '8px 0' }}>건너뛰기</div>
      </div>
      <div style={{ padding: '0 30px' }}>
        <div style={{ fontSize: 19, fontWeight: 500, color: '#2C4A5E', lineHeight: 1.4, letterSpacing: -0.3, marginBottom: 10 }}>
          어젯밤 잠은{'\n'}어땠어요?
        </div>
        <div style={{ fontSize: 12, color: '#8BA6BD', marginBottom: 32 }}>대략적으로 골라도 충분해요.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SLEEP_OPTIONS.map(opt => {
            const selected = sleep?.duration === opt.value;
            return (
              <div key={opt.value} onClick={() => handleSleepSelect(opt)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderRadius: 16, cursor: 'pointer',
                background: selected ? '#4A6B85' : 'rgba(255,255,255,0.5)',
                border: selected ? 'none' : '0.5px solid rgba(255,255,255,0.8)',
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                transition: 'background 0.15s',
              }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: selected ? '#fff' : '#2C4A5E' }}>{opt.label}</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: selected ? 'rgba(255,255,255,0.7)' : opt.color }}>{opt.status}</span>
              </div>
            );
          })}
        </div>

        {/* 잠의 질 */}
        <div style={{ ...glassCard, padding: '14px 18px', marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#6B8499' }}>잠의 질은 어땠어요?</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(v => (
              <div key={v} onClick={() => handleSleepQualitySelect(v)} style={{
                width: 14, height: 14, borderRadius: '50%', cursor: 'pointer',
                background: sleepQuality != null && v <= sleepQuality ? '#4A6B85' : 'rgba(74,107,133,0.2)',
                transition: 'background 0.15s',
              }} />
            ))}
          </div>
        </div>

        {sleep?.duration && (
          <button onClick={handleSleepNext} style={{
            width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
            background: '#4A6B85', color: '#fff', fontSize: 14, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit', marginTop: 24,
          }}>다음</button>
        )}
      </div>
    </div>
  );

  /* ── STEP 3: 에너지·기분·집중 ── */
  if (step === 3) {
    const sliders = [
      { key: 'energy', icon: '⚡', label: '에너지', value: energy, set: setEnergy },
      { key: 'mood', icon: '🙂', label: '기분', value: mood, set: setMood },
      { key: 'focus', icon: '🎯', label: '집중', value: focus, set: setFocus },
    ];
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: BG_GRADIENT, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
          <div onClick={handleClose} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A6B85" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </div>
          <ProgressBar current={3} total={totalSteps} />
          <div onClick={handleSkip} style={{ fontSize: 12, color: '#8BA6BD', cursor: 'pointer', padding: '8px 0' }}>건너뛰기</div>
        </div>
        <div style={{ padding: '0 30px' }}>
          <div style={{ fontSize: 19, fontWeight: 500, color: '#2C4A5E', lineHeight: 1.4, letterSpacing: -0.3, marginBottom: 10 }}>
            3가지 영역,{'\n'}지금 어때요?
          </div>
          <div style={{ fontSize: 12, color: '#8BA6BD', marginBottom: 32 }}>슬라이더로 빠르게 표시해주세요.</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {sliders.map(s => {
              const info = getSliderLabel(s.value);
              return (
                <div key={s.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#4A6B85' }}>{s.icon} {s.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: info.color }}>{info.text}</span>
                  </div>
                  <div style={{ position: 'relative', height: 18, display: 'flex', alignItems: 'center' }}>
                    <div style={{ position: 'absolute', left: 0, right: 0, height: 8, borderRadius: 4, background: 'rgba(74,107,133,0.12)' }} />
                    <div style={{ position: 'absolute', left: 0, height: 8, borderRadius: 4, width: `${s.value}%`, background: `linear-gradient(90deg, rgba(74,107,133,0.2), ${info.color})`, transition: 'width 0.05s' }} />
                    <input type="range" min="0" max="100" value={s.value}
                      onChange={e => s.set(parseInt(e.target.value))}
                      style={{
                        position: 'absolute', left: 0, right: 0, width: '100%', height: 18,
                        appearance: 'none', WebkitAppearance: 'none', background: 'transparent', outline: 'none', margin: 0, cursor: 'pointer',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ ...glassCard, background: 'rgba(255,255,255,0.4)', padding: '12px 16px', marginTop: 28 }}>
            <span style={{ fontSize: 11, color: '#8BA6BD', lineHeight: 1.5 }}>💡 슬라이더는 일주일이 지나면 lua가 자동으로 추정해줘요</span>
          </div>

          <button onClick={handleVitalsNext} style={{
            width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
            background: '#4A6B85', color: '#fff', fontSize: 14, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit', marginTop: 24,
          }}>다음</button>
        </div>
        <style>{`
          input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none;
            width: 18px; height: 18px; border-radius: 50%;
            background: #fff; border: 2px solid #4A6B85;
            box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          }
        `}</style>
      </div>
    );
  }

  /* ── STEP 4: 피부 사진 (선택) ── */
  if (step === 4) {
    const skinRecs = (() => { try { return JSON.parse(localStorage.getItem('nou_records') || '[]'); } catch { return []; } })();
    const thisWeek = skinRecs.filter(r => {
      const d = new Date(r.date);
      const now = new Date();
      const diff = (now - d) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    }).length;
    let motivMsg = '처음 찍으면 이번 주 패턴이 시작돼요';
    if (thisWeek >= 7) motivMsg = '이번 주 매일 찍으셨어요!';
    else if (thisWeek >= 3) motivMsg = `이번 주 ${thisWeek}일 찍으셨어요. 패턴이 보이기 시작했어요.`;
    else if (thisWeek >= 1) motivMsg = `${thisWeek}일 찍으셨어요. 며칠 더 모이면 패턴이 보여요`;

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: BG_GRADIENT, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
          <div onClick={handleClose} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A6B85" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </div>
          <ProgressBar current={4} total={totalSteps} />
          <div onClick={handleSkip} style={{ fontSize: 12, color: '#8BA6BD', cursor: 'pointer', padding: '8px 0' }}>건너뛰기</div>
        </div>
        <div style={{ padding: '0 30px' }}>
          <div style={{ fontSize: 19, fontWeight: 500, color: '#2C4A5E', lineHeight: 1.4, letterSpacing: -0.3, marginBottom: 10 }}>
            오늘 피부도{'\n'}한 번 봐볼까요?
          </div>
          <div style={{ fontSize: 12, color: '#8BA6BD', marginBottom: 36 }}>선택사항이에요. 찍은 사진은 본인만 볼 수 있어요.</div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
            <div style={{
              width: 90, height: 90, borderRadius: '50%',
              border: '2px dashed rgba(74,107,133,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
            }}>
              <span style={{ fontSize: 32 }}>📷</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#2C4A5E', marginBottom: 6 }}>셀카 한 장 찍기</div>
            <div style={{ fontSize: 11, color: '#8BA6BD', textAlign: 'center', lineHeight: 1.5 }}>조명 좋은 곳에서 정면으로{'\n'}10초면 끝나요</div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSkinPhoto} style={{
              flex: 1, padding: '14px 0', borderRadius: 14, border: 'none',
              background: '#4A6B85', color: '#fff', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>지금 찍기</button>
            <button onClick={handleSkipSkin} style={{
              flex: 1, padding: '14px 0', borderRadius: 14,
              border: '0.5px solid rgba(74,107,133,0.3)', background: 'rgba(255,255,255,0.5)',
              color: '#4A6B85', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>나중에</button>
          </div>

          <div style={{ ...glassCard, background: 'rgba(255,255,255,0.4)', padding: '12px 16px', marginTop: 20 }}>
            <span style={{ fontSize: 11, color: '#8BA6BD', lineHeight: 1.5 }}>📊 {motivMsg}</span>
          </div>
        </div>
      </div>
    );
  }

  /* ── STEP 5: 결과 화면 ── */
  if (step === 5 && result) {
    const bd = result.breakdown;
    const indicators = [
      { icon: '⚡', label: '에너지', label_status: bd.energy.label, ...bd.energy },
      { icon: '🙂', label: '기분', label_status: bd.mood.label, ...bd.mood },
      { icon: '🎯', label: '집중', label_status: bd.focus.label, ...bd.focus },
      { icon: '🫧', label: '몸', label_status: bd.body.label, ...bd.body },
    ];
    const getIndColor = (score) => score >= 70 ? '#5E9D8A' : score >= 50 ? '#4A6B85' : score >= 30 ? '#B8865C' : '#C97C5E';
    const streak = result.streak;
    let streakMsg = '';
    if (streak >= 30) streakMsg = `👑 ${streak}일째 함께해요`;
    else if (streak >= 14) streakMsg = `✨ ${streak}일 연속 체크인 중`;
    else if (streak >= 7) streakMsg = '🎉 일주일 달성!';
    else if (streak >= 2) streakMsg = `🔥 ${streak}일 연속`;
    else streakMsg = '🌱 첫 체크인 완료';

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: RESULT_GRADIENT, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 30 }}>
          <ProgressBar current={5} total={totalSteps} coral />
        </div>
        <div style={{ padding: '0 26px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#6B5A4E', marginBottom: 8, letterSpacing: 0.5 }}>{nickname ? `${nickname}님의 오늘` : '오늘의 점수'}</div>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 50, fontWeight: 500, color: '#4A3A2E', letterSpacing: -1.5, fontFamily: 'var(--font-display)' }}>{result.totalScore}</span>
            <span style={{ fontSize: 13, color: '#8A5A3C', marginLeft: 4 }}>/ 100</span>
          </div>
          {result.delta != null && (
            <div style={{
              display: 'inline-block', padding: '4px 12px', borderRadius: 10,
              background: 'rgba(255,220,195,0.6)', fontSize: 11, color: '#B8865C',
            }}>어제보다 {result.delta >= 0 ? '↑' : '↓'} {Math.abs(result.delta)}점</div>
          )}

          {/* 4분면 */}
          <div style={{ display: 'flex', gap: 6, marginTop: 24, marginBottom: 20 }}>
            {indicators.map(ind => (
              <div key={ind.label} style={{
                flex: 1, textAlign: 'center', padding: '12px 0 10px',
                background: 'rgba(255,255,255,0.5)', borderRadius: 14,
              }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{ind.icon}</div>
                <div style={{ fontSize: 10, color: '#8A5A3C', marginBottom: 3 }}>{ind.label}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: getIndColor(ind.score) }}>{ind.label_status}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '0 22px' }}>
          {/* 인사이트 카드 */}
          <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#8A5A3C', marginBottom: 10, fontWeight: 500 }}>🔍 오늘의 인사이트</div>
            <div style={{ fontSize: 12, color: '#4A3A2E', lineHeight: 1.7, wordBreak: 'keep-all' }}>{result.insight}</div>
          </div>

          {/* 추천 행동 */}
          <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#8A5A3C', marginBottom: 10, fontWeight: 500 }}>🌿 오늘 추천 (탭하면 체크)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recommendations.map(r => (
                <div key={r.id} onClick={() => toggleRec(r.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: r.completed ? 'none' : '1.5px solid #D4A878',
                    background: r.completed ? '#5E9D8A' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {r.completed && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>}
                  </div>
                  <span style={{
                    fontSize: 11, color: '#4A3A2E',
                    textDecoration: r.completed ? 'line-through' : 'none',
                    opacity: r.completed ? 0.5 : 1,
                  }}>{r.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 연속 기록 */}
          <div style={{ background: 'rgba(238,237,254,0.5)', borderRadius: 16, padding: '12px 16px', marginBottom: 20 }}>
            <span style={{ fontSize: 12, color: '#4A3A2E', fontWeight: 500 }}>{streakMsg}</span>
          </div>

          <button onClick={handleDone} style={{
            width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
            background: '#B8865C', color: '#fff', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: 40,
          }}>홈으로</button>
        </div>
      </div>
    );
  }

  return null;
}

/* ── 체크인 후 홈 요약 카드 (Screen 07) ── */
export function CheckInSummaryCard() {
  const data = loadTodayCheckIn();
  const [recs, setRecs] = useState(data?.recommendations || []);
  if (!data) return null;

  const bd = data.breakdown || {};
  const indicators = [
    { icon: '⚡', label: '에너지', score: bd.energy?.score || 50, status: bd.energy?.label || '보통' },
    { icon: '🙂', label: '기분', score: bd.mood?.score || 50, status: bd.mood?.label || '보통' },
    { icon: '🎯', label: '집중', score: bd.focus?.score || 50, status: bd.focus?.label || '보통' },
    { icon: '🫧', label: '몸', score: bd.body?.score || 50, status: bd.body?.label || '보통' },
  ];
  const getColor = (s) => s >= 70 ? '#5E9D8A' : s >= 50 ? '#4A6B85' : s >= 30 ? '#B8865C' : '#C97C5E';
  const delta = data.previousScore != null ? data.totalScore - data.previousScore : null;
  const streak = data.streak || 0;
  let streakMsg = '';
  if (streak >= 30) streakMsg = `👑 ${streak}일째 함께해요`;
  else if (streak >= 14) streakMsg = `✨ ${streak}일 연속 체크인 중`;
  else if (streak >= 7) streakMsg = '🎉 일주일 달성!';
  else if (streak >= 2) streakMsg = `🔥 ${streak}일 연속`;
  else streakMsg = '🌱 첫 체크인 완료';
  const doneCount = recs.filter(r => r.completed).length;

  const toggleRec = (id) => {
    const updated = recs.map(r => r.id === id ? { ...r, completed: !r.completed } : r);
    setRecs(updated);
    try {
      const all = JSON.parse(localStorage.getItem(CHECKIN_KEY) || '{}');
      const todayKey = getTodayKey();
      if (all[todayKey]) { all[todayKey].recommendations = updated; localStorage.setItem(CHECKIN_KEY, JSON.stringify(all)); }
    } catch {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 메인 점수 카드 */}
      <div style={{
        background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: '0.5px solid rgba(255,255,255,0.8)', borderRadius: 18, padding: '16px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 32, fontWeight: 500, color: '#2C4A5E', fontFamily: 'var(--font-display)', letterSpacing: -1 }}>{data.totalScore}</span>
            <span style={{ fontSize: 12, color: '#8BA6BD' }}>/100</span>
          </div>
          {delta != null && (
            <span style={{ fontSize: 11, color: delta >= 0 ? '#5E9D8A' : '#C97C5E', fontWeight: 500 }}>
              {delta >= 0 ? '↑' : '↓'} 어제보다 {Math.abs(delta)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {indicators.map(ind => (
            <div key={ind.label} style={{ flex: 1, textAlign: 'center', padding: '8px 0', background: 'rgba(0,0,0,0.02)', borderRadius: 12 }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{ind.icon}</div>
              <div style={{ fontSize: 10, color: '#8BA6BD', marginBottom: 2 }}>{ind.label}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: getColor(ind.score) }}>{ind.status}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 인사이트 */}
      {data.insight && (
        <div style={{
          background: 'rgba(255,235,210,0.5)', borderRadius: 16, padding: '14px 16px',
          border: '0.5px solid rgba(255,220,195,0.5)',
        }}>
          <div style={{ fontSize: 11, color: '#8A5A3C', marginBottom: 8, fontWeight: 500 }}>🔍 오늘 인사이트</div>
          <div style={{ fontSize: 12, color: '#4A3A2E', lineHeight: 1.7, wordBreak: 'keep-all' }}>{data.insight}</div>
        </div>
      )}

      {/* 추천 */}
      {recs.length > 0 && (
        <div style={{
          background: 'rgba(255,235,210,0.35)', borderRadius: 16, padding: '14px 16px',
          border: '0.5px solid rgba(255,220,195,0.3)',
        }}>
          <div style={{ fontSize: 11, color: '#8A5A3C', marginBottom: 8, fontWeight: 500 }}>🌿 오늘 {doneCount}/{recs.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recs.map(r => (
              <div key={r.id} onClick={() => toggleRec(r.id)} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', borderRadius: 8,
                background: 'rgba(255,255,255,0.5)', cursor: 'pointer',
              }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                  border: r.completed ? 'none' : '1.5px solid #D4A878',
                  background: r.completed ? '#5E9D8A' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {r.completed && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>}
                </div>
                <span style={{ fontSize: 11, color: '#4A3A2E', textDecoration: r.completed ? 'line-through' : 'none', opacity: r.completed ? 0.5 : 1 }}>{r.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 연속 기록 */}
      <div style={{
        background: 'rgba(238,237,254,0.4)', borderRadius: 14, padding: '10px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, color: '#4A6B85', fontWeight: 500 }}>{streakMsg}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8BA6BD" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6"/></svg>
      </div>
    </div>
  );
}
