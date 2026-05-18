/**
 * HybridAnalysis.js — GPT-5.2 Vision AI skin analysis
 *
 * Baseline image comparison: first analysis saves a reference photo + scores.
 * Subsequent analyses send both baseline & new photo to GPT for visual comparison.
 * Falls back to CV-only if AI call fails.
 */

const AI_TIMEOUT_MS = 60000; // 2 images + 3 parallel calls need more time

// ===== BASELINE STORAGE (primary + secondary) =====
const PRIMARY_IMAGE_KEY = 'baselineImage';
const PRIMARY_RESULT_KEY = 'baselineResult';
const PRIMARY_TIMESTAMP_KEY = 'baselineTimestamp';
const SECONDARY_RESULT_KEY = 'secondaryBaselineResult';
const SECONDARY_TIMESTAMP_KEY = 'secondaryBaselineTimestamp';

// Score keys used for client-side stabilization
const STABILIZE_KEYS = [
  'moisture', 'skinTone', 'troubleCount', 'oilBalance',
  'wrinkles', 'pores', 'elasticity',
  'pigmentation', 'texture', 'darkCircles',
];

export function getBaseline() {
  try {
    const image = localStorage.getItem(PRIMARY_IMAGE_KEY);
    const resultStr = localStorage.getItem(PRIMARY_RESULT_KEY);
    if (!image || !resultStr) return null;
    const timestamp = parseInt(localStorage.getItem(PRIMARY_TIMESTAMP_KEY) || '0', 10);
    return { image, result: JSON.parse(resultStr), timestamp };
  } catch { return null; }
}

function getSecondaryBaseline() {
  try {
    const resultStr = localStorage.getItem(SECONDARY_RESULT_KEY);
    if (!resultStr) return null;
    const timestamp = parseInt(localStorage.getItem(SECONDARY_TIMESTAMP_KEY) || '0', 10);
    return { result: JSON.parse(resultStr), timestamp };
  } catch { return null; }
}

export function saveBaseline(image, result) {
  try {
    localStorage.setItem(PRIMARY_IMAGE_KEY, image);
    localStorage.setItem(PRIMARY_RESULT_KEY, JSON.stringify(result));
    localStorage.setItem(PRIMARY_TIMESTAMP_KEY, String(Date.now()));
  } catch (e) { console.warn('Baseline save failed:', e); }
}

function saveSecondaryBaseline(result) {
  try {
    localStorage.setItem(SECONDARY_RESULT_KEY, JSON.stringify(result));
    localStorage.setItem(SECONDARY_TIMESTAMP_KEY, String(Date.now()));
  } catch (e) { console.warn('Secondary baseline save failed:', e); }
}

/**
 * Gradually drift baseline toward current scores.
 * newBaseline = 0.70 × old + 0.30 × current
 */
function driftBaseline(baselineResult, currentScores) {
  const drifted = { ...baselineResult };
  for (const key of GPT_SCORE_KEYS) {
    if (typeof currentScores[key] === 'number' && typeof baselineResult[key] === 'number') {
      drifted[key] = Math.round(baselineResult[key] * 0.70 + currentScores[key] * 0.30);
    }
  }
  return drifted;
}

/**
 * Client-side stabilization for secondary (other person) scores.
 * Same time-based allowed delta as server.
 */
function clientStabilize(scores, baseline, daysSince) {
  const maxDelta = daysSince < 1 ? 0
    : daysSince <= 2 ? 2
    : daysSince <= 5 ? 4
    : daysSince <= 7 ? 6
    : daysSince <= 14 ? 9 : 12;

  const stabilized = { ...scores };
  for (const key of STABILIZE_KEYS) {
    if (typeof scores[key] === 'number' && typeof baseline[key] === 'number') {
      const diff = scores[key] - baseline[key];
      stabilized[key] = baseline[key] + Math.max(-maxDelta, Math.min(maxDelta, diff));
    }
  }
  return stabilized;
}

/**
 * Check if two score sets belong to the same person (avgDiff < 15).
 */
