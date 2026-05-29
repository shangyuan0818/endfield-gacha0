import { fetchPublicApiJson } from './publicResourceClient.js';
import { readStorageValue, STORAGE_KEYS, writeStorageValue } from '../utils/storageUtils.js';

const BOOTSTRAP_API_TIMEOUT_MS = 25000;
const BOOTSTRAP_MEMORY_TTL = 5 * 60 * 1000;
const bootstrapState = {
  data: null,
  fetchedAt: 0,
  promise: null
};

function normalizeBootstrapPayload(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};

  return {
    siteConfig: data.siteConfig && typeof data.siteConfig === 'object' ? data.siteConfig : {},
    pools: Array.isArray(data.pools) ? data.pools : []
  };
}

function readPersistedBootstrapSnapshot() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = readStorageValue(STORAGE_KEYS.PUBLIC_BOOTSTRAP_SNAPSHOT_V2, null, { raw: true });
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      data: normalizeBootstrapPayload(parsed.data),
      fetchedAt: Number(parsed.fetchedAt) || 0
    };
  } catch {
    return null;
  }
}

function writePersistedBootstrapSnapshot(data) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    writeStorageValue(STORAGE_KEYS.PUBLIC_BOOTSTRAP_SNAPSHOT_V2, JSON.stringify({
      data: normalizeBootstrapPayload(data),
      fetchedAt: Date.now()
    }), { raw: true });
  } catch {
    // 本地快照失败时静默降级
  }
}

function isFreshBootstrapCache(forceRefresh = false) {
  if (forceRefresh) {
    return false;
  }

  return bootstrapState.data !== null && Date.now() - bootstrapState.fetchedAt < BOOTSTRAP_MEMORY_TTL;
}

async function fetchBootstrapFromApi(forceRefresh = false) {
  const result = await fetchPublicApiJson('/api/bootstrap', {
    label: 'public bootstrap api',
    timeoutMs: BOOTSTRAP_API_TIMEOUT_MS,
    retries: 1,
    forceRefresh
  });

  if (!result?.data) {
    throw new Error(result?.error || 'bootstrap api returned failure');
  }

  return normalizeBootstrapPayload(result.data);
}

export async function preloadPublicBootstrap(forceRefresh = false) {
  if (isFreshBootstrapCache(forceRefresh)) {
    return bootstrapState.data;
  }

  if (!forceRefresh && bootstrapState.promise) {
    return bootstrapState.promise;
  }

  bootstrapState.promise = (async () => {
    try {
      const apiData = await fetchBootstrapFromApi(forceRefresh);
      bootstrapState.data = apiData;
      bootstrapState.fetchedAt = Date.now();
      writePersistedBootstrapSnapshot(apiData);
      return apiData;
    } catch {
      const persistedSnapshot = readPersistedBootstrapSnapshot();
      if (persistedSnapshot?.data) {
        bootstrapState.data = persistedSnapshot.data;
        bootstrapState.fetchedAt = persistedSnapshot.fetchedAt;
        return persistedSnapshot.data;
      }

      return null;
    }
  })();

  try {
    return await bootstrapState.promise;
  } finally {
    bootstrapState.promise = null;
  }
}

export function getBootstrapSnapshot() {
  if (bootstrapState.data) {
    return bootstrapState.data;
  }

  return readPersistedBootstrapSnapshot()?.data || null;
}

export async function getBootstrapSiteConfig(forceRefresh = false) {
  return (await preloadPublicBootstrap(forceRefresh))?.siteConfig || null;
}

export async function getBootstrapVisiblePools(forceRefresh = false) {
  return (await preloadPublicBootstrap(forceRefresh))?.pools || null;
}

export default {
  preloadPublicBootstrap,
  getBootstrapSnapshot,
  getBootstrapSiteConfig,
  getBootstrapVisiblePools
};
