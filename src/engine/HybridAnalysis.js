/**
 * HybridAnalysis.js — GPT-5.2 Vision AI skin analysis
 *
 * Calls the /api/analyze serverless endpoint with the photo only.
 * Uses perceptual image hashing for cache (similar photos → same scores).
 * Falls back to CV-only if AI call fails.
 */

const AI_TIMEOUT_MS = 12000;

// ===== PERCEPTUAL HASH CACHE =====
// Similar images → same cache key → same scores (no API re-call)
const CACHE_KEY = 'nou_ai_score_cache';
const MAX_CACHE = 10;

/**
 * Perceptual hash: downscale to 16x16 grayscale, compare each pixel to average.
 * Visually similar photos produce the same hash → cache hit.
 */
function perceptualHash(base64Image) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 16, 16);
      const data = ctx.getImageData(0, 0, 16, 16).data;

      // Grayscale values
      let sum = 0;
      const grays = [];
      for (let i = 0; i < data.length; i += 4) {
        const g = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        grays.push(g);
        sum += g;
      }
      const avg = sum / grays.length;

      // 256-bit hash: 1 if pixel > average, 0 otherwise
      let hash = '';
      for (const g of grays) hash += g > avg ? '1' : '0';
      resolve('ph_' + hash);
    };
    img.onerror = () => resolve(null);
    img.src = `data:image/jpeg;base64,${base64Image}`;
  });
}

function loadCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch { return {}; }
}

function saveToCache(key, scores) {
  try {
    const cache = loadCache();
    cache[key] = scores;
    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHE) delete cache[keys[0]];
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* quota exceeded — ignore */ }
}

/**
 * Call the GPT-5.2 Vision AI endpoint (pure AI mode — no CV data sent).
 * Uses perceptual hash for caching: similar photos return cached scores.
 * @param {string} base64Image - Base64 encoded JPEG (without data: prefix)
 * @returns {object|null} AI scores object or null on failure
 */
export async function callVisionAI(base64Image) {
  // Perceptual hash: similar images → same cache key
  const cacheKey = await perceptualHash(base64Image);
  if (cacheKey) {
    const cached = loadCache();
    if (cached[cacheKey]) {
      console.log('AI scores from perceptual cache (similar image)');
      return cached[cacheKey];
    }
  }
  try {
    const resp = await Promise.race([
      fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI timeout')), AI_TIMEOUT_MS)
      ),
    ]);

    if (!resp.ok) {
      console.warn('AI API returned', resp.status);
      return null;
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('AI response has no JSON block');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields exist and are numbers
    const requiredKeys = [
      'moisture', 'skinTone', 'wrinkleScore', 'poreScore',
      'elasticityScore', 'pigmentationScore', 'textureScore',
      'darkCircleScore', 'skinAge',
    ];
    for (const key of requiredKeys) {
      if (typeof parsed[key] !== 'number') {
        console.warn(`AI response missing or invalid: ${key}`);
        return null;
      }
    }

    // Cache successful result (persists in localStorage)
    if (cacheKey) saveToCache(cacheKey, parsed);

    return parsed;
  } catch (e) {
    console.warn('AI analysis failed:', e.message || e);
    return null;
  }
}

/**
 * Merge: AI 100% mode — GPT-5.2 scores used directly.
 * CV scores only used as fallback structure + overallScore calculation.
 *
 * @param {object} cv - CV-only scores (used for structure/fallback)
 * @param {object} ai - AI scores from GPT-5.2 Vision
 * @returns {object} Final result with AI scores
 */
export function hybridMerge(cv, ai) {
  const scoreKeys = [
    'moisture', 'skinTone', 'troubleCount', 'oilBalance',
    'wrinkleScore', 'poreScore', 'elasticityScore',
    'pigmentationScore', 'textureScore', 'darkCircleScore',
  ];

  const result = { ...cv, analysisMode: 'ai' };

  // Use AI scores directly (100%)
  for (const key of scoreKeys) {
    if (typeof ai[key] === 'number') {
      result[key] = Math.round(ai[key]);
    }
  }

  if (typeof ai.skinAge === 'number') {
    result.skinAge = Math.round(ai.skinAge);
  }

  // Recalculate overallScore
  const troubleScoreVal = Math.max(0, 100 - result.troubleCount * 8.5);
  const oilScoreVal = 100 - Math.abs(55 - result.oilBalance) * 1.4;
  result.overallScore = clamp(
    result.wrinkleScore      * 0.16 +
    result.elasticityScore   * 0.13 +
    result.moisture          * 0.12 +
    result.textureScore      * 0.11 +
    troubleScoreVal          * 0.10 +
    result.poreScore         * 0.10 +
    result.pigmentationScore * 0.07 +
    result.skinTone          * 0.07 +
    result.darkCircleScore   * 0.07 +
    Math.max(30, oilScoreVal) * 0.07,
    32, 96
  );

  if (ai.notes) result.aiNotes = ai.notes;
  if (typeof ai.confidence === 'number') result.confidence = ai.confidence;

  return result;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, Math.round(v)));
}