function isSamePersonScores(a, b) {
  let total = 0, count = 0;
  for (const key of STABILIZE_KEYS) {
    if (typeof a[key] === 'number' && typeof b[key] === 'number') {
      total += Math.abs(a[key] - b[key]);
      count++;
    }
  }
  return count > 0 && (total / count) < 15;
}

export function clearBaseline() {
  localStorage.removeItem(PRIMARY_IMAGE_KEY);
  localStorage.removeItem(PRIMARY_RESULT_KEY);
  localStorage.removeItem(PRIMARY_TIMESTAMP_KEY);
  localStorage.removeItem(SECONDARY_RESULT_KEY);
  localStorage.removeItem(SECONDARY_TIMESTAMP_KEY);
}

export function hasBaseline() {
  return !!localStorage.getItem(PRIMARY_IMAGE_KEY);
}

// ===== AI FALLBACK TRACKING (beta D-4 monitoring) =====
const FALLBACK_STATS_KEY = 'aiFallbackStats';

function loadStats() {
  try {
    const raw = localStorage.getItem(FALLBACK_STATS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveStats(stats) {
  try { localStorage.setItem(FALLBACK_STATS_KEY, JSON.stringify(stats)); } catch {}
}

function emptyStats() {
  return { successTotal: 0, fallbackTotal: 0, byReason: {}, history: [], lastReason: null, lastAt: null, lastSuccessAt: null };
}

function recordAiFallback(reason) {
  const stats = loadStats() || emptyStats();
  stats.fallbackTotal = (stats.fallbackTotal || 0) + 1;
  stats.byReason[reason] = (stats.byReason[reason] || 0) + 1;
  stats.lastReason = reason;
  stats.lastAt = new Date().toISOString();
  stats.history = [...(stats.history || []), { reason, at: stats.lastAt }].slice(-50);
  saveStats(stats);
  pingFallbackReportIfNeeded(reason);
}

// 서버(노션)로 즉시 알림 ping — 1시간 디바운스, fire-and-forget.
// 분석 흐름 방해 안 하도록 모든 에러 silent.
function pingFallbackReportIfNeeded(reason) {
  try {
    const KEY = 'aiFallbackLastPingAt';
    const DEBOUNCE_MS = 60 * 60 * 1000; // 1시간
    const last = parseInt(localStorage.getItem(KEY) || '0', 10);
    if (Date.now() - last < DEBOUNCE_MS) return;
    localStorage.setItem(KEY, String(Date.now()));

    const deviceTag = (localStorage.getItem('nou_device_id') || '').slice(0, 8);
    fetch('/api/fallback-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, mode: 'cv_only', deviceTag }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

function recordAiSuccess() {
  const stats = loadStats() || emptyStats();
  stats.successTotal = (stats.successTotal || 0) + 1;
  stats.lastSuccessAt = new Date().toISOString();
  saveStats(stats);
}

export function getAiFallbackStats() {
  return loadStats() || emptyStats();
}

export function clearAiFallbackStats() {
  localStorage.removeItem(FALLBACK_STATS_KEY);
}

// ===== FACE CROP =====
function cropFace(base64Image, landmarks) {
  if (!landmarks || landmarks.length < 10) return Promise.resolve(base64Image);
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const w = img.width, h = img.height;
      let minX = 1, minY = 1, maxX = 0, maxY = 0;
      for (const lm of landmarks) {
        if (lm.x < minX) minX = lm.x;
        if (lm.y < minY) minY = lm.y;
        if (lm.x > maxX) maxX = lm.x;
        if (lm.y > maxY) maxY = lm.y;
      }
      const padX = (maxX - minX) * 0.15;
      const padY = (maxY - minY) * 0.15;
      const sx = Math.max(0, Math.floor((minX - padX) * w));
      const sy = Math.max(0, Math.floor((minY - padY) * h));
      const sw = Math.min(w - sx, Math.ceil((maxX - minX + padX * 2) * w));
      const sh = Math.min(h - sy, Math.ceil((maxY - minY + padY * 2) * h));
      if (sw < 50 || sh < 50) { resolve(base64Image); return; }

      // GPT Vision detail='high' 모드를 충분히 활용하기 위해 1024×1024로 (이전 512×512에서 상향).
      // JPEG quality 0.9: 잡티·주름·모공 디테일 보존 (이전 0.7에서 상향).
      const CROP_SIZE = 1024;
      const canvas = document.createElement('canvas');
      canvas.width = CROP_SIZE;
      canvas.height = CROP_SIZE;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, CROP_SIZE, CROP_SIZE);
      const cropped = canvas.toDataURL('image/jpeg', 0.9);
      resolve(cropped.split(',')[1]);
    };
    img.onerror = () => resolve(base64Image);
    img.src = `data:image/jpeg;base64,${base64Image}`;
  });
}

// ===== KEY MAPPING =====
// GPT returns new key names; map to old app keys for compatibility
const KEY_MAP = {
  wrinkles: 'wrinkleScore',
  pores: 'poreScore',
  elasticity: 'elasticityScore',
  pigmentation: 'pigmentationScore',
  texture: 'textureScore',
  darkCircles: 'darkCircleScore',
};

// GPT score keys for baseline storage (skinAge computed server-side, not from GPT)
const GPT_SCORE_KEYS = [
  'skinAge', 'moisture', 'skinTone', 'oilBalance', 'troubleCount',
  'wrinkles', 'pores', 'elasticity', 'pigmentation', 'texture',
  'darkCircles', 'overallScore',
];

/**
 * Call the GPT-5.2 Vision AI endpoint.
 * - First analysis (no baseline): sends single image, saves baseline after success.
 * - Subsequent: sends baseline image + new image for visual comparison.
 *
 * @param {string} base64Image - Base64 encoded JPEG (without data: prefix)
 * @param {Array|null} landmarks - 468 normalized face landmarks from MediaPipe
 * @returns {object|null} AI scores object (app keys) or null on failure
 */
export async function callVisionAI(base64Image, landmarks) {
  // Crop face region
  const faceImage = await cropFace(base64Image, landmarks);

  // Load baseline for comparison
  const baseline = getBaseline();
  const isFirstAnalysis = !baseline;

  try {
    const body = { image: faceImage };
    if (!isFirstAnalysis) {
      body.baselineImage = baseline.image;
      body.baselineResult = baseline.result;
      body.baselineTimestamp = baseline.timestamp || 0;
    }

    const resp = await Promise.race([
      fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI timeout')), AI_TIMEOUT_MS)
      ),
    ]);

    if (!resp.ok) {
      console.warn('AI API returned', resp.status);
      recordAiFallback(`http_${resp.status}`);
      return null;
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('AI response has no JSON block');
      recordAiFallback('no_json_block');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields (GPT returns 10 individual scores only)
    const requiredKeys = [
      'moisture', 'skinTone', 'wrinkles', 'pores',
      'elasticity', 'pigmentation', 'texture',
      'darkCircles',
    ];
    for (const key of requiredKeys) {
      if (typeof parsed[key] !== 'number') {
        console.warn(`AI response missing or invalid: ${key}`);
        recordAiFallback(`missing_field_${key}`);
        return null;
      }
    }

    // Baseline management — server + client backup detection
    let isDifferentPerson = parsed.differentPerson === true;
    // Client-side backup: if server didn't flag but scores deviate significantly from baseline
    if (!isDifferentPerson && !isFirstAnalysis && !isSamePersonScores(parsed, baseline.result)) {
      isDifferentPerson = true;
      parsed.differentPerson = true;
      console.log('Client backup: score deviation detected different person');
    }
    if (isFirstAnalysis) {
      // First ever analysis: save as primary baseline
      const baselineScores = {};
      for (const key of GPT_SCORE_KEYS) {
        if (typeof parsed[key] === 'number') baselineScores[key] = parsed[key];
      }
      saveBaseline(faceImage, baselineScores);
      console.log('Primary baseline saved (first analysis)');
    } else if (isDifferentPerson) {
      // Different person detected by GPT:
      // Do NOT apply any client-side stabilization — use raw AI scores as-is.
      // Save as secondary baseline for future visits by this person.
      saveSecondaryBaseline(parsed);
      console.log('Different person detected — raw scores used, saved as secondary baseline');
    } else {
      // Same primary person: drift primary baseline (only once per day)
      const baselineDate = new Date(baseline.timestamp).toISOString().slice(0, 10);
      const todayDate = new Date().toISOString().slice(0, 10);
      if (baselineDate !== todayDate) {
        // New day: drift baseline toward current scores
        const drifted = driftBaseline(baseline.result, parsed);
        saveBaseline(baseline.image, drifted);
        console.log('Primary baseline drifted (new day)');
      } else {
        console.log('Same-day repeat: baseline kept stable');
      }
    }

    // Map GPT keys → app keys for compatibility
    const mapped = { ...parsed };
    for (const [newKey, oldKey] of Object.entries(KEY_MAP)) {
      if (typeof parsed[newKey] === 'number') {
        mapped[oldKey] = parsed[newKey];
      }
    }

    recordAiSuccess();
    return mapped;
  } catch (e) {
    const msg = e.message || String(e);
    console.warn('AI analysis failed:', msg);
    const reason = msg === 'AI timeout' ? 'timeout' : `exception:${msg.slice(0, 40)}`;
    recordAiFallback(reason);
    return null;
  }
}

/**
 * Merge: AI 100% mode — GPT-5.2 scores used directly.
 * CV scores only used as fallback structure.
 */
export function hybridMerge(cv, ai) {
  const scoreKeys = [
    'moisture', 'skinTone', 'troubleCount', 'oilBalance',
    'wrinkleScore', 'poreScore', 'elasticityScore',
    'pigmentationScore', 'textureScore', 'darkCircleScore',
  ];

  const result = { ...cv, analysisMode: 'hybrid' };

  for (const key of scoreKeys) {
    if (typeof ai[key] === 'number') {
      result[key] = Math.round(ai[key]);
    }
  }

  // GPT returns troubleCount as 0-100 score; convert to raw count (0-20)
  if (typeof ai.troubleCount === 'number') {
    const rawNew = Math.max(0, Math.min(20, Math.round((100 - ai.troubleCount) / 8.5)));

    // Baseline raw count clamp — 시간 단계별 양방향 적용.
    // - 감소 방향(트러블 줄어듦): 같은 날 ±1, 1~2일 ±2, 3~5일 ±3, 6~14일 ±4, 15일+ ±5
    // - 증가 방향(트러블 늘어남): 같은 날 ±1, 1~2일 ±2, 그 이후 자유 허용
    //   (베타 안정성을 위해 같은 날 측정 노이즈는 흡수하되, 진짜 새 트러블은
    //    baseline drift(70%·30%)와 함께 1~3일 내 점진적으로 반영됨)
    // - differentPerson인 경우는 anchor 안 함
    let stabilizedRaw = rawNew;
    if (!ai.differentPerson) {
      try {
        const baseline = getBaseline();
        if (baseline && typeof baseline.result?.troubleCount === 'number') {
          const rawBase = Math.max(0, Math.min(20, Math.round((100 - baseline.result.troubleCount) / 8.5)));
          const diff = rawNew - rawBase;
          const daysSince = baseline.timestamp ? (Date.now() - baseline.timestamp) / 86400000 : 0;
          if (diff <= 0) {
            const maxDecrease = daysSince < 1 ? 1 : daysSince <= 2 ? 2 : daysSince <= 5 ? 3 : daysSince <= 14 ? 4 : 5;
            stabilizedRaw = rawBase + Math.max(-maxDecrease, diff);
          } else {
            const maxIncrease = daysSince < 1 ? 1 : daysSince <= 2 ? 2 : 100;
            stabilizedRaw = rawBase + Math.min(maxIncrease, diff);
          }
          if (stabilizedRaw !== rawNew) {
            console.log('[troubleCount stabilize]', { rawNew, rawBase, diff, daysSince: daysSince.toFixed(2), stabilizedRaw });
          }
        }
      } catch (e) { console.warn('[troubleCount baseline clamp]', e); }
    }
    result.troubleCount = stabilizedRaw;
  }

  if (typeof ai.skinAge === 'number') {
    result.skinAge = Math.round(ai.skinAge);
  }

  // overallScore: computed server-side from 10 metrics
  if (typeof ai.overallScore === 'number') {
    result.overallScore = Math.round(ai.overallScore);
  }

  // conditionScore: 컨디션(일시적) vs 구조(장기적) 차이 강조
  // troubleVal: GPT 원본 0-100 직접 사용 (raw count round-trip의 8.5점 bucket jump 제거)
  const troubleVal = typeof ai.troubleCount === 'number'
    ? Math.max(0, Math.min(100, ai.troubleCount))
    : Math.max(0, 100 - (result.troubleCount || 0) * 8.5);
  const oilVal = Math.max(30, 100 - Math.abs(55 - (result.oilBalance || 50)) * 1.4);
  const cAvg = ((result.moisture || 50) + (result.skinTone || 50) + (result.darkCircleScore || 50) + oilVal + troubleVal) / 5;
  const sAvg = ((result.wrinkleScore || 50) + (result.elasticityScore || 50) + (result.textureScore || 50) + (result.poreScore || 50) + (result.pigmentationScore || 50)) / 5;
  // amplification factor 1.8 → 0.8: 차이 의미는 유지하되 측정 변동 증폭은 절반 이하로
  result.conditionScore = clamp(Math.round(cAvg + (cAvg - sAvg) * 0.8), 32, 96);

  // conditionScore baseline anchor — 같은 사람·같은 baseline에서 ±n 으로 clamp.
  // 종합점수(±2~3 안정)와 정합되도록 같은 날 ±3, 1-2일 ±5, 3-5일 ±7, 7-14일 ±10, 15일+ 자유.
  // baseline.result(GPT 점수)에서 동일 공식으로 재계산하므로 별도 baseline 저장 불필요.
  if (!ai.differentPerson) {
    try {
      const baselineForCondition = getBaseline();
      if (baselineForCondition?.result) {
        const b = baselineForCondition.result;
        const bTroubleVal = typeof b.troubleCount === 'number' ? b.troubleCount : 50;
        const bOilVal = Math.max(30, 100 - Math.abs(55 - (b.oilBalance ?? 50)) * 1.4);
        const bCAvg = ((b.moisture ?? 50) + (b.skinTone ?? 50) + (b.darkCircles ?? 50) + bOilVal + bTroubleVal) / 5;
        const bSAvg = ((b.wrinkles ?? 50) + (b.elasticity ?? 50) + (b.texture ?? 50) + (b.pores ?? 50) + (b.pigmentation ?? 50)) / 5;
        const baselineCondition = clamp(Math.round(bCAvg + (bCAvg - bSAvg) * 0.8), 32, 96);
        const daysSince = baselineForCondition.timestamp ? (Date.now() - baselineForCondition.timestamp) / 86400000 : 0;
        const maxDelta = daysSince < 1 ? 3 : daysSince <= 2 ? 5 : daysSince <= 5 ? 7 : daysSince <= 14 ? 10 : 100;
        const diff = result.conditionScore - baselineCondition;
        if (Math.abs(diff) > maxDelta) {
          const stabilized = baselineCondition + Math.max(-maxDelta, Math.min(maxDelta, diff));
          console.log('[conditionScore stabilize]', { raw: result.conditionScore, baseline: baselineCondition, diff, daysSince: daysSince.toFixed(2), stabilized });
          result.conditionScore = stabilized;
        }
      }
    } catch (e) { console.warn('[conditionScore baseline anchor]', e); }
  }

  console.log('[conditionScore]', { cAvg: cAvg.toFixed(1), sAvg: sAvg.toFixed(1), diff: (cAvg - sAvg).toFixed(1), troubleVal: troubleVal.toFixed(1), conditionScore: result.conditionScore, overallScore: result.overallScore });

  // Store AI analysis summary & details
  if (ai.analysis) {
    if (ai.analysis.summary) result.aiNotes = ai.analysis.summary;
    if (ai.analysis.details) result.aiDetails = ai.analysis.details;
  }

  if (ai.notes) result.aiNotes = ai.notes;
  if (typeof ai.confidence === 'number') result.confidence = ai.confidence;
  if (ai.makeupDetected) result.makeupDetected = true;
  if (ai.differentPerson) result.differentPerson = true;

  return result;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, Math.round(v)));
}
