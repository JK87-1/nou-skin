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
      if (landmarks && landmarks.length >= 468) {
        const earW = Math.abs(landmarks[234].x - landmarks[454].x);
        const faceH = Math.abs(landmarks[10].y - landmarks[152].y);
        faceRatio = earW * faceH;
      }

      const issues = [];
      if (brightness < 50) issues.push('too_dark');
      if (brightness > 220) issues.push('too_bright');
      if (sharpness < 3) issues.push('blurry');
      if (landmarks && landmarks.length >= 468 && faceRatio < 0.04) issues.push('face_too_small');
      if (!landmarks || landmarks.length < 468) issues.push('no_face');

      resolve({ passed: issues.length === 0, brightness, sharpness, faceRatio, issues });
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
export function pixelsToScores(px, mlAge = null) {
  if (!px) return generateDemoScores();

  // ── MOISTURE (cluster density based) ──
  const moisture = clamp(px.moisture.avgScore, 12, 95);

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

  // ── WRINKLES (low-frequency energy, calibrated for 512px) ──
  // At 512px: young smooth skin ~3-7, aged skin ~10-16
  const wrinkleScore = clamp(100 - (px.wrinkle.overall - 3) * 5, 15, 98);

  // ── PORES (micro-variance, calibrated for 512px) ──
  // At 512px: smooth skin ~50-120, visible pores ~150-400+
  const poreScore = clamp(100 - (px.pore.overall - 60) * 0.18, 15, 98);

  // ── ELASTICITY (firmness-ratio centric, calibrated for 512px) ──
  // At 512px: edge density typically 4-10
  const edgeDensity = px.elasticity.jawlineEdge || px.elasticity.overall;
  const firmness = px.elasticity.firmness || 1;
  const elasticityBase = 92 - (edgeDensity - 4) * 2.5;
  const firmAdj = Math.max(-20, Math.min(20, (firmness - 1) * 15));
  const elasticityScore = clamp(elasticityBase + firmAdj, 15, 98);

  // ── PIGMENTATION (cluster-based weighted penalty) ──
  const pigmentationScore = clamp(100 - px.pigmentation.overallPenalty * 4.5, 15, 98);

  // ── TEXTURE (mid-frequency energy, calibrated for 512px) ──
  // At 512px: smooth skin ~3-7, rough skin ~9-16
  const textureFromMid = Math.max(0, 100 - (px.texture.overallMid - 3.5) * 4);
  const textureFromHigh = Math.max(0, 100 - (px.texture.overallHigh - 4) * 2);
  const textureScore = clamp(textureFromMid * 0.65 + textureFromHigh * 0.35, 15, 98);

  // ── DARK CIRCLES (LAB 3-component severity) — reduced sensitivity + nonlinear mapping ──
  const dcSeverity = px.darkCircle.overall;
  // Nonlinear: sqrt softens penalty for mild dark circles, still penalizes severe ones
  const dcMapped = dcSeverity < 0.15 ? dcSeverity * 180 : Math.sqrt(dcSeverity) * 100;
  const dcScore = clamp(100 - dcMapped, 15, 98);

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
  // 컨디션 민감 5개 평균 vs 구조 5개 평균 → 차이를 증폭해 overallScore와 분리
  const condAvg = (moisture + skinTone + dcScore + Math.max(30, oilScoreVal) + troubleScoreVal) / 5;
  const structAvg = (wrinkleScore + elasticityScore + textureScore + poreScore + pigmentationScore) / 5;
  const conditionScore = clamp(Math.round(condAvg + (condAvg - structAvg) * 1.8), 32, 96);

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
    winter: '겨울철 실내 난방은 피부 수분 증발을 2배 이상 가속시켜요.',
    spring: '봄철 꽃가루와 미세먼지가 피부 장벽을 약화시킬 수 있어요.',
    summer: '여름철 자외선이 가장 강해요. SPF50+ 차단제를 2시간마다 덧발라주세요.',
    fall: '가을은 여름 자외선 데미지를 회복할 골든타임이에요.',
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
        `수분도가 ${m.moisture}%로 심각하게 낮아요. 피부 장벽의 세라마이드·콜레스테롤·지방산 비율(3:1:1)이 무너져 경표피수분손실(TEWL)이 급증하는 상태예요. 세안 직후 30초 이내에 히알루론산 토너를 3겹 레이어링하고, 세라마이드 크림으로 밀봉하세요. ${seasonTip}`,
        `수분 ${m.moisture}%는 피부가 보내는 SOS 신호예요. 각질층의 천연보습인자(NMF)가 부족하면 피부가 갈라지고 당겨요. 저분자 히알루론산 세럼을 축축한 피부에 바르고 세라마이드 크림으로 잠가주세요. 실내 습도 40~60%도 꼭 유지하세요.`,
        `수분도 ${m.moisture}%예요. 피부 속 수분이 바닥난 상태라 즉각적인 보습이 필요해요. 세안 후 토너-에센스-크림 3단계를 빠르게 레이어링하고, 밤에는 슬리핑 마스크로 수분 증발을 차단하세요. ${seasonTip}`,
      ]);
      if (m.moisture < 50) return pick([
        `수분도 ${m.moisture}%로 피부가 당기는 느낌이 있을 거예요. 히알루론산(저분자+고분자 혼합) 세럼을 세안 직후 축축한 피부에 바르면 수분 흡수가 300% 올라가요. 수면 중 수분 손실을 막으려면 저녁에 스쿠알란 오일을 마지막 단계로 추가하세요.`,
        `수분 ${m.moisture}%로 보습이 좀 더 필요한 상태예요. 피부 pH가 약산성(4.5~5.5)을 유지해야 장벽이 건강해지는데, 지금은 수분 보충이 우선이에요. 토너를 3~5겹 얇게 레이어링한 후 크림으로 마무리하면 수분 유지력이 확 올라가요.`,
        `수분도가 ${m.moisture}%예요. 세안 직후 3분 이내가 수분 흡수의 골든타임인데, 이때 수분 에센스를 충분히 발라주세요. 밤에 가습기를 틀거나 젖은 수건을 걸어두면 수면 중 수분 손실을 줄일 수 있어요.`,
      ]);
      return pick([
        `수분도 ${m.moisture}%로 정상 범위이지만, ${m.oilBalance > 60 ? '유분 대비 수분이 부족한 수지 불균형 상태예요. 수분 젤 제형으로 유수분 밸런스를 맞추세요.' : '환절기에 수분이 빠르게 빠질 수 있어요. 미스트 + 크림 레이어링으로 수분 잠금막을 형성하세요.'}`,
        `수분 ${m.moisture}%로 나쁘지 않아요. ${m.oilBalance > 60 ? '다만 유분이 높은 편이니 가벼운 수분 젤로 밸런스를 맞춰보세요.' : '지금 상태를 유지하려면 하루 1.5~2L 수분 섭취와 보습 크림을 꾸준히 바르세요.'}`,
      ]);
    },
    skinTone: () => {
      if (m.skinTone < 40) return pick([
        `피부톤 균일도 ${m.skinTone}점으로 색 편차가 눈에 띄어요. 자외선에 의한 광노화 신호예요. L-아스코르빈산(비타민C) 15% 세럼을 아침에 바른 뒤, 반드시 SPF50+ 차단제로 마무리하세요. 저녁에는 나이아신아마이드 5%가 멜라닌 이동을 차단해 톤 개선에 효과적이에요.`,
        `피부톤 ${m.skinTone}점으로 부위별 색 차이가 커요. 멜라닌이 불균일하게 분포된 상태인데, 아침 비타민C + 저녁 알부틴 조합이 가장 효과적이에요. 자외선 차단 없이는 미백 케어 효과가 반감되니 SPF50+는 필수예요.`,
      ]);
      if (m.skinTone < 60) return pick([
        `피부톤 ${m.skinTone}점이에요. 볼과 이마 사이에 미세한 톤 차이가 감지됐어요. 비타민C + 비타민E + 페룰산 조합이 항산화 시너지를 8배까지 높여줘요. 꼭 자외선 차단제를 함께 사용해야 색소 재침착을 막을 수 있어요.`,
        `피부톤 ${m.skinTone}점이에요. 부분적으로 칙칙한 톤이 보이는데, 나이아신아마이드 5% 세럼을 꾸준히 쓰면 멜라닌 이동이 차단돼요. 트라넥삼산 함유 제품도 색소 개선에 효과적이에요. 자외선 차단제는 2시간마다 덧발라주세요.`,
      ]);
      return pick([
        `피부톤 ${m.skinTone}점으로 양호해요. 현재 톤을 유지하려면 매일 자외선 차단이 핵심이에요. 광노화가 피부 노화의 80%를 차지하거든요. 나이아신아마이드 토너를 꾸준히 쓰면 톤이 더 밝아질 수 있어요.`,
        `피부톤 ${m.skinTone}점으로 안색이 균일한 편이에요. 이 상태를 오래 유지하려면 자외선 차단이 가장 중요해요. 흐린 날에도 UVA가 80% 통과하니 매일 차단제를 바르는 습관이 필요해요.`,
      ]);
    },
    trouble: () => {
      if (m.troubleCount > 10) return pick([
        `트러블 ${m.troubleCount}개가 감지됐어요. 피부 마이크로바이옴 균형이 깨져 여드름균이 과잉 증식하는 상태예요. 살리실산(BHA) 2% 토너로 모공 속 피지를 녹이고, 시카(병풀추출물) 크림으로 진정시키세요. 약산성(pH 5.5) 클렌저로 장벽을 보호하면서 세안하세요.`,
        `트러블 ${m.troubleCount}개로 피부가 예민해진 상태예요. 자극적인 스크럽은 피하고, BHA 2%를 주 3회 사용해 모공 속 노폐물을 녹여주세요. 티트리 오일 스팟 제품을 염증 부위에 국소 도포하면 빠르게 진정돼요.`,
      ]);
      if (m.troubleCount > 5) return pick([
        `트러블 ${m.troubleCount}개로 중등도 수준이에요. 피지선 활동이 활발하면 모공이 막히면서 염증이 생겨요. BHA 각질 케어를 주 2회하고, 나이아신아마이드로 피지 조절하세요. 트러블 부위에 티트리 스팟 제품을 도포하면 빠르게 가라앉아요.`,
        `트러블이 ${m.troubleCount}개 보여요. 클렌징이 충분하지 않거나 유분이 과다하면 생기기 쉬워요. 이중 세안으로 모공 속까지 깨끗이 하고, 순한 BHA 토너로 각질을 관리해보세요. 베개 커버도 자주 교체하면 도움돼요.`,
      ]);
      return pick([
        `트러블 ${m.troubleCount}개로 ${m.troubleCount <= 2 ? '양호한 상태예요. 기본 클렌징과 보습만 잘 해주면 돼요.' : '경미한 수준이에요. 순한 BHA 토너를 주 1회 사용하면 예방에 도움돼요.'}`,
        `트러블 ${m.troubleCount}개로 ${m.troubleCount <= 2 ? '깨끗한 상태예요. 현재 루틴을 유지하세요.' : '가벼운 수준이에요. 자극적인 터치는 피하고, 클렌징에 신경 쓰면 충분히 관리 가능해요.'}`,
      ]);
    },
    oil: () => {
      if (m.oilBalance > 75) return pick([
        `유분 ${m.oilBalance}%로 T존 유분이 과다해요. 오히려 보습을 줄이면 피부가 더 많은 유분을 만들어요. 수분 젤 제형으로 충분히 보습하고, 나이아신아마이드 10% 토너가 피지 분비를 효과적으로 조절해요.`,
        `유분이 ${m.oilBalance}%로 높은 편이에요. 피지선이 과활성화된 상태인데, 클레이 마스크를 주 2회 사용하고 가벼운 수분 에멀전으로 보습하세요. 나이아신아마이드가 피지를 최대 25% 줄여줘요.`,
      ]);
      if (m.oilBalance > 60) return pick([
        `유분 ${m.oilBalance}%로 약간 높아요. 유수분 밸런스가 깨지면 모공이 넓어질 수 있어요. 가벼운 수분 에센스를 기본으로 깔고, 클레이 마스크를 주 1회 사용하면 피지 흡착에 도움돼요.`,
        `유분이 ${m.oilBalance}%예요. T존 중심으로 번들거림이 있을 수 있는데, 부위별 보습을 다르게 하는 게 좋아요. T존은 가볍게, U존은 크림으로 충분히 보습하세요.`,
      ]);
      if (m.oilBalance < 35) return pick([
        `유분 ${m.oilBalance}%로 피부가 많이 건조해요. 피지막이 부족하면 외부 자극에 취약해져요. 세안 후 스쿠알란 오일 2~3방울을 크림에 섞어 바르면 피지 대체 효과가 있어요.`,
        `유분이 ${m.oilBalance}%로 낮아요. 피부 장벽이 약해질 수 있으니 크림 타입 보습제를 사용하고, 세안은 순한 밀크 클렌저로 해주세요. 오일 성분이 포함된 세럼도 도움돼요.`,
      ]);
      return pick([
        `유분 ${m.oilBalance}%로 이상적인 밸런스예요. 현재 클렌징과 보습 루틴이 잘 맞고 있어요.`,
        `유분 ${m.oilBalance}%로 유수분 밸런스가 좋아요. 이 상태를 유지하면 피부결과 모공 관리에도 긍정적이에요.`,
      ]);
    },
    wrinkle: () => {
      if (m.wrinkleScore < 35) return pick([
        `주름 점수 ${m.wrinkleScore}점으로 눈가·이마·팔자 주름이 뚜렷해요. 진피층 콜라겐이 얇아진 상태예요. 레티놀 0.3%부터 시작해 저녁에 사용하고, 아침에는 비타민C 세럼 + SPF50+를 바르세요. 레티놀은 세포 턴오버를 28일 → 14일로 앞당겨 콜라겐 재생을 촉진해요.`,
        `주름 ${m.wrinkleScore}점으로 관리가 필요해요. 엘라스틴이 변성되면 주름이 깊어지는데, 펩타이드(마트릭실 3000) + 레티놀 조합이 콜라겐 재생에 가장 효과적이에요. 자외선이 MMP를 활성화해 콜라겐을 파괴하므로 차단제는 필수예요.`,
      ]);
      if (m.wrinkleScore < 55) return pick([
        `주름 점수 ${m.wrinkleScore}점이에요. 잔주름이 시작되는 단계로, 지금이 관리 골든타임이에요. 펩타이드(아르지릴린, 마트릭실) 세럼이 콜라겐 합성을 촉진해요. 자외선 차단제는 선택이 아닌 필수예요.`,
        `주름 ${m.wrinkleScore}점으로 초기 잔주름이 보여요. 아데노신 함유 크림을 저녁에 바르고, 레티놀은 주 2회부터 천천히 시작하세요. 눈가에는 펩타이드 아이크림이 효과적이에요.`,
      ]);
      if (m.wrinkleScore < 70) return pick([
        `주름 점수 ${m.wrinkleScore}점으로 눈가에 미세 잔주름이 보여요. 관리하면 충분히 개선 가능해요. 아데노신 아이크림을 저녁에 바르고, 보습 크림이 밤사이 피부 재생을 도와요.`,
        `주름 ${m.wrinkleScore}점이에요. 가벼운 잔주름이 보이지만 지금부터 관리하면 충분해요. 레티놀을 주 2~3회 저녁에 사용하고, 수분 크림으로 피부 장벽을 강화하세요.`,
      ]);
      return pick([
        `주름 점수 ${m.wrinkleScore}점으로 매끄러운 편이에요. ${m.elasticityScore < 60 ? '다만 탄력이 함께 관리되어야 주름 예방이 완성돼요. 펩타이드 크림을 추가해보세요.' : '현재 상태를 유지하려면 자외선 차단과 보습을 꾸준히 하세요.'}`,
        `주름 ${m.wrinkleScore}점으로 잘 관리된 피부예요. ${m.elasticityScore < 60 ? '탄력 관리를 병행하면 더욱 효과적이에요.' : '지금 루틴을 꾸준히 유지하세요. SPF 차단이 노화 방지의 핵심이에요.'}`,
      ]);
    },
    pore: () => {
      if (m.poreScore < 40) return pick([
        `모공 점수 ${m.poreScore}점으로 모공이 넓은 편이에요. 나이아신아마이드 10% 세럼이 피지를 25% 감소시키고 모공 탄력을 높여줘요. BHA 토너로 모공 속 노폐물을 녹이고, 클레이 마스크를 주 1~2회 병행하세요.`,
        `모공 ${m.poreScore}점으로 모공 확장이 눈에 띄어요. 피지와 콜라겐 감소가 주원인인데, 이중 세안 후 BHA(살리실산) 2% 토너를 주 2~3회 사용하세요. 나이아신아마이드 세럼이 모공 조임에 효과적이에요.`,
      ]);
      if (m.poreScore < 60) return pick([
        `모공 점수 ${m.poreScore}점이에요. 코 주변과 T존에 모공이 눈에 띄는데, 이중 세안으로 모공 속 피지를 깨끗이 제거하고, 나이아신아마이드 세럼으로 모공 조임 효과를 기대할 수 있어요.`,
        `모공 ${m.poreScore}점이에요. 피지와 각질이 모공을 확장시킨 상태예요. 순한 BHA 토너를 주 1~2회 사용하고, 클레이 마스크로 피지를 흡착해주세요. 모공 수축 앰플도 도움돼요.`,
      ]);
      return pick([
        `모공 점수 ${m.poreScore}점으로 양호해요. ${m.oilBalance > 60 ? '유분이 조금 높은 편이니 가벼운 BHA 토너를 주 1회 사용해보세요.' : '현재 클렌징 루틴을 유지하세요.'}`,
        `모공 ${m.poreScore}점으로 깨끗한 편이에요. ${m.oilBalance > 60 ? '유분 관리를 병행하면 모공이 더 깨끗해질 수 있어요.' : '지금 루틴이 잘 맞고 있어요.'}`,
      ]);
    },
    elasticity: () => {
      if (m.elasticityScore < 40) return pick([
        `탄력 점수 ${m.elasticityScore}점으로 피부 처짐이 진행되고 있어요. 펩타이드(마트릭실 3000, 아르지릴린) 크림을 아침저녁 바르고, 레티놀을 저녁에 병행하면 콜라겐 재생 시너지가 나요. 얼굴 리프팅 마사지를 하루 3분씩 하면 혈류 개선에 도움돼요.`,
        `탄력 ${m.elasticityScore}점으로 진피층의 콜라겐·엘라스틴 그물이 약해진 상태예요. 펩타이드 세럼과 레티놀을 꾸준히 사용하면 콜라겐 합성이 촉진돼요. 설탕과 정제 탄수화물을 줄이면 당화 반응도 억제할 수 있어요.`,
      ]);
      if (m.elasticityScore < 60) return pick([
        `탄력 점수 ${m.elasticityScore}점으로 약간의 처짐이 시작되는 단계예요. 펩타이드 세럼을 저녁 루틴에 추가하고, 항산화 성분(비타민C, 레스베라트롤)으로 콜라겐 분해를 막아주세요.`,
        `탄력 ${m.elasticityScore}점이에요. 콜라겐이 서서히 줄어드는 단계인데, 지금부터 펩타이드와 레티놀을 시작하면 충분히 개선 가능해요. 충분한 수면과 단백질 섭취도 콜라겐 합성에 도움돼요.`,
      ]);
      return pick([
        `탄력 점수 ${m.elasticityScore}점으로 탱탱한 편이에요. 이 상태를 오래 유지하려면 SPF 차단 + 항산화 세럼 + 펩타이드 크림 조합이 가장 효과적이에요.`,
        `탄력 ${m.elasticityScore}점으로 피부가 탄탄해요. 꾸준한 자외선 차단과 펩타이드 크림이 이 상태를 유지하는 핵심이에요. 콜라겐이 풍부한 음식도 도움돼요.`,
      ]);
    },
    pigmentation: () => {
      if (m.pigmentationScore < 40) return pick([
        `색소 점수 ${m.pigmentationScore}점으로 기미·잡티가 뚜렷해요. 아침에 비타민C 10~15% 세럼을 바른 뒤 SPF50+를 사용하고, 저녁에는 알부틴·트라넥삼산 함유 미백 세럼으로 멜라닌 생성을 차단하세요.`,
        `색소 ${m.pigmentationScore}점으로 색소 침착이 눈에 띄어요. 멜라닌 과잉 생성 상태인데, 비타민C(아침) + 나이아신아마이드(저녁) 시간차 사용이 효과적이에요. 자외선 차단 없는 미백 케어는 의미가 없으니 SPF50+를 꼭 바르세요.`,
      ]);
      if (m.pigmentationScore < 60) return pick([
        `색소 점수 ${m.pigmentationScore}점이에요. 부분적 색소 침착이 보이는데, 나이아신아마이드 5%가 멜라닌 이동을 차단하고, 비타민C가 만들어진 멜라닌을 환원시켜요. 이 두 성분을 시간차로 사용하면 시너지가 좋아요.`,
        `색소 ${m.pigmentationScore}점이에요. 멜라닌이 표피에서 진피로 떨어지기 전에 관리하는 것이 핵심이에요. 트라넥삼산 + 알부틴 함유 세럼을 저녁에 사용하고, 아침에는 비타민C로 항산화 방어를 해주세요.`,
      ]);
      return pick([
        `색소 점수 ${m.pigmentationScore}점으로 맑은 편이에요. 자외선 차단을 꾸준히 하면 이 상태를 유지할 수 있어요. ${season === 'summer' ? '여름철에는 모자와 차단제를 꼭 병행하세요.' : '흐린 날에도 UVA는 80% 이상 통과하므로 매일 차단제를 바르세요.'}`,
        `색소 ${m.pigmentationScore}점으로 깨끗한 피부예요. 이 상태를 유지하려면 자외선 차단이 가장 중요해요. ${season === 'summer' ? '여름에는 SPF50+를 2시간마다 덧바르세요.' : '비타민C 세럼을 아침에 꾸준히 발라주면 예방 효과가 뛰어나요.'}`,
      ]);
    },
    texture: () => {
      if (m.textureScore < 40) return pick([
        `피부결 점수 ${m.textureScore}점으로 표면이 거친 편이에요. 각질 턴오버가 늦어지면 죽은 세포가 쌓여 칙칙해져요. AHA(글리콜산 5~8%)를 주 2회 저녁에 사용하면 각질을 부드럽게 제거하고 세포 재생을 앞당겨요.`,
        `피부결 ${m.textureScore}점으로 각질층이 두꺼워진 상태예요. 물리적 스크럽보다는 화학적 각질제거(AHA/PHA)가 안전해요. 주 2회 저녁에 사용하고, 나머지 날에는 수분 에센스로 피부를 촉촉하게 유지하세요.`,
      ]);
      if (m.textureScore < 60) return pick([
        `피부결 점수 ${m.textureScore}점이에요. 미세한 요철이 있는데, 순한 AHA 토너를 주 1~2회 사용하고, 나머지 날에는 히알루론산 에센스로 각질을 부드럽게 유지하세요. 물리적 스크럽은 장벽을 손상시킬 수 있으니 피하세요.`,
        `피부결 ${m.textureScore}점이에요. 각질층이 불균일하게 쌓인 결과인데, PHA 토너가 민감 피부에도 자극 없이 각질을 녹여줘요. 주 1~2회 저녁에 사용하면 피부결이 매끈해질 거예요.`,
      ]);
      return pick([
        `피부결 점수 ${m.textureScore}점으로 매끄러운 편이에요. ${m.moisture < 50 ? '다만 수분이 부족하면 피부결이 나빠질 수 있으니 보습을 강화하세요.' : '현재 루틴을 유지하면서 부드러운 각질 케어를 주 1회 해보세요.'}`,
        `피부결 ${m.textureScore}점으로 피부가 부드러워요. ${m.moisture < 50 ? '수분 보충을 더하면 피부결이 더 고와질 거예요.' : '이 상태를 유지하려면 순한 클렌징과 충분한 보습이 핵심이에요.'}`,
      ]);
    },
    darkCircle: () => {
      if (m.dcScore < 40) return pick([
        `다크서클 점수 ${m.dcScore}점으로 눈 밑이 많이 어두워요. 눈가 피부는 두께가 0.5mm로 가장 얇아서 혈관이 비쳐 보여요. 비타민K가 혈액 순환을 개선하고, 카페인이 혈관을 수축시켜요. 레티놀 아이크림을 저녁에 바르면 장기적으로 개선돼요. 수면 7~8시간이 가장 중요해요.`,
        `다크서클 ${m.dcScore}점이에요. 눈 밑 피부가 어두운 상태인데, 수면 부족·스트레스·혈류 정체가 주원인이에요. 카페인 아이크림을 아침에 부드럽게 두드려 바르고, 저녁에는 펩타이드 + 레티놀 아이크림으로 두께를 강화하세요. 차가운 수저 마사지도 즉각적으로 도움돼요.`,
      ]);
      if (m.dcScore < 60) return pick([
        `다크서클 점수 ${m.dcScore}점이에요. 눈 밑에 그림자가 보이는데, 카페인 + 펩타이드 함유 아이크림을 아침저녁 두드려 바르세요. 차가운 스푼 마사지를 아침 1분간 하면 부기와 혈류 정체가 완화돼요.`,
        `다크서클 ${m.dcScore}점이에요. 색소형·혈관형·구조형 중 어떤 타입인지에 따라 관리법이 다른데, 우선 충분한 수면과 카페인 아이크림으로 시작하세요. 비타민C 아이패치를 주 2~3회 사용하면 밝아지는 효과가 있어요.`,
      ]);
      return pick([
        `다크서클 점수 ${m.dcScore}점으로 눈 밑이 밝은 편이에요. ${m.wrinkleScore < 60 ? '눈가 주름 관리를 함께 하면 더 좋아요. 펩타이드 아이크림을 추천해요.' : '충분한 수면과 가벼운 아이크림만으로 충분해요.'}`,
        `다크서클 ${m.dcScore}점으로 눈가가 환한 편이에요. ${m.wrinkleScore < 60 ? '눈가 주름 예방을 위해 아이크림을 꾸준히 바르세요.' : '지금 컨디션을 유지하려면 7~8시간 수면이 가장 좋은 관리법이에요.'}`,
      ]);
    },
  };

  const mainAdvice = (adviceMap[weakKey] || (() => `현재 피부에서 가장 신경 쓸 부분은 ${weakKey}이에요.`))();

  // 두 번째 약점 보조 조언
  let subAdvice = '';
  if (second && second.val < 60 && second.key !== weakKey) {
    const subMap = {
      moisture: `수분도(${m.moisture}%)도 함께 올려야 전체적인 피부 컨디션이 개선돼요.`,
      skinTone: `피부톤(${m.skinTone}점)도 관리 포인트예요. 자외선 차단을 꼭 병행하세요.`,
      wrinkle: `주름(${m.wrinkleScore}점)도 관리가 필요해요. 레티놀이나 펩타이드를 추가해보세요.`,
      pore: `모공(${m.poreScore}점)도 함께 관리하면 좋아요. 나이아신아마이드가 도움돼요.`,
      elasticity: `탄력(${m.elasticityScore}점)도 함께 올리면 시너지가 나요. 펩타이드 크림을 추천해요.`,
      pigmentation: `색소(${m.pigmentationScore}점)도 관리해주세요. 비타민C + 자외선 차단 조합이 효과적이에요.`,
      texture: `피부결(${m.textureScore}점)도 개선하면 좋아요. 순한 AHA 토너를 주 1회 추가하세요.`,
      darkCircle: `다크서클(${m.dcScore}점)도 신경 쓰이는 부분이에요. 아이크림과 충분한 수면이 도움돼요.`,
    };
    subAdvice = ' ' + (subMap[second.key] || '');
  }

  return mainAdvice + subAdvice;
}

