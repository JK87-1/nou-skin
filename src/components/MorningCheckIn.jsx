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

const SKIN_OVERALL = [
  { value: 'bad', emoji: '😟', label: '안 좋음' },
  { value: 'usual', emoji: '😐', label: '평소' },
  { value: 'ok', emoji: '🙂', label: '괜찮음' },
  { value: 'glow', emoji: '✨', label: '빛남' },
];

const SKIN_SIGNALS = [
  { id: 'trouble_new', emoji: '🔴', label: '새 트러블', tone: 'negative' },
  { id: 'dry', emoji: '🌵', label: '건조함', tone: 'negative' },
  { id: 'oily', emoji: '💧', label: '번들거림', tone: 'warning' },
  { id: 'puffy', emoji: '🎈', label: '붓기', tone: 'warning' },
  { id: 'redness', emoji: '🌡️', label: '홍조·열감', tone: 'negative' },
  { id: 'sensitive', emoji: '😰', label: '예민함', tone: 'negative' },
  { id: 'dull', emoji: '😴', label: '칙칙함', tone: 'warning' },
  { id: 'better', emoji: '✨', label: '평소보다 좋음', tone: 'positive' },
];

/* ── 시간대 (낮/밤 2분할) ── */
function getTimeMode() {
  const h = new Date().getHours();
  if (h >= 5 && h < 18) return 'day';
  return 'night';
}

function getTimePalette(mode) {
  if (mode === 'day') return {
    bg: 'linear-gradient(180deg, #B8DCEF 0%, #D4E8F4 50%, #E8F1F7 100%)',
    accent: '#4A6B85', cardBg: '#4A6B85', textPrimary: '#2C4A5E',
    textSecondary: '#4A6B85', textHint: '#8BA6BD', isDark: false,
  };
  return {
    bg: 'linear-gradient(180deg, #1a1a3e 0%, #2d2d5e 50%, #3a3a6e 100%)',
    accent: '#4A4F7F', cardBg: 'rgba(255,255,255,0.15)', textPrimary: '#fff',
    textSecondary: 'rgba(255,255,255,0.85)', textHint: 'rgba(255,255,255,0.5)', isDark: true,
    border: '0.5px solid rgba(255,255,255,0.2)',
  };
}

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
    for (let i = 0; i < 365; i++) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (all[key]?.completedAt) { count++; d.setDate(d.getDate() - 1); }
      else if (i === 0) { d.setDate(d.getDate() - 1); }
      else break;
    }
    return count;
  } catch { return 0; }
}

/* ── 점수 계산 ── */
function calcScore(data) {
  const { condition, sleep, energy, mood, skin } = data;

  let sleepScore = 50;
  if (sleep?.duration) {
    const map = { '0-5': 20, '5-6': 40, '6-7': 60, '7-8': 80, '8+': 90 };
    sleepScore = map[sleep.duration] || 50;
    if (sleep.quality) sleepScore = sleepScore * 0.7 + (sleep.quality * 20) * 0.3;
  }
  const condScore = condition?.value ? condition.value * 20 : 50;

  const energyFinal = energy ?? Math.round(sleepScore * 0.6 + condScore * 0.4);
  const moodFinal = mood ?? (condition?.value ? condition.value * 20 : 50);
  // focus: 아침엔 null, 저녁에 회고
  const focusScore = null;

  // body: skin + sleep
  let bodyFinal = Math.round(sleepScore * 0.5 + 50 * 0.5);
  if (skin?.overall) {
    const skinMap = { bad: 25, usual: 50, ok: 70, glow: 90 };
    const skinBase = skinMap[skin.overall] || 50;
    const signalPenalty = (skin.signals || []).filter(s => {
      const sig = SKIN_SIGNALS.find(x => x.id === s);
      return sig && sig.tone !== 'positive';
    }).length * 5;
    const signalBonus = (skin.signals || []).includes('better') ? 10 : 0;
    bodyFinal = Math.max(0, Math.min(100, Math.round(skinBase * 0.5 + sleepScore * 0.3 + 50 * 0.2 - signalPenalty + signalBonus)));
  }

  // focus null → 가중치 분산: energy 0.40, mood 0.27, body 0.33
  const total = Math.round(energyFinal * 0.40 + moodFinal * 0.27 + bodyFinal * 0.33);

  const getLabel = (v) => {
    if (v == null) return '저녁에 회고 예정';
    return v >= 70 ? '좋음' : v >= 50 ? '보통' : v >= 30 ? '조금 낮음' : '낮음';
  };

  return {
    totalScore: Math.max(0, Math.min(100, total)),
    breakdown: {
      energy: { score: energyFinal, label: getLabel(energyFinal) },
      mood: { score: moodFinal, label: getLabel(moodFinal) },
      focus: { score: focusScore, label: getLabel(focusScore) },
      body: { score: bodyFinal, label: getLabel(bodyFinal) },
    },
  };
}

