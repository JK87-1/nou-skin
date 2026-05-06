/**
 * lua 인사이트 엔진 (Phase 1)
 * 30개 템플릿 + 트리거 + 점수 + 우선순위
 * lua 페르소나 100% 적용
 */

const CACHE_KEY = 'lua_insight_cache';
const FEEDBACK_KEY = 'lua_insight_feedback';
const MIN_USER_DAYS = 7;
const MAX_PER_DAY = 3;
const REPEAT_COOLDOWN_DAYS = 7;

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
      suppDone, suppTotal,
    });
  }

  // 사용일수 계산
  const activeDays = data.days.filter(d => d.sleep > 0 || d.waterCups > 0 || d.foodCount > 0 || d.condition).length;
  data.activeDays = activeDays;
  data.hasEnoughData = activeDays >= MIN_USER_DAYS;

  return data;
}

function safeJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
}

// ===== 30개 인사이트 템플릿 =====
const TEMPLATES = [
  // A. 패턴 발견 (10개)
  {
    id: 'A1', type: 'pattern', emoji: '🔍', label: '발견',
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
          return { dayName: DAY_NAMES[dow] };
        }
      }
      return null;
    },
    message(r) { return `${r.dayName}요일마다 수분 부족 패턴이에요. 회의 많으세요?`; },
  },
  {
    id: 'A2', type: 'pattern', emoji: '☕', label: '발견',
    check(data) {
      const recent = data.days.slice(0, 14).filter(d => d.totalCafMg > 0);
      if (recent.length < 5) return null;
      // 오후 카페인 비율
      const afternoonDays = recent.filter(d => d.caffeineItems.some(c => {
        const h = c.time ? parseInt(c.time.split(':')[0]) : 14;
        return h >= 14;
      }));
      if (afternoonDays.length / recent.length >= 0.6) return { pct: Math.round(afternoonDays.length / recent.length * 100) };
      return null;
    },
    message() { return '오후 3시쯤 한 잔 더 챙기시는 패턴이에요'; },
  },
  {
    id: 'A4', type: 'pattern', emoji: '😴', label: '발견',
    check(data) {
      const last28 = data.days.slice(0, 28).filter(d => d.sleep > 0);
      if (last28.length < 10) return null;
      const weekday = last28.filter(d => d.dayOfWeek >= 1 && d.dayOfWeek <= 5);
      const weekend = last28.filter(d => d.dayOfWeek === 0 || d.dayOfWeek === 6);
      if (weekday.length < 5 || weekend.length < 3) return null;
      const wdAvg = weekday.reduce((s, d) => s + d.sleep, 0) / weekday.length;
      const weAvg = weekend.reduce((s, d) => s + d.sleep, 0) / weekend.length;
      if (weAvg - wdAvg >= 1) return { diff: Math.round((weAvg - wdAvg) * 10) / 10 };
      return null;
    },
    message(r) { return `주말마다 수면 +${r.diff}시간 패턴이에요. 평일에 좀 피곤하신 듯`; },
  },
  {
    id: 'A5', type: 'pattern', emoji: '✨', label: '발견',
    check(data) {
      // PMS + 트러블 연관 (주기 데이터 필요)
      const troubleDays = data.days.slice(0, 30).filter(d => d.hasTrouble);
      if (troubleDays.length < 2) return null;
      // 단순화: 트러블이 특정 주기로 반복되는지
      return null; // Phase 2에서 주기 연동 시 활성화
    },
    message() { return '이번 달 트러블이 비슷한 시기에 반복되네요'; },
  },
  {
    id: 'A6', type: 'pattern', emoji: '🍺', label: '발견',
    check(data) {
      const last21 = data.days.slice(0, 21);
      let matches = 0;
      for (let i = 0; i < last21.length - 1; i++) {
        if (last21[i].totalAlcohol > 0 && last21[i + 1].hasTrouble) matches++;
      }
      if (matches >= 2) return { count: matches };
      return null;
    },
    message(r) { return `술 마신 다음날 트러블 패턴, ${r.count}번째예요`; },
  },
  {
    id: 'A8', type: 'pattern', emoji: '🏃', label: '발견',
    check(data) {
      const last14 = data.days.slice(0, 14);
      const exDays = last14.filter(d => d.hasExercise && d.condition);
      const noExDays = last14.filter(d => !d.hasExercise && d.condition);
      if (exDays.length < 3 || noExDays.length < 3) return null;
      const exAvg = exDays.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / exDays.length;
      const noExAvg = noExDays.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / noExDays.length;
      const diff = Math.round(exAvg - noExAvg);
      if (diff >= 5) return { diff };
      return null;
    },
    message(r) { return `운동한 날 컨디션 +${r.diff}점 평균이에요`; },
  },
  {
    id: 'A9', type: 'pattern', emoji: '☕', label: '발견',
    check(data) {
      const last14 = data.days.slice(0, 14);
      let lateCafShortSleep = 0;
      for (let i = 0; i < last14.length - 1; i++) {
        if (last14[i].totalCafMg > 100) {
          const nextSleep = last14[i + 1]?.sleep || 0; // 주의: days가 역순
          // 역순이므로 i가 더 최근, i+1이 더 과거 — 실제로는 당일 카페인 → 당일 수면
          if (last14[i].sleep > 0 && last14[i].sleep < 6) lateCafShortSleep++;
        }
      }
      if (lateCafShortSleep >= 3) return {};
      return null;
    },
    message() { return '카페인 많은 날 잠이 짧아지는 패턴이 보이네요'; },
  },
  {
    id: 'A10', type: 'pattern', emoji: '😰', label: '발견',
    check(data) {
      const last14 = data.days.slice(0, 14).filter(d => d.condition && d.foodCount > 0);
      if (last14.length < 5) return null;
      const stressHigh = last14.filter(d => d.condition.mood <= 4 && d.totalKcal > 0);
      if (stressHigh.length >= 3) return {};
      return null;
    },
    message() { return '기분 낮은 날 먹는 양이 늘어나는 듯해요. 그럴 수 있어요'; },
  },
  // 패턴 A3, A7은 주기/식단 상세 데이터 필요 → Phase 2

  // B. 교차 분석 (8개)
  {
    id: 'B1', type: 'cross_analysis', emoji: '💡', label: '통찰',
    check(data) {
      const yesterday = data.days[1];
      const today = data.days[0];
      if (!yesterday || yesterday.totalCafMg < 100) return null;
      if (!today || today.sleep === 0 || today.sleep >= 7) return null;
      return { cafMg: yesterday.totalCafMg, sleepH: today.sleep };
    },
    message(r) { return `어제 카페인 ${r.cafMg}mg → 오늘 수면 ${r.sleepH}시간. 영향일 수도 있어요`; },
  },
  {
    id: 'B2', type: 'cross_analysis', emoji: '💡', label: '통찰',
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
    message(r) { return `물 충분히 마신 날 컨디션 +${r.diff}점이에요. 물이 꽤 도움되는 듯`; },
  },
  {
    id: 'B3', type: 'cross_analysis', emoji: '💡', label: '통찰',
    check(data) {
      const last14 = data.days.slice(0, 14).filter(d => d.sleep > 0);
      const exDays = last14.filter(d => d.hasExercise);
      const noExDays = last14.filter(d => !d.hasExercise);
      if (exDays.length < 3 || noExDays.length < 3) return null;
      const exSleep = exDays.reduce((s, d) => s + d.sleep, 0) / exDays.length;
      const noExSleep = noExDays.reduce((s, d) => s + d.sleep, 0) / noExDays.length;
      const diff = Math.round((exSleep - noExSleep) * 60);
      if (diff >= 20) return { diff };
      return null;
    },
    message(r) { return `운동한 날 잠 평균 +${r.diff}분이에요`; },
  },
  {
    id: 'B4', type: 'cross_analysis', emoji: '💡', label: '통찰',
    check(data) {
      const last7 = data.days.slice(0, 7).filter(d => d.foodCount > 0 && d.condition);
      if (last7.length < 4) return null;
      const lowProtein = last7.filter(d => d.totalProtein < 40 && d.condition.energy <= 5);
      if (lowProtein.length >= 2) return {};
      return null;
    },
    message() { return '단백질 부족한 날 오후 에너지가 떨어지는 듯해요'; },
  },
  {
    id: 'B6', type: 'cross_analysis', emoji: '🍺', label: '통찰',
    check(data) {
      const yesterday = data.days[1];
      const today = data.days[0];
      if (!yesterday || yesterday.totalAlcohol === 0) return null;
      if (!today?.condition) return null;
      const avg = (today.condition.energy + today.condition.mood) / 2;
      if (avg <= 4) return { drop: Math.round(10 - avg) };
      return null;
    },
    message(r) { return `어제 술 → 오늘 컨디션이 좀 힘든 듯해요. 무리하지 마세요`; },
  },
  {
    id: 'B7', type: 'cross_analysis', emoji: '✨', label: '통찰',
    check(data) {
      const last7 = data.days.slice(0, 7);
      const shortSleep = last7.filter(d => d.sleep > 0 && d.sleep < 6);
      if (shortSleep.length < 3) return null;
      const recentTrouble = last7.filter(d => d.hasTrouble);
      if (recentTrouble.length >= 1) return {};
      return null;
    },
    message() { return '최근 잠이 짧으신데 피부에도 영향이 있는 듯해요'; },
  },
  {
    id: 'B8', type: 'cross_analysis', emoji: '🍱', label: '통찰',
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
      if (matches >= 2) return {};
      return null;
    },
    message() { return '늦은 식사 → 다음날 아침 무거움 패턴이 보여요'; },
  },
  {
    id: 'B5', type: 'cross_analysis', emoji: '☕', label: '통찰',
    check(data) {
      const last14 = data.days.slice(0, 14);
      let matches = 0;
      for (let i = 0; i < last14.length - 1; i++) {
        if (last14[i].totalCafMg >= 200 && last14[i + 1].hasTrouble) matches++;
      }
      if (matches >= 2) return {};
      return null;
    },
    message() { return '카페인 많은 날 다음날 트러블 패턴이 보여요'; },
  },

  // C. 변화 감지 (6개)
  {
    id: 'C1', type: 'change_detection', emoji: '⚡', label: '변화',
    check(data) {
      const thisWeek = data.days.slice(0, 7).filter(d => d.condition);
      const lastWeek = data.days.slice(7, 14).filter(d => d.condition);
      if (thisWeek.length < 3 || lastWeek.length < 3) return null;
      const twAvg = thisWeek.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / thisWeek.length;
      const lwAvg = lastWeek.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / lastWeek.length;
      const diff = Math.round(twAvg - lwAvg);
      if (diff <= -10) {
        const twCaf = thisWeek.reduce((s, d) => s + d.totalCafMg, 0) / thisWeek.length;
        const lwCaf = lastWeek.reduce((s, d) => s + d.totalCafMg, 0) / lastWeek.length;
        if (Math.abs(twCaf - lwCaf) > 50) return { diff: Math.abs(diff), change: '카페인' };
        return { diff: Math.abs(diff), change: '생활패턴' };
      }
      return null;
    },
    message(r) { return `이번 주 컨디션 -${r.diff}점인데 변한 건 ${r.change}이에요`; },
  },
  {
    id: 'C2', type: 'change_detection', emoji: '😴', label: '변화',
    check(data) {
      const recent = data.days.slice(0, 7).filter(d => d.sleep > 0);
      const prev = data.days.slice(7, 14).filter(d => d.sleep > 0);
      if (recent.length < 3 || prev.length < 3) return null;
      const rAvg = recent.reduce((s, d) => s + d.sleep, 0) / recent.length;
      const pAvg = prev.reduce((s, d) => s + d.sleep, 0) / prev.length;
      const diffMin = Math.round((rAvg - pAvg) * 60);
      if (Math.abs(diffMin) >= 30) {
        return { min: Math.abs(diffMin), dir: diffMin > 0 ? '더' : '덜' };
      }
      return null;
    },
    message(r) { return `최근 잠을 ${r.min}분 ${r.dir} 자고 계세요`; },
  },
  {
    id: 'C3', type: 'change_detection', emoji: '✨', label: '변화',
    check(data) {
      const thisMonth = data.days.slice(0, 14).filter(d => d.hasTrouble).length;
      const lastMonth = data.days.slice(14, 28).filter(d => d.hasTrouble).length;
      if (lastMonth >= 3 && thisMonth <= lastMonth * 0.5) return {};
      return null;
    },
    message() { return '최근 2주 트러블이 확 줄었어요. 좋은 변화네요'; },
  },
  {
    id: 'C4', type: 'change_detection', emoji: '💧', label: '변화',
    check(data) {
      const last3 = data.days.slice(0, 3).filter(d => d.waterCups > 0);
      const prev3 = data.days.slice(3, 6).filter(d => d.waterCups > 0);
      if (last3.length < 2 || prev3.length < 2) return null;
      const rAvg = last3.reduce((s, d) => s + d.waterMl, 0) / last3.length;
      const pAvg = prev3.reduce((s, d) => s + d.waterMl, 0) / prev3.length;
      if (rAvg > pAvg * 1.3 && rAvg > 0) return {};
      return null;
    },
    message() { return '수분 섭취 늘었네요. 잘하시는 듯'; },
  },
  {
    id: 'C5', type: 'change_detection', emoji: '☕', label: '변화',
    check(data) {
      const thisWeek = data.days.slice(0, 7);
      const lastWeek = data.days.slice(7, 14);
      const twCaf = thisWeek.reduce((s, d) => s + d.totalCafMg, 0);
      const lwCaf = lastWeek.reduce((s, d) => s + d.totalCafMg, 0);
      if (lwCaf > 200 && twCaf < lwCaf * 0.7) {
        return { pct: Math.round((1 - twCaf / lwCaf) * 100) };
      }
      return null;
    },
    message(r) { return `이번 주 카페인 -${r.pct}% 줄이셨네요`; },
  },
  {
    id: 'C6', type: 'change_detection', emoji: '😴', label: '변화',
    check(data) {
      const last14 = data.days.slice(0, 14).filter(d => d.sleep > 0);
      if (last14.length < 7) return null;
      const avg = last14.reduce((s, d) => s + d.sleep, 0) / last14.length;
      const variance = last14.reduce((s, d) => s + Math.pow(d.sleep - avg, 2), 0) / last14.length;
      const stdDev = Math.sqrt(variance) * 60; // 분 단위
      if (stdDev <= 30) return {};
      return null;
    },
    message() { return '수면 시간이 일정해지셨네요. 좋은 변화예요'; },
  },

  // D. 긍정 강화 (4개)
  {
    id: 'D1', type: 'positive', emoji: '✨', label: '잘하셨어요',
    check(data) {
      let streak = 0;
      for (const d of data.days) {
        if (d.waterMl >= d.waterGoalMl) streak++;
        else break;
      }
      if (streak >= 5) return { streak };
      return null;
    },
    message(r) { return `물 ${r.streak}일 연속 목표 달성! 본인만의 루틴이에요`; },
  },
  {
    id: 'D2', type: 'positive', emoji: '💊', label: '잘하셨어요',
    check(data) {
      if (data.suppItems.length === 0) return null;
      let streak = 0;
      for (const d of data.days) {
        if (d.suppTotal > 0 && d.suppDone === d.suppTotal) streak++;
        else break;
      }
      if (streak >= 5) return { streak };
      return null;
    },
    message(r) { return `영양제 ${r.streak}일 연속 챙기셨네요. 대단해요`; },
  },
  {
    id: 'D3', type: 'positive', emoji: '✨', label: '잘하셨어요',
    check(data) {
      const thisMonth = data.days.slice(0, 14).filter(d => d.hasTrouble).length;
      const lastMonth = data.days.slice(14, 28).filter(d => d.hasTrouble).length;
      if (lastMonth >= 3 && thisMonth < lastMonth) {
        return { pct: Math.round((1 - thisMonth / lastMonth) * 100) };
      }
      return null;
    },
    message(r) { return `트러블 줄어든 거 보이세요? ${r.pct}% 감소`; },
  },
  {
    id: 'D4', type: 'positive', emoji: '✨', label: '잘하셨어요',
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
    message(r) { return `이번 주 컨디션 +${r.diff}점이에요. 잘 챙기고 계세요`; },
  },

  // E. 행동 제안 (2개)
  {
    id: 'E1', type: 'action', emoji: '💧', label: '제안',
    check(data) {
      const today = data.days[0];
      if (!today) return null;
      const h = new Date().getHours();
      if (h < 10 || h > 20) return null;
      if (today.waterMl < today.waterGoalMl * 0.5 && h >= 14) return {};
      return null;
    },
    message() { return '물 한 잔 챙기러 갈래요?'; },
    action: { label: '기록하기', type: 'log_water' },
  },
  {
    id: 'E2', type: 'action', emoji: '🌙', label: '제안',
    check(data) {
      const h = new Date().getHours();
      if (h < 21) return null;
      const yesterday = data.days[1];
      if (yesterday && yesterday.sleep > 0 && yesterday.sleep < 6) return {};
      return null;
    },
    message() { return '오늘은 일찍 자보세요. 어제도 늦으셨거든요'; },
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
}

