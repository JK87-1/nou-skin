import { useState } from 'react';
import { saveProfile, getProfile } from '../storage/ProfileStorage';
import { saveRoutineItem, getRoutineItems } from '../storage/RoutineCheckStorage';

const SECTIONS = ['내 몸 상태', '지금 먹는 영양제', '루틴 설계'];
const SECTION_STEPS = [3, 2, 3];

const CONCERNS = [
  { icon: '😴', label: '자꾸 피곤하고 기력이 없어요', key: 'fatigue' },
  { icon: '🧠', label: '집중력이 떨어졌어요', key: 'focus' },
  { icon: '💆', label: '스트레스가 심해요', key: 'stress' },
  { icon: '🌙', label: '잠을 잘 못 자요', key: 'sleep' },
  { icon: '✨', label: '피부가 푸석하고 트러블이 나요', key: 'skin' },
  { icon: '💪', label: '근육량을 늘리고 싶어요', key: 'muscle' },
  { icon: '🩸', label: '생리 주기가 불규칙해요', key: 'period' },
  { icon: '🦴', label: '관절·뼈가 걱정돼요', key: 'bone' },
  { icon: '⚖️', label: '체중 관리가 안 돼요', key: 'weight' },
  { icon: '🫀', label: '면역력이 약한 것 같아요', key: 'immune' },
  { icon: '🪮', label: '머리카락이 얇아지거나 빠지는 것 같아요', key: 'hair' },
];

const AGE_GROUPS = ['20대', '30대', '40대'];

const MEAL_HABITS = [
  { key: 'balanced', label: '골고루 잘 먹는 편이에요' },
  { key: 'skip', label: '바빠서 끼니를 자주 거르거나 편의식을 먹어요' },
  { key: 'noVeg', label: '채소·과일을 잘 안 먹어요' },
  { key: 'lowProtein', label: '단백질 섭취가 부족한 것 같아요' },
];

const COMMON_SUPPLEMENTS = [
  '비타민C', '비타민D', '오메가3', '철분', '마그네슘',
  '아연', '엽산', '유산균', '콜라겐', '칼슘', '비오틴',
];

const DISCOMFORTS = [
  { key: 'forget', label: '먹는 걸 자꾸 잊어요' },
  { key: 'timing', label: '언제 먹어야 할지 헷갈려요' },
  { key: 'tooMany', label: '너무 많은 것 같아서 줄이고 싶어요' },
  { key: 'none', label: '특별히 없어요' },
];

const WAKE_TIMES = [
  { key: 'before6', label: '6시 이전', hour: 6 },
  { key: '6-8', label: '6-8시', hour: 7 },
  { key: '8-10', label: '8-10시', hour: 9 },
  { key: 'after10', label: '10시 이후', hour: 10 },
];

const SLEEP_TIMES = [
  { key: 'before10', label: '10시 이전', hour: 21 },
  { key: '10-12', label: '10-12시', hour: 22 },
  { key: 'after12', label: '자정 이후', hour: 24 },
];

const SUPPLEMENT_COUNTS = [
  { key: 'few', label: '2-3가지로 심플하게', max: 3 },
  { key: 'moderate', label: '5가지 정도가 적당해요', max: 5 },
  { key: 'many', label: '효과 있다면 많아도 괜찮아요', max: 99 },
];

const TIMING_PREFS = [
  { key: 'withMeal', label: '식사와 함께 먹을게요' },
  { key: 'separate', label: '식사 30분 전·후로 따로 먹을게요' },
  { key: 'recommend', label: '잘 모르겠어요, 추천해 주세요' },
];

// Symptom → supplement mapping
const SYMPTOM_MAP = {
  fatigue: ['비타민B군', '철분', '코엔자임Q10'],
  focus: ['오메가3', '비타민B12'],
  stress: ['마그네슘', '비타민C'],
  sleep: ['마그네슘', '아연', 'L-테아닌'],
  skin: ['비타민C', '콜라겐', '아연'],
  muscle: ['단백질', '비타민D', '마그네슘'],
  period: ['철분', '엽산', '비타민D'],
  bone: ['칼슘', '비타민D', '마그네슘'],
  weight: ['오메가3', '베르베린', '마그네슘'],
  immune: ['비타민C', '비타민D', '아연', '유산균'],
  hair: ['비오틴', '철분', '아연', '콜라겐'],
};

