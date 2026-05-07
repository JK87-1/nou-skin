/**
 * lua 인사이트 엔진 (Phase 1 + Phase 2 LLM)
 * 30개 템플릿 + 트리거 + 점수 + 우선순위
 * LLM 인사이트 통합: LLM 캐시 우선 → 템플릿 폴백
 * lua 페르소나 100% 적용
 */
import { getCurrentLLMInsight, getLLMInsights, onLLMRefresh, onMeaningfulDataInput, isLLMEnabled } from './LLMInsightEngine';

const CACHE_KEY = 'lua_insight_cache';
const FEEDBACK_KEY = 'lua_insight_feedback';
const MIN_USER_DAYS = 1;
const MAX_PER_DAY = 3;
const ACTION_COOLDOWN_DAYS = 1; // 행동 실행한 인사이트만 1일 쿨다운

// 세션 내 이미 보여준 인사이트 추적 (새로고침 시 다른 것 우선)
let sessionShownIds = [];

// ===== 데이터 수집 =====
function getDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return getDateKey(d);
}

function getDayOfWeek(dateStr) {
  return new Date(dateStr).getDay(); // 0=Sun
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function collectUserData(days = 30) {
  const records = safeJSON('lua_record_v2', {});
  const foods = safeJSON('lua_food_records', {});
  const checks = safeJSON('nou_condition_checks', []);
  const drinks = safeJSON('lua_drink_records', {});
  const skinLogs = safeJSON('lua_skin_check_logs', {});
  const suppItems = safeJSON('lua_supplement_items', []);
  const suppChecks = safeJSON('lua_supplement_checks', {});
  const waterSettings = { cupMl: 250, goalMl: 2000, ...safeJSON('lua_water_settings', {}) };
  const bodyRecords = safeJSON('lua_body_records', []);
  const weatherData = safeJSON('lua_weather_data', null);
  const cycleData = safeJSON('lua_cycle_data', null);

  const today = new Date();
  const todayKey = getDateKey(today);
  const data = { days: [], todayKey, waterSettings, suppItems };
  let firstRecordDate = null;

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = getDateKey(d);
    const rec = records[key] || {};
    const dayFoods = (foods[key] || []).filter(f => !f.name?.startsWith('물 '));
    const dayDrinks = drinks[key] || {};
    const dayChecks = checks.filter(c => c.date === key || (c.timestamp && c.timestamp.startsWith(key)));
    const latestCheck = dayChecks.length > 0 ? dayChecks[dayChecks.length - 1] : null;
    const skinLog = skinLogs[key] || null;
    const daySupp = suppChecks[key] || {};

    const caffeineItems = dayDrinks.caffeine || [];
    const alcoholItems = dayDrinks.alcohol || [];
    const totalCafMg = caffeineItems.reduce((s, d) => {
      const mgMap = { espresso: 150, americano: 150, latte: 150, drip: 130, coldbrew: 200, decaf: 5, matcha: 70, green_tea: 30, black_tea: 50, energy_drink: 160, choco_latte: 30, green_tea_latte: 80, chai_latte: 50 };
      return s + (mgMap[d.key] || 100) * (d.count || 0);
    }, 0);
    const totalAlcohol = alcoholItems.reduce((s, d) => s + (d.count || 0), 0);

    const totalKcal = dayFoods.reduce((s, f) => s + (f.kcal || 0), 0);
    const totalProtein = dayFoods.reduce((s, f) => s + (f.protein || 0), 0);

    const waterCups = rec.water?.cups || 0;
    const waterMl = waterCups * waterSettings.cupMl;
    const waterGoalMl = waterSettings.goalMl;

    const suppDone = suppItems.filter(s => daySupp[s.id]).length;
    const suppTotal = suppItems.length;

    if (rec.sleep || waterCups > 0 || dayFoods.length > 0 || latestCheck || totalCafMg > 0) {
      if (!firstRecordDate) firstRecordDate = key;
    }

    data.days.push({
      date: key,
      dayOfWeek: d.getDay(),
      dayName: DAY_NAMES[d.getDay()],
      sleep: rec.sleep?.hours || 0,
      sleepQuality: rec.sleep?.quality || null,
      bedtime: rec.sleep?.bedtime || null,
      waterCups, waterMl, waterGoalMl,
      steps: rec.steps || 0,
      exercise: rec.exercise?.log || {},
      hasExercise: Object.keys(rec.exercise?.log || {}).length > 0,
      totalKcal, totalProtein, foodCount: dayFoods.length,
      caffeineItems, totalCafMg, alcoholItems, totalAlcohol,
      condition: latestCheck ? {
        energy: latestCheck.energy || latestCheck.에너지 || 0,
        mood: latestCheck.mood || latestCheck.기분 || 0,
        skin: latestCheck.skin || latestCheck.피부 || 0,
        gut: latestCheck.gut || latestCheck.소화 || 0,
      } : null,
      skinLog,
      hasTrouble: skinLog?.signals?.some(s => ['new_trouble', 'redness', 'sensitive'].includes(s)) || false,
      hasDry: skinLog?.signals?.includes('dry') || false,
      suppDone, suppTotal,
      weight: bodyRecords.find(r => r.date === key)?.weight || 0,
    });
  }

  // 날씨 데이터
  data.weather = weatherData ? {
    temp: weatherData.temp || weatherData.temperature || 0,
    tempMax: weatherData.tempMax || 0,
    tempMin: weatherData.tempMin || 0,
    humidity: weatherData.humidity || 0,
    uv: weatherData.uv || 0,
  } : null;

  // 주기 데이터
  data.cycle = cycleData;

  // 사용일수 계산
  const activeDays = data.days.filter(d => d.sleep > 0 || d.waterCups > 0 || d.foodCount > 0 || d.condition).length;
  data.activeDays = activeDays;
  data.hasEnoughData = activeDays >= MIN_USER_DAYS;

  return data;
}

function safeJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
}

// ===== 시간대별 인사말 =====
export function getGreetingByTime() {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return { label: '좋은 아침이에요', discovery: '오늘의 발견 가져왔어요' };
  if (h >= 11 && h < 14) return { label: '잘 보내고 계세요?', discovery: '오전 데이터 보다가 발견한 거예요' };
  if (h >= 14 && h < 18) return { label: '오후도 잘 지내요', discovery: '방금 발견했어요' };
  if (h >= 18 && h < 22) return { label: '수고하셨어요', discovery: '오늘 하루 패턴 보니...' };
  if (h >= 22 || h < 2) return { label: '조용한 시간이네요', discovery: '오늘 마지막 발견이에요' };
  return { label: '아직 깨어 계세요?', discovery: '조용히 발견한 거예요' };
}

// ===== 말풍선 분리 =====
export function splitIntoBubbles(message) {
  const sentences = message.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length <= 2) return { bubble1: message, bubble2: '' };
  return {
    bubble1: sentences.slice(0, 2).join(' '),
    bubble2: sentences.slice(2).join(' '),
  };
}

// ===== 하트(좋아요) 관리 =====
const LIKES_KEY = 'lua_insight_likes';
export function getLikes() { try { return JSON.parse(localStorage.getItem(LIKES_KEY) || '{}'); } catch { return {}; } }
export function toggleLike(insightId) {
  const likes = getLikes();
  if (likes[insightId]) delete likes[insightId]; else likes[insightId] = new Date().toISOString();
  localStorage.setItem(LIKES_KEY, JSON.stringify(likes));
  return !!likes[insightId];
}

