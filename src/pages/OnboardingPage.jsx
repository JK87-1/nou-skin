import { useState } from 'react';
import { saveProfile } from '../storage/ProfileStorage';
import { saveBodyRecord, saveBodyProfile } from '../storage/BodyStorage';

const ONBOARDING_KEY = 'lua_onboarding_done';
export function isOnboardingDone() {
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
}

const INTERESTS = [
  { icon: '⚡', label: '에너지·컨디션' },
  { icon: '✨', label: '피부 관리' },
  { icon: '⚖️', label: '체중 관리' },
  { icon: '😴', label: '수면 개선' },
  { icon: '🧘', label: '스트레스' },
  { icon: '💊', label: '영양 관리' },
];

function calcAge(birthStr) {
  const m = birthStr.match(/(\d{4})/);
  if (!m) return 25;
  return new Date().getFullYear() - Number(m[1]);
}

function calcBMR(gender, weight, height, age) {
  if (gender === '여성') return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
  return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
}

function StepDots({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: i === current ? 18 : 6, height: 6,
          borderRadius: i === current ? 4 : 3,
          background: i === current ? '#1a5c3a' : 'rgba(180,210,180,0.5)',
          transition: 'all 0.3s ease',
        }} />
      ))}
    </div>
  );
}

export default function OnboardingPage({ onComplete, onGoSettings }) {
  const [step, setStep] = useState(0);

  // Step 1
  const [name, setName] = useState('');

  // Step 2
  const [gender, setGender] = useState('');
  const [birth, setBirth] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  // Step 3
  const [interests, setInterests] = useState([]);

  const age = calcAge(birth);
  const w = Number(weight);
  const h = Number(height);
  const bmr = w > 0 && h > 0 && gender ? calcBMR(gender, w, h, age) : 0;
  const tdee = bmr > 0 ? Math.round(bmr * 1.55) : 0;

  const canNext = [
    name.trim().length > 0,
    gender && birth.trim().length >= 6 && h > 0 && w > 0,
    interests.length > 0,
    true,
  ];

  const handleFinish = () => {
    saveProfile({
      nickname: name.trim(),
      gender,
      birthYear: birth.match(/(\d{4})/)?.[1] || '',
      onboardingInterests: interests,
    });
    saveBodyProfile({ height: h });
    if (w > 0) saveBodyRecord(w);
    if (tdee > 0) {
      saveProfile({ dietTargetCal: tdee, currentWeight: w, goalWeight: w });
    }
    localStorage.setItem(ONBOARDING_KEY, 'true');
    onComplete();
  };

  const toggleInterest = (label) => {
    setInterests(prev => prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label]);
  };

  const cardStyle = {
    background: 'transparent',
    border: 'none',
    padding: '20px 16px',
    maxWidth: 360,
    minHeight: 520,
    width: '100%',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  };

  const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.6)',
    border: '0.5px solid rgba(180,210,180,0.6)',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 15,
    color: '#2a3a2a',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  const mainBtnStyle = (enabled) => ({
    width: '100%',
    background: enabled ? 'rgba(26,92,58,0.85)' : 'rgba(26,92,58,0.3)',
    border: 'none',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontWeight: 500,
    color: '#ffffff',
    cursor: enabled ? 'pointer' : 'default',
    fontFamily: 'inherit',
    opacity: enabled ? 1 : 0.5,
  });

  const next = () => { if (canNext[step]) setStep(s => s + 1); };
  const prev = () => { if (step > 0) setStep(s => s - 1); };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 18px',
      background: 'transparent',
    }}>
      <div style={cardStyle}>
        <StepDots current={step} total={4} />

        {step > 0 && step < 4 && (
          <div onClick={prev} style={{ position: 'absolute', top: 20, left: 20, fontSize: 13, color: 'rgba(60,80,60,0.55)', cursor: 'pointer' }}>← 이전</div>
        )}

        {/* Step 1: Welcome */}
        {step === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ textAlign: 'center', marginBottom: 24, marginTop: 32 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🌿</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: '#2a3a2a', marginBottom: 8 }}>안녕하세요!</div>
              <div style={{ fontSize: 13, color: 'rgba(60,80,60,0.6)', lineHeight: 1.6 }}>나만의 웰니스 루틴을 함께 만들어가요</div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'rgba(60,80,60,0.55)', marginBottom: 6 }}>이름 또는 닉네임</div>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="이름을 입력해주세요"
                style={inputStyle}
                autoFocus
              />
            </div>

            <div style={{
              background: 'rgba(180,230,200,0.25)', borderRadius: 12, padding: 12,
              fontSize: 12, color: '#1a5c3a', lineHeight: 1.6, marginTop: 12,
            }}>
              이름으로 맞춤 인사이트를 전달해드릴게요 😊
            </div>

            <div style={{ flex: 1 }} />
            <button onClick={next} style={mainBtnStyle(canNext[0])} disabled={!canNext[0]}>다음 →</button>
          </div>
        )}

        {/* Step 2: Basic Info */}
        {step === 1 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#2a3a2a', marginBottom: 4 }}>기본 정보</div>
              <div style={{ fontSize: 12, color: 'rgba(60,80,60,0.55)' }}>맞춤 분석에 사용돼요</div>
            </div>

            {/* Gender */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'rgba(60,80,60,0.55)', marginBottom: 6 }}>신체 기준</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['여성', '남성'].map(g => (
                  <button key={g} onClick={() => setGender(g)} style={{
                    flex: 1, padding: '10px 0', borderRadius: 12,
                    background: gender === g ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
                    border: gender === g ? '0.5px solid #4db87a' : '0.5px solid rgba(180,210,180,0.4)',
                    fontSize: 14, fontWeight: gender === g ? 500 : 400,
                    color: gender === g ? '#1a5c3a' : '#2a3a2a',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>{g}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(60,80,60,0.45)', marginTop: 4 }}>
                성 정체성과 다른 경우 본인에게 맞는 신체 기준을 선택해주세요
              </div>
            </div>

            {/* Birth */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'rgba(60,80,60,0.55)', marginBottom: 6 }}>생년월일</div>
              <input
                value={birth}
                onChange={e => setBirth(e.target.value)}
                placeholder="예: 1995.03.12"
                style={inputStyle}
              />
            </div>

            {/* Height & Weight */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(60,80,60,0.55)', marginBottom: 6 }}>키</div>
                <div style={{ position: 'relative' }}>
                  <input
                    value={height}
                    onChange={e => setHeight(e.target.value)}
                    type="number" placeholder="165"
                    style={{ ...inputStyle, paddingRight: 36 }}
                  />
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'rgba(60,80,60,0.55)' }}>cm</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(60,80,60,0.55)', marginBottom: 6 }}>몸무게</div>
                <div style={{ position: 'relative' }}>
                  <input
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    type="number" placeholder="55"
                    style={{ ...inputStyle, paddingRight: 36 }}
                  />
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'rgba(60,80,60,0.55)' }}>kg</span>
                </div>
              </div>
            </div>

            {/* Privacy notice */}
            <div style={{
              background: 'rgba(255,255,255,0.45)', borderRadius: 12, padding: 12,
              fontSize: 12, color: '#1a5c3a', lineHeight: 1.6,
            }}>
              개인정보는 기기에만 저장되며 외부로 전송되지 않아요
            </div>

            {/* BMR/TDEE display */}
            {bmr > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <div style={{
                  flex: 1, background: 'rgba(180,230,200,0.25)', borderRadius: 10, padding: '8px 10px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 10, color: 'rgba(60,80,60,0.55)' }}>BMR</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1a5c3a' }}>{bmr.toLocaleString()}</div>
                </div>
                <div style={{
                  flex: 1, background: 'rgba(180,230,200,0.25)', borderRadius: 10, padding: '8px 10px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 10, color: 'rgba(60,80,60,0.55)' }}>TDEE</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1a5c3a' }}>{tdee.toLocaleString()}</div>
                </div>
              </div>
            )}

            <div style={{ flex: 1 }} />
            <button onClick={next} style={mainBtnStyle(canNext[1])} disabled={!canNext[1]}>다음 →</button>
          </div>
        )}

        {/* Step 3: Interests */}
        {step === 2 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#2a3a2a', marginBottom: 4 }}>관심사 선택</div>
              <div style={{ fontSize: 12, color: 'rgba(60,80,60,0.55)' }}>중복 선택 가능해요</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {INTERESTS.map(item => {
                const active = interests.includes(item.label);
                return (
                  <button key={item.label} onClick={() => toggleInterest(item.label)} style={{
                    padding: '14px 10px', borderRadius: 14, textAlign: 'center',
                    background: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
                    border: active ? '0.5px solid #4db87a' : '0.5px solid rgba(180,210,180,0.4)',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.2s ease',
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{item.icon}</div>
                    <div style={{
                      fontSize: 12, fontWeight: 500,
                      color: active ? '#1a5c3a' : '#2a3a2a',
                    }}>{item.label}</div>
                  </button>
                );
              })}
            </div>

            <div style={{ flex: 1 }} />
            <button onClick={next} style={mainBtnStyle(canNext[2])} disabled={!canNext[2]}>다음 →</button>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 3 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ textAlign: 'center', marginTop: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🌱</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: '#2a3a2a', marginBottom: 8 }}>준비 완료!</div>
              <div style={{ fontSize: 13, color: 'rgba(60,80,60,0.6)', lineHeight: 1.8 }}>
                {name.trim()}님의 맞춤 웰니스 루틴을 시작할게요
              </div>
            </div>

            {/* Ready items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {interests.map(label => {
                const item = INTERESTS.find(i => i.label === label);
                return (
                  <div key={label} style={{
                    background: 'rgba(180,230,200,0.3)', borderRadius: 12, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ fontSize: 14 }}>{item?.icon}</span>
                    <span style={{ fontSize: 12, color: '#1a5c3a' }}>{label}</span>
                  </div>
                );
              })}
              {tdee > 0 && (
                <div style={{
                  background: 'rgba(180,230,200,0.3)', borderRadius: 12, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 14 }}>📊</span>
                  <span style={{ fontSize: 12, color: '#1a5c3a' }}>TDEE {tdee.toLocaleString()} kcal 계산 완료</span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ borderTop: '0.5px solid rgba(180,210,180,0.4)', margin: '14px 0' }} />

            <div style={{ fontSize: 11, color: 'rgba(60,80,60,0.5)', marginBottom: 8 }}>나중에 설정에서 추가할 수 있어요</div>

            {/* Later items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { icon: '⚖️', text: '다이어트 프로그램 · 목표 몸무게' },
                { icon: '😴', text: '수면 목표 · 활동 수준 세부 설정' },
                { icon: '💊', text: '영양제 루틴 · 알림 시간 설정' },
              ].map(item => (
                <div key={item.text} style={{
                  background: 'rgba(255,255,255,0.4)', borderRadius: 12, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 13 }}>{item.icon}</span>
                  <span style={{ fontSize: 12, color: 'rgba(60,80,60,0.65)' }}>{item.text}</span>
                </div>
              ))}
            </div>

            <div style={{ flex: 1 }} />

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => { handleFinish(); onGoSettings?.(); }} style={{
                width: '100%',
                background: 'rgba(255,255,255,0.5)',
                border: '0.5px solid rgba(77,184,122,0.4)',
                borderRadius: 14, padding: 12,
                fontSize: 13, fontWeight: 500, color: '#1a5c3a',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>설정 먼저 채우기 →</button>
              <button onClick={handleFinish} style={mainBtnStyle(true)}>지금 바로 시작하기 🌿</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
