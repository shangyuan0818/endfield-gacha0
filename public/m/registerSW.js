(function () {
  if (!('serviceWorker' in navigator)) return;

  var RECOVERY_PARAM = '__sw_recover';
  var LEGACY_CACHE_NAMES = ['js-assets', 'js-css-assets', 'static-assets', 'api-bootstrap', 'api-stats'];

  function isLegacyScope(scopeUrl) {
    try {
      var scopePath = new URL(scopeUrl).pathname;
      return scopePath === '/' || scopePath === '/m/' || scopePath.indexOf('/m/') === 0;
    } catch (error) {
      return true;
    }
  }

  async function unregisterLegacyServiceWorkers() {
    var registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter(function (registration) {
          return isLegacyScope(registration.scope);
        })
        .map(function (registration) {
          return registration.unregister();
        })
    );
  }

  async function clearLegacyCaches() {
    if (!('caches' in window)) return;

    var cacheKeys = await caches.keys();
    var legacyCacheKeys = cacheKeys.filter(function (cacheKey) {
      return cacheKey.indexOf('workbox-precache') === 0
        || LEGACY_CACHE_NAMES.indexOf(cacheKey) >= 0
        || cacheKey.indexOf('/m/') >= 0;
    });

    await Promise.all(
      legacyCacheKeys.map(function (cacheKey) {
        return caches.delete(cacheKey);
      })
    );
  }

  async function registerRootServiceWorker() {
    try {
      await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });
    } catch (error) {
      console.warn('[registerSW] root service worker registration failed', error);
    }
  }

  async function recoverLegacyClient() {
    var currentUrl = new URL(window.location.href);
    var isMobileNestedRoute = currentUrl.pathname.indexOf('/m/') === 0;
    var hasRecoveryFlag = currentUrl.searchParams.has(RECOVERY_PARAM);

    try {
      await unregisterLegacyServiceWorkers();
      await clearLegacyCaches();
    } catch (error) {
      console.warn('[registerSW] legacy cleanup failed', error);
    }

    await registerRootServiceWorker();

    if (isMobileNestedRoute && !hasRecoveryFlag) {
      currentUrl.searchParams.set(RECOVERY_PARAM, Date.now().toString());
      window.location.replace(currentUrl.toString());
    }
  }

  recoverLegacyClient();
})();
