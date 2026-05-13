/**
 * lua LLM 인사이트 엔진 (Phase 2)
 *
 * 핵심 동작:
 * 1. 의미 있는 데이터 입력 → 디바운싱 + 한도 체크
 * 2. LLM 호출 (10개 생성) → 검증 → 캐시
 * 3. 새로고침 = 캐시 순환 (LLM 호출 X)
 * 4. 한도 초과/실패 → 템플릿 폴백
 */

import { CAFFEINE_MG } from '../data/caffeineMap';

// ===== 상수 =====
const LLM_CACHE_KEY = 'lua_llm_insight_cache';
const LLM_USAGE_KEY = 'lua_llm_daily_usage';
const LLM_DEBOUNCE_KEY = 'lua_llm_debounce';
const LLM_CALL_LOG_KEY = 'lua_llm_call_log';
const LLM_ENABLED_KEY = 'lua_llm_enabled';
const LLM_PROMPT_VERSION = 2; // 프롬프트 변경 시 증가 → 캐시 무효화

const CONFIG = {
  dailyLLMCallLimit: 10,
  insightsPerCall: 10,
  debounceMinutes: 5,
  maxRetries: 2,
  meaningfulInputTypes: [
    'meal_logged', 'drink_caffeine', 'drink_alcohol', 'drink_noncaffeine',
    'exercise_logged', 'supplement_completed', 'sleep_logged',
    'condition_logged', 'cycle_event',
  ],
  insightDistribution: {
    just_input_focused: 1,
    cross_analysis: 2,
    pattern_discovery: 4,
    change_detection: 2,
    positive_or_action: 1,
  },
  diversity: {
    minDifferentCards: 5,
    noConsecutiveSameCard: true,
    maxSameType: 3,
  },
  validation: {
    minSentences: 3,
    maxEmoji: 2,
    maxMessageLength: 200,
    minMessageLength: 40,
  },
  contextSize: {
    previousCallsCount: 3,
    recentDays: 7,
    baselineDays: 30,
  },
};

// ===== 유틸 =====
function safeJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
}

function getDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayKey() { return getDateKey(); }

// ===== LLM 활성화 체크 =====
export function isLLMEnabled() {
  // Phase 2: 사용자 30일 이상 + localStorage 플래그
  const usage = safeJSON(LLM_ENABLED_KEY, null);
  if (usage === false) return false;
  // 기본 활성화 (배포 후 Remote Config으로 전환 가능)
  return true;
}

// ===== 의미 있는 입력 판단 =====
export function isMeaningfulInput(dataType) {
  return CONFIG.meaningfulInputTypes.includes(dataType);
}

// ===== 디바운싱 =====
function isDebounced(dataType) {
  const debounce = safeJSON(LLM_DEBOUNCE_KEY, {});
  // 모든 타입 통합 디바운스 (같은 종류만이 아니라 전체)
  const lastCall = debounce._last;
  if (!lastCall) return false;
  const elapsed = (Date.now() - new Date(lastCall).getTime()) / (1000 * 60);
  return elapsed < CONFIG.debounceMinutes;
}

function setDebounce(dataType) {
  const debounce = safeJSON(LLM_DEBOUNCE_KEY, {});
  debounce[dataType] = new Date().toISOString();
  debounce._last = new Date().toISOString();
  localStorage.setItem(LLM_DEBOUNCE_KEY, JSON.stringify(debounce));
}

// ===== 일일 한도 =====
function getDailyUsage() {
  const usage = safeJSON(LLM_USAGE_KEY, { date: '', count: 0 });
  if (usage.date !== getTodayKey()) {
    return { date: getTodayKey(), count: 0, triggers: {}, fallbackCount: 0, refreshCount: 0 };
  }
  return usage;
}

function incrementDailyUsage(dataType) {
  const usage = getDailyUsage();
  usage.count++;
  usage.triggers = usage.triggers || {};
  usage.triggers[dataType] = (usage.triggers[dataType] || 0) + 1;
  localStorage.setItem(LLM_USAGE_KEY, JSON.stringify(usage));
}

function incrementRefreshCount() {
  const usage = getDailyUsage();
  usage.refreshCount = (usage.refreshCount || 0) + 1;
  localStorage.setItem(LLM_USAGE_KEY, JSON.stringify(usage));
}

function isAtDailyLimit() {
  return getDailyUsage().count >= CONFIG.dailyLLMCallLimit;
}

