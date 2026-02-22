/**
 * CIE LAB Color Space Utilities v3.1
 *
 * Pure JS — no external dependencies.
 * All conversions use D65 standard illuminant (sRGB reference).
 * v3.1: 256-entry LUT for sRGB→linear (eliminates per-pixel pow calls)
 */

// D65 reference white point (2° observer)
const Xn = 0.95047;
const Yn = 1.00000;
const Zn = 1.08883;

// Precomputed LUT: sRGB [0-255] → linear RGB
const SRGB_LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_LUT[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

// CIE LAB f(t) helper
function labF(t) {
  return t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116;
}

/**
 * Convert sRGB (0-255) to CIE LAB.
 * Uses precomputed LUT for sRGB→linear (no per-pixel pow).
 * @returns {{ L: number, a: number, b: number }}
 */
export function rgbToLab(r, g, b) {
  const lr = SRGB_LUT[r];
  const lg = SRGB_LUT[g];
  const lb = SRGB_LUT[b];

  // linear RGB → XYZ (sRGB D65 matrix)
  const X = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb;
  const Y = 0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb;
  const Z = 0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb;

  // XYZ → LAB
  const fx = labF(X / Xn);
  const fy = labF(Y / Yn);
  const fz = labF(Z / Zn);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * Compute LAB statistics for an ImageData region.
 * @param {ImageData} imageData
 * @returns {{ avgL: number, avgA: number, avgB: number, stdL: number, stdA: number, stdB: number, chroma: number }}
 */
export function labStats(imageData) {
  if (!imageData) {
    return { avgL: 50, avgA: 0, avgB: 0, stdL: 0, stdA: 0, stdB: 0, chroma: 0 };
  }

  const d = imageData.data;
  const n = d.length / 4;

  let sumL = 0, sumA = 0, sumB = 0;
  const Ls = new Float32Array(n);
  const As = new Float32Array(n);
  const Bs = new Float32Array(n);

  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const lab = rgbToLab(d[i], d[i + 1], d[i + 2]);
    Ls[j] = lab.L; As[j] = lab.a; Bs[j] = lab.b;
    sumL += lab.L; sumA += lab.a; sumB += lab.b;
  }

  const avgL = sumL / n;
  const avgA = sumA / n;
  const avgB = sumB / n;

  let varL = 0, varA = 0, varB = 0;
  for (let j = 0; j < n; j++) {
    varL += (Ls[j] - avgL) ** 2;
    varA += (As[j] - avgA) ** 2;
    varB += (Bs[j] - avgB) ** 2;
  }

  return {
    avgL,
    avgA,
    avgB,
    stdL: Math.sqrt(varL / n),
    stdA: Math.sqrt(varA / n),
    stdB: Math.sqrt(varB / n),
    chroma: Math.sqrt(avgA * avgA + avgB * avgB),
  };
}
