import { appLogger } from './appLogger.js';

let installed = false;

function normalizeRuntimeError(event) {
  if (!event) {
    return { message: 'Unknown runtime error' };
  }

  if (event instanceof ErrorEvent) {
    return {
      message: event.message || event.error?.message || 'Runtime error',
      filename: event.filename || null,
      lineno: event.lineno || null,
      colno: event.colno || null,
      stack: event.error?.stack || null,
    };
  }

  if (event instanceof PromiseRejectionEvent) {
    const reason = event.reason;
    return {
      message: reason?.message || String(reason || 'Unhandled promise rejection'),
      stack: reason?.stack || null,
    };
  }

  return {
    message: String(event),
  };
}

export function installRuntimeObservability() {
  if (installed || typeof window === 'undefined') {
    return;
  }

  const handleError = (event) => {
    appLogger.error('[runtime-observability] window.error', normalizeRuntimeError(event));
  };

  const handleRejection = (event) => {
    appLogger.error('[runtime-observability] window.unhandledrejection', normalizeRuntimeError(event));
  };

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);
  installed = true;
}

export default {
  installRuntimeObservability,
};
