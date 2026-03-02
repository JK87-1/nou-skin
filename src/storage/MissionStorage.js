/**
 * 미션 진행 상태 관리 (localStorage)
 * 접두사: lua_mission_
 */

const STATE_KEY = 'lua_mission_state';
const HISTORY_KEY = 'lua_mission_history';

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function archiveToHistory(state) {
  if (!state?.date) return;
  const history = getHistory();
  // 중복 방지
  if (history.some(h => h.date === state.date)) return;
  // 의미있는 데이터만 아카이브
  if (state.mainCompleted || state.bonusCompleted?.some(Boolean)) {
    history.push({
      date: state.date,
      category: state.category,
      mainCompleted: !!state.mainCompleted,
      bonusCompleted: state.bonusCompleted || [],
      xp: state.earnedXP || 0,
    });
    while (history.length > 90) history.shift();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }
}

/**
 * 오늘의 미션 진행 상태 불러오기
 * 날짜가 다르면 이전 상태를 아카이브하고 null 반환
 * @returns {Object|null}
 */
export function loadMissionProgress() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    const today = getToday();
    if (state.date !== today) {
      archiveToHistory(state);
      localStorage.removeItem(STATE_KEY);
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

/**
 * 미션 진행 상태 저장
 * @param {Object} state - { date, category, mainCompleted, trackProgress, bonusCompleted, earnedXP }
 */
export function saveMissionProgress(state) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Mission save failed:', e);
  }
}

/**
 * 새 미션 상태 초기화
 */
export function initMissionState(category, bonusCount) {
  return {
    date: getToday(),
    category,
    mainCompleted: false,
    trackProgress: 0,
    bonusCompleted: new Array(bonusCount).fill(false),
    earnedXP: 0,
  };
}

/**
 * 연속 달성 일수 (어제까지)
 */
export function getMissionStreak() {
  const history = getHistory();
  let streak = 0;
  const today = new Date();

  for (let i = 1; i <= 90; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const dateStr = checkDate.toISOString().slice(0, 10);
    const entry = history.find(h => h.date === dateStr);
    if (entry?.mainCompleted) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * 이번 주 월~일 각 날의 완료 여부
 * @returns {Array<{ date, dayLabel, completed, isToday, isFuture }>}
 */
export function getWeeklyStatus() {
  const today = new Date();
  const todayStr = getToday();
  const history = getHistory();
  const currentState = loadMissionProgressRaw();

  // 이번 주 월요일 구하기
  const dayOfWeek = today.getDay(); // 0=일, 1=월 ...
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

  const labels = ['월', '화', '수', '목', '금', '토', '일'];
  const week = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const isToday = dateStr === todayStr;
    const isFuture = dateStr > todayStr;

    let completed = false;
    if (isToday && currentState?.mainCompleted) {
      completed = true;
    } else {
      const entry = history.find(h => h.date === dateStr);
      completed = !!entry?.mainCompleted;
    }

    week.push({ date: dateStr, dayLabel: labels[i], completed, isToday, isFuture });
  }

  return week;
}

// raw 읽기 (아카이브 안 하고 현재 상태만)
function loadMissionProgressRaw() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * 누적 XP 계산
 */
export function getTotalXP() {
  const history = getHistory();
  let total = history.reduce((sum, h) => sum + (h.xp || 0), 0);
  const current = loadMissionProgressRaw();
  if (current?.date === getToday()) {
    total += current.earnedXP || 0;
  }
  return total;
}

/**
 * 뱃지 목록과 획득 여부
 */
export function getBadges() {
  const history = getHistory();
  const streak = getMissionStreak();
  const current = loadMissionProgressRaw();
  const todayCompleted = current?.date === getToday() && current?.mainCompleted;
  const effectiveStreak = todayCompleted ? streak + 1 : streak;

  // 수분 관련 미션 완료 횟수
  const moistureCount = history.filter(h => h.category === '수분부족' && h.mainCompleted).length
    + (current?.date === getToday() && current?.category === '수분부족' && current?.mainCompleted ? 1 : 0);

  // 올클리어 횟수 (메인 + 모든 보너스 완료)
  const allClearCount = history.filter(h =>
    h.mainCompleted && h.bonusCompleted?.every(Boolean)
  ).length + (
    current?.date === getToday() && current?.mainCompleted && current?.bonusCompleted?.every(Boolean) ? 1 : 0
  );

  return [
    {
      id: 'streak7', icon: '🔥', name: '7일 연속',
      description: '7일 연속 메인 미션 달성',
      achieved: effectiveStreak >= 7,
      progress: Math.min(1, effectiveStreak / 7),
      current: effectiveStreak, target: 7,
    },
    {
      id: 'moisture10', icon: '💧', name: '수분 마스터',
      description: '수분 관련 미션 10회 완료',
      achieved: moistureCount >= 10,
      progress: Math.min(1, moistureCount / 10),
      current: moistureCount, target: 10,
    },
    {
      id: 'streak14', icon: '🌟', name: '14일 연속',
      description: '14일 연속 메인 미션 달성',
      achieved: effectiveStreak >= 14,
      progress: Math.min(1, effectiveStreak / 14),
      current: effectiveStreak, target: 14,
    },
    {
      id: 'allclear5', icon: '🏆', name: '올클리어',
      description: '하루 전체 미션 완료 5회',
      achieved: allClearCount >= 5,
      progress: Math.min(1, allClearCount / 5),
      current: allClearCount, target: 5,
    },
  ];
}
