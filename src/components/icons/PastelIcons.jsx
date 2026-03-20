/**
 * 파스텔톤 단색 SVG 아이콘 모음
 * 원래 이모지 컬러를 파스텔로 변환
 */

const s = 18; // default size

// 💧 물방울 — 파스텔 블루
export const DropletIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="drop-g" x1="30%" y1="0%" x2="70%" y2="100%"><stop offset="0%" stopColor="#B8E4F8"/><stop offset="100%" stopColor="#8DC8E8"/></linearGradient></defs>
    <path d="M12 2C12 2 5 10 5 15a7 7 0 0014 0c0-5-7-13-7-13z" fill="url(#drop-g)"/>
    <ellipse cx="9.5" cy="14" rx="2" ry="1.5" fill="white" opacity="0.35"/>
  </svg>
);

// ✨ 반짝이 — 파스텔 옐로우
export const SparkleIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <defs><linearGradient id="spk-g" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stopColor="#FFF3B0"/><stop offset="100%" stopColor="#FFE082"/></linearGradient><linearGradient id="spk-g2" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stopColor="#FFF9D0"/><stop offset="100%" stopColor="#FFF3B0"/></linearGradient></defs>
    {/* 큰 별 — 끝이 둥근 하나의 경로 */}
    <path d="M18 2 C19.5 7, 20 11, 22 13 C26 14, 30 14.5, 33 15.5 C30 16.5, 26 17, 22 18 C20 20, 19.5 24, 18 29 C16.5 24, 16 20, 14 18 C10 17, 6 16.5, 3 15.5 C6 14.5, 10 14, 14 13 C16 11, 16.5 7, 18 2Z" fill="url(#spk-g)"/>
    {/* 작은 별 우상단 */}
    <path d="M28 3 C28.5 5, 29 6.5, 32.5 7.5 C29 8.5, 28.5 10, 28 12 C27.5 10, 27 8.5, 23.5 7.5 C27 6.5, 27.5 5, 28 3Z" fill="url(#spk-g2)"/>
    {/* 작은 별 좌하단 */}
    <path d="M8 24 C8.3 26, 8.5 27, 12 28 C8.5 29, 8.3 30, 8 32 C7.7 30, 7.5 29, 4 28 C7.5 27, 7.7 26, 8 24Z" fill="url(#spk-g2)"/>
    <ellipse cx="15" cy="12" rx="3" ry="2" fill="white" opacity="0.3"/>
  </svg>
);

// 🧴 피부결 — (( 가로로 눕힌 형태, 파스텔 코랄
export const LotionIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="lot-g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#F8C8B8"/><stop offset="100%" stopColor="#E8A898"/></linearGradient></defs>
    <path d="M6 14 C9 11, 15 11, 18 14" stroke="url(#lot-g1)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    <path d="M6 20 C9 17, 15 17, 18 20" stroke="url(#lot-g1)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    <path d="M6 14 C9 11, 15 11, 18 14" stroke="white" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.3"/>
    <path d="M6 20 C9 17, 15 17, 18 20" stroke="white" strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.2"/>
  </svg>
);

// 💎 탄력 — 파스텔 망고 )|( 가로 눕힘
export const DiamondIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="dia-g" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stopColor="#FFE0A0"/><stop offset="100%" stopColor="#FFD080"/></linearGradient></defs>
    {/* 위 호 — ( 눕힌 형태 */}
    <path d="M5 6 C10 10, 14 10, 19 6" stroke="url(#dia-g)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    {/* 가운데 직선 — | 눕힌 형태 */}
    <line x1="5" y1="12" x2="19" y2="12" stroke="url(#dia-g)" strokeWidth="2.5" strokeLinecap="round"/>
    {/* 아래 호 — ) 눕힌 형태 */}
    <path d="M5 18 C10 14, 14 14, 19 18" stroke="url(#dia-g)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    {/* 하이라이트 */}
    <line x1="5" y1="12" x2="19" y2="12" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.3"/>
  </svg>
);

// 🎨 색소 — 작은 둥근 6각형 + 입체감, 다크브라운
export const PaletteIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="pal-g" x1="30%" y1="10%" x2="70%" y2="90%"><stop offset="0%" stopColor="#DCCAB8"/><stop offset="100%" stopColor="#C0A890"/></linearGradient></defs>
    <path d="M12 5 L17.5 8 Q18 8.3, 18 9 L18 15 Q18 15.7, 17.5 16 L12 19 Q12 19, 12 19 L6.5 16 Q6 15.7, 6 15 L6 9 Q6 8.3, 6.5 8 Z" fill="url(#pal-g)"/>
    <path d="M12 5 L17.5 8 Q18 8.3, 18 9 L18 12 L6 12 L6 9 Q6 8.3, 6.5 8 Z" fill="white" opacity="0.12"/>
  </svg>
);

