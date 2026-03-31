self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheKeys = await caches.keys();
    const legacyCacheKeys = cacheKeys.filter((cacheKey) => {
      return cacheKey.indexOf('workbox-precache') === 0
        || cacheKey === 'js-assets'
        || cacheKey === 'js-css-assets'
        || cacheKey === 'static-assets'
        || cacheKey === 'api-bootstrap'
        || cacheKey === 'api-stats'
        || cacheKey.indexOf('/m/') >= 0;
    });

    await Promise.all(legacyCacheKeys.map((cacheKey) => caches.delete(cacheKey)));

    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    await self.registration.unregister();

    await Promise.all(
      clients.map((client) => {
        return client.navigate(client.url);
      })
    );
  })());
});
