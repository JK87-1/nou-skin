/**
 * 스킨케어 트래커 스토리지
 * 제품 CRUD, 일일 체크, 주간 히스토리, 상관관계 분석
 */

import { getRecords } from './SkinStorage';

const PRODUCTS_KEY = 'nou_tracker_products';
const CHECKS_KEY = 'nou_tracker_checks';     // 호환성: 오늘 체크만 빠르게 (기존 사용처 유지)
const HISTORY_KEY = 'nou_tracker_history';   // 일자별 집계(완료/부분)
const DAILY_CHECKS_KEY = 'nou_tracker_daily'; // 일자별 개별 제품 체크 — 과거 날짜 수정용
const MAX_PRODUCTS = 20;
const HISTORY_RETENTION_DAYS = 60; // 케어 캘린더에서 거슬러 올라갈 수 있는 기간

// ===== 카테고리 =====

export const TRACKER_CATEGORIES = {
  '클렌저':   { emoji: '', color: '#F0C878' },
  '토너':     { emoji: '', color: '#38bdf8' },
  '세럼':     { emoji: '', color: '#ADEBB3' },
  '에센스':   { emoji: '', color: '#81E4BD' },
  '크림':     { emoji: '', color: '#E06888' },
  '선크림':   { emoji: '', color: '#F0B870' },
  '마스크팩': { emoji: '', color: '#34d399' },
  '기타':     { emoji: '', color: '#8888a0' },
};

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(a, b) {
  return Math.floor((new Date(b) - new Date(a)) / 86400000);
}

// ===== 제품 CRUD =====

export function getProducts() {
  try {
    return JSON.parse(localStorage.getItem(PRODUCTS_KEY) || '[]');
  } catch { return []; }
}

export function getProduct(id) {
  return getProducts().find(p => p.id === id) || null;
}

export function saveProduct(product) {
  const products = getProducts();
  const idx = products.findIndex(p => p.id === product.id);
  if (idx >= 0) {
    products[idx] = { ...products[idx], ...product };
  } else {
    if (products.length >= MAX_PRODUCTS) throw new Error('최대 20개까지 등록할 수 있어요.');
    const newProduct = {
      id: String(Date.now()),
      brand: '',
      name: '',
      category: '기타',
      timeSlot: 'both',
      startDate: getTodayStr(),
      imageThumb: null,
      ingredients: null,
      ...product,
    };
    products.push(newProduct);
  }
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  return products;
}

export function deleteProduct(id) {
  const products = getProducts().filter(p => p.id !== id);
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  // 체크에서도 제거
  const checks = getTrackerChecks();
  delete checks.morning[id];
  delete checks.night[id];
  localStorage.setItem(CHECKS_KEY, JSON.stringify(checks));
  return products;
}

export function getProductCount() {
  return getProducts().length;
}

export function getProductsForMode(mode) {
  return getProducts().filter(p => p.timeSlot === mode || p.timeSlot === 'both');
}

// ===== 일일 체크 =====

/**
 * 일자별 체크 조회. dateStr 없으면 오늘.
 * 오늘은 CHECKS_KEY(기존)와 DAILY_CHECKS_KEY 양쪽에서 병합 — 기존 데이터 호환.
 */
export function getTrackerChecks(dateStr) {
  const date = dateStr || getTodayStr();

  // 오늘 — 기존 CHECKS_KEY 우선 (호환)
  if (date === getTodayStr()) {
    try {
      const raw = JSON.parse(localStorage.getItem(CHECKS_KEY) || '{}');
      if (raw.date === date) return raw;
    } catch {}
  }

  // 그 외 — DAILY_CHECKS_KEY
  try {
    const daily = JSON.parse(localStorage.getItem(DAILY_CHECKS_KEY) || '{}');
    const entry = daily[date];
    return {
      date,
      morning: entry?.morning || {},
      night: entry?.night || {},
    };
  } catch {
    return { date, morning: {}, night: {} };
  }
}

function saveDailyChecks(date, checks) {
  try {
    const daily = JSON.parse(localStorage.getItem(DAILY_CHECKS_KEY) || '{}');
    daily[date] = {
      morning: { ...(checks.morning || {}) },
      night: { ...(checks.night || {}) },
    };
    // retention 적용 — 오래된 날짜부터 삭제
    const keys = Object.keys(daily).sort();
    while (keys.length > HISTORY_RETENTION_DAYS) {
      delete daily[keys.shift()];
    }
    localStorage.setItem(DAILY_CHECKS_KEY, JSON.stringify(daily));
  } catch { /* ignore */ }
}

/**
 * 제품 체크 토글. dateStr 없으면 오늘.
 * 오늘은 CHECKS_KEY + DAILY_CHECKS_KEY 양쪽 저장 (기존 호환). 과거는 DAILY_CHECKS_KEY만.
 */
