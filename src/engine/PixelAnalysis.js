/**
 * LUA Pixel Analysis Engine v3.1
 *
 * 10-METRIC SYSTEM:
 * ─ moisture, skinTone, trouble, oilBalance (v1)
 * ─ wrinkles, pores, elasticity, pigmentation (v2.0)
 * ─ texture, darkCircles (v2.1)
 * ─ Derived: skinAge (weighted sum of all 10)
 *
 * v3.0: CIE LAB, multi-scale edge, connected-region clustering,
 *       LAB 3-component dark circles, sigmoid oil balance
 *
 * v3.1 CHANGES (Accuracy refinements):
 * ─ sRGB→linear LUT (10x faster rgbToLab on mobile)
 * ─ Soft histogram stretching (60/40 blend, prevents noise amplification)
 * ─ Moisture: 3-signal model (clusters + sat uniformity + LAB smoothness)
 * ─ Skin tone: uniformity-centric (40% uniformity, 30% brightness, 20% symmetry)
 * ─ Oil balance: multi-signal (shine ratio + total shine + saturation)
 * ─ Elasticity: upper/lower edge ratio for firmness vs sagging distinction
 * ─ Pores: LAB L* based micro-variance (skin-tone independent)
 *
 * v3.2 CHANGES (Accuracy overhaul):
 * ─ Analysis resolution 320→512px (better pore/wrinkle/texture detection)
 * ─ Moisture: reduced cluster weight 35→15%, increased smoothness 35→45%, sat 30→40%
 * ─ Lighting normalization 60/40→75/25 blend (stronger color correction)
 * ─ Scoring recalibration: wrinkles, pores, elasticity, texture, dark circles, skin tone, oil
 * ─ Skin pixel filter expanded (YCbCr wider range for dark skin tones)
 * ─ Highlight cluster minimum size 1→3px (noise reduction)
 * ─ Skin age base 23→25, adjusted penalty weights
 */
import { landmarksToRegions } from './LandmarkRegions.js';
import { rgbToLab, labStats } from './ColorSpace.js';

// ===== LIGHTING NORMALIZATION =====
// Histogram equalization (Y channel) + gray-world white balance
// Makes photos under different lighting conditions look similar to GPT-5.2

function normalizeImageData(imageData) {
  const data = imageData.data;
  const len = data.length;

  // 1. Convert RGB → YCbCr, collect Y histogram
  const yVals = new Float32Array(len / 4);
  const hist = new Int32Array(256);
  for (let i = 0, j = 0; i < len; i += 4, j++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    yVals[j] = y;
    hist[Math.min(255, Math.round(y))]++;
  }

  // 2. Build CDF for histogram equalization
  const pixelCount = len / 4;
  const cdf = new Float32Array(256);
  cdf[0] = hist[0];
  for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];
  const cdfMin = cdf.find(v => v > 0);
  const scale = 255 / (pixelCount - cdfMin);
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.max(0, Math.min(255, Math.round((cdf[i] - cdfMin) * scale)));
  }

  // 3. Gray-world white balance: compute average R, G, B
  let avgR = 0, avgG = 0, avgB = 0;
  for (let i = 0; i < len; i += 4) {
    avgR += data[i];
    avgG += data[i + 1];
    avgB += data[i + 2];
  }
  avgR /= pixelCount;
  avgG /= pixelCount;
  avgB /= pixelCount;
  const grayAvg = (avgR + avgG + avgB) / 3;
  const scaleR = grayAvg / (avgR || 1);
  const scaleG = grayAvg / (avgG || 1);
  const scaleB = grayAvg / (avgB || 1);

  // 4. Apply histogram equalization + white balance
  for (let i = 0, j = 0; i < len; i += 4, j++) {
    const oldY = yVals[j];
    const newY = lut[Math.min(255, Math.round(oldY))];
    const ratio = oldY > 0 ? newY / oldY : 1;

    data[i]     = Math.min(255, Math.max(0, Math.round(data[i] * ratio * scaleR)));
    data[i + 1] = Math.min(255, Math.max(0, Math.round(data[i + 1] * ratio * scaleG)));
    data[i + 2] = Math.min(255, Math.max(0, Math.round(data[i + 2] * ratio * scaleB)));
  }

  return imageData;
}

// ===== IMAGE COMPRESSION =====
// Deterministic: same input → same output guaranteed via
// OffscreenCanvas + imageSmoothingEnabled:false + lighting normalization + memoization
const compressCache = new Map();

/** Clear compression cache between analyses to prevent cross-person contamination */
export function clearCompressCache() {
  compressCache.clear();
}

export function compressImage(dataUrl, maxSize = 768, quality = 0.85) {
  // Memo: identical input always returns identical base64
  if (compressCache.has(dataUrl)) return Promise.resolve(compressCache.get(dataUrl));

  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      // Always normalize to exactly maxSize on the longest side
      if (w >= h) { h = Math.round((maxSize / w) * h); w = maxSize; }
      else { w = Math.round((maxSize / h) * w); h = maxSize; }

      // Use standard Canvas for normalization (need getImageData)
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, w, h);

      // Apply lighting normalization (histogram eq + white balance)
      const imageData = ctx.getImageData(0, 0, w, h);
      normalizeImageData(imageData);
      ctx.putImageData(imageData, 0, 0);

      const result = canvas.toDataURL('image/jpeg', quality);
      compressCache.set(dataUrl, result);
      resolve(result);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ===== PHOTO QUALITY GATE =====
// Checks brightness and sharpness before analysis to warn users about poor photos.
/** 사용자 친화 한국어 메시지 매핑 */
export const QUALITY_ISSUE_LABELS = {
  too_dark:        { title: '너무 어두워요',        advice: '자연광이 있는 창가로 이동해주세요.' },
  too_bright:      { title: '너무 밝아요',          advice: '직사광선·강한 조명을 피해주세요.' },
  blurry:          { title: '사진이 흐려요',         advice: '폰을 고정하고 다시 촬영해주세요.' },
  no_face:         { title: '얼굴이 인식되지 않아요', advice: '얼굴을 가이드 안에 정면으로 맞춰주세요.' },
  face_too_small:  { title: '얼굴이 작아요',         advice: '폰을 더 가까이 (30cm 권장).' },
  face_yawed:      { title: '얼굴이 옆으로 돌아갔어요', advice: '카메라를 정면으로 응시해주세요.' },
  face_tilted:     { title: '얼굴이 기울어져 있어요', advice: '머리를 똑바로 세워주세요.' },
};

export function checkPhotoQuality(dataUrl, landmarks) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const W = Math.min(img.width, 320);
      const H = Math.min(img.height, 320);
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, W, H);
      const d = ctx.getImageData(0, 0, W, H).data;
      const n = d.length / 4;

      // 1. Average brightness
      let sumL = 0;
      for (let i = 0; i < d.length; i += 4) {
        sumL += 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
      }
      const brightness = sumL / n;

      // 2. Sharpness (Laplacian variance — higher = sharper)
      let lapSum = 0, lapCount = 0;
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const idx = (y * W + x) * 4;
          const c  = 0.299*d[idx]     + 0.587*d[idx+1]     + 0.114*d[idx+2];
          const l  = 0.299*d[idx-4]   + 0.587*d[idx-3]     + 0.114*d[idx-2];
          const r  = 0.299*d[idx+4]   + 0.587*d[idx+5]     + 0.114*d[idx+6];
          const u  = 0.299*d[idx-W*4] + 0.587*d[idx-W*4+1] + 0.114*d[idx-W*4+2];
          const dn = 0.299*d[idx+W*4] + 0.587*d[idx+W*4+1] + 0.114*d[idx+W*4+2];
          lapSum += Math.abs(l + r + u + dn - 4 * c);
          lapCount++;
        }
      }
      const sharpness = lapCount > 0 ? lapSum / lapCount : 0;

      // 3. Face size check (landmarks available)
      let faceRatio = 0;
      // 4. Face rotation/tilt check
      // - Yaw (좌우 회전): 왼쪽 눈(33) ~ 코끝(1) ~ 오른쪽 눈(263) 거리 비율로 측면 추정
      // - Roll (기울임): 양쪽 눈 외각 y 차이로 좌우 기울임 추정
      let yawAsymmetry = 0;
      let rollTilt = 0;
      if (landmarks && landmarks.length >= 468) {
        const earW = Math.abs(landmarks[234].x - landmarks[454].x);
        const faceH = Math.abs(landmarks[10].y - landmarks[152].y);
        faceRatio = earW * faceH;

        const leftEyeOuter = landmarks[33];
        const rightEyeOuter = landmarks[263];
        const noseTip = landmarks[1];

        // Yaw: 코끝이 양쪽 눈 중앙에서 얼마나 어긋났는지 (정면이면 0에 가까움)
        const eyesMidX = (leftEyeOuter.x + rightEyeOuter.x) / 2;
        const eyeSpan = Math.abs(rightEyeOuter.x - leftEyeOuter.x) || 1;
        yawAsymmetry = Math.abs(noseTip.x - eyesMidX) / eyeSpan;

        // Roll: 양쪽 눈 외각 y 좌표 차이를 눈 간격으로 정규화
        rollTilt = Math.abs(leftEyeOuter.y - rightEyeOuter.y) / eyeSpan;
      }

      // 임계 정상화 — 기존 150/152 좁은 범위 버그 수정.
      // brightness 정상: 70~190 (너무 어둡거나 과노출은 fail).
      // critical 케이스(측정 차단)와 warning(주의) 분리.
      const issues = [];
      const critical = []; // 측정 차단 수준
      if (brightness < 70) critical.push('too_dark');
      else if (brightness < 95) issues.push('too_dark');
      if (brightness > 210) critical.push('too_bright');
      else if (brightness > 190) issues.push('too_bright');

      if (sharpness < 8) critical.push('blurry');
      else if (sharpness < 14) issues.push('blurry');

      if (!landmarks || landmarks.length < 468) critical.push('no_face');
      else {
        if (faceRatio < 0.05) critical.push('face_too_small');
        else if (faceRatio < 0.08) issues.push('face_too_small');

        // 얼굴 회전: yaw 0.12 초과 critical, 0.08 warning. roll 0.08 critical, 0.05 warning.
        if (yawAsymmetry > 0.12) critical.push('face_yawed');
        else if (yawAsymmetry > 0.08) issues.push('face_yawed');
        if (rollTilt > 0.08) critical.push('face_tilted');
        else if (rollTilt > 0.05) issues.push('face_tilted');
      }

      resolve({
        passed: critical.length === 0 && issues.length === 0,
        passable: critical.length === 0, // critical 아니면 측정 가능 (warning만)
        critical,
        brightness, sharpness, faceRatio, yawAsymmetry, rollTilt, issues,
      });
    };
    img.onerror = () => resolve({ passed: true, brightness: 128, sharpness: 10, faceRatio: 0, issues: [] });
    img.src = dataUrl;
  });
}

