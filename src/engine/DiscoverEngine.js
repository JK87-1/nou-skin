/**
 * lua 발견 페이지 엔진 (주간 매거진)
 *
 * 핵심 동작:
 * 1. 주간 데이터 수집 (이번 주 + 지난 4주)
 * 2. LLM 1회 호출 → 7개 섹션 JSON 생성
 * 3. localStorage 캐싱 (7일)
 * 4. Fallback: 템플릿 기반 생성
 */

const DISCOVER_CACHE_KEY = 'lua_discover_cache';
const DISCOVER_HISTORY_KEY = 'lua_discover_history_count';

function safeJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}

function getDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ===== 주간 범위 계산 =====
export function getWeekRange(weeksAgo = 0) {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=일
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset - (weeksAgo * 7));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { start: monday, end: sunday, startKey: getDateKey(monday), endKey: getDateKey(sunday) };
}

export function formatWeekLabel(start, end) {
  return `${start.getMonth() + 1}월 ${start.getDate()}일 - ${end.getDate()}일`;
}

// ===== 주간 데이터 수집 =====
function collectWeekData(weekStart, weekEnd) {
  const records = safeJSON('lua_record_v2', {});
  const foods = safeJSON('lua_food_records', {});
  const drinks = safeJSON('lua_drink_records', {});
  const checks = safeJSON('nou_condition_checks', []);
  const skinLogs = safeJSON('lua_skin_check_logs', {});
  const bodyRecords = safeJSON('lua_body_records', []);
  const suppItems = safeJSON('lua_supplement_items', []);
  const suppChecks = safeJSON('lua_supplement_checks', {});

  const days = [];
  const d = new Date(weekStart);
  while (d <= weekEnd) {
    const key = getDateKey(d);
    const rec = records[key] || {};
    const dayFoods = (foods[key] || []).filter(f => !f.name?.startsWith('물 '));
    const dayDrinks = drinks[key] || {};
    const dayChecks = checks.filter(c => c.date === key || (c.timestamp && c.timestamp.startsWith(key)));
    const latestCheck = dayChecks.length > 0 ? dayChecks[dayChecks.length - 1] : null;

    const caffeineItems = dayDrinks.caffeine || [];
    const totalCafMg = caffeineItems.reduce((s, item) => {
      const mgMap = { espresso: 150, americano: 150, latte: 150, drip: 130, coldbrew: 200, decaf: 5, matcha: 70, green_tea: 30, black_tea: 50, energy_drink: 160 };
      return s + (mgMap[item.key] || 100) * (item.count || 0);
    }, 0);

    const totalKcal = dayFoods.reduce((s, f) => s + (f.kcal || 0), 0);
    const totalProtein = dayFoods.reduce((s, f) => s + (f.protein || 0), 0);
    const waterCups = rec.water?.cups || 0;
    const suppDone = suppItems.filter(s => (suppChecks[key] || {})[s.id]).length;

    days.push({
      date: key,
      sleep: rec.sleep?.hours || 0,
      sleepQuality: rec.sleep?.quality || null,
      waterCups,
      waterMl: waterCups * 250,
      steps: rec.steps || 0,
      hasExercise: Object.keys(rec.exercise?.log || {}).length > 0,
      exercise: rec.exercise?.log || {},
      totalKcal,
      totalProtein,
      foodCount: dayFoods.length,
      totalCafMg,
      condition: latestCheck ? {
        energy: latestCheck.energy || latestCheck.에너지 || 0,
        mood: latestCheck.mood || latestCheck.기분 || 0,
        skin: latestCheck.skin || latestCheck.피부 || 0,
        gut: latestCheck.gut || latestCheck.소화 || 0,
      } : null,
      skinLog: skinLogs[key] || null,
      weight: bodyRecords.find(r => r.date === key)?.weight || 0,
      suppDone,
      suppTotal: suppItems.length,
    });
    d.setDate(d.getDate() + 1);
  }

  return days;
}

