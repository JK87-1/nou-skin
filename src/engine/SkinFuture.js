/**
 * SkinFuture.js — "케어 후 피부" 시각화 클라이언트
 *
 * FaceProportion 결과·일반 측정 metrics와 정면 사진 → /api/skin-future → 가상 결과 base64
 */

const SKIN_FUTURE_TIMEOUT_MS = 110000; // 서버 90s + 네트워크 여유

export async function fetchSkinFuture({ image, metrics, onProgress }) {
  const tick = (s, p) => { try { onProgress?.(s, p); } catch {} };

  if (!image) return { ok: false, reason: 'missing_image' };

  tick('AI 이미지 준비', 15);
  let resp;
  try {
    resp = await Promise.race([
      fetch('/api/skin-future', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, metrics }),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('skinfuture_timeout')), SKIN_FUTURE_TIMEOUT_MS)),
    ]);
  } catch (e) {
    return { ok: false, reason: e.message === 'skinfuture_timeout' ? 'timeout' : 'network_error', detail: e.message };
  }

  if (!resp.ok) {
    let err = null;
    try { err = await resp.json(); } catch {}
    if (resp.status === 429) return { ok: false, reason: 'rate_limit', detail: err };
    if (resp.status === 502 || resp.status === 504) return { ok: false, reason: 'ai_failed', detail: err };
    return { ok: false, reason: `http_${resp.status}`, detail: err };
  }

  tick('결과 처리', 90);
  let payload;
  try { payload = await resp.json(); } catch (e) {
    return { ok: false, reason: 'parse_error', detail: e.message };
  }

  const imageBase64 = payload?.imageBase64;
  if (!imageBase64) return { ok: false, reason: 'invalid_response_format' };

  tick('완료', 100);
  return { ok: true, imageBase64 };
}

export function skinFutureErrorMessage(reason) {
  switch (reason) {
    case 'missing_image': return '정면 사진이 필요해요.';
    case 'timeout': return '이미지 생성이 평소보다 오래 걸리고 있어요. 잠시 후 다시 시도해주세요.';
    case 'ai_failed': return 'AI 이미지 생성에 실패했어요. 잠시 후 다시 시도해주세요.';
    case 'rate_limit': return '오늘 시각화 한도(10회)를 초과했어요. 내일 다시 이용해주세요.';
    case 'network_error': return '네트워크가 불안정해요. 다시 시도해주세요.';
    default: return '시각화 생성에 실패했어요.';
  }
}
