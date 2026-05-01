import { useState, useCallback } from 'react';
import { hapticLight } from '../utils/haptic';
import { getProfile } from '../storage/ProfileStorage';

/* ── 상수 ── */
const AFTERNOON_KEY = 'lua_afternoon_checkin';

const CONDITION_OPTIONS = [
  { value: 'drowsy', emoji: '🥱', label: '졸리고 무거워요', sub: '식곤증이 와요' },
  { value: 'similar', emoji: '😐', label: '아침이랑 비슷해요', sub: '큰 변화 없음' },
  { value: 'energized', emoji: '🙂', label: '힘이 좀 났어요', sub: '기운 회복' },
  { value: 'vibrant', emoji: '⚡', label: '활기차요', sub: '에너지가 충전됨' },
];

const ENERGY_CHANGE_OPTIONS = [
  { value: 'drop_a_lot', delta: -10, emoji: '😴', label: '많이 떨어졌어요', arrow: '↓↓', color: '#C97C5E' },
  { value: 'drop_slight', delta: -5, emoji: '🥱', label: '살짝 떨어졌어요', arrow: '↓', color: '#B8865C' },
  { value: 'similar', delta: 0, emoji: '😐', label: '비슷해요', arrow: '→', color: '#6B8499' },
  { value: 'up', delta: 5, emoji: '⚡', label: '더 활기차요', arrow: '↑', color: '#5E9D8A' },
];

const DISCOMFORT_SIGNALS = [
  { id: 'sleepy', emoji: '🥱', label: '졸려요', group: 'negative' },
  { id: 'sweet_craving', emoji: '🍫', label: '단 게 당겨요', group: 'negative' },
  { id: 'brain_fog', emoji: '😵', label: '머리가 멍해요', group: 'neutral' },
  { id: 'more_coffee', emoji: '☕', label: '커피 한 잔 더', group: 'neutral' },
  { id: 'bloating', emoji: '🤤', label: '속이 더부룩', group: 'neutral' },
  { id: 'puffy', emoji: '🎈', label: '붓는 느낌', group: 'neutral' },
  { id: 'tension', emoji: '😣', label: '긴장감', group: 'neutral' },
  { id: 'thirsty', emoji: '💧', label: '목마름', group: 'neutral' },
  { id: 'all_good', emoji: '✨', label: '다 괜찮음', group: 'positive' },
];

const LUNCH_CATEGORIES = ['한식', '분식', '파스타', '샐러드', '중식', '일식', '패스트푸드', '빵·디저트', '안 먹음', '기타'];

/* ── 스타일 ── */
const ACCENT = '#B8865C';
const TXT = { p: '#4A3A2E', s: '#6B5A4E', t: '#6B8499', a: '#8A5A3C', h: '#8BA6BD' };
const BG = 'linear-gradient(180deg, #B8DCEF 0%, #D4E8F4 50%, #E8F1F7 100%)';
const RESULT_BG = 'linear-gradient(180deg, #FFF5EB 0%, #FFE8D6 100%)';

/* ── 유틸 ── */
function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function loadTodayAfternoonCheckIn() {
  try {
    const all = JSON.parse(localStorage.getItem(AFTERNOON_KEY) || '{}');
    const today = all[getTodayKey()];
    if (today?.completedAt) return today;
  } catch {}
  return null;
}

function saveAfternoon(data) {
  try {
    const key = getTodayKey();
    const all = JSON.parse(localStorage.getItem(AFTERNOON_KEY) || '{}');
    all[key] = { ...all[key], ...data, date: key };
    localStorage.setItem(AFTERNOON_KEY, JSON.stringify(all));
  } catch {}
}

function getMorningScore() {
  try {
    const all = JSON.parse(localStorage.getItem('lua_morning_checkin') || '{}');
    return all[getTodayKey()]?.totalScore || null;
  } catch { return null; }
}