// 🔬 모공 — 살구색 점 4개 + 입체감
export const MicroscopeIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><radialGradient id="mic-rg" cx="38%" cy="35%" r="55%"><stop offset="0%" stopColor="#FFD8C0"/><stop offset="100%" stopColor="#F0B898"/></radialGradient></defs>
    <circle cx="8" cy="8" r="2.8" fill="url(#mic-rg)"/>
    <circle cx="16" cy="8" r="2.8" fill="url(#mic-rg)"/>
    <circle cx="8" cy="16" r="2.8" fill="url(#mic-rg)"/>
    <circle cx="16" cy="16" r="2.8" fill="url(#mic-rg)"/>
    <ellipse cx="7" cy="7" rx="1" ry="0.7" fill="white" opacity="0.3"/>
    <ellipse cx="15" cy="7" rx="1" ry="0.7" fill="white" opacity="0.3"/>
    <ellipse cx="7" cy="15" rx="1" ry="0.7" fill="white" opacity="0.3"/>
    <ellipse cx="15" cy="15" rx="1" ry="0.7" fill="white" opacity="0.3"/>
  </svg>
);

// 📐 주름 — 파스텔 로즈 물결 두 줄 + 입체감
export const RulerIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="rul-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#F0C8D0"/><stop offset="100%" stopColor="#E0A8B8"/></linearGradient></defs>
    <path d="M6 9 C9 4, 15 14, 18 9" stroke="url(#rul-g)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    <path d="M6 15 C9 10, 15 20, 18 15" stroke="url(#rul-g)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    <path d="M6 9 C9 4, 15 14, 18 9" stroke="white" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.35"/>
    <path d="M6 15 C9 10, 15 20, 18 15" stroke="white" strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.2"/>
  </svg>
);

// 👁️ 다크서클 — 아래로 누운 반원 + 양끝 둥글게 + 입체감
export const EyeIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="eye-g" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stopColor="#D0D8F0"/><stop offset="100%" stopColor="#B0B8D8"/></linearGradient></defs>
    <path d="M4 11 C6 10, 9 9, 12 9 C15 9, 18 10, 20 11 C18 16, 15 19, 12 19 C9 19, 6 16, 4 11Z" fill="url(#eye-g)"/>
    <ellipse cx="9.5" cy="13" rx="3" ry="1.5" fill="white" opacity="0.25"/>
  </svg>
);

// 🫧 유분 — 물방울 형태, 채도 낮은 파스텔 옐로우
export const BubbleIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="bub-g" x1="30%" y1="0%" x2="70%" y2="100%"><stop offset="0%" stopColor="#FFF5D0"/><stop offset="100%" stopColor="#F0E0A8"/></linearGradient></defs>
    <path d="M12 2C12 2 5 10 5 15a7 7 0 0014 0c0-5-7-13-7-13z" fill="url(#bub-g)"/>
    <ellipse cx="9.5" cy="14" rx="2" ry="1.5" fill="white" opacity="0.35"/>
  </svg>
);

// 🎯 타겟 — 파스텔 레드
export const TargetIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="tgt-g" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stopColor="#FFD0D0"/><stop offset="100%" stopColor="#FFB0B0"/></linearGradient></defs>
    <circle cx="12" cy="12" r="10" fill="url(#tgt-g)"/>
    <circle cx="12" cy="12" r="6.5" fill="white" opacity="0.5"/>
    <circle cx="12" cy="12" r="3.5" fill="url(#tgt-g)"/>
    <circle cx="12" cy="12" r="1" fill="white" opacity="0.6"/>
  </svg>
);

