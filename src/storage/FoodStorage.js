/**
 * 식단 기록 스토리지 (localStorage)
 * 접두사: lua_food_
 */

const RECORDS_KEY = 'lua_food_records';
const GOAL_KEY = 'lua_food_goal';

export function getFoodRecords(dateStr) {
  const all = JSON.parse(localStorage.getItem(RECORDS_KEY) || '{}');
  if (dateStr) return all[dateStr] || [];
  return all;
}

export function saveFoodRecord(dateStr, record) {
  const all = JSON.parse(localStorage.getItem(RECORDS_KEY) || '{}');
  if (!all[dateStr]) all[dateStr] = [];
  record.id = Date.now();
  all[dateStr].push(record);
  localStorage.setItem(RECORDS_KEY, JSON.stringify(all));
  return record;
}

export function deleteFoodRecord(dateStr, id) {
  const all = JSON.parse(localStorage.getItem(RECORDS_KEY) || '{}');
  if (all[dateStr]) {
    all[dateStr] = all[dateStr].filter(r => r.id !== id);
    if (all[dateStr].length === 0) delete all[dateStr];
    localStorage.setItem(RECORDS_KEY, JSON.stringify(all));
  }
}

export function getTodayFoods() {
  const today = new Date().toISOString().slice(0, 10);
  return getFoodRecords(today);
}

export function getFoodGoal() {
  return JSON.parse(localStorage.getItem(GOAL_KEY) || '{"kcal":1800,"carb":250,"protein":80,"fat":60,"water":2.0}');
}

export function saveFoodGoal(goal) {
  localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
}

export function getTodayNutrition() {
  const foods = getTodayFoods();
  return foods.reduce((sum, f) => ({
    kcal: sum.kcal + (f.kcal || 0),
    carb: sum.carb + (f.carb || 0),
    protein: sum.protein + (f.protein || 0),
    fat: sum.fat + (f.fat || 0),
    water: sum.water + (f.water || 0),
  }), { kcal: 0, carb: 0, protein: 0, fat: 0, water: 0 });
}