/* ── 추천 매칭 ── */
function getRecommendations(condition, change, signals) {
  const recs = [];
  const has = (id) => signals.includes(id);

  if (has('bloating')) { recs.push({ id: 'water_warm', icon: '💧', text: '따뜻한 물', reason: '림프 순환' }); recs.push({ id: 'legs_up', icon: '🦵', text: '다리 올리기 5분', reason: '부종 완화' }); }
  if (has('tension')) { recs.push({ id: 'breath_5', icon: '🌬️', text: '깊게 숨 5번', reason: '진정' }); recs.push({ id: 'tea_warm', icon: '🫖', text: '따뜻한 차', reason: '진정' }); }
  if (has('sweet_craving')) { recs.push({ id: 'nuts', icon: '🥜', text: '견과류 한 줌', reason: '혈당 천천히' }); recs.push({ id: 'water_500', icon: '💧', text: '물 500ml', reason: '포만감' }); }
  if (has('sleepy') || condition === 'drowsy') { recs.push({ id: 'water_glass', icon: '💧', text: '물 한 컵 마시기', reason: '혈당 안정' }); recs.push({ id: 'walk_5min', icon: '🚶', text: '5분 산책', reason: '혈액 순환' }); }
  if (has('brain_fog')) { recs.push({ id: 'sun_5min', icon: '☀', text: '햇빛 5분', reason: '멜라토닌 리셋' }); recs.push({ id: 'fruit', icon: '🍎', text: '과일 한 조각', reason: '천연 당' }); }
  if (has('more_coffee')) recs.push({ id: 'tea_mint', icon: '🌿', text: '박하차', reason: '각성' });

  if (recs.length === 0) {
    recs.push({ id: 'water_glass', icon: '💧', text: '물 한 컵', reason: '' });
    recs.push({ id: 'walk_5min', icon: '🚶', text: '5분 산책', reason: '' });
    recs.push({ id: 'ventilate', icon: '🌬️', text: '창문 열고 환기', reason: '' });
  }

  // 중복 제거 + 3개
  const seen = new Set();
  return recs.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; }).slice(0, 3);
}

