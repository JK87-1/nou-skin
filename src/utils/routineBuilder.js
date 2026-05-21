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

// ===== 성분 충돌·시너지 룰 (피부과학 기반) =====
// 각 룰은 두 ingredient group을 가짐. 둘 다 라인업에 있으면 발동.

const CONFLICT_RULES = [
  {
    id: 'retinol_acid',
    severity: 'high',
    title: '레티놀 + 산성 각질제',
    groups: [['레티놀', '레티날', 'retinol'], ['글리콜', '락트산', '살리실', 'aha', 'bha', 'glycolic', 'lactic', 'salicylic']],
    advice: '둘 다 자극이 강해 같은 날 쓰면 피부 장벽이 약해질 수 있어요. 다른 날 번갈아 발라주세요.',
  },
  {
    id: 'retinol_vitc',
    severity: 'medium',
    title: '레티놀 + 비타민C',
    groups: [['레티놀', '레티날', 'retinol'], ['비타민c', '아스코빌', 'vitamin c', 'ascorb']],
    advice: '산성·알칼리 차이로 효과가 떨어질 수 있어요. 비타민C는 아침, 레티놀은 저녁으로 나눠 발라주세요.',
  },
  {
    id: 'acid_vitc',
    severity: 'medium',
    title: '산성 각질제 + 비타민C',
    groups: [['글리콜', '락트산', '살리실', 'aha', 'bha', 'glycolic', 'lactic', 'salicylic'], ['비타민c', '아스코빌', 'vitamin c', 'ascorb']],
    advice: 'pH가 모두 낮아 자극이 누적될 수 있어요. 시간대를 나누거나 격일로 사용해주세요.',
  },
  {
    id: 'vitc_niacin',
    severity: 'low',
    title: '비타민C + 나이아신아마이드',
    groups: [['비타민c', '아스코빌', 'vitamin c', 'ascorb'], ['나이아신아마이드', '나이아신', 'niacinamide']],
    advice: '최근 연구에선 같이 써도 무방하지만, 민감 피부면 시간대 나눠 발라주는 게 안전해요.',
  },
];

const SYNERGY_RULES = [
  {
    id: 'hyaluron_ceramide',
    title: '히알루론산 + 세라마이드',
    groups: [['히알루론산', '히아루론', 'hyaluron'], ['세라마이드', 'ceramide']],
    advice: '수분 끌어들이는 히알루론산과 가두는 세라마이드 — 보습 시너지가 큰 조합이에요.',
  },
  {
    id: 'niacin_peptide',
    title: '나이아신아마이드 + 펩타이드',
    groups: [['나이아신아마이드', '나이아신', 'niacinamide'], ['펩타이드', 'peptide']],
    advice: '색소와 탄력을 동시에 케어할 수 있어요. 매일 같은 루틴에 자연스럽게 어울려요.',
  },
  {
    id: 'vitc_vite',
    title: '비타민C + 비타민E',
    groups: [['비타민c', '아스코빌', 'vitamin c'], ['비타민e', '토코페롤', 'vitamin e', 'tocopherol']],
    advice: '항산화 시너지 — 두 성분이 서로의 효능을 안정시켜요.',
  },
];

function flattenIngredients(products) {
  return products.map(p => {
    const text = [
      p.name || '',
      p.brand || '',
      typeof p.ingredients === 'string' ? p.ingredients : (Array.isArray(p.ingredients) ? p.ingredients.join(' ') : ''),
      ...(p.tags || []),
    ].join(' ').toLowerCase();
    return { id: p.id, brand: p.brand, name: p.name, text };
  });
}

function findProductsContaining(productsFlat, keywords) {
  return productsFlat.filter(p => keywords.some(k => p.text.includes(k.toLowerCase())));
}

/**
 * 등록 제품 간 충돌·시너지·과다 등록을 감지.
 */
export function detectInteractions(products) {
  if (!products || products.length === 0) {
    return { conflicts: [], synergies: [], overuse: [] };
  }
  const flat = flattenIngredients(products);

  const conflicts = [];
  for (const rule of CONFLICT_RULES) {
    const g1 = findProductsContaining(flat, rule.groups[0]);
    const g2 = findProductsContaining(flat, rule.groups[1]);
    if (g1.length === 0 || g2.length === 0) continue;
    // 양 group에 동시 포함된 제품은 제외 (같은 제품 안에 두 성분 들어있는 건 제품 자체 포뮬레이션)
    const distinct = (a, b) => a.some(x => !b.find(y => y.id === x.id));
    if (!distinct(g1, g2) && !distinct(g2, g1)) continue;
    conflicts.push({
      id: rule.id, severity: rule.severity, title: rule.title, advice: rule.advice,
      products: [
        ...g1.slice(0, 2).map(p => `${p.brand || ''} ${p.name || ''}`.trim()),
        ...g2.slice(0, 2).map(p => `${p.brand || ''} ${p.name || ''}`.trim()),
      ].filter(Boolean).slice(0, 3),
    });
  }

  const synergies = [];
  for (const rule of SYNERGY_RULES) {
    const g1 = findProductsContaining(flat, rule.groups[0]);
    const g2 = findProductsContaining(flat, rule.groups[1]);
    if (g1.length === 0 || g2.length === 0) continue;
    synergies.push({
      id: rule.id, title: rule.title, advice: rule.advice,
      products: [
        ...g1.slice(0, 1).map(p => `${p.brand || ''} ${p.name || ''}`.trim()),
        ...g2.slice(0, 1).map(p => `${p.brand || ''} ${p.name || ''}`.trim()),
      ].filter(Boolean),
    });
  }

  // 같은 카테고리 다종 (3종 이상)
  const overuse = [];
  const byCategory = {};
  for (const p of products) {
    const c = p.category || '기타';
    if (!byCategory[c]) byCategory[c] = [];
    byCategory[c].push(p);
  }
  for (const [cat, items] of Object.entries(byCategory)) {
    if (items.length >= 3 && /앰플|세럼|에센스|크림/.test(cat)) {
      overuse.push({
        category: cat,
        count: items.length,
        advice: `${cat} ${items.length}종을 매일 다 발라주시면 영양 과다·각질 누적으로 피부톤이 칙칙해질 수 있어요. 2개로 줄이고 나머지는 가끔만.`,
      });
    }
  }

  return { conflicts, synergies, overuse };
}

/** consult prompt용 — 가벼운 직렬화 */
export function serializeInteractionsForPrompt(interactions) {
  if (!interactions) return null;
  return {
    conflicts: (interactions.conflicts || []).map(c => ({
      severity: c.severity, title: c.title, advice: c.advice,
      products: c.products,
    })),
    synergies: (interactions.synergies || []).map(s => ({
      title: s.title, advice: s.advice, products: s.products,
    })),
    overuse: (interactions.overuse || []).map(o => ({
      category: o.category, count: o.count, advice: o.advice,
    })),
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