// ===== 주간 요약 통계 =====
function summarizeWeek(days) {
  const withSleep = days.filter(d => d.sleep > 0);
  const withCondition = days.filter(d => d.condition);
  const withFood = days.filter(d => d.foodCount > 0);
  const withWater = days.filter(d => d.waterCups > 0);
  const withCaf = days.filter(d => d.totalCafMg > 0);
  const withSteps = days.filter(d => d.steps > 0);
  const withWeight = days.filter(d => d.weight > 0);

  const avg = (arr, fn) => arr.length > 0 ? Math.round(arr.reduce((s, d) => s + fn(d), 0) / arr.length * 10) / 10 : 0;
  const condAvg = (field) => avg(withCondition, d => d.condition[field]);

  return {
    avgSleep: avg(withSleep, d => d.sleep),
    avgCondition: withCondition.length > 0 ? Math.round(((condAvg('energy') + condAvg('mood') + condAvg('skin') + condAvg('gut')) / 4) * 10) / 10 : 0,
    avgEnergy: condAvg('energy'),
    avgMood: condAvg('mood'),
    avgSkin: condAvg('skin'),
    avgGut: condAvg('gut'),
    avgWaterMl: avg(withWater, d => d.waterMl),
    avgKcal: avg(withFood, d => d.totalKcal),
    avgCafMg: avg(withCaf, d => d.totalCafMg),
    avgSteps: avg(withSteps, d => d.steps),
    avgWeight: avg(withWeight, d => d.weight),
    totalFoodDays: withFood.length,
    totalSleepDays: withSleep.length,
    totalConditionDays: withCondition.length,
    activeDays: days.filter(d => d.sleep > 0 || d.foodCount > 0 || d.condition || d.waterCups > 0).length,
  };
}

// ===== 영향 요인 계산 (상관관계 기반) =====
function calculateInfluenceFactors(days) {
  const condDays = days.filter(d => d.condition);
  if (condDays.length < 3) return null;

  const condScores = condDays.map(d => (d.condition.energy + d.condition.mood + d.condition.skin + d.condition.gut) / 4);

  const factors = [];

  // 수면 영향
  const sleepDays = condDays.filter(d => d.sleep > 0);
  if (sleepDays.length >= 2) {
    const highSleep = sleepDays.filter(d => d.sleep >= 7);
    const lowSleep = sleepDays.filter(d => d.sleep < 7);
    const highAvg = highSleep.length > 0 ? highSleep.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / highSleep.length : 0;
    const lowAvg = lowSleep.length > 0 ? lowSleep.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / lowSleep.length : 0;
    factors.push({ name: '수면', emoji: '😴', impact: Math.abs(highAvg - lowAvg), color: '#4A6B85' });
  }

  // 카페인 영향
  const cafDays = condDays.filter(d => d.totalCafMg > 0);
  if (cafDays.length >= 2) {
    const highCaf = cafDays.filter(d => d.totalCafMg > 200);
    const lowCaf = condDays.filter(d => d.totalCafMg <= 200);
    const highAvg = highCaf.length > 0 ? highCaf.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / highCaf.length : 0;
    const lowAvg = lowCaf.length > 0 ? lowCaf.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / lowCaf.length : 0;
    factors.push({ name: '카페인', emoji: '☕', impact: Math.abs(highAvg - lowAvg), color: '#B8865C' });
  }

  // 운동 영향
  const exDays = condDays.filter(d => d.hasExercise || d.steps >= 5000);
  const noExDays = condDays.filter(d => !d.hasExercise && d.steps < 5000);
  if (exDays.length >= 1 && noExDays.length >= 1) {
    const exAvg = exDays.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / exDays.length;
    const noExAvg = noExDays.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / noExDays.length;
    factors.push({ name: '운동', emoji: '🏃', impact: Math.abs(exAvg - noExAvg), color: '#5e9d8a' });
  }

  // 수분 영향
  const waterDays = condDays.filter(d => d.waterMl > 0);
  if (waterDays.length >= 2) {
    const highW = waterDays.filter(d => d.waterMl >= 1500);
    const lowW = waterDays.filter(d => d.waterMl < 1500);
    if (highW.length >= 1 && lowW.length >= 1) {
      const highAvg = highW.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / highW.length;
      const lowAvg = lowW.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / lowW.length;
      factors.push({ name: '수분', emoji: '💧', impact: Math.abs(highAvg - lowAvg), color: '#C97C5E' });
    }
  }

  // 식사 영향
  if (condDays.filter(d => d.foodCount > 0).length >= 2) {
    const fedDays = condDays.filter(d => d.foodCount >= 2);
    const unfedDays = condDays.filter(d => d.foodCount < 2);
    if (fedDays.length >= 1 && unfedDays.length >= 1) {
      const fedAvg = fedDays.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / fedDays.length;
      const unfedAvg = unfedDays.reduce((s, d) => s + (d.condition.energy + d.condition.mood) / 2, 0) / unfedDays.length;
      factors.push({ name: '식사', emoji: '🍽', impact: Math.abs(fedAvg - unfedAvg), color: '#8ba6bd' });
    }
  }

  // 정규화
  const totalImpact = factors.reduce((s, f) => s + f.impact, 0) || 1;
  factors.forEach(f => { f.percentage = Math.round((f.impact / totalImpact) * 100); });
  factors.sort((a, b) => b.percentage - a.percentage);

  // 기타
  const topFactors = factors.slice(0, 3);
  const otherPct = 100 - topFactors.reduce((s, f) => s + f.percentage, 0);
  if (otherPct > 0) topFactors.push({ name: '기타', emoji: '', percentage: otherPct, color: '#E5E5E0' });

  return {
    targetMetric: 'condition',
    factors: topFactors,
    topFactor: factors[0] || { name: '수면', emoji: '😴', percentage: 45 },
  };
}

