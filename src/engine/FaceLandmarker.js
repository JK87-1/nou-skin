/**
 * FaceLandmarker — Lazy singleton wrapper around MediaPipe FaceLandmarker.
 *
 * - WASM + model (~5.5 MB) loaded from CDN at first call
 * - detectLandmarks(imgElement) returns 468 normalized landmarks or null
 * - getVideoLandmarker() returns instance in VIDEO mode for real-time detection
 * - detectLandmarksImage(imgElement) ensures IMAGE mode before detecting
 */
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let instance = null;
let initPromise = null;
let currentMode = 'IMAGE';

async function getInstance() {
  if (instance) return instance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(CDN);
      instance = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
        runningMode: 'IMAGE',
        numFaces: 1,
        outputFacialTransformationMatrixes: false,
        outputFaceBlendshapes: false,
      });
      currentMode = 'IMAGE';
      return instance;
    } catch (e) {
      console.warn('[FaceLandmarker] init failed, falling back to fixed regions:', e);
      initPromise = null;
      return null;
    }
  })();

  return initPromise;
}

/**
 * Switch to VIDEO mode and return the landmarker instance.
 * Used by CameraCapture for real-time detectForVideo() calls.
 */
export async function getVideoLandmarker() {
  const landmarker = await getInstance();
  if (!landmarker) return null;

  if (currentMode !== 'VIDEO') {
    landmarker.setOptions({ runningMode: 'VIDEO' });
    currentMode = 'VIDEO';
  }
  return landmarker;
}

/**
 * Detect face landmarks from an <img> element or Image object.
 * Ensures IMAGE mode before detection (used after capture for static analysis).
 * @param {HTMLImageElement} imgElement
 * @returns {Array<{x:number, y:number, z:number}>|null} 468 normalized landmarks, or null
 */
export async function detectLandmarksImage(imgElement) {
  try {
    const landmarker = await getInstance();
    if (!landmarker) return null;

    if (currentMode !== 'IMAGE') {
      landmarker.setOptions({ runningMode: 'IMAGE' });
      currentMode = 'IMAGE';
    }

    const result = landmarker.detect(imgElement);
    if (!result?.faceLandmarks?.length) return null;

    return result.faceLandmarks[0];
  } catch (e) {
    console.warn('[FaceLandmarker] detection failed:', e);
    return null;
  }
}

/**
 * Detect face landmarks from an <img> element or Image object.
 * @param {HTMLImageElement} imgElement
 * @returns {Array<{x:number, y:number, z:number}>|null} 468 normalized landmarks, or null
 * @deprecated Use detectLandmarksImage() instead for explicit mode handling
 */
export async function detectLandmarks(imgElement) {
  return detectLandmarksImage(imgElement);
}
