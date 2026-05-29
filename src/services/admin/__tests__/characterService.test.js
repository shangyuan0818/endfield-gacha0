import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../supabaseClient.js', () => ({
  supabase: null,
}));

vi.mock('../../../utils/endfieldDataSync.js', () => ({
  syncAllCharacters: vi.fn(),
  syncAllWeapons: vi.fn(),
}));

vi.mock('../../../utils/avatarAssetPaths.js', () => ({
  buildWikiAssetProxyPath: vi.fn(() => null),
}));

vi.mock('../../../utils/characterUtils.js', () => ({
  characterCache: {
    refresh: vi.fn(),
  },
}));

vi.mock('../../supabaseRequest.js', () => ({
  executeSupabaseRead: vi.fn(),
}));

vi.mock('../../../utils/appLogger.js', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  buildManualPlaceholderLookup,
  resolveSyncCanonicalId,
} from '../characterService.js';

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