export function toggleTrackerCheck(mode, productId, dateStr) {
  const date = dateStr || getTodayStr();
  const checks = getTrackerChecks(date);
  checks[mode][productId] = !checks[mode][productId];
  checks.date = date;

  // 오늘은 기존 CHECKS_KEY에도 저장 (consult.js getProductsWithUsageContext 호환)
  if (date === getTodayStr()) {
    try { localStorage.setItem(CHECKS_KEY, JSON.stringify(checks)); } catch {}
  }
  saveDailyChecks(date, checks);
  updateHistory(checks);
  return checks;
}

export function getTrackerProgress(mode, dateStr) {
  const checks = getTrackerChecks(dateStr);
  const products = getProductsForMode(mode);
  const done = products.filter(p => checks[mode][p.id]).length;
  return { done, total: products.length };
}

// ===== 주간 히스토리 =====

function updateHistory(checks) {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
    const products = getProducts();
    const mornProds = products.filter(p => p.timeSlot === 'morning' || p.timeSlot === 'both');
    const nightProds = products.filter(p => p.timeSlot === 'night' || p.timeSlot === 'both');
    const mornDone = mornProds.filter(p => checks.morning[p.id]).length;
    const nightDone = nightProds.filter(p => checks.night[p.id]).length;
    const mornTotal = mornProds.length;
    const nightTotal = nightProds.length;

    history[checks.date] = {
      mornDone, mornTotal, nightDone, nightTotal,
      completed: (mornTotal === 0 || mornDone === mornTotal) && (nightTotal === 0 || nightDone === nightTotal) && (mornTotal + nightTotal > 0),
      partial: (mornDone + nightDone) > 0,
    };

    // retention 적용
    const keys = Object.keys(history).sort();
    while (keys.length > HISTORY_RETENTION_DAYS) {
      delete history[keys.shift()];
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch { /* ignore */ }
}

export function getTrackerWeekly() {
  const history = (() => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}'); } catch { return {}; } })();
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const labels = ['월', '화', '수', '목', '금', '토', '일'];

  return labels.map((label, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + mondayOffset + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const h = history[dateStr];
    const isToday = dateStr === getTodayStr();
    return {
      dayLabel: label,
      date: dateStr,
      isToday,
      completed: h?.completed || false,
      partial: h?.partial || false,
    };
  });
}

// ===== 상담사용 종합 컨텍스트 (AI 뷰티 에이전트) =====

/**
 * 특정 제품의 최근 N일 사용 기록을 일자별로 반환.
 * 상담사 prompt에서 "오늘 미체크여도 어제·그제 사용 인지" 위해 사용.
 */
export function getProductRecentUsage(productId, days = 7) {
  const out = [];
  let daily = {};
  try { daily = JSON.parse(localStorage.getItem(DAILY_CHECKS_KEY) || '{}'); } catch {}

  // 오늘 체크는 CHECKS_KEY에서 별도로 (호환)
  let todayChecks = null;
  try {
    const raw = JSON.parse(localStorage.getItem(CHECKS_KEY) || '{}');
    if (raw.date === getTodayStr()) todayChecks = raw;
  } catch {}

  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const isToday = dateStr === getTodayStr();
    const entry = isToday && todayChecks ? todayChecks : daily[dateStr];
    out.push({
      date: dateStr,
      morning: !!entry?.morning?.[productId],
      night: !!entry?.night?.[productId],
    });
  }
  return out; // 최신 → 과거 순
}

/**
 * 등록 제품 + 오늘 아침/저녁 체크 여부 + 등록 후 경과일 + 최근 7일 사용 패턴.
 * consult API에 보낼 products 컨텍스트로 사용.
 */
export function getProductsWithUsageContext() {
  const products = getProducts();
  const todayChecks = getTrackerChecks();
  const now = Date.now();

  return products.map(p => {
    const todayUsedMorning = !!todayChecks.morning?.[p.id];
    const todayUsedNight = !!todayChecks.night?.[p.id];
    const daysSinceRegistered = p.startDate
      ? Math.floor((now - new Date(p.startDate).getTime()) / 86400000)
      : null;

    let usedToday;
    if (p.timeSlot === 'morning') usedToday = todayUsedMorning;
    else if (p.timeSlot === 'night') usedToday = todayUsedNight;
    else usedToday = todayUsedMorning || todayUsedNight; // both: 둘 중 하나라도

    // 최근 7일 사용 패턴 — "어제·그제 발랐는지" 인지용
    const recent7 = getProductRecentUsage(p.id, 7);
    const usedDaysIn7 = recent7.filter(d => d.morning || d.night).length;
    const lastUsedDate = recent7.find(d => d.morning || d.night)?.date || null;
    const daysSinceLastUsed = lastUsedDate
      ? Math.floor((now - new Date(lastUsedDate + 'T12:00:00').getTime()) / 86400000)
      : null;

    return {
      brand: p.brand,
      name: p.name,
      category: p.category,
      timeSlot: p.timeSlot, // 'morning' | 'night' | 'both'
      ingredients: p.ingredients,
      startDate: p.startDate,
      daysSinceRegistered,        // 등록 후 N일 — 효과 평가 시점 판단
      todayUsedMorning,           // 오늘 아침 체크
      todayUsedNight,             // 오늘 저녁 체크
      usedToday,                  // 시간대 기준 오늘 사용 여부
      recent7,                    // 최근 7일 [{date, morning, night}, ...] 최신 → 과거
      usedDaysIn7,                // 최근 7일 중 사용한 일수
      lastUsedDate,               // 마지막 사용 일자 (없으면 null)
      daysSinceLastUsed,          // 마지막 사용 후 경과일
    };
  });
}

