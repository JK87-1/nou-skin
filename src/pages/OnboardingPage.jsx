import { useState, useRef, useCallback, useEffect } from 'react';
import { saveProfile, getDeviceId } from '../storage/ProfileStorage';
import { trackUserSignedUp, identifyUser } from '../analytics/amplitude';

const ONBOARDING_KEY = 'lua_onboarding_done';
export function isOnboardingDone() {
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
}

const FONT_DISPLAY = "'Outfit', 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif";

/* ── All backgrounds (stacked, crossfade via opacity) ── */
const GRADIENTS = [
  'linear-gradient(180deg, #C8681A 0%, #D97820 25%, #E88828 50%, #C85A10 75%, #8A3208 100%)',       // 01 여명
  'linear-gradient(180deg, #FDE090 0%, #FAC860 20%, #F5A030 45%, #E88020 70%, #E08030 100%)',       // 02 해뜨기
  'linear-gradient(180deg, #FDE8A0 0%, #FCD870 18%, #FAC040 38%, #F8B030 58%, #F5C060 78%, #FADA70 100%)', // 03 일출
  'linear-gradient(180deg, #F5D880 0%, #EDD088 8%, #E0C890 16%, #D0CCA8 26%, #C0D0C0 36%, #B8D8D8 48%, #B8DDF0 62%, #B8DFF0 100%)', // 04 완전히 뜬 해
];

