import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseAccessToken } from '../../authFetchService.js';
import { fetchJsonWithTimeout } from '../../supabaseRequest.js';
import {
  batchDeleteCharacters,
  batchUpdateCharacterAvatars,
  batchUpdateCharacters,
  buildManualPlaceholderLookup,
  loadCharacters,
  resolveSyncCanonicalId,
  saveCharacter,
  syncFromAPI,
} from '../characterService.js';
import { syncAllCharacters, syncAllWeapons } from '../../../utils/endfieldDataSync.js';
import { characterCache } from '../../../utils/characterUtils.js';

vi.mock('../../authFetchService.js', () => ({
  getSupabaseAccessToken: vi.fn(),
}));

vi.mock('../../supabaseRequest.js', () => ({
  fetchJsonWithTimeout: vi.fn(),
}));

vi.mock('../../../utils/endfieldDataSync.js', () => ({
  syncAllCharacters: vi.fn(),
  syncAllWeapons: vi.fn(),
}));

vi.mock('../../../utils/characterUtils.js', () => ({
  characterCache: {
    refresh: vi.fn(),
  },
}));

describe('characterService sync canonical id helpers', () => {
  it('resolves wiki items to same-name manual placeholders before creating new rows', () => {
    const manualPlaceholderLookup = buildManualPlaceholderLookup([
      { id: 'char_manual_test_operator_abc123', name: '测试干员', type: 'character' },
      { id: 'weapon_manual_test_weapon_def456', name: '测试武器', type: 'weapon' },
      { id: 'char_official_existing', name: '已有官方项', type: 'character' },
    ]);

    expect(manualPlaceholderLookup.get('character:测试干员')).toBe('char_manual_test_operator_abc123');
    expect(manualPlaceholderLookup.get('weapon:测试武器')).toBe('weapon_manual_test_weapon_def456');

    expect(resolveSyncCanonicalId({
      item: { id: 'char_wiki_new', name: '测试干员', type: 'character' },
      wikiAliasMap: new Map(),
      existingIdSet: new Set(['char_manual_test_operator_abc123']),
      manualPlaceholderLookup,
    })).toBe('char_manual_test_operator_abc123');

    expect(resolveSyncCanonicalId({
      item: { id: 'weapon_wiki_new', name: '测试武器', type: 'weapon' },
      wikiAliasMap: new Map(),
      existingIdSet: new Set(['weapon_manual_test_weapon_def456']),
      manualPlaceholderLookup,
    })).toBe('weapon_manual_test_weapon_def456');
  });

  it('prefers explicit wiki aliases and existing wiki ids over name-based placeholders', () => {
    const manualPlaceholderLookup = buildManualPlaceholderLookup([
      { id: 'char_manual_test_operator_abc123', name: '测试干员', type: 'character' },
    ]);

    expect(resolveSyncCanonicalId({
      item: { id: 'char_wiki_new', name: '测试干员', type: 'character' },
      wikiAliasMap: new Map([['char_wiki_new', 'char_official_canonical']]),
      existingIdSet: new Set(['char_official_canonical']),
      manualPlaceholderLookup,
    })).toBe('char_official_canonical');

    expect(resolveSyncCanonicalId({
      item: { id: 'char_wiki_new', name: '测试干员', type: 'character' },
      wikiAliasMap: new Map(),
      existingIdSet: new Set(['char_wiki_new']),
      manualPlaceholderLookup,
    })).toBe('char_wiki_new');
  });
});

