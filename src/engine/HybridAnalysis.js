/**
 * HybridAnalysis.js — Claude Vision AI + CV hybrid merge
 *
 * Calls the /api/analyze serverless endpoint with the photo + CV pixel data,
 * then merges AI scores with CV scores using per-metric weights.
 * Falls back to CV-only if AI call fails.
 */

const AI_TIMEOUT_MS = 12000;

/**
 * Call the Claude Vision AI endpoint.
 * @param {string} base64Image - Base64 encoded JPEG (without data: prefix)
 * @param {object} cvPixelData - Raw pixel data from analyzePixels()
 * @returns {object|null} AI scores object or null on failure
 */
export async function callVisionAI(base64Image, cvPixelData) {
  try {
    const resp = await Promise.race([
      fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Image,
          cvData: cvPixelData,
        }),
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

    return parsed;
  } catch (e) {
    console.warn('AI analysis failed:', e.message || e);
    return null;
  }
}

/**
 * Merge CV scores with AI scores.
 * Per-metric weights favor AI for visual/contextual metrics,
 * CV for signal-based metrics.
 *
 * @param {object} cv - CV-only scores from pixelsToScores()
 * @param {object} ai - AI scores from Claude Vision
 * @returns {object} Merged result
 */
export function hybridMerge(cv, ai) {
  // Per-metric [aiWeight, cvWeight]
  const weights = {
    moisture:          [0.95, 0.05],
    skinTone:          [0.95, 0.05],
    troubleCount:      [0.95, 0.05],
    oilBalance:        [0.95, 0.05],
    wrinkleScore:      [0.95, 0.05],
    poreScore:         [0.95, 0.05],
    elasticityScore:   [0.95, 0.05],
    pigmentationScore: [0.95, 0.05],
    textureScore:      [0.95, 0.05],
    darkCircleScore:   [0.95, 0.05],
  };

  const result = { ...cv, analysisMode: 'hybrid' };

  for (const [key, [aiW, cvW]] of Object.entries(weights)) {
    const aiVal = ai[key];
    const cvVal = cv[key];

    if (aiVal == null || typeof aiVal !== 'number') continue;
    if (cvVal == null) { result[key] = Math.round(aiVal); continue; }

    result[key] = Math.round(aiVal * aiW + cvVal * cvW);
  }

  // skinAge: AI prioritized
  if (typeof ai.skinAge === 'number') {
    result.skinAge = Math.round(ai.skinAge * 0.95 + cv.skinAge * 0.05);
  }

  // Recalculate overallScore with hybrid values
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

  // AI notes for potential display
  if (ai.notes) result.aiNotes = ai.notes;
  if (typeof ai.confidence === 'number') {
    // Blend confidence: AI confidence weighted with CV confidence
    result.confidence = Math.round(
      ai.confidence * 0.6 + (cv.confidence || 70) * 0.4
    );
  }

  return result;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, Math.round(v)));
}
