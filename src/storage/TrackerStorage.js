/**
 * 스킨케어 트래커 스토리지
 * 제품 CRUD, 일일 체크, 주간 히스토리, 상관관계 분석
 */

import { getRecords } from './SkinStorage';
import { setProductThumb, deleteProductThumb } from './ImageStore';

const PRODUCTS_KEY = 'nou_tracker_products';
const CHECKS_KEY = 'nou_tracker_checks';     // 호환성: 오늘 체크만 빠르게 (기존 사용처 유지)
const HISTORY_KEY = 'nou_tracker_history';   // 일자별 집계(완료/부분)
const DAILY_CHECKS_KEY = 'nou_tracker_daily'; // 일자별 개별 제품 체크 — 과거 날짜 수정용
const MAX_PRODUCTS = 30;
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

function normKey(brand, name) {
  return `${(brand || '').replace(/\s+/g, '').toLowerCase()}|${(name || '').replace(/\s+/g, '').toLowerCase()}`;
}

export function saveProduct(product, opts = {}) {
  // imageThumb는 localStorage가 아닌 IndexedDB(ImageStore)에 분리 저장.
  // 여기서는 thumb를 변수로 잡아 IDB write 비동기 발행 후 product 객체에선 제거.
  let pendingThumb = null;
  if (product && typeof product.imageThumb === 'string' && product.imageThumb) {
    pendingThumb = product.imageThumb;
    product = { ...product, imageThumb: null };
  }

  const products = getProducts();
  const idx = products.findIndex(p => p.id === product.id);
  if (idx >= 0) {
    products[idx] = { ...products[idx], ...product };
  } else {
    // 신규 등록 시 같은 brand+name이 이미 있으면 기본은 추가 X (중복 방지).
    // 사용자가 명시적으로 같은 이름 등록 의도면 opts.allowDuplicate=true 전달.
    const dupIdx = products.findIndex(p => normKey(p.brand, p.name) === normKey(product.brand, product.name));
    if (dupIdx >= 0 && !opts.allowDuplicate) {
      // 기존 제품 보강 (imageThumb·ingredients가 비어 있고 새 값 있으면 채움)
      const existing = products[dupIdx];
      products[dupIdx] = {
        ...existing,
        imageThumb: existing.imageThumb || product.imageThumb || null,
        ingredients: existing.ingredients || product.ingredients || null,
        category: existing.category && existing.category !== '기타' ? existing.category : (product.category || existing.category),
      };
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
      return products;
    }
    if (products.length >= MAX_PRODUCTS) throw new Error(`최대 ${MAX_PRODUCTS}개까지 등록할 수 있어요.`);
    const newProduct = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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
  try {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  } catch (e) {
    // localStorage 한도 초과 — 가장 무거운 imageThumb를 단계적으로 제거하면서 재시도
    if (e && /quota|QuotaExceeded/i.test(e.name + ' ' + e.message)) {
      // 1차: 가장 오래된 제품들의 imageThumb 제거
      const sorted = [...products].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      for (let removed = 1; removed <= sorted.length; removed++) {
        for (let i = 0; i < removed; i++) {
          const target = sorted[i];
          const idx2 = products.findIndex(p => p.id === target.id);
          if (idx2 >= 0) products[idx2] = { ...products[idx2], imageThumb: null };
        }
        try {
          localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
          const savedR = products.find(p => p.id === product.id) || products[products.length - 1];
          if (pendingThumb && savedR) setProductThumb(savedR.id, pendingThumb);
          return products;
        } catch (e2) { /* 계속 제거 */ }
      }
      // 그래도 실패하면 친근한 한국어 에러
      throw new Error('저장 공간이 부족해요. 사용 안 하는 제품을 삭제해주세요.');
    }
    throw e;
  }
  // IDB 쪽 thumb 저장 (비동기 fire-and-forget)
  const saved = products.find(p => p.id === product.id) || products[products.length - 1];
  if (pendingThumb && saved) setProductThumb(saved.id, pendingThumb);
  return products;
}

/**
 * 기존 등록 제품에서 같은 brand+name 중복 제거.
 * 첫 마운트 마이그레이션용 — 가장 먼저 등록된 것만 남기고 나머지 archive.
 * 반환: { products: 최종 배열, removed: 제거된 개수 }
 */
export function dedupeProductsByName() {
  const products = getProducts();
  const seen = new Set();
  const out = [];
  let removed = 0;
  for (const p of products) {
    const key = normKey(p.brand, p.name);
    if (seen.has(key)) { removed++; continue; }
    seen.add(key);
    out.push(p);
  }
  if (removed > 0) {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(out));
  }
  return { products: out, removed };
}