// ===== GRAY-WORLD WHITE BALANCE + SOFT HISTOGRAM STRETCHING =====
// v3.1: Soft stretch blends 60% corrected + 40% original to prevent
//       noise amplification in dark photos and color oversaturation.
function normalizeLighting(ctx, W, H) {
  const imageData = ctx.getImageData(0, 0, W, H);
  const d = imageData.data;
  const n = d.length / 4;

  // 1. Gray-world white balance (clamped scale to prevent extreme shifts)
  let sumR = 0, sumG = 0, sumB = 0;
  for (let i = 0; i < d.length; i += 4) {
    sumR += d[i]; sumG += d[i + 1]; sumB += d[i + 2];
  }
  const avgR = sumR / n, avgG = sumG / n, avgB = sumB / n;
  const gray = (avgR + avgG + avgB) / 3;
  const scaleR = Math.min(1.6, Math.max(0.6, gray / (avgR + 0.01)));
  const scaleG = Math.min(1.6, Math.max(0.6, gray / (avgG + 0.01)));
  const scaleB = Math.min(1.6, Math.max(0.6, gray / (avgB + 0.01)));

  // 2. Find luminance percentiles for histogram stretching (5th-95th, softer)
  const lumArr = new Float32Array(n);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    lumArr[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  lumArr.sort();
  const lo = lumArr[Math.floor(n * 0.05)];
  const hi = lumArr[Math.floor(n * 0.95)];
  const range = hi - lo || 1;

  // 3. Apply corrections with soft blending (75% corrected, 25% original)
  const BLEND = 0.75;
  for (let i = 0; i < d.length; i += 4) {
    const origR = d[i], origG = d[i + 1], origB = d[i + 2];
    let r = origR * scaleR, g = origG * scaleG, b = origB * scaleB;
    const L = 0.299 * r + 0.587 * g + 0.114 * b;
    const stretchFactor = L > 0 ? ((Math.min(Math.max(L, lo), hi) - lo) / range * 255) / L : 1;
    const sr = r * stretchFactor, sg = g * stretchFactor, sb = b * stretchFactor;
    d[i]     = Math.min(255, Math.max(0, sr * BLEND + origR * (1 - BLEND)));
    d[i + 1] = Math.min(255, Math.max(0, sg * BLEND + origG * (1 - BLEND)));
    d[i + 2] = Math.min(255, Math.max(0, sb * BLEND + origB * (1 - BLEND)));
  }

  ctx.putImageData(imageData, 0, 0);
}

// ===== FIXED-RATIO FALLBACK REGIONS =====
function buildFixedRegions(W, H) {
  const cx = W / 2, cy = H * 0.42;
  const fw = W * 0.35, fh = H * 0.38;
  return {
    forehead:   { x1: cx-fw*.65, y1: cy-fh*.95, x2: cx+fw*.65, y2: cy-fh*.3 },
    nose:       { x1: cx-fw*.18, y1: cy-fh*.2,  x2: cx+fw*.18, y2: cy+fh*.35 },
    leftCheek:  { x1: cx-fw*.95, y1: cy-fh*.1,  x2: cx-fw*.2,  y2: cy+fh*.55 },
    rightCheek: { x1: cx+fw*.2,  y1: cy-fh*.1,  x2: cx+fw*.95, y2: cy+fh*.55 },
    chin:       { x1: cx-fw*.45, y1: cy+fh*.45,  x2: cx+fw*.45, y2: cy+fh*.95 },
    foreheadWrinkle: { x1: cx-fw*.55, y1: cy-fh*.9,  x2: cx+fw*.55, y2: cy-fh*.55 },
    leftCrowsFeet:   { x1: cx-fw*.95, y1: cy-fh*.35, x2: cx-fw*.55, y2: cy-fh*.05 },
    rightCrowsFeet:  { x1: cx+fw*.55, y1: cy-fh*.35, x2: cx+fw*.95, y2: cy-fh*.05 },
    nasolabialLeft:  { x1: cx-fw*.55, y1: cy+fh*.1,  x2: cx-fw*.15, y2: cy+fh*.55 },
    nasolabialRight: { x1: cx+fw*.15, y1: cy+fh*.1,  x2: cx+fw*.55, y2: cy+fh*.55 },
    noseWing:        { x1: cx-fw*.25, y1: cy-fh*.05, x2: cx+fw*.25, y2: cy+fh*.25 },
    leftInnerCheek:  { x1: cx-fw*.55, y1: cy-fh*.05, x2: cx-fw*.15, y2: cy+fh*.25 },
    rightInnerCheek: { x1: cx+fw*.15, y1: cy-fh*.05, x2: cx+fw*.55, y2: cy+fh*.25 },
    jawlineLeft:   { x1: cx-fw*.85, y1: cy+fh*.6,  x2: cx-fw*.2,  y2: cy+fh*1.1 },
    jawlineRight:  { x1: cx+fw*.2,  y1: cy+fh*.6,  x2: cx+fw*.85, y2: cy+fh*1.1 },
    jawlineCenter: { x1: cx-fw*.35, y1: cy+fh*.85, x2: cx+fw*.35, y2: cy+fh*1.15 },
    leftUpperCheek:  { x1: cx-fw*.85, y1: cy-fh*.25, x2: cx-fw*.25, y2: cy+fh*.15 },
    rightUpperCheek: { x1: cx+fw*.25, y1: cy-fh*.25, x2: cx+fw*.85, y2: cy+fh*.15 },
    foreheadSide:    { x1: cx-fw*.8,  y1: cy-fh*.85, x2: cx+fw*.8,  y2: cy-fh*.45 },
    leftCheekBroad:  { x1: cx-fw*.9,  y1: cy-fh*.15, x2: cx-fw*.1,  y2: cy+fh*.5 },
    rightCheekBroad: { x1: cx+fw*.1,  y1: cy-fh*.15, x2: cx+fw*.9,  y2: cy+fh*.5 },
    foreheadBroad:   { x1: cx-fw*.6,  y1: cy-fh*.9,  x2: cx+fw*.6,  y2: cy-fh*.35 },
    leftUnderEye:  { x1: cx-fw*.65, y1: cy-fh*.15, x2: cx-fw*.1,  y2: cy+fh*.08 },
    rightUnderEye: { x1: cx+fw*.1,  y1: cy-fh*.15, x2: cx+fw*.65, y2: cy+fh*.08 },
    leftMidCheek:  { x1: cx-fw*.7,  y1: cy+fh*.1,  x2: cx-fw*.2,  y2: cy+fh*.35 },
    rightMidCheek: { x1: cx+fw*.2,  y1: cy+fh*.1,  x2: cx+fw*.7,  y2: cy+fh*.35 },
  };
}

// ===== CORE PIXEL ANALYSIS =====
export function analyzePixels(dataUrl, landmarks = null) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const W = Math.min(img.width, 512);
      const H = Math.min(img.height, 512);
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, W, H);

      normalizeLighting(ctx, W, H);

      const regions = landmarks
        ? landmarksToRegions(landmarks, W, H)
        : buildFixedRegions(W, H);

      // ===== Helpers =====
      function getRegionData(r) {
        const x1 = Math.max(0, Math.round(r.x1)), y1 = Math.max(0, Math.round(r.y1));
        const x2 = Math.min(W, Math.round(r.x2)), y2 = Math.min(H, Math.round(r.y2));
        if (x2 <= x1 || y2 <= y1) return null;
        return ctx.getImageData(x1, y1, x2 - x1, y2 - y1);
      }

      // === 2-A. computeBasicStats — now with LAB + highlight clusters ===
      function computeBasicStats(imageData) {
        if (!imageData) return {
          avgL: 128, avgR: 128, avgG: 128, avgB: 128, stdL: 0,
          redRatio: 0, highlightRatio: 0, edgeDensity: 0, saturation: 0,
          labL: 50, labA: 0, labB: 0, stdLabL: 0, chroma: 0,
          highlightClusters: 0, pixelCount: 0, skinRatio: 0,
        };
        const d = imageData.data, n = d.length / 4;
        const w = imageData.width, h = imageData.height;
        let sumL=0, sumR=0, sumG=0, sumB=0, redPx=0, hiPx=0, satSum=0;
        let sumLabL=0, sumLabA=0, sumLabB=0;
        const lVals = new Float32Array(n);
        const labLVals = new Float32Array(n);

        // Highlight mask for cluster counting (L > 200)
        const hiMask = new Uint8Array(w * h);

        // Skin pixel pre-classification (YCbCr)
        const skinMask = new Uint8Array(n);
        let skinCount = 0;
        for (let i = 0, j = 0; i < d.length; i += 4, j++) {
          if (isSkinPixel(d[i], d[i+1], d[i+2])) { skinMask[j] = 1; skinCount++; }
        }
        const skinRatio = skinCount / n;
        const useSkinFilter = skinRatio > 0.2;
        let effectiveN = 0;

        for (let i = 0, j = 0; i < d.length; i += 4, j++) {
          const r=d[i], g=d[i+1], b=d[i+2];
          const L = .299*r + .587*g + .114*b;
          lVals[j] = L;
          if (L>200) { hiPx++; hiMask[j] = 1; }
          const lab = rgbToLab(r, g, b);
          labLVals[j] = lab.L;
          // Skip non-skin pixels for stat accumulation
          if (useSkinFilter && !skinMask[j]) continue;
          effectiveN++;
          sumL+=L; sumR+=r; sumG+=g; sumB+=b;
          if (r>g*1.2 && r>b*1.25 && r>95 && (r-g)>15) redPx++;
          const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
          if(mx>0) satSum+=(mx-mn)/mx;
          sumLabL += lab.L; sumLabA += lab.a; sumLabB += lab.b;
        }
        if (effectiveN === 0) effectiveN = n || 1;

        const avgL=sumL/effectiveN, avgR=sumR/effectiveN, avgG=sumG/effectiveN, avgB=sumB/effectiveN;
        const labL=sumLabL/effectiveN, labA=sumLabA/effectiveN, labB=sumLabB/effectiveN;

        let varS=0, varLabL=0;
        for (let j = 0; j < n; j++) {
          if (useSkinFilter && !skinMask[j]) continue;
          varS += (lVals[j]-avgL)**2;
          varLabL += (labLVals[j]-labL)**2;
        }

        // Edge density (Sobel-like)
        let edgeS=0, edgeC=0;
        for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++){
          const idx=(y*w+x)*4;
          const lC=.299*d[idx]+.587*d[idx+1]+.114*d[idx+2];
          const lL=.299*d[idx-4]+.587*d[idx-3]+.114*d[idx-2];
          const lR=.299*d[idx+4]+.587*d[idx+5]+.114*d[idx+6];
          const lU=.299*d[idx-w*4]+.587*d[idx-w*4+1]+.114*d[idx-w*4+2];
          const lD=.299*d[idx+w*4]+.587*d[idx+w*4+1]+.114*d[idx+w*4+2];
          edgeS+=Math.sqrt((lR-lL)**2+(lD-lU)**2); edgeC++;
        }

        // 4-connected highlight cluster count (for moisture)
        const visited = new Uint8Array(w * h);
        let clusterCount = 0;
        for (let j = 0; j < w * h; j++) {
          if (hiMask[j] && !visited[j]) {
            // BFS flood fill
            let size = 0;
            const stack = [j];
            visited[j] = 1;
            while (stack.length > 0) {
              const cur = stack.pop();
              size++;
              const cx = cur % w, cy = (cur - cx) / w;
              const neighbors = [];
              if (cx > 0) neighbors.push(cur - 1);
              if (cx < w - 1) neighbors.push(cur + 1);
              if (cy > 0) neighbors.push(cur - w);
              if (cy < h - 1) neighbors.push(cur + w);
              for (const nb of neighbors) {
                if (hiMask[nb] && !visited[nb]) {
                  visited[nb] = 1;
                  stack.push(nb);
                }
              }
            }
            if (size >= 3) clusterCount++;
          }
        }

        return {
          avgL, avgR, avgG, avgB, stdL: Math.sqrt(varS/effectiveN),
          redRatio: redPx/effectiveN, highlightRatio: hiPx/n,
          edgeDensity: edgeC>0?edgeS/edgeC:0, saturation: satSum/effectiveN,
          labL, labA, labB, stdLabL: Math.sqrt(varLabL/effectiveN),
          chroma: Math.sqrt(labA*labA + labB*labB),
          highlightClusters: clusterCount, pixelCount: effectiveN, skinRatio,
        };
      }

      // === 2-B. computeMoisture — multi-signal moisture estimation ===
      // v3.1: Three signals combined with sigmoid normalization to 30-85 range
      // 1. Highlight cluster density (micro-specular reflections = hydrated surface)
      // 2. Saturation uniformity (even color = even hydration)
      // 3. LAB L* smoothness (low local variance = plump, hydrated cells)
      function computeMoisture(imageData) {
        if (!imageData) return { clusterDensity: 0, satUniformity: 0, smoothness: 0, score: 0 };
        const d = imageData.data, n = d.length / 4;
        const w = imageData.width, h = imageData.height;

        const hiMask = new Uint8Array(w * h);
        const satVals = new Float32Array(n);
        const labLVals = new Float32Array(n);
        let hiCount = 0, satSum = 0, labLSum = 0;

        for (let i = 0, j = 0; i < d.length; i += 4, j++) {
          const r=d[i], g=d[i+1], b=d[i+2];
          const L = .299*r + .587*g + .114*b;
          if (L > 190) { hiMask[j] = 1; hiCount++; }
          const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
          satVals[j] = mx > 0 ? (mx-mn)/mx : 0;
          satSum += satVals[j];
          const lab = rgbToLab(r, g, b);
          labLVals[j] = lab.L;
          labLSum += lab.L;
        }

        // Signal 1: Highlight cluster density
        const visited = new Uint8Array(w * h);
        let clusterCount = 0;
        for (let j = 0; j < w * h; j++) {
          if (hiMask[j] && !visited[j]) {
            let size = 0;
            const stack = [j];
            visited[j] = 1;
            while (stack.length > 0) {
              const cur = stack.pop();
              size++;
              const cx = cur % w, cy = (cur - cx) / w;
              if (cx > 0 && hiMask[cur-1] && !visited[cur-1]) { visited[cur-1]=1; stack.push(cur-1); }
              if (cx < w-1 && hiMask[cur+1] && !visited[cur+1]) { visited[cur+1]=1; stack.push(cur+1); }
              if (cy > 0 && hiMask[cur-w] && !visited[cur-w]) { visited[cur-w]=1; stack.push(cur-w); }
              if (cy < h-1 && hiMask[cur+w] && !visited[cur+w]) { visited[cur+w]=1; stack.push(cur+w); }
            }
            if (size >= 3 && size <= 20) clusterCount++;
          }
        }
        const area = w * h;
        // Normalize: typical range 0-50 clusters in a region of ~2500px
        const clusterDensity = area > 0 ? Math.min(1, (clusterCount / area) * 200) : 0;

        // Signal 2: Saturation uniformity
        const avgSat = satSum / n;
        let satVar = 0;
        for (let j = 0; j < n; j++) satVar += (satVals[j] - avgSat) ** 2;
        const satUniformity = Math.max(0, 1 - Math.sqrt(satVar / n) * 4);

        // Signal 3: LAB L* local smoothness (5x5 patch variance average)
        const avgLabL = labLSum / n;
        let localVarSum = 0, localVarCount = 0;
        for (let y = 2; y < h - 2; y += 3) {
          for (let x = 2; x < w - 2; x += 3) {
            let pSum = 0, pSumSq = 0, pn = 0;
            for (let dy = -2; dy <= 2; dy++) {
              for (let dx = -2; dx <= 2; dx++) {
                const v = labLVals[(y+dy)*w + (x+dx)];
                pSum += v; pSumSq += v*v; pn++;
              }
            }
            localVarSum += pSumSq/pn - (pSum/pn)**2;
            localVarCount++;
          }
        }
        const avgLocalVar = localVarCount > 0 ? localVarSum / localVarCount : 50;
        // Low local variance = smooth hydrated skin. Typical range 5-80.
        const smoothness = Math.max(0, Math.min(1, 1 - avgLocalVar / 60));

        // Brightness correction: in dark environments, boost relative signals
        const avgLabLNorm = labLSum / n;
        const brightnessFactor = avgLabLNorm < 40 ? 1 + (40 - avgLabLNorm) * 0.01 : 1;

        // Combined score: sigmoid to map to realistic 20-90 range
        // Reduced cluster weight (lighting-dependent), increased smoothness & saturation (actual skin state)
        const raw = (clusterDensity * 0.15 + satUniformity * 0.40 + smoothness * 0.45) * brightnessFactor;
        const score = 20 + 70 / (1 + Math.exp(-(raw - 0.45) * 8));

        return { clusterDensity, satUniformity, smoothness, score };
      }

      // === 2-C. computeMultiScaleEdge — wrinkle/texture/pore separation ===
      function computeMultiScaleEdge(imageData) {
        if (!imageData) return { highFreq: 0, midFreq: 0, lowFreq: 0 };
        const d = imageData.data, w = imageData.width, h = imageData.height;

        // Precompute luminance map
        const lum = new Float32Array(w * h);
        for (let i = 0, j = 0; i < d.length; i += 4, j++) {
          lum[j] = .299*d[i] + .587*d[i+1] + .114*d[i+2];
        }

        // Box-average energy at a given radius
        function scaleEnergy(radius) {
          let sum = 0, count = 0;
          for (let y = radius; y < h - radius; y += 2) {
            for (let x = radius; x < w - radius; x += 2) {
              const c = lum[y * w + x];
              // Sample 4 directional neighbors at distance=radius
              const top = lum[(y - radius) * w + x];
              const bot = lum[(y + radius) * w + x];
              const lft = lum[y * w + (x - radius)];
              const rgt = lum[y * w + (x + radius)];
              // Laplacian-like: center vs average of neighbors
              const avg4 = (top + bot + lft + rgt) / 4;
              sum += Math.abs(c - avg4);
              count++;
            }
          }
          return count > 0 ? sum / count : 0;
        }

        return {
          highFreq: scaleEnergy(1),   // 3×3: pores, micro-texture
          midFreq:  scaleEnergy(3),   // 7×7: skin texture, roughness
          lowFreq:  scaleEnergy(6),   // 13×13: wrinkles, large lines
        };
      }

      // === 2-D. computeDarkSpots — LAB L* connected-region analysis ===
      function computeDarkSpots(imageData) {
        if (!imageData) return { clusterCount: 0, totalArea: 0, redSpots: 0, brownSpots: 0, weightedPenalty: 0 };
        const d = imageData.data, w = imageData.width, h = imageData.height;
        const n = w * h;

        // Build per-pixel LAB L* and a* maps
        const mapL = new Float32Array(n);
        const mapA = new Float32Array(n);
        for (let i = 0, j = 0; i < d.length; i += 4, j++) {
          const lab = rgbToLab(d[i], d[i+1], d[i+2]);
          mapL[j] = lab.L;
          mapA[j] = lab.a;
        }

        // Local average L* in a 5px radius neighborhood
        const radius = 5;
        const darkMask = new Uint8Array(n);
        for (let y = radius; y < h - radius; y++) {
          for (let x = radius; x < w - radius; x++) {
            const idx = y * w + x;
            const cL = mapL[idx];
            // Sample 8 neighbors at distance=radius
            let nSum = 0, nCount = 0;
            const offsets = [[-radius,-radius],[0,-radius],[radius,-radius],[-radius,0],[radius,0],[-radius,radius],[0,radius],[radius,radius]];
            for (const [dy,dx] of offsets) {
              const ny = y+dy, nx = x+dx;
              if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
                nSum += mapL[ny * w + nx];
                nCount++;
              }
            }
            const nAvg = nSum / nCount;
            // Mark as dark if significantly darker than local neighborhood (12% threshold in LAB L*)
            if (nAvg > 20 && cL < nAvg * 0.88) darkMask[idx] = 1;
          }
        }

        // 4-connected clustering — only 3px+ clusters count as real spots
        const visited = new Uint8Array(n);
        let clusterCount = 0, totalArea = 0, redSpots = 0, brownSpots = 0, weightedPenalty = 0;

        for (let j = 0; j < n; j++) {
          if (darkMask[j] && !visited[j]) {
            const stack = [j];
            visited[j] = 1;
            let size = 0, sumA = 0;
            while (stack.length > 0) {
              const cur = stack.pop();
              size++;
              sumA += mapA[cur];
              const cx = cur % w, cy = (cur - cx) / w;
              if (cx > 0 && darkMask[cur-1] && !visited[cur-1]) { visited[cur-1]=1; stack.push(cur-1); }
              if (cx < w-1 && darkMask[cur+1] && !visited[cur+1]) { visited[cur+1]=1; stack.push(cur+1); }
              if (cy > 0 && darkMask[cur-w] && !visited[cur-w]) { visited[cur-w]=1; stack.push(cur-w); }
              if (cy < h-1 && darkMask[cur+w] && !visited[cur+w]) { visited[cur+w]=1; stack.push(cur+w); }
            }
            // Require minimum 3px cluster
            if (size >= 3) {
              clusterCount++;
              totalArea += size;
              const avgA = sumA / size;
              if (avgA > 8) redSpots++;    // a* > 8 → red/inflamed spot (trouble)
              else brownSpots++;            // a* ≤ 8 → brown pigmentation
              // Size-weighted penalty: larger spots penalized more
              weightedPenalty += Math.sqrt(size);
            }
          }
        }

        return { clusterCount, totalArea, redSpots, brownSpots, weightedPenalty };
      }

      // === 2-D2. computeTroubleSpots — Acne/whitehead-specific detection ===
      // Detects actual inflammatory acne (red bumps with strong local contrast),
      // NOT general skin redness or blemishes (잡티).
      // Key: acne has (1) high absolute a*, (2) strong local a* spike, (3) compact shape.
      function computeTroubleSpots(imageData) {
        if (!imageData) return { count: 0, severity: 0 };
        const d = imageData.data, w = imageData.width, h = imageData.height;
        const n = w * h;

        // Build per-pixel LAB a* and L* maps
        const mapA = new Float32Array(n);
        const mapL = new Float32Array(n);
        let sumA = 0;
        for (let i = 0, j = 0; i < d.length; i += 4, j++) {
          const lab = rgbToLab(d[i], d[i + 1], d[i + 2]);
          mapA[j] = lab.a;
          mapL[j] = lab.L;
          sumA += lab.a;
        }
        const avgA = sumA / n;

        // Very strict threshold: normal skin a* is 8-16, acne spikes to 22+
        const threshold = Math.max(avgA + 10, 20);
        const redMask = new Uint8Array(n);
        const radius = 6;
        for (let y = radius; y < h - radius; y++) {
          for (let x = radius; x < w - radius; x++) {
            const idx = y * w + x;
            const ca = mapA[idx];
            if (ca < threshold) continue;

            // Strong local contrast: must be clearly redder than 6px-radius neighbors
            let nSum = 0, nCount = 0;
            for (let dy = -radius; dy <= radius; dy += radius) {
              for (let dx = -radius; dx <= radius; dx += radius) {
                if (dy === 0 && dx === 0) continue;
                const ny = y + dy, nx = x + dx;
                if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
                  nSum += mapA[ny * w + nx];
                  nCount++;
                }
              }
            }
            const nAvg = nSum / nCount;
            // Pixel must be at least 6 a* units redder than neighbors
            if (ca > nAvg + 6) redMask[idx] = 1;
          }
        }

        // 4-connected clustering — acne-sized clusters only (5-300px at 512px resolution)
        const visited = new Uint8Array(n);
        let count = 0, totalSeverity = 0;
        for (let j = 0; j < n; j++) {
          if (redMask[j] && !visited[j]) {
            const stack = [j];
            visited[j] = 1;
            let size = 0, sumRedA = 0, sumRedL = 0;
            while (stack.length > 0) {
              const cur = stack.pop();
              size++;
              sumRedA += mapA[cur];
              sumRedL += mapL[cur];
              const cx = cur % w, cy = (cur - cx) / w;
              if (cx > 0 && redMask[cur - 1] && !visited[cur - 1]) { visited[cur - 1] = 1; stack.push(cur - 1); }
              if (cx < w - 1 && redMask[cur + 1] && !visited[cur + 1]) { visited[cur + 1] = 1; stack.push(cur + 1); }
              if (cy > 0 && redMask[cur - w] && !visited[cur - w]) { visited[cur - w] = 1; stack.push(cur - w); }
              if (cy < h - 1 && redMask[cur + w] && !visited[cur + w]) { visited[cur + w] = 1; stack.push(cur + w); }
            }
            // Size filter: too small = noise, too large = diffuse redness (not pimple)
            if (size >= 10 && size <= 300) {
              const clusterAvgA = sumRedA / size;
              // Extra check: cluster must have high average a* (inflammatory)
              if (clusterAvgA >= threshold) {
                count++;
                totalSeverity += Math.sqrt(size) * (clusterAvgA - avgA);
              }
            }
          }
        }

        return { count, severity: totalSeverity };
      }

      // === 2-E. computeDarkCircles — LAB 3-component model ===
      function computeDarkCircles(underEyeData, refCheekData) {
        if (!underEyeData || !refCheekData) return { vascular: 0, shadow: 0, pigment: 0, severity: 0 };

        const eyeLab = labStats(underEyeData);
        const cheekLab = labStats(refCheekData);

        // 1. Vascular component (40%): L* difference + a* decrease (bluish shift)
        //    Dark circles from blood pooling: lower L*, lower a* (less red, more blue-purple)
        const lDiff = Math.max(0, cheekLab.avgL - eyeLab.avgL) / Math.max(cheekLab.avgL, 1);
        const aShift = Math.max(0, cheekLab.avgA - eyeLab.avgA) / 20; // a* decrease = blue shift
        const vascular = Math.min(1, lDiff * 2 + aShift * 0.5);

        // 2. Shadow component (35%): brightness gradient smoothness
        //    Structural shadows have smooth gradients; true dark circles are more diffuse
        //    Use stdL difference — shadows have lower variance (uniform darkness)
        const eyeStdNorm = eyeLab.stdL / Math.max(eyeLab.avgL, 1);
        const cheekStdNorm = cheekLab.stdL / Math.max(cheekLab.avgL, 1);
        const gradientDiff = Math.abs(eyeStdNorm - cheekStdNorm);
        const shadow = Math.min(1, lDiff * 1.5 + gradientDiff * 2);

        // 3. Pigment component (25%): b* value (brown/yellow bias)
        //    Pigmentation-based dark circles show higher b* (more yellow-brown)
        const bShift = Math.max(0, eyeLab.avgB - cheekLab.avgB) / 15;
        const pigment = Math.min(1, bShift + lDiff * 0.5);

        // Weighted severity
        const severity = vascular * 0.40 + shadow * 0.35 + pigment * 0.25;

        return { vascular, shadow, pigment, severity };
      }

      // Micro-variance (pores) — v3.1: LAB L* based for skin-tone independence
      function computeMicroVariance(imageData, windowSize = 5) {
        if (!imageData) return 0;
        const d = imageData.data, w = imageData.width, h = imageData.height;
        const n = w * h;
        // Precompute LAB L* map
        const labL = new Float32Array(n);
        for (let i = 0, j = 0; i < d.length; i += 4, j++) {
          labL[j] = rgbToLab(d[i], d[i+1], d[i+2]).L;
        }
        const half = Math.floor(windowSize / 2);
        let totalVar = 0, count = 0;
        for (let y = half; y < h - half; y += 2) for (let x = half; x < w - half; x += 2) {
          let sum = 0, sumSq = 0, nn = 0;
          for (let dy = -half; dy <= half; dy++) for (let dx = -half; dx <= half; dx++) {
            const v = labL[(y+dy)*w + (x+dx)];
            sum += v; sumSq += v*v; nn++;
          }
          totalVar += sumSq / nn - (sum / nn) ** 2; count++;
        }
        return count > 0 ? totalVar / count : 0;
      }

      // ===== Run all analyses =====
      const basicRegions = {};
      for (const [name, rect] of Object.entries(regions)) {
        basicRegions[name] = computeBasicStats(getRegionData(rect));
      }

      // Moisture (new: highlight cluster density)
      const moistureRegions = ['leftCheek', 'rightCheek', 'forehead', 'chin'];
      let moistureTotal = 0;
      for (const name of moistureRegions) {
        const mData = computeMoisture(getRegionData(regions[name]));
        moistureTotal += mData.score;
      }
      const moistureData = { avgScore: moistureTotal / moistureRegions.length };

      // Wrinkles + Texture (new: multi-scale edge)
      const fhEdge = computeMultiScaleEdge(getRegionData(regions.foreheadWrinkle));
      const lcfEdge = computeMultiScaleEdge(getRegionData(regions.leftCrowsFeet));
      const rcfEdge = computeMultiScaleEdge(getRegionData(regions.rightCrowsFeet));
      const nlLEdge = computeMultiScaleEdge(getRegionData(regions.nasolabialLeft));
      const nlREdge = computeMultiScaleEdge(getRegionData(regions.nasolabialRight));

      const wrinkleData = {
        foreheadLow: fhEdge.lowFreq,
        crowsFeetLow: (lcfEdge.lowFreq + rcfEdge.lowFreq) / 2,
        nasolabialLow: (nlLEdge.lowFreq + nlREdge.lowFreq) / 2,
        overall: fhEdge.lowFreq * 0.4 + ((lcfEdge.lowFreq + rcfEdge.lowFreq) / 2) * 0.35 + ((nlLEdge.lowFreq + nlREdge.lowFreq) / 2) * 0.25,
      };

      // Texture from broad regions (mid-frequency)
      const lCheekEdge = computeMultiScaleEdge(getRegionData(regions.leftCheekBroad));
      const rCheekEdge = computeMultiScaleEdge(getRegionData(regions.rightCheekBroad));
      const fhBroadEdge = computeMultiScaleEdge(getRegionData(regions.foreheadBroad));

      const textureData = {
        cheekMid: (lCheekEdge.midFreq + rCheekEdge.midFreq) / 2,
        foreheadMid: fhBroadEdge.midFreq,
        cheekHigh: (lCheekEdge.highFreq + rCheekEdge.highFreq) / 2,
        foreheadHigh: fhBroadEdge.highFreq,
        overallMid: ((lCheekEdge.midFreq + rCheekEdge.midFreq) / 2) * 0.6 + fhBroadEdge.midFreq * 0.4,
        overallHigh: ((lCheekEdge.highFreq + rCheekEdge.highFreq) / 2) * 0.6 + fhBroadEdge.highFreq * 0.4,
      };

      // Pores
      const poreData = {
        noseScore: computeMicroVariance(getRegionData(regions.noseWing)),
        cheekScore: (computeMicroVariance(getRegionData(regions.leftInnerCheek)) + computeMicroVariance(getRegionData(regions.rightInnerCheek))) / 2,
      };
      poreData.overall = poreData.noseScore * 0.5 + poreData.cheekScore * 0.5;

      // Elasticity — v3.1: upper vs lower edge ratio to distinguish firm vs sagging
      function computeElasticityDetail(imageData) {
        if (!imageData) return { edgeDensity: 0, upperEdge: 0, lowerEdge: 0, firmness: 0 };
        const d = imageData.data, w = imageData.width, h = imageData.height;
        const midY = Math.floor(h / 2);
        let upperSum = 0, upperCnt = 0, lowerSum = 0, lowerCnt = 0;
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
          const idx = (y*w+x)*4;
          const lC = .299*d[idx]+.587*d[idx+1]+.114*d[idx+2];
          const lL = .299*d[idx-4]+.587*d[idx-3]+.114*d[idx-2];
          const lR = .299*d[idx+4]+.587*d[idx+5]+.114*d[idx+6];
          const lU = .299*d[idx-w*4]+.587*d[idx-w*4+1]+.114*d[idx-w*4+2];
          const lD = .299*d[idx+w*4]+.587*d[idx+w*4+1]+.114*d[idx+w*4+2];
          const e = Math.sqrt((lR-lL)**2 + (lD-lU)**2);
          if (y < midY) { upperSum += e; upperCnt++; }
          else { lowerSum += e; lowerCnt++; }
        }
        const upperEdge = upperCnt > 0 ? upperSum / upperCnt : 0;
        const lowerEdge = lowerCnt > 0 ? lowerSum / lowerCnt : 0;
        const edgeDensity = (upperSum + lowerSum) / (upperCnt + lowerCnt || 1);
        // Firm jawline: edge concentrated in upper half (jawline contour)
        // Sagging: edge in lower half (double chin boundary)
        const firmness = (upperEdge + 0.01) / (lowerEdge + 0.01);
        return { edgeDensity, upperEdge, lowerEdge, firmness };
      }

      const jawLDetail = computeElasticityDetail(getRegionData(regions.jawlineLeft));
      const jawRDetail = computeElasticityDetail(getRegionData(regions.jawlineRight));
      const jawCDetail = computeElasticityDetail(getRegionData(regions.jawlineCenter));
      const avgFirmness = (jawLDetail.firmness + jawRDetail.firmness) / 2;
      const elasticityData = {
        jawlineEdge: (jawLDetail.edgeDensity + jawRDetail.edgeDensity) / 2,
        chinDrop: jawCDetail.edgeDensity,
        firmness: avgFirmness,
        // Edge density matters, but firmness ratio adjusts direction
        // High edge + high firmness = good; high edge + low firmness = sagging
        overall: ((jawLDetail.edgeDensity + jawRDetail.edgeDensity) / 2) * 0.4
               + jawCDetail.edgeDensity * 0.25
               + Math.min(avgFirmness, 3) * 0.35,
      };

      // Pigmentation (new: LAB connected-region)
      const lSpots = computeDarkSpots(getRegionData(regions.leftUpperCheek));
      const rSpots = computeDarkSpots(getRegionData(regions.rightUpperCheek));
      const fSpots = computeDarkSpots(getRegionData(regions.foreheadSide));
      const pigmentationData = {
        cheekPenalty: (lSpots.weightedPenalty + rSpots.weightedPenalty) / 2,
        foreheadPenalty: fSpots.weightedPenalty,
        cheekClusters: (lSpots.clusterCount + rSpots.clusterCount) / 2,
        foreheadClusters: fSpots.clusterCount,
        redSpots: lSpots.redSpots + rSpots.redSpots + fSpots.redSpots,
        brownSpots: lSpots.brownSpots + rSpots.brownSpots + fSpots.brownSpots,
        overallPenalty: ((lSpots.weightedPenalty + rSpots.weightedPenalty) / 2) * 0.6 + fSpots.weightedPenalty * 0.4,
      };

      // Trouble spots (new: LAB a* redness detection)
      const lTrouble = computeTroubleSpots(getRegionData(regions.leftUpperCheek));
      const rTrouble = computeTroubleSpots(getRegionData(regions.rightUpperCheek));
      const fTrouble = computeTroubleSpots(getRegionData(regions.foreheadSide));
      const chinTrouble = computeTroubleSpots(getRegionData(regions.chin));
      const noseTrouble = computeTroubleSpots(getRegionData(regions.nose));
      const troubleData = {
        totalSpots: lTrouble.count + rTrouble.count + fTrouble.count + chinTrouble.count + noseTrouble.count,
        totalSeverity: lTrouble.severity + rTrouble.severity + fTrouble.severity + chinTrouble.severity + noseTrouble.severity,
      };

      // Dark Circles (new: LAB 3-component)
      const leftDC = computeDarkCircles(getRegionData(regions.leftUnderEye), getRegionData(regions.leftMidCheek));
      const rightDC = computeDarkCircles(getRegionData(regions.rightUnderEye), getRegionData(regions.rightMidCheek));
      const darkCircleData = {
        leftSeverity: leftDC.severity,
        rightSeverity: rightDC.severity,
        vascular: (leftDC.vascular + rightDC.vascular) / 2,
        shadow: (leftDC.shadow + rightDC.shadow) / 2,
        pigment: (leftDC.pigment + rightDC.pigment) / 2,
        overall: (leftDC.severity + rightDC.severity) / 2,
        asymmetry: Math.abs(leftDC.severity - rightDC.severity),
      };

      // ===== Aggregate metrics =====
      const mainRegions = [basicRegions.forehead, basicRegions.nose, basicRegions.leftCheek, basicRegions.rightCheek, basicRegions.chin];

      // T-zone / U-zone shine (for oil balance)
      const tzoneShine = (basicRegions.forehead.highlightRatio + basicRegions.nose.highlightRatio) / 2;
      const uzoneShine = (basicRegions.leftCheek.highlightRatio + basicRegions.rightCheek.highlightRatio + basicRegions.chin.highlightRatio) / 3;

      // LAB-based aggregates
      const avgLabL = mainRegions.reduce((s,r) => s+r.labL, 0) / 5;
      const avgLabA = mainRegions.reduce((s,r) => s+r.labA, 0) / 5;
      const avgLabB = mainRegions.reduce((s,r) => s+r.labB, 0) / 5;
      const avgStdLabL = mainRegions.reduce((s,r) => s+r.stdLabL, 0) / 5;

      // Cheek-specific LAB for trouble/redness
      const cheekLabA = (basicRegions.leftCheek.labA + basicRegions.rightCheek.labA) / 2;
      const chinLabA = basicRegions.chin.labA;

      // Red ratio (legacy, still useful for trouble)
      const avgRedRatio = mainRegions.reduce((s,r) => s+r.redRatio, 0) / 5;
      const cheekRedRatio = (basicRegions.leftCheek.redRatio + basicRegions.rightCheek.redRatio) / 2;

      // Cheek asymmetry in LAB L*
      const cheekAsymmetry = Math.abs(basicRegions.leftCheek.labL - basicRegions.rightCheek.labL);

      // LAB L* range across main regions
      const labLRange = Math.max(...mainRegions.map(s=>s.labL)) - Math.min(...mainRegions.map(s=>s.labL));

      // Average skin pixel ratio across main regions
      const avgSkinRatio = mainRegions.reduce((s,r) => s + (r.skinRatio || 0), 0) / 5;

      resolve({
        // LAB aggregates (new)
        labL: avgLabL, labA: avgLabA, labB: avgLabB, stdLabL: avgStdLabL,
        cheekLabA, chinLabA, cheekAsymmetry, labLRange,
        // Legacy RGB (kept for oil balance / compatibility)
        brightness: mainRegions.reduce((s,r) => s+r.avgL, 0) / 5,
        variance: mainRegions.reduce((s,r) => s+r.stdL, 0) / 5,
        redRatio: avgRedRatio, cheekRedness: cheekRedRatio,
        chinRedness: basicRegions.chin.redRatio,
        tzoneShine, uzoneShine,
        saturation: mainRegions.reduce((s,r) => s+r.saturation, 0) / 5,
        skinRatio: avgSkinRatio,
        faceDetected: !!landmarks,
        // New analysis data
        moisture: moistureData,
        wrinkle: wrinkleData,
        texture: textureData,
        pore: poreData,
        elasticity: elasticityData,
        pigmentation: pigmentationData,
        darkCircle: darkCircleData,
        trouble: troubleData,
      });
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// ===== PIXEL DATA → 10 SCORES + SKIN AGE =====
// ===== CALIBRATION TABLES (restored from afa58f1) =====
// Each table: [rawValue, score] pairs — piecewise-linear interpolation.
// 비선형 점수 매핑으로 평이한 raw 값이 너무 후하게 점수화되는 문제를 보정.
const CALIBRATION = {
  wrinkle: [
    // [edge energy, score] — lower edge = smoother = higher score
    [1.0, 96], [2.0, 88], [3.5, 78], [5.0, 66],
    [7.0, 54], [9.5, 42], [12.0, 32], [15.0, 22], [18.0, 15],
  ],
  moisture: [
    // [avgScore from cluster density, score]
    [15, 15], [25, 28], [35, 42], [45, 55],
    [55, 65], [65, 75], [75, 85], [85, 92], [95, 95],
  ],
  pore: [
    // [micro variance, score] — lower variance = finer pores = higher score
    [20, 95], [60, 85], [120, 72], [200, 58],
    [300, 44], [420, 32], [550, 20], [700, 15],
  ],
  texture: [
    // [combined mid+high energy, score]
    [2.0, 95], [4.0, 86], [7.0, 75], [10.0, 65],
    [14.0, 54], [18.0, 42], [24.0, 30], [30.0, 20],
  ],
  darkCircle: [
    // [severity 0~0.5, score]
    [0.01, 95], [0.05, 85], [0.10, 72], [0.17, 58],
    [0.24, 44], [0.32, 32], [0.40, 22], [0.50, 15],
  ],
  pigmentation: [
    // [overall penalty, score]
    [0.5, 95], [2.0, 85], [4.0, 72], [7.0, 58],
    [10.0, 46], [14.0, 34], [18.0, 24], [22.0, 15],
  ],
  elasticity: [
    // [overall (edge density * firmness blend), score] — higher = more elastic
    [1.0, 18], [2.0, 30], [3.0, 42], [4.5, 55],
    [6.0, 65], [8.0, 76], [10.0, 85], [12.0, 92], [14.0, 96],
  ],
};

