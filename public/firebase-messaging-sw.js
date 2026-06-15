importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js');

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function openTargetUrl(url) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if ('focus' in client) {
        client.navigate(url);
        return client.focus();
      }
    }

    if (self.clients.openWindow) {
      return self.clients.openWindow(url);
    }

    return undefined;
  });
}

function targetUrlFromData(data) {
  const listingId = data?.listingId;
  const type = data?.type;

  if (listingId && type === 'message') {
    return `/inbox/listing/${listingId}`;
  }

  if (listingId) {
    return `/listing/${listingId}`;
  }

  return '/tabs/inbox';
}

fetch('/firebase-messaging-config.json')
  .then((response) => {
    if (!response.ok) {
      throw new Error('Missing firebase-messaging-config.json');
    }
    return response.json();
  })
  .then((config) => {
    firebase.initializeApp(config);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const title = payload.notification?.title ?? 'FirmShake';
      const options = {
        body: payload.notification?.body ?? '',
        data: payload.data ?? {},
      };
      self.registration.showNotification(title, options);
    });
  })
  .catch((error) => {
    console.warn('Firebase messaging service worker init failed', error);
  });

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = targetUrlFromData(event.notification.data ?? {});
  event.waitUntil(openTargetUrl(url));
});
