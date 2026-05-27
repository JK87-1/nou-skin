/**
 * SkinPercentile.js — 또래(연령대) 대비 백분위 추정 엔진
 *
 * ───────────────────────────────────────────────────────────────────────
 * Phase 1 (현재): 연령 보정 "참조 분포"(seed) 기반 추정.
 *   각 메트릭을 연령버킷별 정규분포 N(μ, σ)로 가정하고, 사용자 점수의
 *   z-score → 표준정규 CDF로 백분위를 환산한다.
 *
 *   ⚠ 아래 MEAN/SD 값은 피부과학 일반 경향에 근거한 "합리적 추정값"이며
 *     정밀 통계가 아니다. 사용자에겐 "또래 분포 추정"으로 표기하고,
 *     절대 표현("N명 중 상위 X%")은 쓰지 않는다.
 *
 * Phase 2 (출시 후): /api/analyze에서 익명 점수를 집계해 연령버킷별 표본이
 *   임계치(N)를 넘으면 해당 버킷을 seed → 실측 분포로 교체한다.
 *   교체 시 이 파일의 REFERENCE 테이블을 원격/집계 값으로 대체하면 되도록
 *   계산부(getPercentile)와 데이터부(REFERENCE)를 분리해 둔다.
 * ───────────────────────────────────────────────────────────────────────
 */

// 연령버킷: '10s'(16-19) | '20s' | '30s' | '40s' | '50s'(50+)
export function ageToBucket(age) {
  if (!Number.isFinite(age) || age <= 0) return null;
  if (age < 20) return '10s';
  if (age < 30) return '20s';
  if (age < 40) return '30s';
  if (age < 50) return '40s';
  return '50s';
}

// 메트릭 방향: 'high'(높을수록 좋음) | 'low'(낮을수록 좋음) | 'band'(최적값 근접)
const DIRECTION = {
  moisture: 'high',
  oilBalance: 'band',          // 유분 최적 55 근처
  oilMoistureBalance: 'high',
  skinTone: 'high',
  redness: 'high',             // 붉은기 "점수"는 높을수록 좋음(붉은기 적음)
  pigmentation: 'high',
  texture: 'high',
  elasticity: 'high',
  wrinkles: 'high',
  pores: 'high',
  trouble: 'low',              // 트러블 "개수"는 낮을수록 좋음
  darkCircles: 'high',
  overall: 'high',             // 종합 점수
};

const OIL_OPTIMAL = 55; // 유분 최적값 (45~65 밴드의 중앙)

/**
 * 연령버킷별 참조 분포 (μ, σ).
 * 노화에 민감한 항목(주름·탄력·색소)은 연령대별 평균 하락폭을 크게,
 * 둔감한 항목(붉은기·모공)은 완만하게 잡았다.
 * 'band'/'low' 메트릭은 값의 의미에 맞게 별도 단위.
 */
const REFERENCE = {
  //                10s        20s        30s        40s        50s
  moisture:          { '10s': [70, 13], '20s': [66, 13], '30s': [61, 13], '40s': [56, 13], '50s': [51, 13] },
  oilMoistureBalance:{ '10s': [66, 13], '20s': [64, 13], '30s': [61, 13], '40s': [57, 13], '50s': [53, 13] },
  skinTone:          { '10s': [70, 12], '20s': [68, 12], '30s': [64, 12], '40s': [59, 12], '50s': [54, 12] },
  redness:           { '10s': [66, 14], '20s': [70, 14], '30s': [70, 14], '40s': [69, 14], '50s': [68, 14] },
  pigmentation:      { '10s': [75, 14], '20s': [70, 14], '30s': [63, 14], '40s': [55, 14], '50s': [47, 15] }, // 노화 민감
  texture:           { '10s': [68, 12], '20s': [65, 12], '30s': [61, 12], '40s': [56, 12], '50s': [51, 13] },
  elasticity:        { '10s': [78, 13], '20s': [72, 13], '30s': [64, 13], '40s': [54, 14], '50s': [44, 14] }, // 노화 가파름
  wrinkles:          { '10s': [80, 12], '20s': [74, 13], '30s': [65, 13], '40s': [54, 14], '50s': [43, 14] }, // 노화 가파름
  pores:             { '10s': [62, 13], '20s': [64, 13], '30s': [62, 13], '40s': [59, 13], '50s': [56, 13] },
  darkCircles:       { '10s': [70, 14], '20s': [66, 14], '30s': [61, 14], '40s': [56, 14], '50s': [51, 14] },
  overall:           { '10s': [69, 12], '20s': [66, 12], '30s': [61, 12], '40s': [55, 13], '50s': [49, 13] },
  // 트러블: 평균 "개수" (낮을수록 좋음) — 10·20대 많고 이후 감소
  trouble:           { '10s': [6.0, 3.5], '20s': [4.0, 3.2], '30s': [2.5, 2.6], '40s': [1.8, 2.2], '50s': [1.5, 2.0] },
  // 유분: 최적(55)으로부터의 "거리" 분포 (거리 작을수록 좋음)
  oilBalance:        { '10s': [11, 8], '20s': [10, 8], '30s': [10, 8], '40s': [11, 8], '50s': [12, 9] },
};