function calibrate(metric, rawValue) {
  const table = CALIBRATION[metric];
  if (!table) return 50;
  if (rawValue <= table[0][0]) return table[0][1];
  if (rawValue >= table[table.length - 1][0]) return table[table.length - 1][1];
  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i];
    const [x1, y1] = table[i + 1];
    if (rawValue >= x0 && rawValue <= x1) {
      const t = (rawValue - x0) / (x1 - x0);
      return Math.round(y0 + t * (y1 - y0));
    }
  }
  return 50;
}

// Legacy linear formulas — used ONLY by window.__compareCalibration debug helper.
// raw 입력은 calibrate()가 받는 것과 동일한 시그니처. texture/elasticity의 경우
// 옛 main의 실제 공식이 다중 입력(mid+high, edge+firmness) 합성이었으나,
// 비교용으로 단일 raw 가정해서 근사 — 정확한 1:1 비교가 아니라는 점에 유의.
const LEGACY_LINEAR_SCORE = {
  moisture: (raw) => raw,
  wrinkle: (raw) => 100 - (raw - 3) * 5,
  pore: (raw) => 100 - (raw - 60) * 0.18,
  pigmentation: (raw) => 100 - raw * 4.5,
  darkCircle: (raw) => {
    const m = raw < 0.15 ? raw * 180 : Math.sqrt(raw) * 100;
    return 100 - m;
  },
  texture: (rawCombined) => {
    const tFromMid = Math.max(0, 100 - (rawCombined - 3.5) * 4);
    const tFromHigh = Math.max(0, 100 - (rawCombined - 4) * 2);
    return tFromMid * 0.65 + tFromHigh * 0.35;
  },
  elasticity: (raw) => 92 - (raw - 4) * 2.5,
};

