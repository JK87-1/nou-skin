/**
 * FaceCoaching.js — 메이크업·헤어 AI 코칭 클라이언트
 *
 * FaceProportion 결과 → /api/face-coaching → 코칭 JSON
 */

const COACHING_TIMEOUT_MS = 22000;

export async function fetchFaceCoaching(proportion, { onProgress } = {}) {
  if (!proportion) return { ok: false, reason: 'missing_proportion' };

  try { onProgress?.('AI 스타일링 분석', 30); } catch {}

  let resp;
  try {
    resp = await Promise.race([
      fetch('/api/face-coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proportion }),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('coaching_timeout')), COACHING_TIMEOUT_MS)),
    ]);
  } catch (e) {
    return { ok: false, reason: e.message === 'coaching_timeout' ? 'timeout' : 'network_error', detail: e.message };
  }

  if (!resp.ok) {
    let err = null;
    try { err = await resp.json(); } catch {}
    if (resp.status === 429) return { ok: false, reason: 'rate_limit', detail: err };
    if (resp.status === 502) return { ok: false, reason: 'ai_failed', detail: err };
    return { ok: false, reason: `http_${resp.status}`, detail: err };
  }

  let payload;
  try { payload = await resp.json(); } catch (e) {
    return { ok: false, reason: 'parse_error', detail: e.message };
  }

  const text = payload?.content?.[0]?.text || '';
  let coaching;
  try { coaching = JSON.parse(text); } catch {
    return { ok: false, reason: 'invalid_response_format' };
  }

  try { onProgress?.('완료', 100); } catch {}
  return { ok: true, coaching };
}

export function coachingErrorMessage(reason) {
  switch (reason) {
    case 'missing_proportion': return '얼굴 분석 결과가 필요해요.';
    case 'timeout': return 'AI 분석이 평소보다 오래 걸리고 있어요. 잠시 후 다시 시도해주세요.';
    case 'ai_failed': return 'AI 코칭 생성에 실패했어요. 잠시 후 다시 시도해주세요.';
    case 'rate_limit': return '오늘 코칭 한도를 초과했어요. 내일 다시 이용해주세요.';
    case 'network_error': return '네트워크가 불안정해요. 다시 시도해주세요.';
    case 'parse_error':
    case 'invalid_response_format': return '결과 처리 중 문제가 생겼어요. 다시 시도해주세요.';
    default: return '코칭 생성에 실패했어요.';
  }
}
