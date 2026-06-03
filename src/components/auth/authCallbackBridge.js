function decodeBase64UrlJson(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return JSON.parse(window.atob(padded));
}

export function getBridgeProviderFromState(state) {
  const [encodedPayload, signature, extra] = String(state || '').split('.');
  if (!encodedPayload || !signature || extra) {
    return '';
  }

  try {
    const payload = decodeBase64UrlJson(encodedPayload);
    const provider = String(payload?.provider || '').trim().toLowerCase();
    return ['github', 'linuxdo', 'qq'].includes(provider) ? provider : '';
  } catch {
    return '';
  }
}

export function buildBridgeCallbackForwardUrl({
  provider,
  code = '',
  state = '',
  error = '',
  errorDescription = '',
} = {}) {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  const url = new URL(`/api/auth/oauth/${normalizedProvider}/callback`, window.location.origin);
  if (code) {
    url.searchParams.set('code', code);
  }
  if (state) {
    url.searchParams.set('state', state);
  }
  if (error) {
    url.searchParams.set('error', error);
  }
  if (errorDescription) {
    url.searchParams.set('error_description', errorDescription);
  }
  return url.toString();
}
