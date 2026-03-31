import { appLogger } from './appLogger.js'

const RECOVERY_PARAM = '__sw_recover'

function isLegacyScope(scopeUrl) {
  try {
    const scopePath = new URL(scopeUrl).pathname
    return scopePath === '/' || scopePath === '/m/' || scopePath.startsWith('/m/')
  } catch (error) {
    return true
  }
}

async function unregisterLegacyRegistrations() {
  if (!('serviceWorker' in navigator)) {
    return false
  }

  const registrations = await navigator.serviceWorker.getRegistrations()
  const legacyRegistrations = registrations.filter((registration) => isLegacyScope(registration.scope))

  if (legacyRegistrations.length === 0) {
    return false
  }

  await Promise.all(legacyRegistrations.map((registration) => registration.unregister()))
  return true
}

async function clearLegacyCaches() {
  if (!('caches' in window)) {
    return false
  }

  const cacheKeys = await caches.keys()
  if (cacheKeys.length === 0) {
    return false
  }

  await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)))
  return true
}

export async function recoverLegacyServiceWorkers() {
  try {
    const [didUnregister, didClearCaches] = await Promise.all([
      unregisterLegacyRegistrations(),
      clearLegacyCaches()
    ])

    return didUnregister || didClearCaches
  } catch (error) {
    appLogger.warn('旧版 Service Worker 清理失败，将继续启动应用:', error)
    return false
  }
}

export async function prepareFreshNavigation() {
  const didRecover = await recoverLegacyServiceWorkers()
  if (!didRecover) {
    return { didRecover: false, didNavigate: false }
  }

  const currentUrl = new URL(window.location.href)
  if (currentUrl.searchParams.has(RECOVERY_PARAM)) {
    return { didRecover: true, didNavigate: false }
  }

  currentUrl.searchParams.set(RECOVERY_PARAM, Date.now().toString())
  window.location.replace(currentUrl.toString())
  return { didRecover: true, didNavigate: true }
}