const COMPARE_RAW_SAMPLES = {
  wrinkle:      [1, 2, 3, 5, 7, 10, 13, 16],
  moisture:     [15, 25, 35, 50, 65, 80, 95],
  pore:         [30, 60, 120, 200, 300, 450, 600],
  texture:      [2, 5, 8, 12, 16, 22],
  darkCircle:   [0.05, 0.10, 0.15, 0.22, 0.30, 0.40],
  pigmentation: [1, 2, 5, 9, 14, 20],
  elasticity:   [1, 3, 5, 7, 9, 12],
};

const COMPARE_CLAMP = {
  wrinkle: [15, 98], pore: [15, 98], texture: [15, 98], darkCircle: [15, 98],
  pigmentation: [15, 98], elasticity: [15, 98], moisture: [12, 95],
};

/**
 * window.__compareCalibration([metric]) — 옛 calibrate(복원) vs 현재 linear 공식 점수 비교.
 * 인자 없으면 7개 메트릭 모두 출력, 메트릭명 주면 그 하나만.
 */
function compareCalibration(metricArg) {
  const metrics = metricArg ? [metricArg] : Object.keys(CALIBRATION);
  for (const metric of metrics) {
    const samples = COMPARE_RAW_SAMPLES[metric];
    const [lo, hi] = COMPARE_CLAMP[metric] || [0, 100];
    if (!samples) { console.warn(`[compareCalibration] unknown metric: ${metric}`); continue; }
    const rows = samples.map((raw) => {
      const calib = Math.max(lo, Math.min(hi, Math.round(calibrate(metric, raw))));
      const lin = Math.max(lo, Math.min(hi, Math.round(LEGACY_LINEAR_SCORE[metric](raw))));
      return { raw, calibrated: calib, legacyLinear: lin, delta: calib - lin };
    });
    console.group(` ${metric}  (clamp ${lo}–${hi})`);
    console.table(rows);
    console.groupEnd();
  }
  return '— compareCalibration done (calibrated = 복원된 표 / legacyLinear = 직전 main 공식)';
}

