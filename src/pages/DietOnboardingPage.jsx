import { useState } from 'react';
import { getProfile, saveProfile } from '../storage/ProfileStorage';

const SECTIONS = ['기본 정보', '목표', '프로그램'];

const BODY_TYPES = [
  { key: 'slim', label: '슬림', emoji: '🩰' },
  { key: 'slim_fit', label: '슬림 탄탄', emoji: '💪' },
  { key: 'normal', label: '보통', emoji: '🙂' },
  { key: 'normal_curvy', label: '보통 통통', emoji: '🌸' },
  { key: 'curvy', label: '통통', emoji: '🧸' },
  { key: 'full', label: '풍성한 편', emoji: '🌷' },
];

const EXERCISE_TYPES = [
  { key: 'none', icon: '🙅‍♀️', label: '거의 안 해요' },
  { key: 'walking', icon: '🚶‍♀️', label: '걷기·스트레칭' },
  { key: 'gym', icon: '🏋️‍♀️', label: '홈트·헬스' },
  { key: 'pilates', icon: '🧘‍♀️', label: '필라테스·요가' },
  { key: 'mixed', icon: '✨', label: '운동을 복합적으로 해요' },
];

const EXERCISE_FREQ = [
  { key: 'none', label: '거의 안 해요' },
  { key: '1-2', label: '1-2회/주' },
  { key: '3-4', label: '3-4회/주' },
  { key: '5+', label: '5회 이상/주' },
];

const EXERCISE_EXP = [
  { key: 'first', label: '처음이에요' },
  { key: 'sometimes', label: '가끔 하는 편이에요' },
  { key: 'steady', label: '꾸준히 하고 있어요' },
  { key: 'routine', label: '루틴이 잘 잡혀 있어요' },
];

const EXERCISE_INTENSITY = [
  { key: 'none', label: '거의 움직이지 않아요' },
  { key: 'light', label: '가볍게 몸만 풀어요', desc: '스트레칭 수준' },
  { key: 'moderate', label: '살짝 땀이 나는 정도예요' },
  { key: 'hard', label: '운동 후 꽤 힘들어요' },
  { key: 'extreme', label: '완전히 지칠 때까지 해요' },
];

const ACTIVITY_LEVELS = [
  { key: 'sedentary', label: '하루 대부분 앉아서 보내요', desc: '약 4,000보 이하' },
  { key: 'light', label: '가끔 걷거나 움직이는 편이에요', desc: '약 4,000~8,000보' },
  { key: 'moderate', label: '서 있거나 돌아다니는 시간이 꽤 있어요', desc: '약 8,000~13,000보' },
  { key: 'active', label: '몸을 많이 쓰는 편이에요', desc: '약 13,000보 이상' },
];

const MEAL_OPTIONS = [
  { key: '2', label: '2번' },
  { key: '3', label: '3번' },
  { key: '4', label: '4번' },
  { key: '5', label: '5번' },
  { key: '6', label: '6번' },
  { key: 'if', label: '16:8 간헐적 단식 중이에요' },
];

const DIET_OBJECTIVES = [
  { key: 'lose', label: '살 빼기', icon: '🍃' },
  { key: 'maintain', label: '현재 체중 유지', icon: '⚖️' },
  { key: 'gain', label: '건강하게 찌기', icon: '🌱' },
  { key: 'tone', label: '체형 관리', icon: '✨', desc: '체중 유지 + 근육' },
];

const SPEED_OPTIONS = [
  { key: 'slow', label: '천천히 건강하게', factor: 0.5 },
  { key: 'normal', label: '균형 있게', factor: 1.0 },
  { key: 'fast', label: '빠르게', factor: 1.5 },
];

const PROTEIN_LEVELS = [
  { key: 'low', label: '낮음', desc: '일상 생활 유지', multiplier: 1.2 },
  { key: 'normal', label: '보통', desc: '적당한 운동 병행', multiplier: 1.6, recommended: true },
  { key: 'high', label: '높음', desc: '고강도 운동', multiplier: 2.2 },
  { key: 'very_high', label: '매우 높음', desc: '선수급 훈련', multiplier: 3.0 },
];

