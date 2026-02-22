/**
 * NOU Routine Engine v1.0 — 맞춤형 스킨케어 루틴 생성
 */
import { INGREDIENTS, METRIC_INGREDIENTS, CONFLICTS, ROUTINE_TEMPLATE, WEEKLY_PLAN, STEP_INGREDIENTS } from '../data/SkincareData';

const ingredientMap = Object.fromEntries(INGREDIENTS.map(i => [i.id, i]));

/**
 * 피부 타입 판별 (유분 + 수분 조합)
 */
function determineSkinType(result) {
  const oil = result.oilBalance ?? 50;
  const moisture = result.moisture ?? 50;
  const trouble = result.troubleCount ?? 0;

  if (oil > 65 && moisture < 45) return 'combination';
  if (oil > 65) return 'oily';
  if (oil < 35 && moisture < 45) return 'dry';
  if (oil < 35) return 'dry';
  if (trouble > 8) return 'sensitive';
  return 'normal';
}

/**
 * 메트릭 점수 추출 (trouble은 troubleCount → 점수 변환)
 */
function getMetricScore(result, metricKey) {
  const map = {
    moisture: result.moisture,
    skinTone: result.skinTone,
    trouble: Math.max(0, 100 - (result.troubleCount ?? 0) * 8.5),
    oilBalance: result.oilBalance,
    wrinkles: result.wrinkleScore,
    pores: result.poreScore,
    elasticity: result.elasticityScore,
    pigmentation: result.pigmentationScore,
    texture: result.textureScore,
    darkCircles: result.darkCircleScore,
  };
  return map[metricKey] ?? 50;
}

/**
 * 관심사 추출: 점수 오름차순 → 하위 3개
 */
function extractConcerns(result) {
  const metricLabels = {
    moisture: '수분도', skinTone: '피부톤', trouble: '트러블',
    oilBalance: '유분 밸런스', wrinkles: '주름', pores: '모공',
    elasticity: '탄력', pigmentation: '색소침착', texture: '피부결',
    darkCircles: '다크서클',
  };

  const entries = Object.keys(metricLabels).map(key => ({
    key,
    label: metricLabels[key],
    score: getMetricScore(result, key),
  }));

  entries.sort((a, b) => a.score - b.score);
  return entries.slice(0, 3);
}

/**
 * 성분 수집: threshold 미달 메트릭 → 후보 성분 수집
 */
function collectIngredients(result, skinType) {
  const candidateIds = new Set();
  const oil = result.oilBalance ?? 50;

  for (const [metricKey, config] of Object.entries(METRIC_INGREDIENTS)) {
    // oilBalance 특수 처리
    if (metricKey === 'oilBalanceHigh') {
      if (oil > config.threshold) {
        config.ingredients.forEach(id => candidateIds.add(id));
      }
      continue;
    }
    if (metricKey === 'oilBalanceLow') {
      if (oil < config.threshold) {
        config.ingredients.forEach(id => candidateIds.add(id));
      }
      continue;
    }

    const score = getMetricScore(result, metricKey);
    if (score < config.threshold) {
      config.ingredients.forEach(id => candidateIds.add(id));
    }
  }

  // 피부타입 필터: skinTypes에 'all' 포함이거나 해당 타입 포함
  const filtered = [...candidateIds]
    .map(id => ingredientMap[id])
    .filter(Boolean)
    .filter(ing => ing.skinTypes.includes('all') || ing.skinTypes.includes(skinType));

  // priority 내림차순 정렬
  filtered.sort((a, b) => b.priority - a.priority);

  // 최대 5개 활성성분 제한
  return filtered.slice(0, 5);
}

/**
 * 충돌 해소
 */
function resolveConflicts(ingredients) {
  const ids = new Set(ingredients.map(i => i.id));
  const notes = [];
  const removed = new Set();

  for (const conflict of CONFLICTS) {
    const [a, b] = conflict.pair;
    if (!ids.has(a) || !ids.has(b)) continue;

    if (conflict.resolution === 'pick_one') {
      // 우선순위가 낮은 쪽 제거
      const ingA = ingredientMap[a];
      const ingB = ingredientMap[b];
      const toRemove = ingA.priority >= ingB.priority ? b : a;
      removed.add(toRemove);
      notes.push(conflict.noteKo);
    } else if (conflict.resolution === 'split') {
      // AM/PM 분리 — 성분 유지하되 노트 추가
      notes.push(conflict.noteKo);
    } else if (conflict.resolution === 'alternate') {
      // 교대 사용 — 성분 유지하되 노트 추가
      notes.push(conflict.noteKo);
    }
  }

  const resolved = ingredients.filter(i => !removed.has(i.id));
  return { ingredients: resolved, conflictNotes: notes };
}

/**
 * 관심사 키 목록 추출 (threshold 미달 메트릭)
 */
function getActiveConcernKeys(result) {
  const keys = [];
  const scoreMap = {
    moisture: result.moisture ?? 50,
    skinTone: result.skinTone ?? 50,
    trouble: Math.max(0, 100 - (result.troubleCount ?? 0) * 8.5),
    wrinkles: result.wrinkleScore ?? 50,
    pores: result.poreScore ?? 50,
    elasticity: result.elasticityScore ?? 50,
    pigmentation: result.pigmentationScore ?? 50,
    texture: result.textureScore ?? 50,
    darkCircles: result.darkCircleScore ?? 50,
  };
  for (const [key, score] of Object.entries(scoreMap)) {
    const config = METRIC_INGREDIENTS[key];
    if (config && score < config.threshold) keys.push(key);
  }
  return keys;
}

