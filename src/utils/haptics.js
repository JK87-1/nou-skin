/**
 * Haptics — Apple 스타일 미세 진동.
 *
 * Capacitor native iOS/Android에서만 작동. 웹 PWA(iOS Safari)는 미지원이라 silent fail.
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

/** 가벼운 임팩트 — 셀렉션·스와이프·탭 적합. */
export async function hapticLight() {
  try {
    const mod = await load();
    if (!mod) return;
    await mod.Haptics.impact({ style: mod.ImpactStyle.Light });
  } catch {}
}

/** 중간 임팩트 — 토글·완료 등. */
export async function hapticMedium() {
  try {
    const mod = await load();
    if (!mod) return;
    await mod.Haptics.impact({ style: mod.ImpactStyle.Medium });
  } catch {}
}

/** 셀렉션 변경 — 캐러셀·스와이프 페이지 넘김 등 (가장 부드러움). */
export async function hapticSelection() {
  try {
    const mod = await load();
    if (!mod) return;
    await mod.Haptics.selectionChanged();
  } catch {}
}

/** 성공 알림 — 작업 완료 시. */
export async function hapticSuccess() {
  try {
    const mod = await load();
    if (!mod) return;
    await mod.Haptics.notification({ type: mod.NotificationType.Success });
  } catch {}
}
