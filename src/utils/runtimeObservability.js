import { appLogger } from './appLogger.js';
import {
  isLikelyFatalRuntimeError,
  normalizeCrashError,
  renderAppCrashFallback,
} from './appCrashFallback.js';

let installed = false;

export function installRuntimeObservability() {
  if (installed || typeof window === 'undefined') {
    return;
  }

  const handleError = (event) => {
    appLogger.error('[runtime-observability] window.error', normalizeCrashError(event));

    if (isLikelyFatalRuntimeError(event)) {
      renderAppCrashFallback(event, { phase: 'runtime' });
    }
  };

  const handleRejection = (event) => {
    appLogger.error('[runtime-observability] window.unhandledrejection', normalizeCrashError(event));

    if (isLikelyFatalRuntimeError(event)) {
      renderAppCrashFallback(event, { phase: 'runtime' });
    }
  };

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);
  installed = true;
}

export default {
  installRuntimeObservability,
};
