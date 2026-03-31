const RECOVERY_PARAM = '__sw_recover';
const LEGACY_CACHE_NAMES = ['js-assets', 'js-css-assets', 'static-assets', 'api-bootstrap', 'api-stats'];

function isLegacyScope(scopeUrl) {
  try {
    const scopePath = new URL(scopeUrl).pathname;
    return scopePath === '/' || scopePath === '/m/' || scopePath.indexOf('/m/') === 0;
  } catch (error) {
    return true;
  }
}

async function unregisterLegacyServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((registration) => isLegacyScope(registration.scope))
      .map((registration) => registration.unregister())
  );
}

async function clearLegacyCaches() {
  if (!('caches' in window)) return;

  const cacheKeys = await caches.keys();
  const legacyCacheKeys = cacheKeys.filter((cacheKey) => {
    return cacheKey.indexOf('workbox-precache') === 0
      || LEGACY_CACHE_NAMES.indexOf(cacheKey) >= 0
      || cacheKey.indexOf('/m/') >= 0;
  });

  await Promise.all(legacyCacheKeys.map((cacheKey) => caches.delete(cacheKey)));
}

async function registerRootServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (error) {
    console.warn('[legacy-mobile-entry] root service worker registration failed', error);
  }
}

async function recoverLegacyMobileRoute() {
  const currentUrl = new URL(window.location.href);
  const hasRecoveryFlag = currentUrl.searchParams.has(RECOVERY_PARAM);

  await unregisterLegacyServiceWorkers();
  await clearLegacyCaches();
  await registerRootServiceWorker();

  if (!hasRecoveryFlag) {
    currentUrl.searchParams.set(RECOVERY_PARAM, Date.now().toString());
    window.location.replace(currentUrl.toString());
    return;
  }

  window.location.replace('/m');
}

recoverLegacyMobileRoute().catch((error) => {
  console.warn('[legacy-mobile-entry] recovery failed', error);
  window.location.replace('/m');
});
