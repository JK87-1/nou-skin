import { useState, useCallback, useEffect } from 'react';
import { hapticLight } from '../utils/haptic';
import { getProfile } from '../storage/ProfileStorage';

/* ── 상수 ── */
const EVENING_KEY = 'lua_evening_checkin';

const FOCUS_OPTIONS = [
  { value: 'cloudy', score: 30, emoji: '🌫️', label: '계속 흐렸어요', sub: '집중이 잘 안 됐어요' },
  { value: 'mixed', score: 50, emoji: '⛅', label: '오락가락했어요', sub: '집중되다 흐려지다' },
  { value: 'normal', score: 70, emoji: '☀️', label: '평소만큼 했어요', sub: '평범한 집중도' },
  { value: 'sharp', score: 90, emoji: '✨', label: '유난히 좋았어요', sub: '몰입이 잘 됐어요' },
];

const DAY_MOOD_CHIPS = [
  { id: 'calm', emoji: '🌊', label: '잔잔했어요' },
  { id: 'busy', emoji: '🔥', label: '바빴어요' },
  { id: 'hard', emoji: '😩', label: '힘들었어요' },
  { id: 'good_thing', emoji: '🌸', label: '좋은 일 있었어요' },
  { id: 'tired', emoji: '😴', label: '피곤했어요' },
  { id: 'thoughtful', emoji: '💭', label: '생각이 많았어요' },
  { id: 'started', emoji: '🌱', label: '뭔가 시작했어요' },
  { id: 'ordinary', emoji: '🪴', label: '평범했어요' },
];

const TOMORROW_INTENTS = [
  { id: 'water_cup', text: '물 한 컵으로 시작하기' },
  { id: 'wake_5min', text: '알람 듣고 5분 안에 일어나기' },
  { id: 'morning_sun', text: '햇빛 5분 쬐기' },
  { id: 'breakfast', text: '아침 식사 챙기기' },
  { id: 'stretch_3min', text: '스트레칭 3분' },
];

/* ── 스타일 상수 ── */
const BG = 'linear-gradient(180deg, #1a1a3e 0%, #2d2d5e 50%, #3a3a6e 100%)';
const TEXT = { p: '#fff', s: 'rgba(255,255,255,0.85)', t: 'rgba(255,255,255,0.7)', h: 'rgba(255,255,255,0.5)' };
const GLASS = { background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '0.5px solid rgba(255,255,255,0.15)' };
const GLASS_SUB = { background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.1)' };
const ACCENT = '#4A4F7F';

