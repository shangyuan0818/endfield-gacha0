export function getAppOrigin() {
  return import.meta.env.VITE_APP_URL || window.location.origin;
}

export function buildPasswordResetRedirectUrl() {
  return `${getAppOrigin()}/reset-password`;
}

export default {
  buildPasswordResetRedirectUrl,
  getAppOrigin
};
