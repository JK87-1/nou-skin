import { useState, useRef, useCallback } from 'react';
import { saveProfile } from '../storage/ProfileStorage';

const ONBOARDING_KEY = 'lua_onboarding_done';
export function isOnboardingDone() {
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
}

/* ── gradient backgrounds per step ── */
const GRADIENTS = [
  'linear-gradient(180deg, #C8681A 0%, #D97820 25%, #E88828 50%, #C85A10 75%, #8A3208 100%)',
  'linear-gradient(180deg, #FDE090 0%, #FAC860 20%, #F5A030 45%, #E88020 70%, #E08030 100%)',
  'linear-gradient(180deg, #FDE8A0 0%, #FCD870 18%, #FAC040 38%, #F8B030 58%, #F5C060 78%, #FADA70 100%)',
  'linear-gradient(180deg, #F8E090 0%, #F0CE78 10%, #E8BC60 18%, #C8DDF0 40%, #B8DFF0 58%, #B8DFF0 100%)',
];
const ANALYZING_GRADIENT = 'linear-gradient(180deg, #FBE898 0%, #F2D070 15%, #E0C468 30%, #D0D4E8 55%, #C4DBEE 75%, #B8DFF0 100%)';

/* ── sun config per step ── */
const SUN_CONFIGS = [
  { size: 260, bottom: -165, blur: 2, glow: 'none',
    bg: 'radial-gradient(circle at 50% 40%, #FFFFFF 0%, #FFE840 12%, #FFA820 35%, rgba(255,140,20,.25) 60%, transparent 75%)' },
  { size: 250, bottom: -70, blur: 1, glow: '0 0 80px rgba(255,200,60,.2)',
    bg: 'radial-gradient(circle at 50% 45%, #FFFFFF 0%, #FFFB70 8%, #FFD030 25%, rgba(255,170,40,.4) 50%, transparent 70%)' },
  { size: 280, bottom: 90, blur: 0.5, glow: '0 0 100px rgba(255,230,80,.25)',
    bg: 'radial-gradient(circle at 50% 50%, #FFFFFF 0%, #FFFCE0 6%, #FFE860 16%, rgba(255,215,60,.3) 35%, rgba(255,180,30,.08) 55%, transparent 70%)' },
  { size: 310, bottom: undefined, top: -115, blur: 1, glow: 'none',
    bg: 'radial-gradient(circle at 50% 50%, #FFFFFF 0%, rgba(255,248,200,.85) 10%, rgba(255,228,130,.3) 26%, rgba(184,223,240,.2) 44%, transparent 60%)' },
];

const ENERGY_LABELS = ['매우 낮음', '낮음', '보통', '좋음', '활기참'];
const MOOD_LABELS   = ['우울', '기분 다운', '평온', '좋음', '행복'];
const HYDRA_LABELS  = ['갈증', '약간 부족', '적당', '충분', '완벽'];

const INSIGHTS = [
  { cause: '탄수 위주 식사', result: '오후 에너지 저하', desc: '오늘 에너지가 낮은 건 어제 식단과 연결돼 있을 수 있어요.' },
  { cause: '수분 부족', result: '피부 수분 감소', desc: '물을 충분히 마시면 내일 피부가 달라질 수 있어요.' },
  { cause: '14일 기록', result: '내 패턴 발견', desc: '2주만 기록하면 내 몸의 패턴이 보여요.' },
];