/* ── 유틸 ── */
function getTodayKey() {
  const h = new Date().getHours();
  // 자정~04시: 어제 날짜로 저장
  if (h < 5) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    return `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  }
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function loadTodayEveningCheckIn() {
  try {
    const all = JSON.parse(localStorage.getItem(EVENING_KEY) || '{}');
    const today = all[getTodayKey()];
    if (today?.completedAt) return today;
  } catch {}
  return null;
}

function saveEvening(data) {
  try {
    const key = getTodayKey();
    const all = JSON.parse(localStorage.getItem(EVENING_KEY) || '{}');
    all[key] = { ...all[key], ...data, date: key };
    localStorage.setItem(EVENING_KEY, JSON.stringify(all));
  } catch {}
}

function getMorningData() {
  try {
    const all = JSON.parse(localStorage.getItem('lua_morning_checkin') || '{}');
    return all[getTodayKey()] || null;
  } catch { return null; }
}

/* ── lua 일기 생성 ── */
function generateDiary(data, morning) {
  const { focus, dayMood, selfMessage } = data;
  const chips = (dayMood || []).map(id => DAY_MOOD_CHIPS.find(c => c.id === id)?.label).filter(Boolean);
  const morningScore = morning?.totalScore;
  const recsDone = (morning?.recommendations || []).filter(r => r.completed).length;

  const lines = [];

  // 문장 1: 데이터 회고
  if (morningScore) {
    const level = morningScore >= 70 ? '좋은 컨디션' : morningScore >= 50 ? '컨디션 ' + morningScore : '살짝 무겁게';
    if (dayMood?.includes('busy')) lines.push(`아침엔 ${level}으로 시작해서, 오후엔 바쁘게 보내셨네요.`);
    else if (dayMood?.includes('calm')) lines.push(`아침엔 ${level}으로 시작해서, 잔잔한 하루를 보내셨네요.`);
    else lines.push(`아침엔 ${level}으로 시작한 하루였어요.`);
  } else {
    lines.push('오늘 하루를 함께 돌아봐요.');
  }

  // 문장 2: 집중 + 노력
  if (focus) {
    const focusMsg = { cloudy: '집중이 흐렸지만', mixed: '집중이 오락가락했지만', normal: '오늘 집중도 잘 잡혔어요.', sharp: '오늘 집중이 유난히 좋았어요!' };
    const msg = focusMsg[focus.value] || '';
    if (focus.value === 'cloudy' || focus.value === 'mixed') {
      lines.push(recsDone > 0 ? `${msg} 추천 행동 ${recsDone}개나 챙기셨어요.` : `${msg} 그래도 하루를 잘 마무리하고 계세요.`);
    } else {
      lines.push(msg);
    }
  }

  // 문장 3: 하루 결 기반 위로
  if (dayMood?.includes('hard')) lines.push('힘든 하루를 잘 마무리하셨어요.');
  else if (dayMood?.includes('good_thing')) lines.push('좋은 일이 있어 다행이에요.');
  else if (dayMood?.includes('calm')) lines.push('잔잔한 하루도 충분히 의미 있어요.');
  else if (dayMood?.includes('busy')) lines.push('바쁜 와중에 챙기셔서 대단해요.');
  else if (dayMood?.includes('tired')) lines.push('피곤한 하루 고생하셨어요. 푹 쉬세요.');
  else if (dayMood?.includes('thoughtful')) lines.push('생각이 많았던 하루, 잘 정리하셨어요.');
  else lines.push('오늘 하루를 잘 보내셨어요.');

  const narrative = lines.join('\n');
  const chipsText = chips.length > 0 ? chips.join(' · ') : null;

  return { narrative, chipsText };
}

/* ── lua 추천 메시지 ── */
function getLuaRecommendation(focus, dayMood) {
  if (focus?.value === 'cloudy') return { id: 'rec_sun', text: '오늘 집중이 흐렸으니, 내일은 햇빛으로 뇌를 깨우는 게 좋아요.' };
  if (dayMood?.includes('busy') && dayMood?.includes('tired')) return { id: 'rec_water', text: '바쁜 하루였네요. 내일은 물 한 컵으로 천천히 시작해보세요.' };
  if (dayMood?.includes('good_thing')) return { id: 'rec_stretch', text: '좋은 흐름이에요. 내일도 가벼운 스트레칭으로 이어가볼까요?' };
  if (dayMood?.includes('hard')) return { id: 'rec_small', text: '힘든 하루 잘 마치셨어요. 내일은 작은 약속 하나만 정해도 충분해요.' };
  if (dayMood?.includes('tired')) return { id: 'rec_sun2', text: '피곤한 하루였죠. 내일 아침 햇빛 5분이 멜라토닌 리셋에 도움돼요.' };
  if (dayMood?.includes('calm')) return { id: 'rec_meal', text: '잔잔한 하루였네요. 내일은 아침 식사로 에너지를 채워보세요.' };
  return { id: 'rec_default', text: '내일은 작은 행동 하나로 시작해보세요.' };
}

/* ── 연속 기록 ── */
function getStreak() {
  try {
    const all = JSON.parse(localStorage.getItem(EVENING_KEY) || '{}');
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
/* ============= MAIN COMPONENT =============== */
/* ============================================= */
export default function EveningCheckIn({ onClose, onComplete }) {
  const nickname = getProfile().nickname || '';
  const morning = getMorningData();

  const [step, setStep] = useState(1);
  const [focus, setFocus] = useState(null);
  const [dayMood, setDayMood] = useState([]);
  const [selfMessage, setSelfMessage] = useState('');
  const [intents, setIntents] = useState([]);
  const [diary, setDiary] = useState(null);

  const totalSteps = 3;

  /* ── Progress Bar ── */
  const ProgressBar = ({ current, total, label }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{ width: 28, height: 3, borderRadius: 2, background: i < current ? '#fff' : 'rgba(255,255,255,0.3)', transition: 'background 0.2s' }} />
        ))}
      </div>
      {label && <span style={{ fontSize: 11, color: TEXT.h, letterSpacing: 1 }}>{label}</span>}
    </div>
  );

  const navStyle = { padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 };
  const closeBtn = (
    <div onClick={() => { hapticLight(); onClose?.(); }} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </div>
  );
  const skipBtn = (action) => <div onClick={() => { hapticLight(); action(); }} style={{ fontSize: 11, color: TEXT.h, cursor: 'pointer', padding: '8px 0' }}>건너뛰기</div>;

  const handleSkip = () => {
    if (step === 1) { onClose?.(); return; }
    setStep(s => Math.min(s + 1, totalSteps + 1));
  };

  const finishCheckIn = useCallback(() => {
    const data = { focus, dayMood, selfMessage, tomorrowIntents: intents };
    const d = generateDiary(data, morning);
    const rec = getLuaRecommendation(focus, dayMood);
    const streak = getStreak() + 1;

    saveEvening({
      ...data, type: 'evening', completedAt: new Date().toISOString(),
      diary: d, luaRecommendation: rec, streak,
    });

    setDiary(d);
    setStep(4); // 마무리 화면
  }, [focus, dayMood, selfMessage, intents, morning]);

  /* ── STEP 1: 집중력 회고 ── */
  if (step === 1) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: BG, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={navStyle}>{closeBtn}<ProgressBar current={1} total={totalSteps} />{skipBtn(handleSkip)}</div>
      <div style={{ padding: '0 24px' }}>
        <div style={{ fontSize: 19, fontWeight: 500, color: TEXT.p, lineHeight: 1.4, letterSpacing: -0.3, marginBottom: 10, whiteSpace: 'pre-line' }}>
          오늘 집중력은 어땠어요?
        </div>
        <div style={{ fontSize: 12, color: TEXT.t, lineHeight: 1.6, marginBottom: 28 }}>하루를 돌아보면서, 일이나 공부할 때를 떠올려보세요.</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FOCUS_OPTIONS.map(opt => {
            const selected = focus?.value === opt.value;
            return (
              <div key={opt.value} onClick={() => {
                hapticLight();
                setFocus(opt);
                saveEvening({ focus: opt });
                setTimeout(() => setStep(2), 200);
              }} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16, cursor: 'pointer',
                background: selected ? '#fff' : GLASS.background,
                border: selected ? 'none' : GLASS.border,
                backdropFilter: GLASS.backdropFilter, WebkitBackdropFilter: GLASS.WebkitBackdropFilter,
                transition: 'background 0.15s',
              }}>
                <span style={{ fontSize: 22 }}>{opt.emoji}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: selected ? ACCENT : TEXT.p }}>{opt.label}</div>
                  <div style={{ fontSize: 10, color: selected ? '#6B5A8A' : TEXT.h, marginTop: 2 }}>{opt.sub}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ ...GLASS_SUB, borderRadius: 12, padding: 12, marginTop: 20 }}>
          <span style={{ fontSize: 11, color: TEXT.t, lineHeight: 1.5 }}>💭 일/공부 안 한 날이면 '평소만큼'으로 표시해도 돼요</span>
        </div>
      </div>
    </div>
  );

  /* ── STEP 2: 하루 평가 ── */
  if (step === 2) {
    const toggleChip = (id) => {
      hapticLight();
      setDayMood(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: BG, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={navStyle}>{closeBtn}<ProgressBar current={2} total={totalSteps} />{skipBtn(handleSkip)}</div>
        <div style={{ padding: '0 24px', paddingBottom: 40 }}>
          <div style={{ fontSize: 19, fontWeight: 500, color: TEXT.p, lineHeight: 1.4, letterSpacing: -0.3, marginBottom: 10, whiteSpace: 'pre-line' }}>
            오늘 하루,{'\n'}한 단어로 표현하면?
          </div>
          <div style={{ fontSize: 12, color: TEXT.t, marginBottom: 24 }}>가장 가까운 느낌으로 골라주세요. 복수 선택 가능해요.</div>

          <div style={{ fontSize: 11, fontWeight: 500, color: TEXT.h, marginBottom: 10, letterSpacing: 0.5 }}>오늘의 결</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            {DAY_MOOD_CHIPS.map(chip => {
              const selected = dayMood.includes(chip.id);
              return (
                <div key={chip.id} onClick={() => toggleChip(chip.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '8px 14px', borderRadius: 14, cursor: 'pointer',
                  background: selected ? '#fff' : 'rgba(255,255,255,0.10)',
                  border: selected ? 'none' : '0.5px solid rgba(255,255,255,0.2)',
                  transition: 'all 0.15s',
                }}>
                  <span style={{ fontSize: 11 }}>{chip.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: selected ? 500 : 400, color: selected ? ACCENT : TEXT.s }}>{chip.label}</span>
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: 11, fontWeight: 500, color: TEXT.h, marginBottom: 10, letterSpacing: 0.5 }}>스스로에게 한마디 (선택)</div>
          <textarea
            value={selfMessage}
            onChange={e => setSelfMessage(e.target.value.slice(0, 200))}
            placeholder="예: 오늘 회의 잘 끝나서 다행"
            style={{
              width: '100%', minHeight: 50, padding: 14, borderRadius: 14, fontSize: 12, fontFamily: 'inherit',
              background: 'rgba(255,255,255,0.10)', border: '0.5px solid rgba(255,255,255,0.15)',
              color: '#fff', outline: 'none', resize: 'none', boxSizing: 'border-box',
            }}
          />
          {selfMessage.length > 0 && (
            <div style={{ textAlign: 'right', fontSize: 10, color: TEXT.h, marginTop: 4 }}>{selfMessage.length}/200</div>
          )}

          <button onClick={() => { hapticLight(); setStep(3); }} style={{
            width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
            background: '#fff', color: ACCENT, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit', marginTop: 18,
          }}>다음</button>
        </div>
      </div>
    );
  }

  /* ── STEP 3: 내일 의도 ── */
  if (step === 3) {
    const toggleIntent = (id) => {
      hapticLight();
      setIntents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };
    const rec = getLuaRecommendation(focus, dayMood);

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: BG, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={navStyle}>{closeBtn}<ProgressBar current={3} total={totalSteps} />{skipBtn(() => finishCheckIn())}</div>
        <div style={{ padding: '0 24px', paddingBottom: 40 }}>
          <div style={{ fontSize: 19, fontWeight: 500, color: TEXT.p, lineHeight: 1.4, letterSpacing: -0.3, marginBottom: 10, whiteSpace: 'pre-line' }}>
            내일 아침,{'\n'}어떻게 시작하고 싶어요?
          </div>
          <div style={{ fontSize: 12, color: TEXT.t, marginBottom: 28 }}>한 가지만 정해도 좋아요. 작은 게 좋아요.</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {TOMORROW_INTENTS.map(intent => {
              const selected = intents.includes(intent.id);
              return (
                <div key={intent.id} onClick={() => toggleIntent(intent.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 14, cursor: 'pointer',
                  background: selected ? 'rgba(255,255,255,0.20)' : GLASS.background,
                  border: selected ? '0.5px solid rgba(255,255,255,0.3)' : GLASS.border,
                  transition: 'all 0.15s',
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    border: selected ? 'none' : '1.5px solid rgba(255,255,255,0.4)',
                    background: selected ? '#fff' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selected && <span style={{ fontSize: 11, color: ACCENT, fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: selected ? 500 : 400, color: TEXT.p }}>{intent.text}</span>
                </div>
              );
            })}
          </div>

          {/* lua 추천 */}
          <div style={{ ...GLASS_SUB, borderRadius: 14, padding: '12px 14px', marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: TEXT.h, letterSpacing: 0.5, marginBottom: 6 }}>💡 lua의 추천</div>
            <div style={{ fontSize: 11, color: TEXT.s, lineHeight: 1.5 }}>{rec.text}</div>
          </div>

          <button onClick={() => { hapticLight(); finishCheckIn(); }} style={{
            width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
            background: '#fff', color: ACCENT, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>하루 마무리하기</button>
        </div>
      </div>
    );
  }

  /* ── STEP 4: 마무리 화면 (lua 일기) ── */
  if (step === 4 && diary) {
    const selectedIntents = intents.map(id => TOMORROW_INTENTS.find(x => x.id === id)?.text).filter(Boolean);
    const streak = getStreak();
    let streakMsg = streak >= 30 ? `👑 ${streak}일째 함께해요` : streak >= 14 ? `✨ ${streak}일 연속 함께` : streak >= 7 ? '🎉 일주일 달성!' : streak >= 2 ? `🔥 ${streak}일 연속 함께` : '🌱 첫 저녁 체크인 완료';

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: BG, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {/* 별 장식 */}
        <div style={{ position: 'absolute', top: 30, left: '15%', fontSize: 5, color: 'rgba(255,255,255,0.4)' }}>✦</div>
        <div style={{ position: 'absolute', top: 60, right: '20%', fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>✦</div>
        <div style={{ position: 'absolute', top: 90, left: '60%', fontSize: 4, color: 'rgba(255,255,255,0.5)' }}>✦</div>
        <div style={{ position: 'absolute', top: 45, left: '80%', fontSize: 6, color: 'rgba(255,255,255,0.35)' }}>✦</div>

        <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 22px 0', display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <ProgressBar current={0} total={0} label="마무리" />
        </div>

        <div style={{ padding: '0 26px', textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>🌙</div>
          <div style={{ fontSize: 18, fontWeight: 500, color: TEXT.p, lineHeight: 1.5, letterSpacing: -0.3 }}>
            {nickname ? `${nickname}님,` : ''}{'\n'}오늘 하루 잘 보내셨어요
          </div>
        </div>

        <div style={{ padding: '0 22px', paddingBottom: 40 }}>
          {/* lua 일기 */}
          <div style={{
            ...GLASS, background: 'rgba(255,255,255,0.10)', borderRadius: 18, padding: 18, marginBottom: 14, textAlign: 'left',
          }}>
            <div style={{ fontSize: 10, color: TEXT.h, letterSpacing: 0.5, marginBottom: 10 }}>📖 오늘의 lua 일기</div>
            <div style={{ fontSize: 12, color: TEXT.p, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{diary.narrative}</div>
            {diary.chipsText && (
              <div style={{ marginTop: 12, fontSize: 12, color: '#C9B6F0', fontWeight: 500 }}>
                오늘의 결: {diary.chipsText}
              </div>
            )}
          </div>

          {/* 내일 약속 */}
          {selectedIntents.length > 0 && (
            <div style={{ ...GLASS_SUB, borderRadius: 14, padding: 14, marginBottom: 14, textAlign: 'left' }}>
              <div style={{ fontSize: 10, color: TEXT.h, letterSpacing: 0.5, marginBottom: 8 }}>🌅 내일 아침의 약속</div>
              {selectedIntents.map((t, i) => (
                <div key={i} style={{ fontSize: 12, color: TEXT.p, lineHeight: 1.5 }}>☀ {t}</div>
              ))}
            </div>
          )}

          {/* 연속 기록 */}
          <div style={{ ...GLASS_SUB, background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '10px 12px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: TEXT.h }}>{streakMsg}</span>
          </div>

          <button onClick={() => { hapticLight(); onComplete?.(); }} style={{
            width: '100%', padding: '12px 18px', borderRadius: 12, border: 'none',
            background: '#fff', color: ACCENT, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit', display: 'block', margin: '0 auto',
          }}>잘 자요</button>

          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 10, color: TEXT.h }}>
            좋은 밤 보내세요 🌙
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/* ── 체크인 후 홈 요약 ── */
export function EveningSummaryCard() {
  const data = loadTodayEveningCheckIn();
  if (!data) return null;

  const diary = data.diary;
  const selectedIntents = (data.tomorrowIntents || []).map(id => TOMORROW_INTENTS.find(x => x.id === id)?.text).filter(Boolean);
  const streak = data.streak || 0;
  let streakMsg = streak >= 30 ? `👑 ${streak}일째 함께해요` : streak >= 14 ? `✨ ${streak}일 연속` : streak >= 7 ? '🎉 일주일 달성!' : streak >= 2 ? `🔥 ${streak}일 연속` : '🌱 첫 체크인';

  const glassNight = {
    background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 18,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* lua 일기 */}
      {diary && (
        <div style={{ ...glassNight, padding: '16px 18px', textAlign: 'left' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, marginBottom: 8 }}>📖 오늘의 lua 일기</div>
          <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{diary.narrative}</div>
          {diary.chipsText && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#C9B6F0', fontWeight: 500 }}>오늘의 결: {diary.chipsText}</div>
          )}
        </div>
      )}

      {/* 내일 약속 */}
      {selectedIntents.length > 0 && (
        <div style={{ ...glassNight, background: 'rgba(255,255,255,0.08)', padding: '12px 14px', textAlign: 'left' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, marginBottom: 6 }}>🌅 내일 아침</div>
          {selectedIntents.map((t, i) => (
            <div key={i} style={{ fontSize: 11, color: '#fff', lineHeight: 1.5 }}>☀ {t}</div>
          ))}
        </div>
      )}

      {/* 연속 기록 */}
      <div style={{ ...glassNight, background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{streakMsg}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6"/></svg>
      </div>

      <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>좋은 밤 보내세요 🌙</div>
    </div>
  );
}

/* ── 다음날 아침: 어젯밤 약속 확인 카드 ── */
export function YesterdayPromiseCard({ onDismiss }) {
  const [responded, setResponded] = useState(false);
  const [toast, setToast] = useState(null);

  const yesterday = (() => {
    const y = new Date(); y.setDate(y.getDate() - 1);
    return `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  })();

  const data = (() => {
    try {
      const all = JSON.parse(localStorage.getItem(EVENING_KEY) || '{}');
      return all[yesterday];
    } catch { return null; }
  })();

  if (!data?.completedAt || !data.tomorrowIntents?.length || responded) return null;

  const intentsText = data.tomorrowIntents.map(id => TOMORROW_INTENTS.find(x => x.id === id)?.text).filter(Boolean);
  if (intentsText.length === 0) return null;

  const handleResponse = (kept) => {
    hapticLight();
    setToast(kept ? '잘했어요! 오늘도 화이팅' : '괜찮아요. 오늘 다시 시작해요.');
    try {
      const all = JSON.parse(localStorage.getItem(EVENING_KEY) || '{}');
      if (all[yesterday]) { all[yesterday].promiseKept = kept; localStorage.setItem(EVENING_KEY, JSON.stringify(all)); }
    } catch {}
    setTimeout(() => { setResponded(true); onDismiss?.(); }, 1500);
  };

  return (
    <div style={{ margin: '0 18px 14px', position: 'relative' }}>
      {toast && (
        <div style={{
          position: 'absolute', top: -40, left: 0, right: 0, textAlign: 'center',
          fontSize: 12, fontWeight: 500, color: '#5E9D8A', padding: '8px 0',
          animation: 'fadeIn 0.3s ease',
        }}>{toast}</div>
      )}
      <div style={{
        background: 'rgba(255,255,255,0.45)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.5)', borderRadius: 18, padding: 16,
        boxShadow: '0 2px 8px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.4)',
      }}>
        <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.4)', marginBottom: 8, letterSpacing: 0.5 }}>🌅 어젯밤의 약속</div>
        {intentsText.map((t, i) => (
          <div key={i} style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{t}</div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => handleResponse(true)} style={{
            flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
            background: 'var(--text-primary, #111)', color: '#fff', fontSize: 12, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>✓ 지켰어요</button>
          <button onClick={() => handleResponse(false)} style={{
            flex: 1, padding: '10px 0', borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(0,0,0,0.03)',
            color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          }}>못 지켰어요</button>
        </div>
      </div>
    </div>
  );
}