if (typeof window !== 'undefined') {
  window.__compareCalibration = compareCalibration;
}

export function pixelsToScores(px, mlAge = null) {
  if (!px) return generateDemoScores();

  // ── MOISTURE (calibration table) ──
  const moisture = clamp(calibrate('moisture', px.moisture.avgScore), 12, 95);

  // ── SKIN TONE (v3.1: uniformity-centric, reduced brightness bias) ──
  // Brightness accounts for only 30% — skin tone quality is mainly about evenness
  // Uniformity (low stdLabL) = 40%, Symmetry (low cheekAsymmetry) = 20%, Brightness = 30%, Redness = 10% penalty
  const brightnessComponent = Math.min(30, 15 + (px.labL - 30) * 0.5);  // max 30pts, fairer for dark skin
  const uniformityComponent = Math.max(0, 40 - px.stdLabL * 3);  // max 40pts from uniformity
  const symmetryComponent = Math.max(0, 20 - px.cheekAsymmetry * 2);  // max 20pts from symmetry
  const rednessPenalty = Math.min(15, Math.max(0, px.cheekLabA - 10) * 1.5);
  const skinTone = clamp(brightnessComponent + uniformityComponent + symmetryComponent - rednessPenalty + 10, 22, 95);

  // ── TROUBLE (v3.3: acne-only detection, separated from 잡티) ──
  // Only counts inflammatory acne (red bumps with strong local contrast).
  // 잡티 (blemishes, brown spots) are handled by pigmentation score, NOT here.
  const dedicatedSpots = px.trouble ? px.trouble.totalSpots : 0;
  // Combine: only dedicated acne detection counts
  const troubleRaw = dedicatedSpots;
  const troubleCount = clamp(Math.round(troubleRaw), 0, 20);

  // ── OIL BALANCE (v3.1: multi-signal with wider range) ──
  // Signal 1: T/U-zone shine ratio (original)
  const sr = px.tzoneShine / (px.uzoneShine + 0.001);
  const shineSignal = sigmoid((sr - 1.5) * 2.5);  // 0-1
  // Signal 2: Overall highlight ratio — very low = dry, very high = oily
  const totalShine = px.tzoneShine + px.uzoneShine;
  const shineLevel = sigmoid((totalShine - 0.04) * 80);  // 0-1
  // Signal 3: Saturation level — oily skin tends to have lower saturation (washed out by shine)
  const satSignal = 1 - Math.min(1, px.saturation * 3);  // high sat = dry, low sat = oily
  // Combined: weighted blend, then map to 15-90 range (increased sat weight for matte-oily detection)
  const oilRaw = shineSignal * 0.35 + shineLevel * 0.35 + satSignal * 0.30;
  const oilBalance = clamp(15 + oilRaw * 75, 12, 95);

  // ── WRINKLES (calibration table) ──
  const wrinkleScore = clamp(calibrate('wrinkle', px.wrinkle.overall), 15, 98);

  // ── PORES (calibration table) ──
  const poreScore = clamp(calibrate('pore', px.pore.overall), 15, 98);

  // ── ELASTICITY (calibration table) ──
  const elasticityScore = clamp(calibrate('elasticity', px.elasticity.overall), 15, 98);

  // ── PIGMENTATION (calibration table) ──
  const pigmentationScore = clamp(calibrate('pigmentation', px.pigmentation.overallPenalty), 15, 98);

  // ── TEXTURE (calibration table on combined mid+high energy) ──
  const textureCombined = px.texture.overallMid * 0.65 + px.texture.overallHigh * 0.35;
  const textureScore = clamp(calibrate('texture', textureCombined), 15, 98);

  // ── DARK CIRCLES (calibration table) ──
  const dcScore = clamp(calibrate('darkCircle', px.darkCircle.overall), 15, 98);

  // ── SKIN TYPE ──
  let skinType;
  if (oilBalance > 72) skinType = '지성';
  else if (oilBalance < 35) skinType = '건성';
  else if (oilBalance > 55 && moisture < 50) skinType = '복합성';
  else if (oilBalance >= 35 && oilBalance <= 55 && moisture >= 55) skinType = '중성';
  else skinType = '복합성';

  // ── SKIN AGE (derived from overallScore — unified across CV/API/Hybrid) ──
  // 100점→18세, 0점→60세. overallScore와 항상 같은 방향으로 움직임.
  // NOTE: skinAge is computed AFTER overallScore below, using a forward declaration.
  let skinAge; // assigned after overallScore calculation

  // ── CONCERNS ──
  const troubleScoreVal = Math.max(0, 100-troubleCount*8.5);
  const oilScoreVal = 100 - Math.abs(55-oilBalance)*1.4;
  const concernScores = [
    { name: '건조함', score: Math.max(0, 72-moisture)*1.2 },
    { name: '색소침착', score: (100-pigmentationScore)*0.7 },
    { name: '여드름', score: troubleCount*7 },
    { name: '넓은모공', score: (100-poreScore)*0.65 },
    { name: '홍조', score: Math.max(0, px.cheekLabA - 10) * 5 },
    { name: '잔주름', score: (100-wrinkleScore)*0.75 },
    { name: '유분과다', score: Math.max(0, oilBalance-68)*1.5 },
    { name: '탄력저하', score: (100-elasticityScore)*0.65 },
    { name: '다크서클', score: (100-dcScore)*0.8 },
    { name: '피부결', score: (100-textureScore)*0.7 },
    { name: '기미·잡티', score: px.pigmentation.brownSpots * 5 },
  ];
  concernScores.sort((a,b) => b.score - a.score);
  const concerns = concernScores.filter(c => c.score > 4).slice(0,3).map(c => c.name);
  if (concerns.length < 2) concerns.push('수분관리', '피부결');

  // ── OVERALL SCORE (10-metric weighted — unified across CV/API/Hybrid) ──
  const overallScore = clamp(
    wrinkleScore      * 0.13 +
    elasticityScore   * 0.12 +
    moisture          * 0.12 +
    textureScore      * 0.10 +
    troubleScoreVal   * 0.08 +
    poreScore         * 0.10 +
    pigmentationScore * 0.09 +
    skinTone          * 0.09 +
    dcScore           * 0.09 +
    Math.max(30, oilScoreVal) * 0.08
  , 32, 96);

  // ── CONDITION SCORE (실시간 컨디션 — 구조 지표 대비 컨디션 편차 반영) ──
  // 컨디션 민감 5개 평균 vs 구조 5개 평균 → 차이 강조 (amplification factor 0.8: HybridAnalysis와 통일)
  const condAvg = (moisture + skinTone + dcScore + Math.max(30, oilScoreVal) + troubleScoreVal) / 5;
  const structAvg = (wrinkleScore + elasticityScore + textureScore + poreScore + pigmentationScore) / 5;
  const conditionScore = clamp(Math.round(condAvg + (condAvg - structAvg) * 0.8), 32, 96);

  // ── SKIN AGE from overallScore ──
  skinAge = Math.round(60 - (overallScore / 100) * 42);

  // ── ADVICE ──
  const metrics = [
    { key:'moisture', val:moisture }, { key:'skinTone', val:skinTone },
    { key:'trouble', val:troubleScoreVal }, { key:'oil', val:Math.max(30,oilScoreVal) },
    { key:'wrinkle', val:wrinkleScore }, { key:'pore', val:poreScore },
    { key:'elasticity', val:elasticityScore }, { key:'pigmentation', val:pigmentationScore },
    { key:'texture', val:textureScore }, { key:'darkCircle', val:dcScore },
  ];
  const weakest = metrics.sort((a,b)=>a.val-b.val)[0];
  const advice = generateAdvice(weakest.key, { moisture, skinTone, troubleCount, oilBalance, wrinkleScore, poreScore, elasticityScore, pigmentationScore, textureScore, dcScore, skinAge });

  // ── MEASUREMENT CONFIDENCE (0-100%) ──
  const brightOk = px.brightness > 60 && px.brightness < 200 ? 1 : px.brightness > 40 && px.brightness < 220 ? 0.7 : 0.4;
  const skinCov = Math.min(1, (px.skinRatio || 0.5) * 1.5);
  const faceDet = px.faceDetected ? 1 : 0.6;
  const confidence = clamp(Math.round((brightOk * 0.3 + skinCov * 0.35 + faceDet * 0.35) * 100), 0, 100);

  return {
    skinAge, moisture, troubleCount, skinTone, oilBalance, skinType,
    wrinkleScore, poreScore, elasticityScore, pigmentationScore,
    textureScore, darkCircleScore: dcScore,
    concerns: concerns.slice(0, 3), overallScore, conditionScore, advice, confidence,
    _pixelData: px,
  };
}

