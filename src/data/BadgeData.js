/**
 * 뱃지 & 레벨 시스템 데이터
 * 8개 카테고리 57개 뱃지, 36개 레벨 칭호, 19개 테마
 */

const BADGE_DATABASE = {
  streak: {
    label: '꾸준함', icon: '🔥', color: '#F0B870',
    badges: [
      { id: 'streak_3', icon: '🔥', name: '3일 연속', desc: '3일 연속 측정 완료', condition: { type: 'streak', value: 3 } },
      { id: 'streak_7', icon: '🔥', name: '7일 연속', desc: '7일 연속 측정 완료', condition: { type: 'streak', value: 7 } },
      { id: 'streak_14', icon: '🔥', name: '14일 연속', desc: '14일 연속 측정 완료', condition: { type: 'streak', value: 14 } },
      { id: 'streak_30', icon: '🔥', name: '30일 연속', desc: '30일 연속 측정 완료', condition: { type: 'streak', value: 30 } },
      { id: 'streak_50', icon: '🔥', name: '50일 연속', desc: '50일 연속 측정! 대단한 끈기', condition: { type: 'streak', value: 50 } },
      { id: 'streak_100', icon: '💎', name: '100일 연속', desc: '100일 연속 측정! 전설의 시작', condition: { type: 'streak', value: 100 } },
      { id: 'streak_200', icon: '👑', name: '200일 연속', desc: '200일 연속! 불멸의 기록', condition: { type: 'streak', value: 200 } },
    ],
  },
  score: {
    label: '점수 달성', icon: '⭐', color: '#FBEC5D',
    badges: [
      { id: 'score_50', icon: '⭐', name: '50점 돌파', desc: '종합 점수 50점 이상 달성', condition: { type: 'score', value: 50 } },
      { id: 'score_60', icon: '⭐', name: '60점 돌파', desc: '종합 점수 60점 이상 달성', condition: { type: 'score', value: 60 } },
      { id: 'score_70', icon: '⭐', name: '70점 돌파', desc: '종합 점수 70점 이상 달성', condition: { type: 'score', value: 70 } },
      { id: 'score_80', icon: '🌟', name: '80점 돌파', desc: '종합 점수 80점 이상 달성', condition: { type: 'score', value: 80 } },
      { id: 'score_90', icon: '💫', name: '90점 돌파', desc: '종합 점수 90점 이상 달성', condition: { type: 'score', value: 90 } },
      { id: 'score_95', icon: '🌠', name: '95점 돌파', desc: '종합 점수 95점 이상! 거의 완벽', condition: { type: 'score', value: 95 } },
    ],
  },
  improvement: {
    label: '피부 개선', icon: '📈', color: '#34d399',
    badges: [
      { id: 'improve_5', icon: '📈', name: '첫 번째 변화', desc: '종합 점수 5점 이상 상승', condition: { type: 'improvement', value: 5 } },
      { id: 'improve_10', icon: '📈', name: '10점 상승', desc: '종합 점수 10점 이상 상승', condition: { type: 'improvement', value: 10 } },
      { id: 'improve_20', icon: '🚀', name: '대변신', desc: '종합 점수 20점 이상 상승', condition: { type: 'improvement', value: 20 } },
      { id: 'improve_30', icon: '🚀', name: '30점 대도약', desc: '종합 점수 30점 이상 상승', condition: { type: 'improvement', value: 30 } },
      { id: 'skinAge_3', icon: '⏳', name: '시간 역행', desc: '피부나이 3세 이상 감소', condition: { type: 'skinAge', value: 3 } },
      { id: 'skinAge_5', icon: '⏳', name: '회춘의 비밀', desc: '피부나이 5세 이상 감소', condition: { type: 'skinAge', value: 5 } },
      { id: 'skinAge_10', icon: '⏳', name: '10세 회춘', desc: '피부나이 10세 이상 감소! 경이로운 변화', condition: { type: 'skinAge', value: 10 } },
    ],
  },
  mission: {
    label: '미션 달인', icon: '🎯', color: '#f472b6',
    badges: [
      { id: 'mission_10', icon: '🎯', name: '미션 10회', desc: '미션 10회 완료', condition: { type: 'missionCount', value: 10 } },
      { id: 'mission_30', icon: '🎯', name: '미션 30회', desc: '미션 30회 완료', condition: { type: 'missionCount', value: 30 } },
      { id: 'mission_50', icon: '🎯', name: '미션 50회', desc: '미션 50회 완료', condition: { type: 'missionCount', value: 50 } },
      { id: 'mission_100', icon: '🎯', name: '미션 100회', desc: '미션 100회 완료! 미션의 왕', condition: { type: 'missionCount', value: 100 } },
      { id: 'allclear_5', icon: '🏆', name: '올클리어 ×5', desc: '하루 미션 전체 완료 5회', condition: { type: 'allClear', value: 5 } },
      { id: 'allclear_20', icon: '🏆', name: '올클리어 ×20', desc: '하루 미션 전체 완료 20회', condition: { type: 'allClear', value: 20 } },
      { id: 'allclear_50', icon: '🏆', name: '올클리어 ×50', desc: '하루 미션 전체 완료 50회! 완벽주의자', condition: { type: 'allClear', value: 50 } },
    ],
  },
  special: {
    label: '특별 뱃지', icon: '💎', color: '#38bdf8',
    badges: [
      { id: 'first_analysis', icon: '🪞', name: '첫 측정', desc: '첫 번째 피부 분석 완료', condition: { type: 'measureCount', value: 1 } },
      { id: 'moisture_master', icon: '💧', name: '수분 마스터', desc: '수분 점수 80점 이상 달성', condition: { type: 'itemScore', item: 'moisture', value: 80 } },
      { id: 'consult_10', icon: '💬', name: '상담 매니아', desc: 'AI 상담 10회 이용', condition: { type: 'consultCount', value: 10 } },
      { id: 'consult_30', icon: '💬', name: '상담 고수', desc: 'AI 상담 30회 이용', condition: { type: 'consultCount', value: 30 } },
      { id: 'night_owl', icon: '🌙', name: '나이트 케어', desc: '밤 10시 이후 측정 5회', condition: { type: 'nightMeasure', value: 5 } },
      { id: 'share_first', icon: '📤', name: '소문내기', desc: '첫 번째 결과 공유', condition: { type: 'shareCount', value: 1 } },
      { id: 'share_5', icon: '📤', name: '공유 달인', desc: '결과 공유 5회', condition: { type: 'shareCount', value: 5 } },
      { id: 'share_20', icon: '📤', name: '인플루언서', desc: '결과 공유 20회', condition: { type: 'shareCount', value: 20 } },
    ],
  },
  measurement: {
    label: '측정 마일스톤', icon: '🪞', color: '#60a5fa',
    badges: [
      { id: 'measure_5', icon: '🪞', name: '5회 측정', desc: '피부 측정 5회 완료', condition: { type: 'measureCount', value: 5 } },
      { id: 'measure_10', icon: '🪞', name: '10회 측정', desc: '피부 측정 10회 완료', condition: { type: 'measureCount', value: 10 } },
      { id: 'measure_30', icon: '🪞', name: '30회 측정', desc: '피부 측정 30회 완료', condition: { type: 'measureCount', value: 30 } },
      { id: 'measure_50', icon: '📊', name: '50회 측정', desc: '피부 측정 50회! 데이터 수집가', condition: { type: 'measureCount', value: 50 } },
      { id: 'measure_100', icon: '📊', name: '100회 측정', desc: '피부 측정 100회! 스킨 연구원', condition: { type: 'measureCount', value: 100 } },
      { id: 'morning_10', icon: '🌅', name: '모닝 케어러', desc: '오전 5~9시 측정 10회', condition: { type: 'morningMeasure', value: 10 } },
    ],
  },
  mastery: {
    label: '지표 마스터', icon: '🏅', color: '#f59e0b',
    badges: [
      { id: 'master_skinTone', icon: '✨', name: '피부톤 마스터', desc: '피부톤 80점 이상 달성', condition: { type: 'itemScore', item: 'skinTone', value: 80 } },
      { id: 'master_wrinkle', icon: '📐', name: '주름 마스터', desc: '주름 점수 80점 이상 달성', condition: { type: 'itemScore', item: 'wrinkleScore', value: 80 } },
      { id: 'master_pore', icon: '🔬', name: '모공 마스터', desc: '모공 점수 80점 이상 달성', condition: { type: 'itemScore', item: 'poreScore', value: 80 } },
      { id: 'master_elasticity', icon: '💎', name: '탄력 마스터', desc: '탄력 점수 80점 이상 달성', condition: { type: 'itemScore', item: 'elasticityScore', value: 80 } },
      { id: 'master_pigment', icon: '🎨', name: '색소 마스터', desc: '색소 점수 80점 이상 달성', condition: { type: 'itemScore', item: 'pigmentationScore', value: 80 } },
      { id: 'master_texture', icon: '🧴', name: '피부결 마스터', desc: '피부결 80점 이상 달성', condition: { type: 'itemScore', item: 'textureScore', value: 80 } },
      { id: 'master_darkCircle', icon: '👁️', name: '다크서클 마스터', desc: '다크서클 80점 이상 달성', condition: { type: 'itemScore', item: 'darkCircleScore', value: 80 } },
      { id: 'master_all', icon: '🌈', name: '올 마스터', desc: '모든 지표 70점 이상 달성', condition: { type: 'allMetricsAbove', value: 70 } },
    ],
  },
  milestone: {
    label: '레벨 달성', icon: '🎖️', color: '#e879f9',
    badges: [
      { id: 'level_5', icon: '🎖️', name: 'Lv.5 달성', desc: '레벨 5 도달', condition: { type: 'levelReach', value: 5 } },
      { id: 'level_10', icon: '🎖️', name: 'Lv.10 달성', desc: '레벨 10 도달', condition: { type: 'levelReach', value: 10 } },
      { id: 'level_20', icon: '🏅', name: 'Lv.20 달성', desc: '레벨 20 도달', condition: { type: 'levelReach', value: 20 } },
      { id: 'level_30', icon: '👑', name: 'Lv.30 달성', desc: '레벨 30 도달', condition: { type: 'levelReach', value: 30 } },
      { id: 'level_40', icon: '🎖️', name: 'Lv.40 달성', desc: '레벨 40 도달', condition: { type: 'levelReach', value: 40 } },
      { id: 'level_50', icon: '👑', name: 'Lv.50 달성', desc: '레벨 50 도달! 궁극의 경지', condition: { type: 'levelReach', value: 50 } },
      { id: 'xp_1000', icon: '💰', name: 'XP 1,000', desc: '누적 XP 1,000 돌파', condition: { type: 'totalXP', value: 1000 } },
      { id: 'xp_5000', icon: '💰', name: 'XP 5,000', desc: '누적 XP 5,000 돌파', condition: { type: 'totalXP', value: 5000 } },
    ],
  },
};

