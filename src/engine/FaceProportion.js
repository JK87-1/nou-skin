/**
 * FaceProportion.js — 얼굴 비율·얼굴형 분석 엔진
 *
 * MediaPipe 468 landmark에서 다음을 계산:
 *   - 삼정(三停): 헤어라인→눈썹, 눈썹→코밑, 코밑→턱끝 비율
 *   - 오등분(五等分): 얼굴 폭을 눈 폭으로 5등분 했을 때 균형
 *   - 황금비: 얼굴 높이 / 폭 (이상 1.618)
 *   - 좌우 대칭: midline 기준 좌·우 landmark 거리 편차
 *   - 얼굴형: oval / round / square / long / heart / diamond
 *
 * 의료 행위 아님. 메이크업·헤어 코칭의 입력 데이터로 사용.
 */

import { detectLandmarks } from './FaceLandmarker';

// 핵심 landmark 인덱스 (MediaPipe Face Mesh 468)
const LM = {
  hairline: 10,        // 이마 상단 추정 (실제 헤어라인 근처, 보수적)
  glabella: 9,         // 미간
  leftBrow: 70,        // 왼쪽 눈썹 위
  rightBrow: 300,      // 오른쪽 눈썹 위
  noseTip: 1,
  subnasale: 2,        // 인중 시작 (코 밑)
  chin: 152,           // 턱끝
  leftCheek: 234,      // 왼쪽 광대 측면 (얼굴 폭 기준)
  rightCheek: 454,     // 오른쪽 광대 측면
  leftEyeOuter: 33,
  leftEyeInner: 133,
  rightEyeInner: 362,
  rightEyeOuter: 263,
  leftMouth: 61,
  rightMouth: 291,
  leftJaw: 172,        // 턱각 (mandibular angle)
  rightJaw: 397,
  leftForehead: 103,   // 이마 폭 측정점
  rightForehead: 332,
};

