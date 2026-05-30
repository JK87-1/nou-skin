const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
  || 'BH68mFeIY1JgorXJe4VJxLBW3TGi4TRSUvHVckGSxIa_-TUf_nD3tF4W5I821NjvUHhdm1vrmYM5HPCrbuKvQCg';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// navigator.serviceWorker.ready can hang forever on iOS standalone PWA when
// the service worker isn't controlling the page. Race it against a timeout so
// callers fail fast (→ catch/toast) instead of stalling silently and leaving
// the UI stuck (e.g. a toggle that never responds again).
export function swReady(timeoutMs = 8000) {
  if (!('serviceWorker' in navigator)) {
    return Promise.reject(new Error('serviceWorker unsupported'));
  }
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('serviceWorker.ready timeout')), timeoutMs),
    ),
  ]);
}

export function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

export function getPermissionState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function subscribeToPush() {
  if (!isPushSupported()) return null;
  if (!VAPID_PUBLIC_KEY) {
    console.warn('VAPID_PUBLIC_KEY not configured');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await swReady();

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  return subscription;
}

export async function saveSubscriptionToServer(subscription, reminderTime, nickname) {
  const response = await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      reminderTime,
      nickname,
    }),
  });
  return response.ok;
}

export async function unsubscribeFromPush() {
  const registration = await swReady();
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    await fetch('/api/push-subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => {});

    await subscription.unsubscribe();
  }
}

export async function updateReminderTime(reminderTime, nickname) {
  const registration = await swReady();
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    return saveSubscriptionToServer(subscription, reminderTime, nickname);
  }
  return false;
}

export async function updateTipSettings(tipEnabled, tipTime) {
  const registration = await swReady();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;

  const response = await fetch('/api/push-subscribe', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      tipEnabled,
      tipTime,
    }),
  });
  return response.ok;
}

export async function updateWeatherSettings(weatherEnabled, lat, lon) {
  const registration = await swReady();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;

  const response = await fetch('/api/push-subscribe', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      weatherEnabled,
      weatherLat: lat,
      weatherLon: lon,
    }),
  });
  return response.ok;
}

export async function syncSkinDataToServer(skinData, profile, goalMetrics) {
  const registration = await swReady();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;

  const body = {
    endpoint: subscription.endpoint,
    skinData: {
      moisture: skinData.moisture,
      skinTone: skinData.skinTone,
      wrinkleScore: skinData.wrinkleScore,
      poreScore: skinData.poreScore,
      elasticityScore: skinData.elasticityScore,
      pigmentationScore: skinData.pigmentationScore,
      textureScore: skinData.textureScore,
      darkCircleScore: skinData.darkCircleScore,
      oilBalance: skinData.oilBalance,
      troubleCount: skinData.troubleCount,
      overallScore: skinData.overallScore,
      conditionScore: skinData.conditionScore,
      skinAge: skinData.skinAge,
    },
    skinType: profile?.skinType,
    skinConcerns: profile?.skinConcerns,
    sensitivity: profile?.sensitivity,
  };

  if (goalMetrics && goalMetrics.length > 0) {
    body.goalMetrics = goalMetrics;
  }

  const response = await fetch('/api/push-subscribe', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.ok;
}