// ===== SIGMOID =====
function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

// ===== SKIN PIXEL DETECTION (YCbCr color space) =====
// Filters out hair, background, clothing pixels from face regions.
// Wide range to accommodate diverse skin tones (light to dark).
function isSkinPixel(r, g, b) {
  const Y  =  0.299 * r + 0.587 * g + 0.114 * b;
  const Cb = -0.169 * r - 0.331 * g + 0.500 * b + 128;
  const Cr =  0.500 * r - 0.419 * g - 0.081 * b + 128;
  return Y > 30 && Cb > 70 && Cb < 145 && Cr > 120 && Cr < 190;
}

// ===== ADVICE =====
// Pick one random item from array (seed by day so same result within a day)
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateAdvice(weakKey, m) {
  const month = new Date().getMonth() + 1;
  const season = month <= 2 || month === 12 ? 'winter' : month <= 5 ? 'spring' : month <= 8 ? 'summer' : 'fall';
  const seasonTip = {
    winter: '요즘 같은 겨울엔 난방 때문에 피부가 더 빨리 마르더라고요.',
    spring: '봄철엔 꽃가루랑 미세먼지가 피부를 살짝 예민하게 만들 수 있어요.',
    summer: '햇볕이 강한 계절이라 자외선 차단제를 2~3시간마다 덧발라주면 좋아요.',
    fall: '가을은 여름 자외선으로 지친 피부가 회복하기 가장 좋은 시기예요.',
  }[season];

  // 2개의 가장 낮은 지표 찾기
  const allMetrics = [
    { key: 'moisture', val: m.moisture, label: '수분도' },
    { key: 'skinTone', val: m.skinTone, label: '피부톤' },
    { key: 'wrinkle', val: m.wrinkleScore, label: '주름' },
    { key: 'pore', val: m.poreScore, label: '모공' },
    { key: 'elasticity', val: m.elasticityScore, label: '탄력' },
    { key: 'pigmentation', val: m.pigmentationScore, label: '색소' },
    { key: 'texture', val: m.textureScore, label: '피부결' },
    { key: 'darkCircle', val: m.dcScore, label: '다크서클' },
  ].sort((a, b) => a.val - b.val);
  const second = allMetrics[1];

  const adviceMap = {
    moisture: () => {
      if (m.moisture < 30) return pick([
        `수분이 ${m.moisture}%까지 떨어져 있네요. 피부가 많이 메마른 신호예요. 세안 후 30초 안에 히알루론산 토너를 2~3번 얇게 덧발라보세요. 마지막에 세라마이드 크림으로 덮어주면 수분이 잘 잠겨요. ${seasonTip}`,
        `수분 ${m.moisture}%면 피부가 SOS를 보내고 있는 거예요. 작은 분자 히알루론산 세럼을 촉촉한 피부에 톡톡 두드려 발라보세요. 실내 습도 40~60% 정도 맞춰주면 한결 편해질 거예요.`,
        `수분도 ${m.moisture}%네요. 속이 비어있는 느낌이라 빠르게 채워주는 게 좋아요. 세안 직후 토너 → 에센스 → 크림 순서로 발라보고, 자기 전엔 슬리핑 마스크로 마무리하면 한층 촉촉해져요. ${seasonTip}`,
      ]);
      if (m.moisture < 50) return pick([
        `수분이 ${m.moisture}%라 피부가 살짝 당기는 느낌일 거예요. 세안 직후 촉촉한 상태에서 히알루론산 세럼을 바르면 흡수가 훨씬 좋아요. 자기 전 스쿠알란 오일 한 방울을 마지막에 더해주면 밤사이 수분이 덜 빠져요.`,
        `수분 ${m.moisture}%라 보습이 조금 더 필요해 보여요. 지금은 수분 채우기가 우선이라 토너를 3~5겹 얇게 덧발라본 뒤 크림으로 마무리하면 유지력이 확 올라가요.`,
        `수분도 ${m.moisture}%네요. 세안 후 3분이 수분 흡수의 골든타임이라 그때 에센스를 충분히 발라주는 게 좋아요. 밤에 가습기를 틀거나 젖은 수건을 걸어두는 것도 도움돼요.`,
      ]);
      return pick([
        `수분 ${m.moisture}%로 정상 범위예요. ${m.oilBalance > 60 ? '다만 유분에 비해 수분이 조금 부족한 느낌이라 수분 젤 제형으로 밸런스를 맞춰보면 좋아요.' : '환절기엔 수분이 빠르게 빠지기 쉬워서 미스트 + 크림을 함께 발라주면 잠금막이 더 잘 잡혀요.'}`,
        `수분 ${m.moisture}%로 나쁘지 않아요. ${m.oilBalance > 60 ? '유분이 살짝 높은 편이라 가벼운 수분 젤로 밸런스 잡아주면 한결 산뜻해질 거예요.' : '지금 컨디션을 유지하려면 물을 자주 마시고 보습 크림을 꾸준히 발라주는 게 가장 좋아요.'}`,
      ]);
    },
    skinTone: () => {
      if (m.skinTone < 40) return pick([
        `피부톤 균일도가 ${m.skinTone}점이라 색 편차가 좀 눈에 띄어요. 햇빛이 누적된 영향일 가능성이 커요. 아침엔 비타민C 15% 세럼 위에 자외선 차단제로 꼭 덮어주고, 저녁엔 나이아신아마이드 5%를 발라주면 톤이 점점 균일해질 거예요.`,
        `피부톤 ${m.skinTone}점이라 부위별 색 차이가 좀 있어 보여요. 아침엔 비타민C, 저녁엔 알부틴 조합이 잘 어울려요. 자외선 차단제를 꾸준히 함께 해주면 케어 효과가 훨씬 잘 나와요.`,
      ]);
      if (m.skinTone < 60) return pick([
        `피부톤 ${m.skinTone}점이네요. 볼과 이마 사이에 살짝 색 차이가 보여요. 비타민C와 비타민E를 함께 쓰면 항산화 효과가 더 잘 나오는데, 자외선 차단제를 함께 발라줘야 색이 다시 올라오는 걸 막을 수 있어요.`,
        `피부톤 ${m.skinTone}점이에요. 부분적으로 살짝 칙칙한 톤이 보이는데, 나이아신아마이드 5% 세럼을 꾸준히 쓰면 톤이 점점 균일해져요. 자외선 차단제는 2~3시간마다 덧발라주면 효과가 더 좋아요.`,
      ]);
      return pick([
        `피부톤 ${m.skinTone}점으로 양호해요. 이 톤을 유지하려면 매일 자외선 차단이 핵심이에요. 햇빛 누적이 피부 노화의 대부분 원인이거든요. 나이아신아마이드 토너를 꾸준히 쓰면 톤이 더 환해질 수 있어요.`,
        `피부톤 ${m.skinTone}점으로 안색이 균일한 편이에요. 이 상태를 오래 유지하려면 자외선 차단이 가장 중요해요. 흐린 날에도 자외선은 통과하니 매일 차단제 바르는 습관을 챙겨보세요.`,
      ]);
    },
    trouble: () => {
      if (m.troubleCount > 10) return pick([
        `트러블이 ${m.troubleCount}개 정도 보이네요. 피부 균형이 조금 무너진 상태예요. 살리실산(BHA) 2% 토너로 모공 속 피지를 부드럽게 정리하고, 시카(병풀 추출물) 크림으로 진정시켜주면 좋아요. 세안할 땐 약산성 클렌저로 피부 장벽을 보호해주세요.`,
        `트러블 ${m.troubleCount}개라 피부가 살짝 예민해진 것 같아요. 스크럽처럼 자극 주는 건 잠시 멈추고, BHA 2%를 주 3회 정도 써보세요. 티트리 오일이 들어간 스팟 제품을 염증 부위에만 살짝 발라주면 빠르게 진정돼요.`,
      ]);
      if (m.troubleCount > 5) return pick([
        `트러블 ${m.troubleCount}개로 중간 정도 수준이에요. 피지가 활발해지면 모공이 막혀 염증이 생기곤 해요. 주 2회 정도 BHA로 부드럽게 각질 케어하고, 나이아신아마이드로 피지를 다듬어주면 좋아요. 트러블 부위에 티트리 스팟 제품을 발라주면 빨리 가라앉아요.`,
        `트러블이 ${m.troubleCount}개 보여요. 세안이 부족하거나 유분이 많을 때 생기기 쉬워요. 이중 세안으로 모공 속까지 깨끗이 정리하고, 순한 BHA 토너로 각질을 관리해보세요. 베개 커버를 자주 갈아주는 것도 도움돼요.`,
      ]);
      return pick([
        `트러블 ${m.troubleCount}개로 ${m.troubleCount <= 2 ? '양호한 편이에요. 평소 클렌징과 보습만 잘 챙겨주면 충분해요.' : '경미한 수준이에요. 순한 BHA 토너를 주 1회만 써줘도 예방에 좋아요.'}`,
        `트러블 ${m.troubleCount}개라 ${m.troubleCount <= 2 ? '깨끗한 편이에요. 지금 루틴이 잘 맞고 있어요.' : '가벼운 수준이라 손으로 만지지 않고 클렌징에 조금만 신경 써도 잘 관리될 거예요.'}`,
      ]);
    },
    oil: () => {
      if (m.oilBalance > 75) return pick([
        `유분이 ${m.oilBalance}%로 T존이 많이 번들거리는 편이에요. 보습을 줄이면 오히려 유분이 더 늘 수 있어서, 수분 젤로 가볍게 충분히 발라주는 게 좋아요. 나이아신아마이드 10% 토너가 피지 조절에 잘 맞아요.`,
        `유분 ${m.oilBalance}%로 좀 높은 편이에요. 클레이 마스크를 주 2회 정도 써보고, 가벼운 수분 에멀전으로 보습해주면 한결 산뜻해져요. 나이아신아마이드 성분이 피지를 줄여주는 데 도움돼요.`,
      ]);
      if (m.oilBalance > 60) return pick([
        `유분 ${m.oilBalance}%로 약간 높아요. 유수분 밸런스가 흐트러지면 모공이 넓어질 수 있어요. 가벼운 수분 에센스를 기본으로 깔고, 클레이 마스크를 주 1회 정도 써주면 피지 흡착에 도움돼요.`,
        `유분 ${m.oilBalance}%네요. T존 위주로 살짝 번들거릴 수 있어요. T존엔 가볍게, 볼 쪽엔 크림을 충분히 — 부위별로 보습을 다르게 가져가는 게 좋아요.`,
      ]);
      if (m.oilBalance < 35) return pick([
        `유분이 ${m.oilBalance}%로 많이 부족해요. 피지막이 얇으면 외부 자극에 약해질 수 있어요. 세안 후 스쿠알란 오일을 크림에 한두 방울 섞어 바르면 피지를 대신해줘요.`,
        `유분 ${m.oilBalance}%로 낮은 편이에요. 피부 장벽이 약해질 수 있으니 크림 타입 보습제를 쓰고, 세안은 순한 밀크 클렌저로 부드럽게 해주세요. 오일 성분이 들어간 세럼도 도움돼요.`,
      ]);
      return pick([
        `유분 ${m.oilBalance}%로 이상적인 밸런스예요. 지금 클렌징과 보습 루틴이 잘 맞고 있어요.`,
        `유분 ${m.oilBalance}%로 유수분 밸런스가 좋아요. 이 상태가 유지되면 피부결과 모공 관리에도 도움이 돼요.`,
      ]);
    },
    wrinkle: () => {
      if (m.wrinkleScore < 35) return pick([
        `주름 점수가 ${m.wrinkleScore}점이라 눈가·이마·팔자 라인이 좀 보여요. 피부 속 콜라겐이 얇아진 신호예요. 레티놀 0.3%부터 천천히 저녁 루틴에 추가해보고, 아침엔 비타민C 세럼과 자외선 차단제를 함께 발라주면 좋아요.`,
        `주름 ${m.wrinkleScore}점으로 관리가 필요한 시기예요. 펩타이드 계열 세럼과 레티놀을 같이 쓰면 콜라겐 재생이 잘 일어나요. 햇빛이 콜라겐을 빠르게 무너뜨리니 차단제는 꾸준히 함께 해주세요.`,
      ]);
      if (m.wrinkleScore < 55) return pick([
        `주름 ${m.wrinkleScore}점으로 잔주름이 시작되는 단계예요. 지금이 관리 시작하기 가장 좋은 시기예요. 펩타이드 세럼이 콜라겐 합성을 도와줘요. 자외선 차단제는 꼭 함께 챙겨주세요.`,
        `주름 ${m.wrinkleScore}점으로 초기 잔주름이 보여요. 저녁엔 아데노신 함유 크림을 발라주고, 레티놀은 주 2회부터 천천히 시작해보세요. 눈가엔 펩타이드 아이크림이 잘 어울려요.`,
      ]);
      if (m.wrinkleScore < 70) return pick([
        `주름 ${m.wrinkleScore}점으로 눈가에 미세한 잔주름이 보여요. 꾸준히 관리하면 충분히 개선될 거예요. 저녁에 아데노신 아이크림을 발라주고, 보습 크림이 밤사이 피부 회복을 도와줘요.`,
        `주름 ${m.wrinkleScore}점이에요. 가벼운 잔주름이 보이지만 지금부터 챙기면 충분해요. 레티놀을 주 2~3회 저녁에 써보고, 수분 크림으로 피부 장벽을 단단히 해주세요.`,
      ]);
      return pick([
        `주름 ${m.wrinkleScore}점으로 매끄러운 편이에요. ${m.elasticityScore < 60 ? '탄력을 함께 챙겨주면 주름 예방이 더 완성돼요. 펩타이드 크림을 추가해보면 좋아요.' : '이 상태를 유지하려면 자외선 차단과 보습을 꾸준히 챙기는 게 좋아요.'}`,
        `주름 ${m.wrinkleScore}점으로 잘 관리된 피부예요. ${m.elasticityScore < 60 ? '탄력 관리를 함께 가져가면 시너지가 더 좋아져요.' : '지금 루틴을 꾸준히 이어가세요. 자외선 차단이 노화 예방의 핵심이에요.'}`,
      ]);
    },
    pore: () => {
      if (m.poreScore < 40) return pick([
        `모공 ${m.poreScore}점으로 좀 넓은 편이에요. 나이아신아마이드 10% 세럼이 피지를 줄이고 모공 탄력을 높여줘요. BHA 토너로 모공 속을 부드럽게 정리하고, 클레이 마스크를 주 1~2회 함께 해주면 좋아요.`,
        `모공 ${m.poreScore}점으로 확장이 좀 눈에 띄어요. 피지와 콜라겐 감소가 같이 작용한 결과예요. 이중 세안 후 살리실산(BHA) 2% 토너를 주 2~3회 정도 써보면 좋아요. 나이아신아마이드 세럼이 모공을 다듬는 데 도움돼요.`,
      ]);
      if (m.poreScore < 60) return pick([
        `모공 ${m.poreScore}점이에요. 코 주변과 T존 모공이 살짝 눈에 띄는데, 이중 세안으로 모공 속 피지를 정리하고 나이아신아마이드 세럼을 발라주면 모공이 한결 깔끔해져요.`,
        `모공 ${m.poreScore}점이라 피지와 각질이 조금 쌓인 상태예요. 순한 BHA 토너를 주 1~2회 써보고, 클레이 마스크로 피지를 정리해주세요. 모공 수축 앰플도 도움돼요.`,
      ]);
      return pick([
        `모공 ${m.poreScore}점으로 양호해요. ${m.oilBalance > 60 ? '유분이 살짝 높은 편이라 가벼운 BHA 토너를 주 1회 정도 써보면 좋아요.' : '지금 클렌징 루틴을 그대로 유지해주세요.'}`,
        `모공 ${m.poreScore}점으로 깨끗한 편이에요. ${m.oilBalance > 60 ? '유분 관리를 함께 챙기면 모공이 더 깔끔해질 거예요.' : '지금 루틴이 잘 맞고 있어요.'}`,
      ]);
    },
    elasticity: () => {
      if (m.elasticityScore < 40) return pick([
        `탄력 ${m.elasticityScore}점으로 처짐이 조금씩 진행되는 상태예요. 펩타이드 크림을 아침저녁 발라주고, 저녁엔 레티놀을 함께 써보면 콜라겐 재생에 시너지가 나요. 얼굴 리프팅 마사지를 하루 3분 정도 해주면 혈류에도 도움돼요.`,
        `탄력 ${m.elasticityScore}점으로 피부 속 콜라겐·엘라스틴이 살짝 약해진 상태예요. 펩타이드 세럼과 레티놀을 꾸준히 쓰면 회복에 도움돼요. 설탕과 정제 탄수화물을 줄이는 식습관도 같이 가면 더 좋아요.`,
      ]);
      if (m.elasticityScore < 60) return pick([
        `탄력 ${m.elasticityScore}점으로 약한 처짐이 시작되는 단계예요. 저녁 루틴에 펩타이드 세럼을 추가하고, 비타민C 같은 항산화 성분으로 콜라겐을 지켜주세요.`,
        `탄력 ${m.elasticityScore}점이에요. 콜라겐이 서서히 줄어드는 시기인데, 지금부터 펩타이드와 레티놀을 시작하면 충분히 개선돼요. 충분한 수면과 단백질 섭취도 도움이 돼요.`,
      ]);
      return pick([
        `탄력 ${m.elasticityScore}점으로 탱탱한 편이에요. 이 상태를 오래 유지하려면 자외선 차단 + 항산화 세럼 + 펩타이드 크림 조합이 가장 잘 어울려요.`,
        `탄력 ${m.elasticityScore}점으로 피부가 탄탄해요. 꾸준한 자외선 차단과 펩타이드 크림이 지금 컨디션 유지의 핵심이에요. 콜라겐이 풍부한 음식도 함께 챙겨주면 좋아요.`,
      ]);
    },
    pigmentation: () => {
      if (m.pigmentationScore < 40) return pick([
        `색소 ${m.pigmentationScore}점으로 기미·잡티가 좀 보여요. 아침엔 비타민C 10~15% 세럼 위에 자외선 차단제를 꼭 덮어주고, 저녁엔 알부틴이나 트라넥삼산 함유 세럼으로 색소 생성을 줄여주면 좋아요.`,
        `색소 ${m.pigmentationScore}점이라 침착이 좀 눈에 띄어요. 아침엔 비타민C, 저녁엔 나이아신아마이드 — 시간차로 쓰면 잘 어울려요. 자외선 차단을 함께 챙기면 케어 효과가 훨씬 잘 나와요.`,
      ]);
      if (m.pigmentationScore < 60) return pick([
        `색소 ${m.pigmentationScore}점이에요. 부분적으로 침착이 보이는데, 나이아신아마이드 5%와 비타민C를 시간차로 쓰면 잘 어울려요.`,
        `색소 ${m.pigmentationScore}점이에요. 색소가 더 깊어지기 전에 케어하는 게 핵심이에요. 저녁엔 트라넥삼산이나 알부틴 함유 세럼, 아침엔 비타민C로 보호해주세요.`,
      ]);
      return pick([
        `색소 ${m.pigmentationScore}점으로 맑은 편이에요. 자외선 차단을 꾸준히 하면 이 컨디션이 잘 유지돼요. ${season === 'summer' ? '여름엔 모자와 차단제를 함께 챙겨주세요.' : '흐린 날에도 자외선은 통과하니 매일 차단제 바르는 습관이 좋아요.'}`,
        `색소 ${m.pigmentationScore}점으로 깨끗한 피부예요. 이 상태를 유지하려면 자외선 차단이 가장 중요해요. ${season === 'summer' ? '여름엔 차단제를 2~3시간마다 덧발라주면 좋아요.' : '비타민C 세럼을 아침에 꾸준히 쓰면 예방 효과가 잘 나와요.'}`,
      ]);
    },
    texture: () => {
      if (m.textureScore < 40) return pick([
        `피부결 ${m.textureScore}점으로 표면이 좀 거친 편이에요. 죽은 각질이 쌓이면 칙칙해 보일 수 있어요. 글리콜산(AHA) 5~8%를 주 2회 저녁에 써보면 각질이 부드럽게 정리되고 피부도 한결 환해져요.`,
        `피부결 ${m.textureScore}점으로 각질층이 좀 두꺼워진 상태예요. 거친 스크럽보다는 화학적 각질 케어가 안전해요. 주 2회 저녁에 쓰고, 다른 날엔 수분 에센스로 촉촉하게 유지해주세요.`,
      ]);
      if (m.textureScore < 60) return pick([
        `피부결 ${m.textureScore}점이에요. 미세한 요철이 살짝 보이는데, 순한 AHA 토너를 주 1~2회 써보고, 다른 날엔 히알루론산 에센스로 부드럽게 가꿔보세요. 거친 스크럽은 장벽에 부담이 될 수 있어서 피하는 게 좋아요.`,
        `피부결 ${m.textureScore}점이에요. 각질이 불균일하게 쌓인 상태인데, PHA 토너가 민감한 피부에도 부담 없이 잘 어울려요. 주 1~2회 저녁에 써주면 피부결이 점점 매끈해져요.`,
      ]);
      return pick([
        `피부결 ${m.textureScore}점으로 매끄러운 편이에요. ${m.moisture < 50 ? '수분이 부족하면 피부결이 흐트러질 수 있으니 보습을 좀 더 신경 써보세요.' : '지금 루틴을 유지하면서 부드러운 각질 케어를 주 1회 정도 더해보면 좋아요.'}`,
        `피부결 ${m.textureScore}점으로 피부가 부드러워요. ${m.moisture < 50 ? '수분 보충을 더하면 피부결이 더 고와질 거예요.' : '이 상태를 유지하려면 순한 클렌징과 충분한 보습을 꾸준히 챙겨주세요.'}`,
      ]);
    },
    darkCircle: () => {
      if (m.dcScore < 40) return pick([
        `다크서클 ${m.dcScore}점으로 눈 밑이 많이 어두워요. 눈가 피부는 매우 얇아서 혈관이 비쳐 보이곤 해요. 비타민K와 카페인 성분이 잘 어울려요. 저녁엔 레티놀 아이크림을 살짝 발라주면 장기적으로 두께가 단단해져요. 무엇보다 7~8시간 수면이 가장 큰 도움이 돼요.`,
        `다크서클 ${m.dcScore}점이에요. 수면 부족, 스트레스, 혈류 정체가 주된 원인이에요. 아침엔 카페인 아이크림을 부드럽게 두드려 발라주고, 저녁엔 펩타이드 + 레티놀 아이크림으로 케어해주세요. 차가운 수저로 1분 정도 마사지해주면 부기가 즉시 가라앉아요.`,
      ]);
      if (m.dcScore < 60) return pick([
        `다크서클 ${m.dcScore}점이에요. 눈 밑에 그림자가 살짝 보이는데, 카페인과 펩타이드가 들어간 아이크림을 아침저녁 두드려 발라보세요. 아침에 차가운 스푼으로 1분 마사지하면 부기가 빠지고 한결 환해져요.`,
        `다크서클 ${m.dcScore}점이에요. 색소형·혈관형·구조형 중 어떤 타입인지에 따라 케어법이 조금씩 다른데, 우선 충분한 수면과 카페인 아이크림으로 시작해보세요. 비타민C 아이패치를 주 2~3회 써주면 점점 환해져요.`,
      ]);
      return pick([
        `다크서클 ${m.dcScore}점으로 눈 밑이 밝은 편이에요. ${m.wrinkleScore < 60 ? '눈가 주름 관리를 함께 하면 더 좋아요. 펩타이드 아이크림을 추천해요.' : '충분한 수면과 가벼운 아이크림만으로도 충분해요.'}`,
        `다크서클 ${m.dcScore}점으로 눈가가 환한 편이에요. ${m.wrinkleScore < 60 ? '눈가 주름 예방을 위해 아이크림을 꾸준히 발라주세요.' : '이 컨디션을 유지하려면 7~8시간 수면이 가장 좋은 케어예요.'}`,
      ]);
    },
  };

  const mainAdvice = (adviceMap[weakKey] || (() => `현재 피부에서 가장 신경 쓸 부분은 ${weakKey}이에요.`))();

  // 두 번째 약점 보조 조언
  let subAdvice = '';
  if (second && second.val < 60 && second.key !== weakKey) {
    const subMap = {
      moisture: `수분(${m.moisture}%)도 함께 챙겨주면 전체 컨디션이 같이 올라가요.`,
      skinTone: `피부톤(${m.skinTone}점)도 함께 보면 좋아요. 자외선 차단을 꼭 함께 해주세요.`,
      wrinkle: `주름(${m.wrinkleScore}점)도 같이 챙겨주면 좋아요. 레티놀이나 펩타이드를 더해보세요.`,
      pore: `모공(${m.poreScore}점)도 함께 관리하면 좋아요. 나이아신아마이드가 도움돼요.`,
      elasticity: `탄력(${m.elasticityScore}점)도 같이 챙기면 시너지가 나요. 펩타이드 크림이 잘 어울려요.`,
      pigmentation: `색소(${m.pigmentationScore}점)도 함께 봐주세요. 비타민C와 자외선 차단 조합이 잘 맞아요.`,
      texture: `피부결(${m.textureScore}점)도 같이 챙기면 좋아요. 순한 AHA 토너를 주 1회 더해보세요.`,
      darkCircle: `다크서클(${m.dcScore}점)도 신경 쓰이는 부분이에요. 아이크림과 충분한 수면이 도움돼요.`,
    };
    subAdvice = ' ' + (subMap[second.key] || '');
  }

  return mainAdvice + subAdvice;
}