// ===== 사용자 데이터 수집 (컨텍스트 빌더) =====
function collectUserData(days = 30) {
  const records = safeJSON('lua_record_v2', {});
  const foods = safeJSON('lua_food_records', {});
  const checks = safeJSON('nou_condition_checks', []);
  const drinks = safeJSON('lua_drink_records', {});
  const suppItems = safeJSON('lua_supplement_items', []);
  const suppChecks = safeJSON('lua_supplement_checks', {});
  const waterSettings = { cupMl: 250, goalMl: 2000, ...safeJSON('lua_water_settings', {}) };
  const bodyRecords = safeJSON('lua_body_records', []);
  const weatherData = safeJSON('lua_weather_data', null);
  const cycleData = safeJSON('lua_cycle_data', null);

  const today = new Date();
  const data = { days: [], waterSettings, suppItems };

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = getDateKey(d);
    const rec = records[key] || {};
    const dayFoods = (foods[key] || []).filter(f => !f.name?.startsWith('물 '));
    const dayDrinks = drinks[key] || {};
    const dayChecks = checks.filter(c => c.date === key || (c.timestamp && c.timestamp.startsWith(key)));
    const latestCheck = dayChecks.length > 0 ? dayChecks[dayChecks.length - 1] : null;
    const daySupp = suppChecks[key] || {};

    const caffeineItems = dayDrinks.caffeine || [];
    const alcoholItems = dayDrinks.alcohol || [];
    const nonCafItems = dayDrinks.noncaffeine || [];
    const totalCafMg = caffeineItems.reduce((s, d) => s + (CAFFEINE_MG[d.key] || 100) * (d.count || 0), 0);
    const totalAlcohol = alcoholItems.reduce((s, d) => s + (d.count || 0), 0);
    const totalKcal = dayFoods.reduce((s, f) => s + (f.kcal || 0), 0);
    const totalProtein = dayFoods.reduce((s, f) => s + (f.protein || 0), 0);
    const waterCups = rec.water?.cups || 0;
    const waterMl = waterCups * waterSettings.cupMl;
    const suppDone = suppItems.filter(s => daySupp[s.id]).length;

    data.days.push({
      date: key,
      dayOfWeek: d.getDay(),
      sleep: rec.sleep?.hours || 0,
      sleepQuality: rec.sleep?.quality || null,
      bedtime: rec.sleep?.bedtime || null,
      waterCups, waterMl, waterGoalMl: waterSettings.goalMl,
      steps: rec.steps || 0,
      exercise: rec.exercise?.log || {},
      hasExercise: Object.keys(rec.exercise?.log || {}).length > 0,
      totalKcal, totalProtein, foodCount: dayFoods.length,
      foods: dayFoods.slice(0, 5).map(f => f.name || '').filter(Boolean),
      caffeineItems, totalCafMg, alcoholItems, totalAlcohol,
      nonCafItems,
      condition: latestCheck ? {
        energy: latestCheck.energy || latestCheck['에너지'] || 0,
        mood: latestCheck.mood || latestCheck['기분'] || 0,
        skin: latestCheck.skin || latestCheck['피부'] || 0,
        gut: latestCheck.gut || latestCheck['소화'] || 0,
      } : null,
      suppDone, suppTotal: suppItems.length,
      weight: bodyRecords.find(r => r.date === key)?.weight || 0,
    });
  }

  data.weather = weatherData ? {
    temp: weatherData.temp || weatherData.temperature || 0,
    humidity: weatherData.humidity || 0,
    uv: weatherData.uv || 0,
  } : null;
  data.cycle = cycleData;

  const activeDays = data.days.filter(d => d.sleep > 0 || d.waterCups > 0 || d.foodCount > 0 || d.condition).length;
  data.activeDays = activeDays;

  return data;
}

