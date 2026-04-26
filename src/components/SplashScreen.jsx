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

const keyframes = `
  /* ── Common ── */
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

  /* ── First-run: Night → Dawn ── */
  @keyframes starTwinkle {
    0%, 100% { opacity: var(--star-o); }
    50%      { opacity: calc(var(--star-o) * 0.4); }
  }
  /* Logo: fade in 0.2-1.0s, fade out 1.5-2.0s */
  @keyframes splashNightLogoLife {
    0%   { opacity: 0; transform: scale(0.85); }
    32%  { opacity: 1; transform: scale(1); }       /* 0.8s — fully visible */
    60%  { opacity: 1; }                              /* 1.5s — still visible */
    80%  { opacity: 0; }                              /* 2.0s — faded out */
    100% { opacity: 0; }
  }
  @keyframes splashNightTagLife {
    0%   { opacity: 0; transform: translateY(8px); }
    28%  { opacity: 0; transform: translateY(8px); }  /* 0.7s delay */
    40%  { opacity: 1; transform: translateY(0); }     /* 1.0s — visible */
    60%  { opacity: 1; }                               /* 1.5s */
    80%  { opacity: 0; }                               /* 2.0s */
    100% { opacity: 0; }
  }
  /* Stars: visible until 1.5s, fade out by 2.3s */
  @keyframes starsLife {
    0%   { opacity: 1; }
    60%  { opacity: 1; }   /* 1.5s */
    92%  { opacity: 0; }   /* 2.3s */
    100% { opacity: 0; }
  }
  /* Moon: same timing as stars */
  @keyframes moonLife {
    0%   { opacity: 1; }
    60%  { opacity: 1; }
    92%  { opacity: 0; }
    100% { opacity: 0; }
  }
  /* Gold BG overlay: 0 until 1.5s, fade in to 1 by 2.5s */
  @keyframes goldBgIn {
    0%   { opacity: 0; }
    60%  { opacity: 0; }   /* 1.5s */
    100% { opacity: 1; }   /* 2.5s */
  }
  /* Sun: bottom -200 → -130 starting at 1.5s (01 = half visible at bottom) */
  @keyframes sunRiseFirst {
    0%   { bottom: -200px; filter: blur(8px); width: 220px; height: 220px; }
    60%  { bottom: -200px; filter: blur(8px); width: 220px; height: 220px; }  /* 1.5s */
    100% { bottom: -130px; filter: blur(2px); width: 260px; height: 260px; }  /* 2.5s */
  }
  /* Horizon glow: subtle → strong */
  @keyframes horizonGlowIn {
    0%   { opacity: 0; }
    60%  { opacity: 0; }
    100% { opacity: 1; }
  }
  /* Onboarding 01 logo: appears at 2.0s */
  @keyframes ob01LogoIn {
    0%   { opacity: 0; }
    80%  { opacity: 0; }   /* 2.0s */
    100% { opacity: 1; }   /* 2.5s */
  }
  @keyframes ob01TagIn {
    0%   { opacity: 0; }
    84%  { opacity: 0; }   /* 2.1s */
    100% { opacity: 1; }   /* 2.5s */
  }
  /* Final instant dissolve to reveal actual onboarding */
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

  /* ── First-run: Night → Dawn seamless transition ── */
  if (isFirst) {
    const dur = 2.5; // total animation duration in seconds
    return (
      <div
        onAnimationEnd={handleAnimEnd}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          // When exiting: instant dissolve (splash now looks identical to onboarding 01)
          animation: exiting
            ? 'splashInstantOff 0.15s ease forwards'
            : undefined,
        }}
      >
        <style>{keyframes}</style>

        {/* Night background (base) */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, #02020A 0%, #05051A 30%, #080820 60%, #0D0A15 100%)',
          zIndex: -2,
        }} />

        {/* Gold/amber background (overlay — fades in) */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, #C8681A 0%, #D97820 25%, #E88828 50%, #C85A10 75%, #8A3208 100%)',
          animation: `goldBgIn ${dur}s ease-in-out forwards`,
          zIndex: -1,
        }} />

        {/* Stars (fade out) */}
        <div style={{
          position: 'absolute', inset: 0,
          animation: `starsLife ${dur}s ease forwards`,
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

        {/* Moon glow (fades out with stars) */}
        <div style={{
          position: 'absolute', top: '18%', left: '62%',
          width: 50, height: 50, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(220,235,255,.25) 0%, transparent 70%)',
          animation: `moonLife ${dur}s ease forwards`,
          pointerEvents: 'none',
        }} />

        {/* Sun orb (rises from -200 to -165) */}
        <div style={{
          position: 'absolute',
          left: '50%', transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 40%, #FFFFFF 0%, #FFE840 12%, #FFA820 35%, rgba(255,140,20,.25) 60%, transparent 75%)',
          animation: `sunRiseFirst ${dur}s cubic-bezier(0.4, 0, 0.2, 1) forwards`,
          pointerEvents: 'none', zIndex: 0,
        }} />

        {/* Horizon glow (strengthens) */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 110,
          background: 'linear-gradient(180deg, transparent, rgba(255,160,30,.3))',
          animation: `horizonGlowIn ${dur}s ease forwards`,
          pointerEvents: 'none',
        }} />

        {/* Splash logo (night — appears then fades) */}
        <div style={{
          position: 'absolute',
          textAlign: 'center', paddingBottom: 60,
          pointerEvents: 'none',
        }}>
          <div style={{
            fontSize: 42, fontWeight: 200, fontStyle: 'italic',
            letterSpacing: '.22em',
            color: 'rgba(255,248,230,.9)',
            textShadow: '0 0 30px rgba(255,200,80,.2), 0 0 80px rgba(255,180,60,.08)',
            animation: `splashNightLogoLife ${dur}s ease both`,
          }}>lua</div>
          <div style={{
            fontSize: 8, letterSpacing: '.25em', textTransform: 'uppercase',
            color: 'rgba(200,220,255,.25)', marginTop: 10,
            animation: `splashNightTagLife ${dur}s ease both`,
          }}>Know your body</div>
        </div>

        {/* Onboarding 01 logo (dawn — fades in at the end) */}
        <div style={{
          position: 'absolute',
          textAlign: 'center', paddingBottom: 90,
          pointerEvents: 'none',
        }}>
          <div style={{
            fontSize: 48, fontWeight: 200, fontStyle: 'italic',
            letterSpacing: '.2em',
            color: 'rgba(255,248,220,.95)',
            textShadow: '0 0 40px rgba(255,220,80,.5)',
            animation: `ob01LogoIn ${dur}s ease both`,
          }}>lua</div>
          <div style={{
            fontSize: 9, letterSpacing: '.25em', textTransform: 'uppercase',
            color: 'rgba(255,220,140,.45)', marginTop: 10,
            animation: `ob01TagIn ${dur}s ease both`,
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
