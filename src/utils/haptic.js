import { Capacitor } from '@capacitor/core';

let Haptics = null;

if (Capacitor.isNativePlatform()) {
  import('@capacitor/haptics').then(m => { Haptics = m.Haptics; }).catch(() => {});
}

export function hapticLight() {
  if (Haptics) {
    Haptics.impact({ style: 'light' }).catch(() => {});
  }
}
