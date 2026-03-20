// LUA Design System — Design Tokens
// All colors, gradients, shadows, sizes managed in one place.

const COLORS = {
  // 배경
  bg: {
    primary: '#000000',
    secondary: '#08080c',
    card: 'rgba(255,255,255,0.03)',
    cardHover: 'rgba(255,255,255,0.05)',
    cardBorder: 'rgba(255,255,255,0.06)',
    elevated: 'rgba(255,255,255,0.04)',
  },

  // 진주 컬러 팔레트 (Pearl Palette)
  pearl: {
    lightest: '#FFF0D4',
    light: '#FFCFAA',
    mid: '#FFAA85',
    deep: '#FBEC5D',
    darker: '#E87080',
    darkest: '#D05878',
  },

  // 이리데선트 악센트 (진주 표면에서 비치는 색)
  iridescent: {
    indigo: '#ADEBB3',
    purple: '#FBEC5D',
    pink: '#E06888',
    teal: '#F0C878',
    gold: '#F0B870',
  },

  // 오라 발광
  glow: {
    primary: '#FBEC5D',
    secondary: '#FFD4B8',
    subtle: '#FFF5E8',
    pink: '#E06888',
    teal: '#F0C878',
  },

  // 텍스트
  text: {
    primary: '#f0f0f5',
    secondary: '#e0e0e8',
    muted: '#8888a0',
    dim: '#555568',
    accent: '#FBEC5D',
  },

  // 시맨틱
  semantic: {
    success: '#34d399',
    warning: '#F0B870',
    danger: '#ef4444',
    info: '#38bdf8',
  },
};

const GRADIENTS = {
  // 진주 표면 (radial gradient 값들)
  pearlSurface: {
    stops: [
      { offset: '0%', color: COLORS.pearl.lightest },
      { offset: '20%', color: COLORS.pearl.light },
      { offset: '45%', color: COLORS.pearl.mid },
      { offset: '70%', color: COLORS.pearl.darker },
      { offset: '100%', color: COLORS.pearl.darkest },
    ],
    cx: '38%',
    cy: '34%',
    r: '58%',
  },

  // 버튼/활성 상태
  pearlButton: 'linear-gradient(135deg, #FBEC5D, #E87080, #D05878)',
  pearlButtonHover: 'linear-gradient(135deg, #FFAA85, #FBEC5D, #E87080)',

  // 카드 배경 오라
  cardGlow: 'radial-gradient(ellipse at 50% 0%, rgba(240,144,112,0.06) 0%, transparent 70%)',

  // 탭바
  tabBarBg: 'linear-gradient(180deg, rgba(10,10,15,0) 0%, rgba(10,10,15,0.95) 20%)',

  // 활성 상태 이리데선트
  activeGlow: 'linear-gradient(135deg, rgba(240,144,112,0.15), rgba(255,207,170,0.08))',
  activeBorder: '1px solid rgba(240,144,112,0.2)',

  // 배경 오라 (페이지 배경에 깔리는 은은한 빛)
  bgAura: 'radial-gradient(ellipse at 50% 20%, rgba(240,144,112,0.06) 0%, rgba(255,207,170,0.03) 40%, transparent 70%)',
};

const SHADOWS = {
  pearl: '0 4px 20px rgba(208,88,120,0.2)',
  pearlStrong: '0 8px 32px rgba(208,88,120,0.3)',
  glow: '0 0 20px rgba(240,144,112,0.15)',
  glowStrong: '0 0 40px rgba(240,144,112,0.25)',
  card: '0 2px 12px rgba(0,0,0,0.2)',
};

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

export { COLORS, GRADIENTS, SHADOWS, ANIMATION };
