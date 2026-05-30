/**
 * PrecisionStorage.js — 정밀 측정 기록·트렌드 저장
 *
 * 일반 측정(SkinStorage)과 분리. 정밀 모드는 별도 키 공간.
 * 결제 unlock 상태도 여기서 관리.
 *
 * 저장 키:
 *   - `lua_precision_records`     : 정밀 측정 결과 배열 (최근 50개)
 *   - `lua_precision_unlocked`    : 결제 unlock 상태 ('pass' | null)
 *   - `lua_precision_quota`       : 남은 측정 횟수 (1회권/구독 관리)
 *   - `lua_precision_quota_meta`  : { plan, purchasedAt, expiresAt }
 */

const KEY_RECORDS = 'lua_precision_records';
const KEY_UNLOCKED = 'lua_precision_unlocked';
const KEY_QUOTA = 'lua_precision_quota';
const KEY_QUOTA_META = 'lua_precision_quota_meta';
const MAX_RECORDS = 50;

function safeGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

// ===== 결제 unlock =====

export function isPrecisionUnlocked() {
  // pass = 평생 unlock (mock 전체 해제용)
  if (safeGet(KEY_UNLOCKED, null) === 'pass') return true;
  const quota = safeGet(KEY_QUOTA, 0);
  return typeof quota === 'number' && quota > 0;
}

export function getPrecisionQuota() {
  if (safeGet(KEY_UNLOCKED, null) === 'pass') return { quota: Infinity, plan: 'pass' };
  const quota = safeGet(KEY_QUOTA, 0);
  const meta = safeGet(KEY_QUOTA_META, null);
  return { quota: quota || 0, plan: meta?.plan || null, meta };
}

export function consumePrecisionQuota() {
  // pass는 차감 안 함
  if (safeGet(KEY_UNLOCKED, null) === 'pass') return true;
  const cur = safeGet(KEY_QUOTA, 0);
  if (typeof cur !== 'number' || cur <= 0) return false;
  safeSet(KEY_QUOTA, cur - 1);
  return true;
}

export function purchasePrecision(plan) {
  // plan: 'single' | 'monthly' | 'pass'
  // mock 결제 — 즉시 unlock
  const now = Date.now();
  if (plan === 'single') {
    const cur = safeGet(KEY_QUOTA, 0);
    safeSet(KEY_QUOTA, (cur || 0) + 1);
    safeSet(KEY_QUOTA_META, { plan: 'single', purchasedAt: now, expiresAt: null });
  } else if (plan === 'monthly') {
    // 월 5회권
    const cur = safeGet(KEY_QUOTA, 0);
    safeSet(KEY_QUOTA, (cur || 0) + 5);
    safeSet(KEY_QUOTA_META, { plan: 'monthly', purchasedAt: now, expiresAt: now + 30 * 24 * 3600 * 1000 });
  } else if (plan === 'pass') {
    safeSet(KEY_UNLOCKED, 'pass');
    safeSet(KEY_QUOTA_META, { plan: 'pass', purchasedAt: now, expiresAt: null });
  }
  return true;
}

export function resetPrecisionUnlock() {
  // 디버그용
  try {
    localStorage.removeItem(KEY_UNLOCKED);
    localStorage.removeItem(KEY_QUOTA);
    localStorage.removeItem(KEY_QUOTA_META);
  } catch {}
}

// ===== 정밀 측정 기록 =====

export function savePrecisionRecord(result, images) {
  if (!result) return null;
  const records = safeGet(KEY_RECORDS, []);
  const id = `precision_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // images는 base64 그대로 저장하면 용량 폭증 — 정면만, 그것도 thumbnail로 저장
  let thumbnail = null;
  try {
    if (images?.front) {
      thumbnail = `data:image/jpeg;base64,${images.front.slice(0, 100000)}`; // 대략 75kB 미만 제한
    }
  } catch {}

  const record = {
    id,
    date: new Date().toISOString(),
    score: computeOverallScore(result),
    asymmetrySummary: result.asymmetry?.summary || null,
    clinicalFindings: result.clinical_findings?.slice(0, 3) || [],
    treatmentCandidates: (result.treatment_candidates || []).map(t => t.category),
    metrics: pickMetrics(result),
    regionalScores: result.regional_scores || null,
    thumbnail,
    analysisMode: result.analysisMode || 'precision_hybrid',
  };

  const next = [record, ...records].slice(0, MAX_RECORDS);
  safeSet(KEY_RECORDS, next);
  return record;
}

export function getPrecisionRecords() {
  return safeGet(KEY_RECORDS, []) || [];
}

export function getLatestPrecisionRecord() {
  const list = getPrecisionRecords();
  return list[0] || null;
}

export function deletePrecisionRecord(id) {
  const list = getPrecisionRecords();
  const next = list.filter(r => r.id !== id);
  safeSet(KEY_RECORDS, next);
  return next.length !== list.length;
}

// ===== 트렌드 (메트릭별 시계열) =====

export function getPrecisionTrend(metricKey, limit = 10) {
  const list = getPrecisionRecords().slice(0, limit).reverse();
  return list
    .map(r => ({ date: r.date, value: r.metrics?.[metricKey] ?? null }))
    .filter(p => p.value != null);
}

// ===== 헬퍼 =====

function computeOverallScore(result) {
  const keys = ['moisture','skinTone','oilBalance','wrinkles','elasticity','texture','pores','pigmentation','darkCircles','redness'];
  const vals = keys.map(k => result[k]).filter(v => typeof v === 'number');
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a,b)=>a+b,0) / vals.length);
}

function pickMetrics(result) {
  const out = {};
  ['moisture','skinTone','oilBalance','wrinkles','elasticity','texture','pores','pigmentation','darkCircles','redness','oilMoistureBalance']
    .forEach(k => { if (typeof result[k] === 'number') out[k] = Math.round(result[k]); });
  if (typeof result.troubleCount === 'number') out.troubleCount = result.troubleCount;
  return out;
}