/* ── 연속 기록 ── */
function getStreak() {
  try {
    const all = JSON.parse(localStorage.getItem(AFTERNOON_KEY) || '{}');
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

/* ============================================= */
export default function AfternoonCheckIn({ onClose, onComplete }) {
  const nickname = getProfile().nickname || '';
  const morningScore = getMorningScore();

  const [step, setStep] = useState(1);
  const [condition, setCondition] = useState(null);
  const [energyChange, setEnergyChange] = useState(null);
  const [signals, setSignals] = useState([]);
  const [lunchCat, setLunchCat] = useState(null);
  const [result, setResult] = useState(null);

  const totalSteps = 3;

  const finishCheckIn = useCallback(() => {
    const delta = energyChange?.delta || 0;
    const currentScore = morningScore != null ? Math.max(0, Math.min(100, morningScore + delta)) : null;
    const recs = getRecommendations(condition?.value, energyChange?.value, signals);
    const streak = getStreak() + 1;

    // 패턴 메시지
    let patternMsg = '오늘 점심이 살짝 무거웠나봐요. 가벼운 산책으로 회복해볼까요?';
    if (signals.includes('all_good')) patternMsg = '점심 후에도 컨디션 유지를 잘하시네요!';

    const finalData = {
      type: 'afternoon', completedAt: new Date().toISOString(),
      afterMealCondition: condition,
      energyChange: { direction: energyChange?.value, delta, morningReference: morningScore, currentEstimate: currentScore, label: energyChange?.label },
      discomfortSignals: signals, lunchCategory: lunchCat,
      recommendations: recs, patternMessage: patternMsg, streak,
    };
    saveAfternoon(finalData);
    setResult({ ...finalData, currentScore });
    setStep(4);
  }, [condition, energyChange, signals, lunchCat, morningScore]);

  const handleSkip = () => { hapticLight(); if (step === 1) { onClose?.(); return; } if (step === 3) { finishCheckIn(); return; } setStep(s => s + 1); };

  const toggleSignal = (id) => {
    hapticLight();
    if (id === 'all_good') { setSignals(prev => prev.includes('all_good') ? [] : ['all_good']); return; }
    setSignals(prev => {
      const next = prev.filter(s => s !== 'all_good');
      return next.includes(id) ? next.filter(s => s !== id) : [...next, id];
    });
  };

  /* ── Progress Bar ── */
  const ProgressBar = ({ current, total, coral }) => (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ width: 28, height: 3, borderRadius: 2, background: i < current ? (coral ? ACCENT : ACCENT) : `${ACCENT}40`, transition: 'background 0.2s' }} />
      ))}
    </div>
  );

  const navStyle = { padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 };
  const closeBtn = (
    <div onClick={() => { hapticLight(); onClose?.(); }} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={TXT.a} strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </div>
  );
  const skipBtn = <div onClick={handleSkip} style={{ fontSize: 11, color: TXT.a, cursor: 'pointer', padding: '8px 0' }}>건너뛰기</div>;

  const optStyle = (selected) => ({
    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16, cursor: 'pointer',
    background: selected ? ACCENT : 'rgba(255,255,255,0.5)', transition: 'background 0.15s',
  });

  /* ── STEP 1: 식후 컨디션 ── */
  if (step === 1) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: BG, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={navStyle}>{closeBtn}<ProgressBar current={1} total={totalSteps} />{skipBtn}</div>
      <div style={{ padding: '0 24px' }}>
        <div style={{ fontSize: 19, fontWeight: 500, color: TXT.p, lineHeight: 1.4, letterSpacing: -0.3, marginBottom: 10 }}>
          점심 후, 지금 어떤 느낌이에요?
        </div>
        <div style={{ fontSize: 12, color: TXT.t, lineHeight: 1.6, marginBottom: 28 }}>1초만 자기 몸에 집중해보세요.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {CONDITION_OPTIONS.map(opt => {
            const sel = condition?.value === opt.value;
            return (
              <div key={opt.value} onClick={() => { hapticLight(); setCondition(opt); saveAfternoon({ afterMealCondition: opt }); setTimeout(() => setStep(2), 200); }} style={optStyle(sel)}>
                <span style={{ fontSize: 24 }}>{opt.emoji}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: sel ? '#fff' : TXT.p }}>{opt.label}</div>
                  <div style={{ fontSize: 10, color: sel ? 'rgba(255,255,255,0.8)' : TXT.a, marginTop: 2 }}>{opt.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  /* ── STEP 2: 에너지 변화 ── */
  if (step === 2) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: BG, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={navStyle}>{closeBtn}<ProgressBar current={2} total={totalSteps} />{skipBtn}</div>
      <div style={{ padding: '0 24px' }}>
        <div style={{ fontSize: 19, fontWeight: 500, color: TXT.p, lineHeight: 1.4, letterSpacing: -0.3, marginBottom: 10, whiteSpace: 'pre-line' }}>
          오전과 비교하면{'\n'}지금 에너지는?
        </div>
        <div style={{ fontSize: 12, color: TXT.t, marginBottom: 24 }}>점심이 어떤 영향을 줬는지 봐요.</div>

        {/* 비교 시각화 */}
        {morningScore != null && (
          <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 18, padding: 18, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: TXT.h, marginBottom: 4 }}>오전</div>
              <div style={{ fontSize: 20 }}>{morningScore >= 70 ? '⚡' : morningScore >= 40 ? '😐' : '😴'}</div>
              <div style={{ fontSize: 10, color: TXT.t, marginTop: 2 }}>{morningScore >= 70 ? '활기' : morningScore >= 40 ? '평소' : '낮음'}</div>
            </div>
            <div style={{ fontSize: 14, color: ACCENT }}>→</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: TXT.h, marginBottom: 4 }}>지금</div>
              <div style={{ fontSize: 20 }}>{condition?.emoji || '❓'}</div>
              <div style={{ fontSize: 10, color: condition?.value === 'drowsy' ? '#C97C5E' : condition?.value === 'vibrant' ? '#5E9D8A' : TXT.t, marginTop: 2 }}>
                {{ drowsy: '떨어짐', similar: '비슷', energized: '회복', vibrant: '활기' }[condition?.value] || ''}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ENERGY_CHANGE_OPTIONS.map(opt => {
            const sel = energyChange?.value === opt.value;
            return (
              <div key={opt.value} onClick={() => { hapticLight(); setEnergyChange(opt); saveAfternoon({ energyChange: opt }); setTimeout(() => setStep(3), 200); }} style={{
                ...optStyle(sel), justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 18 }}>{opt.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: sel ? 500 : 400, color: sel ? '#fff' : TXT.p }}>{opt.label}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: sel ? 'rgba(255,255,255,0.85)' : opt.color }}>{opt.arrow}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  /* ── STEP 3: 불편 신호 + 점심 메뉴 ── */
  if (step === 3) {
    const chipBg = (sig, sel) => {
      if (!sel) {
        if (sig.group === 'negative') return 'rgba(184,134,92,0.18)';
        if (sig.group === 'positive') return 'rgba(94,157,138,0.18)';
        return 'rgba(255,255,255,0.5)';
      }
      if (sig.group === 'positive') return 'rgba(94,157,138,0.45)';
      if (sig.group === 'negative') return 'rgba(184,134,92,0.45)';
      return `${ACCENT}70`;
    };
    const chipColor = (sig, sel) => {
      if (sel) return '#fff';
      if (sig.group === 'negative') return '#6B4A2A';
      if (sig.group === 'positive') return '#2E6E5A';
      return TXT.p;
    };
    const chipBorder = (sig, sel) => {
      if (sel) return 'none';
      if (sig.group === 'negative') return '0.5px solid rgba(184,134,92,0.4)';
      if (sig.group === 'positive') return '0.5px solid rgba(94,157,138,0.4)';
      return '0.5px solid rgba(74,107,133,0.2)';
    };

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: BG, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={navStyle}>{closeBtn}<ProgressBar current={3} total={totalSteps} />{skipBtn}</div>
        <div style={{ padding: '0 24px', paddingBottom: 40 }}>
          <div style={{ fontSize: 19, fontWeight: 500, color: TXT.p, lineHeight: 1.4, letterSpacing: -0.3, marginBottom: 10 }}>
            혹시 신경 쓰이는 게 있어요?
          </div>
          <div style={{ fontSize: 12, color: TXT.t, marginBottom: 24 }}>해당하는 거 모두 골라주세요. 없으면 건너뛰어도 돼요.</div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {DISCOMFORT_SIGNALS.map(sig => {
              const sel = signals.includes(sig.id);
              return (
                <div key={sig.id} onClick={() => toggleSignal(sig.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 14, cursor: 'pointer',
                  background: chipBg(sig, sel), border: chipBorder(sig, sel), transition: 'all 0.15s',
                }}>
                  <span style={{ fontSize: 11 }}>{sig.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: sel ? 500 : 400, color: chipColor(sig, sel) }}>{sig.label}</span>
                </div>
              );
            })}
          </div>

          {/* 점심 메뉴 */}
          <div style={{ background: 'rgba(255,255,255,0.4)', borderRadius: 12, padding: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: TXT.a, marginBottom: 4 }}>💡 점심 메뉴 (선택)</div>
            <div style={{ fontSize: 11, color: TXT.p, marginBottom: 8 }}>무얼 드셨어요?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {LUNCH_CATEGORIES.map(cat => {
                const sel = lunchCat === cat;
                return (
                  <div key={cat} onClick={() => { hapticLight(); setLunchCat(sel ? null : cat); }} style={{
                    padding: '4px 10px', borderRadius: 10, fontSize: 10, cursor: 'pointer',
                    background: sel ? `${ACCENT}66` : 'rgba(255,255,255,0.6)',
                    color: sel ? '#fff' : TXT.p, fontWeight: sel ? 500 : 400, transition: 'all 0.15s',
                  }}>{cat}</div>
                );
              })}
            </div>
          </div>

          <button onClick={() => { hapticLight(); finishCheckIn(); }} style={{
            width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
            background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>체크인 완료</button>
          <div style={{ textAlign: 'center', fontSize: 10, color: TXT.h, marginTop: 8 }}>선택 안 해도 돼요</div>
        </div>
      </div>
    );
  }

  /* ── STEP 4: 결과 화면 ── */
  if (step === 4 && result) {
    const ms = result.energyChange?.morningReference;
    const cs = result.currentScore;
    const delta = result.energyChange?.delta || 0;
    const recs = result.recommendations || [];
    const streak = result.streak || 0;

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: RESULT_BG, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 22px 0', display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <ProgressBar current={3} total={totalSteps} coral />
        </div>
        <div style={{ padding: '0 22px', paddingBottom: 40 }}>
          {/* 변화 카드 */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: TXT.s, marginBottom: 14 }}>아침 → 지금</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: TXT.h }}>아침</div>
                <div style={{ fontSize: 22, fontWeight: 500, color: TXT.p }}>{ms ?? '--'}</div>
              </div>
              <div style={{ fontSize: 18, color: ACCENT }}>→</div>
              <div>
                <div style={{ fontSize: 11, color: TXT.a }}>지금</div>
                <div style={{ fontSize: 28, fontWeight: 500, color: TXT.p, letterSpacing: -1 }}>{cs ?? '--'}</div>
              </div>
            </div>
            {delta !== 0 && (
              <div style={{
                display: 'inline-block', padding: '4px 12px', borderRadius: 10, fontSize: 11,
                background: delta < 0 ? 'rgba(201,124,94,0.15)' : 'rgba(94,157,138,0.15)',
                color: delta < 0 ? '#C97C5E' : '#5E9D8A',
              }}>
                {delta < 0 ? '↓' : '↑'} {Math.abs(delta)}점 {delta < 0 ? '떨어짐' : '회복됨'}
                {result.afterMealCondition?.value === 'drowsy' ? ' · 식곤증' : ''}
              </div>
            )}
            {delta === 0 && <div style={{ fontSize: 11, color: TXT.t }}>→ 비슷한 컨디션</div>}
          </div>

          {/* 패턴 카드 */}
          <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 16, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: TXT.a, letterSpacing: 0.5, marginBottom: 8 }}>🔍 lua가 발견한 패턴</div>
            <div style={{ fontSize: 12, color: TXT.p, lineHeight: 1.7, wordBreak: 'keep-all' }}>{result.patternMessage}</div>
          </div>

          {/* 추천 */}
          <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 16, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: TXT.a, letterSpacing: 0.5, marginBottom: 8 }}>🌿 오후를 잘 보내려면</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recs.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.6)' }}>
                  <span style={{ fontSize: 13 }}>{r.icon}</span>
                  <span style={{ fontSize: 11, color: TXT.p }}>{r.text}{r.reason ? ` (${r.reason})` : ''}</span>
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => { hapticLight(); onComplete?.(); }} style={{
            width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
            background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>오후 잘 보내기</button>
        </div>
      </div>
    );
  }

  return null;
}

