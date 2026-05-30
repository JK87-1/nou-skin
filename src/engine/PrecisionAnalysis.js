/**
 * PrecisionAnalysis.js — 정밀 측정 모드 클라이언트 엔진
 *
 * 정면·좌·우 3장의 사진을 받아:
 *  1) 각 이미지 정규화 (조명·색온도 보정)
 *  2) face descriptor로 3장 동일인 검증
 *  3) /api/precision-analyze POST
 *  4) 정밀 결과 반환 (asymmetry·regional_scores·clinical_findings 포함)
 *
 * 정밀 측정은 일반 baseline anchor에 영향받지 않도록 baseline 데이터를 전송하지 않습니다.
 * 매번 객관적인 raw 분석을 제공해 사용자가 "정밀이 일반에 매여있다"고 느끼지 않게.
 * (동일인 검증은 face descriptor + 일반 baseline.descriptor로 처리)
 */

import { getDeviceFingerprint } from '../utils/deviceFingerprint';
import { extractDescriptorFromBase64, descriptorDistance, classifyDistance, preload as preloadFaceDescriptor } from './FaceDescriptor';
import { normalizeImageBase64 } from './ImageNormalizer';
import { getBaseline } from './HybridAnalysis';

const PRECISION_TIMEOUT_MS = 100000; // API 자체 90s + 네트워크 여유

/**
 * 단일 이미지 정규화 — 디바이스·조명 차이 흡수.
 * 측면 사진은 ImageNormalizer만 적용 (cropFace는 landmark 의존이라 측면엔 부정확).
 */
async function normalizeOne(rawB64) {
  try {
    const norm = await normalizeImageBase64(rawB64);
    return norm?.normalizedBase64 || rawB64;
  } catch {
    return rawB64;
  }
}

/**
 * 3장 동일인 검증 — face descriptor 활용.
 * 정면 기준으로 좌·우와 거리 계산. 임계 초과면 different 표시.
 * 모델 미로드·얼굴 미검출 등으로 descriptor가 null이면 'unknown'.
 */
async function verifyAllSamePerson(frontB64, leftB64, rightB64) {
  // preload (혹시 모델 미로드면 빠르게 시작)
  try { preloadFaceDescriptor(); } catch {}

  const [dFront, dLeft, dRight] = await Promise.all([
    extractDescriptorFromBase64(frontB64),
    extractDescriptorFromBase64(leftB64),
    extractDescriptorFromBase64(rightB64),
  ]);

  if (!dFront || !dLeft || !dRight) {
    return { status: 'unknown', distances: { left: null, right: null } };
  }

  const distLeft = descriptorDistance(dFront, dLeft);
  const distRight = descriptorDistance(dFront, dRight);
  const classLeft = classifyDistance(distLeft);
  const classRight = classifyDistance(distRight);

  // 측면 사진은 정면 임베딩과 distance가 다소 커질 수 있어(0.4~0.55 흔함).
  // 'different' (>0.6) 확정인 경우만 strict 거부, 그 외 same/ambiguous는 통과.
  const allOk = classLeft !== 'different' && classRight !== 'different';

  return {
    status: allOk ? 'same' : 'different',
    distances: {
      left: distLeft != null ? +distLeft.toFixed(3) : null,
      right: distRight != null ? +distRight.toFixed(3) : null,
    },
    classes: { left: classLeft, right: classRight },
    descriptors: { front: dFront }, // 향후 baseline 동기화용
  };
}

/**
 * 정밀 측정 메인 호출.
 *
 * @param {object} params
 *   - frontB64, leftB64, rightB64: 각 사진 base64(prefix 제거된 raw)
 *   - onProgress?: (stage:string, percent:number) => void  — 정규화·검증·AI 단계 진행 표시
 * @returns {Promise<{ ok:true, result:object } | { ok:false, reason:string, detail?:any }>}
 */
