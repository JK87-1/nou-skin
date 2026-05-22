/**
 * deviceFingerprint — 측정 디바이스 식별용 가벼운 fingerprint.
 *
 * 목적: 같은 사용자가 다른 폰으로 측정할 때 baseline 비교를 잘못해서
 * "다른 사람"으로 오판하거나 점수가 20점씩 튀는 문제 해결.
 * 다른 디바이스로 측정한 경우 baseline anchor를 사용하지 않음.
 *
 * 식별 요소 (안정적·일관적):
 * - platform (iPhone / iPad / Android / Mac / Windows)
 * - userAgent의 브랜드·OS 버전 핵심 토큰
 * - screen.width × height
 * - devicePixelRatio
 *
 * 식별 안 되는 요소 (브라우저마다 변동):
 * - language, timezone (사용자가 변경 가능)
 * - 정확한 브라우저 버전 (자주 업데이트)
 *
 * 결과는 fnv-1a 32bit hash → 8자 hex.
 */

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function getCoreSignature() {
  try {
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    // userAgent에서 안정적인 브랜드·OS 토큰만 추출
    const tokens = [];
    if (/iPhone/i.test(ua)) tokens.push('iPhone');
    if (/iPad/i.test(ua)) tokens.push('iPad');
    if (/Android/i.test(ua)) {
      tokens.push('Android');
      const m = ua.match(/Android\s+(\d+)/);
      if (m) tokens.push(`A${m[1]}`);
    }
    if (/Macintosh/i.test(ua)) tokens.push('Mac');
    if (/Windows/i.test(ua)) tokens.push('Win');
    // iOS 버전
    const iosM = ua.match(/OS\s+(\d+)_/);
    if (iosM) tokens.push(`iOS${iosM[1]}`);
    // 브라우저 엔진
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) tokens.push('Safari');
    if (/Chrome/i.test(ua)) tokens.push('Chrome');
    if (/FxiOS/i.test(ua)) tokens.push('Firefox');

    const w = window.screen?.width || 0;
    const h = window.screen?.height || 0;
    const dpr = window.devicePixelRatio || 1;
    return `${platform}|${tokens.join(',')}|${Math.min(w,h)}x${Math.max(w,h)}|${dpr.toFixed(1)}`;
  } catch {
    return 'unknown';
  }
}

let cached = null;

/**
 * 현재 디바이스의 fingerprint (8자 hex hash + 짧은 라벨).
 */
export function getDeviceFingerprint() {
  if (cached) return cached;
  const sig = getCoreSignature();
  const hash = fnv1a(sig);
  // 사람 읽을 수 있는 짧은 라벨
  const label = (() => {
    const parts = sig.split('|');
    const tokens = parts[1] || '';
    const screen = parts[2] || '';
    if (/iPhone/.test(tokens)) return `iPhone ${screen}`;
    if (/iPad/.test(tokens)) return `iPad ${screen}`;
    if (/Android/.test(tokens)) return `Android ${screen}`;
    if (/Mac/.test(tokens)) return `Mac ${screen}`;
    if (/Win/.test(tokens)) return `Windows ${screen}`;
    return `Device ${screen}`;
  })();
  cached = { hash, label, signature: sig };
  return cached;
}

/**
 * 두 fingerprint가 같은 디바이스인지.
 */
export function isSameDevice(fpA, fpB) {
  if (!fpA || !fpB) return false;
  if (typeof fpA === 'string') return fpA === (typeof fpB === 'string' ? fpB : fpB.hash);
  return fpA.hash === (typeof fpB === 'string' ? fpB : fpB.hash);
}
