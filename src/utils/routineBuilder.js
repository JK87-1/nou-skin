/**
 * routineBuilder — 측정 결과 + 등록 제품 → 표준 스킨케어 순서 + 매일/가끔 분류.
 *
 * CareRecommendation UI와 consult prompt context가 같은 결과를 공유하기 위한
 * 단일 helper. 로직 변경 시 한 곳만 수정.
 */

import { getProductTimeSlot } from '../data/ProductCatalog';

// 성분 → 약점 메트릭 매핑 (consult prompt와 동일 룰)
export const INGREDIENT_METRIC_MAP = {
  moisture:           { label: '수분',     ingredients: ['히알루론산', '히아루론', '세라마이드', '글리세린', '판테놀', 'NMF', '스쿠알란', 'hyaluron', 'ceramide', 'glycerin', 'squalane'] },
  pigmentationScore:  { label: '색소',     ingredients: ['비타민C', '나이아신아마이드', '나이아신', '알부틴', '트라넥삼', '코직', '글루타치온', 'vitamin c', 'niacinamide', 'arbutin', 'tranexamic'] },
  oilBalance:         { label: '유분',     ingredients: ['살리실', '녹차', '아연', '티트리', '시카', 'salicylic', 'tea tree', 'zinc', 'centella'] },
  troubleCount:       { label: '트러블',   ingredients: ['살리실', '티트리', '아연', '시카', '판테놀', '센텔라', 'salicylic', 'centella', 'panthenol', 'tea tree'] },
  wrinkleScore:       { label: '주름',     ingredients: ['레티놀', '레티날', '펩타이드', '아데노신', '바쿠치올', 'retinol', 'peptide', 'bakuchiol', 'adenosine'] },
  elasticityScore:    { label: '탄력',     ingredients: ['펩타이드', 'EGF', '콜라겐', '아데노신', '레티놀', 'peptide', 'collagen', 'retinol'] },
  textureScore:       { label: '피부결',   ingredients: ['AHA', 'PHA', 'BHA', '글리콜', '락트산', 'glycolic', 'lactic'] },
  poreScore:          { label: '모공',     ingredients: ['BHA', '나이아신아마이드', '나이아신', '녹차', '살리실', 'niacinamide', 'salicylic'] },
  darkCircleScore:    { label: '다크서클', ingredients: ['카페인', '비타민K', '펩타이드', '나이아신아마이드', 'caffeine', 'vitamin k', 'peptide'] },
  skinTone:           { label: '피부톤',   ingredients: ['나이아신아마이드', '비타민C', '알부틴', '감초', 'niacinamide', 'vitamin c'] },
};

// 표준 스킨케어 순서
export const MORNING_STEPS = [
  { step: 1, label: '클렌저', categoryKeys: ['클렌저'], hint: '가볍게 세안' },
  { step: 2, label: '토너', categoryKeys: ['토너'], hint: '수분 첫 단계' },
  { step: 3, label: '세럼·앰플', categoryKeys: ['세럼', '에센스'], hint: '핵심 성분 흡수' },
  { step: 4, label: '크림', categoryKeys: ['크림'], hint: '수분 가둠' },
  { step: 5, label: '선크림', categoryKeys: ['선크림'], hint: '꼭 발라야 색소·주름 막아요' },
];

export const NIGHT_STEPS = [
  { step: 1, label: '클렌저', categoryKeys: ['클렌저'], hint: '하루 노폐물 제거' },
  { step: 2, label: '토너', categoryKeys: ['토너'], hint: '결 정리' },
  { step: 3, label: '세럼·앰플', categoryKeys: ['세럼', '에센스'], hint: '액티브 케어' },
  { step: 4, label: '크림', categoryKeys: ['크림'], hint: '밤사이 복원' },
  { step: 5, label: '마스크팩', categoryKeys: ['마스크팩'], hint: '주 2~3회 집중 케어', frequencyTag: '주 2~3회' },
];

export function getMatchedIngredients(product, metricKey) {
  const keywords = INGREDIENT_METRIC_MAP[metricKey]?.ingredients || [];
  const text = [
    product.name || '',
    product.brand || '',
    typeof product.ingredients === 'string' ? product.ingredients : (Array.isArray(product.ingredients) ? product.ingredients.join(' ') : ''),
    ...(product.tags || []),
  ].join(' ').toLowerCase();
  const matched = [];
  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase()) && !matched.includes(kw)) matched.push(kw);
  }
  return matched;
}

