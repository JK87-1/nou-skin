import AuraPearl from './icons/AuraPearl';

const splashKeyframes = `
  @keyframes splashPearlIn {
    from { opacity: 0; transform: scale(0.8); }
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
  @keyframes splashExit {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;

export default function SplashScreen({ exiting, onAnimationEnd }) {
  return (
    <div
      onAnimationEnd={exiting ? onAnimationEnd : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#0a0a0f',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        animation: exiting ? 'splashExit 0.4s ease-out forwards' : undefined,
      }}
    >
      <style>{splashKeyframes}</style>
      <div style={{ animation: 'splashPearlIn 0.8s ease-out both' }}>
        <AuraPearl variant="eternal" size={120} animated />
      </div>
      <div style={{
        marginTop: 24,
        fontSize: 32, fontWeight: 700, letterSpacing: 8, paddingLeft: 8,
        color: '#f0f0f5', fontFamily: "'Outfit', sans-serif",
        animation: 'splashTextIn 0.6s ease-out 0.4s both',
      }}>LUA</div>
      <div style={{
        marginTop: 8,
        fontSize: 10, letterSpacing: 2, color: '#555568',
        animation: 'splashFade 0.5s ease-out 0.8s both',
      }}>YOUR INNER GLOW</div>
    </div>
  );
}
