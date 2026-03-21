/**
 * 스킨케어 트래커 스토리지
 * 제품 CRUD, 일일 체크, 주간 히스토리, 상관관계 분석
 */

import { getRecords } from './SkinStorage';

const PRODUCTS_KEY = 'nou_tracker_products';
const CHECKS_KEY = 'nou_tracker_checks';
const HISTORY_KEY = 'nou_tracker_history';
const MAX_PRODUCTS = 20;

// ===== 카테고리 =====

export const TRACKER_CATEGORIES = {
  '클렌저':   { emoji: '🫧', color: '#F0C878' },
  '토너':     { emoji: '🍵', color: '#38bdf8' },
  '세럼':     { emoji: '💧', color: '#ADEBB3' },
  '에센스':   { emoji: '✨', color: '#81E4BD' },
  '크림':     { emoji: '🧴', color: '#E06888' },
  '선크림':   { emoji: '☀️', color: '#F0B870' },
  '마스크팩': { emoji: '🎭', color: '#34d399' },
  '기타':     { emoji: '📦', color: '#8888a0' },
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

export function getTrackerChecks() {
  try {
    const raw = JSON.parse(localStorage.getItem(CHECKS_KEY) || '{}');
    if (raw.date !== getTodayStr()) {
      return { date: getTodayStr(), morning: {}, night: {} };
    }
    return raw;
  } catch { return { date: getTodayStr(), morning: {}, night: {} }; }
}

export function toggleTrackerCheck(mode, productId) {
  const checks = getTrackerChecks();
  checks[mode][productId] = !checks[mode][productId];
  checks.date = getTodayStr();
  localStorage.setItem(CHECKS_KEY, JSON.stringify(checks));
  updateHistory(checks);
  return checks;
}

export function getTrackerProgress(mode) {
  const checks = getTrackerChecks();
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

    // 30일분만 유지
    const keys = Object.keys(history).sort();
    while (keys.length > 30) {
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