// ===== 36개 칭호 (레벨 1~30 매 레벨 + 32/35/38/40/45/50) =====
const LEVEL_TITLES = [
  { level: 1,  title: '피부 초보',         icon: '🌱', minXP: 0 },
  { level: 2,  title: '세안 입문자',       icon: '🧼', minXP: 200 },
  { level: 3,  title: '보습 탐구자',       icon: '💦', minXP: 400 },
  { level: 4,  title: '스킨케어 견습생',   icon: '📖', minXP: 600 },
  { level: 5,  title: '스킨케어 입문자',   icon: '🧴', minXP: 800 },
  { level: 6,  title: '성분 해독가',       icon: '🧪', minXP: 1000 },
  { level: 7,  title: '루틴 수호자',       icon: '🛡️', minXP: 1200 },
  { level: 8,  title: '컨디션 리더',       icon: '📊', minXP: 1400 },
  { level: 9,  title: '피부 탐험가',       icon: '🔍', minXP: 1600 },
  { level: 10, title: '스킨케어 루키',     icon: '⭐', minXP: 1800 },
  { level: 11, title: '글로우 시커',       icon: '🔆', minXP: 2000 },
  { level: 12, title: '글로우 워리어',     icon: '⚔️', minXP: 2200 },
  { level: 13, title: '피부 전략가',       icon: '📋', minXP: 2400 },
  { level: 14, title: '뷰티 연구원',       icon: '🔬', minXP: 2600 },
  { level: 15, title: '뷰티 마스터',       icon: '🎓', minXP: 2800 },
  { level: 16, title: '루틴 디자이너',     icon: '✏️', minXP: 3000 },
  { level: 17, title: '스킨 아티스트',     icon: '🎨', minXP: 3200 },
  { level: 18, title: '글로우 크래프터',   icon: '🌟', minXP: 3400 },
  { level: 19, title: '피부 연금술사',     icon: '⚗️', minXP: 3600 },
  { level: 20, title: '스킨 전문가',       icon: '🏅', minXP: 3800 },
  { level: 21, title: '래디언스 멘토',     icon: '✨', minXP: 4000 },
  { level: 22, title: '스킨 오라클',       icon: '🔮', minXP: 4200 },
  { level: 23, title: '뷰티 현자',         icon: '🧙', minXP: 4400 },
  { level: 24, title: '글로우 스칼라',     icon: '📜', minXP: 4600 },
  { level: 25, title: '피부 과학자',       icon: '🔭', minXP: 4800 },
  { level: 26, title: '루미너스 세이지',   icon: '💫', minXP: 5000 },
  { level: 27, title: '펄 마에스트로',     icon: '💠', minXP: 5200 },
  { level: 28, title: '스킨 그랜드마스터', icon: '💎', minXP: 5400 },
  { level: 29, title: '이터널 가디언',     icon: '🛡️', minXP: 5600 },
  { level: 30, title: '글로우 레전드',     icon: '👑', minXP: 5800 },
  { level: 32, title: '문라이트 어센던트', icon: '🌕', minXP: 6200 },
  { level: 35, title: '셀레스티얼 가이드', icon: '🌠', minXP: 6800 },
  { level: 38, title: '코스믹 하모니스트', icon: '🪐', minXP: 7400 },
  { level: 40, title: '인피니트 래디언스', icon: '∞',  minXP: 7800 },
  { level: 45, title: '에테르 아키텍트',   icon: '✦',  minXP: 8800 },
  { level: 50, title: '유니버설 글로우',   icon: '☀️', minXP: 9800 },
];

