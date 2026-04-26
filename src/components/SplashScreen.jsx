import { isOnboardingDone } from '../pages/OnboardingPage';

const STARS = [
  { top: '8%',  left: '20%', size: 1.5, opacity: 0.7 },
  { top: '12%', left: '45%', size: 1.0, opacity: 0.5 },
  { top: '6%',  left: '70%', size: 2.0, opacity: 0.8 },
  { top: '18%', left: '85%', size: 1.0, opacity: 0.4 },
  { top: '22%', left: '30%', size: 1.5, opacity: 0.6 },
  { top: '10%', left: '58%', size: 1.0, opacity: 0.5 },
  { top: '28%', left: '12%', size: 1.0, opacity: 0.3 },
  { top: '15%', left: '92%', size: 2.0, opacity: 0.6 },
  { top: '5%',  left: '38%', size: 1.0, opacity: 0.4 },
  { top: '32%', left: '75%', size: 1.5, opacity: 0.3 },
];

/* Total first-run duration: 1.8s (0.9s hold + 0.9s transition) */
const DUR = 1.8;
const HOLD = 50; // 50% = 0.9s hold

const keyframes = `
  @keyframes splashDissolve {
    from { opacity: 1; } to { opacity: 0; }
  }
  @keyframes splashPearlIn {
    from { opacity: 0; transform: scale(0.85); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes splashFade {
    from { opacity: 0; } to { opacity: 1; }
  }
  @keyframes splashTextExit {
    from { opacity: 1; transform: translateY(0); }
    to   { opacity: 0; transform: translateY(-12px); }
  }
  @keyframes starTwinkle {
    0%, 100% { opacity: var(--star-o); }
    50%      { opacity: calc(var(--star-o) * 0.4); }
  }

  /* Single logo: fade in gently during splash, stays visible into 01 */
  @keyframes splashLogoFadeIn {
    0%   { opacity: 0; }
    50%  { opacity: 0.85; }
    100% { opacity: 0.85; }
  }
  @keyframes splashTagFadeIn {
    0%   { opacity: 0; }
    30%  { opacity: 0; }
    60%  { opacity: 0.6; }
    100% { opacity: 0.6; }
  }

  /* Stars & moon: hold then fade out */
  @keyframes starsLife {
    0%   { opacity: 1; }
    ${HOLD}%  { opacity: 1; }
    85%  { opacity: 0; }
    100% { opacity: 0; }
  }

  /* Gold BG: 0 until hold, then fade in */
  @keyframes goldBgIn {
    0%   { opacity: 0; }
    ${HOLD}%  { opacity: 0; }
    100% { opacity: 1; }
  }

  /* Horizon glow */
  @keyframes horizonGlowIn {
    0%   { opacity: 0; }
    ${HOLD}%  { opacity: 0; }
    100% { opacity: 1; }
  }

  /* Sun: hidden at -260 during hold, rises to -155 during transition */
  @keyframes sunRiseFromNight {
    0%   { bottom: -260px; opacity: 0; width: 260px; height: 260px; filter: blur(12px); }
    ${HOLD}%  { bottom: -260px; opacity: 0; width: 260px; height: 260px; filter: blur(12px); }
    ${HOLD + 10}%  { opacity: 0.3; filter: blur(6px); }
    ${HOLD + 25}%  { opacity: 0.7; filter: blur(4px); }
    100% { bottom: -155px; opacity: 1; width: 260px; height: 260px; filter: blur(2px); }
  }

  @keyframes splashInstantOff {
    from { opacity: 1; } to { opacity: 0; }
  }
`;