// ===== 컨텍스트 → 텍스트 변환 (전체 데이터) =====
function buildLLMContext(userData, triggerType, justInputData) {
  const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
  let ctx = '';

  // ===== 사용자 프로필 =====
  const profile = safeJSON('nou_profile', {});
  ctx += `## 사용자 프로필\n`;
  if (profile.nickname) ctx += `이름: ${profile.nickname}\n`;
  if (profile.birthYear) ctx += `출생: ${profile.birthYear}년\n`;
  if (profile.gender) ctx += `성별: ${profile.gender}\n`;
  if (profile.skinType) ctx += `피부타입: ${profile.skinType}\n`;
  if (profile.skinConcerns?.length) ctx += `피부고민: ${profile.skinConcerns.join(', ')}\n`;
  if (profile.sensitivity) ctx += `민감도: ${profile.sensitivity}\n`;
  const bodyProfile = safeJSON('lua_body_profile', {});
  if (bodyProfile.height) ctx += `키: ${bodyProfile.height}cm\n`;
  ctx += `사용 ${userData.activeDays}일째\n\n`;

  // ===== 트리거 =====
  ctx += `## ⭐ 트리거: ${triggerType}\n`;
  if (justInputData) ctx += JSON.stringify(justInputData, null, 0).slice(0, 300) + '\n';
  ctx += '\n';

  // ===== 오늘 + 어제 상세 데이터 =====
  const detailDays = userData.days.slice(0, 2);
  const foods = safeJSON('lua_food_records', {});
  const drinks = safeJSON('lua_drink_records', {});
  const skinLogs = safeJSON('lua_skin_check_logs', {});
  const moodSubs = safeJSON('nou_mood_sub_checks', []);
  const energySubs = safeJSON('nou_energy_sub_checks', []);
  const skinSubs = safeJSON('nou_skin_sub_checks', []);
  const bloodSugar = safeJSON('nou_blood_sugar_checks', []);

  ctx += `⚠️ 아래 "오늘" 데이터는 반드시 "오늘"로, "어제" 데이터는 반드시 "어제"로 언급하세요.\n`;
  ctx += `⚠️ 데이터가 없는 날은 해당 항목을 언급하지 마세요. 기록이 없으면 추측하거나 만들어내지 마세요.\n\n`;
  detailDays.forEach((day, idx) => {
    const label = idx === 0 ? '오늘' : '어제';
    // 해당 날짜에 기록된 데이터가 하나도 없으면 명시
    const hasAnyData = day.sleep > 0 || day.foodCount > 0 || day.totalCafMg > 0 || day.totalAlcohol > 0 || day.waterMl > 0 || day.condition || day.hasExercise || day.steps > 0 || day.suppDone > 0 || day.weight > 0;
    ctx += `## ${label} (${day.date} ${DAY_NAMES[day.dayOfWeek]}요일) — 이 섹션의 데이터를 언급할 때 "${label}"이라고만 쓰세요\n`;
    if (!hasAnyData) {
      ctx += `(기록 없음 — 이 날에 대한 인사이트를 생성하지 마세요)\n\n`;
      return;
    }

    // 수면
    if (day.sleep > 0) {
      ctx += `수면: ${day.sleep}시간`;
      if (day.sleepQuality) ctx += ` (${day.sleepQuality})`;
      if (day.bedtime) ctx += ` 취침${day.bedtime}`;
      ctx += '\n';
    }

    // 식사 (상세)
    const dayFoods = (foods[day.date] || []).filter(f => !f.name?.startsWith('물 '));
    if (dayFoods.length > 0) {
      ctx += `식사 (${dayFoods.length}끼, ${day.totalKcal}kcal):\n`;
      dayFoods.forEach(f => {
        let line = `  - ${f.meal || ''} ${f.name || ''}`;
        if (f.kcal) line += ` ${f.kcal}kcal`;
        if (f.protein) line += ` 단백질${f.protein}g`;
        if (f.carb) line += ` 탄수${f.carb}g`;
        if (f.fat) line += ` 지방${f.fat}g`;
        if (f.fiber) line += ` 식이섬유${f.fiber}g`;
        if (f.sugar) line += ` 당류${f.sugar}g`;
        if (f.ingredients?.length) line += ` [${f.ingredients.slice(0, 5).join(',')}]`;
        ctx += line + '\n';
        if (f.bloodSugar) ctx += `    혈당영향: ${f.bloodSugar}${f.bloodSugarNote ? ` - ${f.bloodSugarNote.slice(0, 60)}` : ''}\n`;
        if (f.drowsiness) ctx += `    식곤증: ${f.drowsiness}${f.drowsinessNote ? ` - ${f.drowsinessNote.slice(0, 60)}` : ''}\n`;
        if (f.skinImpact) ctx += `    피부영향: ${f.skinImpact}${f.skinImpactNote ? ` - ${f.skinImpactNote.slice(0, 60)}` : ''}\n`;
      });
    }

    // 음료 (상세)
    const dayDrinks = drinks[day.date] || {};
    const cafItems = dayDrinks.caffeine || [];
    const alcItems = dayDrinks.alcohol || [];
    const ncItems = dayDrinks.noncaffeine || [];
    if (cafItems.length > 0) {
      ctx += `카페인 (총${day.totalCafMg}mg): ${cafItems.map(d => `${d.name || d.key}${d.count > 1 ? 'x' + d.count : ''}${d.drunkAt ? ' ' + d.drunkAt.slice(11, 16) : ''}`).join(', ')}\n`;
    }
    if (alcItems.length > 0) {
      ctx += `알코올 (${day.totalAlcohol}잔): ${alcItems.map(d => `${d.name || d.key}${d.count > 1 ? 'x' + d.count : ''}${d.drunkAt ? ' ' + d.drunkAt.slice(11, 16) : ''}`).join(', ')}\n`;
    }
    if (ncItems.length > 0) {
      ctx += `기타음료: ${ncItems.map(d => `${d.name || d.key}${d.count > 1 ? 'x' + d.count : ''}${d.intents?.length ? '(' + d.intents.join(',') + ')' : ''}`).join(', ')}\n`;
    }

    // 수분
    if (day.waterMl > 0) ctx += `수분: ${day.waterMl}ml / 목표${day.waterGoalMl}ml (${day.waterCups}잔)\n`;

    // 컨디션 (상세)
    if (day.condition) {
      ctx += `컨디션: 에너지${day.condition.energy}/10 기분${day.condition.mood}/10 피부${day.condition.skin}/10 소화${day.condition.gut}/10\n`;
      const daySub = energySubs.find(s => s.date === day.date);
      if (daySub) ctx += `  활력${daySub.vitality || ''} 집중${daySub.focus || ''}\n`;
      const moodSub = moodSubs.find(s => s.date === day.date);
      if (moodSub?.stress) ctx += `  스트레스: ${moodSub.stress}\n`;
      if (moodSub?.emotions) ctx += `  감정: ${JSON.stringify(moodSub.emotions).slice(0, 100)}\n`;
    }

    // 피부 체크 (상세)
    const skinLog = skinLogs[day.date];
    if (skinLog) {
      if (skinLog.score) ctx += `피부점수: ${skinLog.score}/10\n`;
      if (skinLog.zones?.length) ctx += `피부부위: ${skinLog.zones.map(z => `${z.zone}(심각도${z.severity})`).join(', ')}\n`;
      if (skinLog.signals?.length) ctx += `피부신호: ${skinLog.signals.join(', ')}\n`;
      if (skinLog.memo) ctx += `피부메모: ${skinLog.memo}\n`;
    }

    // 운동
    if (day.hasExercise) {
      ctx += `운동: ${Object.entries(day.exercise).map(([k, v]) => `${k} ${v}분`).join(', ')}\n`;
    }
    if (day.steps > 0) ctx += `걸음: ${day.steps.toLocaleString()}보\n`;

    // 영양제
    if (day.suppDone > 0) ctx += `영양제: ${day.suppDone}/${day.suppTotal}개 완료\n`;

    // 체중
    if (day.weight > 0) ctx += `체중: ${day.weight}kg\n`;

    // 혈당
    const dayBS = bloodSugar.filter(b => b.date === day.date);
    if (dayBS.length > 0) ctx += `혈당: ${dayBS.map(b => `${b.value}(${b.timing})`).join(', ')}\n`;

    ctx += '\n';
  });

  // ===== 최근 7일 요약 =====
  const recent7 = userData.days.slice(0, 7);
  ctx += `## 최근 7일 요약\n`;
  const sleepDays = recent7.filter(d => d.sleep > 0);
  if (sleepDays.length > 0) ctx += `수면: 평균${(sleepDays.reduce((s, d) => s + d.sleep, 0) / sleepDays.length).toFixed(1)}시간 (${sleepDays.length}일)\n`;
  const waterDays = recent7.filter(d => d.waterMl > 0);
  if (waterDays.length > 0) ctx += `수분: 평균${Math.round(waterDays.reduce((s, d) => s + d.waterMl, 0) / waterDays.length)}ml\n`;
  const cafDays = recent7.filter(d => d.totalCafMg > 0);
  if (cafDays.length > 0) ctx += `카페인: 평균${Math.round(cafDays.reduce((s, d) => s + d.totalCafMg, 0) / cafDays.length)}mg\n`;
  const condDays = recent7.filter(d => d.condition);
  if (condDays.length > 0) {
    ctx += `컨디션: 에너지${(condDays.reduce((s, d) => s + d.condition.energy, 0) / condDays.length).toFixed(1)} 기분${(condDays.reduce((s, d) => s + d.condition.mood, 0) / condDays.length).toFixed(1)}\n`;
  }
  // 7일 각 날짜 한 줄 요약
  recent7.slice(2).forEach(d => {
    const parts = [];
    if (d.sleep > 0) parts.push(`수면${d.sleep}h`);
    if (d.totalKcal > 0) parts.push(`${d.totalKcal}kcal`);
    if (d.totalCafMg > 0) parts.push(`카페인${d.totalCafMg}mg`);
    if (d.condition) parts.push(`에너지${d.condition.energy}`);
    if (d.weight > 0) parts.push(`${d.weight}kg`);
    if (parts.length > 0) ctx += `${d.date}: ${parts.join(' ')}\n`;
  });
  ctx += '\n';

  // ===== 날씨 =====
  const weather = safeJSON('lua_weather_data', null);
  if (weather) {
    const w = weather.data || weather;
    ctx += `## 날씨\n`;
    if (w.temp || w.temperature) ctx += `온도: ${Math.round(w.temp || w.temperature)}도`;
    if (w.tempMax) ctx += ` (최고${Math.round(w.tempMax)}·최저${Math.round(w.tempMin || 0)})`;
    ctx += '\n';
    if (w.humidity) ctx += `습도: ${w.humidity}%\n`;
    if (w.uv) ctx += `자외선: ${w.uv}\n`;
    if (w.condition) ctx += `상태: ${w.condition}\n`;
    ctx += '\n';
  }

  // ===== 주기 =====
  if (userData.cycle) {
    const cycleLen = userData.cycle.averageCycleLength || 28;
    const periodLen = userData.cycle.averagePeriodLength || 5;
    const lastStart = userData.cycle.lastPeriodStart;
    ctx += `## 생리주기\n`;
    ctx += `마지막 시작: ${lastStart || '?'}\n`;
    ctx += `설정된 주기: ${cycleLen}일 / 기간: ${periodLen}일\n`;
    // 기록 횟수가 1회면 "평균"이 아님을 명시
    const cycleHistory = userData.cycle.history || [];
    if (cycleHistory.length <= 1) {
      ctx += `(주기 기록이 ${cycleHistory.length}회뿐이라 "평균"이라고 표현하지 마세요. "설정된 주기" 정도로 말해주세요)\n`;
    }
    // 예상일 vs 실제 차이
    if (lastStart) {
      const daysSince = Math.floor((new Date() - new Date(lastStart)) / (1000 * 60 * 60 * 24));
      const daysUntilNext = cycleLen - daysSince;
      if (daysUntilNext > 0) {
        ctx += `현재 주기 ${daysSince}일째, 다음 예정일까지 약 ${daysUntilNext}일\n`;
      } else {
        ctx += `현재 주기 ${daysSince}일째, 예정일보다 ${Math.abs(daysUntilNext)}일 지남\n`;
      }
    }
    ctx += `⚠️ 생리주기는 사용자가 의도적으로 "지키는" 것이 아닙니다. "주기를 잘 지키고 있다"는 표현 대신 "주기가 잘 유지되고 있다" 등 자연스러운 표현을 사용하세요.\n`;
    ctx += '\n';
  }

  // ===== 영양제 목록 + 실제 복용 현황 =====
  const suppItems = safeJSON('lua_supplement_items', []);
  if (suppItems.length > 0) {
    const suppChecksAll = safeJSON('lua_supplement_checks', {});
    ctx += `## 복용 영양제\n`;
    ctx += `등록된 영양제: ${suppItems.map(s => `${s.name}(${s.timing})`).join(', ')}\n`;
    // 최근 7일 실제 복용 체크 현황
    const recent7supp = userData.days.slice(0, 7);
    const suppStreaks = {};
    suppItems.forEach(s => {
      let streak = 0;
      for (const d of recent7supp) {
        const dayCheck = suppChecksAll[d.date] || {};
        if (dayCheck[s.id]) streak++; else break;
      }
      suppStreaks[s.name] = streak;
    });
    const checkedAny = Object.values(suppStreaks).some(v => v > 0);
    if (checkedAny) {
      ctx += `최근 복용 현황: ${Object.entries(suppStreaks).map(([name, streak]) => `${name} ${streak > 0 ? streak + '일 연속' : '미복용'}`).join(', ')}\n`;
    } else {
      ctx += `최근 7일간 복용 체크 기록 없음 — "꾸준히 복용 중" 등의 표현을 사용하지 마세요\n`;
    }
    ctx += '\n';
  }

  // ===== 최근 피부 분석 (AI) =====
  const skinRecords = safeJSON('nou_skin_records', []);
  const latestSkin = skinRecords[skinRecords.length - 1];
  if (latestSkin) {
    ctx += `## 최근 피부 AI분석 (${latestSkin.date})\n`;
    ctx += `종합${latestSkin.overallScore} 수분${latestSkin.moisture} 피부나이${latestSkin.skinAge} 트러블${latestSkin.troubleCount}\n`;
    if (latestSkin.aiNotes) ctx += `AI소견: ${latestSkin.aiNotes.slice(0, 150)}\n`;
    ctx += '\n';
  }

  return ctx;
}

