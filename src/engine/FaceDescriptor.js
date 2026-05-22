/**
 * FaceDescriptor — face-api.js 기반 얼굴 임베딩 추출·비교.
 *
 * 측정 시 얼굴에서 128차원 임베딩을 뽑아 baseline의 임베딩과 비교.
 * Euclidean distance < 0.5 = 동일인 확정 (점수 무관),
 *                  > 0.6 = 다른 사람 확정,
 *                  사이 = 모호, GPT 판단에 위임.
 *
 * 디바이스·조명·메이크업 차이에 강건. 점수 차이로 오판하던 문제 해결.
 *
 * 모델 추가 로드: tinyFaceDetector 재사용 + landmark68Tiny (~350KB) + faceRecognitionNet (~6.2MB).
 * 첫 측정 시 한 번 로드, 이후 IndexedDB·SW 캐시.
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
      try {
        await faceapi.tf.setBackend('webgl');
        await faceapi.tf.ready();
      } catch {
        await faceapi.tf.setBackend('cpu');
        await faceapi.tf.ready();
      }

      // tinyFaceDetector는 FaceAgeEstimator와 공유. 이미 로드돼 있으면 skip 처리됨.
      await Promise.all([
        faceapi.nets.tinyFaceDetector.load(MODEL_CDN),
        faceapi.nets.faceLandmark68TinyNet.load(MODEL_CDN),
        faceapi.nets.faceRecognitionNet.load(MODEL_CDN),
      ]);

      loaded = true;
      return true;
    } catch (e) {
      console.warn('[FaceDescriptor] model loading failed:', e);
      loadPromise = null;
      return false;
    }
  })();

  return loadPromise;
}

/**
 * 이미지 element에서 얼굴 임베딩(128차원) 추출.
 * @param {HTMLImageElement|HTMLCanvasElement} imgElement
 * @returns {Promise<number[]|null>} 일반 배열 (직렬화 가능). 얼굴 못 찾으면 null.
 */
export async function extractDescriptor(imgElement) {
  try {
    const ready = await ensureModels();
    if (!ready) return null;

    const result = await faceapi
      .detectSingleFace(imgElement, new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.4,
      }))
      .withFaceLandmarks(true) // useTinyModel = true
      .withFaceDescriptor()
      .run();

    if (!result || !result.descriptor) return null;
    // Float32Array → 일반 배열로 변환 (JSON·localStorage 직렬화)
    return Array.from(result.descriptor);
  } catch (e) {
    console.warn('[FaceDescriptor] extract failed:', e);
    return null;
  }
}

/**
 * Base64 JPEG 문자열에서 descriptor 추출 (편의 함수).
 * @param {string} base64 — data: prefix 없는 순수 base64
 */
export async function extractDescriptorFromBase64(base64) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = async () => {
      const d = await extractDescriptor(img);
      resolve(d);
    };
    img.onerror = () => resolve(null);
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

/**
 * 두 descriptor의 Euclidean distance.
 * 동일인이면 0~0.4, 다른 사람이면 0.6+.
 */
export function descriptorDistance(a, b) {
  if (!a || !b || a.length !== b.length) return null;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Distance를 동일인 판별 라벨로 변환.
 * - distance < 0.5: same (동일인 확정)
 * - distance > 0.6: different (다른 사람 확정)
 * - 0.5 ≤ distance ≤ 0.6: ambiguous (모호)
 */
export function classifyDistance(distance) {
  if (distance == null) return 'unknown';
  if (distance < 0.5) return 'same';
  if (distance > 0.6) return 'different';
  return 'ambiguous';
}

/** 백그라운드 모델 사전 로드 */
export function preload() {
  ensureModels();
}