function wasRecentlyShown(templateId) {
  const h = getShownHistory();
  const lastShown = h[templateId];
  if (!lastShown) return false;
  const diff = (new Date() - new Date(lastShown)) / (1000 * 60 * 60 * 24);
  return diff < REPEAT_COOLDOWN_DAYS;
}

// 오늘 이미 표시된 인사이트인지 (같은 날 반복 방지)
function wasShownToday(templateId) {
  const h = getShownHistory();
  const lastShown = h[templateId];
  if (!lastShown) return false;
  return lastShown.startsWith(getDateKey(new Date()));
}

// ===== 메인 API =====
export function generateDailyInsights() {
  const data = collectUserData(30);

  if (!data.hasEnoughData) {
    return [{
      id: 'welcome',
      type: 'action',
      emoji: '✨',
      label: '환영',
      message: '더 기록해주시면 본인만의 통찰을 드릴 수 있어요',
      score: 0,
    }];
  }

  // 모든 템플릿 검사
  const candidates = [];
  for (const t of TEMPLATES) {
    if (wasRecentlyShown(t.id)) continue;
    const result = t.check(data);
    if (result) {
      candidates.push({
        id: t.id,
        type: t.type,
        emoji: t.emoji,
        label: t.label,
        message: t.message(result),
        score: calculateScore(t, result),
        action: t.action || null,
      });
    }
  }

  // 오늘 이미 표시 후 상호작용한 인사이트는 점수 대폭 하락
  candidates.forEach(c => {
    if (wasShownToday(c.id)) c.score *= 0.1;
  });

  // 매 진입마다 다른 인사이트 → 점수에 랜덤 요소 추가
  candidates.forEach(c => {
    c.score += Math.random() * 2;
  });

  // 피드백 기반 조정
  const feedback = safeJSON(FEEDBACK_KEY, {});
  candidates.forEach(c => {
    const fb = feedback[c.id];
    if (fb) {
      if (fb === 'not_helpful') c.score *= 0.5;
      if (fb === 'helpful') c.score *= 1.3;
    }
  });

  // 정렬
  candidates.sort((a, b) => b.score - a.score);

  // 부정적 인사이트 1개 한도
  const negativeTypes = ['change_detection'];
  let negCount = 0;
  const filtered = candidates.filter(c => {
    if (negativeTypes.includes(c.type) && c.message.includes('-')) {
      negCount++;
      return negCount <= 1;
    }
    return true;
  });

  // 최대 3개, 타입 다양성 확보
  const selected = [];
  const usedTypes = new Set();
  for (const c of filtered) {
    if (selected.length >= MAX_PER_DAY) break;
    if (selected.length > 0 && usedTypes.has(c.type)) continue;
    selected.push(c);
    usedTypes.add(c.type);
  }
  // 타입 다양성 후에도 부족하면 추가
  if (selected.length < MAX_PER_DAY) {
    for (const c of filtered) {
      if (selected.length >= MAX_PER_DAY) break;
      if (!selected.find(s => s.id === c.id)) selected.push(c);
    }
  }

  // 폴백
  if (selected.length === 0) {
    const h = new Date().getHours();
    const fallback = h < 12 ? '좋은 아침이에요. 오늘 잘 보내봐요' :
                     h < 18 ? '오늘 잘 보내고 계세요' :
                              '오늘 수고하셨어요';
    selected.push({ id: 'fallback', type: 'action', emoji: '✨', label: '', message: fallback, score: 0 });
  }

  // 메인 인사이트 마킹
  if (selected.length > 0) {
    selected[0].isMain = true;
    markShown(selected[0].id);
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
    date: getDateKey(new Date()),
    insights,
    generatedAt: new Date().toISOString(),
  }));
}

export function getOrGenerateInsights() {
  // 매번 새로 생성 (앱 재진입 시 다른 인사이트)
  const insights = generateDailyInsights();
  cacheInsights(insights);
  return insights;
}

export function refreshInsights() {
  localStorage.removeItem(CACHE_KEY);
  return getOrGenerateInsights();
}
