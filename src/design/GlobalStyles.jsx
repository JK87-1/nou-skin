import { COLORS, ANIMATION } from './tokens';

export default function GlobalStyles() {
  return (
    <style>{`
      ${ANIMATION.keyframes}
      .aura-ring-1 { animation: ${ANIMATION.auraPulse.ring1}; }
      .aura-ring-2 { animation: ${ANIMATION.auraPulse.ring2}; }
      .aura-ring-3 { animation: ${ANIMATION.auraPulse.ring3}; }
      * { box-sizing: border-box; }
      body { margin: 0; background: ${COLORS.bg.primary}; }
      ::-webkit-scrollbar { width: 0; }
      .app-container::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 600px;
        background: radial-gradient(ellipse at 50% 20%, rgba(167,139,250,0.06) 0%, rgba(129,140,248,0.03) 40%, transparent 70%);
        pointer-events: none;
        z-index: 0;
      }
    `}</style>
  );
}