export function deleteProduct(id) {
  const products = getProducts().filter(p => p.id !== id);
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  // 체크에서도 제거
  const checks = getTrackerChecks();
  delete checks.morning[id];
  delete checks.night[id];
  localStorage.setItem(CHECKS_KEY, JSON.stringify(checks));
  // IDB thumb 삭제 (비동기 fire-and-forget)
  deleteProductThumb(id);
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

/**
 * 일괄 체크/해제 — 한 클릭으로 모든 제품 체크.
 * mode: 'morning' | 'night' | 'all' (둘 다)
 * dateStr 없으면 오늘. 이미 모두 체크돼 있으면 해제.
 */
export function bulkToggleCheck(mode, dateStr) {
  const date = dateStr || getTodayStr();
  const checks = getTrackerChecks(date);
  const targets = mode === 'all' ? ['morning', 'night'] : [mode];

  // 현재 상태 점검 — 다 체크되어 있으면 해제, 아니면 모두 체크
  let allChecked = true;
  for (const m of targets) {
    const products = getProductsForMode(m);
    for (const p of products) {
      if (!checks[m]?.[p.id]) { allChecked = false; break; }
    }
    if (!allChecked) break;
  }

  const next = { ...checks, date };
  for (const m of targets) {
    next[m] = { ...(next[m] || {}) };
    const products = getProductsForMode(m);
    for (const p of products) {
      next[m][p.id] = !allChecked; // 모두 체크돼 있으면 해제, 아니면 모두 체크
    }
  }

  if (date === getTodayStr()) {
    try { localStorage.setItem(CHECKS_KEY, JSON.stringify(next)); } catch {}
  }
  saveDailyChecks(date, next);
  updateHistory(next);
  return { checks: next, action: allChecked ? 'cleared' : 'checked' };
}

/**
 * 등록 제품의 매일 자동 체크 모드 토글.
 * autoCheck=true이면 매일 첫 진입 시 자동으로 체크됨.
 */
export function setProductAutoCheck(productId, enabled) {
  const products = getProducts();
  const idx = products.findIndex(p => p.id === productId);
  if (idx < 0) return null;
  products[idx] = { ...products[idx], autoCheck: !!enabled };
  try { localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products)); } catch {}
  return products[idx];
}

/**
 * 매일 첫 진입 시 호출 — autoCheck 활성 제품들 자동 체크.
 * 이미 오늘 처리된 경우 skip (재호출 무해).
 */
const AUTO_CHECK_LAST_KEY = 'nou_tracker_autocheck_last';
export function runAutoCheckIfNeeded() {
  try {
    const today = getTodayStr();
    const last = localStorage.getItem(AUTO_CHECK_LAST_KEY);
    if (last === today) return { ran: false, reason: 'already_today' };

    const products = getProducts();
    const autoProducts = products.filter(p => p.autoCheck === true);
    if (autoProducts.length === 0) {
      localStorage.setItem(AUTO_CHECK_LAST_KEY, today);
      return { ran: false, reason: 'no_auto_products' };
    }

    const checks = getTrackerChecks(today);
    const next = { ...checks, date: today, morning: { ...(checks.morning || {}) }, night: { ...(checks.night || {}) } };
    let count = 0;
    for (const p of autoProducts) {
      if (p.timeSlot === 'morning' || p.timeSlot === 'both') {
        if (!next.morning[p.id]) { next.morning[p.id] = true; count++; }
      }
      if (p.timeSlot === 'night' || p.timeSlot === 'both') {
        if (!next.night[p.id]) { next.night[p.id] = true; count++; }
      }
    }
    if (count > 0) {
      try { localStorage.setItem(CHECKS_KEY, JSON.stringify(next)); } catch {}
      saveDailyChecks(today, next);
      updateHistory(next);
    }
    localStorage.setItem(AUTO_CHECK_LAST_KEY, today);
    return { ran: true, count };
  } catch (e) {
    return { ran: false, reason: 'error', error: e.message };
  }
}

/**
 * 제품 순서 변경 — drag·정렬 모드 결과 적용.
 * orderedIds: 새 순서의 제품 ID 배열
 */
export function reorderProducts(orderedIds) {
  if (!Array.isArray(orderedIds)) return getProducts();
  const products = getProducts();
  const map = new Map(products.map(p => [p.id, p]));
  const reordered = orderedIds.map(id => map.get(id)).filter(Boolean);
  // 누락된 제품(혹시) 끝에 추가
  for (const p of products) {
    if (!orderedIds.includes(p.id)) reordered.push(p);
  }
  try { localStorage.setItem(PRODUCTS_KEY, JSON.stringify(reordered)); } catch {}
  return reordered;
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
      ingredientsConfidence: p.ingredientsConfidence, // 'known' | 'estimated' | undefined
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
      // 80x80 0.5 quality ≈ 2~4KB per thumb (이전 100x100/0.6의 절반)
      const size = 80;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.5));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