// ===== 30개 인사이트 템플릿 (v3: 모두 3문장, 관찰+근거+함의) =====
const TEMPLATES = [
  // A. 패턴 발견 (8개)
  {
    id: 'A1', relatedCards: ['water'], type: 'pattern', emoji: '🔍', label: '발견',
    check(data) {
      const last21 = data.days.slice(0, 21);
      const byDay = {};
      last21.forEach(d => {
        if (!byDay[d.dayOfWeek]) byDay[d.dayOfWeek] = [];
        byDay[d.dayOfWeek].push(d);
      });
      for (const [dow, days] of Object.entries(byDay)) {
        const lowWater = days.filter(d => d.waterMl > 0 && d.waterMl < d.waterGoalMl * 0.7);
        if (lowWater.length >= 2 && lowWater.length / days.length >= 0.6) {
          return { dayName: DAY_NAMES[dow], weeks: lowWater.length };
        }
      }
      return null;
    },
    message(r) { return `${r.dayName}요일마다 수분이 부족해지시네요! 벌써 ${r.weeks}주째 같은 패턴이에요 🤔 의식적으로 챙기면 ${r.dayName}요일 컨디션이 확 달라질 거예요.`; },
  },
  {
    id: 'A2', relatedCards: ['caffeine'], type: 'pattern', emoji: '☕', label: '발견',
    check(data) {
      const recent = data.days.slice(0, 14).filter(d => d.totalCafMg > 0);
      if (recent.length < 5) return null;
      const afternoonDays = recent.filter(d => d.caffeineItems.some(c => {
        const h = c.time ? parseInt(c.time.split(':')[0]) : 14;
        return h >= 14;
      }));
      if (afternoonDays.length / recent.length >= 0.6) return { total: recent.length, afternoon: afternoonDays.length };
      return null;
    },
    message(r) { return `오후 3시쯤 한 잔 더 챙기시는 패턴이에요! 지난 2주 ${r.total}번 중 ${r.afternoon}번이나 그러셨어요 ☕ 이 시간엔 무카페인 차로 바꾸면 잠도 잘 올 거예요.`; },
  },
  {
    id: 'A4', relatedCards: ['sleep'], type: 'pattern', emoji: '😴', label: '발견',
    check(data) {
      const last28 = data.days.slice(0, 28).filter(d => d.sleep > 0);
      if (last28.length < 10) return null;
      const weekday = last28.filter(d => d.dayOfWeek >= 1 && d.dayOfWeek <= 5);
      const weekend = last28.filter(d => d.dayOfWeek === 0 || d.dayOfWeek === 6);
      if (weekday.length < 5 || weekend.length < 3) return null;
      const wdAvg = weekday.reduce((s, d) => s + d.sleep, 0) / weekday.length;
      const weAvg = weekend.reduce((s, d) => s + d.sleep, 0) / weekend.length;
      if (weAvg - wdAvg >= 1) return { diff: Math.round((weAvg - wdAvg) * 10) / 10, wdAvg: wdAvg.toFixed(1), weAvg: weAvg.toFixed(1) };
      return null;
    },
    message(r) { return `주말마다 수면이 +${r.diff}시간이나 늘어요! 평일 ${r.wdAvg}시간에서 주말 ${r.weAvg}시간이라 평일에 좀 부족하신 듯해요 🌙 평일도 30분만 더 자보면 큰 차이가 보일 거예요.`; },
  },
  {
    id: 'A6', relatedCards: ['alcohol', 'skin'], type: 'pattern', emoji: '🍺', label: '발견',
    check(data) {
      const last21 = data.days.slice(0, 21);
      let matches = 0;
      for (let i = 0; i < last21.length - 1; i++) {
        if (last21[i].totalAlcohol > 0 && last21[i + 1].hasTrouble) matches++;
      }
      if (matches >= 2) return { count: matches };
      return null;
    },
    message(r) { return `술 마신 다음날 트러블이 오는 패턴이에요! 벌써 ${r.count}주째 반복돼서 본인 신호인 듯해요 🍺 음주 다음날 비타민C 챙기면 영향을 줄일 수 있어요.`; },
  },
  {
    id: 'A8', relatedCards: ['activity', 'condition'], type: 'pattern', emoji: '🏃', label: '발견',
    check(data) {
      const last14 = data.days.slice(0, 14);
      const exDays = last14.filter(d => d.hasExercise && d.condition);
      const noExDays = last14.filter(d => !d.hasExercise && d.condition);
      if (exDays.length < 3 || noExDays.length < 3) return null;
      const exAvg = exDays.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / exDays.length;
      const noExAvg = noExDays.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / noExDays.length;
      const diff = Math.round(exAvg - noExAvg);
      if (diff >= 5) return { diff, count: exDays.length };
      return null;
    },
    message(r) { return `운동한 날 컨디션이 +${r.diff}점이나 더 좋아요! 지난 2주 동안 운동한 ${r.count}번 모두 효과를 보셨어요 🏃 본인은 아침 운동이 잘 맞는 듯하니 루틴화해보세요.`; },
  },
  {
    id: 'A9', relatedCards: ['caffeine', 'sleep'], type: 'pattern', emoji: '☕', label: '발견',
    check(data) {
      const last14 = data.days.slice(0, 14);
      let lateCafShortSleep = 0;
      const shortSleepAvg = [];
      for (const d of last14) {
        if (d.totalCafMg > 100 && d.sleep > 0 && d.sleep < 6) {
          lateCafShortSleep++;
          shortSleepAvg.push(d.sleep);
        }
      }
      if (lateCafShortSleep >= 3) return { avgSleep: (shortSleepAvg.reduce((a, b) => a + b, 0) / shortSleepAvg.length).toFixed(1) };
      return null;
    },
    message(r) { return `오후 카페인이 잠을 짧게 만드는 패턴이에요! 카페인 드신 날 평균 수면이 ${r.avgSleep}시간뿐이었어요 ☕ 4시 이후엔 디카페인으로 바꾸면 깊은 잠 가능할 거예요.`; },
  },
  {
    id: 'A10', relatedCards: ['condition', 'meal'], type: 'pattern', emoji: '😰', label: '발견',
    check(data) {
      const last14 = data.days.slice(0, 14).filter(d => d.condition && d.foodCount > 0);
      if (last14.length < 5) return null;
      const stressHigh = last14.filter(d => d.condition.mood <= 4 && d.totalKcal > 0);
      if (stressHigh.length >= 3) return { count: stressHigh.length };
      return null;
    },
    message(r) { return `스트레스 받으면 먹는 양이 늘어나는 듯해요! 최근 2주간 ${r.count}번이나 그런 패턴이 보였어요 🤔 다음에 스트레스 올 때 따뜻한 차나 견과류 어떠세요?`; },
  },

  // B. 교차 분석 (8개)
  {
    id: 'B1', relatedCards: ['caffeine', 'sleep'], type: 'cross_analysis', emoji: '💡', label: '통찰',
    check(data) {
      const yesterday = data.days[1];
      const today = data.days[0];
      if (!yesterday || yesterday.totalCafMg < 100) return null;
      if (!today || today.sleep === 0 || today.sleep >= 7) return null;
      return { cafMg: yesterday.totalCafMg, sleepH: today.sleep };
    },
    message(r) { return `어제 카페인 ${r.cafMg}mg 드시고 오늘 수면이 ${r.sleepH}시간이에요! 카페인 영향이 있는 듯해요 ☕ 오후 카페인만 줄여도 잠이 깊어질 거예요.`; },
  },
  {
    id: 'B2', relatedCards: ['water', 'condition'], type: 'cross_analysis', emoji: '💡', label: '통찰',
    check(data) {
      const last14 = data.days.slice(0, 14);
      const waterHigh = last14.filter(d => d.waterMl >= d.waterGoalMl && d.condition);
      const waterLow = last14.filter(d => d.waterMl > 0 && d.waterMl < d.waterGoalMl * 0.5 && d.condition);
      if (waterHigh.length < 3 || waterLow.length < 2) return null;
      const highAvg = waterHigh.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / waterHigh.length;
      const lowAvg = waterLow.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / waterLow.length;
      const diff = Math.round(highAvg - lowAvg);
      if (diff >= 3) return { diff };
      return null;
    },
    message(r) { return `물 충분히 마신 날 컨디션이 +${r.diff}점이나 좋아져요! 본인만의 회복 신호인 듯해요 💧 수분이 본인한테 효과 큰 편이라 꾸준히 챙기면 좋아요.`; },
  },
  {
    id: 'B3', relatedCards: ['activity', 'sleep'], type: 'cross_analysis', emoji: '💡', label: '통찰',
    check(data) {
      const last14 = data.days.slice(0, 14).filter(d => d.sleep > 0);
      const exDays = last14.filter(d => d.hasExercise);
      const noExDays = last14.filter(d => !d.hasExercise);
      if (exDays.length < 3 || noExDays.length < 3) return null;
      const exSleep = exDays.reduce((s, d) => s + d.sleep, 0) / exDays.length;
      const noExSleep = noExDays.reduce((s, d) => s + d.sleep, 0) / noExDays.length;
      const diff = Math.round((exSleep - noExSleep) * 60);
      if (diff >= 20) return { diff, exCount: exDays.length };
      return null;
    },
    message(r) { return `운동한 날 잠이 평균 +${r.diff}분이나 늘어요! 지난 2주 운동 ${r.exCount}번 중 대부분 깊은 잠이 늘었어요 🏃 주 3회만 유지해도 수면 질이 계속 좋아질 거예요.`; },
  },
  {
    id: 'B4', relatedCards: ['meal', 'condition'], type: 'cross_analysis', emoji: '💡', label: '통찰',
    check(data) {
      const last7 = data.days.slice(0, 7).filter(d => d.foodCount > 0 && d.condition);
      if (last7.length < 4) return null;
      const lowProtein = last7.filter(d => d.totalProtein < 40 && d.condition.energy <= 5);
      if (lowProtein.length >= 2) return { count: lowProtein.length };
      return null;
    },
    message(r) { return `단백질 부족한 날 오후 졸림이 더 심해요! 이번 주 ${r.count}번이나 그랬어요 🍱 점심 단백질 30g 정도 챙기면 오후 활력이 유지될 거예요.`; },
  },
  {
    id: 'B6', relatedCards: ['alcohol', 'condition'], type: 'cross_analysis', emoji: '🍺', label: '통찰',
    check(data) {
      const yesterday = data.days[1];
      const today = data.days[0];
      if (!yesterday || yesterday.totalAlcohol === 0) return null;
      if (!today?.condition) return null;
      const avg = (today.condition.energy + today.condition.mood) / 2;
      if (avg <= 4) return { drinks: yesterday.totalAlcohol };
      return null;
    },
    message(r) { return `어제 술 → 오늘 컨디션이 좀 힘든 듯해요! 본인은 알코올 영향이 큰 편이세요 🍺 자기 전 물 한 잔 + 비타민C 챙기면 회복이 빨라질 거예요.`; },
  },
  {
    id: 'B7', relatedCards: ['sleep', 'skin'], type: 'cross_analysis', emoji: '✨', label: '통찰',
    check(data) {
      const last7 = data.days.slice(0, 7);
      const shortSleep = last7.filter(d => d.sleep > 0 && d.sleep < 6);
      if (shortSleep.length < 3) return null;
      const recentTrouble = last7.filter(d => d.hasTrouble);
      if (recentTrouble.length >= 1) return { sleepDays: shortSleep.length };
      return null;
    },
    message(r) { return `최근 잠이 짧으신데 피부에도 영향이 있는 듯해요! ${r.sleepDays}일 연속 수면 부족 후 트러블이 시작됐어요 🌙 7시간 이상 자보면 피부도 회복 시간을 가질 수 있어요.`; },
  },
  {
    id: 'B8', relatedCards: ['meal', 'condition'], type: 'cross_analysis', emoji: '🍱', label: '통찰',
    check(data) {
      const last7 = data.days.slice(0, 7);
      let matches = 0;
      for (let i = 0; i < last7.length - 1; i++) {
        const dayFoods = safeJSON('lua_food_records', {})[last7[i].date] || [];
        const lateMeal = dayFoods.some(f => f.meal === '야식' || f.meal === '간식');
        if (lateMeal && last7[i + 1]?.condition && (last7[i + 1].condition.energy + last7[i + 1].condition.mood) / 2 <= 4) {
          matches++;
        }
      }
      if (matches >= 2) return { count: matches };
      return null;
    },
    message(r) { return `늦은 저녁 식사가 다음날 아침을 무겁게 해요! 이번 주 ${r.count}번이나 반복됐어요 🍱 8시 이전 저녁 드시면 아침이 가벼워질 거예요.`; },
  },
  {
    id: 'B5', relatedCards: ['caffeine', 'skin'], type: 'cross_analysis', emoji: '☕', label: '통찰',
    check(data) {
      const last14 = data.days.slice(0, 14);
      let matches = 0, total = 0;
      for (let i = 0; i < last14.length - 1; i++) {
        if (last14[i].totalCafMg >= 200) { total++; if (last14[i + 1].hasTrouble) matches++; }
      }
      if (matches >= 2) return { matches, total };
      return null;
    },
    message(r) { return `카페인 200mg 이상 드신 다음날 트러블이 와요! 이번 달 ${r.total}번 중 ${r.matches}번이나 일치했어요 ☕ 200mg 이하로 유지하면 피부도 진정될 거예요.`; },
  },

  // C. 변화 감지 (6개)
  {
    id: 'C1', relatedCards: ['condition', 'caffeine'], type: 'change_detection', emoji: '⚡', label: '변화',
    check(data) {
      const thisWeek = data.days.slice(0, 7).filter(d => d.condition);
      const lastWeek = data.days.slice(7, 14).filter(d => d.condition);
      if (thisWeek.length < 3 || lastWeek.length < 3) return null;
      const twAvg = thisWeek.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / thisWeek.length;
      const lwAvg = lastWeek.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / lastWeek.length;
      const diff = Math.round(twAvg - lwAvg);
      if (diff <= -10) {
        const twCaf = Math.round(thisWeek.reduce((s, d) => s + d.totalCafMg, 0) / thisWeek.length);
        const lwCaf = Math.round(lastWeek.reduce((s, d) => s + d.totalCafMg, 0) / lastWeek.length);
        if (Math.abs(twCaf - lwCaf) > 50) return { diff: Math.abs(diff), prevCaf: lwCaf, curCaf: twCaf };
        return null;
      }
      return null;
    },
    message(r) { return `이번 주 컨디션이 -${r.diff}점인데 변한 건 카페인이에요! 평소 ${r.prevCaf}mg에서 이번 주 ${r.curCaf}mg으로 늘었어요 ☕ 오후 시간대만이라도 줄이면 다음 주 컨디션이 회복될 거예요.`; },
  },
  {
    id: 'C2', relatedCards: ['sleep'], type: 'change_detection', emoji: '😴', label: '변화',
    check(data) {
      const recent = data.days.slice(0, 7).filter(d => d.sleep > 0);
      const prev = data.days.slice(7, 14).filter(d => d.sleep > 0);
      if (recent.length < 3 || prev.length < 3) return null;
      const rAvg = recent.reduce((s, d) => s + d.sleep, 0) / recent.length;
      const pAvg = prev.reduce((s, d) => s + d.sleep, 0) / prev.length;
      const diffMin = Math.round((rAvg - pAvg) * 60);
      if (Math.abs(diffMin) >= 30) {
        return { min: Math.abs(diffMin), dir: diffMin > 0 ? '더' : '덜', rAvg: rAvg.toFixed(1), pAvg: pAvg.toFixed(1) };
      }
      return null;
    },
    message(r) { return `최근 잠을 ${r.min}분이나 ${r.dir} 자고 계세요! 평균 ${r.pAvg}시간에서 ${r.rAvg}시간으로 변했어요 🌙 이대로 유지하면 본인 몸도 적응해서 컨디션이 더 좋아질 거예요.`; },
  },
  {
    id: 'C3', relatedCards: ['skin'], type: 'change_detection', emoji: '✨', label: '변화',
    check(data) {
      const thisHalf = data.days.slice(0, 14).filter(d => d.hasTrouble).length;
      const lastHalf = data.days.slice(14, 28).filter(d => d.hasTrouble).length;
      if (lastHalf >= 3 && thisHalf <= lastHalf * 0.5) return { prev: lastHalf, cur: thisHalf };
      return null;
    },
    message(r) { return `이번 달 트러블이 절반으로 줄었어요! 지난 달 ${r.prev}일에서 이번 달 ${r.cur}일이에요 🫧 뭐가 달라졌는지 발견하면 본인만의 관리법을 만들 수 있어요.`; },
  },
  {
    id: 'C4', relatedCards: ['water'], type: 'change_detection', emoji: '💧', label: '변화',
    check(data) {
      const last3 = data.days.slice(0, 3).filter(d => d.waterCups > 0);
      const prev3 = data.days.slice(3, 6).filter(d => d.waterCups > 0);
      if (last3.length < 2 || prev3.length < 2) return null;
      const rAvg = last3.reduce((s, d) => s + d.waterMl, 0) / last3.length;
      const pAvg = prev3.reduce((s, d) => s + d.waterMl, 0) / prev3.length;
      if (rAvg > pAvg * 1.3 && rAvg > 0) return { prev: (pAvg / 1000).toFixed(1), cur: (rAvg / 1000).toFixed(1), pct: Math.round((rAvg / pAvg - 1) * 100) };
      return null;
    },
    message(r) { return `수분 섭취 늘었네요. 평소 ${r.prev}L → 최근 ${r.cur}L로 +${r.pct}% 증가했어요. 이대로 유지하시면 피부 트러블 줄고 컨디션도 좋아질 수 있어요.`; },
  },
  {
    id: 'C5', relatedCards: ['caffeine'], type: 'change_detection', emoji: '☕', label: '변화',
    check(data) {
      const thisWeek = data.days.slice(0, 7);
      const lastWeek = data.days.slice(7, 14);
      const twCaf = thisWeek.reduce((s, d) => s + d.totalCafMg, 0) / 7;
      const lwCaf = lastWeek.reduce((s, d) => s + d.totalCafMg, 0) / 7;
      if (lwCaf > 30 && twCaf < lwCaf * 0.7) {
        return { pct: Math.round((1 - twCaf / lwCaf) * 100), prev: Math.round(lwCaf), cur: Math.round(twCaf) };
      }
      return null;
    },
    message(r) { return `이번 주 카페인을 -${r.pct}%나 줄이셨네요! 평소 ${r.prev}mg에서 이번 주 ${r.cur}mg, 본인만의 변화예요 ☕ 이번 주 수면 질도 좋아지고 있을 거예요.`; },
  },
  {
    id: 'C6', relatedCards: ['sleep'], type: 'change_detection', emoji: '😴', label: '변화',
    check(data) {
      const last14 = data.days.slice(0, 14).filter(d => d.sleep > 0);
      if (last14.length < 7) return null;
      const avg = last14.reduce((s, d) => s + d.sleep, 0) / last14.length;
      const variance = last14.reduce((s, d) => s + Math.pow(d.sleep - avg, 2), 0) / last14.length;
      const stdDev = Math.sqrt(variance) * 60;
      if (stdDev <= 30) return { avgH: avg.toFixed(1) };
      return null;
    },
    message(r) { return `수면 시간이 일정해지셨네요! 지난 2주 평균 ${r.avgH}시간 근처에서 잘 유지하고 계세요 🌙 이런 일관성이 컨디션 안정의 핵심이라 곧 효과를 느끼실 거예요.`; },
  },

  // D. 긍정 강화 (4개)
  {
    id: 'D1', relatedCards: ['water'], type: 'positive', emoji: '✨', label: '잘하셨어요',
    check(data) {
      let streak = 0;
      for (const d of data.days) {
        if (d.waterMl >= d.waterGoalMl) streak++; else break;
      }
      if (streak >= 5) return { streak };
      return null;
    },
    message(r) { return `물 ${r.streak}일 연속 목표 달성이에요! 평소보다 더 꾸준히 챙기셨네요 ✨ 이 페이스로 한 달만 유지해도 피부·컨디션 변화가 확 느껴질 거예요.`; },
  },
  {
    id: 'D2', relatedCards: ['supplement'], type: 'positive', emoji: '💊', label: '잘하셨어요',
    check(data) {
      if (data.suppItems.length === 0) return null;
      let streak = 0;
      for (const d of data.days) {
        if (d.suppTotal > 0 && d.suppDone === d.suppTotal) streak++; else break;
      }
      if (streak >= 5) return { streak };
      return null;
    },
    message(r) { return `영양제 ${r.streak}일 연속 챙기셨네요! 본인만의 루틴을 만드신 듯해요 ✨ 한 달 정도 더 유지하면 본인만의 효과를 발견할 수 있을 거예요.`; },
  },
  {
    id: 'D3', relatedCards: ['skin'], type: 'positive', emoji: '✨', label: '잘하셨어요',
    check(data) {
      const thisHalf = data.days.slice(0, 14).filter(d => d.hasTrouble).length;
      const lastHalf = data.days.slice(14, 28).filter(d => d.hasTrouble).length;
      if (lastHalf >= 3 && thisHalf < lastHalf) {
        return { pct: Math.round((1 - thisHalf / lastHalf) * 100), prev: lastHalf, cur: thisHalf };
      }
      return null;
    },
    message(r) { return `이번 달 트러블이 줄어든 거 보이세요? 지난 달 ${r.prev}일에서 이번 달 ${r.cur}일로 -${r.pct}%나 좋아지셨어요 🫧 이 흐름 유지하면 다음 달엔 더 깨끗한 피부를 만나실 거예요.`; },
  },
  {
    id: 'D4', relatedCards: ['condition'], type: 'positive', emoji: '✨', label: '잘하셨어요',
    check(data) {
      const thisWeek = data.days.slice(0, 7).filter(d => d.condition);
      const lastWeek = data.days.slice(7, 14).filter(d => d.condition);
      if (thisWeek.length < 3 || lastWeek.length < 3) return null;
      const twAvg = thisWeek.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / thisWeek.length;
      const lwAvg = lastWeek.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / lastWeek.length;
      const diff = Math.round(twAvg - lwAvg);
      if (diff >= 5) return { diff };
      return null;
    },
    message(r) { return `이번 달 컨디션이 +${r.diff}점이에요! 잘 챙기고 계세요 ✨ 이대로 한 달만 더 유지하면 본인만의 건강 패턴이 만들어질 거예요.`; },
  },

  // E. 행동 제안 (4개)
  {
    id: 'E1', relatedCards: ['water'], type: 'action', emoji: '💧', label: '제안',
    check(data) {
      const today = data.days[0];
      if (!today) return null;
      const h = new Date().getHours();
      if (h < 10 || h > 20) return null;
      if (today.waterMl < today.waterGoalMl * 0.5 && h >= 14) {
        const avgMl = data.days.slice(1, 8).reduce((s, d) => s + d.waterMl, 0) / 7;
        return { curL: (today.waterMl / 1000).toFixed(1), avgL: (avgMl / 1000).toFixed(1) };
      }
      return null;
    },
    message(r) { return `오늘 수분이 ${r.curL}L로 좀 적네요! 오후에 자주 그러시더라고요 💧 지금 한 잔 마시면 컨디션도 살아나고 저녁까지 가뿐할 거예요.`; },
    action: { label: '물 기록하기', type: 'log_water' },
  },
  {
    id: 'E3', relatedCards: ['caffeine', 'water'], type: 'action', emoji: '☕', label: '제안',
    check(data) {
      const today = data.days[0];
      if (!today || today.totalCafMg === 0) return null;
      const waterNeeded = Math.round(today.totalCafMg * 1.5);
      const cups = Math.ceil(waterNeeded / (data.waterSettings?.cupMl || 250));
      return { cafMg: today.totalCafMg, waterMl: waterNeeded, cups };
    },
    message(r) { return `오늘 카페인 ${r.cafMg}mg 드셨네요! 카페인은 수분을 빼앗아 가서 물 ${r.cups}잔 정도 더 필요해요 ☕ 지금 한 잔 챙기면 오후 컨디션 유지에 도움될 거예요.`; },
    action: { label: '물 기록하기', type: 'log_water' },
  },
  {
    id: 'E4', relatedCards: ['alcohol', 'water'], type: 'action', emoji: '🍺', label: '제안',
    check(data) {
      const today = data.days[0];
      if (!today || today.totalAlcohol === 0) return null;
      const waterNeeded = today.totalAlcohol * 250;
      const cups = Math.ceil(waterNeeded / (data.waterSettings?.cupMl || 250));
      return { drinks: today.totalAlcohol, waterMl: waterNeeded, cups };
    },
    message(r) { return `오늘 술 ${r.drinks}잔 드셨네요! 알코올은 수분을 빼앗아 가서 물 ${r.cups}잔 정도 더 필요해요 🍺 자기 전 물 + 비타민C 챙기면 내일 회복이 빨라질 거예요.`; },
    action: { label: '물 기록하기', type: 'log_water' },
  },
  {
    id: 'E2', relatedCards: ['sleep'], type: 'action', emoji: '🌙', label: '제안',
    check(data) {
      const h = new Date().getHours();
      if (h < 21) return null;
      const yesterday = data.days[1];
      if (yesterday && yesterday.sleep > 0 && yesterday.sleep < 6) return { sleepH: yesterday.sleep };
      return null;
    },
    message(r) { return `오늘은 일찍 자보세요! 어제도 ${r.sleepH}시간만 주무셨고 본인은 7시간 이상 자야 컨디션이 좋아지세요 🌙 지금 자면 내일 컨디션이 확 달라질 거예요.`; },
  },

  // F. 체중 활용 (3개)
  {
    id: 'F1', relatedCards: ['weight', 'water'], type: 'cross_analysis', emoji: '💧', label: '통찰',
    check(data) {
      const last14 = data.days.slice(0, 14).filter(d => d.weight > 0);
      if (last14.length < 5) return null;
      const waterHigh = last14.filter(d => d.waterMl >= d.waterGoalMl);
      const waterLow = last14.filter(d => d.waterMl > 0 && d.waterMl < d.waterGoalMl * 0.5);
      if (waterHigh.length < 2 || waterLow.length < 2) return null;
      const hWeights = waterHigh.map(d => d.weight);
      const lWeights = waterLow.map(d => d.weight);
      const hStd = Math.sqrt(hWeights.reduce((s, w) => s + Math.pow(w - hWeights.reduce((a, b) => a + b, 0) / hWeights.length, 2), 0) / hWeights.length);
      const lStd = Math.sqrt(lWeights.reduce((s, w) => s + Math.pow(w - lWeights.reduce((a, b) => a + b, 0) / lWeights.length, 2), 0) / lWeights.length);
      if (hStd < lStd && lStd - hStd > 0.1) return {};
      return null;
    },
    message() { return `물 충분히 마신 다음날 체중이 안정적이에요! 본인은 수분이 부종에 영향이 큰 편이에요 💧 꾸준히 챙기면 체중 변동도 줄어들 거예요.`; },
  },
  {
    id: 'F2', relatedCards: ['weight', 'cycle'], type: 'pattern', emoji: '🌸', label: '발견',
    check(data) {
      if (!data.cycle) return null;
      const last14 = data.days.slice(0, 14).filter(d => d.weight > 0);
      if (last14.length < 5) return null;
      // 간단화: 최근 체중 증가 + 주기 데이터 존재
      const recent3 = last14.slice(0, 3);
      const prev3 = last14.slice(3, 6);
      if (recent3.length < 2 || prev3.length < 2) return null;
      const rAvg = recent3.reduce((s, d) => s + d.weight, 0) / recent3.length;
      const pAvg = prev3.reduce((s, d) => s + d.weight, 0) / prev3.length;
      const diff = Math.round((rAvg - pAvg) * 10) / 10;
      if (diff >= 0.5) return { diff };
      return null;
    },
    message(r) { return `최근 체중이 +${r.diff}kg 늘었는데 주기 영향일 수 있어요! 호르몬으로 인한 자연스러운 부종이라 걱정 마세요 🌸 생리 시작하면 자연스럽게 빠질 거예요.`; },
  },
  {
    id: 'F3', relatedCards: ['weight', 'meal'], type: 'cross_analysis', emoji: '🍱', label: '통찰',
    check(data) {
      const last14 = data.days.slice(0, 14);
      let matches = 0;
      for (let i = 0; i < last14.length - 1; i++) {
        const foods = safeJSON('lua_food_records', {})[last14[i].date] || [];
        const highSodium = foods.some(f => (f.sodium || 0) > 1000);
        if (highSodium && last14[i + 1].weight > 0 && last14[i].weight > 0 && last14[i + 1].weight - last14[i].weight >= 0.3) {
          matches++;
        }
      }
      if (matches >= 2) return { count: matches };
      return null;
    },
    message(r) { return `짠 음식 드신 다음날 체중이 늘어나는 패턴이에요! ${r.count}번이나 일치했어요 🍱 음식 후 물 한 잔 더 챙기면 부종이 빠르게 빠질 거예요.`; },
  },

  // G. 주기 활용 (4개)
  {
    id: 'G1', relatedCards: ['cycle', 'condition'], type: 'pattern', emoji: '🌸', label: '발견',
    check(data) {
      if (!data.cycle) return null;
      // 주기 데이터 있고 컨디션 데이터 있는 날
      const withCond = data.days.slice(0, 14).filter(d => d.condition);
      if (withCond.length < 5) return null;
      const avgEnergy = withCond.reduce((s, d) => s + d.condition.energy, 0) / withCond.length;
      const lowDays = withCond.filter(d => d.condition.energy <= avgEnergy - 2);
      if (lowDays.length >= 3) return { drop: Math.round(avgEnergy - lowDays.reduce((s, d) => s + d.condition.energy, 0) / lowDays.length) };
      return null;
    },
    message(r) { return `주기에 따라 컨디션이 -${r.drop}점 차이가 나요! 호르몬 영향이 큰 듯한데 본인만의 사이클이에요 🌸 이 시기엔 일찍 자고 마그네슘 챙기면 도움이 될 거예요.`; },
  },
  {
    id: 'G2', relatedCards: ['cycle', 'caffeine', 'sleep'], type: 'pattern', emoji: '☕', label: '발견',
    check(data) {
      if (!data.cycle) return null;
      const last14 = data.days.slice(0, 14).filter(d => d.totalCafMg > 0 && d.sleep > 0);
      if (last14.length < 5) return null;
      const cafDays = last14.filter(d => d.totalCafMg > 150 && d.sleep < 6);
      if (cafDays.length >= 3) return { count: cafDays.length };
      return null;
    },
    message(r) { return `주기에 따라 카페인 영향이 더 커지시는 듯해요! 최근 ${r.count}번 카페인 많은 날 잠이 짧아졌어요 ☕ 이 시기만이라도 오후 카페인 줄여보세요.`; },
  },
  {
    id: 'G3', relatedCards: ['cycle', 'meal'], type: 'pattern', emoji: '🍰', label: '발견',
    check(data) {
      if (!data.cycle) return null;
      const last7 = data.days.slice(0, 7).filter(d => d.foodCount > 0);
      const prev7 = data.days.slice(7, 14).filter(d => d.foodCount > 0);
      if (last7.length < 3 || prev7.length < 3) return null;
      const rKcal = last7.reduce((s, d) => s + d.totalKcal, 0) / last7.length;
      const pKcal = prev7.reduce((s, d) => s + d.totalKcal, 0) / prev7.length;
      if (rKcal > pKcal * 1.2 && pKcal > 0) {
        return { pct: Math.round((rKcal / pKcal - 1) * 100) };
      }
      return null;
    },
    message(r) { return `주기에 따라 먹는 양이 평소보다 +${r.pct}% 늘었어요! 자연스러운 호르몬 영향이에요 🍰 견과류나 과일로 대체하면 컨디션이 더 좋아질 거예요.`; },
  },
  {
    id: 'G4', relatedCards: ['cycle', 'sleep'], type: 'pattern', emoji: '🌙', label: '발견',
    check(data) {
      if (!data.cycle) return null;
      const last7 = data.days.slice(0, 7).filter(d => d.sleep > 0);
      const prev7 = data.days.slice(7, 14).filter(d => d.sleep > 0);
      if (last7.length < 3 || prev7.length < 3) return null;
      const rSleep = last7.reduce((s, d) => s + d.sleep, 0) / last7.length;
      const pSleep = prev7.reduce((s, d) => s + d.sleep, 0) / prev7.length;
      const diffMin = Math.round((rSleep - pSleep) * 60);
      if (Math.abs(diffMin) >= 30) return { diff: Math.abs(diffMin), dir: diffMin < 0 ? '짧아지' : '길어지' };
      return null;
    },
    message(r) { return `주기에 따라 잠이 ${r.dir}시는 패턴이에요! ${r.diff}분이나 차이가 나요 🌙 본인 몸이 호르몬에 반응하는 자연스러운 신호니 마그네슘 + 일찍 자기로 보완해보세요.`; },
  },

  // H. 날씨 활용 (4개)
  {
    id: 'H1', relatedCards: ['weather', 'skin'], type: 'cross_analysis', emoji: '☀️', label: '통찰',
    check(data) {
      if (!data.weather || data.weather.uv < 6) return null;
      const last7 = data.days.slice(0, 7);
      const troubleAfterUV = last7.filter(d => d.hasTrouble).length;
      if (troubleAfterUV >= 2) return { uv: data.weather.uv, count: troubleAfterUV };
      return null;
    },
    message(r) { return `자외선이 강한 날 피부 트러블이 자주 와요! 최근 7일 중 ${r.count}번 일치했어요 ☀️ 외출 후 진정 케어를 챙기면 영향을 줄일 수 있어요.`; },
  },
  {
    id: 'H2', relatedCards: ['weather', 'skin', 'water'], type: 'cross_analysis', emoji: '💧', label: '통찰',
    check(data) {
      if (!data.weather || data.weather.humidity > 40) return null;
      const last7 = data.days.slice(0, 7);
      const dryDays = last7.filter(d => d.hasDry).length;
      if (dryDays >= 2) return { humidity: data.weather.humidity };
      return null;
    },
    message(r) { return `건조한 날엔 피부 컨디션이 떨어지시는 듯해요! 습도 ${r.humidity}% 미만일 때 자주 그러시더라고요 💧 이런 날엔 수분을 +200ml 더 챙기면 피부가 좋아질 거예요.`; },
  },
  {
    id: 'H3', relatedCards: ['weather', 'condition'], type: 'cross_analysis', emoji: '🌡️', label: '통찰',
    check(data) {
      if (!data.weather) return null;
      const tempDiff = data.weather.tempMax - data.weather.tempMin;
      if (tempDiff < 10) return null;
      const today = data.days[0];
      if (!today?.condition) return null;
      const avg = (today.condition.energy + today.condition.mood) / 2;
      if (avg <= 5) return { diff: Math.round(tempDiff), drop: Math.round(10 - avg) };
      return null;
    },
    message(r) { return `일교차가 ${r.diff}도나 큰 날이에요! 본인은 온도 변화에 민감한 편이에요 🌡️ 이런 날엔 따뜻한 차 한 잔이 컨디션 회복에 도움이 될 거예요.`; },
  },
  {
    id: 'H4', relatedCards: ['weather', 'water'], type: 'action', emoji: '☀️', label: '제안',
    check(data) {
      if (!data.weather) return null;
      const hot = data.weather.temp >= 28 || data.weather.uv >= 8;
      if (!hot) return null;
      const today = data.days[0];
      if (!today || today.waterMl >= today.waterGoalMl) return null;
      const curL = (today.waterMl / 1000).toFixed(1);
      const needL = ((today.waterGoalMl + 500) / 1000).toFixed(1);
      return { curL, needL, reason: data.weather.uv >= 8 ? '자외선이 강하고' : `${Math.round(data.weather.temp)}도라` };
    },
    message(r) { return `오늘 ${r.reason} 평소보다 수분이 더 필요해요! 지금 ${r.curL}L 드셨는데 ${r.needL}L가 적정이에요 💧 한 잔 더 챙기면 컨디션도 살아날 거예요.`; },
    action: { label: '물 기록하기', type: 'log_water' },
  },

  // I. 식사 GI 영향 (1개)
  {
    id: 'I1', relatedCards: ['meal', 'condition'], type: 'cross_analysis', emoji: '🍚', label: '통찰',
    check(data) {
      const last7 = data.days.slice(0, 7).filter(d => d.foodCount > 0 && d.condition);
      if (last7.length < 4) return null;
      const foods = safeJSON('lua_food_records', {});
      let highGiLow = 0;
      for (const d of last7) {
        const dayFoods = foods[d.date] || [];
        const hasHighGi = dayFoods.some(f => {
          const name = (f.name || '').toLowerCase();
          return name.includes('흰밥') || name.includes('면') || name.includes('빵') || name.includes('떡') || name.includes('라면');
        });
        if (hasHighGi && d.condition.energy <= 5) highGiLow++;
      }
      if (highGiLow >= 2) return { count: highGiLow };
      return null;
    },
    message(r) { return `고GI 음식 드신 후 컨디션이 떨어지시는 패턴이에요! 흰밥·면 위주로 드신 날 ${r.count}번이나 그랬어요 🍚 잡곡밥이나 채소 비율 늘리면 식후 활력이 유지될 거예요.`; },
  },

  // J. 오늘 데이터 즉시 인사이트 (데이터 적어도 바로 표시)
  {
    id: 'J1', relatedCards: ['weight'], type: 'positive', emoji: '⚖️', label: '체중',
    check(data) {
      const today = data.days[0];
      if (!today || today.weight <= 0) return null;
      const yesterday = data.days[1];
      if (yesterday && yesterday.weight > 0) {
        const diff = Math.round((today.weight - yesterday.weight) * 10) / 10;
        return { weight: today.weight, diff, hasPrev: true };
      }
      return { weight: today.weight, diff: 0, hasPrev: false };
    },
    message(r) {
      if (r.hasPrev && r.diff !== 0) {
        const dir = r.diff > 0 ? '+' : '';
        return `오늘 체중 ${r.weight}kg이에요! 어제보다 ${dir}${r.diff}kg ${r.diff > 0 ? '늘었는데' : '줄었는데'} 하루 변동은 자연스러운 거예요 ⚖️ 꾸준히 기록하면 본인만의 추세가 보일 거예요.`;
      }
      return `오늘 체중 ${r.weight}kg 기록하셨네요! ⚖️ 매일 같은 시간에 재면 더 정확한 추세를 확인할 수 있어요.`;
    },
  },
  {
    id: 'J2', relatedCards: ['meal'], type: 'positive', emoji: '🍱', label: '식사',
    check(data) {
      const today = data.days[0];
      if (!today || today.foodCount === 0) return null;
      return { count: today.foodCount, kcal: today.totalKcal, protein: today.totalProtein };
    },
    message(r) {
      const parts = [`${r.count}끼`];
      if (r.kcal > 0) parts.push(`${r.kcal}kcal`);
      if (r.protein > 0) parts.push(`단백질 ${r.protein}g`);
      if (r.protein >= 50) return `오늘 ${parts.join(' · ')} 기록이에요! 단백질을 잘 챙기고 계세요 💪 이 정도면 활력 유지에 충분해요.`;
      if (r.kcal > 0) return `오늘 ${parts.join(' · ')} 드셨네요! 🍱 식사 기록이 쌓이면 본인한테 맞는 식단 패턴을 발견할 수 있어요.`;
      return `오늘 ${r.count}끼 기록하셨네요! 🍱 뭘 드셨는지 기록해두면 나중에 컨디션과의 관계를 발견할 수 있어요.`;
    },
  },
  {
    id: 'J3', relatedCards: ['weather'], type: 'positive', emoji: '🌤️', label: '날씨',
    check(data) {
      if (!data.weather) return null;
      const w = data.weather;
      if (w.temp === 0 && w.humidity === 0) return null;
      return { temp: Math.round(w.temp), humidity: w.humidity, uv: w.uv, tempMax: w.tempMax, tempMin: w.tempMin };
    },
    message(r) {
      const diff = r.tempMax - r.tempMin;
      if (r.uv >= 6) return `오늘 자외선 지수 ${r.uv}이에요! ☀️ 외출 시 자외선 차단 꼭 챙기시고 돌아와서 진정 케어 해주세요.`;
      if (r.humidity < 40) return `오늘 습도 ${r.humidity}%로 건조해요! 💧 수분을 평소보다 한 잔 더 챙기면 피부도 컨디션도 좋아질 거예요.`;
      if (diff >= 10) return `오늘 일교차가 ${Math.round(diff)}도예요! 🌡️ 큰 기온차에 본인 몸이 적응하느라 에너지를 쓰니 따뜻한 차 한 잔 챙기세요.`;
      return `오늘 ${r.temp}도, 습도 ${r.humidity}%에요! 🌤️ 날씨 기록이 쌓이면 본인 피부와 날씨의 관계를 발견할 수 있어요.`;
    },
  },
  {
    id: 'J4', relatedCards: ['condition'], type: 'positive', emoji: '✨', label: '컨디션',
    check(data) {
      const today = data.days[0];
      if (!today?.condition) return null;
      const avg = (today.condition.energy + today.condition.mood + today.condition.skin + today.condition.gut) / 4;
      return { avg: Math.round(avg * 10) / 10, energy: today.condition.energy, mood: today.condition.mood, skin: today.condition.skin, gut: today.condition.gut };
    },
    message(r) {
      const best = [
        { name: '에너지', val: r.energy }, { name: '기분', val: r.mood },
        { name: '피부', val: r.skin }, { name: '소화', val: r.gut },
      ].sort((a, b) => b.val - a.val)[0];
      const worst = [
        { name: '에너지', val: r.energy }, { name: '기분', val: r.mood },
        { name: '피부', val: r.skin }, { name: '소화', val: r.gut },
      ].sort((a, b) => a.val - b.val)[0];
      if (r.avg >= 7) return `오늘 컨디션 ${r.avg}점으로 좋은 날이에요! 특히 ${best.name}이 ${best.val}점으로 높네요 ✨ 오늘 뭘 잘 챙겼는지 기록해두면 비결을 발견할 수 있어요.`;
      if (r.avg <= 4) return `오늘 컨디션이 좀 힘든 날인 듯해요! ${worst.name}이 ${worst.val}점이네요 🌿 무리하지 말고 수분이랑 충분한 수면 챙기세요.`;
      return `오늘 컨디션 ${r.avg}점이에요! ${best.name} ${best.val}점이 가장 좋네요 🌿 꾸준히 체크하면 본인만의 컨디션 패턴을 발견할 수 있어요.`;
    },
  },
  {
    id: 'J5', relatedCards: ['activity'], type: 'positive', emoji: '🏃', label: '활동',
    check(data) {
      const today = data.days[0];
      if (!today) return null;
      if (today.hasExercise) {
        const exercises = Object.keys(today.exercise);
        return { type: 'exercise', names: exercises.slice(0, 2).join(' · '), steps: today.steps };
      }
      if (today.steps >= 3000) return { type: 'steps', steps: today.steps };
      return null;
    },
    message(r) {
      if (r.type === 'exercise') {
        const msg = `오늘 ${r.names} 하셨네요! 🏃 운동 기록이 쌓이면 컨디션과의 관계를 분석해드릴게요.`;
        return r.steps > 0 ? `${r.steps.toLocaleString()}보 걸으시고 ${r.names}도 하셨네요! 🏃 활동적인 하루예요. 운동 후 수분 챙기면 회복이 빨라져요.` : msg;
      }
      return `오늘 ${r.steps.toLocaleString()}보 걸으셨네요! 🚶 ${r.steps >= 8000 ? '목표 달성이에요! 꾸준한 걷기가 컨디션에 긍정적인 영향을 줘요.' : '조금만 더 걸으면 활력이 올라갈 거예요.'}`;
    },
  },
  {
    id: 'J6', relatedCards: ['sleep'], type: 'positive', emoji: '😴', label: '수면',
    check(data) {
      const today = data.days[0];
      if (!today || today.sleep <= 0) return null;
      return { hours: today.sleep, quality: today.sleepQuality, bedtime: today.bedtime };
    },
    message(r) {
      if (r.hours >= 8) return `오늘 ${r.hours}시간 푹 주무셨네요! 😴 충분한 수면이 하루 컨디션의 기반이에요. 이 리듬 유지하면 좋겠어요.`;
      if (r.hours >= 6) return `오늘 수면 ${r.hours}시간이에요! 적당히 주무셨네요 🌙 30분만 더 자면 다음날 활력이 확 달라질 수 있어요.`;
      return `오늘 ${r.hours}시간밖에 못 주무셨네요! 😴 수면 부족은 컨디션에 바로 영향이 와요. 오늘은 일찍 쉬어보세요.`;
    },
  },
];

