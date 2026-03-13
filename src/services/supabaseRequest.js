const DEV_READ_TIMEOUT_MS = 45000;
const DEV_RPC_TIMEOUT_MS = 60000;
const DEV_MUTATION_TIMEOUT_MS = 40000;
const PROD_READ_TIMEOUT_MS = 35000;
const PROD_RPC_TIMEOUT_MS = 45000;
const PROD_MUTATION_TIMEOUT_MS = 30000;
const IS_DEV = Boolean(import.meta.env?.DEV);

export const SUPABASE_READ_TIMEOUT_MS = IS_DEV ? DEV_READ_TIMEOUT_MS : PROD_READ_TIMEOUT_MS;
export const SUPABASE_RPC_TIMEOUT_MS = IS_DEV ? DEV_RPC_TIMEOUT_MS : PROD_RPC_TIMEOUT_MS;
export const SUPABASE_MUTATION_TIMEOUT_MS = IS_DEV ? DEV_MUTATION_TIMEOUT_MS : PROD_MUTATION_TIMEOUT_MS;

function wait(ms) {
  return new Promise(resolve => {
    window.setTimeout(resolve, ms);
  });
}

function createClientTimeoutError(label, timeoutMs) {
  const error = new Error(`${label} timed out after ${timeoutMs}ms`);
  error.code = 'CLIENT_TIMEOUT';
  error.name = 'TimeoutError';
  return error;
}

export function isRetryableSupabaseError(error) {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();

  return (
    error?.code === 'CLIENT_TIMEOUT' ||
    error?.code === '57014' ||
    error?.name === 'AbortError' ||
    error?.name === 'TimeoutError' ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('networkerror')
  );
}

async function executeWithTimeout(buildRequest, {
  label,
  timeoutMs,
  retries = 0,
  retryDelayMs = 1500,
} = {}) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => abortController.abort(), timeoutMs);

    try {
      let request = buildRequest();
      if (typeof request?.abortSignal === 'function') {
        request = request.abortSignal(abortController.signal);
      }

      return await request;
    } catch (error) {
      lastError = error?.name === 'AbortError'
        ? createClientTimeoutError(label || 'supabase request', timeoutMs)
        : error;

      if (attempt >= retries || !isRetryableSupabaseError(lastError)) {
        throw lastError;
      }

      await wait(retryDelayMs * (attempt + 1));
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw lastError || createClientTimeoutError(label || 'supabase request', timeoutMs);
}

export async function executeSupabaseRead(buildRequest, options = {}) {
  return executeWithTimeout(buildRequest, {
    timeoutMs: SUPABASE_READ_TIMEOUT_MS,
    retries: 1,
    ...options,
  });
}

export async function executeSupabaseRpc(buildRequest, options = {}) {
  return executeWithTimeout(buildRequest, {
    timeoutMs: SUPABASE_RPC_TIMEOUT_MS,
    retries: 1,
    ...options,
  });
}

export async function executeSupabaseMutation(buildRequest, options = {}) {
  return executeWithTimeout(buildRequest, {
    timeoutMs: SUPABASE_MUTATION_TIMEOUT_MS,
    retries: 0,
    ...options,
  });
}

export async function fetchWithTimeout(input, init = {}, {
  label = 'fetch request',
  timeoutMs = SUPABASE_READ_TIMEOUT_MS,
  retries = 0,
  retryDelayMs = 1500,
} = {}) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: abortController.signal,
      });
      return response;
    } catch (error) {
      lastError = error?.name === 'AbortError'
        ? createClientTimeoutError(label, timeoutMs)
        : error;

      if (attempt >= retries || !isRetryableSupabaseError(lastError)) {
        throw lastError;
      }

      await wait(retryDelayMs * (attempt + 1));
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw lastError || createClientTimeoutError(label, timeoutMs);
}

export default {
  SUPABASE_READ_TIMEOUT_MS,
  SUPABASE_RPC_TIMEOUT_MS,
  SUPABASE_MUTATION_TIMEOUT_MS,
  executeSupabaseRead,
  executeSupabaseRpc,
  executeSupabaseMutation,
  fetchWithTimeout,
  isRetryableSupabaseError,
};