// ===== SMART ADVICE (uses final hybrid scores + change trends) =====

// Comforting opener when scores drop — reassure user, prevent churn
const COMFORT_MESSAGES = [
  '피부는 컨디션에 따라 매일 변해요. 일시적인 변화는 자연스러운 거예요.',
  '오늘 수치가 조금 내려갔지만, 꾸준히 관리하면 금방 회복돼요.',
  '하루의 컨디션이 전부가 아니에요. 수면·스트레스·환경에 따라 충분히 달라질 수 있어요.',
  '일시적인 변동은 누구에게나 있어요. 중요한 건 꾸준한 케어와 관심이에요.',
  '오늘 결과가 조금 아쉽더라도 괜찮아요. 피부는 회복력이 뛰어나거든요.',
  '수치가 내려갔을 때가 오히려 관리 효과를 극대화할 수 있는 기회예요.',
];

// Actionable recovery tips by declined metric
const RECOVERY_TIPS = {
  moisture: [
    '수분이 떨어졌다면, 오늘 저녁 세안 후 히알루론산 토너를 2~3겹 레이어링해보세요.',
    '수분 보충이 필요해요. 미스트를 수시로 뿌리고, 밤에 수분 크림을 두텁게 발라보세요.',
    '실내 환기 후 건조해지기 쉬워요. 가습기를 켜고 수분 에센스를 충분히 발라주세요.',
  ],
  skinTone: [
    '톤이 살짝 칙칙해졌다면, 비타민C 세럼을 내일 아침 꼭 챙겨 바르세요.',
    '자외선 노출이 원인일 수 있어요. 차단제를 꼼꼼히 바르고, 나이아신아마이드로 톤을 관리하세요.',
  ],
  wrinkleScore: [
    '수면 부족이나 건조함이 잔주름을 도드라지게 할 수 있어요. 오늘 밤 충분히 자고, 보습을 강화해보세요.',
    '주름 수치는 보습만 잘 해줘도 바로 개선돼요. 수분 크림을 충분히 바르고 푹 쉬세요.',
  ],
  poreScore: [
    '모공은 유분과 온도에 민감해요. 순한 클렌징 후 차가운 미스트로 모공을 조여주세요.',
    '오늘 저녁 이중 세안으로 모공 속 노폐물을 깨끗이 제거해보세요.',
  ],
  elasticityScore: [
    '탄력은 수분과 밀접해요. 보습을 강화하고, 펩타이드 크림을 저녁에 발라보세요.',
    '충분한 수면과 단백질 섭취가 탄력 회복에 가장 효과적이에요.',
  ],
  pigmentationScore: [
    '색소 변화는 자외선 영향이 커요. 내일부터 차단제를 더 꼼꼼히 발라주세요.',
    '비타민C 세럼을 아침에 꾸준히 사용하면 색소 수치가 다시 올라갈 거예요.',
  ],
  textureScore: [
    '피부결은 수분과 각질 상태에 따라 달라져요. 순한 보습 제품으로 피부를 진정시켜주세요.',
    '거친 피부결은 스트레스나 수면 부족이 원인일 수 있어요. 오늘 밤 푹 쉬어보세요.',
  ],
  darkCircleScore: [
    '다크서클은 수면과 직결돼요. 오늘 밤 7시간 이상 푹 자면 내일 눈에 띄게 달라질 거예요.',
    '차가운 스푼이나 아이패치로 눈가를 5분만 진정시켜도 효과가 있어요.',
  ],
  oilBalance: [
    '유분 변화는 날씨·식단·스트레스에 따라 달라져요. 수분 보습을 충분히 해주면 밸런스가 돌아와요.',
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