// ===== 점수 계산 =====
function calculateScore(template, result) {
  const typeScores = {
    pattern: { uniqueness: 8, recency: 6, actionability: 4, emotional: 5 },
    cross_analysis: { uniqueness: 9, recency: 7, actionability: 5, emotional: 6 },
    change_detection: { uniqueness: 7, recency: 9, actionability: 5, emotional: 5 },
    positive: { uniqueness: 5, recency: 6, actionability: 3, emotional: 9 },
    action: { uniqueness: 3, recency: 10, actionability: 10, emotional: 4 },
  };
  const s = typeScores[template.type] || typeScores.pattern;
  return s.uniqueness * 0.4 + s.recency * 0.25 + s.actionability * 0.2 + s.emotional * 0.15;
}

// ===== 캐시 + 반복 방지 =====
function getShownHistory() {
  try { return JSON.parse(localStorage.getItem('lua_insight_shown') || '{}'); } catch { return {}; }
}

export function markShown(templateId) {
  const h = getShownHistory();
  h[templateId] = new Date().toISOString();
  localStorage.setItem('lua_insight_shown', JSON.stringify(h));
  sessionShownIds.push(templateId);
}

function wasActedOn(templateId) {
  const h = getShownHistory();
  const lastActed = h[templateId];
  if (!lastActed) return false;
  const diff = (new Date() - new Date(lastActed)) / (1000 * 60 * 60 * 24);
  return diff < ACTION_COOLDOWN_DAYS;
}

