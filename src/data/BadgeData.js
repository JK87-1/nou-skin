/**
 * 뱃지 & 레벨 시스템 데이터
 * 5개 카테고리 30개 뱃지, 10개 레벨 칭호, 4개 테마
 */

const BADGE_DATABASE = {
  streak: {
    label: '계절의 약속', subtitle: '연속 피부 측정', icon: '🌿', color: '#A8D8B4',
    badges: [
      { id: 'streak_3', icon: '🌱', name: '새싹의 속삭임', desc: '피부 측정 3일 연속 달성 · 작은 씨앗이 흙을 밀어올렸어요', condition: { type: 'streak', value: 3 } },
      { id: 'streak_7', icon: '🍀', name: '일곱 잎 클로버', desc: '피부 측정 7일 연속 달성 · 행운의 잎이 하나씩 피어났어요', condition: { type: 'streak', value: 7 } },
      { id: 'streak_14', icon: '🦋', name: '나비의 첫 날갯짓', desc: '피부 측정 14일 연속 달성 · 고치 속에서 드디어 날개를 펼쳤어요', condition: { type: 'streak', value: 14 } },
      { id: 'streak_30', icon: '🌙', name: '한 달의 서약', desc: '피부 측정 30일 연속 달성 · 달이 한 바퀴 도는 동안 약속을 지켰어요', condition: { type: 'streak', value: 30 } },
      { id: 'streak_100', icon: '❄️', name: '백일의 겨울정원', desc: '피부 측정 100일 연속 달성 · 눈 위에 핀 꽃, 백 번의 아침', condition: { type: 'streak', value: 100 } },
      { id: 'streak_200', icon: '🏔️', name: '산 너머의 약속', desc: '피부 측정 200일 연속 달성 · 끝이 보이지 않아도 걸어온 길이 빛나요', condition: { type: 'streak', value: 200 } },
    ],
  },
  score: {
    label: '빛의 여정', subtitle: '피부 종합점수 달성', icon: '🕯️', color: '#F0D8A8',
    badges: [
      { id: 'score_50', icon: '🕯️', name: '첫 번째 촛불', desc: '피부 종합점수 50점 이상 달성 · 어둠 속에 작은 빛이 켜졌어요', condition: { type: 'score', value: 50 } },
      { id: 'score_60', icon: '🌅', name: '새벽빛', desc: '피부 종합점수 60점 이상 달성 · 수평선 너머로 빛이 번져가요', condition: { type: 'score', value: 60 } },
      { id: 'score_70', icon: '🌤️', name: '구름 위의 햇살', desc: '피부 종합점수 70점 이상 달성 · 구름을 뚫고 따스한 빛이 내려와요', condition: { type: 'score', value: 70 } },
      { id: 'score_80', icon: '✨', name: '별의 조각', desc: '피부 종합점수 80점 이상 달성 · 하늘에서 별 한 조각이 내려왔어요', condition: { type: 'score', value: 80 } },
      { id: 'score_90', icon: '🌕', name: '보름달의 축복', desc: '피부 종합점수 90점 이상 달성 · 온전한 달빛이 당신을 비추어요', condition: { type: 'score', value: 90 } },
      { id: 'score_95', icon: '💎', name: '수정궁의 열쇠', desc: '피부 종합점수 95점 이상 달성 · 거의 완벽한 빛, 수정궁의 문이 열려요', condition: { type: 'score', value: 95 } },
    ],
  },
  improvement: {
    label: '변신의 숲', subtitle: '피부 개선 & 회춘', icon: '🦋', color: '#B8E0D0',
    badges: [
      { id: 'improve_5', icon: '🌸', name: '첫 꽃잎', desc: '피부 종합점수 5점 이상 상승 · 봄바람에 첫 꽃잎이 떨어졌어요', condition: { type: 'improvement', value: 5 } },
      { id: 'improve_10', icon: '🦢', name: '백조의 호수', desc: '피부 종합점수 10점 이상 상승 · 물 위에 비친 모습이 달라졌어요', condition: { type: 'improvement', value: 10 } },
      { id: 'improve_20', icon: '🌈', name: '무지개 다리', desc: '피부 종합점수 20점 이상 상승 · 비 갠 뒤 무지개가 나타났어요', condition: { type: 'improvement', value: 20 } },
      { id: 'improve_30', icon: '🦋', name: '황금 나비', desc: '피부 종합점수 30점 이상 상승 · 눈부신 날개를 달고 날아올라요', condition: { type: 'improvement', value: 30 } },
      { id: 'skinAge_3', icon: '🍃', name: '바람의 시간', desc: '피부나이 3세 이상 감소 · 시간의 바람이 거꾸로 불어요', condition: { type: 'skinAge', value: 3 } },
      { id: 'skinAge_10', icon: '🪄', name: '마법사의 모래시계', desc: '피부나이 10세 이상 감소 · 모래가 거꾸로 흐르기 시작했어요', condition: { type: 'skinAge', value: 10 } },
    ],
  },
  mission: {
    label: '요정의 심부름', subtitle: '데일리 미션 완료', icon: '🍄', color: '#F4B8D4',
    badges: [
      { id: 'mission_10', icon: '🍄', name: '버섯 마을의 첫 심부름', desc: '데일리 미션 누적 10회 완료 · 작은 요정이 열 가지 부탁을 들어줬어요', condition: { type: 'missionCount', value: 10 } },
      { id: 'mission_30', icon: '🧵', name: '요정의 실타래', desc: '데일리 미션 누적 30회 완료 · 서른 가닥 실로 무언가를 짜고 있어요', condition: { type: 'missionCount', value: 30 } },
      { id: 'mission_50', icon: '🗝️', name: '비밀의 열쇠', desc: '데일리 미션 누적 50회 완료 · 숨겨진 문이 하나씩 열려요', condition: { type: 'missionCount', value: 50 } },
      { id: 'mission_100', icon: '👑', name: '요정의 대관식', desc: '데일리 미션 누적 100회 완료 · 백 번의 여정 끝에 왕관을 받아요', condition: { type: 'missionCount', value: 100 } },
      { id: 'allclear_5', icon: '🌟', name: '완벽한 하루', desc: '하루 미션 전체 완료 5일 달성 · 별들이 모두 제자리에 놓인 날', condition: { type: 'allClear', value: 5 } },
      { id: 'allclear_20', icon: '🏰', name: '동화의 성', desc: '하루 미션 전체 완료 20일 달성 · 하나도 빠짐없이, 동화가 완성되었어요', condition: { type: 'allClear', value: 20 } },
    ],
  },
  special: {
    label: '숨겨진 이야기', subtitle: '특별 활동 달성', icon: '🪞', color: '#A8C8F0',
    badges: [
      { id: 'first_analysis', icon: '🪞', name: '거울 속 첫 만남', desc: '첫 번째 피부 분석 완료 · 거울이 당신에게 처음으로 인사해요', condition: { type: 'measureCount', value: 1 } },
      { id: 'moisture_master', icon: '💧', name: '이슬의 요정', desc: '수분 지표 80점 이상 달성 · 아침 이슬처럼 촉촉한 빛이 감돌아요', condition: { type: 'itemScore', item: 'moisture', value: 80 } },
      { id: 'consult_10', icon: '🦉', name: '숲의 현자', desc: 'AI 피부 상담 10회 이용 · 부엉이에게 열 번째 질문을 건넸어요', condition: { type: 'consultCount', value: 10 } },
      { id: 'night_owl', icon: '🌙', name: '달빛 정원사', desc: '밤 10시 이후 피부 측정 5회 달성 · 달빛 아래 피부를 가꾸는 사람', condition: { type: 'nightMeasure', value: 5 } },
      { id: 'share_first', icon: '🕊️', name: '첫 번째 편지', desc: '분석 결과 첫 공유 · 비둘기가 소식을 전해요', condition: { type: 'shareCount', value: 1 } },
      { id: 'share_20', icon: '🌸', name: '꽃잎 편지', desc: '분석 결과 20회 공유 · 꽃잎마다 이야기가 적혀 있어요', condition: { type: 'shareCount', value: 20 } },
    ],
  },
};