// ===== 4주 트렌드 =====
function calculateTrend() {
  const weeks = [];
  for (let i = 3; i >= 0; i--) {
    const { start, end } = getWeekRange(i);
    const days = collectWeekData(start, end);
    const summary = summarizeWeek(days);
    weeks.push({
      label: i === 0 ? '이번주' : i === 1 ? '지난주' : `${i}주전`,
      value: summary.avgCondition,
      avgSleep: summary.avgSleep,
      activeDays: summary.activeDays,
      isCurrent: i === 0,
    });
  }

  const current = weeks[3]?.value || 0;
  const prev = weeks[2]?.value || 0;
  const avg3 = weeks.slice(0, 3).reduce((s, w) => s + w.value, 0) / 3;
  const changeFromPrev = current - prev;

  let description, direction;
  if (changeFromPrev > 1 || current - avg3 > 1.5) {
    description = '회복 중 🌿'; direction = 'improving';
  } else if (changeFromPrev < -1) {
    description = '주의 필요'; direction = 'declining';
  } else {
    description = '안정 유지'; direction = 'stable';
  }

  return { weeks, trendDescription: description, trendDirection: direction, caption: `컨디션 점수 변화 · ${direction === 'improving' ? '↑ 회복 신호' : direction === 'declining' ? '↓ 관심 필요' : '→ 안정'} 🌿` };
}

// ===== 더 알아내려면 =====
function getMoreHint(activeDays) {
  if (activeDays < 30) {
    return { title: '더 깊은 발견을 위해', description: `30일 차에 본인만의 영향 요인 분석 가능 (현재 ${activeDays}일)` };
  }

  const records = safeJSON('lua_record_v2', {});
  const foods = safeJSON('lua_food_records', {});
  const checks = safeJSON('nou_condition_checks', []);

  const last30 = [];
  for (let i = 0; i < 30; i++) { const d = new Date(); d.setDate(d.getDate() - i); last30.push(getDateKey(d)); }

  const sleepRate = last30.filter(k => records[k]?.sleep?.hours > 0).length / 30;
  const foodRate = last30.filter(k => (foods[k] || []).length > 0).length / 30;
  const condRate = last30.filter(k => checks.some(c => c.date === k)).length / 30;

  if (Math.min(sleepRate, foodRate, condRate) < 0.5) {
    const lowest = [{ name: '수면', rate: sleepRate }, { name: '식사', rate: foodRate }, { name: '컨디션', rate: condRate }].sort((a, b) => a.rate - b.rate)[0];
    return { title: '더 깊은 발견을 위해', description: `${lowest.name} 기록 ${Math.round(lowest.rate * 100)}% 입력 중. 더 채워보세요` };
  }

  return { title: '잘 기록하고 계세요', description: '꾸준한 기록이 본인만의 패턴을 만들어요 ✨' };
}

