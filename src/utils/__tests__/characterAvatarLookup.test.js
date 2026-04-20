import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { characterCache, getCharacterAvatarUrl, resolveCharacterRecordByName } from '../characterUtils.js';

describe('character avatar lookup helpers', () => {
  beforeEach(() => {
    characterCache.clear();
    characterCache.applyCharacters([
      {
        id: 'char_jet',
        name: 'J.E.T.',
        avatar_url: '/avatars/jet.png',
        rarity: 6,
        type: 'weapon',
        aliases: ['JET'],
        is_limited: false,
      },
    ]);
  });

  afterEach(() => {
    characterCache.clear();
  });

  it('resolves avatar by alias-like compact name', () => {
    expect(getCharacterAvatarUrl('JET')).toBe('/avatars/jet.png');
  });

  it('resolves record by punctuation-insensitive normalized name', () => {
    expect(resolveCharacterRecordByName('J E T')).toMatchObject({
      id: 'char_jet',
      avatar_url: '/avatars/jet.png',
    });
  });

  it('resolves avatar by character id', () => {
    expect(getCharacterAvatarUrl('char_jet')).toBe('/avatars/jet.png');
  });
});