/* ── 인사이트 생성 ── */
function generateInsight(data, score) {
  const { sleep, skin } = data;
  const bd = score.breakdown;
  const lowAreas = Object.entries(bd).filter(([, v]) => v.score != null && v.score < 50).map(([k]) => ({ energy: '에너지', mood: '기분', body: '몸 상태' }[k])).filter(Boolean);
  const highAreas = Object.entries(bd).filter(([, v]) => v.score != null && v.score >= 70).map(([k]) => ({ energy: '에너지', mood: '기분', body: '몸 상태' }[k])).filter(Boolean);

  let base = '';
  if (score.totalScore >= 70) {
    base = `오늘 컨디션이 평소보다 좋아요.${highAreas.length > 0 ? ` ${highAreas.slice(0, 2).join('과 ')}이 특히 좋네요.` : ''} 이 흐름을 유지하려면 충분한 수분과 가벼운 활동을 이어가세요.`;
  } else if (sleep?.duration === '7-8' || sleep?.duration === '8+') {
    base = `어제보다 잘 주무셨네요. 그래서 에너지가 회복되고 있어요.${lowAreas.length > 0 ? ` 다만 ${lowAreas[0]}은 아직 낮으니 오전엔 가벼운 일부터 시작해보세요.` : ''}`;
  } else if (sleep?.duration === '0-5' || sleep?.duration === '5-6') {
    base = `어제 수면이 짧았네요. 그래서 ${lowAreas.length > 0 ? `${lowAreas[0]}이 낮은 상태` : '컨디션이 조금 낮은 상태'}예요. 오늘은 카페인보다 물 한 잔과 5분 스트레칭을 추천해요.`;
  } else {
    base = `오늘의 컨디션을 체크했어요. 충분한 수분 섭취와 가벼운 움직임으로 컨디션을 유지해보세요.`;
  }

  // 피부 신호 추가
  if (skin?.signals?.length > 0) {
    const negSignals = skin.signals.filter(s => { const sig = SKIN_SIGNALS.find(x => x.id === s); return sig && sig.tone !== 'positive'; });
    if (negSignals.length > 0) {
      const sigLabels = negSignals.map(s => SKIN_SIGNALS.find(x => x.id === s)?.label).filter(Boolean);
      const actions = { dry: '보습 한 번 챙겨주세요', trouble_new: '자극 없는 클렌징을 추천해요', oily: '가벼운 토너로 정돈해주세요', sensitive: '진정 케어를 추천해요' };
      const action = actions[negSignals[0]] || '수분 크림을 챙겨주세요';
      base += ` 다만 피부에 ${sigLabels.slice(0, 2).join('·')} 신호가 보여요 — ${action}`;
    }
  }

  return base;
}

/* ── 추천 행동 생성 ── */
function generateRecommendations(data, score) {
  const recs = [];
  const bd = score.breakdown;
  if (bd.energy.score < 60) recs.push({ id: 'water_morning', text: '물 한 컵 마시기', completed: false });
  if (bd.mood.score < 60) recs.push({ id: 'walk_10min', text: '10분 산책하기', completed: false });
  if (data.skin?.signals?.includes('dry')) recs.push({ id: 'moisturize', text: '보습 한 번 챙기기', completed: false });
  if (data.skin?.signals?.includes('trouble_new')) recs.push({ id: 'gentle_clean', text: '자극 없는 클렌징', completed: false });
  if (data.sleep?.duration === '0-5' || data.sleep?.duration === '5-6') recs.push({ id: 'stretch_5min', text: '5분 스트레칭', completed: false });
  if (recs.length === 0) {
    recs.push({ id: 'water_keep', text: '수분 섭취 유지하기', completed: false });
    recs.push({ id: 'routine_keep', text: '루틴 이어가기', completed: false });
  }
  return recs.slice(0, 3);
}