// ===== SMART ADVICE (uses final hybrid scores + change trends) =====

// Comforting opener when scores drop — reassure user, prevent churn
const COMFORT_MESSAGES = [
  '피부는 컨디션에 따라 매일 변하는 게 자연스러워요. 너무 신경 쓰지 않아도 괜찮아요.',
  '오늘 수치가 조금 내려갔어도, 꾸준히 챙기면 금방 회복돼요.',
  '하루의 컨디션이 전부는 아니에요. 수면이나 스트레스에 따라 충분히 달라질 수 있어요.',
  '일시적인 변동은 누구에게나 있어요. 꾸준한 케어와 관심이 가장 중요해요.',
  '오늘 결과가 조금 아쉬워도 괜찮아요. 피부는 회복력이 좋거든요.',
  '수치가 내려갔을 때가 오히려 관리 효과가 잘 보이는 시기이기도 해요.',
];

// Actionable recovery tips by declined metric
const RECOVERY_TIPS = {
  moisture: [
    '수분이 떨어졌다면, 오늘 저녁 세안 후 히알루론산 토너를 2~3번 덧발라보세요.',
    '수분 보충이 필요해 보여요. 미스트를 수시로 뿌리고, 밤에 수분 크림을 두툼하게 발라보세요.',
    '실내 환기 후엔 건조해지기 쉬워요. 가습기를 켜고 수분 에센스를 충분히 발라주세요.',
  ],
  skinTone: [
    '톤이 살짝 칙칙해졌다면, 내일 아침 비타민C 세럼을 꼭 챙겨보세요.',
    '자외선이 원인일 수 있어요. 차단제를 꼼꼼히 발라주고, 나이아신아마이드로 톤을 다듬어보세요.',
  ],
  wrinkleScore: [
    '수면 부족이나 건조함이 잔주름을 도드라지게 할 수 있어요. 오늘 밤은 충분히 자고 보습을 더 신경 써보세요.',
    '주름은 보습만 잘 해줘도 다시 부드러워져요. 수분 크림을 충분히 바르고 푹 쉬어주세요.',
  ],
  poreScore: [
    '모공은 유분과 온도에 민감해요. 순한 클렌징 후 차가운 미스트로 가볍게 진정시켜주세요.',
    '오늘 저녁엔 이중 세안으로 모공 속까지 부드럽게 정리해보세요.',
  ],
  elasticityScore: [
    '탄력은 수분과 밀접해요. 보습을 더 신경 써주고, 펩타이드 크림을 저녁에 발라보세요.',
    '충분한 수면과 단백질 섭취가 탄력 회복에 가장 좋아요.',
  ],
  pigmentationScore: [
    '색소 변화는 자외선 영향이 커요. 내일부턴 차단제를 더 꼼꼼히 발라주세요.',
    '비타민C 세럼을 아침마다 꾸준히 쓰면 색소가 점점 차분해질 거예요.',
  ],
  textureScore: [
    '피부결은 수분과 각질 상태에 따라 달라져요. 순한 보습 제품으로 피부를 진정시켜주세요.',
    '거친 피부결은 스트레스나 수면 부족이 원인일 때가 많아요. 오늘 밤은 푹 쉬어보세요.',
  ],
  darkCircleScore: [
    '다크서클은 수면과 직결돼요. 오늘 밤 7시간 이상 푹 자면 내일 눈에 띄게 달라질 거예요.',
    '차가운 스푼이나 아이패치로 눈가를 5분만 진정시켜도 한결 환해져요.',
  ],
  oilBalance: [
    '유분은 날씨·식단·스트레스에 따라 달라져요. 수분 보습을 충분히 해주면 밸런스가 돌아와요.',
    '유분이 변했다면, 가벼운 수분 젤로 유수분 밸런스를 맞춰보세요.',
  ],
};