// ===== 10개 칭호 (Lv 1~10) =====
const LEVEL_TITLES = [
  { level: 1,  title: '피부 초심자',       icon: '🌱', minXP: 0 },
  { level: 2,  title: '스킨케어 견습생',   icon: '🧴', minXP: 200 },
  { level: 3,  title: '루틴 실천가',       icon: '🛡️', minXP: 400 },
  { level: 4,  title: '피부 분석가',       icon: '🔍', minXP: 800 },
  { level: 5,  title: '글로우 탐험가',     icon: '🔆', minXP: 1400 },
  { level: 6,  title: '스킨케어 장인',     icon: '🎓', minXP: 2200 },
  { level: 7,  title: '피부 연금술사',     icon: '⚗️', minXP: 3200 },
  { level: 8,  title: '뷰티 현자',         icon: '🧙', minXP: 4600 },
  { level: 9,  title: '스킨케어 거장',     icon: '👑', minXP: 6400 },
  { level: 10, title: '영원한 빛',         icon: '☀️', minXP: 9000 },
];

// ===== 4개 테마 (취향 선택 · 모드별 2개) =====
const THEMES = [
  // ── 기본 (Lv 1~8) ─────────────────────────────────────────
  // ── 라이트모드 ──────────────────────────────────────────────
  { id: 'morningLight',    name: 'Morning Light',    kr: '모닝 라이트',      mode: 'light', accent: '#5EC6B0', sub: '#FEF9C3', pearl: ['#F0FFF8', '#A8E6CF', '#5EC6B0'], cloverTheme: 'morningLight',    desc: '아침 빛의 청량한 민트' },
  { id: 'springBlossom',   name: 'Spring Blossom',   kr: '스프링 블라썸',    mode: 'light', accent: '#E890B0', sub: '#BAE6FD', pearl: ['#FFF0F5', '#F4A8C8', '#A8D8F0'], cloverTheme: 'springBlossom',   desc: '봄꽃의 신비로운 개화' },
  // ── 다크모드 ────────────────────────────────────────────────
  { id: 'midnightMoon',    name: 'Midnight Moon',    kr: '미드나이트 문',    mode: 'dark',  accent: '#9AC8E8', sub: '#FFF5E8', pearl: ['#FFF5E8', '#9AC8E8', '#1A2A40'], cloverTheme: 'midnightMoon',    desc: '달빛 아래 고요한 밤' },
  { id: 'mysticNight',     name: 'Mystic Night',     kr: '미스틱 나이트',    mode: 'dark',  accent: '#B898D8', sub: '#6898E8', pearl: ['#E0D0F0', '#B898D8', '#1A1830'], cloverTheme: 'mysticNight',     desc: '신비로운 밤의 라벤더' },
];

/**
 * XP -> 레벨 계산 (LEVEL_TITLES의 minXP 기준)
 */
export function calculateLevel(totalXP) {
  let level = 1;
  for (const lt of LEVEL_TITLES) {
    if (totalXP >= lt.minXP) level = lt.level;
    else break;
  }
  return level;
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
 * 모드에 맞는 기본 테마 반환
 */
export function getDefaultTheme(mode = 'light') {
  return THEMES.find(t => t.mode === mode) || THEMES[0];
}

/**
 * ID로 테마 찾기
 */
export function getThemeById(id) {
  return THEMES.find(t => t.id === id) || THEMES[0];
}

/**
 * 모드에 해당하는 테마 목록 반환
 */
export function getThemesForMode(mode = 'light') {
  return THEMES.filter(t => t.mode === mode);
}

export { BADGE_DATABASE, LEVEL_TITLES, THEMES };