// ===== 이전 인사이트 요약 (중복 회피) =====
function getPreviousInsightSummaries() {
  const cache = safeJSON(LLM_CACHE_KEY, null);
  if (!cache?.insights || cache.insights.length === 0) return '이전 인사이트 없음';

  const summaries = cache.insights.slice(0, 10).map((ins, i) =>
    `${i + 1}. [${ins.type}] ${ins.primaryCard}: ${(ins.message || '').slice(0, 50)}`
  ).join('\n');

  return summaries;
}

// ===== 작업 지시 빌더 =====
function buildTaskInstruction(triggerType) {
  const dist = CONFIG.insightDistribution;
  return `정확히 10개의 인사이트를 JSON 배열로 생성하세요.

분포:
- just_input_focused: ${dist.just_input_focused}개 (방금 입력 "${triggerType}" 관련)
- cross_analysis: ${dist.cross_analysis}개 (다른 카드와 교차 분석)
- pattern_discovery: ${dist.pattern_discovery}개 (시간·요일·주기 패턴)
- change_detection: ${dist.change_detection}개 (최근 변화 감지)
- positive_or_action: ${dist.positive_or_action}개 (긍정 강화 또는 행동 제안)

다양성:
- 최소 5개 다른 카드(water, caffeine, sleep, meal, condition, skin, exercise, supplement, alcohol, weight, weather, cycle) 활용
- 연속으로 같은 카드 X
- 같은 타입 최대 3개

각 인사이트 형식:
{
  "type": "just_input_focused|cross_analysis|pattern_discovery|change_detection|positive|action",
  "primary_card": "카드명",
  "related_cards": ["관련카드1"],
  "message": "정확히 3문장. 관찰 + 근거 + 함의 구조. 40-200자.",
  "emoji": "이모지1개"
}

⚠️ 필수:
- 각 메시지 정확히 3문장 (~어요/~예요/~거예요 어미)
- 격식체(~합니다) 사용 금지
- 의료 단언(치료/예방/진단) 금지 → "~할 수 있어요" 추측 톤
- 이모지 메시지 내 0-2개
- 개인화된 패턴 발견 최소 2개 포함 (단, 메시지 안에 "예상치 못한 발견"이라는 표현 사용 금지)

⚠️ 데이터 정확성 (위반 시 전체 무효):
- "오늘" 데이터를 언급할 때만 "오늘", "어제" 데이터를 언급할 때만 "어제"라고 쓰세요. 날짜 라벨을 절대 바꾸지 마세요.
- "(기록 없음)"으로 표시된 날에 대해서는 어떤 인사이트도 생성하지 마세요.
- 식사 칼로리(kcal)는 식사 카드에만, 걸음수(보)는 활동 카드에만 사용하세요. 수치와 카드를 절대 혼동하지 마세요.
- 컨텍스트에 없는 수치를 만들어내지 마세요.
- 영양제 "등록"과 "복용 체크"는 다릅니다. 복용 체크가 없으면 복용 중이라고 하지 마세요.
- 생리주기는 "지키는" 것이 아닙니다. "주기가 유지되고 있다" 등 자연스러운 표현을 쓰세요.

JSON 배열만 출력하세요. 다른 텍스트 없이.`;
}