/** 표준정규 누적분포 Φ(z) — Abramowitz & Stegun 7.1.26 근사 */
function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

const clampPct = (p) => Math.min(99, Math.max(1, Math.round(p)));

/**
 * 메트릭 백분위 추정.
 * @param {string} metric  DIRECTION 키 (예: 'moisture', 'wrinkles', 'overall')
 * @param {number} value   측정값
 * @param {number} age     실제 나이 (없으면 null 반환)
 * @returns {{ top:number, dir:string, bucket:string } | null}
 *   top = "또래 중 상위 몇 %" (작을수록 우수, 1~99로 clamp)
 */
export function getPercentile(metric, value, age) {
  const dir = DIRECTION[metric];
  const table = REFERENCE[metric];
  if (!dir || !table || typeof value !== 'number' || !Number.isFinite(value)) return null;
  const bucket = ageToBucket(age);
  if (!bucket) return null;
  const [mean, sd] = table[bucket];
  if (!Number.isFinite(mean) || !sd) return null;

  let top;
  if (dir === 'band') {
    // 최적값에서의 거리로 변환 → 거리 작을수록 상위 (low 처리와 동일)
    const dist = Math.abs(value - OIL_OPTIMAL);
    const z = (dist - mean) / sd;
    top = normalCdf(z) * 100;
  } else if (dir === 'low') {
    // 값이 작을수록 우수 → 나보다 작은 사람 비율이 곧 "상위 %"
    const z = (value - mean) / sd;
    top = normalCdf(z) * 100;
  } else {
    // 'high' — 값이 클수록 우수 → 나보다 큰 사람 비율
    const z = (value - mean) / sd;
    top = (1 - normalCdf(z)) * 100;
  }
  return { top: clampPct(top), dir, bucket };
}

/**
 * 피부나이 백분위 — 실제 나이 또래 분포에서 내 피부나이의 위치.
 * 또래 평균 피부나이 ≈ 실제 나이로 가정, σ≈4.5. 피부나이가 낮을수록 상위.
 */
export function getSkinAgePercentile(skinAge, actualAge) {
  if (typeof skinAge !== 'number' || !Number.isFinite(skinAge)) return null;
  if (!Number.isFinite(actualAge) || actualAge <= 0) return null;
  const z = (skinAge - actualAge) / 4.5;
  return { top: clampPct(normalCdf(z) * 100), diffYears: Math.round(actualAge - skinAge) };
}

/** 연령버킷 → 사용자 표기 라벨 (성별 결합 가능) */
export function bucketLabel(age, gender) {
  const b = ageToBucket(age);
  if (!b) return '또래';
  const ageTxt = b === '10s' ? '10대' : b === '20s' ? '20대' : b === '30s' ? '30대' : b === '40s' ? '40대' : '50대+';
  const g = gender === '여성' ? ' 여성' : gender === '남성' ? ' 남성' : '';
  return `${ageTxt}${g}`;
}
