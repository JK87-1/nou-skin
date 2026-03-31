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

/**
 * 목표체중 기반 1일 영양 목표 계산
 * - 칼로리: 목표체중 × 30 kcal
 * - 탄수화물: 총 칼로리의 50% / 4 kcal/g
 * - 단백질: 목표체중 × 1.5g
 * - 지방: 총 칼로리의 25% / 9 kcal/g
 */
function calcGoalByWeight(kg) {
  const kcal = Math.round(kg * 30);
  return {
    kcal,
    carb: Math.round((kcal * 0.5) / 4),
    protein: Math.round(kg * 1.5),
    fat: Math.round((kcal * 0.25) / 9),
    water: 2.0,
    vitamin: 100,
    mineral: 100,
  };
}

export function getFoodGoal() {
  try {
    const profile = JSON.parse(localStorage.getItem('nou_profile') || '{}');
    const tw = Number(profile.targetWeight);
    if (tw > 0) return calcGoalByWeight(tw);
  } catch {}
  return { kcal: 1800, carb: 250, protein: 80, fat: 60, water: 2.0, vitamin: 100, mineral: 100 };
}

/**
 * 시간대별 목표 비율
 * ~11시: 아침만 (30%)
 * ~17시: 아침+점심 (65%)
 * ~24시: 하루 전체 (100%)
 */
export function getTimeAdjustedGoal() {
  const full = getFoodGoal();
  const hour = new Date().getHours();
  let ratio;
  if (hour < 11) ratio = 0.3;
  else if (hour < 17) ratio = 0.6;
  else ratio = 1.0;
  return {
    ...full,
    kcal: Math.round(full.kcal * ratio),
    carb: Math.round(full.carb * ratio),
    protein: Math.round(full.protein * ratio),
    fat: Math.round(full.fat * ratio),
    vitamin: Math.round(full.vitamin * ratio),
    mineral: Math.round(full.mineral * ratio),
    _ratio: ratio,
    _mealLabel: ratio === 0.3 ? '아침' : ratio === 0.65 ? '아침·점심' : '하루',
  };
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
    vitamin: sum.vitamin + (f.vitamin || 0),
    mineral: sum.mineral + (f.mineral || 0),
  }), { kcal: 0, carb: 0, protein: 0, fat: 0, water: 0, vitamin: 0, mineral: 0 });
}
