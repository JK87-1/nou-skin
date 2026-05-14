/**
 * 주간 리포트용 7일 데이터 집계 + 패턴 인사이트 규칙.
 *
 * 외부 스토리지 의존성:
 *  - getRecords()              src/storage/SkinStorage.js
 *  - getConditionChecks()      src/storage/ConditionStorage.js
 *  - getNutritionForDate(d)    src/storage/FoodStorage.js
 *  - getBodyRecords()          src/storage/BodyStorage.js
 *  - localStorage['lua_record_v2']  (sleep/water/steps)
 */
import { getRecords } from '../storage/SkinStorage';
import { getConditionChecks } from '../storage/ConditionStorage';
import { getNutritionForDate } from '../storage/FoodStorage';
import { getBodyRecords } from '../storage/BodyStorage';

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** endDate(default: today) 기준 과거 n일 날짜 키 배열 (오래된 순). */
export function getLastNDays(n = 7, endDate = new Date()) {
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    keys.push(fmtDate(d));
  }
  return keys;
}

/** ISO 8601 주차 — Amplitude property용. e.g. '2026-W20' */
export function getISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function mean(arr) {
  const xs = arr.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sum(arr) {
  return arr.filter((v) => typeof v === 'number' && !Number.isNaN(v))
    .reduce((a, b) => a + b, 0);
}

function readDailyRecords() {
  try {
    return JSON.parse(localStorage.getItem('lua_record_v2') || '{}') || {};
  } catch {
    return {};
  }
}

/**
 * 주간 집계 — 모든 7일 데이터를 한 번에 모음.
 * @param {string[]} dateKeys YYYY-MM-DD 7개
 * @returns 집계 객체
 */
export function aggregateWeek(dateKeys) {
  const dailyRec = readDailyRecords();
  const conditionChecks = getConditionChecks();
  const skinRecords = getRecords();
  const bodyRecords = getBodyRecords();

  // 일별 조건체크: 같은 날짜 중 가장 마지막 체크를 그날 대표값으로
  const conditionByDate = {};
  for (const c of conditionChecks) {
    const k = c.date || (c.timestamp ? c.timestamp.slice(0, 10) : null);
    if (!k) continue;
    if (dateKeys.includes(k)) conditionByDate[k] = c; // 마지막 push가 최신
  }

  // 일별 피부 측정: 같은 날 여러 record 평균
  const skinByDate = {};
  for (const r of skinRecords) {
    if (!dateKeys.includes(r.date)) continue;
    if (!skinByDate[r.date]) skinByDate[r.date] = [];
    skinByDate[r.date].push(r);
  }

  // 일별 영양
  const nutritionByDate = {};
  for (const k of dateKeys) nutritionByDate[k] = getNutritionForDate(k);

  // 일별 체중
  const weightByDate = {};
  for (const r of bodyRecords) {
    if (dateKeys.includes(r.date)) weightByDate[r.date] = r.weight;
  }

  // 일별 컨디션 평균 (energy+skin+mood+gut의 평균; 사용자가 한 day에 일부만 입력했을 수도)
  const dailyConditionScore = (c) => {
    if (!c) return null;
    const vals = [c.energy, c.skin, c.mood, c.gut].filter((v) => typeof v === 'number');
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  // 베스트/워스트 데이 — 컨디션 종합 점수 기준
  let bestDay = null;
  let worstDay = null;
  const dailies = dateKeys.map((k) => {
    const c = conditionByDate[k];
    const score = dailyConditionScore(c);
    const rec = dailyRec[k] || {};
    const skinDay = skinByDate[k] || [];
    const skinScoreAvg = skinDay.length
      ? mean(skinDay.map((r) => r.conditionScore ?? r.overallScore))
      : null;
    return {
      date: k,
      conditionScore: score,                      // 1-10 평균
      energy: c?.energy ?? null,
      skin: c?.skin ?? null,
      mood: c?.mood ?? null,
      gut: c?.gut ?? null,
      sleepHours: rec.sleep?.hours ?? null,
      waterCups: rec.water?.cups ?? null,
      steps: rec.steps ?? null,
      kcal: nutritionByDate[k]?.kcal ?? 0,
      weight: weightByDate[k] ?? null,
      skinScore: skinScoreAvg,
    };
  });

  for (const d of dailies) {
    if (d.conditionScore == null) continue;
    if (!bestDay || d.conditionScore > bestDay.conditionScore) bestDay = d;
    if (!worstDay || d.conditionScore < worstDay.conditionScore) worstDay = d;
  }

  // 체중 변화 — 첫 기록 vs 마지막 기록 (있는 경우만)
  const weightSeries = dailies.map((d) => d.weight).filter((v) => v != null);
  const weightDelta = weightSeries.length >= 2
    ? weightSeries[weightSeries.length - 1] - weightSeries[0]
    : null;

  return {
    week: getISOWeek(new Date(dateKeys[dateKeys.length - 1] + 'T00:00:00')),
    dateKeys,
    dailies,
    summary: {
      avgCondition: mean(dailies.map((d) => d.conditionScore)),
      avgSleepHours: mean(dailies.map((d) => d.sleepHours)),
      totalKcal: sum(dailies.map((d) => d.kcal)),
      avgDailyKcal: mean(dailies.map((d) => d.kcal).filter((v) => v > 0)),
      avgWaterCups: mean(dailies.map((d) => d.waterCups)),
      totalSteps: sum(dailies.map((d) => d.steps)),
      avgSteps: mean(dailies.map((d) => d.steps)),
      weightStart: weightSeries[0] ?? null,
      weightEnd: weightSeries[weightSeries.length - 1] ?? null,
      weightDelta,
      avgSkinScore: mean(dailies.map((d) => d.skinScore)),
      recordedDays: dailies.filter((d) => d.conditionScore != null || d.skinScore != null).length,
    },
    bestDay,
    worstDay,
  };
}

/**
 * 규칙 기반 패턴 인사이트 — 최대 2개 문자열 반환.
 * 데이터 부족 시 빈 배열.
 */
export function derivePatternInsights(agg) {
  const insights = [];
  const { dailies, summary } = agg;

  // 1) 수면-컨디션 상관: 수면 6시간 미만 vs 이상의 평균 컨디션 차이
  const shortSleep = dailies.filter((d) => d.sleepHours != null && d.sleepHours < 6 && d.conditionScore != null);
  const goodSleep = dailies.filter((d) => d.sleepHours != null && d.sleepHours >= 6 && d.conditionScore != null);
  if (shortSleep.length >= 2 && goodSleep.length >= 2) {
    const shortAvg = mean(shortSleep.map((d) => d.conditionScore));
    const goodAvg = mean(goodSleep.map((d) => d.conditionScore));
    if (Math.abs(shortAvg - goodAvg) >= 1.0) {
      insights.push(
        `수면 6시간 미만인 날 컨디션 평균 ${shortAvg.toFixed(1)}점, 충분한 날 ${goodAvg.toFixed(1)}점이에요. 차이가 ${(goodAvg - shortAvg).toFixed(1)}점이나 나요.`,
      );
    }
  }

  // 2) 수분 적당량(8잔) 미달 일수 비율
  const waterDays = dailies.filter((d) => d.waterCups != null);
  if (waterDays.length >= 4) {
    const low = waterDays.filter((d) => d.waterCups < 8).length;
    const ratio = low / waterDays.length;
    if (ratio >= 0.5) {
      insights.push(`이번 주 ${low}일은 수분 섭취가 8잔에 못 미쳤어요. 하루 한 잔만 더 챙겨봐요.`);
    }
  }

  // 3) 활동량 — 평균 스텝
  if (insights.length < 2 && summary.avgSteps != null && summary.avgSteps > 0) {
    if (summary.avgSteps >= 8000) {
      insights.push(`평균 ${Math.round(summary.avgSteps).toLocaleString()}보로 활동량이 충분해요. 꾸준함이 빛나요.`);
    } else if (summary.avgSteps < 4000) {
      insights.push(`평균 ${Math.round(summary.avgSteps).toLocaleString()}보로 활동이 부족했어요. 가벼운 산책으로 늘려봐요.`);
    }
  }

  // 4) 베스트/워스트 가시화 인사이트
  if (insights.length < 2 && agg.bestDay && agg.worstDay && agg.bestDay.date !== agg.worstDay.date) {
    const bestDow = ['일','월','화','수','목','금','토'][new Date(agg.bestDay.date + 'T00:00:00').getDay()];
    const diff = agg.bestDay.conditionScore - agg.worstDay.conditionScore;
    if (diff >= 2) {
      insights.push(`이번 주 가장 좋았던 날은 ${bestDow}요일(${agg.bestDay.conditionScore.toFixed(1)}점). 무엇이 달랐는지 돌아볼 만해요.`);
    }
  }

  return insights.slice(0, 2);
}