// ===== 시스템 프롬프트 =====
function getSystemPrompt() {
  return `당신은 'lua'입니다. 건강 기록 앱에서 사용자의 데이터를 분석해 인사이트를 전달하는 따뜻한 친구예요.

## 페르소나
- 톤: 카페에서 친한 친구가 내 건강 걱정해주는 느낌
- 어미: ~어요, ~예요, ~거예요, ~네요 (친근 존댓말)
- 금지: ~합니다, ~해야 합니다, ~권장됩니다 (격식체)
- 금지: 치료, 예방, 진단, 완치 (의료 단언)
- 대안: "~할 수 있어요", "~인 듯해요", "~도움이 될 거예요"

## 인사이트 구조
각 메시지는 정확히 3문장:
1. 관찰: "~하시네요!" / "~패턴이에요!"
2. 근거: 데이터 기반 수치/비교
3. 함의: 실행 가능한 제안 또는 격려

## 핵심 차별화
- 사용자가 모르던 패턴, 다차원 결합을 발견하세요
- 흔한 일반론 X → 본인 데이터에서만 나오는 개인화된 발견
- 메시지 안에 "예상치 못한 발견" 같은 메타 표현을 절대 쓰지 마세요. 발견 내용을 직접 말하세요.
- 시간 패턴, 요일 패턴, 교차 영향 발견

## ⚠️ 데이터 정확성 (최우선 규칙 — 위반 시 전체 무효)
- "오늘" 섹션의 데이터만 "오늘"이라고 말하세요. "어제" 섹션의 데이터는 반드시 "어제"라고 말하세요. 날짜를 절대 혼동하지 마세요.
- "(기록 없음)"으로 표시된 날에 대해서는 어떤 인사이트도 생성하지 마세요. 기록이 없는 항목을 추측하거나 만들어내는 것은 금지입니다.
- 각 수치는 해당 카드에만 귀속시키세요. 예: 식사 칼로리(kcal)를 걸음수(보)로 해석하거나, 수면 시간을 운동 시간으로 바꿔 말하는 것은 금지입니다.
- 데이터에 없는 수치를 만들어내지 마세요. 컨텍스트에 명시된 숫자만 사용하세요.
- 카드 종류별 단위: 식사=kcal/g, 걸음=보, 수면=시간, 수분=ml/잔, 카페인=mg, 체중=kg
- 영양제: "등록"과 "복용"은 다릅니다. 복용 체크 기록이 없으면 "꾸준히 복용 중"이라고 말하지 마세요.
- 생리주기: 사용자가 의도적으로 "지키는" 것이 아닙니다. "주기를 잘 지키고 있다" 대신 "주기가 잘 유지되고 있다" 등 자연스러운 표현을 쓰세요.

## 출력 형식
JSON 배열만 출력. 다른 텍스트 없이.
각 요소: { type, primary_card, related_cards, message, emoji }`;
}

