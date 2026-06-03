export const AUTH_SESSION_SYNC_EVENT = 'endfield:auth-session-sync';

export function emitAuthSessionSync(detail = {}) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return false;
  }

  window.dispatchEvent(new CustomEvent(AUTH_SESSION_SYNC_EVENT, {
    detail: {
      source: 'unknown',
      ...detail,
      emittedAt: Date.now(),
    },
  }));
  return true;
}

export function subscribeAuthSessionSync(listener) {
  if (
    typeof window === 'undefined'
    || typeof window.addEventListener !== 'function'
    || typeof listener !== 'function'
  ) {
    return () => {};
  }

  window.addEventListener(AUTH_SESSION_SYNC_EVENT, listener);
  return () => {
    window.removeEventListener(AUTH_SESSION_SYNC_EVENT, listener);
  };
}
