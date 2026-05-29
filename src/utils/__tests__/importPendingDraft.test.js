import { describe, expect, it, vi } from 'vitest';

import {
  DRAFT_STORAGE_KEY,
  buildPendingImportDraft,
  clearPendingImportDraft,
  loadPendingImportDraft,
  savePendingImportDraft,
} from '../importPendingDraft.js';

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn((key, value) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn((key) => {
      store.delete(key);
    }),
  };
}

function buildPendingImport(overrides = {}) {
  return {
    data: {
      sourceFormatId: 'internal_json_v3',
      sourceFormatLabel: '站内 JSON',
      pools: [{ id: 'special_test', name: '测试卡池', type: 'limited' }],
      history: [{
        id: 'record-1',
        poolId: 'special_test',
        name: '测试干员',
        rarity: 6,
        timestamp: '2026-05-24T12:00:00.000Z',
      }],
      accounts: [{ gameUid: '123456789', nickName: '测试账号' }],
    },
    willSyncToCloud: true,
    stats: {
      poolCount: 1,
      historyCount: 1,
      accountCount: 1,
    },
    sourceFile: {
      name: 'import.json',
      size: 2048,
      type: 'application/json',
      lastModified: 1770000000000,
    },
    createdAt: '2026-05-24T12:00:00.000Z',
    ...overrides,
  };
}

describe('importPendingDraft', () => {
  it('builds a versioned session draft with expiry metadata', () => {
    const draft = buildPendingImportDraft(buildPendingImport(), {
      now: Date.parse('2026-05-24T12:00:00.000Z'),
      ttlMs: 60_000,
    });

    expect(draft).toMatchObject({
      version: 1,
      savedAt: '2026-05-24T12:00:00.000Z',
      expiresAt: '2026-05-24T12:01:00.000Z',
      pendingImport: {
        willSyncToCloud: true,
        stats: { historyCount: 1 },
        sourceFile: { name: 'import.json' },
      },
    });
    expect(draft.pendingImport.data.history).toHaveLength(1);
  });

  it('saves, restores, and clears a valid draft', () => {
    const storage = createMemoryStorage();
    const pendingImport = buildPendingImport();

    expect(savePendingImportDraft(pendingImport, {
      storage,
      now: Date.parse('2026-05-24T12:00:00.000Z'),
      ttlMs: 60_000,
    })).toMatchObject({ saved: true, key: DRAFT_STORAGE_KEY });

    const restored = loadPendingImportDraft({
      storage,
      now: Date.parse('2026-05-24T12:00:30.000Z'),
    });

    expect(restored).toMatchObject({
      reason: 'restored',
      pendingImport: {
        restoredFromDraft: true,
        draftSavedAt: '2026-05-24T12:00:00.000Z',
        draftExpiresAt: '2026-05-24T12:01:00.000Z',
      },
    });
    expect(restored.pendingImport.data.accounts[0].nickName).toBe('测试账号');

    expect(clearPendingImportDraft({ storage })).toBe(true);
    expect(loadPendingImportDraft({ storage })).toMatchObject({ reason: 'missing' });
  });

  it('drops expired, malformed, and invalid drafts', () => {
    const expiredStorage = createMemoryStorage();
    savePendingImportDraft(buildPendingImport(), {
      storage: expiredStorage,
      now: Date.parse('2026-05-24T12:00:00.000Z'),
      ttlMs: 1_000,
    });

    expect(loadPendingImportDraft({
      storage: expiredStorage,
      now: Date.parse('2026-05-24T12:00:02.000Z'),
    })).toMatchObject({ reason: 'expired', expired: true, pendingImport: null });
    expect(expiredStorage.removeItem).toHaveBeenCalledWith(DRAFT_STORAGE_KEY);

    const malformedStorage = createMemoryStorage();
    malformedStorage.setItem(DRAFT_STORAGE_KEY, '{bad json');
    expect(loadPendingImportDraft({ storage: malformedStorage })).toMatchObject({
      reason: 'invalid_json',
      pendingImport: null,
    });
    expect(malformedStorage.removeItem).toHaveBeenCalledWith(DRAFT_STORAGE_KEY);

    const invalidStorage = createMemoryStorage();
    invalidStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ version: 999, pendingImport: {} }));
    expect(loadPendingImportDraft({ storage: invalidStorage })).toMatchObject({
      reason: 'invalid_shape',
      pendingImport: null,
    });
    expect(invalidStorage.removeItem).toHaveBeenCalledWith(DRAFT_STORAGE_KEY);
  });

  it('refuses invalid pending imports without writing storage', () => {
    const storage = createMemoryStorage();

    expect(savePendingImportDraft({ data: null }, { storage })).toMatchObject({
      saved: false,
      reason: 'invalid_pending_import',
    });
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