/* ============================================= */
/* ============= MAIN COMPONENT =============== */
/* ============================================= */
export default function MorningCheckIn({ onClose, onComplete }) {
  const profile = getProfile();
  const nickname = profile.nickname || '';
  const partial = loadPartialCheckIn();
  const timeMode = getTimeMode();
  const palette = getTimePalette(timeMode);

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
  const [skinOverall, setSkinOverall] = useState(partial?.skin?.overall || null);
  const [skinSignals, setSkinSignals] = useState(partial?.skin?.signals || []);
  const [result, setResult] = useState(null);
  const [recommendations, setRecommendations] = useState([]);

  const totalSteps = 4;

  useEffect(() => {
    if (step <= totalSteps) {
      saveCheckIn({ condition, sleep, energy, mood, skin: { overall: skinOverall, signals: skinSignals }, createdAt: partial?.createdAt || new Date().toISOString() });
    }
  }, [condition, sleep, energy, mood, skinOverall, skinSignals, step]);

  const handleConditionSelect = (opt) => {
    hapticLight();
    setCondition(opt);
    setTimeout(() => setStep(2), 200);
  };

  const handleSleepSelect = (opt) => {
    hapticLight();
    const s = { duration: opt.value, quality: sleepQuality };
    setSleep(s);
  };

  const handleSleepQualitySelect = (val) => {
    hapticLight();
    setSleepQuality(val);
    const s = { duration: sleep?.duration, quality: val };
    setSleep(s);
  };

  const handleVitalsNext = () => { hapticLight(); saveCheckIn({ energy, mood }); setStep(4); };

  const finishCheckIn = useCallback(() => {
    const skin = { overall: skinOverall, signals: skinSignals };
    const data = { condition, sleep, energy, mood, skin };
    const score = calcScore(data);
    const yScore = getYesterdayScore();
    const insight = generateInsight(data, score);
    const recs = generateRecommendations(data, score);
    const streak = getStreak() + 1;

    const finalData = {
      ...data, type: 'morning', completedAt: new Date().toISOString(),
      totalScore: score.totalScore, breakdown: score.breakdown,
      insight, recommendations: recs, streak, previousScore: yScore,
    };
    saveCheckIn(finalData);

    // lua_record_v2에 수면 동기화
    if (sleep?.duration) {
      try {
        const allRec = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
        const todayKey = getTodayKey();
        const rec = allRec[todayKey] || { date: todayKey };
        const hourMap = { '0-5': 4, '5-6': 5.5, '6-7': 6.5, '7-8': 7.5, '8+': 8.5 };
        const qualMap = { 1: '얕은 수면', 2: '얕은 수면', 3: '보통', 4: '깊은 수면', 5: '깊은 수면' };
        rec.sleep = { hours: hourMap[sleep.duration] || 7, quality: sleep.quality ? qualMap[sleep.quality] : null, bedtime: rec.sleep?.bedtime || null, wakeTime: rec.sleep?.wakeTime || null };
        allRec[todayKey] = rec;
        localStorage.setItem('lua_record_v2', JSON.stringify(allRec));
      } catch {}
    }

    setResult({ ...score, insight, recommendations: recs, streak, delta: yScore != null ? score.totalScore - yScore : null });
    setRecommendations(recs);
    setStep(5);
  }, [condition, sleep, energy, mood, skinOverall, skinSignals]);

  const handleSkip = () => { hapticLight(); if (step === 1) { onClose?.(); return; } if (step === 4) { finishCheckIn(); return; } setStep(s => s + 1); };
  const handleClose = () => { hapticLight(); onClose?.(); };
  const handleDone = () => { hapticLight(); onComplete?.(); };

  const toggleRec = (id) => {
    const updated = recommendations.map(r => r.id === id ? { ...r, completed: !r.completed } : r);
    setRecommendations(updated);
    saveCheckIn({ recommendations: updated });
  };

  const toggleSignal = (id) => {
    hapticLight();
    setSkinSignals(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  /* ── Progress Bar ── */
  const ProgressBar = ({ current, total, coral }) => (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: 18, height: 3, borderRadius: 2,
          background: i < current ? (coral ? '#B8865C' : palette.accent) : (palette.isDark ? 'rgba(255,255,255,0.2)' : `${palette.accent}33`),
          transition: 'background 0.2s',
        }} />
      ))}
    </div>
  );

  const navStyle = { padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 };
  const closeBtn = (
    <div onClick={handleClose} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={palette.textSecondary} strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </div>
  );
  const skipBtn = <div onClick={handleSkip} style={{ fontSize: 12, color: palette.textHint, cursor: 'pointer', padding: '8px 0' }}>건너뛰기</div>;
  const optionStyle = (selected) => ({
    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 16, cursor: 'pointer',
    background: selected ? palette.accent : (palette.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'),
    border: selected ? 'none' : (palette.isDark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(255,255,255,0.8)'),
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', transition: 'background 0.15s',
  });

  /* ── STEP 1: 컨디션 ── */
  if (step === 1) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: palette.bg, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={navStyle}>{closeBtn}<ProgressBar current={1} total={totalSteps} />{skipBtn}</div>
      <div style={{ padding: '0 30px' }}>
        <div style={{ fontSize: 19, fontWeight: 500, color: palette.textPrimary, lineHeight: 1.4, letterSpacing: -0.3, marginBottom: 10, whiteSpace: 'pre-line' }}>
          지금 컨디션이{'\n'}어떤 거에 가까워요?
        </div>
        <div style={{ fontSize: 12, color: palette.textHint, marginBottom: 32 }}>직감으로 골라주세요. 1초면 충분해요.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {CONDITION_OPTIONS.map(opt => {
            const selected = condition?.value === opt.value;
            return (
              <div key={opt.value} onClick={() => handleConditionSelect(opt)} style={optionStyle(selected)}>
                <span style={{ fontSize: 24 }}>{opt.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: selected ? '#fff' : palette.textPrimary }}>{opt.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  /* ── STEP 2: 수면 ── */
  if (step === 2) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: palette.bg, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={navStyle}>{closeBtn}<ProgressBar current={2} total={totalSteps} />{skipBtn}</div>
      <div style={{ padding: '0 30px' }}>
        <div style={{ fontSize: 19, fontWeight: 500, color: palette.textPrimary, lineHeight: 1.4, letterSpacing: -0.3, marginBottom: 10, whiteSpace: 'pre-line' }}>
          어젯밤 잠은{'\n'}어땠어요?
        </div>
        <div style={{ fontSize: 12, color: palette.textHint, marginBottom: 32 }}>대략적으로 골라도 충분해요.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SLEEP_OPTIONS.map(opt => {
            const selected = sleep?.duration === opt.value;
            return (
              <div key={opt.value} onClick={() => handleSleepSelect(opt)} style={{
                ...optionStyle(selected), justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: selected ? '#fff' : palette.textPrimary }}>{opt.label}</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: selected ? 'rgba(255,255,255,0.7)' : opt.color }}>{opt.status}</span>
              </div>
            );
          })}
        </div>
        {/* 잠의 질 */}
        <div style={{
          padding: '14px 18px', marginTop: 20, borderRadius: 16,
          background: palette.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.6)',
          border: palette.isDark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(255,255,255,0.8)',
          backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 11, color: palette.textSecondary }}>잠의 질은 어땠어요?</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(v => (
              <div key={v} onClick={() => handleSleepQualitySelect(v)} style={{
                width: 14, height: 14, borderRadius: '50%', cursor: 'pointer',
                background: sleepQuality != null && v <= sleepQuality ? palette.accent : (palette.isDark ? 'rgba(255,255,255,0.2)' : `${palette.accent}33`),
                transition: 'background 0.15s',
              }} />
            ))}
          </div>
        </div>
        {sleep?.duration && (
          <button onClick={() => { hapticLight(); setStep(3); }} style={{
            width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
            background: palette.accent, color: '#fff', fontSize: 14, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit', marginTop: 24,
          }}>다음</button>
        )}
      </div>
    </div>
  );

  /* ── STEP 3: 에너지·기분 (2개만) ── */
  if (step === 3) {
    const sliders = [
      { key: 'energy', icon: '⚡', label: '몸의 에너지', value: energy, set: setEnergy, left: '늘어짐', right: '활기참' },
      { key: 'mood', icon: '🙂', label: '마음의 기분', value: mood, set: setMood, left: '가라앉음', right: '밝음' },
    ];
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: palette.bg, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={navStyle}>{closeBtn}<ProgressBar current={3} total={totalSteps} />{skipBtn}</div>
        <div style={{ padding: '0 30px' }}>
          <div style={{ fontSize: 19, fontWeight: 500, color: palette.textPrimary, lineHeight: 1.4, letterSpacing: -0.3, marginBottom: 10, whiteSpace: 'pre-line' }}>
            지금 몸과 마음은{'\n'}어떤 상태예요?
          </div>
          <div style={{ fontSize: 12, color: palette.textHint, marginBottom: 32 }}>슬라이더로 빠르게 표시해주세요.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {sliders.map(s => {
              const info = getSliderLabel(s.value);
              return (
                <div key={s.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: palette.textSecondary }}>{s.icon} {s.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: info.color }}>{info.text}</span>
                  </div>
                  <div style={{ position: 'relative', height: 18, display: 'flex', alignItems: 'center' }}>
                    <div style={{ position: 'absolute', left: 0, right: 0, height: 8, borderRadius: 4, background: palette.isDark ? 'rgba(255,255,255,0.1)' : `${palette.accent}1a` }} />
                    <div style={{ position: 'absolute', left: 0, height: 8, borderRadius: 4, width: `${s.value}%`, background: `linear-gradient(90deg, ${palette.accent}40, ${info.color})`, transition: 'width 0.05s' }} />
                    <input type="range" min="0" max="100" value={s.value}
                      onChange={e => s.set(parseInt(e.target.value))}
                      style={{ position: 'absolute', left: 0, right: 0, width: '100%', height: 18, appearance: 'none', WebkitAppearance: 'none', background: 'transparent', outline: 'none', margin: 0, cursor: 'pointer' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontSize: 10, color: palette.textHint }}>{s.left}</span>
                    <span style={{ fontSize: 10, color: palette.textHint }}>{s.right}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{
            padding: '12px 16px', marginTop: 28, borderRadius: 14,
            background: palette.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.4)',
            border: palette.isDark ? '0.5px solid rgba(255,255,255,0.1)' : 'none',
          }}>
            <span style={{ fontSize: 11, color: palette.textHint, lineHeight: 1.5 }}>💡 집중력은 저녁 체크인에서 회고해요</span>
          </div>
          <button onClick={handleVitalsNext} style={{
            width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
            background: palette.accent, color: '#fff', fontSize: 14, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit', marginTop: 24,
          }}>다음</button>
        </div>
        <style>{`
          input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none;
            width: 18px; height: 18px; border-radius: 50%;
            background: #fff; border: 2px solid ${palette.accent};
            box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          }
        `}</style>
      </div>
    );
  }

  /* ── STEP 4: 피부 자가 체크 ── */
  if (step === 4) {
    const signalBg = (sig, selected) => {
      if (!selected) return palette.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)';
      if (sig.tone === 'positive') return 'rgba(94,157,138,0.15)';
      if (sig.tone === 'warning') return 'rgba(184,134,92,0.15)';
      return 'rgba(201,124,94,0.15)';
    };
    const signalColor = (sig, selected) => {
      if (!selected) return palette.textSecondary;
      if (sig.tone === 'positive') return '#5E9D8A';
      if (sig.tone === 'warning') return '#B8865C';
      return '#C97C5E';
    };
    const signalBorder = (sig, selected) => {
      if (!selected) return palette.isDark ? '0.5px solid rgba(255,255,255,0.12)' : '0.5px solid rgba(255,255,255,0.8)';
      if (sig.tone === 'positive') return '1px solid rgba(94,157,138,0.3)';
      if (sig.tone === 'warning') return '1px solid rgba(184,134,92,0.3)';
      return '1px solid rgba(201,124,94,0.3)';
    };

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: palette.bg, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={navStyle}>{closeBtn}<ProgressBar current={4} total={totalSteps} />{skipBtn}</div>
        <div style={{ padding: '0 30px', paddingBottom: 40 }}>
          <div style={{ fontSize: 19, fontWeight: 500, color: palette.textPrimary, lineHeight: 1.4, letterSpacing: -0.3, marginBottom: 10, whiteSpace: 'pre-line' }}>
            오늘 피부 어때요?
          </div>
          <div style={{ fontSize: 12, color: palette.textHint, marginBottom: 28 }}>거울 보고 1초만에 끝나요. 해당하는 거 모두 골라주세요.</div>

          {/* 전체 컨디션 4단계 */}
          <div style={{ fontSize: 11, color: palette.textHint, marginBottom: 10, letterSpacing: 0.5 }}>전체 느낌</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {SKIN_OVERALL.map(opt => {
              const selected = skinOverall === opt.value;
              return (
                <div key={opt.value} onClick={() => { hapticLight(); setSkinOverall(selected ? null : opt.value); }} style={{
                  flex: 1, textAlign: 'center', padding: '12px 0', borderRadius: 14, cursor: 'pointer',
                  background: selected ? palette.accent : (palette.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)'),
                  border: selected ? 'none' : (palette.isDark ? '0.5px solid rgba(255,255,255,0.12)' : '0.5px solid rgba(255,255,255,0.8)'),
                  transition: 'background 0.15s',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{opt.emoji}</div>
                  <div style={{ fontSize: 10, fontWeight: 500, color: selected ? '#fff' : palette.textSecondary }}>{opt.label}</div>
                </div>
              );
            })}
          </div>

          {/* 신호 칩 8개 */}
          <div style={{ fontSize: 11, color: palette.textHint, marginBottom: 10, letterSpacing: 0.5 }}>오늘의 신호</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {SKIN_SIGNALS.map(sig => {
              const selected = skinSignals.includes(sig.id);
              return (
                <div key={sig.id} onClick={() => toggleSignal(sig.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                  background: signalBg(sig, selected),
                  border: signalBorder(sig, selected),
                  transition: 'all 0.15s',
                }}>
                  <span style={{ fontSize: 14 }}>{sig.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: selected ? 600 : 400, color: signalColor(sig, selected) }}>{sig.label}</span>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: palette.textHint, marginBottom: 24 }}>선택 안 해도 괜찮아요</div>

          <button onClick={() => { hapticLight(); finishCheckIn(); }} style={{
            width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
            background: palette.accent, color: '#fff', fontSize: 14, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>체크인 완료</button>
        </div>
      </div>
    );
  }

  /* ── STEP 5: 결과 화면 ── */
  if (step === 5 && result) {
    const bd = result.breakdown;
    const indicators = [
      { icon: '⚡', label: '에너지', status: bd.energy.label, score: bd.energy.score },
      { icon: '🙂', label: '기분', status: bd.mood.label, score: bd.mood.score },
      { icon: '🎯', label: '집중', status: bd.focus.label, score: bd.focus.score },
      { icon: '🫧', label: '피부', status: bd.body.label, score: bd.body.score },
    ];
    const getIndColor = (score) => score == null ? '#8BA6BD' : score >= 70 ? '#5E9D8A' : score >= 50 ? '#4A6B85' : score >= 30 ? '#B8865C' : '#C97C5E';
    const streak = result.streak;
    let streakMsg = streak >= 30 ? `👑 ${streak}일째 함께해요` : streak >= 14 ? `✨ ${streak}일 연속 체크인 중` : streak >= 7 ? '🎉 일주일 달성!' : streak >= 2 ? `🔥 ${streak}일 연속` : '🌱 첫 체크인 완료';

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: RESULT_GRADIENT, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 30 }}>
          <ProgressBar current={5} total={totalSteps + 1} coral />
        </div>
        <div style={{ padding: '0 26px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#6B5A4E', marginBottom: 8, letterSpacing: 0.5 }}>{nickname ? `${nickname}님의 오늘` : '오늘의 점수'}</div>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 50, fontWeight: 500, color: '#4A3A2E', letterSpacing: -1.5, fontFamily: 'var(--font-display)' }}>{result.totalScore}</span>
            <span style={{ fontSize: 13, color: '#8A5A3C', marginLeft: 4 }}>/ 100</span>
          </div>
          {result.delta != null && (
            <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 10, background: 'rgba(255,220,195,0.6)', fontSize: 11, color: '#B8865C' }}>
              어제보다 {result.delta >= 0 ? '↑' : '↓'} {Math.abs(result.delta)}점
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 24, marginBottom: 20 }}>
            {indicators.map(ind => (
              <div key={ind.label} style={{ flex: 1, textAlign: 'center', padding: '12px 0 10px', background: 'rgba(255,255,255,0.5)', borderRadius: 14 }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{ind.icon}</div>
                <div style={{ fontSize: 10, color: '#8A5A3C', marginBottom: 3 }}>{ind.label}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: getIndColor(ind.score) }}>{ind.status}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '0 22px' }}>
          <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#8A5A3C', marginBottom: 10, fontWeight: 500 }}>🔍 오늘의 인사이트</div>
            <div style={{ fontSize: 12, color: '#4A3A2E', lineHeight: 1.7, wordBreak: 'keep-all' }}>{result.insight}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#8A5A3C', marginBottom: 10, fontWeight: 500 }}>🌿 오늘 추천 (탭하면 체크)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recommendations.map(r => (
                <div key={r.id} onClick={() => toggleRec(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: r.completed ? 'none' : '1.5px solid #D4A878', background: r.completed ? '#5E9D8A' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {r.completed && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>}
                  </div>
                  <span style={{ fontSize: 11, color: '#4A3A2E', textDecoration: r.completed ? 'line-through' : 'none', opacity: r.completed ? 0.5 : 1 }}>{r.text}</span>
                </div>
              ))}
            </div>
          </div>
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
    { icon: '🎯', label: '집중', score: bd.focus?.score, status: bd.focus?.label || '저녁에 회고' },
    { icon: '🫧', label: '피부', score: bd.body?.score || 50, status: bd.body?.label || '보통' },
  ];
  const getColor = (s) => s == null ? '#8BA6BD' : s >= 70 ? '#5E9D8A' : s >= 50 ? '#4A6B85' : s >= 30 ? '#B8865C' : '#C97C5E';
  const delta = data.previousScore != null ? data.totalScore - data.previousScore : null;
  const streak = data.streak || 0;
  let streakMsg = streak >= 30 ? `👑 ${streak}일째 함께해요` : streak >= 14 ? `✨ ${streak}일 연속` : streak >= 7 ? '🎉 일주일 달성!' : streak >= 2 ? `🔥 ${streak}일 연속` : '🌱 첫 체크인';
  const doneCount = recs.filter(r => r.completed).length;

  const toggleRec = (id) => {
    const updated = recs.map(r => r.id === id ? { ...r, completed: !r.completed } : r);
    setRecs(updated);
    try { const all = JSON.parse(localStorage.getItem(CHECKIN_KEY) || '{}'); if (all[getTodayKey()]) { all[getTodayKey()].recommendations = updated; localStorage.setItem(CHECKIN_KEY, JSON.stringify(all)); } } catch {}
  };

  const glassLight = {
    background: 'rgba(255,255,255,0.45)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.5)', borderRadius: 22,
    boxShadow: '0 2px 8px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.4)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 메인 점수 */}
      <div style={{ ...glassLight, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 32, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: -1 }}>{data.totalScore}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted, #8BA6BD)' }}>/100</span>
          </div>
          {delta != null && (
            <span style={{ fontSize: 11, color: delta >= 0 ? '#5E9D8A' : '#C97C5E', fontWeight: 500 }}>
              {delta >= 0 ? '↑' : '↓'} 어제보다 {Math.abs(delta)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {indicators.map(ind => (
            <div key={ind.label} style={{ flex: 1, textAlign: 'center', padding: '10px 0 8px', background: 'rgba(0,0,0,0.02)', borderRadius: 14 }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{ind.icon}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted, #8BA6BD)', marginBottom: 2 }}>{ind.label}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: getColor(ind.score) }}>{ind.status}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 인사이트 */}
      {data.insight && (
        <div style={{ ...glassLight, background: 'rgba(255,235,210,0.35)', border: '1px solid rgba(255,220,195,0.4)', padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: '#8A5A3C', marginBottom: 8, fontWeight: 500 }}>🔍 오늘 인사이트</div>
          <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.7, wordBreak: 'keep-all' }}>{data.insight}</div>
        </div>
      )}

      {/* 추천 */}
      {recs.length > 0 && (
        <div style={{ ...glassLight, background: 'rgba(255,235,210,0.2)', border: '1px solid rgba(255,220,195,0.3)', padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: '#8A5A3C', marginBottom: 8, fontWeight: 500 }}>🌿 오늘 {doneCount}/{recs.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recs.map(r => (
              <div key={r.id} onClick={() => toggleRec(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, border: r.completed ? 'none' : '1.5px solid #D4A878', background: r.completed ? '#5E9D8A' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {r.completed && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-primary)', textDecoration: r.completed ? 'line-through' : 'none', opacity: r.completed ? 0.5 : 1 }}>{r.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 연속 기록 */}
      <div style={{ ...glassLight, background: 'rgba(238,237,254,0.3)', border: '1px solid rgba(238,237,254,0.4)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{streakMsg}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted, #8BA6BD)" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6"/></svg>
      </div>
    </div>
  );
}