// ===== Fallback 시스템 (v3.1) =====
let fallbackRotation = 0;

function generateFallback(data) {
  const today = data.days[0] || {};
  const yesterday = data.days[1] || {};
  const fbId = `fb_${Date.now()}`; // 매번 고유 id → 세션 중복 방지

  // Fallback 4: 데이터 부족
  if (data.activeDays < 7) {
    const msgs = [
      `더 기록해주시면 본인만의 패턴 발견을 도와드릴게요! 현재 ${data.activeDays}일 기록 중이에요 📝 30일 차에는 본인만의 영향 요인 분석도 보여드릴 수 있어요.`,
      `기록이 쌓일수록 더 정확한 인사이트를 드릴 수 있어요! 현재 ${data.activeDays}일차 📝 오늘 컨디션이나 수분부터 기록해보세요.`,
      `아직 ${data.activeDays}일 기록이에요! 매일 조금씩 기록하면 본인만의 건강 패턴이 보이기 시작해요 🌱 작은 기록이 큰 발견으로 이어져요.`,
    ];
    const msg = msgs[fallbackRotation % msgs.length];
    fallbackRotation++;
    return { id: fbId, type: 'fallback', emoji: '✨', label: '', message: msg, score: 0 };
  }

  // Fallback 3: 회복 중인 날
  if (yesterday.condition && today.condition) {
    const yAvg = (yesterday.condition.energy + yesterday.condition.mood) / 2;
    const tAvg = (today.condition.energy + today.condition.mood) / 2;
    if (yAvg <= 4 && tAvg - yAvg >= 3) {
      const improved = [];
      if (today.waterMl > yesterday.waterMl && today.waterMl > 0) improved.push(`수분 ${(today.waterMl / 1000).toFixed(1)}L`);
      if (today.sleep > yesterday.sleep && today.sleep > 0) improved.push(`수면 ${today.sleep}시간`);
      const what = improved.length > 0 ? improved.join(' · ') + ' 챙기신 덕분인 듯해요' : '몸이 회복하고 있는 듯해요';
      return {
        id: fbId, type: 'fallback', emoji: '✨', label: '회복',
        message: `어제보다 컨디션이 +${Math.round(tAvg - yAvg)}점이나 좋아졌어요! ${what} ✨ 본인 몸의 회복력이 좋은 신호니 오늘은 무리하지 마세요.`,
        score: 0,
      };
    }
  }

  // Fallback 1: 잘 챙긴 날
  const positives = [];
  if (today.waterMl >= today.waterGoalMl) positives.push(`수분 ${(today.waterMl / 1000).toFixed(1)}L`);
  if (today.sleep >= 7) positives.push(`수면 ${today.sleep}시간`);
  if (today.foodCount > 0) positives.push('식사 기록');
  if (today.totalCafMg > 0 && today.totalCafMg <= 300) positives.push('카페인 적당');
  if (today.suppTotal > 0 && today.suppDone === today.suppTotal) positives.push('영양제 완료');
  if (today.hasExercise) positives.push('운동');

  if (positives.length >= 3) {
    return {
      id: fbId, type: 'fallback', emoji: '✨', label: '',
      message: `오늘 잘 보내고 계세요! ${positives.slice(0, 3).join(' · ')} 다 챙기셨네요 ✨ 이런 날들이 쌓이면 본인만의 건강 패턴이 만들어질 거예요`,
      score: 0,
    };
  }

  // Fallback 2: 보통 날
  const facts = [];
  if (today.sleep > 0) facts.push(`수면 ${today.sleep}시간`);
  if (today.waterMl > 0) facts.push(`수분 ${(today.waterMl / 1000).toFixed(1)}L`);
  if (today.totalCafMg > 0) facts.push(`카페인 ${today.totalCafMg}mg`);
  if (today.foodCount > 0) facts.push(`식사 ${today.foodCount}끼`);
  if (today.steps > 0) facts.push(`${today.steps.toLocaleString()}보`);
  if (today.weight > 0) facts.push(`체중 ${today.weight}kg`);
  if (today.hasExercise) facts.push('운동 완료');
  if (today.suppDone > 0) facts.push(`영양제 ${today.suppDone}개`);
  if (data.weather?.temp) facts.push(`${Math.round(data.weather.temp)}도`);

  if (facts.length >= 2) {
    // 매번 다른 조합을 보여주기 위해 셔플
    for (let i = facts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [facts[i], facts[j]] = [facts[j], facts[i]];
    }
    const pair = facts.slice(0, 2).join(' · ');
    const normalMsgs = [
      `오늘 ${pair}이에요! 평소와 비슷한 하루 보내고 계세요 🌿 일관된 루틴이 본인 몸에 안정감을 주는 신호예요`,
      `${pair} 기록이 보여요! 꾸준히 챙기고 계시네요 ✨ 이런 루틴이 쌓이면 건강 변화를 느끼실 거예요`,
      `오늘도 ${pair} 체크 완료! 매일 기록하는 것 자체가 건강 관리의 시작이에요 🌱`,
    ];
    const msg = normalMsgs[fallbackRotation % normalMsgs.length];
    fallbackRotation++;
    return { id: fbId, type: 'fallback', emoji: '✨', label: '', message: msg, score: 0 };
  }

  // 최종 Fallback: 시간대별 다양한 메시지 순환
  const h = new Date().getHours();
  const allMessages = [
    h < 12 ? `좋은 아침이에요! 오늘 컨디션이나 수분부터 기록해보세요 📝 기록이 쌓일수록 본인만의 패턴을 발견할 수 있어요.`
    : h < 18 ? `오후도 잘 보내고 계세요! 지금까지 뭘 먹고 마셨는지 기록해두면 나중에 재밌는 패턴이 보일 거예요 📝`
    : `수고하셨어요! 오늘 하루 어땠는지 기록 남겨두시면 본인만의 건강 패턴을 만들어드릴게요 🌙`,
    h < 12 ? `아직 오전이에요! 오늘 첫 수분 기록부터 시작해볼까요? 💧 작은 기록이 큰 변화를 만들어요.`
    : h < 18 ? `지금 잠깐 컨디션 체크 해보세요! 본인 몸의 신호를 알아가는 첫 걸음이에요 🌱`
    : `하루를 마무리하며 오늘의 컨디션을 남겨보세요 🌙 내일의 본인에게 보내는 메모가 될 거예요.`,
    h < 12 ? `오늘은 어떤 하루가 될까요? 먼저 컨디션 체크부터 해보세요 ☀️ 매일 기록하면 놀라운 패턴이 보여요.`
    : h < 18 ? `오후에는 수분 섭취가 줄어들기 쉬워요! 물 한 잔 마시고 기록해보세요 💧`
    : `오늘 하루 수고하셨어요! 내일 더 좋은 하루를 위해 오늘의 기록을 남겨보세요 ✨`,
  ];
  const msg = allMessages[fallbackRotation % allMessages.length];
  fallbackRotation++;
  return {
    id: fbId, type: 'fallback', emoji: '✨', label: '',
    message: msg,
    score: 0,
  };
}