/* ── 체크인 후 홈 요약 ── */
export function AfternoonSummaryCard() {
  const data = loadTodayAfternoonCheckIn();
  if (!data) return null;

  const ms = data.energyChange?.morningReference;
  const cs = data.energyChange?.currentEstimate ?? data.currentScore;
  const delta = data.energyChange?.delta || 0;
  const recs = data.recommendations || [];
  const streak = data.streak || 0;
  let streakMsg = streak >= 14 ? `✨ ${streak}일 연속` : streak >= 7 ? '🎉 일주일!' : streak >= 2 ? `🔥 ${streak}일 연속` : '🌱 첫 오후 체크인';

  const glass = {
    background: 'rgba(255,255,255,0.45)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.5)', borderRadius: 22,
    boxShadow: '0 2px 8px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.4)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 오늘의 흐름 */}
      <div style={{ ...glass, padding: '14px 16px' }}>
        <div style={{ fontSize: 10, color: TXT.a, marginBottom: 10 }}>오늘의 흐름</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: TXT.h }}>☀ 아침</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>{ms ?? '--'}</div>
          </div>
          <div style={{ fontSize: 12, color: delta < 0 ? '#C97C5E' : delta > 0 ? '#5E9D8A' : TXT.h }}>{delta < 0 ? '↓' : delta > 0 ? '↑' : '→'}</div>
          <div style={{ textAlign: 'center', background: 'rgba(184,134,92,0.18)', borderRadius: 12, padding: '6px 12px' }}>
            <div style={{ fontSize: 11, color: TXT.a }}>🍽 오후</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>{cs ?? '--'}</div>
          </div>
          <div style={{ fontSize: 12, color: TXT.h, opacity: 0.5 }}>→</div>
          <div style={{ textAlign: 'center', opacity: 0.4 }}>
            <div style={{ fontSize: 11, color: TXT.h }}>🌙 저녁</div>
            <div style={{ fontSize: 16, color: TXT.t }}>--</div>
          </div>
        </div>
      </div>

      {/* 패턴 */}
      <div style={{ ...glass, background: 'rgba(255,235,210,0.5)', border: '1px solid rgba(255,220,195,0.4)', padding: '12px 14px' }}>
        <div style={{ fontSize: 10, color: TXT.a, marginBottom: 6 }}>🔍 패턴</div>
        <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5 }}>{data.patternMessage}</div>
      </div>

      {/* 추천 */}
      {recs.length > 0 && (
        <div style={{ ...glass, background: 'rgba(255,235,210,0.3)', border: '1px solid rgba(255,220,195,0.3)', padding: '12px 14px' }}>
          <div style={{ fontSize: 10, color: TXT.a, marginBottom: 6 }}>🌿 오후 추천</div>
          {recs.map(r => (
            <div key={r.id} style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5 }}>{r.icon} {r.text}</div>
          ))}
        </div>
      )}

      {/* 연속 */}
      <div style={{ ...glass, background: 'rgba(238,237,254,0.3)', border: '1px solid rgba(238,237,254,0.4)', borderRadius: 14, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 500 }}>{streakMsg}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted,#8BA6BD)" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6"/></svg>
      </div>
    </div>
  );
}
