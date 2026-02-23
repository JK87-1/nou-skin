/**
 * NOU Pixel Analysis Engine v3.1
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

// ===== IMAGE COMPRESSION =====
export function compressImage(dataUrl, maxSize = 512, quality = 0.4) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > h && w > maxSize) { h = (maxSize / w) * h; w = maxSize; }
      else if (h > maxSize) { w = (maxSize / h) * w; h = maxSize; }
      canvas.width = Math.round(w);
      canvas.height = Math.round(h);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ===== PHOTO QUALITY GATE =====
// Checks brightness and sharpness before analysis to warn users about poor photos.
export function checkPhotoQuality(dataUrl) {
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

      const issues = [];
      if (brightness < 50) issues.push('too_dark');
      if (brightness > 220) issues.push('too_bright');
      if (sharpness < 3) issues.push('blurry');

      resolve({ passed: issues.length === 0, brightness, sharpness, issues });
    };
    img.onerror = () => resolve({ passed: true, brightness: 128, sharpness: 10, issues: [] });
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

  // ── SKIN AGE (hybrid: ML age estimation + pixel penalty fine-tuning) ──
  const baseSkinAge = 20;
  const agePenalty = (score, weight) => {
    const deficit = Math.max(0, (100 - score) / 100);
    const intensity = score < 55 ? 1 : score < 75 ? 0.5 : 0.15;
    return deficit * weight * intensity;
  };
  const penalties = {
    wrinkle:       agePenalty(wrinkleScore, 8),
    elasticity:    agePenalty(elasticityScore, 6),
    texture:       agePenalty(textureScore, 3.5),
    pore:          agePenalty(poreScore, 3),
    pigmentation:  agePenalty(pigmentationScore, 3),
    darkCircle:    agePenalty(dcScore, 2.5),
    moisture:      agePenalty(moisture, 2.5),
    skinTone:      agePenalty(skinTone, 2),
    oil:           Math.abs(55 - oilBalance) / 55 * 1.5,
    trouble:       agePenalty(Math.max(0, 100-troubleCount*8.5), 2),
  };
  const totalPenalty = Object.values(penalties).reduce((s,v) => s + Math.max(0,v), 0);

  const allScores = [moisture, skinTone, Math.max(0,100-troubleCount*8.5), Math.max(30,100-Math.abs(55-oilBalance)*1.4), wrinkleScore, poreScore, elasticityScore, pigmentationScore, textureScore, dcScore];
  const minScore = Math.min(...allScores);
  const excellenceBonus = minScore > 75 ? -3 - (minScore-75)*0.08 : minScore > 60 ? -1 : 0;

  let skinAge;
  if (mlAge !== null) {
    // ML age as anchor, pixel analysis for ±5 fine-tuning
    // Average penalty ~5; deviation from average adjusts ML age
    const pixelAdj = (totalPenalty - 5) * 0.3;
    skinAge = clamp(mlAge + pixelAdj, 16, 58);
  } else {
    // Fallback: pixel-only calculation
    skinAge = clamp(baseSkinAge + totalPenalty + excellenceBonus, 16, 58);
  }

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

  // ── OVERALL SCORE (10-metric weighted) ──
  const overallScore = clamp(
    wrinkleScore      * 0.16 +
    elasticityScore   * 0.13 +
    moisture          * 0.12 +
    textureScore      * 0.11 +
    troubleScoreVal   * 0.10 +
    poreScore         * 0.10 +
    pigmentationScore * 0.07 +
    skinTone          * 0.07 +
    dcScore           * 0.07 +
    Math.max(30, oilScoreVal) * 0.07
  , 32, 96);

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
    concerns: concerns.slice(0, 3), overallScore, advice, confidence,
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
function generateAdvice(weakKey, m) {
  const map = {
    moisture: m.moisture < 40
      ? `수분도가 ${m.moisture}%로 많이 부족해요. 세라마이드·히알루론산 보습제를 아침저녁 꼼꼼히 바르고, 하루 2L 이상 수분을 섭취하세요. 장 건강이 피부 장벽을 강화해 수분 손실을 막아줍니다.`
      : `수분도가 ${m.moisture}%로 약간 부족해요. 수분 에센스를 추가하고 미스트로 수시 보충하세요. 프로바이오틱스가 세라마이드 합성을 촉진합니다.`,
    skinTone: m.skinTone < 50
      ? `피부톤 균일도가 ${m.skinTone}점. 비타민C(15%) 세럼 + 나이아신아마이드(5%) 병행, SPF50+ 자외선 차단을 철저히 하세요.`
      : `피부톤 ${m.skinTone}점. SPF50+ 자외선 차단제를 매일 사용하면 톤이 더 밝아질 거예요.`,
    trouble: m.troubleCount > 7
      ? `트러블 ${m.troubleCount}개로 피부과 상담을 권합니다. 시카·티트리 진정 케어를 병행하세요. 장내 유해균 감소가 여드름 47% 감소에 기여합니다.`
      : `트러블 ${m.troubleCount}개. ${m.troubleCount>3?'BHA 각질 케어를 주 2회 해보세요.':'가벼운 수준이에요. 기본 루틴만 유지하세요.'}`,
    oil: m.oilBalance > 70
      ? `유분 ${m.oilBalance}%로 T존 기름기가 많아요. 수분 젤 보습제 + 나이아신아마이드 토너를 추천합니다.`
      : `유분 ${m.oilBalance}%. ${m.oilBalance<35?'건조해요. 스쿠알란 오일을 추가하세요.':'양호해요. 현재 루틴을 유지하세요.'}`,
    wrinkle: m.wrinkleScore < 50
      ? `주름 점수 ${m.wrinkleScore}점. 레티놀(0.3~0.5%)을 저녁에 사용하고, SPF50+ 자외선 차단을 꼭 하세요. 비타민C가 콜라겐 생성을 촉진합니다. 장 건강이 좋으면 MMP가 억제됩니다.`
      : `주름 점수 ${m.wrinkleScore}점. ${m.wrinkleScore<70?'레티놀을 주 2~3회 사용하고 보습에 신경 쓰세요.':'현재 관리를 유지하면서 자외선 차단을 지속하세요.'}`,
    pore: m.poreScore < 50
      ? `모공 점수 ${m.poreScore}점. 나이아신아마이드(10%) 세럼 + BHA 토너로 모공 속 피지를 관리하세요. 클레이 마스크도 주 1~2회 추천.`
      : `모공 점수 ${m.poreScore}점. ${m.poreScore<70?'나이아신아마이드 세럼을 추가하면 모공이 조여질 거예요.':'양호해요. 기본 클렌징만 잘 하세요.'}`,
    elasticity: m.elasticityScore < 50
      ? `탄력 점수 ${m.elasticityScore}점. 펩타이드 크림이 콜라겐·엘라스틴 생성을 돕습니다. 얼굴 마사지도 효과적이에요. 장내 유익균이 항산화 효소를 활성화하여 탄력을 보호합니다.`
      : `탄력 점수 ${m.elasticityScore}점. ${m.elasticityScore<70?'펩타이드 세럼을 저녁 루틴에 추가하세요.':'좋은 상태예요. 꾸준한 보습이 핵심이에요.'}`,
    pigmentation: m.pigmentationScore < 50
      ? `색소 점수 ${m.pigmentationScore}점. 알부틴·트라넥삼산 미백 세럼 + SPF50+ 차단제를 반드시 바르세요. 자외선이 가장 큰 원인이에요.`
      : `색소 점수 ${m.pigmentationScore}점. ${m.pigmentationScore<70?'비타민C 세럼으로 예방하세요.':'맑은 피부예요. 자외선 차단만 꾸준히.'}`,
    texture: m.textureScore < 50
      ? `피부결 점수가 ${m.textureScore}점으로 표면이 거칠어요. AHA(글리콜산 5~8%) 각질 케어를 주 2회 하면 피부결이 매끄러워집니다. 저녁에 레티놀을 병행하면 세포 턴오버가 촉진돼요. 장 건강이 좋으면 각질 턴오버가 정상화됩니다.`
      : `피부결 점수 ${m.textureScore}점. ${m.textureScore<70?'순한 AHA 토너를 주 1~2회 사용하면 더 매끄러워져요.':'피부결이 좋아요. 보습과 자외선 차단을 유지하세요.'}`,
    darkCircle: m.dcScore < 50
      ? `다크서클 점수가 ${m.dcScore}점으로 눈 밑이 어두워요. 비타민K + 카페인 함유 아이크림이 혈류 개선에 효과적이에요. 충분한 수면(7~8시간)이 가장 중요합니다. 장 건강이 세로토닌 생산을 돕고, 이는 멜라토닌 전환으로 수면 질을 높여줍니다.`
      : `다크서클 점수 ${m.dcScore}점. ${m.dcScore<70?'아이크림을 꾸준히 사용하고 수면 시간을 확보하세요.':'눈 밑이 밝아요. 현재 컨디션을 유지하세요.'}`,
  };
  return map[weakKey] || '수분 공급과 자외선 차단이 건강한 피부의 기본이에요.';
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