describe('characterService same-origin API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAccessToken.mockResolvedValue(null);
    fetchJsonWithTimeout.mockResolvedValue({
      response: {
        ok: true,
        status: 200,
      },
      data: {
        success: true,
        data: [
          {
            id: 'char-1',
            name: '测试角色',
          },
        ],
      },
    });
  });

  it('loads characters with same-origin cookies when no native token exists', async () => {
    await expect(loadCharacters()).resolves.toEqual({
      data: [
        {
          id: 'char-1',
          name: '测试角色',
        },
      ],
      error: null,
    });

    expect(getSupabaseAccessToken).toHaveBeenCalledWith({
      syncSiteSession: false,
      useSiteSessionCache: true,
      allowSiteSessionToken: false,
    });
    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/admin-characters?mode=characters', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    }, expect.objectContaining({
      label: 'admin-characters-load',
    }));
  });

  it('uses a native Supabase token when one is available', async () => {
    getSupabaseAccessToken.mockResolvedValue('native-token');

    await loadCharacters();

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/admin-characters?mode=characters', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer native-token',
      },
    }, expect.any(Object));
  });

  it('saves and deletes characters through the same-origin admin route', async () => {
    await expect(saveCharacter(
      { id: 'char-1', name: '测试角色' },
      { id: 'char-1' }
    )).resolves.toEqual({
      success: true,
      error: null,
    });
    await expect(batchDeleteCharacters(['char-1', 'char-2'])).resolves.toEqual({
      success: true,
      error: null,
    });

    expect(fetchJsonWithTimeout).toHaveBeenNthCalledWith(1, '/api/admin-characters', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        action: 'saveCharacter',
        characterData: { id: 'char-1', name: '测试角色' },
        existingCharacter: { id: 'char-1' },
      }),
    }), expect.objectContaining({
      label: 'admin-character-save',
    }));
    expect(fetchJsonWithTimeout).toHaveBeenNthCalledWith(2, '/api/admin-characters', expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({
        characterIds: ['char-1', 'char-2'],
      }),
    }), expect.objectContaining({
      label: 'admin-character-delete',
    }));
  });

  it('updates batch fields and avatars through the same-origin admin route', async () => {
    fetchJsonWithTimeout
      .mockResolvedValueOnce({
        response: { ok: true, status: 200 },
        data: {
          success: true,
          updateCount: 2,
        },
      })
      .mockResolvedValueOnce({
        response: { ok: true, status: 200 },
        data: {
          success: true,
          updateCount: 1,
          errorCount: 0,
        },
      });

    await expect(batchUpdateCharacters(['char-1'], {
      is_limited: true,
      pools: { limited: true },
    })).resolves.toMatchObject({
      success: true,
      updateCount: 2,
    });
    await expect(batchUpdateCharacterAvatars([
      { id: 'char-1', avatar_url: '/avatar.webp' },
    ])).resolves.toMatchObject({
      success: true,
      updateCount: 1,
      errorCount: 0,
    });

    expect(characterCache.refresh).toHaveBeenCalledTimes(1);
    expect(fetchJsonWithTimeout).toHaveBeenNthCalledWith(1, '/api/admin-characters', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        action: 'batchUpdateCharacters',
        characterIds: ['char-1'],
        batchEditForm: {
          is_limited: true,
          pools: { limited: true },
        },
      }),
    }), expect.objectContaining({
      label: 'admin-character-batch-update',
    }));
    expect(fetchJsonWithTimeout).toHaveBeenNthCalledWith(2, '/api/admin-characters', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        action: 'batchUpdateCharacterAvatars',
        avatarUpdates: [
          { id: 'char-1', avatar_url: '/avatar.webp' },
        ],
      }),
    }), expect.objectContaining({
      label: 'admin-character-avatar-update',
    }));
  });

  it('fetches wiki data in the browser and delegates all database sync to the admin route', async () => {
    syncAllCharacters.mockResolvedValue({
      characters: [
        {
          id: 'char_wiki',
          name: '测试角色',
          rarity: 6,
        },
      ],
      warning: '角色缓存提示',
    });
    syncAllWeapons.mockResolvedValue({
      weapons: [
        {
          id: 'weapon_wiki',
          name: '测试武器',
          rarity: 6,
          _iconId: 'weapon_icon',
        },
      ],
      warning: null,
    });
    fetchJsonWithTimeout.mockResolvedValue({
      response: { ok: true, status: 200 },
      data: {
        success: true,
        newCount: 1,
        skippedCount: 1,
        errorCount: 0,
        avatarCount: 0,
        avatarFailedCount: 0,
        warnings: ['服务端提示'],
      },
    });
    const progress = vi.fn();

    await expect(syncFromAPI({
      onProgress: progress,
      existingIds: ['char_existing'],
    })).resolves.toMatchObject({
      success: true,
      newCount: 1,
      skippedCount: 1,
      warnings: ['服务端提示'],
    });

    expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/admin-characters', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        action: 'syncWikiItems',
        items: [
          {
            id: 'char_wiki',
            name: '测试角色',
            rarity: 6,
            type: 'character',
          },
          {
            id: 'weapon_wiki',
            name: '测试武器',
            rarity: 6,
            _iconId: 'weapon_icon',
            type: 'weapon',
          },
        ],
        existingIds: ['char_existing'],
        warnings: ['角色缓存提示'],
      }),
    }), expect.objectContaining({
      label: 'admin-character-sync-wiki',
      retries: 0,
    }));
    expect(characterCache.refresh).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenCalledWith('正在更新数据库 (2 项)...');
  });

  it('returns readable failures when the admin route rejects the request', async () => {
    fetchJsonWithTimeout.mockResolvedValue({
      response: {
        ok: false,
        status: 403,
      },
      data: {
        success: false,
        error: 'Super admin role required',
      },
    });

    await expect(loadCharacters()).resolves.toMatchObject({
      data: null,
      error: expect.objectContaining({
        message: 'Super admin role required',
      }),
    });
  });
});
