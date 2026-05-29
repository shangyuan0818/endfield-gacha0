export const PUBLIC_CACHE_EPOCH_KEY = 'public_cache_epoch';
export const PUBLIC_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=3600';
export const NO_STORE_CACHE_CONTROL = 'no-store';

const DEFAULT_CACHE_VERSION = '0';

export function createPublicCacheStore() {
  return {
    entries: new Map(),
    inFlight: new Map(),
  };
}

export function normalizeCacheVersion(value, fallback = DEFAULT_CACHE_VERSION) {
  if (value == null) return fallback;

  if (typeof value === 'object') {
    if (value.version != null) return String(value.version);
    if (value.updatedAt != null) return String(value.updatedAt);
    return JSON.stringify(value);
  }

  const normalized = String(value).trim();
  if (!normalized) return fallback;

  try {
    const parsed = JSON.parse(normalized);
    if (parsed && typeof parsed === 'object') {
      return normalizeCacheVersion(parsed, fallback);
    }
  } catch {
    // Non-JSON string values are valid opaque cache versions.
  }

  return normalized;
}

export async function resolvePublicCacheVersion(supabase, {
  requestVersion = null,
  fallback = DEFAULT_CACHE_VERSION,
} = {}) {
  if (!supabase) {
    return normalizeCacheVersion(requestVersion, fallback);
  }

  try {
    const { data, error } = await supabase
      .from('site_config')
      .select('value')
      .eq('key', PUBLIC_CACHE_EPOCH_KEY)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return normalizeCacheVersion(data?.value, normalizeCacheVersion(requestVersion, fallback));
  } catch {
    return normalizeCacheVersion(requestVersion, fallback);
  }
}

export async function bumpPublicCacheEpoch(supabase, {
  scope = 'public',
  reason = 'manual',
} = {}) {
  if (!supabase) {
    return { ok: false, error: 'Supabase admin client is not configured' };
  }

  const nowIso = new Date().toISOString();
  const version = String(Date.now());
  const value = JSON.stringify({
    version,
    scope,
    reason,
    updatedAt: nowIso,
  });

  const { error } = await supabase
    .from('site_config')
    .upsert({
      key: PUBLIC_CACHE_EPOCH_KEY,
      value,
      label: '公共缓存版本',
      category: 'system',
      updated_at: nowIso,
    }, {
      onConflict: 'key',
    });

  if (error) {
    return { ok: false, error: error.message || 'Failed to bump public cache epoch' };
  }

  return {
    ok: true,
    version,
    updatedAt: nowIso,
    scope,
    reason,
  };
}

function isUnavailableRpcError(error) {
  if (!error) {
    return false;
  }

  const code = String(error.code || '').trim();
  const message = String(error.message || error.details || '').toLowerCase();
  return ['42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code)
    || message.includes('refresh_public_analytics_cache')
    || message.includes('could not find the function')
    || message.includes('function public.refresh_public_analytics_cache')
    || message.includes('schema cache');
}

function normalizeRefreshResult(data, functionName) {
  const payload = data && typeof data === 'object' ? data : {};
  return {
    functionName,
    raw: payload,
    refreshedPools: Number(payload.refreshedPools ?? payload.pool?.refreshedPools ?? 0),
    refreshedTrendRows: Number(payload.refreshedTrendRows ?? payload.trends?.refreshedTrendRows ?? 0),
    updatedAt: payload.updatedAt || payload.pool?.updatedAt || payload.trends?.updatedAt || null,
  };
}

export async function refreshPublicAnalyticsCache(supabase, {
  reason = 'manual',
} = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    return {
      ok: false,
      reason,
      error: 'Supabase admin RPC client is not configured',
      attempts: [],
    };
  }

  const attempts = [];
  const callRpc = async (functionName) => {
    const { data, error } = await supabase.rpc(functionName);
    attempts.push({
      functionName,
      ok: !error,
      ...(error ? { error: error.message || String(error) } : {}),
    });

    if (error) {
      throw error;
    }

    return data;
  };

  try {
    const data = await callRpc('refresh_public_analytics_cache');
    return {
      ok: true,
      reason,
      ...normalizeRefreshResult(data, 'refresh_public_analytics_cache'),
      attempts,
    };
  } catch (error) {
    if (!isUnavailableRpcError(error)) {
      return {
        ok: false,
        reason,
        error: error?.message || 'Failed to refresh public analytics cache',
        attempts,
      };
    }
  }

  try {
    const data = await callRpc('refresh_public_pool_analytics_cache');
    return {
      ok: true,
      reason,
      partial: true,
      warning: 'public_analytics_wrapper_unavailable',
      ...normalizeRefreshResult(data, 'refresh_public_pool_analytics_cache'),
      attempts,
    };
  } catch (error) {
    return {
      ok: false,
      reason,
      error: error?.message || 'Failed to refresh public analytics cache',
      attempts,
    };
  }
}

