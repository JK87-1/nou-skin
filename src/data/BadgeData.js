/**
 * 뱃지 & 레벨 시스템 데이터
 * 5개 카테고리 40개 뱃지, 10개 레벨 칭호, 4개 테마
 */

const BADGE_DATABASE = {
  streak: {
    label: '피부 다이어리', subtitle: '연속 피부 측정', icon: '📖', color: '#C8B8E8',
    badges: [
      { id: 'streak_3', icon: '📝', name: '첫 번째 페이지', desc: '피부 측정 3일 연속 달성 · 일기의 첫 장이 열렸어요', condition: { type: 'streak', value: 3 } },
      { id: 'streak_7', icon: '📖', name: '일주일의 기록', desc: '피부 측정 7일 연속 달성 · 한 주의 이야기가 채워졌어요', condition: { type: 'streak', value: 7 } },
      { id: 'streak_14', icon: '🔖', name: '보름의 책갈피', desc: '피부 측정 14일 연속 달성 · 반달이 지나도록 빠짐없이 기록했어요', condition: { type: 'streak', value: 14 } },
      { id: 'streak_30', icon: '📚', name: '한 달의 일기장', desc: '피부 측정 30일 연속 달성 · 첫 번째 일기장이 완성되었어요', condition: { type: 'streak', value: 30 } },
      { id: 'streak_60', icon: '📕', name: '두 번째 일기장', desc: '피부 측정 60일 연속 달성 · 두 번째 권이 시작되었어요', condition: { type: 'streak', value: 60 } },
      { id: 'streak_100', icon: '🏛️', name: '기억의 서재', desc: '피부 측정 100일 연속 달성 · 백 페이지의 이야기가 서재를 채워요', condition: { type: 'streak', value: 100 } },
      { id: 'streak_200', icon: '📜', name: '전설의 기록', desc: '피부 측정 200일 연속 달성 · 누구도 쓰지 못한 이야기를 써냈어요', condition: { type: 'streak', value: 200 } },
      { id: 'streak_365', icon: '🌟', name: '일 년의 서사', desc: '피부 측정 365일 연속 달성 · 사계절을 담은 대서사시', condition: { type: 'streak', value: 365 } },
    ],
  },
  score: {
    label: '피부의 빛', subtitle: '피부 종합점수 달성', icon: '✨', color: '#F0D8A8',
    badges: [
      { id: 'score_40', icon: '🔥', name: '첫 번째 불씨', desc: '피부 종합점수 40점 이상 달성 · 아주 작은 불씨가 피어났어요', condition: { type: 'score', value: 40 } },
      { id: 'score_50', icon: '🕯️', name: '작은 불꽃', desc: '피부 종합점수 50점 이상 달성 · 어둠 속에 첫 빛이 켜졌어요', condition: { type: 'score', value: 50 } },
      { id: 'score_60', icon: '🌅', name: '새벽빛', desc: '피부 종합점수 60점 이상 달성 · 수평선 너머로 빛이 번져가요', condition: { type: 'score', value: 60 } },
      { id: 'score_70', icon: '🌤️', name: '맑은 햇살', desc: '피부 종합점수 70점 이상 달성 · 구름 위로 따스한 빛이 내려와요', condition: { type: 'score', value: 70 } },
      { id: 'score_80', icon: '✨', name: '별의 조각', desc: '피부 종합점수 80점 이상 달성 · 하늘에서 별 한 조각이 내려왔어요', condition: { type: 'score', value: 80 } },
      { id: 'score_85', icon: '🌙', name: '초승달', desc: '피부 종합점수 85점 이상 달성 · 달빛이 차오르고 있어요', condition: { type: 'score', value: 85 } },
      { id: 'score_90', icon: '🌕', name: '보름달', desc: '피부 종합점수 90점 이상 달성 · 온전한 달빛이 당신을 비추어요', condition: { type: 'score', value: 90 } },
      { id: 'score_95', icon: '💎', name: '다이아몬드', desc: '피부 종합점수 95점 이상 달성 · 완벽에 가까운 빛이 나요', condition: { type: 'score', value: 95 } },
    ],
  },
  improvement: {
    label: '새싹에서 숲으로', subtitle: '피부 개선 & 회춘', icon: '🌳', color: '#B8E0D0',
    badges: [
      { id: 'improve_3', icon: '🌰', name: '씨앗', desc: '피부 종합점수 3점 이상 상승 · 땅속에서 무언가 움직여요', condition: { type: 'improvement', value: 3 } },
      { id: 'improve_5', icon: '🌱', name: '첫 새싹', desc: '피부 종합점수 5점 이상 상승 · 작은 싹이 올라왔어요', condition: { type: 'improvement', value: 5 } },
      { id: 'improve_10', icon: '🌿', name: '푸른 잎', desc: '피부 종합점수 10점 이상 상승 · 잎이 하나둘 펼쳐져요', condition: { type: 'improvement', value: 10 } },
      { id: 'improve_20', icon: '🌸', name: '첫 번째 꽃', desc: '피부 종합점수 20점 이상 상승 · 드디어 꽃이 피었어요', condition: { type: 'improvement', value: 20 } },
      { id: 'improve_30', icon: '🌳', name: '든든한 나무', desc: '피부 종합점수 30점 이상 상승 · 어느새 나무로 자라났어요', condition: { type: 'improvement', value: 30 } },
      { id: 'skinAge_3', icon: '🍃', name: '봄바람', desc: '피부나이 3세 이상 감소 · 시간이 거꾸로 부는 바람', condition: { type: 'skinAge', value: 3 } },
      { id: 'skinAge_5', icon: '🍀', name: '되돌린 계절', desc: '피부나이 5세 이상 감소 · 계절이 한 바퀴 되돌아갔어요', condition: { type: 'skinAge', value: 5 } },
      { id: 'skinAge_10', icon: '🌲', name: '깊은 숲', desc: '피부나이 10세 이상 감소 · 울창한 숲이 되었어요', condition: { type: 'skinAge', value: 10 } },
    ],
  },
  mission: {
    label: '작은 모험', subtitle: '데일리 미션 완료', icon: '🗝️', color: '#F4B8D4',
    badges: [
      { id: 'mission_10', icon: '🗺️', name: '첫 번째 지도', desc: '데일리 미션 누적 10회 완료 · 모험의 지도를 펼쳤어요', condition: { type: 'missionCount', value: 10 } },
      { id: 'mission_30', icon: '🧭', name: '나침반', desc: '데일리 미션 누적 30회 완료 · 방향을 찾아가고 있어요', condition: { type: 'missionCount', value: 30 } },
      { id: 'mission_50', icon: '🗝️', name: '비밀의 열쇠', desc: '데일리 미션 누적 50회 완료 · 숨겨진 문이 열려요', condition: { type: 'missionCount', value: 50 } },
      { id: 'mission_100', icon: '🏆', name: '모험의 왕관', desc: '데일리 미션 누적 100회 완료 · 백 번의 모험을 완수했어요', condition: { type: 'missionCount', value: 100 } },
      { id: 'mission_200', icon: '⚔️', name: '전설의 모험가', desc: '데일리 미션 누적 200회 완료 · 이 길의 끝을 아는 사람', condition: { type: 'missionCount', value: 200 } },
      { id: 'allclear_5', icon: '⭐', name: '완벽한 하루', desc: '하루 미션 전체 완료 5일 달성 · 모든 별을 모은 날', condition: { type: 'allClear', value: 5 } },
      { id: 'allclear_20', icon: '🏰', name: '모험의 성', desc: '하루 미션 전체 완료 20일 달성 · 모험이 전설이 되었어요', condition: { type: 'allClear', value: 20 } },
      { id: 'allclear_50', icon: '🌈', name: '무지개 너머', desc: '하루 미션 전체 완료 50일 달성 · 완벽한 하루가 일상이 되었어요', condition: { type: 'allClear', value: 50 } },
    ],
  },
  special: {
    label: '숨겨진 보물', subtitle: '특별 활동 달성', icon: '🔮', color: '#A8C8F0',
    badges: [
      { id: 'first_analysis', icon: '🔮', name: '수정구슬', desc: '첫 번째 피부 분석 완료 · 첫 번째 보물을 발견했어요', condition: { type: 'measureCount', value: 1 } },
      { id: 'measure_10', icon: '🗺️', name: '보물 지도', desc: '피부 측정 누적 10회 달성 · 보물이 묻힌 곳이 보여요', condition: { type: 'measureCount', value: 10 } },
      { id: 'moisture_master', icon: '💧', name: '이슬의 보석', desc: '수분 지표 80점 이상 달성 · 촉촉한 보물을 찾았어요', condition: { type: 'itemScore', item: 'moisture', value: 80 } },
      { id: 'consult_10', icon: '🦉', name: '현자의 깃털', desc: 'AI 피부 상담 10회 이용 · 지혜로운 보물을 얻었어요', condition: { type: 'consultCount', value: 10 } },
      { id: 'night_owl', icon: '🌙', name: '달빛 보석', desc: '밤 10시 이후 피부 측정 5회 달성 · 밤에만 빛나는 보물', condition: { type: 'nightMeasure', value: 5 } },
      { id: 'morning_star', icon: '🌅', name: '새벽의 보석', desc: '오전 5~9시 피부 측정 10회 달성 · 아침에만 빛나는 보물', condition: { type: 'morningMeasure', value: 10 } },
      { id: 'share_first', icon: '🕊️', name: '날개의 편지', desc: '분석 결과 첫 공유 · 소식을 전하는 보물', condition: { type: 'shareCount', value: 1 } },
      { id: 'share_20', icon: '👑', name: '나눔의 왕관', desc: '분석 결과 20회 공유 · 나눔이 만든 빛나는 보물', condition: { type: 'shareCount', value: 20 } },
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
  { level: 6,  title: '스킨케어 전문가',   icon: '🎓', minXP: 2200 },
  { level: 7,  title: '피부 설계자',       icon: '⚗️', minXP: 3200 },
  { level: 8,  title: '뷰티 멘토',         icon: '🧙', minXP: 4600 },
  { level: 9,  title: '뷰티 리더',         icon: '👑', minXP: 6400 },
  { level: 10, title: '글로우 마스터',     icon: '☀️', minXP: 9000 },
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
 * 포인트 -> 레벨 계산 (LEVEL_TITLES의 minXP 기준)
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
