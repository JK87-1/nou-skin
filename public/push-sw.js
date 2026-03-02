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
      timestamp: Date.now(),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