export default function SplashScreen({ exiting, onAnimationEnd }) {
  const isFirst = !isOnboardingDone();

  const handleAnimEnd = (e) => {
    if (exiting && (e.animationName === 'splashDissolve' || e.animationName === 'splashInstantOff')) {
      onAnimationEnd();
    }
  };

  /* ── First-run: Night → Dawn (no sun, 0.9s hold + 0.9s transition) ── */
  if (isFirst) {
    return (
      <div
        onAnimationEnd={handleAnimEnd}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          animation: exiting ? 'splashInstantOff 0.15s ease forwards' : undefined,
        }}
      >
        <style>{keyframes}</style>

        {/* Night background (base) */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, #02020A 0%, #05051A 30%, #080820 60%, #0D0A15 100%)',
          zIndex: -2,
        }} />

        {/* Gold/amber background (overlay) */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, #C8681A 0%, #D97820 25%, #E88828 50%, #C85A10 75%, #8A3208 100%)',
          animation: `goldBgIn ${DUR}s ease-in-out forwards`,
          zIndex: -1,
        }} />

        {/* Stars */}
        <div style={{
          position: 'absolute', inset: 0,
          animation: `starsLife ${DUR}s ease forwards`,
          pointerEvents: 'none',
        }}>
          {STARS.map((s, i) => (
            <div key={i} style={{
              position: 'absolute',
              top: s.top, left: s.left,
              width: s.size, height: s.size,
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              '--star-o': s.opacity,
              opacity: s.opacity,
              animation: `starTwinkle ${2 + i * 0.3}s ease-in-out infinite`,
            }} />
          ))}
        </div>

        {/* Moon glow */}
        <div style={{
          position: 'absolute', top: '18%', left: '62%',
          width: 50, height: 50, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(220,235,255,.25) 0%, transparent 70%)',
          animation: `starsLife ${DUR}s ease forwards`,
          pointerEvents: 'none',
        }} />

        {/* Sun orb (rises from fully hidden to 01 position) */}
        <div style={{
          position: 'absolute',
          left: '50%', transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 40%, #FFFFFF 0%, #FFE840 12%, #FFA820 35%, rgba(255,140,20,.25) 60%, transparent 75%)',
          animation: `sunRiseFromNight ${DUR}s cubic-bezier(0.4, 0, 0.2, 1) forwards`,
          pointerEvents: 'none', zIndex: 0,
        }} />

        {/* Horizon glow (appears during transition) */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 110,
          background: 'linear-gradient(180deg, transparent, rgba(255,160,30,.3))',
          animation: `horizonGlowIn ${DUR}s ease forwards`,
          pointerEvents: 'none',
        }} />

        {/* Logo — fades in gently, carries over to onboarding 01 */}
        <div style={{
          position: 'absolute',
          textAlign: 'center', paddingBottom: 90,
          pointerEvents: 'none',
        }}>
          <div style={{
            fontFamily: "'Dancing Script', cursive",
            fontSize: 48, fontWeight: 500,
            letterSpacing: '.08em',
            color: 'rgba(255,248,220,.95)',
            animation: `splashLogoFadeIn ${DUR}s ease both`,
          }}>lua</div>
          <div style={{
            fontSize: 9, letterSpacing: '.25em', textTransform: 'uppercase',
            color: 'rgba(255,220,140,.45)', marginTop: 10,
            animation: `splashTagFadeIn ${DUR}s ease both`,
          }}>Know your body</div>
        </div>
      </div>
    );
  }

  /* ── Returning user: Sky splash ── */
  const handleReturnAnimEnd = (e) => {
    if (exiting && e.animationName === 'splashDissolve') {
      onAnimationEnd();
    }
  };

  return (
    <div
      onAnimationEnd={handleReturnAnimEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#ffffff',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        animation: exiting
          ? 'splashDissolve 0.7s cubic-bezier(0.4, 0, 0.6, 1) 0.15s forwards'
          : undefined,
      }}
    >
      <style>{keyframes}</style>

      <div style={{
        animation: exiting ? undefined : 'splashPearlIn 0.8s ease-out both',
      }}>
        <img src="/luasky.svg" alt="lua" style={{ width: 180, height: 'auto', objectFit: 'contain' }} />
      </div>

      <div style={{
        marginTop: 16,
        fontSize: 10, letterSpacing: 2,
        color: 'var(--text-dim)',
        animation: exiting
          ? 'splashTextExit 0.15s ease-in forwards'
          : 'splashFade 0.5s ease-out 0.6s both',
      }}>Feel yourself, every day</div>
    </div>
  );
}
