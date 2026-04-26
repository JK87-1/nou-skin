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
  @keyframes splashLogoIn {
    from { opacity: 0; transform: scale(0.85); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes splashTagIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes splashDissolve {
    from { opacity: 1; }
    to   { opacity: 0; }
  }
  @keyframes splashTextExit {
    from { opacity: 1; transform: translateY(0); }
    to   { opacity: 0; transform: translateY(-12px); }
  }
  @keyframes starTwinkle {
    0%, 100% { opacity: var(--star-o); }
    50% { opacity: calc(var(--star-o) * 0.4); }
  }
  @keyframes splashPearlIn {
    from { opacity: 0; transform: scale(0.85); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes splashFade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

export default function SplashScreen({ exiting, onAnimationEnd }) {
  const isFirst = !isOnboardingDone();

  const handleAnimEnd = (e) => {
    if (exiting && e.animationName === 'splashDissolve') {
      onAnimationEnd();
    }
  };

  /* ── First-run: Night splash ── */
  if (isFirst) {
    return (
      <div
        onAnimationEnd={handleAnimEnd}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'linear-gradient(180deg, #02020A 0%, #05051A 30%, #080820 60%, #0D0A15 100%)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          animation: exiting
            ? 'splashDissolve 0.5s cubic-bezier(0.4, 0, 0.6, 1) 0.1s forwards'
            : undefined,
        }}
      >
        <style>{keyframes}</style>

        {/* Stars */}
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

        {/* Moon glow */}
        <div style={{
          position: 'absolute', top: '18%', left: '62%',
          width: 50, height: 50, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(220,235,255,.25) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Sun orb (hidden below) */}
        <div style={{
          position: 'absolute', bottom: -200,
          left: '50%', transform: 'translateX(-50%)',
          width: 220, height: 220, borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 40%, rgba(255,220,100,.4) 0%, rgba(255,160,40,.15) 40%, transparent 70%)',
          filter: 'blur(8px)',
          pointerEvents: 'none',
        }} />

        {/* Horizon preheat */}
        <div style={{
          position: 'absolute', bottom: '38%', left: 0, right: 0,
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(180,120,40,.08), transparent)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '32%', left: 0, right: 0,
          height: 30,
          background: 'linear-gradient(180deg, transparent, rgba(140,80,20,.06))',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ paddingBottom: 60, textAlign: 'center' }}>
          <div style={{
            fontSize: 42, fontWeight: 200, fontStyle: 'italic',
            letterSpacing: '.22em',
            color: 'rgba(255,248,230,.9)',
            textShadow: '0 0 30px rgba(255,200,80,.2), 0 0 80px rgba(255,180,60,.08)',
            animation: 'splashLogoIn 0.8s ease-out 0.2s both',
          }}>lua</div>
          <div style={{
            fontSize: 8, letterSpacing: '.25em', textTransform: 'uppercase',
            color: 'rgba(200,220,255,.25)', marginTop: 10,
            animation: exiting
              ? 'splashTextExit 0.15s ease-in forwards'
              : 'splashTagIn 0.5s ease-out 0.7s both',
          }}>Know your body</div>
        </div>
      </div>
    );
  }

  /* ── Returning user: Sky splash (existing style) ── */
  return (
    <div
      onAnimationEnd={handleAnimEnd}
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
