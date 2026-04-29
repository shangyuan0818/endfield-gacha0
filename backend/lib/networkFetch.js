const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 350;

const RETRYABLE_NETWORK_CODES = new Set([
  'EAI_AGAIN',
  'ENOTFOUND',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getNetworkErrorCode(error) {
  return error?.cause?.code
    || error?.code
    || error?.cause?.cause?.code
    || '';
}

export function isRetryableNetworkError(error) {
  return RETRYABLE_NETWORK_CODES.has(getNetworkErrorCode(error));
}

export function describeNetworkError(error) {
  const code = getNetworkErrorCode(error) || 'UNKNOWN';
  const hostname = error?.cause?.hostname || error?.hostname || '';
  const message = error?.message || String(error);
  return hostname ? `${message} (${code}, host=${hostname})` : `${message} (${code})`;
}

export async function fetchWithNetworkRetry(input, init, options = {}) {
  const {
    label = 'fetch',
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
  } = options;

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (!isRetryableNetworkError(error) || attempt >= maxAttempts) {
        throw error;
      }

      const delayMs = baseDelayMs * attempt;
      console.warn(
        `[NetworkFetch] ${label} failed (${describeNetworkError(error)}), retrying ${attempt + 1}/${maxAttempts} in ${delayMs}ms`
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}
