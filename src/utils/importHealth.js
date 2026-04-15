import { ImportStatus } from '../features/import/importShared.js';

export function evaluateImportHealth({ status, queueStatus, retryInfo, error } = {}) {
  if (status === ImportStatus.ERROR || error) {
    return {
      tone: 'error',
      key: 'import.official.health.error',
    };
  }

  if (retryInfo) {
    return {
      tone: 'warning',
      key: 'import.official.health.retrying',
    };
  }

  if (queueStatus?.queueLength > 0 || queueStatus?.isProcessing) {
    return {
      tone: 'queue',
      key: 'import.official.health.queueing',
    };
  }

  return {
    tone: 'healthy',
    key: 'import.official.health.healthy',
  };
}

export default {
  evaluateImportHealth,
};
