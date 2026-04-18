/**
 * 루틴 체크리스트 스토리지 (localStorage)
 * 카테고리별(skin/food/body/face) 루틴 항목 + 일별 체크
 */

const ITEMS_KEY = 'lua_routine_items';
const CHECKS_KEY = 'lua_routine_checks';

// 카테고리 key → 한글 라벨 매핑
export const CAT_LABEL = { skin: '피부', food: '식단', body: '바디', mood: '기분' };

// 카테고리 컬러
export const CAT_COLOR = {
  식단:   { bg: 'rgba(255,210,80,.2)',   text: '#9A7000',  icon: '🟡' },
  바디:   { bg: 'rgba(100,200,220,.2)',  text: '#2A7A9A',  icon: '🔵' },
  피부:   { bg: 'rgba(248,168,192,.2)',  text: '#C05080',  icon: '🩷' },
  기분:   { bg: 'rgba(168,200,240,.2)',  text: '#4070B0',  icon: '💙' },
};

export function getRoutineItems(category) {
  const all = JSON.parse(localStorage.getItem(ITEMS_KEY) || '{}');
  return all[category] || [];
}

export function saveRoutineItem(category, item) {
  const all = JSON.parse(localStorage.getItem(ITEMS_KEY) || '{}');
  if (!all[category]) all[category] = [];
  item.id = Date.now();
  all[category].push(item);
  localStorage.setItem(ITEMS_KEY, JSON.stringify(all));
  return all[category];
}

export function deleteRoutineItem(category, id) {
  const all = JSON.parse(localStorage.getItem(ITEMS_KEY) || '{}');
  if (all[category]) {
    all[category] = all[category].filter(i => i.id !== id);
    localStorage.setItem(ITEMS_KEY, JSON.stringify(all));
  }
  return all[category] || [];
}

export function getChecks(category, dateStr) {
  const all = JSON.parse(localStorage.getItem(CHECKS_KEY) || '{}');
  const key = `${category}_${dateStr}`;
  return all[key] || {};
}

export function toggleCheck(category, dateStr, itemId) {
  const all = JSON.parse(localStorage.getItem(CHECKS_KEY) || '{}');
  const key = `${category}_${dateStr}`;
  if (!all[key]) all[key] = {};
  all[key][itemId] = !all[key][itemId];
  localStorage.setItem(CHECKS_KEY, JSON.stringify(all));
  return all[key];
}

export function getTodayProgress(category) {
  const today = new Date().toISOString().slice(0, 10);
  const items = getRoutineItems(category);
  const checks = getChecks(category, today);
  const total = items.length;
  const done = items.filter(i => checks[i.id]).length;
  return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

/** 모든 카테고리의 루틴을 합쳐서 반환 (각 아이템에 category 키 추가) */
export function getAllRoutineItems() {
  const all = JSON.parse(localStorage.getItem(ITEMS_KEY) || '{}');
  const result = [];
  for (const cat of Object.keys(all)) {
    for (const item of all[cat]) {
      result.push({ ...item, category: cat });
    }
  }
  return result;
}

/** 특정 아이템의 연속 완료 일수 계산 (오늘 포함, 과거로 거슬러 올라감) */
export function getStreak(category, itemId) {
  const allChecks = JSON.parse(localStorage.getItem(CHECKS_KEY) || '{}');
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const dateStr = d.toISOString().slice(0, 10);
    const key = `${category}_${dateStr}`;
    if (allChecks[key]?.[itemId]) {
      streak++;
    } else {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** 루틴 아이템 수정 (이름, 시간대, 알림시간, active 등) */
export function updateRoutineItem(category, id, updates) {
  const all = JSON.parse(localStorage.getItem(ITEMS_KEY) || '{}');
  if (!all[category]) return [];
  all[category] = all[category].map(i => i.id === id ? { ...i, ...updates } : i);
  localStorage.setItem(ITEMS_KEY, JSON.stringify(all));
  return all[category];
}

/** 루틴 순서 저장 (카테고리 내 아이템 배열 교체) */
export function saveRoutineOrder(category, orderedItems) {
  const all = JSON.parse(localStorage.getItem(ITEMS_KEY) || '{}');
  all[category] = orderedItems;
  localStorage.setItem(ITEMS_KEY, JSON.stringify(all));
  return all[category];
}

export function getWeeklyRoutineStatus() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const labels = ['월', '화', '수', '목', '금', '토', '일'];
  // 저장된 모든 카테고리 키를 동적으로 가져옴
  const allItems = JSON.parse(localStorage.getItem(ITEMS_KEY) || '{}');
  const categories = Object.keys(allItems);

  return labels.map((label, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + mondayOffset + i);
    const dateStr = d.toISOString().slice(0, 10);
    const isToday = dateStr === todayStr;

    let totalAll = 0, doneAll = 0;
    for (const cat of categories) {
      const items = getRoutineItems(cat);
      const chk = getChecks(cat, dateStr);
      totalAll += items.length;
      doneAll += items.filter(it => chk[it.id]).length;
    }

    return {
      dayLabel: label,
      date: dateStr,
      isToday,
      completed: totalAll > 0 && doneAll === totalAll,
      partial: doneAll > 0,
    };
  });
}