export function readRequestCacheVersion(req) {
  if (req?.query?.v != null) {
    return req.query.v;
  }

  try {
    return new URL(req?.url || '', 'https://example.com').searchParams.get('v');
  } catch {
    return null;
  }
}

export function buildPublicCacheKey(parts = []) {
  return parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(':') || 'public';
}

function getAgeSeconds(lastFetch) {
  const fetchedAt = Number(lastFetch) || 0;
  if (!fetchedAt) return null;
  return Math.max(0, Math.floor((Date.now() - fetchedAt) / 1000));
}

export function buildPublicCacheMeta({
  cacheKey,
  cacheVersion,
  source,
  partial = false,
  stale = false,
  lastFetch = 0,
} = {}) {
  return {
    source: source || 'origin',
    age: getAgeSeconds(lastFetch),
    partial: Boolean(partial),
    stale: Boolean(stale),
    cacheKey: cacheKey || null,
    cacheVersion: normalizeCacheVersion(cacheVersion),
  };
}

export function sendPublicJson(res, {
  status = 200,
  data,
  cached = false,
  partial = false,
  stale = false,
  source = null,
  cacheKey = null,
  cacheVersion = DEFAULT_CACHE_VERSION,
  lastFetch = 0,
  message = null,
  error = null,
} = {}) {
  const payload = {
    success: true,
    cached: Boolean(cached),
    partial: Boolean(partial),
    data,
    meta: buildPublicCacheMeta({
      cacheKey,
      cacheVersion,
      source: source || (cached ? 'memory-cache' : 'origin'),
      partial,
      stale,
      lastFetch,
    }),
  };

  if (message) payload.message = message;
  if (error) payload.error = error;

  return res.status(status).json(payload);
}

export async function getOrSetPublicCacheEntry(store, {
  cacheKey,
  ttlMs,
  fetcher,
} = {}) {
  if (!store || !cacheKey || typeof fetcher !== 'function') {
    throw new Error('Invalid public cache options');
  }

  const now = Date.now();
  const cached = store.entries.get(cacheKey);
  if (cached && now - cached.lastFetch < ttlMs) {
    return {
      entry: cached,
      cached: true,
      stale: false,
    };
  }

  if (store.inFlight.has(cacheKey)) {
    return store.inFlight.get(cacheKey);
  }

  const promise = (async () => {
    const previousPayload = cached?.payload;
    const result = await fetcher(previousPayload);
    const entry = {
      payload: result.payload,
      partial: Boolean(result.partial),
      lastFetch: Date.now(),
    };
    store.entries.set(cacheKey, entry);
    return {
      entry,
      cached: false,
      stale: false,
    };
  })().finally(() => {
    store.inFlight.delete(cacheKey);
  });

  store.inFlight.set(cacheKey, promise);
  return promise;
}

export function getStalePublicCacheEntry(store, cacheKey) {
  const entry = store?.entries?.get(cacheKey);
  if (!entry) return null;
  return {
    entry,
    cached: true,
    stale: true,
  };
}
