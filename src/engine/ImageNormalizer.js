/**
 * ImageNormalizer — 측정 이미지를 디바이스 무관 표준 형태로 정규화.
 *
 * 문제: 폰마다 화이트밸런스·노출·센서 다름 → 같은 얼굴도 다른 픽셀 → GPT 점수 변동.
 * 해결: 측정 이미지를 표준 색온도·밝기로 정규화한 후 GPT에 전달.
 *
 * 알고리즘:
 *   1. Gray-world white balance — 평균 RGB가 회색(128)이 되도록 색온도 보정
 *   2. Auto-exposure — 평균 밝기를 표준값(135)로 부드럽게 보정 (sqrt 강도)
 *   3. 중앙 60% 영역만 sample (얼굴 위주, 배경·옷 영향 줄임)
 *   4. 강도 70% 부드러운 적용 — 과보정으로 부자연스러움 방지
 *
 * 한계:
 *  - 센서 노이즈·렌즈 곡률·해상도 차이는 흡수 못 함
 *  - 극단적 조명(역광·암실)은 보정해도 한계
 *  - "표준 사진" 같진 않음. 단지 디바이스 간 차이 줄임.
 */

const SOFTNESS = 0.95; // 보정 강도 (1.0=full) — 디바이스 차이 흡수 위해 거의 full
const TARGET_BRIGHTNESS = 135; // 표준 평균 밝기 (0~255)
const EXPOSURE_MIN = 0.5;
const EXPOSURE_MAX = 2.0;

function clip(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

/**
 * 정규화 통계 — debug용 (보정 전후 RGB·brightness).
 */
function computeStats(data, w, h) {
  // 중앙 45% 영역 (얼굴 중심 — 머리카락·옷·배경 영향 거의 제거)
  const x0 = Math.floor(w * 0.275), x1 = Math.floor(w * 0.725);
  const y0 = Math.floor(h * 0.275), y1 = Math.floor(h * 0.725);
  let sumR = 0, sumG = 0, sumB = 0, n = 0;
  for (let y = y0; y < y1; y += 4) {
    for (let x = x0; x < x1; x += 4) {
      const i = (y * w + x) * 4;
      sumR += data[i];
      sumG += data[i + 1];
      sumB += data[i + 2];
      n++;
    }
  }
  const avgR = sumR / n, avgG = sumG / n, avgB = sumB / n;
  const brightness = (avgR + avgG + avgB) / 3;
  return { avgR, avgG, avgB, brightness, samples: n };
}

/**
 * Base64 JPEG → 정규화된 base64 JPEG.
 * @param {string} base64 — data: prefix 없는 순수 base64
 * @returns {Promise<{ normalizedBase64: string, stats: { before, after, factors } }>}
 */
export async function normalizeImageBase64(base64) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const w = canvas.width, h = canvas.height;

        const before = computeStats(data, w, h);

        // === 1. Gray-world white balance ===
        // 평균 RGB가 회색이 되도록 보정. SOFTNESS로 강도 조절.
        const gray = (before.avgR + before.avgG + before.avgB) / 3;
        const rawSR = gray / Math.max(before.avgR, 1);
        const rawSG = gray / Math.max(before.avgG, 1);
        const rawSB = gray / Math.max(before.avgB, 1);
        const sR = 1 + (rawSR - 1) * SOFTNESS;
        const sG = 1 + (rawSG - 1) * SOFTNESS;
        const sB = 1 + (rawSB - 1) * SOFTNESS;

        // === 2. Auto-exposure ===
        // 평균 밝기를 TARGET_BRIGHTNESS로 부드럽게(sqrt) 보정.
        // 보정 폭 0.5~2.0 (강한 카메라 차이 흡수).
        const rawExpFactor = TARGET_BRIGHTNESS / Math.max(gray, 1);
        const expFactor = Math.max(EXPOSURE_MIN, Math.min(EXPOSURE_MAX, Math.pow(rawExpFactor, SOFTNESS)));

        const fR = sR * expFactor;
        const fG = sG * expFactor;
        const fB = sB * expFactor;

        // 적용
        for (let i = 0; i < data.length; i += 4) {
          data[i]     = clip(data[i] * fR);
          data[i + 1] = clip(data[i + 1] * fG);
          data[i + 2] = clip(data[i + 2] * fB);
        }

        ctx.putImageData(imgData, 0, 0);

        const after = computeStats(data, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const normalizedBase64 = dataUrl.split(',')[1];

        resolve({
          normalizedBase64,
          stats: {
            before: {
              R: Math.round(before.avgR),
              G: Math.round(before.avgG),
              B: Math.round(before.avgB),
              brightness: Math.round(before.brightness),
            },
            after: {
              R: Math.round(after.avgR),
              G: Math.round(after.avgG),
              B: Math.round(after.avgB),
              brightness: Math.round(after.brightness),
            },
            factors: { fR: +fR.toFixed(3), fG: +fG.toFixed(3), fB: +fB.toFixed(3), exposure: +expFactor.toFixed(3) },
          },
        });
      } catch (e) {
        console.warn('[ImageNormalizer] error:', e);
        resolve({ normalizedBase64: base64, stats: null });
      }
    };
    img.onerror = () => resolve({ normalizedBase64: base64, stats: null });
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}
