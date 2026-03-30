/**
 * 루틴 체크리스트 스토리지 (localStorage)
 * 카테고리별(skin/food/body) 루틴 항목 + 일별 체크
 */

const ITEMS_KEY = 'lua_routine_items';
const CHECKS_KEY = 'lua_routine_checks';

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