/**
 * 오늘 루틴 진행도 + 주간 완수율.
 * "꾸준한 사용자" 판단에 활용.
 */
export function getRoutineSnapshot() {
  const morning = getTrackerProgress('morning');
  const night = getTrackerProgress('night');
  const weekly = getTrackerWeekly();
  const completedDays = weekly.filter(w => w.completed).length;
  const partialDays = weekly.filter(w => w.partial && !w.completed).length;

  return {
    today: {
      morning: { done: morning.done, total: morning.total, percent: morning.total > 0 ? Math.round((morning.done / morning.total) * 100) : null },
      night: { done: night.done, total: night.total, percent: night.total > 0 ? Math.round((night.done / night.total) * 100) : null },
    },
    weekly: {
      completedDays,           // 모든 루틴 완수한 일수 / 7
      partialDays,             // 일부만 완수한 일수
      skippedDays: 7 - completedDays - partialDays,
    },
  };
}

// ===== 상관관계 분석 =====

const METRIC_KEYS = [
  { key: 'moisture', label: '수분' },
  { key: 'skinTone', label: '피부톤' },
  { key: 'wrinkleScore', label: '주름' },
  { key: 'poreScore', label: '모공' },
  { key: 'elasticityScore', label: '탄력' },
  { key: 'pigmentationScore', label: '색소침착' },
  { key: 'textureScore', label: '피부결' },
  { key: 'darkCircleScore', label: '다크서클' },
  { key: 'oilBalance', label: '유수분' },
  { key: 'troubleCount', label: '트러블', inverse: true },
];

function generateInsight(product, topMetrics, days) {
  if (!topMetrics.length) return '아직 충분한 데이터가 없어요. 꾸준히 측정하면서 확인해보세요.';
  const best = topMetrics[0];
  const ingNote = product.ingredients?.length
    ? `${product.ingredients[0]}이(가) ` : '';
  if (best.improved) {
    return `${ingNote}${best.label} 개선에 효과적입니다. 사용 시작 ${days}일 후 ${best.label}이(가) ${best.diff}점 변화했어요.`;
  }
  return `${best.label}이(가) ${Math.abs(parseFloat(best.diff))}점 하락했지만, 적응기 반응일 수 있어요. 2주 이상 꾸준히 사용 후 다시 확인해보세요.`;
}

export function computeCorrelation(product) {
  const records = getRecords().filter(r => !r.differentPerson);
  if (records.length < 2) return null;

  // baseline: startDate 이전 가장 가까운 기록
  let baseline = null;
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].date <= product.startDate) { baseline = records[i]; break; }
  }
  if (!baseline) baseline = records[0];

  const latest = records[records.length - 1];
  const periodRecords = records.filter(r => r.date >= product.startDate);
  const days = Math.max(0, daysBetween(product.startDate, latest.date));

  // 지표별 변화량
  const metrics = [];
  for (const m of METRIC_KEYS) {
    const before = baseline[m.key];
    const after = latest[m.key];
    if (typeof before !== 'number' || typeof after !== 'number') continue;
    const rawDiff = after - before;
    const improved = m.inverse ? rawDiff < 0 : rawDiff > 0;
    const displayDiff = m.inverse ? -rawDiff : rawDiff;
    metrics.push({
      label: m.label, key: m.key, before, after,
      diff: (displayDiff > 0 ? '+' : '') + displayDiff.toFixed(1),
      improved,
      absDiff: Math.abs(rawDiff),
    });
  }

  metrics.sort((a, b) => b.absDiff - a.absDiff);
  const topMetrics = metrics.filter(m => m.absDiff >= 1).slice(0, 3);

  // 차트 데이터
  const chartKey = topMetrics[0]?.key || 'moisture';
  const chart = periodRecords.map(r => r[chartKey] ?? 0);

  // 신뢰도
  let confidence;
  if (days >= 14 && periodRecords.length >= 5) confidence = '높음';
  else if (days >= 7 && periodRecords.length >= 3) confidence = '보통';
  else confidence = '낮음';

  return {
    productId: product.id,
    productName: product.name,
    brand: product.brand,
    category: product.category,
    days,
    metrics: topMetrics,
    confidence,
    chart: chart.length >= 2 ? chart : null,
    insight: generateInsight(product, topMetrics, days),
  };
}

export function computeAllCorrelations() {
  const products = getProducts();
  return products
    .map(p => computeCorrelation(p))
    .filter(Boolean)
    .sort((a, b) => b.days - a.days);
}

// ===== 썸네일 =====

export function compressProductThumb(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const size = 100;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