// ☀️ 해 — 파스텔 옐로우
export const SunIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <defs><radialGradient id="sun-rg2" cx="40%" cy="38%" r="55%"><stop offset="0%" stopColor="#FFF9D0"/><stop offset="50%" stopColor="#FFF3B0"/><stop offset="100%" stopColor="#FFE082"/></radialGradient></defs>
    {[0,45,90,135,180,225,270,315].map(a => {
      const r1=10.5,r2=15.5,rad=a*Math.PI/180;
      return <line key={a} x1={18+Math.cos(rad)*r1} y1={18+Math.sin(rad)*r1} x2={18+Math.cos(rad)*r2} y2={18+Math.sin(rad)*r2} stroke="#FFE082" strokeWidth="2" strokeLinecap="round"/>;
    })}
    <circle cx="18" cy="18" r="9" fill="url(#sun-rg2)"/>
    <ellipse cx="15.5" cy="15.5" rx="3.5" ry="2.5" fill="white" opacity="0.35"/>
  </svg>
);

// 🌙 달 — 파스텔 라벤더
export const MoonIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="moon-g" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stopColor="#E8E0F8"/><stop offset="100%" stopColor="#D0C0E8"/></linearGradient></defs>
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="url(#moon-g)"/>
    <ellipse cx="13" cy="8" rx="2" ry="1.5" fill="white" opacity="0.3"/>
  </svg>
);

// 📷 카메라 — 파스텔 그레이
export const CameraIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="cam-g" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stopColor="#D8D8E0"/><stop offset="100%" stopColor="#B8B8C8"/></linearGradient></defs>
    <rect x="2" y="7" width="20" height="14" rx="3" fill="url(#cam-g)"/>
    <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" fill="url(#cam-g)" stroke="#B8B8C8" strokeWidth="0.5"/>
    <circle cx="12" cy="14" r="4" fill="white" opacity="0.3"/>
    <circle cx="12" cy="14" r="2.5" fill="url(#cam-g)"/>
    <ellipse cx="11" cy="12.5" rx="1" ry="0.7" fill="white" opacity="0.35"/>
  </svg>
);

// 🧪 시험관 — 파스텔 그린
export const TestTubeIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="tt-g" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stopColor="#D0F0D8"/><stop offset="100%" stopColor="#A8E0B8"/></linearGradient></defs>
    <path d="M9 3h6v2H9V3z" fill="url(#tt-g)"/>
    <path d="M10 5v10l-3 5a2 2 0 002 2h6a2 2 0 002-2l-3-5V5" fill="url(#tt-g)"/>
    <rect x="10" y="14" width="4" height="4" fill="white" opacity="0.25"/>
    <ellipse cx="11" cy="7" rx="1" ry="2" fill="white" opacity="0.25"/>
  </svg>
);

// 🌟 별 — 파스텔 골드
export const StarIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="star-g" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stopColor="#FFF3B0"/><stop offset="100%" stopColor="#FFE082"/></linearGradient></defs>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="url(#star-g)"/>
    <ellipse cx="10" cy="8" rx="2" ry="1.2" fill="white" opacity="0.3"/>
  </svg>
);

// 🏆 트로피 — 파스텔 골드
export const TrophyIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="tro-g" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stopColor="#FFF3B0"/><stop offset="100%" stopColor="#FFD080"/></linearGradient></defs>
    <path d="M6 4h12v2c0 4-2 7-6 8-4-1-6-4-6-8V4z" fill="url(#tro-g)"/>
    <path d="M6 5H4a2 2 0 000 4h2M18 5h2a2 2 0 010 4h-2" stroke="#FFD080" strokeWidth="1.5" strokeLinecap="round"/>
    <rect x="10" y="14" width="4" height="3" fill="url(#tro-g)"/>
    <rect x="8" y="17" width="8" height="2" rx="1" fill="url(#tro-g)"/>
    <ellipse cx="10.5" cy="7" rx="1.5" ry="1" fill="white" opacity="0.3"/>
  </svg>
);

// 👑 왕관 — 파스텔 골드
export const CrownIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="crn-g" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stopColor="#FFF3B0"/><stop offset="100%" stopColor="#FFD080"/></linearGradient></defs>
    <path d="M2 18l3-12 5 5 2-7 2 7 5-5 3 12H2z" fill="url(#crn-g)"/>
    <ellipse cx="9" cy="13" rx="1.5" ry="1" fill="white" opacity="0.25"/>
  </svg>
);

// 🛡️ 방패 — 파스텔 그린
export const ShieldIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="shd-g" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stopColor="#C8F0D0"/><stop offset="100%" stopColor="#A0E0B0"/></linearGradient></defs>
    <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" fill="url(#shd-g)"/>
    <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
  </svg>
);

