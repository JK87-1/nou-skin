import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'web' | 'ios' | 'android'

export async function initNative() {
  if (!isNative) return;

  // 상태바 설정
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (platform === 'android') {
      await StatusBar.setBackgroundColor({ color: '#000000' });
    }
  } catch (e) { /* 무시 */ }

  // 키보드 설정 (iOS)
  if (platform === 'ios') {
    try {
      await Keyboard.setAccessoryBarVisible({ isVisible: false });
      await Keyboard.setScroll({ isDisabled: false });
    } catch (e) { /* 무시 */ }
  }

  // 네이티브 스플래시 숨기기 (앱 자체 스플래시 사용)
  try {
    await SplashScreen.hide();
  } catch (e) { /* 무시 */ }
}