/**
 * 스텝별 맞춤 성분 조회 (피부타입 + 관심사 기반)
 */
function getStepIngredients(stepName, skinType, concernKeys) {
  const mapping = STEP_INGREDIENTS[stepName];
  if (!mapping) return [];

  const ids = new Set();

  // 피부타입 기본 성분
  const base = mapping.base?.[skinType] || mapping.base?.['normal'] || [];
  base.forEach(id => ids.add(id));

  // 관심사 부스트 성분
  if (mapping.concernBoost) {
    for (const key of concernKeys) {
      const boost = mapping.concernBoost[key];
      if (boost) boost.forEach(id => ids.add(id));
    }
  }

  // ingredientMap에서 실제 데이터 조회, 최대 3개
  return [...ids]
    .map(id => ingredientMap[id])
    .filter(Boolean)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3)
    .map(i => ({ id: i.id, nameKo: i.nameKo, concentration: i.concentration }));
}

/**
 * 루틴 조립: 모든 스텝에 맞춤 성분 배치
 */
function assembleRoutine(template, ingredients, skinType, result) {
  const darkCircleScore = result.darkCircleScore ?? 70;
  const moisture = result.moisture ?? 50;
  const hasExfoliant = ingredients.some(i => ['aha', 'bha'].includes(i.id));
  const concernKeys = getActiveConcernKeys(result);

  return template.map(step => {
    const assembled = {
      ...step,
      form: step.formBySkinType?.[skinType] || step.formBySkinType?.['normal'] || null,
    };

    if (step.type === 'fixed') {
      // 스텝별 맞춤 성분 배치
      assembled.activeIngredients = getStepIngredients(step.nameKo, skinType, concernKeys);
    }

    if (step.type === 'dynamic') {
      // 해당 시간대에 맞는 성분 배치
      const period = template === ROUTINE_TEMPLATE.am ? 'am' : 'pm';
      assembled.activeIngredients = ingredients
        .filter(i => i.period === period || i.period === 'both')
        .filter(i => !['sunscreen'].includes(i.id)) // 선크림은 별도 스텝
        .filter(i => !['aha', 'bha'].includes(i.id)) // 각질케어는 별도 스텝
        .map(i => ({ id: i.id, nameKo: i.nameKo, concentration: i.concentration }));
    }

    if (step.type === 'conditional') {
      if (step.condition === 'darkCircles') {
        assembled.show = darkCircleScore < 60;
        const eyeIngredients = ingredients.filter(i => i.category === '아이케어');
        if (eyeIngredients.length > 0) {
          assembled.activeIngredients = eyeIngredients.map(i => ({ id: i.id, nameKo: i.nameKo, concentration: i.concentration }));
        }
      } else if (step.condition === 'exfoliation') {
        assembled.show = hasExfoliant;
        assembled.activeIngredients = ingredients
          .filter(i => ['aha', 'bha'].includes(i.id))
          .map(i => ({ id: i.id, nameKo: i.nameKo, concentration: i.concentration }));
      } else if (step.condition === 'dryness') {
        assembled.show = moisture < 40 && (skinType === 'dry' || skinType === 'normal');
        assembled.activeIngredients = getStepIngredients(step.nameKo, skinType, concernKeys);
      }
    }

    return assembled;
  });
}

/**
 * 주간 플랜 생성
 */
function buildWeeklyPlan(ingredients) {
  const hasRetinol = ingredients.some(i => i.id === 'retinol');
  const hasExfoliant = ingredients.some(i => ['aha', 'bha'].includes(i.id));

  return WEEKLY_PLAN.map(day => {
    const d = { ...day };
    if (day.type === 'retinol' && !hasRetinol) {
      d.nameKo = '기본 루틴';
      d.icon = '🌿';
      d.descKo = '기본 모닝/이브닝 루틴만 수행';
      d.type = 'basic';
    }
    if (day.type === 'exfoliation' && !hasExfoliant) {
      d.nameKo = '기본 루틴';
      d.icon = '🌿';
      d.descKo = '기본 모닝/이브닝 루틴만 수행';
      d.type = 'basic';
    }
    return d;
  });
}

/**
 * 메인 함수: generateRoutine
 */
export function generateRoutine(result) {
  const skinType = determineSkinType(result);
  const topConcerns = extractConcerns(result);
  const rawIngredients = collectIngredients(result, skinType);
  const { ingredients, conflictNotes } = resolveConflicts(rawIngredients);

  const morningRoutine = assembleRoutine(ROUTINE_TEMPLATE.am, ingredients, skinType, result);
  const eveningRoutine = assembleRoutine(ROUTINE_TEMPLATE.pm, ingredients, skinType, result);
  const weeklyPlan = buildWeeklyPlan(ingredients);

  return {
    skinType,
    topConcerns,
    recommendedIngredients: ingredients,
    morningRoutine,
    eveningRoutine,
    weeklyPlan,
    conflictNotes,
  };
}
