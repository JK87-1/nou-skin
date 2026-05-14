// push-sw.js — Push notification handlers for LUA PWA
// Imported by Workbox-generated SW via importScripts

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'LUA', body: event.data.text() };
  }

  const type = data.type || 'reminder';

  let title, tag, url;
  if (type === 'tip') {
    title = data.title || '오늘의 뷰티 팁';
    tag = 'lua-beauty-tip';
    url = data.url || '/';
  } else {
    title = data.title || '피부 측정 리마인더';
    tag = 'lua-reminder';
    url = data.url || '/?scan=1';
  }

  const options = {
    body: data.body || '오늘의 피부 상태를 확인해보세요!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag,
    renotify: true,
    data: {
      url,
      campaign: type,
      slot: data.slot || null,
      timestamp: Date.now(),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

function ensureNotifParam(url) {
  try {
    const u = new URL(url, self.location.origin);
    if (!u.searchParams.has('notif')) u.searchParams.set('notif', '1');
    return u.pathname + u.search + u.hash;
  } catch {
    return url + (url.includes('?') ? '&' : '?') + 'notif=1';
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const rawUrl = data.url || '/';
  const targetUrl = ensureNotifParam(rawUrl);
  const campaign = data.campaign || 'reminder';
  const slot = data.slot || null;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 이미 열린 클라이언트가 있으면 focus + postMessage
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'PUSH_NOTIFICATION_OPENED', campaign, slot, url: targetUrl });
          return client.focus();
        }
      }
      // 없으면 새 창 (URL의 notif=1로 클라이언트가 인식해 트래킹)
      return clients.openWindow(targetUrl);
    })
  );
});