function dist(p1, p2) {
  if (!p1 || !p2) return 0;
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

/**
 * 비율 분석 메인 함수
 * @param {Array<{x,y,z?}>} landmarks  MediaPipe 468 landmark (정규화 0~1)
 * @returns {object|null}
 */
export function analyzeProportion(landmarks) {
  if (!landmarks || landmarks.length < 468) return null;
  const get = (i) => landmarks[i];

  // ===== 1) 삼정(三停) — 세로 3등분 =====
  const yHairline = get(LM.hairline).y;
  const yBrow = (get(LM.leftBrow).y + get(LM.rightBrow).y) / 2;
  const ySubnasale = get(LM.subnasale).y;
  const yChin = get(LM.chin).y;

  const upper = Math.max(0, yBrow - yHairline);     // 상정: 헤어라인 → 눈썹
  const middle = Math.max(0, ySubnasale - yBrow);    // 중정: 눈썹 → 코밑
  const lower = Math.max(0, yChin - ySubnasale);     // 하정: 코밑 → 턱끝
  const totalV = upper + middle + lower || 1;

  const thirds = {
    upper: upper / totalV,
    middle: middle / totalV,
    lower: lower / totalV,
  };
  const maxThirdDev = Math.max(
    Math.abs(thirds.upper - 1/3),
    Math.abs(thirds.middle - 1/3),
    Math.abs(thirds.lower - 1/3)
  );
  // 33% 이탈 시 0점
  const thirdsBalance = Math.max(0, 100 - maxThirdDev * 300);

  // ===== 2) 오등분(五等分) — 가로 5등분 =====
  const faceWidth = dist(get(LM.leftCheek), get(LM.rightCheek));
  const leftEyeWidth = dist(get(LM.leftEyeOuter), get(LM.leftEyeInner));
  const rightEyeWidth = dist(get(LM.rightEyeOuter), get(LM.rightEyeInner));
  const eyeGap = dist(get(LM.leftEyeInner), get(LM.rightEyeInner));
  const avgEyeWidth = (leftEyeWidth + rightEyeWidth) / 2 || 0.01;

  const fifthsRatio = faceWidth / avgEyeWidth; // 이상 5.0
  const fifthsBalance = Math.max(0, 100 - Math.abs(fifthsRatio - 5) * 22);
  const eyeGapRatio = eyeGap / avgEyeWidth; // 이상 1.0 (눈 간격 = 눈 폭)

  // ===== 3) 황금비 — 얼굴 높이/폭 =====
  const faceHeight = Math.max(0.01, yChin - yHairline);
  const goldenRatio = faceHeight / (faceWidth || 0.01);
  const goldenBalance = Math.max(0, 100 - Math.abs(goldenRatio - 1.618) * 80);

  // ===== 4) 좌우 대칭 =====
  const midX = (get(LM.leftCheek).x + get(LM.rightCheek).x) / 2;
  const symmetryPairs = [
    [LM.leftEyeOuter, LM.rightEyeOuter],
    [LM.leftEyeInner, LM.rightEyeInner],
    [LM.leftMouth, LM.rightMouth],
    [LM.leftBrow, LM.rightBrow],
    [LM.leftJaw, LM.rightJaw],
    [LM.leftForehead, LM.rightForehead],
  ];
  let symDev = 0;
  symmetryPairs.forEach(([li, ri]) => {
    const dl = Math.abs(get(li).x - midX);
    const dr = Math.abs(get(ri).x - midX);
    symDev += Math.abs(dl - dr);
  });
  const symmetry = Math.max(0, 100 - (symDev / (faceWidth || 0.01)) * 600);

  // ===== 5) 얼굴형 분류 =====
  const foreheadW = dist(get(LM.leftForehead), get(LM.rightForehead));
  const jawW = dist(get(LM.leftJaw), get(LM.rightJaw));
  const heightWidthRatio = faceHeight / (faceWidth || 0.01);

  let shape, shapeLabel, shapeDesc;
  if (heightWidthRatio >= 1.5) {
    shape = 'long';
    shapeLabel = '긴 얼굴형';
    shapeDesc = '세로로 길고 광대·이마·턱 폭이 비교적 비슷한 형태입니다.';
  } else if (heightWidthRatio < 1.15) {
    if (Math.abs(faceWidth - jawW) / (faceWidth || 1) < 0.15) {
      shape = 'square';
      shapeLabel = '각진 얼굴형';
      shapeDesc = '광대와 턱 폭이 비슷하고 턱각이 또렷한 형태입니다.';
    } else {
      shape = 'round';
      shapeLabel = '둥근 얼굴형';
      shapeDesc = '세로·가로 비율이 비슷하고 부드러운 곡선의 형태입니다.';
    }
  } else {
    if (foreheadW > faceWidth * 0.88 && jawW < faceWidth * 0.78) {
      shape = 'heart';
      shapeLabel = '하트형';
      shapeDesc = '이마가 넓고 턱이 갸름한 V라인 형태입니다.';
    } else if (faceWidth > foreheadW * 1.12 && faceWidth > jawW * 1.12) {
      shape = 'diamond';
      shapeLabel = '다이아몬드형';
      shapeDesc = '광대가 가장 넓고 이마·턱이 상대적으로 좁은 형태입니다.';
    } else {
      shape = 'oval';
      shapeLabel = '계란형';
      shapeDesc = '이상적 비율로 알려진 균형 잡힌 형태입니다.';
    }
  }

  // ===== 6) 종합 점수 (4지표 평균) =====
  const overall = Math.round((thirdsBalance + fifthsBalance + goldenBalance + symmetry) / 4);

  return {
    overall,
    thirds: {
      upper: +(thirds.upper * 100).toFixed(1),
      middle: +(thirds.middle * 100).toFixed(1),
      lower: +(thirds.lower * 100).toFixed(1),
      balance: Math.round(thirdsBalance),
      ideal: 33.33,
    },
    fifths: {
      ratio: +fifthsRatio.toFixed(2),
      ideal: 5.0,
      eyeGapRatio: +eyeGapRatio.toFixed(2),
      balance: Math.round(fifthsBalance),
    },
    golden: {
      ratio: +goldenRatio.toFixed(3),
      ideal: 1.618,
      balance: Math.round(goldenBalance),
    },
    symmetry: Math.round(symmetry),
    shape: {
      type: shape,
      label: shapeLabel,
      desc: shapeDesc,
      heightWidth: +heightWidthRatio.toFixed(2),
      foreheadWidth: +(foreheadW * 100).toFixed(1),
      cheekboneWidth: +(faceWidth * 100).toFixed(1),
      jawWidth: +(jawW * 100).toFixed(1),
    },
    // UI 오버레이용 핵심 좌표 (정규화 0~1, 이미지 비율 적용 필요)
    keyPoints: {
      hairline: { x: get(LM.hairline).x, y: get(LM.hairline).y },
      brow: { x: (get(LM.leftBrow).x + get(LM.rightBrow).x) / 2, y: yBrow },
      subnasale: { x: get(LM.subnasale).x, y: ySubnasale },
      chin: { x: get(LM.chin).x, y: yChin },
      leftCheek: { x: get(LM.leftCheek).x, y: get(LM.leftCheek).y },
      rightCheek: { x: get(LM.rightCheek).x, y: get(LM.rightCheek).y },
      leftEyeOuter: { x: get(LM.leftEyeOuter).x, y: get(LM.leftEyeOuter).y },
      leftEyeInner: { x: get(LM.leftEyeInner).x, y: get(LM.leftEyeInner).y },
      rightEyeInner: { x: get(LM.rightEyeInner).x, y: get(LM.rightEyeInner).y },
      rightEyeOuter: { x: get(LM.rightEyeOuter).x, y: get(LM.rightEyeOuter).y },
    },
  };
}

/**
 * 이미지 → 비율 분석 (편의 함수)
 * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement} image
 */
export async function analyzeProportionFromImage(image) {
  try {
    const lm = await detectLandmarks(image);
    if (!lm) return null;
    return analyzeProportion(lm);
  } catch (e) {
    console.warn('[FaceProportion] landmark detection failed:', e);
    return null;
  }
}

/**
 * 얼굴형 한국어 라벨·간단 키 매핑 (외부 카드 등에서 활용)
 */
export const FACE_SHAPE_LABELS = {
  oval: '계란형',
  round: '둥근형',
  square: '각진형',
  long: '긴 얼굴형',
  heart: '하트형',
  diamond: '다이아몬드형',
};