// ===== 검증 =====
function validateInsights(insights) {
  if (!Array.isArray(insights) || insights.length !== CONFIG.insightsPerCall) return { valid: false, failure: 'wrong_count' };

  for (const ins of insights) {
    if (!ins.message || typeof ins.message !== 'string') return { valid: false, failure: 'missing_message' };

    // 3문장 체크
    const sentenceCount = (ins.message.match(/[.?!]/g) || []).length;
    if (sentenceCount < 3) return { valid: false, failure: 'too_few_sentences' };

    // 친근 어미 체크
    const friendlyEndings = /[네어]요!?|예요!?|거예요|있어요|드릴게요|보세요|줄게요/;
    if (!friendlyEndings.test(ins.message)) return { valid: false, failure: 'formal_tone' };

    // 격식체 금지
    if (/합니다\.|해야 합니다|권장됩니다|확인되었습니다/.test(ins.message)) return { valid: false, failure: 'formal_tone' };

    // 의료 단언 금지
    if (/치료|예방|진단|완치/.test(ins.message)) return { valid: false, failure: 'medical_assertion' };

    // 이모지 0-2개
    const emojiCount = (ins.message.match(/\p{Emoji_Presentation}/gu) || []).length;
    if (emojiCount > 2) return { valid: false, failure: 'too_many_emojis' };

    // 메시지 길이
    if (ins.message.length < CONFIG.validation.minMessageLength || ins.message.length > CONFIG.validation.maxMessageLength) {
      return { valid: false, failure: 'message_length' };
    }
  }

  // 데이터 혼동 체크: 식사 카드에서 '보' 단위 사용 or 활동 카드에서 'kcal' 단위 사용
  for (const ins of insights) {
    const card = ins.primary_card || '';
    const msg = ins.message || '';
    if (card === 'meal' && /\d{3,}보/.test(msg)) return { valid: false, failure: 'data_mismatch' };
    if (card === 'activity' && /\d{3,}kcal/.test(msg)) return { valid: false, failure: 'data_mismatch' };
  }

  // 다양성 체크
  const uniqueCards = new Set(insights.flatMap(i => [i.primary_card, ...(i.related_cards || [])]));
  if (uniqueCards.size < CONFIG.diversity.minDifferentCards) return { valid: false, failure: 'low_diversity' };

  return { valid: true };
}

// ===== 재시도 강화 프롬프트 =====
function getRetryInstruction(failure) {
  const instructions = {
    too_few_sentences: '각 메시지를 정확히 3문장으로 작성하세요. 관찰 + 근거 + 함의 구조 필수.',
    formal_tone: '격식체(~합니다) 사용 금지. 친구 카톡 톤(~어요!) 필수.',
    medical_assertion: '의료 단언(치료, 예방) 사용 금지. "~할 수 있어요" 추측 톤만 사용.',
    too_many_emojis: '이모지를 메시지당 0-2개만 사용하세요.',
    low_diversity: '다른 카드 5개 이상 활용 필수. 같은 카드 연속 X.',
    message_length: '각 메시지 40-200자 이내로 작성하세요.',
    wrong_count: '정확히 10개의 인사이트를 생성하세요.',
    data_mismatch: '수치와 카드가 혼동되었습니다. 식사 칼로리(kcal)를 걸음수(보)로 쓰거나 반대로 쓰지 마세요. 각 수치는 해당 카드의 올바른 단위로만 사용하세요.',
  };
  return instructions[failure] || '메시지 형식, 톤, 다양성을 다시 확인하세요.';
}