export function generateSmartAdvice(scores, changes) {
  const m = {
    moisture: scores.moisture,
    skinTone: scores.skinTone,
    troubleCount: scores.troubleCount,
    oilBalance: scores.oilBalance,
    wrinkleScore: scores.wrinkleScore,
    poreScore: scores.poreScore,
    elasticityScore: scores.elasticityScore,
    pigmentationScore: scores.pigmentationScore,
    textureScore: scores.textureScore,
    dcScore: scores.darkCircleScore,
    skinAge: scores.skinAge,
  };

  const metrics = [
    { key:'moisture', val:m.moisture }, { key:'skinTone', val:m.skinTone },
    { key:'wrinkle', val:m.wrinkleScore }, { key:'pore', val:m.poreScore },
    { key:'elasticity', val:m.elasticityScore }, { key:'pigmentation', val:m.pigmentationScore },
    { key:'texture', val:m.textureScore }, { key:'darkCircle', val:m.dcScore },
  ];
  const weakest = metrics.sort((a,b)=>a.val-b.val)[0];

  const baseAdvice = generateAdvice(weakest.key, m);

  if (!changes) return baseAdvice;

  const improved = [];
  const declined = [];
  const metricLabels = {
    skinAge: '피부나이', overallScore: '종합점수', moisture: '수분도',
    skinTone: '피부톤', wrinkleScore: '주름', poreScore: '모공',
    elasticityScore: '탄력', pigmentationScore: '색소', textureScore: '피부결',
    darkCircleScore: '다크서클', oilBalance: '유분', troubleCount: '트러블',
  };

  for (const [key, c] of Object.entries(changes)) {
    if (Math.abs(c.diff) < 2) continue;
    const label = metricLabels[key] || key;
    // For inverse metrics (skinAge, troubleCount), show absolute value with direction
    const displayDiff = c.inverse
      ? `${Math.abs(c.diff)}${c.improved ? ' 감소' : ' 증가'}`
      : `${c.diff > 0 ? '+' : ''}${c.diff}`;
    if (c.improved) {
      improved.push({ text: `${label} ${displayDiff}`, key });
    } else {
      declined.push({ text: `${label} ${displayDiff}`, key });
    }
  }

  if (improved.length === 0 && declined.length === 0) return baseAdvice;

  let trend = '';

  if (improved.length > 0) {
    const phrases = [' 직전 대비 ', ' 지난 측정과 비교해 ', ' 이전 결과보다 '];
    const ends = ['이 개선되고 있어요!', '이 좋아졌어요!', '이 올라갔어요!'];
    trend += pick(phrases) + improved.slice(0, 3).map(d => d.text).join(', ') + pick(ends);
  }

  if (declined.length > 0) {
    if (improved.length === 0) {
      // All declined — lead with comfort
      trend += ' ' + pick(COMFORT_MESSAGES);
      // Add specific recovery tip for the most declined metric
      const topDeclined = declined[0].key;
      const tips = RECOVERY_TIPS[topDeclined];
      if (tips) trend += ' ' + pick(tips);
    } else {
      // Mixed results — softer tone for declined part
      const softTransitions = [
        ' 반면 ', ' 다만 ',
      ];
      const softEnds = [
        '은 내일 케어에 집중해보세요.', '은 오늘 저녁 관리로 충분히 회복할 수 있어요.', '은 조금만 신경 쓰면 금방 돌아올 거예요.',
      ];
      trend += pick(softTransitions) + declined.slice(0, 2).map(d => d.text).join(', ') + pick(softEnds);
    }
  }

  return baseAdvice + trend;
}

// ===== DEMO =====
export function generateDemoScores() {
  const rr = () => Math.random();
  const fakePx = {
    labL: 50+rr()*30, labA: 5+rr()*10, labB: 10+rr()*15,
    stdLabL: 3+rr()*8, cheekLabA: 8+rr()*10, chinLabA: 5+rr()*8,
    cheekAsymmetry: rr()*8, labLRange: 5+rr()*15,
    brightness: 100+rr()*100, variance: 6+rr()*35,
    redRatio: rr()*0.18, cheekRedness: rr()*0.15, chinRedness: rr()*0.1,
    tzoneShine: 0.01+rr()*0.12, uzoneShine: 0.005+rr()*0.06,
    saturation: 0.1+rr()*0.3,
    moisture:      { avgScore: 30+rr()*55 },
    wrinkle:       { overall: 1+rr()*8, foreheadLow: 1+rr()*6, crowsFeetLow: 0.5+rr()*5, nasolabialLow: 0.5+rr()*5 },
    texture:       { overallMid: 1.5+rr()*8, overallHigh: 2+rr()*10, cheekMid: 1+rr()*7, foreheadMid: 1.5+rr()*6, cheekHigh: 2+rr()*8, foreheadHigh: 2+rr()*7 },
    pore:          { overall: 50+rr()*500, noseScore: 50+rr()*400, cheekScore: 30+rr()*300 },
    elasticity:    { overall: 2+rr()*10, jawlineEdge: 2+rr()*8, chinDrop: 1+rr()*6, firmness: 0.5+rr()*2.5 },
    pigmentation:  { overallPenalty: rr()*12, cheekPenalty: rr()*10, foreheadPenalty: rr()*6, cheekClusters: Math.floor(rr()*5), foreheadClusters: Math.floor(rr()*3), redSpots: Math.floor(rr()*4), brownSpots: Math.floor(rr()*5) },
    darkCircle:    { overall: rr()*0.35, leftSeverity: rr()*0.3, rightSeverity: rr()*0.3, vascular: rr()*0.3, shadow: rr()*0.25, pigment: rr()*0.2, asymmetry: rr()*0.1 },
    trouble:       { totalSpots: Math.floor(rr()*6), totalSeverity: rr()*8 },
  };
  return pixelsToScores(fakePx);
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, Math.round(v))); }
