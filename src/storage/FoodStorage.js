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
    fiber: 25,
    calcium: 800,
    iron: 14,
    sugar: 25,
  };
}

export function getFoodGoal(dateStr) {
  try {
    const profile = JSON.parse(localStorage.getItem('nou_profile') || '{}');
    // 다이어트 프로그램 설정이 있으면 요일별 목표칼로리 사용
    if (profile.dietOnboardingDone && profile.dietTargetCal) {
      const highCalDays = profile.dietHighCalDays || [];
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const d = dateStr ? new Date(dateStr) : new Date();
      const todayDay = dayNames[d.getDay()];
      let todayCal = profile.dietTargetCal;
      if (highCalDays.length > 0) {
        const highCal = Math.round(profile.dietTargetCal * 1.15);
        const lowCal = Math.round((profile.dietTargetCal * 7 - highCal * highCalDays.length) / (7 - highCalDays.length));
        todayCal = highCalDays.includes(todayDay) ? highCal : lowCal;
      }
      const goalWeight = profile.goalWeight || profile.currentWeight || 55;
      return {
        kcal: todayCal,
        carb: Math.round((todayCal * 0.5) / 4),
        protein: Math.round(goalWeight * 1.5),
        fat: Math.round((todayCal * 0.25) / 9),
        water: 2.0, vitamin: 100, mineral: 100, fiber: 25, calcium: 800, iron: 14, sugar: 25,
      };
    }
    const tw = Number(profile.targetWeight);
    if (tw > 0) return calcGoalByWeight(tw);
  } catch {}
  return { kcal: 1800, carb: 250, protein: 80, fat: 60, water: 2.0, vitamin: 100, mineral: 100, fiber: 25, calcium: 800, iron: 14, sugar: 25 };
}

/**
 * 시간대별 목표 비율
 * ~11시: 아침만 (30%)
 * ~17시: 아침+점심 (65%)
 * ~24시: 하루 전체 (100%)
 */
// 끼니별 영양소 비율
const MEAL_RATIO = {
  kcal:    { '아침': 0.25, '점심': 0.40, '저녁': 0.35 },
  carb:    { '아침': 0.25, '점심': 0.40, '저녁': 0.35 },
  protein: { '아침': 0.30, '점심': 0.35, '저녁': 0.35 },
  fat:     { '아침': 0.30, '점심': 0.35, '저녁': 0.35 },
};

function getMealRatio(key, recordedMeals) {
  const ratioMap = MEAL_RATIO[key];
  if (!ratioMap) return recordedMeals.length / 3; // 나머지 영양소: 균등 1/3
  return recordedMeals.reduce((sum, m) => sum + (ratioMap[m] || 1/3), 0);
}

export function getTimeAdjustedGoal() {
  const full = getFoodGoal();
  const foods = getTodayFoods().filter(f => !f.name?.startsWith('물 '));
  const meals = [...new Set(foods.map(f => f.meal))].filter(m => ['아침', '점심', '저녁'].includes(m));
  const mealCount = meals.length || 1;
  const mealLabel = meals.join('·') || '미기록';
  const evenRatio = mealCount / 3;
  return {
    ...full,
    kcal: Math.round(full.kcal * getMealRatio('kcal', meals)),
    carb: Math.round(full.carb * getMealRatio('carb', meals)),
    protein: Math.round(full.protein * getMealRatio('protein', meals)),
    fat: Math.round(full.fat * getMealRatio('fat', meals)),
    vitamin: Math.round(full.vitamin * evenRatio),
    mineral: Math.round(full.mineral * evenRatio),
    fiber: Math.round(full.fiber * evenRatio),
    calcium: Math.round(full.calcium * evenRatio),
    iron: Math.round(full.iron * evenRatio),
    sugar: Math.round(full.sugar * evenRatio),
    _ratio: evenRatio,
    _mealLabel: mealLabel,
    _mealCount: mealCount,
  };
}

export function saveFoodGoal(goal) {
  localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
}

export function getNutritionForDate(dateStr) {
  const foods = getFoodRecords(dateStr);
  return foods.reduce((sum, f) => ({
    kcal: sum.kcal + (f.kcal || 0),
    carb: sum.carb + (f.carb || 0),
    protein: sum.protein + (f.protein || 0),
    fat: sum.fat + (f.fat || 0),
    water: sum.water + (f.water || 0),
    vitamin: sum.vitamin + (f.vitamin || 0),
    mineral: sum.mineral + (f.mineral || 0),
    fiber: sum.fiber + (f.fiber || 0),
    calcium: sum.calcium + (f.calcium || 0),
    iron: sum.iron + (f.iron || 0),
    sugar: sum.sugar + (f.sugar || 0),
  }), { kcal: 0, carb: 0, protein: 0, fat: 0, water: 0, vitamin: 0, mineral: 0, fiber: 0, calcium: 0, iron: 0, sugar: 0 });
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
    fiber: sum.fiber + (f.fiber || 0),
    calcium: sum.calcium + (f.calcium || 0),
    iron: sum.iron + (f.iron || 0),
    sugar: sum.sugar + (f.sugar || 0),
  }), { kcal: 0, carb: 0, protein: 0, fat: 0, water: 0, vitamin: 0, mineral: 0, fiber: 0, calcium: 0, iron: 0, sugar: 0 });
}