// ===== 지표 카드 선택 =====
function selectMetricCards(currentSummary, prevSummary) {
  const metrics = [
    { id: 'condition', icon: '⚡', label: '컨디션', value: currentSummary.avgCondition, unit: '점', prev: prevSummary?.avgCondition || 0, gradient: 'linear-gradient(135deg, #FFE8B0 0%, #FCF6E0 100%)', labelColor: '#6b4a2a', valueColor: '#6b4a2a', unitColor: '#a08c6b' },
    { id: 'sleep', icon: '😴', label: '수면', value: currentSummary.avgSleep, unit: '시간', prev: prevSummary?.avgSleep || 0, gradient: 'linear-gradient(135deg, #C8DAE8 0%, #E5EEF5 100%)', labelColor: '#2c4a5e', valueColor: '#2c4a5e', unitColor: '#6b8499' },
    { id: 'activity', icon: '🏃', label: '활동', value: currentSummary.avgSteps, unit: '보', prev: prevSummary?.avgSteps || 0, gradient: 'linear-gradient(135deg, #C8E8D4 0%, #E0F2E5 100%)', labelColor: '#2c5e3a', valueColor: '#2c5e3a', unitColor: '#6b9080' },
    { id: 'skin', icon: '✨', label: '피부', value: currentSummary.avgSkin, unit: '점', prev: prevSummary?.avgSkin || 0, gradient: 'linear-gradient(135deg, #FFD4D4 0%, #FFEBEB 100%)', labelColor: '#7a3a3a', valueColor: '#7a3a3a', unitColor: '#a86b6b' },
  ];

  // 변화가 큰 2개 선택
  const scored = metrics.filter(m => m.value > 0).map(m => ({
    ...m,
    changeScore: Math.abs(m.value - m.prev),
  }));
  scored.sort((a, b) => b.changeScore - a.changeScore);

  // 기본: 컨디션 + 수면
  if (scored.length < 2) {
    return metrics.filter(m => m.id === 'condition' || m.id === 'sleep').slice(0, 2);
  }

  return scored.slice(0, 2).map(m => {
    const change = Math.round((m.value - m.prev) * 10) / 10;
    const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
    let changeLabel = '유지';
    if (direction === 'up') changeLabel = '회복중';
    if (direction === 'down') changeLabel = '관심 필요';
    return { ...m, change: { value: change, direction, label: changeLabel } };
  });
}