// ===== 19개 테마 (레벨 구간별 · 심미적 순서) =====
const THEMES = [
  // ── 기본 (Lv 1~8) ─────────────────────────────────────────
  { id: 'warmSand',  name: 'Moonlight Silver',  kr: '웜 샌드',    range: [1, 3],   accent: '#D0A080', sub: '#fdd8b0', pearl: ['#F0D0B0', '#D0A080', '#906040'], cloverTheme: 'warmSand',  desc: '은빛 달빛의 고요함' },
  { id: 'obsidianGray',     name: 'Obsidian Gray',     kr: '오브시디언 그레이', range: [4, 5],   accent: '#ADEBB3', sub: '#A0A0BC', pearl: ['#D4D4E4', '#808080', '#383838'], cloverTheme: 'obsidianGray',     desc: '흑요석의 깊은 광택' },
  { id: 'navySapphire',     name: 'Navy Sapphire',     kr: '네이비 사파이어',   range: [6, 8],   accent: '#6898E8', sub: '#fde0c0', pearl: ['#FFD8C0', '#6898E8', '#2858C8'], cloverTheme: 'navySapphire',     desc: '사파이어의 심해 빛' },
  // ── 내추럴 (Lv 9~17) ──────────────────────────────────────
  { id: 'aquaMint',          name: 'Aqua Mint',         kr: '아쿠아 민트',      range: [9, 11],  accent: '#20A898', sub: '#6ee7b7', pearl: ['#B8ECE4', '#70D8C8', '#20A898'], cloverTheme: 'aquaMint',         desc: '상쾌한 민트 바다' },
  { id: 'deepOcean',         name: 'Deep Ocean',        kr: '딥 오션',          range: [12, 14], accent: '#5098D0', sub: '#7dd3fc', pearl: ['#C0DCF4', '#5098D0', '#1058A8'], cloverTheme: 'deepOcean',        desc: '심해의 푸른 신비' },
  { id: 'coralBlush',        name: 'Coral Blush',       kr: '코랄 블러쉬',      range: [15, 17], accent: '#E87050', sub: '#fed7aa', pearl: ['#F8D0C0', '#E87050', '#C03828'], cloverTheme: 'coralBlush',       desc: '산호빛 따스한 온기' },
  // ── 비비드 (Lv 18~26) ─────────────────────────────────────
  { id: 'sunsetAmber',       name: 'Sunset Amber',      kr: '선셋 앰버',        range: [18, 20], accent: '#E89018', sub: '#fde68a', pearl: ['#F8E8A0', '#E89018', '#A85C00'], cloverTheme: 'sunsetAmber',      desc: '석양의 황금빛 잔영' },
  { id: 'sunrisePeach',      name: 'Sunrise Peach',     kr: '선라이즈 피치',    range: [21, 23], accent: '#F8C080', sub: '#fdba74', pearl: ['#FEEBD0', '#F8C080', '#E88038'], cloverTheme: 'sunrisePeach',     desc: '여명의 복숭아빛 온기' },
  { id: 'sunsetPeach',     name: 'Lavender Bloom',    kr: '선셋 피치',      range: [24, 26], accent: '#E88050', sub: '#fde0c0', pearl: ['#FFD8C0', '#FFBF90', '#E88050'], cloverTheme: 'sunsetPeach',    desc: '라벤더 꽃밭의 향기' },
  // ── 프리미엄 (Lv 27~35) ───────────────────────────────────
  { id: 'verteDeH',          name: 'Vert de H',         kr: '베르도',           range: [27, 29], accent: '#6A9A6A', sub: '#6EE7B7', pearl: ['#D8EEDC', '#6A9A6A', '#3A6A44'], cloverTheme: 'verteDeH',         desc: '에르메스 그린의 품격' },
  { id: 'smokyMauve',        name: 'Smoky Mauve',       kr: '스모키 모브',      range: [30, 32], accent: '#906090', sub: '#e879f9', pearl: ['#E8D0E8', '#C098C0', '#906090'], cloverTheme: 'smokyMauve',       desc: '자줏빛 안개의 신비' },
  { id: 'deepEmerald',       name: 'Deep Emerald',      kr: '딥 에메랄드',      range: [33, 35], accent: '#1A8850', sub: '#34d399', pearl: ['#C8F0DC', '#50C888', '#1A8850'], cloverTheme: 'deepEmerald',      desc: '에메랄드 원석의 깊이' },
  // ── 럭셔리 (Lv 36~43) ────────────────────────────────────
  { id: 'cherryBlossom',     name: 'Cherry Blossom',    kr: '체리 블라썸',      range: [36, 38], accent: '#D85898', sub: '#f9a8d4', pearl: ['#FBE0EE', '#F4A8C8', '#D85898'], cloverTheme: 'cherryBlossom',    desc: '벚꽃이 흩날리는 봄' },
  { id: 'roseGold',          name: 'Rose Gold',         kr: '로즈 골드',        range: [39, 40], accent: '#c48878', sub: '#fbcfe8', pearl: ['#f8ece0', '#dca894', '#c48878'], cloverTheme: 'roseGold',         desc: '로즈골드의 우아한 빛' },
  { id: 'onyxBlack',         name: 'Onyx Black',        kr: '오닉스 블랙',      range: [41, 43], accent: '#FBEC5D', sub: '#ADEBB3', pearl: ['#C8C8DC', '#5A5A5A', '#141414'], cloverTheme: 'onyxBlack',        desc: '칠흑 속 보랏빛 광채' },
  // ── 전설 (Lv 44~50) ──────────────────────────────────────
  { id: 'lunaWhite',         name: 'Luna White',        kr: '루나 화이트',      range: [44, 45], accent: '#9898C0', sub: '#FFF5E8', pearl: ['#FAFAFA', '#E4E4E4', '#CCCCCC'], cloverTheme: 'lunaWhite',        desc: '달의 순백한 빛' },
  { id: 'pureIvory',         name: 'Pure Ivory',        kr: '퓨어 아이보리',    range: [46, 47], accent: '#D8D0A8', sub: '#fef9c3', pearl: ['#FBF8EC', '#EDE8C4', '#D8D0A8'], cloverTheme: 'pureIvory',        desc: '순수한 상아빛 광택' },
  { id: 'cashmereBeige',     name: 'Cashmere Beige',    kr: '캐시미어 베이지',  range: [48, 49], accent: '#B09878', sub: '#fde68a', pearl: ['#EAE0CC', '#D0BC9C', '#B09878'], cloverTheme: 'cashmereBeige',    desc: '캐시미어의 부드러운 결' },
  { id: 'champagneGold',     name: 'Champagne Gold',    kr: '샴페인 골드',      range: [50, 50], accent: '#D8B060', sub: '#fef3c7', pearl: ['#FBF3D4', '#F0D898', '#D8B060'], cloverTheme: 'champagneGold',    desc: '최상의 샴페인 골드' },
];

/**
 * XP -> 레벨 계산 (200 XP당 1레벨)
 */
export function calculateLevel(totalXP) {
  return Math.floor(totalXP / 200) + 1;
}

/**
 * 레벨에 해당하는 칭호 반환 (문자열)
 */
export function getLevelTitle(level) {
  let title = LEVEL_TITLES[0].title;
  for (const lt of LEVEL_TITLES) {
    if (level >= lt.level) title = lt.title;
    else break;
  }
  return title;
}

/**
 * 레벨에 해당하는 칭호 데이터 반환 (아이콘 포함)
 */
export function getLevelTitleData(level) {
  let data = LEVEL_TITLES[0];
  for (const lt of LEVEL_TITLES) {
    if (level >= lt.level) data = lt;
    else break;
  }
  return data;
}

/**
 * 레벨에 맞는 테마 반환
 */
export function getThemeForLevel(level) {
  for (let i = THEMES.length - 1; i >= 0; i--) {
    if (level >= THEMES[i].range[0]) return THEMES[i];
  }
  return THEMES[0];
}

export { BADGE_DATABASE, LEVEL_TITLES, THEMES };