// 🌡 온도계 — 파스텔 레드
export const ThermometerIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="thm-g" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0%" stopColor="#FFD0D0"/><stop offset="100%" stopColor="#FFB0B0"/></linearGradient></defs>
    <rect x="10" y="2" width="4" height="14" rx="2" fill="url(#thm-g)"/>
    <circle cx="12" cy="18" r="4" fill="url(#thm-g)"/>
    <circle cx="12" cy="18" r="2" fill="#FF9090"/>
    <rect x="11.5" y="8" width="1" height="8" fill="#FF9090"/>
    <ellipse cx="11" cy="4" rx="0.8" ry="1.5" fill="white" opacity="0.3"/>
  </svg>
);

// 📈 차트 — 파스텔 그린
export const ChartIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="cht-g" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#C8F0D0"/><stop offset="100%" stopColor="#90E0A8"/></linearGradient></defs>
    <path d="M3 20l5-8 4 4 5-10 4 6" stroke="url(#cht-g)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 20l5-8 4 4 5-10 4 6v8H3z" fill="url(#cht-g)" opacity="0.15"/>
  </svg>
);

// 📝 메모 — 파스텔 옐로우
export const MemoIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="mem-g" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stopColor="#FFF9D0"/><stop offset="100%" stopColor="#FFE8A0"/></linearGradient></defs>
    <rect x="4" y="2" width="16" height="20" rx="2" fill="url(#mem-g)"/>
    <line x1="8" y1="7" x2="16" y2="7" stroke="#D8C880" strokeWidth="1" strokeLinecap="round"/>
    <line x1="8" y1="11" x2="16" y2="11" stroke="#D8C880" strokeWidth="1" strokeLinecap="round"/>
    <line x1="8" y1="15" x2="13" y2="15" stroke="#D8C880" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

// ⚙️ 기어 — 파스텔 그레이
export const GearIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="gear-g" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stopColor="#D8D8E0"/><stop offset="100%" stopColor="#B8B8C8"/></linearGradient></defs>
    <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" fill="url(#gear-g)"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" fill="url(#gear-g)"/>
  </svg>
);

// 🔒 자물쇠 — 파스텔 그레이
export const LockIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="lock-g" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stopColor="#D8D8E0"/><stop offset="100%" stopColor="#B8B8C8"/></linearGradient></defs>
    <rect x="5" y="11" width="14" height="11" rx="2" fill="url(#lock-g)"/>
    <path d="M8 11V7a4 4 0 018 0v4" stroke="#B8B8C8" strokeWidth="2" fill="none"/>
    <circle cx="12" cy="16" r="1.5" fill="white" opacity="0.4"/>
  </svg>
);

// 🪄 마법봉 — 파스텔 퍼플
export const WandIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="wand-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#E0D0F0"/><stop offset="100%" stopColor="#C8B0E0"/></linearGradient></defs>
    <line x1="4" y1="20" x2="15" y2="9" stroke="url(#wand-g)" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M15 2l1.5 3L20 6.5 16.5 8 15 11l-1.5-3L10 6.5 13.5 5 15 2z" fill="#E0D0F0"/>
  </svg>
);

// 🖼️ 사진 — 파스텔 그린
export const PhotoIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="pho-g" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stopColor="#D0F0D8"/><stop offset="100%" stopColor="#B0E0C0"/></linearGradient></defs>
    <rect x="2" y="4" width="20" height="16" rx="2" fill="url(#pho-g)"/>
    <circle cx="8" cy="10" r="2.5" fill="white" opacity="0.4"/>
    <path d="M22 16l-5-5-4 4-3-3-8 8h20z" fill="white" opacity="0.25"/>
  </svg>
);

// 📚 책 — 파스텔 브라운
export const BooksIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="book-g" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stopColor="#F0DCC8"/><stop offset="100%" stopColor="#D8C0A8"/></linearGradient></defs>
    <rect x="4" y="3" width="5" height="18" rx="1" fill="url(#book-g)"/>
    <rect x="10" y="3" width="5" height="18" rx="1" fill="#E8D0B8"/>
    <rect x="16" y="5" width="4" height="16" rx="1" fill="url(#book-g)" transform="rotate(5 18 13)"/>
  </svg>
);

// ✅ 체크 — 파스텔 그린
export const CheckIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="chk-g" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stopColor="#C8F0D0"/><stop offset="100%" stopColor="#90E0A8"/></linearGradient></defs>
    <circle cx="12" cy="12" r="10" fill="url(#chk-g)"/>
    <path d="M8 12l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 💾 저장 — 파스텔 블루