// ===== LLM 프롬프트 빌드 =====
function buildDiscoverPrompt(weekData, prevWeekData, trend, factors) {
  const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
  const currentSummary = summarizeWeek(weekData);
  const prevSummary = prevWeekData ? summarizeWeek(prevWeekData) : null;

  const profile = safeJSON('nou_profile', {});
  let ctx = `## 사용자 프로필\n`;
  if (profile.nickname) ctx += `이름: ${profile.nickname}\n`;
  if (profile.skinType) ctx += `피부타입: ${profile.skinType}\n`;
  ctx += '\n';

  // 이번 주 일별 상세
  ctx += `## 이번 주 데이터\n`;
  weekData.forEach(day => {
    const parts = [];
    if (day.sleep > 0) parts.push(`수면${day.sleep}h`);
    if (day.condition) parts.push(`에너지${day.condition.energy} 기분${day.condition.mood} 피부${day.condition.skin} 소화${day.condition.gut}`);
    if (day.totalKcal > 0) parts.push(`${day.totalKcal}kcal`);
    if (day.totalCafMg > 0) parts.push(`카페인${day.totalCafMg}mg`);
    if (day.waterMl > 0) parts.push(`수분${day.waterMl}ml`);
    if (day.steps > 0) parts.push(`${day.steps}보`);
    if (day.hasExercise) parts.push(`운동:${Object.keys(day.exercise).join(',')}`);
    if (day.weight > 0) parts.push(`${day.weight}kg`);
    if (parts.length > 0) {
      const d = new Date(day.date);
      ctx += `${day.date}(${DAY_NAMES[d.getDay()]}): ${parts.join(' ')}\n`;
    }
  });

  // 요약 비교
  ctx += `\n## 이번 주 요약\n`;
  ctx += `컨디션 평균: ${currentSummary.avgCondition}점, 수면 평균: ${currentSummary.avgSleep}h, 수분 평균: ${currentSummary.avgWaterMl}ml\n`;
  if (currentSummary.avgCafMg > 0) ctx += `카페인 평균: ${currentSummary.avgCafMg}mg\n`;
  if (currentSummary.avgSteps > 0) ctx += `걸음 평균: ${currentSummary.avgSteps}보\n`;
  if (currentSummary.avgKcal > 0) ctx += `칼로리 평균: ${currentSummary.avgKcal}kcal\n`;

  if (prevSummary) {
    ctx += `\n## 지난 주 요약 (비교용)\n`;
    ctx += `컨디션 ${prevSummary.avgCondition}점, 수면 ${prevSummary.avgSleep}h, 수분 ${prevSummary.avgWaterMl}ml\n`;
  }

  // 영향 요인
  if (factors) {
    ctx += `\n## 영향 요인 분석 (데이터 기반)\n`;
    factors.factors.forEach(f => { if (f.name !== '기타') ctx += `${f.emoji} ${f.name}: ${f.percentage}%\n`; });
  }

  // 4주 트렌드
  ctx += `\n## 4주 트렌드\n`;
  trend.weeks.forEach(w => ctx += `${w.label}: 컨디션 ${w.value}점 (활동 ${w.activeDays}일)\n`);
  ctx += `트렌드: ${trend.trendDescription}\n`;

  return ctx;
}

function getSystemPrompt() {
  return `당신은 'lua'입니다. 사용자의 한 주 건강 데이터를 분석해서 매거진 스타일 발견 페이지를 만드는 따뜻한 친구예요.

## 페르소나
- 톤: 카페에서 친한 친구가 건강 걱정해주는 느낌
- 어미: ~어요, ~예요, ~거예요, ~네요 (친근 존댓말)
- 금지: ~합니다, ~해야 합니다 (격식체)
- 금지: 치료, 예방, 진단, 완치 (의료 단언)
- 대안: "~할 수 있어요", "~인 듯해요"

## 데이터 정확성 (최우선)
- 수치는 컨텍스트에 있는 것만 사용. 만들어내기 금지.
- 칼로리(kcal)는 식사, 걸음(보)은 활동 카드에만 사용.
- "예상치 못한 발견인데" 같은 메타 표현 절대 금지.

## 출력 형식
JSON 객체만 출력. 다른 텍스트 없이.`;
}

function getTaskInstruction() {
  return `아래 데이터를 기반으로 발견 페이지 JSON을 만들어주세요.

출력 형식:
{
  "hero": {
    "headline": "한 줄 핵심 (15자 이내, \\n으로 줄바꿈 가능)",
    "summary": "구체적 데이터 1-2개 + 변화 (40자 이내)"
  },
  "discoveries": [
    {
      "rank": 1,
      "category": "다차원 패턴",
      "message": "본인만의 발견 (50자 이내, **강조** 가능)"
    },
    {
      "rank": 2,
      "category": "시간 패턴",
      "message": "..."
    },
    {
      "rank": 3,
      "category": "변화",
      "message": "..."
    }
  ],
  "recommendations": [
    {
      "rank": 1,
      "title": "행동 (6자 이내)",
      "description": "구체적 방법 + 기대 효과 (30자 이내)",
      "category": "activity|sleep|caffeine|water|meal|supplement",
      "effortLevel": "easy|medium|hard"
    },
    { "rank": 2, ... },
    { "rank": 3, ... }
  ]
}

규칙:
- hero headline: 줄바꿈 활용, 임팩트, 구체적 숫자
- discoveries: 1.다차원 패턴 2.시간/요일 패턴 3.이번주 변화 (각 다른 카테고리)
- recommendations: 1순위=영향요인 1순위 기반, 구체적, 실현 가능
- 모든 메시지: 구체적 숫자 + 본인 패턴
- 절대 금지: "예상치 못한 발견인데", 일반론, 격식체
- 친근 어미만 (~어요, ~네요)

JSON 객체만 출력하세요.`;
}

