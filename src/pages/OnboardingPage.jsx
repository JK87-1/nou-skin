import { useState } from 'react';
import { saveProfile } from '../storage/ProfileStorage';
import { saveBodyRecord, saveBodyProfile } from '../storage/BodyStorage';

const ONBOARDING_KEY = 'lua_onboarding_done';
export function isOnboardingDone() {
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
}

const SECTIONS = ['환영', '기본 정보', '관심사', '완료'];

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

export default function OnboardingPage({ onComplete, onGoSettings }) {
  const [step, setStep] = useState(0);

  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [birth, setBirth] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
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

  const next = () => { if (canNext[step]) setStep(s => s + 1); };
  const prev = () => { if (step > 0) setStep(s => s - 1); };

  const selectStyle = (isSelected) => ({
    padding: '16px 20px', borderRadius: 16, cursor: 'pointer',
    background: isSelected ? 'rgba(137,206,245,0.1)' : 'var(--bg-card, #fff)',
    border: isSelected ? '2px solid var(--accent-primary)' : '2px solid transparent',
    transition: 'all 0.15s ease', fontFamily: 'inherit',
  });

  const inputStyle = {
    width: '100%',
    padding: '14px 16px', borderRadius: 14, border: '2px solid transparent',
    background: 'var(--bg-card, #fff)', fontSize: 15, color: 'var(--text-primary)',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  };

  const renderStep = () => {
    if (step === 0) return (
      <div>
        <div style={{ textAlign: 'center', marginTop: 40, marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>안녕하세요!</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>나만의 웰니스 루틴을 함께 만들어가요</div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>이름 또는 닉네임</div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="이름을 입력해주세요"
            style={inputStyle}
            autoFocus
          />
        </div>
        <div style={{
          padding: '14px 16px', borderRadius: 14,
          background: 'rgba(137,206,245,0.08)', border: '1px solid rgba(137,206,245,0.15)',
          fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 16,
        }}>
          이름으로 맞춤 인사이트를 전달해드릴게요 😊
        </div>
      </div>
    );

    if (step === 1) return (
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>기본 정보</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>맞춤 분석에 사용돼요</div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>신체 기준</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {['여성', '남성'].map(g => (
              <div key={g} onClick={() => setGender(g)} style={{
                ...selectStyle(gender === g),
                flex: 1, textAlign: 'center', padding: '14px 0',
              }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{g}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, opacity: 0.7 }}>
            성 정체성과 다른 경우 본인에게 맞는 신체 기준을 선택해주세요
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>생년월일</div>
          <input
            value={birth}
            onChange={e => setBirth(e.target.value)}
            placeholder="예: 1995.03.12"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>키</div>
            <div style={{ position: 'relative' }}>
              <input
                value={height}
                onChange={e => setHeight(e.target.value)}
                type="number" placeholder="165"
                style={{ ...inputStyle, paddingRight: 40 }}
              />
              <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-muted)' }}>cm</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>몸무게</div>
            <div style={{ position: 'relative' }}>
              <input
                value={weight}
                onChange={e => setWeight(e.target.value)}
                type="number" placeholder="55"
                style={{ ...inputStyle, paddingRight: 40 }}
              />
              <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-muted)' }}>kg</span>
            </div>
          </div>
        </div>

        <div style={{
          padding: '14px 16px', borderRadius: 14,
          background: 'rgba(137,206,245,0.08)', border: '1px solid rgba(137,206,245,0.15)',
          fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6,
        }}>
          개인정보는 기기에만 저장되며 외부로 전송되지 않아요
        </div>

        {bmr > 0 && (
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <div style={{
              flex: 1, ...selectStyle(true), textAlign: 'center', padding: '12px 0',
              background: 'rgba(137,206,245,0.1)', border: '2px solid var(--accent-primary)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>BMR</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{bmr.toLocaleString()}</div>
            </div>
            <div style={{
              flex: 1, ...selectStyle(true), textAlign: 'center', padding: '12px 0',
              background: 'rgba(137,206,245,0.1)', border: '2px solid var(--accent-primary)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>TDEE</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{tdee.toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>
    );

    if (step === 2) return (
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>관심사 선택</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>중복 선택 가능해요</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {INTERESTS.map(item => {
            const active = interests.includes(item.label);
            return (
              <div key={item.label} onClick={() => toggleInterest(item.label)} style={{
                ...selectStyle(active),
                textAlign: 'center', padding: '20px 8px',
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{item.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    );

    if (step === 3) return (
      <div>
        <div style={{ textAlign: 'center', marginTop: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🌱</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>준비 완료!</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>
            {name.trim()}님의 맞춤 웰니스 루틴을 시작할게요
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {interests.map(label => {
            const item = INTERESTS.find(i => i.label === label);
            return (
              <div key={label} style={{
                ...selectStyle(true), padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 18 }}>{item?.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
              </div>
            );
          })}
          {tdee > 0 && (
            <div style={{
              ...selectStyle(true), padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>📊</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>TDEE {tdee.toLocaleString()} kcal 계산 완료</span>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', margin: '20px 0' }} />

        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>나중에 설정에서 추가할 수 있어요</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { icon: '⚖️', text: '다이어트 프로그램 · 목표 몸무게' },
            { icon: '😴', text: '수면 목표 · 활동 수준 세부 설정' },
            { icon: '💊', text: '영양제 루틴 · 알림 시간 설정' },
          ].map(item => (
            <div key={item.text} style={{
              padding: '12px 16px', borderRadius: 16,
              background: 'var(--bg-card, #fff)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2003,
      background: 'linear-gradient(to bottom, #ace2fc, #ffffff)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
        {step > 0 && (
          <div onClick={prev} style={{
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
        )}
        <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>시작하기</span>
      </div>

      {/* Progress bar */}
      <div style={{ padding: '16px 24px 0' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {SECTIONS.map((s, i) => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? 'var(--accent-primary)' : 'rgba(0,0,0,0.08)', transition: 'background 0.3s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {SECTIONS.map((s, i) => (
            <span key={s} style={{ fontSize: 10, fontWeight: i === step ? 700 : 400, color: i === step ? 'var(--accent-primary)' : 'var(--text-muted)' }}>{s}</span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '24px 24px 120px' }}>
        {renderStep()}
      </div>

      {/* Bottom button */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '16px 24px calc(env(safe-area-inset-bottom, 0px) + 16px)',
        background: 'linear-gradient(transparent, #fff 20%)',
      }}>
        {step === 3 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => { handleFinish(); onGoSettings?.(); }} style={{
              width: '100%', padding: '14px 0', borderRadius: 16, border: '2px solid var(--accent-primary)',
              background: 'transparent', color: 'var(--accent-primary)',
              fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>설정 먼저 채우기 →</button>
            <button onClick={handleFinish} style={{
              width: '100%', padding: '16px 0', borderRadius: 16, border: 'none',
              background: 'var(--accent-primary)', color: '#fff',
              fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>지금 바로 시작하기 🌿</button>
          </div>
        ) : (
          <button onClick={next} disabled={!canNext[step]} style={{
            width: '100%', padding: '16px 0', borderRadius: 16, border: 'none',
            background: canNext[step] ? 'var(--accent-primary)' : 'var(--bg-input, #E0E0E0)',
            color: canNext[step] ? '#fff' : 'var(--text-dim)',
            fontSize: 16, fontWeight: 700, cursor: canNext[step] ? 'pointer' : 'default',
            fontFamily: 'inherit', transition: 'all 0.2s ease',
          }}>다음</button>
        )}
      </div>
    </div>
  );
}