// ===== LLM API 호출 =====
async function callLLMAPI(system, user) {
  const response = await fetch(`${window.location.origin}/api/insight-llm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, user }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `API ${response.status}`);
  }

  return response.json();
}

// ===== LLM 호출 + 재시도 =====
async function callLLMWithRetry(system, userPrompt, attempt = 0) {
  const result = await callLLMAPI(system, userPrompt);
  const insights = result.insights;
  const validation = validateInsights(insights);

  if (validation.valid) {
    return { insights, usage: result.usage };
  }

  if (attempt < CONFIG.maxRetries) {
    const retryInstruction = getRetryInstruction(validation.failure);
    const enhancedPrompt = userPrompt + `\n\n⚠️ 이전 응답이 검증 실패했습니다. 수정 필요:\n${retryInstruction}`;
    return callLLMWithRetry(system, enhancedPrompt, attempt + 1);
  }

  // 검증 실패해도 기본 구조가 있으면 사용 (완벽하지 않아도)
  if (Array.isArray(insights) && insights.length > 0) {
    return { insights: insights.slice(0, 10), usage: result.usage, validationFailed: true };
  }

  throw new Error('Validation failed after retries');
}

// ===== 프롬프트 빌더 =====
function buildFinalPrompt(userData, triggerType, justInputData) {
  const system = getSystemPrompt();
  const userContext = buildLLMContext(userData, triggerType, justInputData);
  const previousInsights = getPreviousInsightSummaries();
  const taskInstruction = buildTaskInstruction(triggerType);

  const userPrompt = `# 사용자 데이터

${userContext}

# 이전 인사이트 (중복 회피)

${previousInsights}

# 작업

${taskInstruction}`;

  return { system, user: userPrompt };
}

// ===== 캐시 관리 =====
function getLLMCache() {
  const cache = safeJSON(LLM_CACHE_KEY, null);
  // 프롬프트 버전이 다르면 캐시 무효화
  if (cache && cache.promptVersion !== LLM_PROMPT_VERSION) {
    localStorage.removeItem(LLM_CACHE_KEY);
    return null;
  }
  return cache;
}

function saveLLMCache(cache) {
  cache.promptVersion = LLM_PROMPT_VERSION;
  localStorage.setItem(LLM_CACHE_KEY, JSON.stringify(cache));
}

function formatInsight(raw, index, triggerType) {
  // "예상치 못한 발견인데" 등 메타 표현 제거
  let msg = (raw.message || '').replace(/예상치 못한 발견인데,?\s*/g, '').replace(/예상치 못한 발견이에요[!.]?\s*/g, '');
  return {
    id: `llm_${Date.now()}_${index}`,
    type: raw.type || 'pattern',
    primaryCard: raw.primary_card || 'condition',
    relatedCards: raw.related_cards || [],
    message: msg,
    emoji: raw.emoji || '✨',
    label: getLabel(raw.type),
    triggeredBy: triggerType,
    generatedAt: new Date().toISOString(),
    viewCount: 0,
    isLiked: false,
    isLLM: true,
  };
}

function getLabel(type) {
  const labels = {
    just_input_focused: '방금 입력',
    cross_analysis: '통찰',
    pattern_discovery: '발견',
    change_detection: '변화',
    positive: '잘하셨어요',
    action: '제안',
  };
  return labels[type] || '발견';
}

// ===== 호출 로그 =====
function logLLMCall(entry) {
  const logs = safeJSON(LLM_CALL_LOG_KEY, []);
  logs.push({ ...entry, timestamp: new Date().toISOString() });
  // 최근 100개만 유지
  if (logs.length > 100) logs.splice(0, logs.length - 100);
  localStorage.setItem(LLM_CALL_LOG_KEY, JSON.stringify(logs));
}

// ===== 메인 진입점: 데이터 입력 시 =====
let _llmInProgress = false;

export async function onMeaningfulDataInput(dataType, justInputData = null) {
  console.log(`[LLM] 트리거: ${dataType}`);

  // 0. 이미 호출 중이면 스킵
  if (_llmInProgress) { console.log('[LLM] 이미 호출 중 → 스킵'); return null; }

  // 1. LLM 활성화 체크
  if (!isLLMEnabled()) { console.log('[LLM] 비활성화 상태'); return null; }

  // 2. 의미 있는 입력 확인
  if (!isMeaningfulInput(dataType)) { console.log(`[LLM] 의미 없는 입력: ${dataType}`); return null; }

  // 3. 디바운싱
  if (isDebounced(dataType)) { console.log(`[LLM] 디바운싱됨 (5분 내 중복)`); return null; }

  // 4. 한도 체크
  if (isAtDailyLimit()) {
    console.log(`[LLM] 일일 한도 도달 (${CONFIG.dailyLLMCallLimit}회)`);
    logLLMCall({ type: 'limit_reached', dataType });
    return null;
  }

  // 5. 디바운스 설정 + 진행 플래그
  setDebounce(dataType);
  _llmInProgress = true;
  console.log(`[LLM] API 호출 시작...`);

  // 6. 데이터 수집 + 프롬프트 빌드
  const userData = collectUserData(CONFIG.contextSize.baselineDays);
  const prompts = buildFinalPrompt(userData, dataType, justInputData);

  // 7. LLM 호출
  try {
    const startTime = Date.now();
    const result = await callLLMWithRetry(prompts.system, prompts.user);
    const durationMs = Date.now() - startTime;

    // 8. 인사이트 포맷팅
    const insights = result.insights.map((raw, i) => formatInsight(raw, i, dataType));

    // 9. 캐시 저장
    const cache = {
      userId: 'local',
      generatedAt: new Date().toISOString(),
      date: getTodayKey(),
      triggeredBy: dataType,
      insights,
      currentIndex: 0,
    };
    saveLLMCache(cache);

    // 10. 사용량 증가
    incrementDailyUsage(dataType);

    // 11. 로그
    logLLMCall({
      type: 'success',
      dataType,
      durationMs,
      promptTokens: result.usage?.promptTokens,
      outputTokens: result.usage?.outputTokens,
      validationFailed: result.validationFailed || false,
      insightCount: insights.length,
    });

    // 12. 첫 번째 반환
    _llmInProgress = false;
    console.log(`[LLM] 성공! ${insights.length}개 생성 (${durationMs}ms, ${result.usage?.promptTokens}+${result.usage?.outputTokens} tokens)`);
    return insights[0];
  } catch (err) {
    _llmInProgress = false;
    console.error('[LLM] 실패:', err.message);
    logLLMCall({ type: 'error', dataType, error: err.message });
    return null;
  }
}

// ===== 새로고침 (캐시 순환) =====
export function onLLMRefresh() {
  const cache = getLLMCache();
  if (!cache?.insights || cache.insights.length === 0) return null;

  // 오늘 캐시가 아니면 무효
  if (cache.date !== getTodayKey()) return null;

  const nextIndex = (cache.currentIndex + 1) % cache.insights.length;
  cache.currentIndex = nextIndex;
  cache.insights[nextIndex].viewCount = (cache.insights[nextIndex].viewCount || 0) + 1;
  saveLLMCache(cache);
  incrementRefreshCount();

  return cache.insights[nextIndex];
}

// ===== 현재 LLM 인사이트 가져오기 =====
export function getCurrentLLMInsight() {
  const cache = getLLMCache();
  if (!cache?.insights || cache.insights.length === 0) return null;
  if (cache.date !== getTodayKey()) return null;
  return cache.insights[cache.currentIndex || 0];
}

// ===== LLM 인사이트 전체 (DiscoveryPage용) =====
export function getLLMInsights() {
  const cache = getLLMCache();
  if (!cache?.insights || cache.insights.length === 0) return null;
  if (cache.date !== getTodayKey()) return null;

  const idx = cache.currentIndex || 0;
  // 현재 인덱스부터 3개 반환
  const result = [];
  for (let i = 0; i < 3 && i < cache.insights.length; i++) {
    result.push(cache.insights[(idx + i) % cache.insights.length]);
  }
  return result;
}

// ===== 일일 사용량 정보 =====
export function getLLMUsageInfo() {
  const usage = getDailyUsage();
  return {
    callCount: usage.count,
    limit: CONFIG.dailyLLMCallLimit,
    remaining: Math.max(0, CONFIG.dailyLLMCallLimit - usage.count),
    refreshCount: usage.refreshCount || 0,
    isAtLimit: usage.count >= CONFIG.dailyLLMCallLimit,
  };
}

// ===== 기존 데이터로 즉시 LLM 생성 (페이지 로드 / 새로고침 시) =====
export async function generateInsightsNow() {
  if (!isLLMEnabled()) return null;
  if (_llmInProgress) { console.log('[LLM] 이미 호출 중'); return null; }
  if (isAtDailyLimit()) { console.log('[LLM] 일일 한도 도달'); return null; }

  _llmInProgress = true;
  console.log('[LLM] 즉시 생성 시작...');

  const userData = collectUserData(CONFIG.contextSize.baselineDays);
  const prompts = buildFinalPrompt(userData, 'page_load', null);

  try {
    const startTime = Date.now();
    const result = await callLLMWithRetry(prompts.system, prompts.user);
    const durationMs = Date.now() - startTime;
    const insights = result.insights.map((raw, i) => formatInsight(raw, i, 'page_load'));

    saveLLMCache({
      userId: 'local',
      generatedAt: new Date().toISOString(),
      date: getTodayKey(),
      triggeredBy: 'page_load',
      insights,
      currentIndex: 0,
    });

    incrementDailyUsage('page_load');
    logLLMCall({ type: 'success', dataType: 'page_load', durationMs, insightCount: insights.length });

    _llmInProgress = false;
    console.log(`[LLM] 즉시 생성 성공! ${insights.length}개 (${durationMs}ms)`);
    return insights[0];
  } catch (err) {
    _llmInProgress = false;
    console.error('[LLM] 즉시 생성 실패:', err.message);
    logLLMCall({ type: 'error', dataType: 'page_load', error: err.message });
    return null;
  }
}

// ===== 오늘 LLM 캐시 있는지 =====
export function hasLLMCacheToday() {
  const cache = getLLMCache();
  return cache?.date === getTodayKey() && cache?.insights?.length > 0;
}