export function getWeakMetrics(result) {
  if (!result) return [];
  const candidates = [
    { key: 'moisture',          val: result.moisture },
    { key: 'pigmentationScore', val: result.pigmentationScore },
    { key: 'wrinkleScore',      val: result.wrinkleScore },
    { key: 'elasticityScore',   val: result.elasticityScore },
    { key: 'textureScore',      val: result.textureScore },
    { key: 'poreScore',         val: result.poreScore },
    { key: 'darkCircleScore',   val: result.darkCircleScore },
    { key: 'skinTone',          val: result.skinTone },
    { key: 'troubleCount',      val: result.troubleCount > 3 ? (100 - result.troubleCount * 8) : 100, raw: result.troubleCount },
  ];
  return candidates
    .filter(m => typeof m.val === 'number' && m.val < 65)
    .sort((a, b) => a.val - b.val);
}

function analyzeProduct(product, weakMetrics) {
  const slot = (product.timeSlot === 'morning' || product.timeSlot === 'night' || product.timeSlot === 'both')
    ? product.timeSlot
    : getProductTimeSlot(product);

  const matchedMetrics = [];
  for (const wm of weakMetrics) {
    const ings = getMatchedIngredients(product, wm.key);
    if (ings.length > 0) {
      matchedMetrics.push({
        key: wm.key,
        label: INGREDIENT_METRIC_MAP[wm.key]?.label || wm.key,
        val: wm.raw != null ? `${wm.raw}개` : `${wm.val}점`,
        ingredients: ings,
      });
    }
  }
  return {
    ...product,
    slot,
    matchedMetrics,
    score: matchedMetrics.length * 10 + matchedMetrics.reduce((s, m) => s + m.ingredients.length, 0),
  };
}

function rankInStep(products) {
  const sorted = [...products].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aTs = a.startDate ? new Date(a.startDate).getTime() : 0;
    const bTs = b.startDate ? new Date(b.startDate).getTime() : 0;
    return aTs - bTs;
  });
  return sorted.map((p, idx) => ({ ...p, priority: idx < 2 ? 'daily' : 'occasional' }));
}

function buildRoutineSection(timeSlot, steps, analyzed) {
  return steps.map(stepDef => {
    const matched = analyzed.filter(p => {
      const slotOk = p.slot === timeSlot || p.slot === 'both';
      const categoryOk = stepDef.categoryKeys.includes(p.category);
      return slotOk && categoryOk;
    });
    const ranked = rankInStep(matched);
    return { ...stepDef, products: ranked };
  }).filter(s => s.products.length > 0);
}

/**
 * 최상위 helper. CareRecommendation UI + consult context가 공유.
 * @returns { morning, night, stats, hasManyProducts }
 */
export function buildRoutineRecommendation(result, products) {
  if (!products || products.length === 0) {
    return { morning: [], night: [], stats: { morning: { daily: 0, occasional: 0, total: 0 }, night: { daily: 0, occasional: 0, total: 0 } }, hasManyProducts: false };
  }
  const weakMetrics = getWeakMetrics(result);
  const analyzed = products.map(p => analyzeProduct(p, weakMetrics));

  const morning = buildRoutineSection('morning', MORNING_STEPS, analyzed);
  const night = buildRoutineSection('night', NIGHT_STEPS, analyzed);

  const countStats = (section) => {
    let daily = 0, occasional = 0;
    for (const s of section) {
      for (const p of s.products) {
        if (p.priority === 'daily') daily++;
        else occasional++;
      }
    }
    return { daily, occasional, total: daily + occasional };
  };

  const morningStats = countStats(morning);
  const nightStats = countStats(night);

  return {
    morning,
    night,
    stats: { morning: morningStats, night: nightStats },
    hasManyProducts: morningStats.occasional + nightStats.occasional >= 3,
  };
}

/**
 * consult API context용 슬림 직렬화 — prompt에 넣을 핵심 정보만.
 * 큰 객체 그대로 보내면 token 낭비.
 */
export function serializeRoutineForPrompt(rec) {
  if (!rec) return null;
  const slim = (section) => section.map(s => ({
    step: s.step,
    label: s.label,
    products: s.products.map(p => ({
      brand: p.brand,
      name: p.name,
      priority: p.priority,
      matched: p.matchedMetrics.slice(0, 2).map(m => `${m.label}(${m.ingredients[0]})`),
    })),
  }));
  return {
    morning: slim(rec.morning),
    night: slim(rec.night),
    morningDaily: rec.stats.morning.daily,
    morningOccasional: rec.stats.morning.occasional,
    nightDaily: rec.stats.night.daily,
    nightOccasional: rec.stats.night.occasional,
    hasManyProducts: rec.hasManyProducts,
  };
}