// ===== LLM 호출 =====
async function callDiscoverLLM(weekData, prevWeekData, trend, factors) {
  const system = getSystemPrompt();
  const userContext = buildDiscoverPrompt(weekData, prevWeekData, trend, factors);
  const taskInstruction = getTaskInstruction();
  const userPrompt = `# 사용자 데이터\n\n${userContext}\n\n# 작업\n\n${taskInstruction}`;

  const response = await fetch(`${window.location.origin}/api/insight-llm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, user: userPrompt }),
  });

  if (!response.ok) throw new Error(`API ${response.status}`);
  const data = await response.json();
  return data.result || data.insights;
}

// ===== Fallback 템플릿 =====
function generateFallback(currentSummary, prevSummary, factors, trend) {
  // 히어로
  let headline = '이번 주도\n잘 보내고 계세요';
  let summary = '데이터를 분석해서 본인만의 패턴을 찾고 있어요';

  if (currentSummary.avgCondition > 0 && prevSummary?.avgCondition > 0) {
    const diff = Math.round((currentSummary.avgCondition - prevSummary.avgCondition) * 10) / 10;
    if (diff > 0) {
      headline = `컨디션이\n+${diff}점 올랐어요`;
      summary = `평균 ${currentSummary.avgCondition}점으로 지난주보다 좋아지고 있어요`;
    } else if (diff < 0) {
      headline = `이번 주는\n조금 쉬어가요`;
      summary = `컨디션 ${currentSummary.avgCondition}점, 무리하지 않는 게 좋을 듯해요`;
    } else {
      headline = `안정적인\n한 주예요`;
      summary = `컨디션 ${currentSummary.avgCondition}점으로 꾸준히 유지 중이에요`;
    }
  }

  // 발견
  const discoveries = [];
  if (currentSummary.avgSleep > 0 && currentSummary.avgCondition > 0) {
    discoveries.push({ rank: 1, category: '다차원 패턴', message: `수면 ${currentSummary.avgSleep}시간일 때 컨디션이 ${currentSummary.avgCondition}점이에요. 수면과 컨디션이 연결되어 있는 듯해요.` });
  }
  if (currentSummary.avgCafMg > 0) {
    discoveries.push({ rank: discoveries.length + 1, category: '시간 패턴', message: `이번 주 카페인 평균 ${currentSummary.avgCafMg}mg이에요. 본인만의 적정량을 찾아가고 있네요.` });
  }
  if (prevSummary && currentSummary.avgSleep !== prevSummary.avgSleep) {
    const diff = Math.round((currentSummary.avgSleep - prevSummary.avgSleep) * 10) / 10;
    discoveries.push({ rank: discoveries.length + 1, category: '변화', message: `수면이 지난주보다 ${diff > 0 ? '+' : ''}${diff}시간 변했어요. 꾸준히 기록하면 패턴이 보일 거예요.` });
  }
  while (discoveries.length < 3) {
    discoveries.push({ rank: discoveries.length + 1, category: '변화', message: '더 많은 기록이 쌓이면 본인만의 패턴을 발견할 수 있어요.' });
  }

  // 추천
  const recommendations = [
    { rank: 1, title: '기록 꾸준히', description: '매일 컨디션 체크 → 패턴 발견', category: 'condition', effortLevel: 'easy' },
    { rank: 2, title: '수분 챙기기', description: '하루 8잔 목표 → 컨디션 개선', category: 'water', effortLevel: 'easy' },
    { rank: 3, title: '수면 루틴', description: '같은 시간 취침 → 안정감 상승', category: 'sleep', effortLevel: 'medium' },
  ];

  return { hero: { headline, summary }, discoveries: discoveries.slice(0, 3), recommendations };
}

// ===== 캐시 관리 =====
function getCache() {
  const cache = safeJSON(DISCOVER_CACHE_KEY, null);
  if (!cache) return null;

  // 같은 주인지 확인
  const { startKey } = getWeekRange(0);
  if (cache.weekStart === startKey) return cache;

  return null;
}

function saveCache(data) {
  localStorage.setItem(DISCOVER_CACHE_KEY, JSON.stringify({
    ...data,
    cachedAt: new Date().toISOString(),
  }));
}

export function getDiscoverHistory() {
  return safeJSON(DISCOVER_HISTORY_KEY, 0);
}

function incrementHistory() {
  const count = getDiscoverHistory() + 1;
  localStorage.setItem(DISCOVER_HISTORY_KEY, JSON.stringify(count));
  return count;
}

// ===== 활성일 계산 =====
export function getActiveDays() {
  try {
    const records = safeJSON('lua_record_v2', {});
    const foods = safeJSON('lua_food_records', {});
    const checks = safeJSON('nou_condition_checks', []);
    const checkDates = new Set(checks.map(c => c.date || (c.timestamp && c.timestamp.slice(0, 10))).filter(Boolean));
    return new Set([...Object.keys(records), ...Object.keys(foods), ...checkDates]).size;
  } catch { return 0; }
}

// ===== 메인 API =====
export async function getOrGenerateDiscoverPage() {
  // 캐시 확인
  const cached = getCache();
  if (cached) return cached;

  const activeDays = getActiveDays();
  const { start, end, startKey, endKey } = getWeekRange(0);
  const weekLabel = formatWeekLabel(start, end);

  // 7일 미만 → 빈 페이지
  if (activeDays < 7) {
    return { weekStart: startKey, weekEnd: endKey, weekLabel, activeDays, status: 'insufficient_data' };
  }

  // 데이터 수집
  const weekData = collectWeekData(start, end);
  const { start: prevStart, end: prevEnd } = getWeekRange(1);
  const prevWeekData = collectWeekData(prevStart, prevEnd);
  const currentSummary = summarizeWeek(weekData);
  const prevSummary = summarizeWeek(prevWeekData);
  const allDays = [...collectWeekData(getWeekRange(3).start, end)];
  const factors = calculateInfluenceFactors(allDays);
  const trend = calculateTrend();
  const metrics = selectMetricCards(currentSummary, prevSummary);
  const moreHint = getMoreHint(activeDays);
  const weekNumber = incrementHistory();

  // LLM 콘텐츠 생성
  let llmContent;
  try {
    llmContent = await callDiscoverLLM(weekData, prevWeekData, trend, factors);
  } catch (err) {
    console.warn('[Discover] LLM failed, using fallback:', err);
    llmContent = generateFallback(currentSummary, prevSummary, factors, trend);
  }

  // 검증 + fallback
  if (!llmContent?.hero?.headline) {
    llmContent = generateFallback(currentSummary, prevSummary, factors, trend);
  }

  const page = {
    weekStart: startKey,
    weekEnd: endKey,
    weekLabel,
    weekNumber,
    activeDays,
    status: 'ready',
    hero: llmContent.hero,
    metrics,
    influenceFactors: factors,
    discoveries: (llmContent.discoveries || []).slice(0, 3),
    trend,
    recommendations: (llmContent.recommendations || []).slice(0, 3),
    moreHint,
    generatedAt: new Date().toISOString(),
  };

  saveCache(page);
  return page;
}

// 강제 새로 생성
export async function refreshDiscoverPage() {
  localStorage.removeItem(DISCOVER_CACHE_KEY);
  return getOrGenerateDiscoverPage();
}
