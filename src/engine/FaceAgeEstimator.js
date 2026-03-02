/**
 * FaceAgeEstimator — Lazy singleton wrapper around @vladmandic/face-api.
 *
 * - Models (~620KB) loaded from CDN at first use
 * - estimateAge(imgElement) returns { age, gender, genderProbability } or null
 * - GPU (WebGL) with CPU fallback
 * - If model loading fails, returns null (pixel analysis fallback)
 */
import * as faceapi from '@vladmandic/face-api';

const MODEL_CDN = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

let loaded = false;
let loadPromise = null;

async function ensureModels() {
  if (loaded) return true;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      // Try WebGL backend first, fall back to CPU
      try {
        await faceapi.tf.setBackend('webgl');
        await faceapi.tf.ready();
      } catch {
        console.warn('[FaceAgeEstimator] WebGL unavailable, using CPU');
        await faceapi.tf.setBackend('cpu');
        await faceapi.tf.ready();
      }

      await Promise.all([
        faceapi.nets.tinyFaceDetector.load(MODEL_CDN),
        faceapi.nets.ageGenderNet.load(MODEL_CDN),
      ]);

      loaded = true;
      return true;
    } catch (e) {
      console.warn('[FaceAgeEstimator] model loading failed:', e);
      loadPromise = null;
      return false;
    }
  })();

  return loadPromise;
}

/**
 * Estimate age from an image element.
 * @param {HTMLImageElement} imgElement
 * @returns {Promise<{age: number, gender: string, genderProbability: number}|null>}
 */
export async function estimateAge(imgElement) {
  try {
    const ready = await ensureModels();
    if (!ready) return null;

    const result = await faceapi
      .detectSingleFace(imgElement, new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.4,
      }))
      .withAgeAndGender()
      .run();

    if (!result) return null;

    return {
      age: Math.round(result.age),
      gender: result.gender,
      genderProbability: result.genderProbability,
    };
  } catch (e) {
    console.warn('[FaceAgeEstimator] estimation failed:', e);
    return null;
  }
}

/**
 * Eagerly start downloading models in the background.
 */
export function preload() {
  ensureModels();
}
