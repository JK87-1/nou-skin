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

  const registration = await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  return subscription;
}

/**
 * 구독을 서버에 저장(POST).
 * 시그니처 1 (신규): saveSubscriptionToServer(subscription, { morningEnabled, morningTime, eveningEnabled, eveningTime, nickname })
 * 시그니처 2 (하위호환): saveSubscriptionToServer(subscription, reminderTime, nickname)
 */
export async function saveSubscriptionToServer(subscription, optsOrReminderTime, nicknameLegacy) {
  let body;
  if (typeof optsOrReminderTime === 'string' || optsOrReminderTime == null) {
    // legacy: (subscription, reminderTime, nickname)
    body = {
      subscription: subscription.toJSON(),
      reminderTime: optsOrReminderTime || '09:00',
      nickname: nicknameLegacy || '',
    };
  } else {
    const opts = optsOrReminderTime;
    body = {
      subscription: subscription.toJSON(),
      morningEnabled: opts.morningEnabled !== undefined ? opts.morningEnabled : true,
      morningTime: opts.morningTime || '09:00',
      eveningEnabled: opts.eveningEnabled !== undefined ? opts.eveningEnabled : true,
      eveningTime: opts.eveningTime || '21:00',
      nickname: opts.nickname || '',
    };
  }
  const response = await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.ok;
}

export async function unsubscribeFromPush() {
  const registration = await navigator.serviceWorker.ready;
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
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    return saveSubscriptionToServer(subscription, reminderTime, nickname);
  }
  return false;
}

/**
 * 아침/저녁 슬롯 부분 업데이트(PUT). 인자는 모두 optional.
 * { morningEnabled, morningTime, eveningEnabled, eveningTime, nickname }
 */
export async function updateReminderSlots(opts = {}) {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;

  const body = { endpoint: subscription.endpoint };
  if (opts.morningEnabled !== undefined) body.morningEnabled = opts.morningEnabled;
  if (opts.morningTime !== undefined) body.morningTime = opts.morningTime;
  if (opts.eveningEnabled !== undefined) body.eveningEnabled = opts.eveningEnabled;
  if (opts.eveningTime !== undefined) body.eveningTime = opts.eveningTime;
  if (opts.nickname !== undefined) body.nickname = opts.nickname;

  const response = await fetch('/api/push-subscribe', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.ok;
}

/** 현재 PushManager 구독이 있는지 확인 (UI 토글 초기값용). */
export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function updateTipSettings(tipEnabled, tipTime) {
  const registration = await navigator.serviceWorker.ready;
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

export async function syncSkinDataToServer(skinData, profile, goalMetrics) {
  const registration = await navigator.serviceWorker.ready;
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
