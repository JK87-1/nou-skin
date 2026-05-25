/**
 * Haptics — Apple 스타일 미세 진동 + 웹 폴백.
 *
 * 우선순위: Capacitor native(iOS/Android) → navigator.vibrate (Android Chrome) → silent.
 * iOS Safari PWA는 Vibration API 자체를 미지원이라 폴백 없이 silent. (앱 전환 시 해결)
 * 모든 호출은 fire-and-forget, await 강제 안 함.
 */

import { Capacitor } from '@capacitor/core';

let cached = null;
async function load() {
  if (cached !== null) return cached;
  if (!Capacitor.isNativePlatform?.()) { cached = false; return false; }
  try {
    cached = await import('@capacitor/haptics');
    return cached;
  } catch {
    cached = false;
    return false;
  }
}

// 웹 폴백 — navigator.vibrate(ms or pattern). Android Chrome에서 작동, iOS Safari는 미지원(silent).
// 너무 자주·길게 호출하면 사용자가 거슬려함 → 짧고 1회만.
function webVibrate(ms) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch {}
}

/** 가벼운 임팩트 — 셀렉션·스와이프·탭 적합. */
export async function hapticLight() {
  try {
    const mod = await load();
    if (mod) { await mod.Haptics.impact({ style: mod.ImpactStyle.Light }); return; }
    webVibrate(10);
  } catch { webVibrate(10); }
}

/** 중간 임팩트 — 토글·완료 등. */
export async function hapticMedium() {
  try {
    const mod = await load();
    if (mod) { await mod.Haptics.impact({ style: mod.ImpactStyle.Medium }); return; }
    webVibrate(18);
  } catch { webVibrate(18); }
}

/** 셀렉션 변경 — 캐러셀·스와이프 페이지 넘김 등 (가장 부드러움). */
export async function hapticSelection() {
  try {
    const mod = await load();
    if (mod) { await mod.Haptics.selectionChanged(); return; }
    webVibrate(6);
  } catch { webVibrate(6); }
}

/** 성공 알림 — 작업 완료 시. */
export async function hapticSuccess() {
  try {
    const mod = await load();
    if (mod) { await mod.Haptics.notification({ type: mod.NotificationType.Success }); return; }
    webVibrate([12, 30, 18]); // double-tap 패턴 (성공 시그널)
  } catch { webVibrate(20); }
}

/** 경고 알림 — 삭제·되돌리기 등 무게감. */
export async function hapticWarning() {
  try {
    const mod = await load();
    if (mod) { await mod.Haptics.notification({ type: mod.NotificationType.Warning }); return; }
    webVibrate([20, 40, 20]);
  } catch { webVibrate(30); }
}
