function normalizeOrigin(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function getAppOrigin() {
  return normalizeOrigin(import.meta.env.VITE_APP_URL || window.location.origin);
}

export function isLocalBrowserOrigin(origin = window.location.origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizeOrigin(origin));
}

export function getServerlessApiOrigin() {
  const appOrigin = normalizeOrigin(import.meta.env.VITE_APP_URL);

  if (typeof window === 'undefined') {
    return appOrigin;
  }

  const currentOrigin = normalizeOrigin(window.location.origin);
  if (isLocalBrowserOrigin(currentOrigin) && appOrigin) {
    return appOrigin;
  }

  return currentOrigin;
}

export function buildServerlessApiUrl(path) {
  const normalizedPath = String(path || '').startsWith('/')
    ? String(path || '')
    : `/${String(path || '')}`;

  return `${getServerlessApiOrigin()}${normalizedPath}`;
}

export function buildPasswordResetRedirectUrl() {
  return `${getAppOrigin()}/reset-password`;
}

export default {
  buildPasswordResetRedirectUrl,
  buildServerlessApiUrl,
  getAppOrigin,
  getServerlessApiOrigin,
  isLocalBrowserOrigin,
};
