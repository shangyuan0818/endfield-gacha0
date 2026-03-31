const RECOVERY_PARAM = '__sw_recover';

function addRecoveryParam(url) {
  try {
    const nextUrl = new URL(url);
    if (!nextUrl.searchParams.has(RECOVERY_PARAM)) {
      nextUrl.searchParams.set(RECOVERY_PARAM, Date.now().toString());
    }
    return nextUrl.toString();
  } catch (error) {
    return url;
  }
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheKeys = await caches.keys();

    await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
    await self.clients.claim();

    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    await self.registration.unregister();

    await Promise.all(
      clients.map((client) => client.navigate(addRecoveryParam(client.url)))
    );
  })());
});