/* ── Sun configs per step ── */
/* 04 기준 대칭: 01·04 모두 155px 잘림, 02·03 균등 배치 */
const screenH = () => typeof window !== 'undefined' ? window.innerHeight : 800;
const SUN_SIZES = [260, 250, 280, 310];
const getSunBottom = (step) => {
  const H = screenH();
  const size = SUN_SIZES[step];
  // 01: 하단 155px 잘림 → bottom = -155
  // 04: 상단 155px 잘림 → bottom = H - (size - 155) = H - 155
  // 01 center = -155 + 130 = -25,  04 center = H - 155 + 155 = H
  // 간격 = (H - (-25)) / 3 = (H + 25) / 3
  const c1 = -155 + SUN_SIZES[0] / 2;            // 01 center: -25
  const c4 = H - 155 + SUN_SIZES[3] / 2;         // 04 center: H
  const gap = (c4 - c1) / 3;
  const centers = [c1, c1 + gap, c1 + gap * 2, c4];
  return Math.round(centers[step] - size / 2);
};
const SUN_STEPS = [
  { size: 260, blur: 2,   glow: 'none',
    bg: 'radial-gradient(circle at 50% 40%, #FFFFFF 0%, #FFE840 12%, #FFA820 35%, rgba(255,140,20,.25) 60%, transparent 75%)' },
  { size: 250, blur: 1,   glow: '0 0 80px rgba(255,200,60,.2)',
    bg: 'radial-gradient(circle at 50% 45%, #FFFFFF 0%, #FFFB70 8%, #FFD030 25%, rgba(255,170,40,.4) 50%, transparent 70%)' },
  { size: 280, blur: 0.5, glow: '0 0 100px rgba(255,230,80,.25)',
    bg: 'radial-gradient(circle at 50% 50%, #FFFFFF 0%, #FFFCE0 6%, #FFE860 16%, rgba(255,215,60,.3) 35%, rgba(255,180,30,.08) 55%, transparent 70%)' },
  { size: 310, blur: 1,   glow: 'none',
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

/* ── Transition durations ── */
const TRANS_DUR = { normal: 900, toS4: 2000 }; // ms

export default function OnboardingPage({ onComplete }) {
  const [step, setStep] = useState(0);       // visual target step (0-3)
  const [locked, setLocked] = useState(false); // prevent input during transition
  const [s4Phase, setS4Phase] = useState('idle'); // idle | contentIn | done
  const [energy, setEnergy] = useState(2);
  const [mood, setMood] = useState(2);
  const [hydra, setHydra] = useState(2);

  const touchRef = useRef({ startX: 0, startY: 0 });
  const prevStepRef = useRef(0);

  /* ── Navigation ── */
  const goTo = useCallback((target) => {
    if (locked || target === step || target < 0 || target > 3) return;
    if (target === 3) return; // step 3 only via button
    setLocked(true);
    prevStepRef.current = step;
    setStep(target);
    setTimeout(() => setLocked(false), TRANS_DUR.normal);
  }, [step, locked]);

  const goNext = useCallback(() => goTo(step + 1), [goTo, step]);
  const goPrev = useCallback(() => goTo(step - 1), [goTo, step]);

  /* ── 03→04 special transition ── */
  const goToS4 = useCallback(() => {
    if (locked || step !== 2) return;
    setLocked(true);
    prevStepRef.current = 2;
    setStep(3);
    setTimeout(() => {
      setS4Phase('contentIn');
    }, TRANS_DUR.toS4 + 200);
    setTimeout(() => {
      setS4Phase('done');
      setLocked(false);
    }, TRANS_DUR.toS4 + 1000);
  }, [step, locked]);

  /* ── Touch / mouse handlers ── */
  const handleTouchStart = (e) => {
    touchRef.current.startX = e.touches[0].clientX;
    touchRef.current.startY = e.touches[0].clientY;
  };
  const handleTouchEnd = (e) => {
    if (locked) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.startX;
    const dy = e.changedTouches[0].clientY - touchRef.current.startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) goNext(); else goPrev();
    }
  };
  const handleMouseDown = (e) => {
    touchRef.current.startX = e.clientX;
    touchRef.current.startY = e.clientY;
    touchRef.current.mouseDown = true;
  };
  const handleMouseUp = (e) => {
    if (!touchRef.current.mouseDown || locked) return;
    touchRef.current.mouseDown = false;
    const dx = e.clientX - touchRef.current.startX;
    const dy = e.clientY - touchRef.current.startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) goNext(); else goPrev();
    }
  };
  const handleBgClick = (e) => {
    if (locked) return;
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
    const signupDate = new Date().toISOString();
    try { localStorage.setItem('lua_signup_date', signupDate); } catch {}
    localStorage.setItem(ONBOARDING_KEY, 'true');
    try {
      identifyUser(getDeviceId(), { signup_date: signupDate });
      trackUserSignedUp('onboarding');
    } catch {}
    onComplete();
  };

  /* ── Sun style (CSS-transition driven) ── */
  const sun = SUN_STEPS[step];
  const sunBottom = getSunBottom(step);
  const transDur = step === 3 && prevStepRef.current === 2
    ? `${TRANS_DUR.toS4}ms` : `${TRANS_DUR.normal}ms`;

  const CSS = `
    .lua-onb-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 2px; background: rgba(180,110,0,.15); border-radius: 99px; outline: none; }
    .lua-onb-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 15px; height: 15px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #FFFFFF, #FFD830); box-shadow: 0 0 10px rgba(255,200,30,.5); cursor: pointer; border: none; }
    .lua-onb-slider::-moz-range-thumb { width: 15px; height: 15px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #FFFFFF, #FFD830); box-shadow: 0 0 10px rgba(255,200,30,.5); cursor: pointer; border: none; }
    @keyframes luaFadeSlideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  `;

  /* ── Content visibility helper ── */
  const contentStyle = (i) => ({
    position: i === step ? 'relative' : 'absolute',
    inset: i === step ? undefined : 0,
    opacity: i === step ? 1 : 0,
    transition: `opacity ${i === 3 ? TRANS_DUR.toS4 * 0.5 : TRANS_DUR.normal * 0.5}ms ease`,
    pointerEvents: i === step && !locked ? 'auto' : 'none',
    zIndex: i === step ? 1 : 0,
  });

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleBgClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 2003,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', fontFamily: 'inherit',
      }}
    >
      <style>{CSS}</style>

      {/* ── Background layers (stacked, crossfade) ── */}
      {GRADIENTS.map((grad, i) => (
        <div key={i} style={{
          position: 'absolute', inset: 0,
          background: grad,
          opacity: step >= i ? 1 : 0,
          transition: `opacity ${i === 3 ? TRANS_DUR.toS4 : TRANS_DUR.normal}ms cubic-bezier(0.4, 0, 0.6, 1)`,
          zIndex: -4 + i,
        }} />
      ))}

      {/* ── Sun orb (single element, CSS transition) ── */}
      <div style={{
        position: 'absolute',
        left: '50%', transform: 'translateX(-50%)',
        width: sun.size, height: sun.size,
        bottom: sunBottom,
        borderRadius: '50%',
        background: sun.bg,
        filter: `blur(${sun.blur}px)`,
        boxShadow: sun.glow,
        transition: `bottom ${transDur} cubic-bezier(0.25, 0.1, 0.25, 1), `
          + `width ${transDur} ease-out, height ${transDur} ease-out, `
          + `filter ${transDur} ease, box-shadow ${transDur} ease`,
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Bottom glow (step 0) ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 110,
        background: 'linear-gradient(180deg, transparent, rgba(255,160,30,.3))',
        opacity: step === 0 ? 1 : 0,
        transition: `opacity ${TRANS_DUR.normal}ms ease`,
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Content area ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        flex: 1, display: 'flex', flexDirection: 'column',
        overflowY: step >= 2 ? 'auto' : 'hidden',
        WebkitOverflowScrolling: 'touch',
      }}>

        {/* 01 — 여명 */}
        <div style={{
          ...contentStyle(0),
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          flex: step === 0 ? 1 : undefined,
          height: step !== 0 ? '100%' : undefined,
        }}>
          <div style={{ textAlign: 'center', paddingBottom: 90, opacity: 0 }}>
            <div style={{
              fontFamily: "'Dancing Script', cursive",
              fontSize: 48, fontWeight: 500,
              letterSpacing: '.08em',
              color: 'rgba(255,248,220,.95)',
            }}>lua</div>
            <div style={{
              fontSize: 9, letterSpacing: '.25em', textTransform: 'uppercase',
              color: 'rgba(255,220,140,.45)', marginTop: 10,
            }}>Know your body</div>
          </div>
        </div>

        {/* 02 — 해뜨기 */}
        <div style={contentStyle(1)}>
          <div style={{ padding: '42px 48px 125px' }}>
            <div style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase',
              color: 'rgba(180,90,10,.5)', marginBottom: 28,
            }}>Welcome to LUA</div>
            <div style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 26, fontWeight: 500, lineHeight: 1.35,
              color: 'rgba(120,50,5,.9)', marginBottom: 20,
            }}>
              내 몸에서 일어나는 일을<br/>
              <strong style={{ fontWeight: 600, color: '#8A3800' }}>처음으로 이해</strong>하게 돼요
            </div>
            <div style={{
              fontSize: 15, lineHeight: 1.75, fontWeight: 400,
              color: 'rgba(140,70,10,.45)',
            }}>
              식단, 수면, 움직임이<br/>
              에너지와 피부와 기분으로 연결되고 있어요.
            </div>
          </div>
        </div>

        {/* 03 — 일출 */}
        <div style={contentStyle(2)}>
          <div style={{ padding: '30px 40px 0' }}>
            <div style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase',
              color: 'rgba(160,100,0,.5)', textAlign: 'center', marginBottom: 10,
            }}>Right now</div>
            <div style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 22, fontWeight: 500, textAlign: 'center',
              color: 'rgba(100,50,0,.85)', marginBottom: 32,
            }}>지금 어떤 상태예요?</div>

            <div style={{
              background: 'rgba(255,255,255,.2)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,.3)',
              borderRadius: 20, padding: '20px 22px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
            }}>
              {[
                { label: '에너지', value: energy, set: setEnergy, labels: ENERGY_LABELS },
                { label: '기분', value: mood, set: setMood, labels: MOOD_LABELS },
                { label: '수분', value: hydra, set: setHydra, labels: HYDRA_LABELS },
              ].map(({ label, value, set, labels }, idx) => (
                <div key={label} style={{ marginBottom: idx < 2 ? 24 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                    <span style={{ fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 500, color: 'rgba(150,90,0,.55)' }}>{label}</span>
                    <span style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 600, color: '#8A5000' }}>{labels[value]}</span>
                  </div>
                  <input
                    type="range" min={0} max={4} step={1}
                    value={value}
                    onChange={e => set(Number(e.target.value))}
                    className="lua-onb-slider"
                  />
                </div>
              ))}
            </div>

            <button onClick={goToS4} style={{
              width: '100%', padding: 14, borderRadius: 99,
              background: 'rgba(180,100,0,.08)',
              border: '1px solid rgba(180,100,0,.15)',
              color: 'rgba(120,60,0,.65)',
              fontFamily: FONT_DISPLAY,
              fontSize: 15, fontWeight: 500, cursor: 'pointer',
              marginTop: 16,
            }}>LUA가 분석할게요 →</button>
          </div>
        </div>

        {/* 04 — 완전히 뜬 해 (staggered fade-in) */}
        <div style={contentStyle(3)}>
          <div style={{ padding: '148px 40px 40px' }}>
            <div style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 13, fontWeight: 600, letterSpacing: '.2em', textTransform: 'uppercase',
              color: 'rgba(26,58,74,.45)', textAlign: 'center', marginBottom: 20,
              ...(s4Phase === 'contentIn' ? { animation: 'luaFadeSlideIn 0.4s ease-out both' } : {}),
              ...(s4Phase === 'done' || s4Phase === 'idle' ? { opacity: 1 } : {}),
            }}>LUA가 발견한 것</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              {INSIGHTS.map((item, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,.2)',
                  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,.3)',
                  borderRadius: 20, padding: '18px 20px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
                  ...(s4Phase === 'contentIn' ? {
                    animation: 'luaFadeSlideIn 0.4s ease-out both',
                    animationDelay: `${0.15 + i * 0.15}s`,
                  } : {}),
                  ...(s4Phase === 'done' || s4Phase === 'idle' ? { opacity: 1 } : {}),
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{
                      fontFamily: FONT_DISPLAY,
                      padding: '5px 12px', borderRadius: 99, fontSize: 13, fontWeight: 600,
                      background: 'rgba(255,210,80,.15)', color: '#8A6000',
                    }}>{item.cause}</span>
                    <span style={{ fontSize: 14, color: '#AACCD8' }}>→</span>
                    <span style={{
                      fontFamily: FONT_DISPLAY,
                      padding: '5px 12px', borderRadius: 99, fontSize: 13, fontWeight: 600,
                      background: 'rgba(100,180,220,.14)', color: '#2A6A8A',
                    }}>{item.result}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#6A9AAA', lineHeight: 1.65 }}>{item.desc}</div>
                </div>
              ))}
            </div>

            <button onClick={handleFinish} style={{
              width: '100%', padding: 16, borderRadius: 99,
              background: 'rgba(255,255,255,.2)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,.3)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
              color: '#1A3A4A',
              fontFamily: FONT_DISPLAY,
              fontSize: 16, fontWeight: 600, cursor: 'pointer',
              ...(s4Phase === 'contentIn' ? {
                animation: 'luaFadeSlideIn 0.4s ease-out both',
                animationDelay: '0.6s',
              } : {}),
              ...(s4Phase === 'done' || s4Phase === 'idle' ? { opacity: 1 } : {}),
            }}>LUA 시작하기</button>
          </div>
        </div>
      </div>

      {/* ── Dot indicators ── */}
      {!locked && <div style={{
        position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
        left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6, zIndex: 2,
      }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} onClick={() => { if (i <= 2) goTo(i); }} style={{
            width: step === i ? 20 : 8,
            height: 8,
            borderRadius: step === i ? 99 : '50%',
            background: step === i ? (step === 3 ? 'rgba(26,58,74,.3)' : '#FFD060') : 'rgba(255,200,80,.2)',
            transition: 'all 0.3s ease',
            cursor: i <= 2 ? 'pointer' : 'default',
          }} />
        ))}
      </div>}
    </div>
  );
}