const CALORIE_DIST = [
  { key: 'even', label: '매일 같은 양', desc: '일주일간 동일한 칼로리 유지' },
  { key: 'varied', label: '요일마다 다르게', desc: '원하는 요일에 더 많이 먹을 수 있어요' },
];

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

const DIET_TYPES = [
  { key: 'balance', name: '밸런스', desc: '탄단지를 골고루 섭취해요', carb: 32, protein: 35, fat: 32 },
  { key: 'lowcarb', name: '저탄수화물', desc: '탄수화물을 줄이고 단백질과 건강한 지방을 늘려요', carb: 30, protein: 35, fat: 35 },
  { key: 'lowfat', name: '저지방', desc: '지방 섭취를 줄이고 탄수화물과 단백질 위주로 먹어요', carb: 50, protein: 35, fat: 15 },
  { key: 'keto', name: '키토', desc: '고지방, 저탄수화물 식단이에요', carb: 6, protein: 35, fat: 58, warning: '호르몬에 영향을 줄 수 있어요. 전문가 상담을 권장해요.' },
];

const SECTION_STEPS = [7, 3, 5];

function calcTDEE(weight, height, age, gender, activity) {
  let bmr;
  if (gender === '남성') bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  else bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  const factors = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.9 };
  return Math.round(bmr * (factors[activity] || 1.4));
}