// Timing info for each supplement
const SUPPLEMENT_TIMING = {
  '비타민C': 'morning', '비타민D': 'morning', '오메가3': 'morning',
  '철분': 'morning', '비타민B군': 'morning', '비타민B12': 'morning',
  '코엔자임Q10': 'morning', '단백질': 'morning', '크롬': 'morning',
  '식이섬유': 'morning', '엽산': 'morning', '유산균': 'morning',
  '베르베린': 'morning', '종합비타민': 'morning',
  '마그네슘': 'evening', '아연': 'evening', 'L-테아닌': 'evening',
  '콜라겐': 'evening', '칼슘': 'evening', '비오틴': 'morning',
};

const MULTIVITAMIN_INGREDIENTS = [
  '비타민A', '비타민B군', '비타민C', '비타민D',
  '비타민E', '아연', '철분', '마그네슘', '셀레늄', '엽산',
];

const DEFAULT_MULTIVITAMIN = ['비타민A', '비타민B군', '비타민C', '비타민D', '비타민E', '아연', '철분', '엽산'];

const FAT_SOLUBLE = ['비타민A', '비타민D', '비타민E'];

const CONFLICTS = [
  { a: '철분', b: '칼슘', msg: '철분과 칼슘은 동시 복용을 피해요 (흡수 방해)' },
  { a: '비오틴', b: null, msg: '비오틴 복용 중 혈액검사 시 의사에게 반드시 알려주세요' },
];