export default function OnboardingPage({ onComplete }) {
  const [step, setStep] = useState(0);
  const [energy, setEnergy] = useState(2);
  const [mood, setMood] = useState(2);
  const [hydra, setHydra] = useState(2);
  const [analyzing, setAnalyzing] = useState(false);

  const touchRef = useRef({ startX: 0, startY: 0 });

  const goNext = useCallback(() => setStep(s => s >= 2 ? s : Math.min(s + 1, 3)), []);
  const goPrev = useCallback(() => setStep(s => Math.max(s - 1, 0)), []);
  const goToResult = useCallback(() => {
    setAnalyzing(true);
    setTimeout(() => { setAnalyzing(false); setStep(3); }, 1800);
  }, []);

  const handleTouchStart = (e) => {
    touchRef.current.startX = e.touches[0].clientX;
    touchRef.current.startY = e.touches[0].clientY;
  };
  const handleTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchRef.current.startX;
    const dy = e.changedTouches[0].clientY - touchRef.current.startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) goNext(); else goPrev();
    }
  };
  // PC: mouse drag support
  const handleMouseDown = (e) => {
    touchRef.current.startX = e.clientX;
    touchRef.current.startY = e.clientY;
    touchRef.current.mouseDown = true;
  };
  const handleMouseUp = (e) => {
    if (!touchRef.current.mouseDown) return;
    touchRef.current.mouseDown = false;
    const dx = e.clientX - touchRef.current.startX;
    const dy = e.clientY - touchRef.current.startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) goNext(); else goPrev();
    }
  };
  // PC: click to advance (steps 0,1 only — no sliders/buttons to conflict)
  const handleBgClick = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    const dx = Math.abs(e.clientX - touchRef.current.startX);
    const dy = Math.abs(e.clientY - touchRef.current.startY);
    if (dx < 5 && dy < 5 && step < 2) goNext();
  };

  const handleFinish = () => {
    saveProfile({
      onboardingEnergy: energy,
      onboardingMood: mood,
      onboardingHydration: hydra,
    });
    localStorage.setItem(ONBOARDING_KEY, 'true');
    onComplete();
  };

  const sun = analyzing ? {
    size: 300, top: -40, blur: 1.5, glow: '0 0 120px rgba(255,240,100,.2)',
    bg: 'radial-gradient(circle at 50% 50%, #FFFFFF 0%, rgba(255,250,210,.9) 8%, rgba(255,235,100,.3) 22%, rgba(200,230,245,.2) 42%, transparent 58%)',
  } : SUN_CONFIGS[step];

  /* ── slider style injection ── */
  const sliderCSS = `
    .lua-onb-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 2px; background: rgba(180,110,0,.15); border-radius: 99px; outline: none; }
    .lua-onb-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 15px; height: 15px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #FFFFFF, #FFD830); box-shadow: 0 0 10px rgba(255,200,30,.5); cursor: pointer; border: none; }
    .lua-onb-slider::-moz-range-thumb { width: 15px; height: 15px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #FFFFFF, #FFD830); box-shadow: 0 0 10px rgba(255,200,30,.5); cursor: pointer; border: none; }
  `;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleBgClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 2003,
        background: analyzing ? ANALYZING_GRADIENT : GRADIENTS[step],
        transition: 'background 1.2s ease',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'inherit',
      }}
    >
      <style>{sliderCSS}</style>

      {/* ── Sun orb ── */}
      <div style={{
        position: 'absolute',
        left: '50%', transform: 'translateX(-50%)',
        width: sun.size, height: sun.size, borderRadius: '50%',
        background: sun.bg,
        filter: `blur(${sun.blur}px)`,
        boxShadow: sun.glow,
        ...(sun.top !== undefined ? { top: sun.top } : { bottom: sun.bottom }),
        transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Bottom glow (step 0 only) ── */}
      {step === 0 && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 110, background: 'linear-gradient(180deg, transparent, rgba(255,160,30,.3))',
          pointerEvents: 'none', zIndex: 0,
        }} />
      )}

      {/* ── Content area ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: step === 0 ? 'center' : 'flex-start',
        overflowY: step >= 2 ? 'auto' : 'hidden',
        WebkitOverflowScrolling: 'touch',
      }}>

        {/* 01 — 여명 */}
        {step === 0 && (
          <div style={{ textAlign: 'center', paddingBottom: 90 }}>
            <div style={{
              fontSize: 48, fontWeight: 200, fontStyle: 'italic',
              letterSpacing: '.2em',
              color: 'rgba(255,248,220,.95)',
              textShadow: '0 0 40px rgba(255,220,80,.5)',
            }}>lua</div>
            <div style={{
              fontSize: 9, letterSpacing: '.25em', textTransform: 'uppercase',
              color: 'rgba(255,220,140,.45)', marginTop: 10,
            }}>Know your body</div>
          </div>
        )}

        {/* 02 — 해뜨기 */}
        {step === 1 && (
          <div style={{ padding: '38px 24px 125px' }}>
            <div style={{
              fontSize: 8, letterSpacing: '.22em', textTransform: 'uppercase',
              color: 'rgba(180,90,10,.5)', marginBottom: 24,
            }}>Welcome to LUA</div>
            <div style={{
              fontSize: 19, fontWeight: 300, lineHeight: 1.42,
              color: 'rgba(120,50,5,.9)', marginBottom: 16,
            }}>
              내 몸에서 일어나는 일을<br/>
              <strong style={{ fontWeight: 500, color: '#8A3800' }}>처음으로 이해</strong>하게 돼요
            </div>
            <div style={{
              fontSize: 11, lineHeight: 1.75,
              color: 'rgba(140,70,10,.45)',
            }}>
              식단, 수면, 움직임이<br/>
              에너지와 피부와 기분으로 연결되고 있어요.
            </div>
          </div>
        )}

        {/* 03 — 일출 */}
        {step === 2 && !analyzing && (
          <div style={{ padding: '26px 20px 0' }}>
            <div style={{
              fontSize: 8, letterSpacing: '.22em', textTransform: 'uppercase',
              color: 'rgba(160,100,0,.5)', textAlign: 'center', marginBottom: 8,
            }}>Right now</div>
            <div style={{
              fontSize: 16, fontWeight: 300, textAlign: 'center',
              color: 'rgba(100,50,0,.85)', marginBottom: 28,
            }}>지금 어떤 상태예요?</div>

            {[
              { label: '에너지', value: energy, set: setEnergy, labels: ENERGY_LABELS },
              { label: '기분', value: mood, set: setMood, labels: MOOD_LABELS },
              { label: '수분', value: hydra, set: setHydra, labels: HYDRA_LABELS },
            ].map(({ label, value, set, labels }) => (
              <div key={label} style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'rgba(150,90,0,.45)' }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#8A5000' }}>{labels[value]}</span>
                </div>
                <input
                  type="range" min={0} max={4} step={1}
                  value={value}
                  onChange={e => set(Number(e.target.value))}
                  className="lua-onb-slider"
                />
              </div>
            ))}

            <button onClick={goToResult} style={{
              width: '100%', padding: 11, borderRadius: 99,
              background: 'rgba(180,100,0,.08)',
              border: '1px solid rgba(180,100,0,.15)',
              color: 'rgba(120,60,0,.65)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'inherit', marginTop: 8,
            }}>LUA가 분석할게요 →</button>
          </div>
        )}

        {/* Analyzing transition */}
        {analyzing && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', paddingBottom: 60,
          }}>
            <style>{`
              @keyframes luaPulse { 0%,100% { opacity: .6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.04); } }
              @keyframes luaDots { 0% { content: ''; } 33% { content: '.'; } 66% { content: '..'; } 100% { content: '...'; } }
              .lua-analyzing-dots::after { content: ''; animation: luaDots 1.2s steps(1) infinite; }
            `}</style>
            <div style={{
              fontSize: 14, fontWeight: 300, color: 'rgba(80,60,20,.7)',
              animation: 'luaPulse 2s ease-in-out infinite',
            }}>
              <span className="lua-analyzing-dots">분석 중</span>
            </div>
          </div>
        )}

        {/* 04 — 완전히 뜬 해 */}
        {step === 3 && (
          <div style={{ padding: '148px 20px 40px' }}>
            <div style={{
              fontSize: 8, letterSpacing: '.2em', textTransform: 'uppercase',
              color: 'rgba(26,58,74,.45)', textAlign: 'center', marginBottom: 16,
            }}>LUA가 발견한 것</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {INSIGHTS.map((item, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,.68)',
                  border: '0.5px solid rgba(100,180,220,.18)',
                  borderRadius: 12, padding: '10px 12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 99, fontSize: 10, fontWeight: 500,
                      background: 'rgba(255,210,80,.15)', color: '#8A6000',
                    }}>{item.cause}</span>
                    <span style={{ fontSize: 10, color: '#AACCD8' }}>→</span>
                    <span style={{
                      padding: '3px 8px', borderRadius: 99, fontSize: 10, fontWeight: 500,
                      background: 'rgba(100,180,220,.14)', color: '#2A6A8A',
                    }}>{item.result}</span>
                  </div>
                  <div style={{ fontSize: 9, color: '#6A9AAA', lineHeight: 1.55 }}>{item.desc}</div>
                </div>
              ))}
            </div>

            <button onClick={handleFinish} style={{
              width: '100%', padding: 12, borderRadius: 99,
              background: 'linear-gradient(120deg, rgba(26,58,74,.12), rgba(26,58,74,.08))',
              border: '1px solid rgba(26,58,74,.14)',
              color: '#1A3A4A',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'inherit',
            }}>LUA 시작하기</button>
          </div>
        )}
      </div>

      {/* ── Dot indicators ── */}
      {!analyzing && <div style={{
        position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
        left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6, zIndex: 2,
      }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} onClick={() => { if (i <= 2 || step === 3) setStep(i); }} style={{
            width: step === i ? 20 : 8,
            height: 8,
            borderRadius: step === i ? 99 : '50%',
            background: step === i ? '#FFD060' : 'rgba(255,200,80,.2)',
            transition: 'all 0.3s ease',
            cursor: 'pointer',
          }} />
        ))}
      </div>}
    </div>
  );
}