export default function DietOnboardingPage({ onClose, onComplete }) {
  const profile = getProfile();
  const [step, setStep] = useState(0);

  const [bodyType, setBodyType] = useState(profile.dietBodyType || '');
  const [exerciseType, setExerciseType] = useState(profile.dietExerciseType || '');
  const [exerciseFreq, setExerciseFreq] = useState(profile.dietExerciseFreq || '');
  const [exerciseExp, setExerciseExp] = useState(profile.dietExerciseExp || '');
  const [exerciseIntensity, setExerciseIntensity] = useState(profile.dietExerciseIntensity || '');
  const [activityLevel, setActivityLevel] = useState(profile.dietActivityLevel || '');
  const [mealOption, setMealOption] = useState(profile.dietMealOption || '');

  const [dietObjective, setDietObjective] = useState(profile.dietObjective || '');
  const [goalWeight, setGoalWeight] = useState(profile.goalWeight || profile.currentWeight || 55);
  const [speed, setSpeed] = useState(profile.dietSpeed || 'normal');

  const [proteinLevel, setProteinLevel] = useState(profile.dietProteinLevel || 'normal');
  const [calorieDist, setCalorieDist] = useState(profile.dietCalorieDist || 'even');
  const [highCalDays, setHighCalDays] = useState(profile.dietHighCalDays || []);
  const [dietType, setDietType] = useState(profile.dietGoal || 'balance');

  const currentWeight = profile.currentWeight || 55;
  const height = profile.height || 162;
  const birthYear = profile.birthYear || 1995;
  const age = new Date().getFullYear() - birthYear;
  const gender = profile.gender || '여성';

  const tdee = calcTDEE(currentWeight, height, age, gender, activityLevel || 'moderate');
  const weightDiff = Math.abs(currentWeight - goalWeight);
  const speedFactor = SPEED_OPTIONS.find(s => s.key === speed)?.factor || 1.0;
  const weeklyChange = 0.5 * speedFactor;
  const weeksNeeded = weightDiff > 0 ? Math.ceil(weightDiff / weeklyChange) : 0;
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + weeksNeeded * 7);
  const objKey = dietObjective === 'tone' ? 'maintain' : dietObjective;
  const dailyCalAdjust = objKey === 'lose' ? -500 * speedFactor : objKey === 'gain' ? 300 * speedFactor : 0;
  const targetCal = Math.round(tdee + dailyCalAdjust);
  const refWeight = currentWeight || 55;

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
      if (localStep === 0) return !!bodyType;
      if (localStep === 1) return !!exerciseType;
      if (localStep === 2) return !!exerciseFreq;
      if (localStep === 3) return !!exerciseExp;
      if (localStep === 4) return !!exerciseIntensity;
      if (localStep === 5) return !!activityLevel;
      if (localStep === 6) return !!mealOption;
    }
    if (section === 1) {
      if (localStep === 0) return !!dietObjective;
      return true;
    }
    if (section === 2) {
      if (localStep === 0) return !!proteinLevel;
      if (localStep === 1) return !!calorieDist;
      if (localStep === 2) return highCalDays.length > 0;
      if (localStep === 3) return true;
      if (localStep === 4) return !!dietType;
    }
    return true;
  };

  const handleNext = () => {
    if (section === 2 && localStep === 1 && calorieDist === 'even') {
      setStep(step + 3);
      return;
    }
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      saveProfile({
        dietBodyType: bodyType, dietExerciseType: exerciseType,
        dietExerciseFreq: exerciseFreq, dietExerciseExp: exerciseExp,
        dietExerciseIntensity: exerciseIntensity,
        dietActivityLevel: activityLevel, dietMealOption: mealOption,
        dietObjective, goalWeight, dietSpeed: speed,
        dietProteinLevel: proteinLevel, dietCalorieDist: calorieDist,
        dietHighCalDays: highCalDays, dietGoal: dietType,
        dietTargetCal: targetCal, dietTDEE: tdee,
        dietOnboardingDone: true,
      });
      onComplete?.();
      onClose();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      if (section === 2 && localStep === 4 && calorieDist === 'even') {
        setStep(step - 3);
      } else {
        setStep(step - 1);
      }
    } else {
      onClose();
    }
  };

  const selectStyle = (isSelected) => ({
    padding: '16px 20px', borderRadius: 16, cursor: 'pointer',
    background: isSelected ? 'rgba(137,206,245,0.1)' : 'var(--bg-card, #fff)',
    border: isSelected ? '2px solid var(--accent-primary)' : '2px solid transparent',
    transition: 'all 0.15s ease', fontFamily: 'inherit',
  });

  const renderStep = () => {
    // SECTION 1
    if (section === 0) {
      if (localStep === 0) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>나와 비슷한 체형을 골라보세요</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>체형을 선택해주세요.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {BODY_TYPES.map(bt => (
              <div key={bt.key} onClick={() => setBodyType(bt.key)} style={{
                ...selectStyle(bodyType === bt.key),
                textAlign: 'center', padding: '20px 8px',
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{bt.emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{bt.label}</div>
              </div>
            ))}
          </div>
        </div>
      );

      if (localStep === 1) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>평소에 어떤 운동을 하시나요?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {EXERCISE_TYPES.map(t => (
              <div key={t.key} onClick={() => setExerciseType(t.key)} style={{
                ...selectStyle(exerciseType === t.key),
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <span style={{ fontSize: 22 }}>{t.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      );

      if (localStep === 2) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>평소 일주일에 몇 번 운동하시나요?</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>주로 하는 운동 횟수를 알려주세요.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {EXERCISE_FREQ.map(f => (
              <div key={f.key} onClick={() => setExerciseFreq(f.key)} style={{
                ...selectStyle(exerciseFreq === f.key),
              }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      );

      if (localStep === 3) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>운동 경험이 어느 정도인가요?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {EXERCISE_EXP.map(e => (
              <div key={e.key} onClick={() => setExerciseExp(e.key)} style={{
                ...selectStyle(exerciseExp === e.key),
              }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{e.label}</span>
              </div>
            ))}
          </div>
        </div>
      );

      if (localStep === 4) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>운동할 때 강도는 어느 정도인가요?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {EXERCISE_INTENSITY.map(e => (
              <div key={e.key} onClick={() => setExerciseIntensity(e.key)} style={selectStyle(exerciseIntensity === e.key)}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{e.label}</span>
                {e.desc && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{e.desc}</div>}
              </div>
            ))}
          </div>
        </div>
      );

      if (localStep === 5) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>평소 활동량은 어느 정도인가요?</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>운동 시간 외에 얼마나 움직이는지 알려주세요. 육아·가사도 활동량에 포함돼요.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ACTIVITY_LEVELS.map(a => (
              <div key={a.key} onClick={() => setActivityLevel(a.key)} style={selectStyle(activityLevel === a.key)}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{a.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.desc}</div>
              </div>
            ))}
          </div>
        </div>
      );

      if (localStep === 6) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>하루에 식사를 몇 번 하시나요?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MEAL_OPTIONS.map(m => (
              <div key={m.key} onClick={() => setMealOption(m.key)} style={selectStyle(mealOption === m.key)}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // SECTION 2
    if (section === 1) {
      if (localStep === 0) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>목표가 무엇인가요?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DIET_OBJECTIVES.map(o => (
              <div key={o.key} onClick={() => setDietObjective(o.key)} style={{
                ...selectStyle(dietObjective === o.key),
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <span style={{ fontSize: 24 }}>{o.icon}</span>
                <div>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{o.label}</span>
                  {o.desc && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{o.desc}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

      if (localStep === 1) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>목표 체중이 몇 kg인가요?</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
            <button onClick={() => setGoalWeight(Math.max(30, goalWeight - 1))} style={{
              width: 44, height: 44, borderRadius: '50%', border: 'none',
              background: 'var(--bg-input, #F2F3F5)', fontSize: 20, fontWeight: 600,
              color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>-</button>
            <input type="number" value={goalWeight}
              onChange={e => { const v = Number(e.target.value); if (v >= 30 && v <= 200) setGoalWeight(v); }}
              style={{
                width: 100, textAlign: 'center', fontSize: 42, fontWeight: 800,
                color: 'var(--accent-primary)', fontFamily: 'var(--font-display)',
                border: 'none', background: 'transparent', outline: 'none',
              }}
            />
            <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-muted)', marginLeft: -8 }}>kg</span>
            <button onClick={() => setGoalWeight(Math.min(200, goalWeight + 1))} style={{
              width: 44, height: 44, borderRadius: '50%', border: 'none',
              background: 'var(--bg-input, #F2F3F5)', fontSize: 20, fontWeight: 600,
              color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>+</button>
          </div>
          <input type="range" min={30} max={200} step={1} value={goalWeight}
            onChange={e => setGoalWeight(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-primary)', marginBottom: 24 }}
          />
          <div style={{ background: 'var(--bg-card, #fff)', borderRadius: 16, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>체중 변화</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: objKey === 'gain' ? 'var(--accent-primary)' : '#22C55E' }}>
                {objKey === 'gain' ? '+' : objKey === 'lose' ? '-' : ''}{weightDiff}kg
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>평균 목표 칼로리</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{targetCal}kcal</span>
            </div>
            {weightDiff > 0 && objKey !== 'maintain' && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>예상 종료일</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{targetDate.getFullYear()}.{targetDate.getMonth() + 1}.{targetDate.getDate()}</span>
              </div>
            )}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>속도</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {SPEED_OPTIONS.map(s => (
              <button key={s.key} onClick={() => setSpeed(s.key)} style={{
                flex: 1, padding: '10px 0', borderRadius: 12, border: 'none',
                background: speed === s.key ? 'var(--accent-primary)' : 'var(--bg-input, #F2F3F5)',
                color: speed === s.key ? '#fff' : 'var(--text-muted)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{s.label}</button>
            ))}
          </div>
          {speed === 'fast' && (
            <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', fontSize: 11, color: '#D97706', lineHeight: 1.5 }}>
              빠른 감량은 요요에 주의하세요. 천천히 줄이는 게 더 오래 유지돼요.
            </div>
          )}
        </div>
      );

      if (localStep === 2) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
            {weightDiff > 0 && objKey !== 'maintain' ? `${weightDiff}kg ${objKey === 'lose' ? '줄이는' : '늘리는'} 건 충분히 가능한 목표예요` : '현재 체중을 건강하게 유지하는 목표예요'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '28px 0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>현재</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{currentWeight}kg</div>
            </div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-4-4l4 4-4 4" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>목표</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-primary)' }}>{goalWeight}kg</div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-card, #fff)', borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>하루 소비 칼로리 (TDEE)</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{tdee}kcal</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>기초대사량 + 활동량으로 계산된 하루 총 소비 칼로리</div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>평균 목표 칼로리</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-primary)' }}>{targetCal}kcal</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>목표 달성을 위해 하루 평균 섭취해야 할 칼로리</div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>목표 속도</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{objKey === 'lose' ? '-' : objKey === 'gain' ? '+' : ''}{weeklyChange.toFixed(1)}kg/주</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>건강하게 달성할 수 있는 주간 변화량</div>
            </div>
          </div>
        </div>
      );
    }

    // SECTION 3
    if (section === 2) {
      if (localStep === 0) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>하루 단백질 목표를 설정해요</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>건강한 몸을 위한 단백질 목표를 정해볼까요?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PROTEIN_LEVELS.map(p => (
              <div key={p.key} onClick={() => setProteinLevel(p.key)} style={{
                ...selectStyle(proteinLevel === p.key),
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{p.label}</span>
                    {p.recommended && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'var(--accent-primary)', color: '#fff' }}>추천</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.desc}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)' }}>{Math.round(refWeight * p.multiplier)}g</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>체중 × {p.multiplier}g</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

      if (localStep === 1) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>일주일에 먹는 양을 어떻게 나눌까요?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CALORIE_DIST.map(d => (
              <div key={d.key} onClick={() => setCalorieDist(d.key)} style={selectStyle(calorieDist === d.key)}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{d.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.desc}</div>
              </div>
            ))}
          </div>
        </div>
      );

      if (localStep === 2) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>어느 요일에 더 많이 먹고 싶으세요?</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>복수 선택 가능해요.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {DAYS.map(d => {
              const sel = highCalDays.includes(d);
              return (
                <div key={d} onClick={() => setHighCalDays(sel ? highCalDays.filter(x => x !== d) : [...highCalDays, d])} style={{
                  padding: '18px 0', borderRadius: 14, textAlign: 'center', cursor: 'pointer',
                  background: sel ? 'var(--accent-primary)' : 'var(--bg-card, #fff)',
                  color: sel ? '#fff' : 'var(--text-primary)',
                  fontSize: 14, fontWeight: 700, border: sel ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  transition: 'all 0.15s ease',
                }}>{d}</div>
              );
            })}
          </div>
        </div>
      );

      if (localStep === 3) {
        const highCal = Math.round(targetCal * 1.15);
        const lowCal = Math.round((targetCal * 7 - highCal * highCalDays.length) / (7 - highCalDays.length));
        return (
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>칼로리를 조정했어요!</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 20, height: 140 }}>
              {DAYS.map(d => {
                const isHigh = highCalDays.includes(d);
                const cal = isHigh ? highCal : lowCal;
                const h = Math.max(30, (cal / highCal) * 120);
                return (
                  <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)' }}>{cal}</div>
                    <div style={{ width: 32, height: h, borderRadius: 8, background: isHigh ? 'var(--accent-primary)' : 'rgba(137,206,245,0.3)' }} />
                    <div style={{ fontSize: 11, fontWeight: 600, color: isHigh ? 'var(--accent-primary)' : 'var(--text-muted)' }}>{d}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
              선택한 요일엔 여유 있게,<br />나머지 날엔 조금 더 가볍게 드시면 돼요.
            </div>
          </div>
        );
      }

      if (localStep === 4) return (
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>선호하는 식단이 무엇인가요?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {DIET_TYPES.map(goal => (
              <div key={goal.key} onClick={() => setDietType(goal.key)} style={{
                ...selectStyle(dietType === goal.key),
                padding: '20px 20px 18px',
              }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{goal.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.4 }}>{goal.desc}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: goal.carb, padding: '7px 0', borderRadius: 8, textAlign: 'center', background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)', color: '#fff', fontSize: 11, fontWeight: 700 }}>탄 {goal.carb}%</div>
                  <div style={{ flex: goal.protein, padding: '7px 0', borderRadius: 8, textAlign: 'center', background: 'linear-gradient(135deg, #D946EF, #E879F9)', color: '#fff', fontSize: 11, fontWeight: 700 }}>단 {goal.protein}%</div>
                  <div style={{ flex: goal.fat, padding: '7px 0', borderRadius: 8, textAlign: 'center', background: 'linear-gradient(135deg, #06B6D4, #22D3EE)', color: '#fff', fontSize: 11, fontWeight: 700 }}>지 {goal.fat}%</div>
                </div>
                {goal.warning && (
                  <div style={{ marginTop: 10, fontSize: 10, color: '#D97706', lineHeight: 1.4 }}>{goal.warning}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }
  };

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
        <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>프로그램</span>
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
        }}>
          {step === totalSteps - 1 ? '완료' : '다음'}
        </button>
      </div>
    </div>
  );
}