export default function SupplementOnboardingPage({ onClose, onComplete, onNavigateRoutine }) {
  const [step, setStep] = useState(0);

  // Section 1
  const [concerns, setConcerns] = useState([]);
  const [ageGroup, setAgeGroup] = useState('');
  const [isPregnant, setIsPregnant] = useState(false);
  const [isVegan, setIsVegan] = useState(false);
  const [mealHabit, setMealHabit] = useState('');

  // Section 2
  const [hasCurrent, setHasCurrent] = useState(null);
  const [hasMultivitamin, setHasMultivitamin] = useState(false);
  const [multiIngredients, setMultiIngredients] = useState([]);
  const [multiUnknown, setMultiUnknown] = useState(false);
  const [currentSupplements, setCurrentSupplements] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [discomfort, setDiscomfort] = useState('');

  // Section 3
  const [wakeTime, setWakeTime] = useState('');
  const [sleepTime, setSleepTime] = useState('');
  const [countPref, setCountPref] = useState('');
  const [timingPref, setTimingPref] = useState('');

  const getSectionAndStep = () => {
    let remaining = step;
    for (let i = 0; i < SECTION_STEPS.length; i++) {
      if (remaining < SECTION_STEPS[i]) return { section: i, localStep: remaining };
      remaining -= SECTION_STEPS[i];
    }
    return { section: 2, localStep: SECTION_STEPS[2] - 1 };
  };

  const { section, localStep } = getSectionAndStep();
  const totalSteps = SECTION_STEPS.reduce((a, b) => a + b, 0);

  const canProceed = () => {
    if (section === 0) {
      if (localStep === 0) return concerns.length > 0;
      if (localStep === 1) return !!ageGroup;
      if (localStep === 2) return !!mealHabit;
    }
    if (section === 1) {
      if (localStep === 0) return hasCurrent !== null;
      if (localStep === 1) return !!discomfort;
    }
    if (section === 2) {
      if (localStep === 0) return !!wakeTime && !!sleepTime;
      if (localStep === 1) return !!countPref;
      if (localStep === 2) return !!timingPref;
    }
    return true;
  };

  const generateRoutine = () => {
    // 1. Collect recommended supplements from symptoms
    const allSupps = new Set();
    concerns.forEach(key => {
      (SYMPTOM_MAP[key] || []).forEach(s => allSupps.add(s));
    });
    // Add current supplements
    currentSupplements.forEach(s => allSupps.add(s));
    // Filter vegan
    if (isVegan) {
      allSupps.delete('콜라겐');
    }

    // 2. Multivitamin deduplication
    const coveredByMulti = hasMultivitamin
      ? (multiUnknown ? DEFAULT_MULTIVITAMIN : multiIngredients)
      : [];
    const removedByMulti = [];
    if (coveredByMulti.length > 0) {
      // Remove supplements already covered by multivitamin
      coveredByMulti.forEach(ingredient => {
        if (allSupps.has(ingredient)) {
          removedByMulti.push(ingredient);
          allSupps.delete(ingredient);
        }
      });
    }

    // 3. Split into morning/evening
    const morning = [];
    const evening = [];
    // Add multivitamin itself to morning if applicable
    if (hasMultivitamin) morning.push('종합비타민');
    allSupps.forEach(s => {
      if (SUPPLEMENT_TIMING[s] === 'evening') evening.push(s);
      else morning.push(s);
    });

    // 3. Handle iron + calcium conflict (separate them)
    if (morning.includes('철분') && (morning.includes('칼슘') || evening.includes('칼슘'))) {
      // Move calcium to evening if iron is morning
      const idx = morning.indexOf('칼슘');
      if (idx >= 0) { morning.splice(idx, 1); evening.push('칼슘'); }
    }
    if (evening.includes('철분') && evening.includes('칼슘')) {
      // Move iron to morning
      const idx = evening.indexOf('철분');
      if (idx >= 0) { evening.splice(idx, 1); morning.push('철분'); }
    }

    // 4. Limit count
    const maxCount = SUPPLEMENT_COUNTS.find(c => c.key === countPref)?.max || 5;
    const limitedMorning = morning.slice(0, Math.ceil(maxCount * 0.6));
    const limitedEvening = evening.slice(0, Math.floor(maxCount * 0.4) || 1);

    // 5. Calculate alarm times
    const wakeHour = WAKE_TIMES.find(w => w.key === wakeTime)?.hour || 7;
    const sleepHour = SLEEP_TIMES.find(s => s.key === sleepTime)?.hour || 22;
    const morningAlarm = `${String(wakeHour).padStart(2, '0')}:30`;
    const eveningAlarm = `${String(Math.min(sleepHour - 1, 23)).padStart(2, '0')}:00`;

    // 6. Timing description
    let timingDesc = '식사와 함께';
    if (timingPref === 'separate') timingDesc = '식사 30분 전·후';
    if (timingPref === 'recommend') timingDesc = '식사와 함께';

    // 7. Build warnings
    const warnings = [];
    CONFLICTS.forEach(c => {
      if (c.b === null) {
        if (allSupps.has(c.a)) warnings.push(c.msg);
      } else {
        if (allSupps.has(c.a) && allSupps.has(c.b)) warnings.push(c.msg);
      }
    });
    // Fat-soluble vitamin overlap warning
    if (hasMultivitamin) {
      const fatSolubleOverlap = FAT_SOLUBLE.filter(v =>
        coveredByMulti.includes(v) && (limitedMorning.includes(v) || limitedEvening.includes(v))
      );
      if (fatSolubleOverlap.length > 0) {
        warnings.push(`종합비타민과 ${fatSolubleOverlap.join('·')}이 중복돼요. 지용성 비타민(A·D·E)은 과잉 섭취에 주의하세요`);
      }
    }

    return { morning: limitedMorning, evening: limitedEvening, morningAlarm, eveningAlarm, timingDesc, warnings, removedByMulti, hasMultivitamin };
  };

  const [showResult, setShowResult] = useState(false);
  const [routine, setRoutine] = useState(null);

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      const r = generateRoutine();
      setRoutine(r);
      setShowResult(true);
    }
  };

  const handleBack = () => {
    if (showResult) { setShowResult(false); return; }
    if (step > 0) setStep(step - 1);
    else onClose();
  };

  const handleAutoGenerate = () => {
    if (!routine) return;
    // Clear existing supplement items
    const existing = getRoutineItems('supplement');
    // Save new routine items
    routine.morning.forEach(name => {
      saveRoutineItem('supplement', { name, time: '아침' });
    });
    routine.evening.forEach(name => {
      saveRoutineItem('supplement', { name, time: '저녁' });
    });
    // Save profile
    saveProfile({
      supplementOnboardingDone: true,
      supplementConcerns: concerns,
      supplementAgeGroup: ageGroup,
      supplementMealHabit: mealHabit,
      supplementDiscomfort: discomfort,
      supplementWakeTime: wakeTime,
      supplementSleepTime: sleepTime,
      supplementCountPref: countPref,
      supplementTimingPref: timingPref,
      supplementMorningAlarm: routine.morningAlarm,
      supplementEveningAlarm: routine.eveningAlarm,
    });
    if (onNavigateRoutine) {
      onNavigateRoutine();
    } else {
      onComplete?.();
      onClose();
    }
  };

  const handleManual = () => {
    saveProfile({ supplementOnboardingDone: true });
    onComplete?.();
    onClose();
  };

  const selectStyle = (isSelected) => ({
    padding: '16px 20px', borderRadius: 16, cursor: 'pointer',
    background: isSelected ? 'rgba(137,206,245,0.1)' : 'var(--bg-card, #fff)',
    border: isSelected ? '2px solid var(--accent-primary)' : '2px solid transparent',
    transition: 'all 0.15s ease', fontFamily: 'inherit',
  });

  const toggleConcern = (key) => {
    setConcerns(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const toggleSupplement = (name) => {
    setCurrentSupplements(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const filteredSupplements = searchQuery.trim()
    ? COMMON_SUPPLEMENTS.filter(s => s.includes(searchQuery.trim()))
    : COMMON_SUPPLEMENTS;

  const renderStep = () => {
    // === SECTION 1 ===
    if (section === 0) {
      if (localStep === 0) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>요즘 가장 신경 쓰이는 게 뭔가요?</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>해당하는 것을 모두 선택해주세요</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CONCERNS.map(c => (
              <div key={c.key} onClick={() => toggleConcern(c.key)} style={{
                ...selectStyle(concerns.includes(c.key)),
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <span style={{ fontSize: 22 }}>{c.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      );

      if (localStep === 1) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>현재 몸 상태를 체크해요</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>해당하는 항목을 선택해주세요</div>

          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>나이대</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            {AGE_GROUPS.map(g => (
              <div key={g} onClick={() => setAgeGroup(g)} style={{
                ...selectStyle(ageGroup === g),
                flex: 1, textAlign: 'center', padding: '14px 0',
              }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{g}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div onClick={() => setIsPregnant(!isPregnant)} style={{
              ...selectStyle(isPregnant),
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6, border: isPregnant ? '2px solid var(--accent-primary)' : '2px solid rgba(0,0,0,0.15)',
                background: isPregnant ? 'var(--accent-primary)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {isPregnant && <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>임신·수유 중이에요</span>
            </div>
            <div onClick={() => setIsVegan(!isVegan)} style={{
              ...selectStyle(isVegan),
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6, border: isVegan ? '2px solid var(--accent-primary)' : '2px solid rgba(0,0,0,0.15)',
                background: isVegan ? 'var(--accent-primary)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {isVegan && <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>채식·비건이에요</span>
            </div>
          </div>

          {isPregnant && (
            <div style={{
              marginTop: 16, padding: '14px 16px', borderRadius: 14,
              background: 'rgba(255,200,50,0.1)', border: '1px solid rgba(255,200,50,0.3)',
              fontSize: 13, color: '#9A7000', lineHeight: 1.6,
            }}>
              임신·수유 중에는 전문가 상담을 권장드려요
            </div>
          )}
        </div>
      );

      if (localStep === 2) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>평소 식사가 어때요?</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>가장 가까운 것을 선택해주세요</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MEAL_HABITS.map(h => (
              <div key={h.key} onClick={() => setMealHabit(h.key)} style={selectStyle(mealHabit === h.key)}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{h.label}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // === SECTION 2 ===
    if (section === 1) {
      if (localStep === 0) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>지금 복용 중인 영양제가 있나요?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <div onClick={() => { setHasCurrent(false); setCurrentSupplements([]); setHasMultivitamin(false); }} style={selectStyle(hasCurrent === false)}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>없어요, 처음 시작해요</span>
            </div>
            <div onClick={() => setHasCurrent(true)} style={selectStyle(hasCurrent === true && !hasMultivitamin)}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>있어요</span>
            </div>
            <div onClick={() => { setHasCurrent(true); setHasMultivitamin(!hasMultivitamin); }} style={selectStyle(hasMultivitamin)}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>종합비타민을 먹고 있어요</span>
            </div>
          </div>

          {/* Multivitamin ingredient selection */}
          {hasMultivitamin && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>어떤 성분이 들어있나요?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {MULTIVITAMIN_INGREDIENTS.map(ing => (
                  <div key={ing} onClick={() => {
                    if (multiUnknown) return;
                    setMultiIngredients(prev => prev.includes(ing) ? prev.filter(i => i !== ing) : [...prev, ing]);
                  }} style={{
                    padding: '10px 16px', borderRadius: 12, cursor: multiUnknown ? 'default' : 'pointer',
                    background: multiIngredients.includes(ing) && !multiUnknown ? 'rgba(137,206,245,0.1)' : 'var(--bg-card, #fff)',
                    border: multiIngredients.includes(ing) && !multiUnknown ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                    opacity: multiUnknown ? 0.4 : 1,
                    transition: 'all 0.15s ease',
                  }}>
                    {ing}
                  </div>
                ))}
              </div>
              <div onClick={() => { setMultiUnknown(!multiUnknown); if (!multiUnknown) setMultiIngredients([]); }} style={{
                ...selectStyle(multiUnknown),
                padding: '12px 16px',
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>잘 모르겠어요</span>
              </div>
            </div>
          )}

          {hasCurrent && (
            <>
              {currentSupplements.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {currentSupplements.map(s => (
                    <div key={s} onClick={() => toggleSupplement(s)} style={{
                      padding: '8px 14px', borderRadius: 20,
                      background: 'rgba(137,206,245,0.15)', border: '1px solid var(--accent-primary)',
                      fontSize: 13, fontWeight: 600, color: 'var(--accent-primary)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {s} <span style={{ fontSize: 16, opacity: 0.6 }}>×</span>
                    </div>
                  ))}
                </div>
              )}

              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="영양제 이름 검색"
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: 14, border: '2px solid transparent',
                  background: 'var(--bg-card, #fff)', fontSize: 14, color: 'var(--text-primary)',
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12,
                }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {filteredSupplements.map(s => (
                  <div key={s} onClick={() => toggleSupplement(s)} style={{
                    padding: '10px 16px', borderRadius: 12, cursor: 'pointer',
                    background: currentSupplements.includes(s) ? 'rgba(137,206,245,0.1)' : 'var(--bg-card, #fff)',
                    border: currentSupplements.includes(s) ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                    transition: 'all 0.15s ease',
                  }}>
                    {s}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      );

      if (localStep === 1) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>복용할 때 불편한 점이 있었나요?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DISCOMFORTS.map(d => (
              <div key={d.key} onClick={() => setDiscomfort(d.key)} style={selectStyle(discomfort === d.key)}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // === SECTION 3 ===
    if (section === 2) {
      if (localStep === 0) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>하루 생활 패턴이 어때요?</div>

          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>기상 시간</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {WAKE_TIMES.map(w => (
              <div key={w.key} onClick={() => setWakeTime(w.key)} style={selectStyle(wakeTime === w.key)}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{w.label}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>취침 시간</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SLEEP_TIMES.map(s => (
              <div key={s.key} onClick={() => setSleepTime(s.key)} style={selectStyle(sleepTime === s.key)}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      );

      if (localStep === 1) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>영양제, 몇 가지까지 괜찮아요?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SUPPLEMENT_COUNTS.map(c => (
              <div key={c.key} onClick={() => setCountPref(c.key)} style={selectStyle(countPref === c.key)}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      );

      if (localStep === 2) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>식사와 함께 먹는 게 편해요, 따로가 편해요?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {TIMING_PREFS.map(t => (
              <div key={t.key} onClick={() => setTimingPref(t.key)} style={selectStyle(timingPref === t.key)}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
  };

  // === RESULT SCREEN ===
  if (showResult && routine) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 2003,
        background: 'linear-gradient(to bottom, #ace2fc, #ffffff)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
          <div onClick={handleBack} style={{
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>영양제 루틴</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '24px 24px 120px' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💊</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>나만의 영양제 루틴이 완성됐어요</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>답변을 바탕으로 루틴을 만들었어요. 확인해보세요.</div>
          </div>

          {/* Morning routine */}
          {routine.morning.length > 0 && (
            <div style={{
              padding: '20px', borderRadius: 20,
              background: 'var(--bg-card, #fff)', marginBottom: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>☀️</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>아침</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {routine.morning.map(s => (
                  <span key={s} style={{
                    padding: '6px 14px', borderRadius: 20,
                    background: 'rgba(137,206,245,0.12)', fontSize: 13, fontWeight: 600,
                    color: 'var(--accent-primary)',
                  }}>{s}</span>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                기상 후 {routine.timingDesc} / 알림 {routine.morningAlarm}
              </div>
            </div>
          )}

          {/* Evening routine */}
          {routine.evening.length > 0 && (
            <div style={{
              padding: '20px', borderRadius: 20,
              background: 'var(--bg-card, #fff)', marginBottom: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>🌙</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>저녁</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {routine.evening.map(s => (
                  <span key={s} style={{
                    padding: '6px 14px', borderRadius: 20,
                    background: 'rgba(200,160,224,0.15)', fontSize: 13, fontWeight: 600,
                    color: '#7040A0',
                  }}>{s}</span>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                취침 1시간 전 / 알림 {routine.eveningAlarm}
              </div>
            </div>
          )}

          {/* Multivitamin integration suggestion */}
          {routine.hasMultivitamin && routine.removedByMulti.length > 0 && (
            <div style={{
              padding: '16px', borderRadius: 16, marginBottom: 12,
              background: 'rgba(137,206,245,0.08)', border: '1px solid rgba(137,206,245,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>💊</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {routine.removedByMulti.join('·')}은 종합비타민으로 이미 커버돼요.
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    아래 영양제만 추가로 챙겨보세요.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {routine.warnings.length > 0 && (
            <div style={{
              padding: '16px', borderRadius: 16,
              background: 'rgba(255,200,50,0.08)', border: '1px solid rgba(255,200,50,0.2)',
            }}>
              {routine.warnings.map((w, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  marginBottom: i < routine.warnings.length - 1 ? 8 : 0,
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
                  <span style={{ fontSize: 12, color: '#9A7000', lineHeight: 1.5 }}>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '16px 24px calc(env(safe-area-inset-bottom, 0px) + 16px)',
          background: 'linear-gradient(transparent, #fff 20%)',
        }}>
          <button onClick={handleManual} style={{
            width: '100%', padding: '14px 0', borderRadius: 16,
            border: '2px solid var(--accent-primary)', background: 'transparent',
            color: 'var(--accent-primary)', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8,
          }}>나중에 직접 설정할게요</button>
          <button onClick={handleAutoGenerate} style={{
            width: '100%', padding: '16px 0', borderRadius: 16, border: 'none',
            background: 'var(--accent-primary)', color: '#fff',
            fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>루틴 자동으로 만들어줘요</button>
        </div>
      </div>
    );
  }

  // === MAIN STEP VIEW ===
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2003,
      background: 'linear-gradient(to bottom, #ace2fc, #ffffff)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
        <div onClick={handleBack} style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>영양제 루틴</span>
      </div>

      <div style={{ padding: '16px 24px 0' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {SECTIONS.map((s, i) => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= section ? 'var(--accent-primary)' : 'rgba(0,0,0,0.08)', transition: 'background 0.3s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {SECTIONS.map((s, i) => (
            <span key={s} style={{ fontSize: 10, fontWeight: i === section ? 700 : 400, color: i === section ? 'var(--accent-primary)' : 'var(--text-muted)' }}>{s}</span>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '24px 24px 120px' }}>
        {renderStep()}
      </div>

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '16px 24px calc(env(safe-area-inset-bottom, 0px) + 16px)',
        background: 'linear-gradient(transparent, #fff 20%)',
      }}>
        <button onClick={handleNext} disabled={!canProceed()} style={{
          width: '100%', padding: '16px 0', borderRadius: 16, border: 'none',
          background: canProceed() ? 'var(--accent-primary)' : 'var(--bg-input, #E0E0E0)',
          color: canProceed() ? '#fff' : 'var(--text-dim)',
          fontSize: 16, fontWeight: 700, cursor: canProceed() ? 'pointer' : 'default',
          fontFamily: 'inherit', transition: 'all 0.2s ease',
        }}>다음</button>
      </div>
    </div>
  );
}