// ===== 메인 API =====
export function generateDailyInsights() {
  const data = collectUserData(30);

  // 모든 템플릿 검사
  const candidates = [];
  for (const t of TEMPLATES) {
    if (wasActedOn(t.id)) continue;
    const result = t.check(data);
    if (result) {
      candidates.push({
        id: t.id, type: t.type, emoji: t.emoji, label: t.label,
        message: t.message(result),
        score: calculateScore(t, result),
        action: t.action || null,
        relatedCards: t.relatedCards || [],
      });
    }
  }

  // 세션에서 이미 본 인사이트 점수 하락 + 카드 다양성
  const sessionShownCards = [];
  sessionShownIds.forEach(id => {
    const t = TEMPLATES.find(t => t.id === id);
    if (t?.relatedCards) sessionShownCards.push(...t.relatedCards);
  });

  // 아직 안 본 인사이트가 있으면 본 것 점수를 크게 떨어뜨림
  const unseenExists = candidates.some(c => !sessionShownIds.includes(c.id));
  candidates.forEach(c => {
    if (sessionShownIds.includes(c.id)) {
      c.score *= unseenExists ? 0.05 : 0.3;
    }
    const overlap = c.relatedCards.filter(card => sessionShownCards.includes(card));
    if (overlap.length > 0) c.score *= 0.5;
  });

  // 모든 candidates를 이미 본 경우 → fallback 섞어서 다양성 확보
  if (candidates.length > 0 && !unseenExists) {
    const fb = generateFallback(data);
    candidates.push({ ...fb, score: candidates[0].score + 10 }); // fallback 우선
  }

  // 랜덤 셔플로 같은 점수대 인사이트 순서 변경
  candidates.forEach(c => { c.score += Math.random() * c.score * 0.5; });

  const feedback = safeJSON(FEEDBACK_KEY, {});
  candidates.forEach(c => {
    const fb = feedback[c.id];
    if (fb === 'not_helpful') c.score *= 0.5;
    if (fb === 'helpful') c.score *= 1.3;
  });

  candidates.sort((a, b) => b.score - a.score);

  // 부정적 인사이트 1개 한도
  let negCount = 0;
  const filtered = candidates.filter(c => {
    if (c.type === 'change_detection' && c.message.includes('-')) { negCount++; return negCount <= 1; }
    return true;
  });

  // 최대 3개, 타입 다양성
  const selected = [];
  const usedTypes = new Set();
  for (const c of filtered) {
    if (selected.length >= MAX_PER_DAY) break;
    if (selected.length > 0 && usedTypes.has(c.type)) continue;
    selected.push(c); usedTypes.add(c.type);
  }
  if (selected.length < MAX_PER_DAY) {
    for (const c of filtered) {
      if (selected.length >= MAX_PER_DAY) break;
      if (!selected.find(s => s.id === c.id)) selected.push(c);
    }
  }

  // Fallback (v2: 데이터 기반, 단순 메시지 X)
  if (selected.length === 0) {
    selected.push(generateFallback(data));
  }

  // 세션 추적
  if (selected.length > 0) {
    selected[0].isMain = true;
    selected.forEach(s => { if (!sessionShownIds.includes(s.id)) sessionShownIds.push(s.id); });
  }

  // 세션 순환: 모든 candidates를 다 봤으면 리셋
  if (candidates.length > 0) {
    const unseenCount = candidates.filter(c => !sessionShownIds.includes(c.id)).length;
    if (unseenCount === 0) sessionShownIds = [];
  }

  return selected;
}