export const SaveIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="sav-g" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stopColor="#C8D8F0"/><stop offset="100%" stopColor="#A0B8D8"/></linearGradient></defs>
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" fill="url(#sav-g)"/>
    <rect x="7" y="14" width="10" height="6" rx="1" fill="white" opacity="0.3"/>
    <rect x="8" y="2" width="8" height="6" fill="white" opacity="0.2"/>
  </svg>
);

// 🕐 시계 — 하늘색 원톤
export const ClockIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#B8E4F0" />
    <line x1="12" y1="12" x2="12" y2="6.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="12" y1="12" x2="16" y2="12" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="12" r="1.2" fill="white" />
    <ellipse cx="9.5" cy="8.5" rx="2.5" ry="1.8" fill="white" opacity="0.25" />
  </svg>
);

// 🧴 보틀 로션 — 파스텔 핑크
export const BottleIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <defs>
      <linearGradient id="bot-g1" x1="30%" y1="0%" x2="70%" y2="100%"><stop offset="0%" stopColor="#FFF0F3"/><stop offset="100%" stopColor="#FFD0DA"/></linearGradient>
      <linearGradient id="bot-g2" x1="30%" y1="0%" x2="70%" y2="100%"><stop offset="0%" stopColor="#FFE0E8"/><stop offset="100%" stopColor="#FFC0CC"/></linearGradient>
    </defs>
    <rect x="13" y="3" width="10" height="4" rx="1.5" fill="url(#bot-g2)"/>
    <rect x="16.5" y="1" width="3" height="3" rx="1" fill="url(#bot-g2)"/>
    <rect x="14" y="0.5" width="8" height="1.5" rx="0.75" fill="url(#bot-g2)"/>
    <rect x="11" y="7" width="14" height="20" rx="4" fill="url(#bot-g1)"/>
    <rect x="13" y="13" width="10" height="8" rx="2" fill="white" opacity="0.3"/>
    <rect x="12.5" y="9" width="3" height="12" rx="1.5" fill="white" opacity="0.2"/>
  </svg>
);

// 🔥 불꽃 — 파스텔 오렌지
export const FlameIcon = ({ size = s }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="flm-g" x1="30%" y1="0%" x2="70%" y2="100%"><stop offset="0%" stopColor="#FFE0A0"/><stop offset="50%" stopColor="#FFB880"/><stop offset="100%" stopColor="#F0A070"/></linearGradient></defs>
    <path d="M12 2 C12 2, 8 8, 8 12 C8 14, 9 16, 10 17 C9 15, 10 12, 12 10 C14 12, 15 15, 14 17 C15 16, 16 14, 16 12 C16 8, 12 2, 12 2Z" fill="url(#flm-g)"/>
    <ellipse cx="11" cy="9" rx="1.5" ry="2" fill="white" opacity="0.25"/>
  </svg>
);

// Emoji → Pastel Icon 매핑
export function PastelIcon({ emoji, size = 18 }) {
  const map = {
    '💧': DropletIcon,
    '✨': SparkleIcon,
    '🧴': BottleIcon,
    '💎': DiamondIcon,
    '🎨': PaletteIcon,
    '🔬': MicroscopeIcon,
    '📐': RulerIcon,
    '👁️': EyeIcon,
    '🫧': BubbleIcon,
    '🎯': TargetIcon,
    '☀️': SunIcon,
    '🌙': MoonIcon,
    '📷': CameraIcon,
    '🧪': TestTubeIcon,
    '🌟': StarIcon,
    '🏆': TrophyIcon,
    '👑': CrownIcon,
    '🛡️': ShieldIcon,
    '🛡': ShieldIcon,
    '📝': MemoIcon,
    '⚙️': GearIcon,
    '🔒': LockIcon,
    '✅': CheckIcon,
    '📚': BooksIcon,
    '💾': SaveIcon,
    '📈': ChartIcon,
    '📊': ChartIcon,
    '⭐': StarIcon,
    '💫': StarIcon,
    '🌠': StarIcon,
    '🔥': FlameIcon,
    '🚀': ChartIcon,
    '🌡': ThermometerIcon,
    '🖼️': PhotoIcon,
    '🪄': WandIcon,
    '⏳': ClockIcon,
    '🎂': ClockIcon,
  };
  const Comp = map[emoji];
  if (Comp) return <Comp size={size} />;
  return <span style={{ fontSize: size }}>{emoji}</span>;
}