export async function runPrecisionMeasure({ frontB64, leftB64, rightB64, onProgress }) {
  const tick = (s, p) => { try { onProgress?.(s, p); } catch {} };

  if (!frontB64 || !leftB64 || !rightB64) {
    return { ok: false, reason: 'missing_images' };
  }

  // 1) 정규화 — 3장 병렬 (조명·색온도 보정)
  tick('정규화', 10);
  const [nFront, nLeft, nRight] = await Promise.all([
    normalizeOne(frontB64),
    normalizeOne(leftB64),
    normalizeOne(rightB64),
  ]);

  // 2) 동일인 검증 — 정밀 측정은 결제 모드라 strict
  tick('얼굴 확인', 30);
  const verify = await verifyAllSamePerson(nFront, nLeft, nRight);
  if (verify.status === 'different') {
    return { ok: false, reason: 'different_person', detail: verify };
  }

  // 3) 동일인이면 baseline.descriptor 미보유 시 정면 descriptor를 일반 baseline에도 backfill (보너스)
  try {
    const rawBaseline = getBaseline();
    if (rawBaseline && !rawBaseline.descriptor && verify.descriptors?.front) {
      // saveBaseline은 HybridAnalysis 내부 함수 — 외부 직접 import 안 하고 storage 직접 갱신
      try { localStorage.setItem('baselineDescriptor', JSON.stringify(verify.descriptors.front)); } catch {}
    }
  } catch {}

  // 4) /api/precision-analyze 호출 — baseline 자체는 전송 안 함(raw 평가 우선)
  tick('정밀 분석', 50);
  const device = getDeviceFingerprint();
  const body = {
    imageFront: nFront,
    imageLeft: nLeft,
    imageRight: nRight,
    currentDevice: device.hash,
    faceMatch: verify.status,
    faceDistance: verify.distances?.left ?? verify.distances?.right ?? null,
  };

  let resp;
  try {
    resp = await Promise.race([
      fetch('/api/precision-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('precision_timeout')), PRECISION_TIMEOUT_MS)),
    ]);
  } catch (e) {
    return { ok: false, reason: e.message === 'precision_timeout' ? 'timeout' : 'network_error', detail: e.message };
  }

  if (!resp.ok) {
    let err = null;
    try { err = await resp.json(); } catch {}
    if (resp.status === 429) return { ok: false, reason: 'rate_limit', detail: err };
    if (resp.status === 502) return { ok: false, reason: 'ai_failed', detail: err };
    return { ok: false, reason: `http_${resp.status}`, detail: err };
  }

  tick('결과 처리', 90);
  let payload;
  try {
    payload = await resp.json();
  } catch (e) {
    return { ok: false, reason: 'parse_error', detail: e.message };
  }

  const text = payload?.content?.[0]?.text || '';
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid_response_format' };
  }

  // measureDebug에 클라이언트 측 verify 정보 합치기
  result.measureDebug = {
    ...(result.measureDebug || {}),
    faceVerify: verify.classes || null,
    faceDistances: verify.distances || null,
    capturedAt: new Date().toISOString(),
  };

  // analysisMode 확정
  result.analysisMode = 'precision_hybrid';

  tick('완료', 100);
  return { ok: true, result };
}

/**
 * 사용자 친화 에러 메시지 매핑.
 * 결과 화면·모달에서 이 매핑으로 안내 문구 표시.
 */
export function precisionErrorMessage(reason) {
  switch (reason) {
    case 'missing_images': return '정면·좌·우 사진 3장이 모두 필요해요.';
    case 'different_person': return '3장이 다른 사람으로 인식됐어요. 같은 분의 정면·좌·우 사진으로 다시 찍어주세요.';
    case 'timeout': return '분석이 평소보다 오래 걸리고 있어요. 잠시 후 다시 시도해주세요.';
    case 'ai_failed': return 'AI 분석에 실패했어요. 잠시 후 다시 시도해주세요. (결제는 차감되지 않아요)';
    case 'rate_limit': return '오늘 정밀 측정 한도를 초과했어요. 내일 다시 이용해주세요.';
    case 'network_error': return '네트워크가 불안정해요. Wi-Fi/데이터를 확인하고 다시 시도해주세요.';
    case 'parse_error':
    case 'invalid_response_format': return '결과를 처리하는 중 문제가 생겼어요. 다시 시도해주세요. (결제는 차감되지 않아요)';
    default: return '정밀 측정에 실패했어요. 다시 시도해주세요.';
  }
}