// ===== 캐시 관리 =====
export function getCachedInsights() {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cache && cache.date === getDateKey(new Date())) return cache.insights;
    return null;
  } catch { return null; }
}

export function cacheInsights(insights) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({
    date: getDateKey(new Date()), insights, generatedAt: new Date().toISOString(),
  }));
}

export function getOrGenerateInsights() {
  // Phase 2: LLM 인사이트 우선
  if (isLLMEnabled()) {
    const llmInsights = getLLMInsights();
    if (llmInsights && llmInsights.length > 0) {
      console.log('[Insight] LLM 캐시 사용 중 (isLLM: true)');
      return llmInsights;
    }
  }
  // Phase 1 폴백: 템플릿 기반
  console.log('[Insight] 템플릿 폴백 사용');
  const insights = generateDailyInsights();
  cacheInsights(insights);
  return insights;
}

export function refreshInsights() {
  // Phase 2: LLM 캐시 순환 우선
  if (isLLMEnabled()) {
    const llmInsight = onLLMRefresh();
    if (llmInsight) {
      const llmInsights = getLLMInsights();
      if (llmInsights && llmInsights.length > 0) return llmInsights;
    }
  }
  // Phase 1 폴백: 템플릿 재생성
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cache?.insights) {
      cache.insights.forEach(ins => {
        if (ins.id && !sessionShownIds.includes(ins.id)) sessionShownIds.push(ins.id);
      });
    }
  } catch { /* ignore */ }
  localStorage.removeItem(CACHE_KEY);
  return getOrGenerateInsights();
}

// ===== Phase 2: LLM 트리거 (데이터 입력 시 호출) =====
export async function triggerLLMOnDataInput(dataType, inputData = null) {
  if (!isLLMEnabled()) return null;
  try {
    const result = await onMeaningfulDataInput(dataType, inputData);
    if (result) {
      // LLM 성공 → 이벤트 발행 (UI 갱신)
      window.dispatchEvent(new CustomEvent('lua-llm-insight-ready', { detail: result }));
      return result;
    }
  } catch (err) {
    console.error('LLM trigger failed:', err);
  }
  return null;
}
