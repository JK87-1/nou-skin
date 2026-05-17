/**
 * Capacitor 네이티브 환경 초기화.
 * iOS/Android 앱으로 빌드되었을 때만 동작 (web/PWA에서는 no-op).
 *
 * 호출 위치: src/main.jsx 진입 시 1회.
 */
import { Capacitor } from '@capacitor/core';

export async function initNative() {
  if (!Capacitor.isNativePlatform()) return;

  // StatusBar — 라이트 모드 기본, 다크 테마 적용 시 별도 처리
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    const isDark = (() => {
      try { return (localStorage.getItem('lua_color_mode') || 'light') === 'dark'; }
      catch { return false; }
    })();
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
    await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
  } catch (e) { console.warn('[native] StatusBar init failed', e); }

  // Keyboard — 입력창이 올라올 때 accessory bar 숨김 + viewport 조정
  try {
    const { Keyboard } = await import('@capacitor/keyboard');
    await Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
  } catch (e) { console.warn('[native] Keyboard init failed', e); }

  // SplashScreen — 짧은 페이드 후 숨김
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    setTimeout(() => SplashScreen.hide({ fadeOutDuration: 220 }).catch(() => {}), 400);
  } catch (e) { console.warn('[native] SplashScreen init failed', e); }
}
