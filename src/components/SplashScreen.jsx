import SoftCloverIcon from './icons/SoftCloverIcon';

const splashKeyframes = `
  /* ── Entrance ── */
  @keyframes splashPearlIn {
    from { opacity: 0; transform: scale(0.85); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes splashTextIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes splashFade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* ── Exit ── */
  /* Text: quick fade-up */
  @keyframes splashTextExit {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(-16px); }
  }
  /* Overlay: smooth dissolve — pearl fades with the overlay naturally */
  @keyframes splashDissolve {
    0% { opacity: 1; }
    100% { opacity: 0; }
  }
`;

export default function SplashScreen({ exiting, onAnimationEnd, cloverTheme }) {
  // Only fire callback when the overlay dissolve completes (not child animations)
  const handleAnimEnd = (e) => {
    if (exiting && e.animationName === 'splashDissolve') {
      onAnimationEnd();
    }
  };

  return (
    <div
      onAnimationEnd={handleAnimEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'var(--bg-primary)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        animation: exiting
          ? 'splashDissolve 0.7s cubic-bezier(0.4, 0, 0.6, 1) 0.15s forwards'
          : undefined,
      }}
    >
      <style>{splashKeyframes}</style>

      <div style={{
        animation: exiting ? undefined : 'splashPearlIn 0.8s ease-out both',
      }}>
        <SoftCloverIcon theme={cloverTheme || 'morningLight'} size={120} animate={!exiting} />
      </div>

      <div style={{
        marginTop: 24,
        fontSize: 32, fontWeight: 700, letterSpacing: 8, paddingLeft: 8,
        color: 'var(--text-primary)',
        fontFamily: "'Outfit', sans-serif",
        animation: exiting
          ? 'splashTextExit 0.2s ease-in forwards'
          : 'splashTextIn 0.6s ease-out 0.4s both',
      }}>루아</div>

      <div style={{
        marginTop: 8,
        fontSize: 10, letterSpacing: 2,
        color: 'var(--text-dim)',
        animation: exiting
          ? 'splashTextExit 0.15s ease-in forwards'
          : 'splashFade 0.5s ease-out 0.8s both',
      }}>YOUR INNER GLOW</div>
    </div>
  );
}
