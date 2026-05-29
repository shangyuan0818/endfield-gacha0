const DRAFT_STORAGE_KEY = 'endfield_pending_import_draft_v1';
const DRAFT_VERSION = 1;
const DEFAULT_TTL_MS = 30 * 60 * 1000;

function getSessionStorage() {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }
  return window.sessionStorage;
}

function toTimestamp(value, fallback = Date.now()) {
  const parsed = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePendingImport(pendingImport) {
  if (!pendingImport?.data || typeof pendingImport.data !== 'object') {
    return null;
  }

  return {
    data: pendingImport.data,
    willSyncToCloud: pendingImport.willSyncToCloud === true,
    stats: pendingImport.stats || null,
    sourceFile: pendingImport.sourceFile || null,
    createdAt: pendingImport.createdAt || new Date().toISOString(),
  };
}

export function buildPendingImportDraft(pendingImport, options = {}) {
  const now = toTimestamp(options.now);
  const normalized = normalizePendingImport(pendingImport);
  if (!normalized) {
    return null;
  }

  return {
    version: DRAFT_VERSION,
    savedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + (options.ttlMs || DEFAULT_TTL_MS)).toISOString(),
    pendingImport: normalized,
  };
}

export function savePendingImportDraft(pendingImport, options = {}) {
  const storage = options.storage || getSessionStorage();
  if (!storage) {
    return { saved: false, reason: 'storage_unavailable' };
  }

  const draft = buildPendingImportDraft(pendingImport, options);
  if (!draft) {
    return { saved: false, reason: 'invalid_pending_import' };
  }

  try {
    storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    return {
      saved: true,
      key: DRAFT_STORAGE_KEY,
      expiresAt: draft.expiresAt,
    };
  } catch (error) {
    return {
      saved: false,
      reason: 'storage_write_failed',
      error,
    };
  }
}

export function clearPendingImportDraft(options = {}) {
  const storage = options.storage || getSessionStorage();
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(DRAFT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function loadPendingImportDraft(options = {}) {
  const storage = options.storage || getSessionStorage();
  if (!storage) {
    return { pendingImport: null, reason: 'storage_unavailable' };
  }

  let raw = null;
  try {
    raw = storage.getItem(DRAFT_STORAGE_KEY);
  } catch (error) {
    return { pendingImport: null, reason: 'storage_read_failed', error };
  }

  if (!raw) {
    return { pendingImport: null, reason: 'missing' };
  }

  let draft = null;
  try {
    draft = JSON.parse(raw);
  } catch (error) {
    clearPendingImportDraft({ storage });
    return { pendingImport: null, reason: 'invalid_json', error };
  }

  if (draft?.version !== DRAFT_VERSION || !draft?.pendingImport?.data) {
    clearPendingImportDraft({ storage });
    return { pendingImport: null, reason: 'invalid_shape' };
  }

  const now = toTimestamp(options.now);
  const expiresAt = toTimestamp(draft.expiresAt, 0);
  if (expiresAt <= now) {
    clearPendingImportDraft({ storage });
    return {
      pendingImport: null,
      expired: true,
      reason: 'expired',
      expiresAt: draft.expiresAt,
    };
  }

  return {
    pendingImport: {
      ...draft.pendingImport,
      restoredFromDraft: true,
      draftSavedAt: draft.savedAt,
      draftExpiresAt: draft.expiresAt,
    },
    reason: 'restored',
    savedAt: draft.savedAt,
    expiresAt: draft.expiresAt,
  };
}

export {
  DRAFT_STORAGE_KEY,
  DRAFT_VERSION,
  DEFAULT_TTL_MS,
};
