import { appLogger } from './appLogger.js'
import { APP_FORCE_REFRESH_TOKEN } from '../constants/appMeta.js'

const RECOVERY_PARAM = '__sw_recover'
const FORCE_REFRESH_PARAM = '__force_refresh'
const FORCE_REFRESH_STORAGE_KEY = 'endfield-force-refresh-token'

function canPersistForceRefreshState() {
  const probeKey = `${FORCE_REFRESH_STORAGE_KEY}:probe`

  try {
    window.localStorage.setItem(probeKey, '1')
    window.localStorage.removeItem(probeKey)
    return true
  } catch (error) {
    return false
  }
}

function readLocalStorage(key) {
  try {
    return window.localStorage.getItem(key)
  } catch (error) {
    return null
  }
}

function writeLocalStorage(key, value) {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch (error) {
    return false
  }
}

function removeQueryParam(url, param) {
  url.searchParams.delete(param)
  return url.toString()
}

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

async function prepareReleaseForceRefresh() {
  if (!APP_FORCE_REFRESH_TOKEN) {
    return { didRecover: false, didNavigate: false, skipRecoveryRedirect: false }
  }

  if (!canPersistForceRefreshState()) {
    return { didRecover: false, didNavigate: false, skipRecoveryRedirect: false }
  }

  const currentUrl = new URL(window.location.href)
  const forceRefreshParam = currentUrl.searchParams.get(FORCE_REFRESH_PARAM)
  const isCurrentReleaseCompleted = readLocalStorage(FORCE_REFRESH_STORAGE_KEY) === APP_FORCE_REFRESH_TOKEN

  if (forceRefreshParam === APP_FORCE_REFRESH_TOKEN) {
    writeLocalStorage(FORCE_REFRESH_STORAGE_KEY, APP_FORCE_REFRESH_TOKEN)
    currentUrl.searchParams.delete(FORCE_REFRESH_PARAM)
    currentUrl.searchParams.delete(RECOVERY_PARAM)
    window.history.replaceState(null, '', currentUrl.toString())
    return { didRecover: true, didNavigate: false, skipRecoveryRedirect: true }
  }

  if (isCurrentReleaseCompleted) {
    return { didRecover: false, didNavigate: false, skipRecoveryRedirect: false }
  }

  const didRecover = await recoverLegacyServiceWorkers()

  currentUrl.searchParams.set(FORCE_REFRESH_PARAM, APP_FORCE_REFRESH_TOKEN)
  currentUrl.searchParams.set(RECOVERY_PARAM, Date.now().toString())
  window.location.replace(currentUrl.toString())

  return { didRecover, didNavigate: true, skipRecoveryRedirect: true }
}

export async function prepareFreshNavigation() {
  const forceRefreshResult = await prepareReleaseForceRefresh()
  if (forceRefreshResult.didNavigate) {
    return forceRefreshResult
  }

  const didRecover = forceRefreshResult.didRecover || await recoverLegacyServiceWorkers()
  if (!didRecover) {
    return { didRecover: false, didNavigate: false }
  }

  if (forceRefreshResult.skipRecoveryRedirect) {
    return { didRecover: true, didNavigate: false }
  }

  const currentUrl = new URL(window.location.href)
  if (currentUrl.searchParams.has(RECOVERY_PARAM)) {
    window.history.replaceState(null, '', removeQueryParam(currentUrl, RECOVERY_PARAM))
    return { didRecover: true, didNavigate: false }
  }

  currentUrl.searchParams.set(RECOVERY_PARAM, Date.now().toString())
  window.location.replace(currentUrl.toString())
  return { didRecover: true, didNavigate: true }
}
