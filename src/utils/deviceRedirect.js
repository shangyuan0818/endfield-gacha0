import { resolvePlatformPath } from '../constants/appRoutes';

const DEVICE_REDIRECT_BYPASS_PREFIXES = ['/privacy', '/terms', '/share', '/reset-password'];

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') {
    return '/';
  }

  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
}

export function shouldBypassDeviceRedirect(pathname) {
  const normalizedPath = normalizePathname(pathname);

  return DEVICE_REDIRECT_BYPASS_PREFIXES.some((prefix) => (
    normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  ));
}

export function getDeviceRedirectTarget(pathname, shouldUseMobile) {
  const normalizedPath = normalizePathname(pathname);
  if (shouldBypassDeviceRedirect(normalizedPath)) {
    return null;
  }

  const isMobilePath = normalizedPath.startsWith('/m');
  if (shouldUseMobile && !isMobilePath) {
    return resolvePlatformPath(normalizedPath, 'mobile');
  }

  if (!shouldUseMobile && isMobilePath) {
    return resolvePlatformPath(normalizedPath, 'desktop');
  }

  return null;
}

export default {
  getDeviceRedirectTarget,
  shouldBypassDeviceRedirect
};
