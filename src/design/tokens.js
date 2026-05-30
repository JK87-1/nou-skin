// LUA Design System — Animation Tokens
// 색·그라디언트·섀도우 토큰은 src/styles.css의 CSS 변수로 일원화됨.
// (구 펄 팔레트 COLORS/GRADIENTS/SHADOWS는 미사용으로 제거 — 2026-05)

const ANIMATION = {
  auraPulse: {
    ring1: 'auraPulse1 4s ease-in-out infinite',
    ring2: 'auraPulse2 5s ease-in-out infinite 0.5s',
    ring3: 'auraPulse3 6s ease-in-out infinite 1s',
  },
  keyframes: `
    @keyframes auraPulse1 {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.03); }
    }
    @keyframes auraPulse2 {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.75; transform: scale(1.05); }
    }
    @keyframes auraPulse3 {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.07); }
    }
    @keyframes pearlShimmer {
      0%, 100% { opacity: 0.85; }
      50% { opacity: 1; }
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `,
};

export { ANIMATION };
