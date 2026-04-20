import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { characterCache } from '../characterUtils.js';
import { getPoolFeaturedLead, getPoolFeaturedNames } from '../poolFeaturedResolver.js';

describe('poolFeaturedResolver', () => {
  beforeEach(() => {
    characterCache.clear();
  });

  afterEach(() => {
    characterCache.clear();
  });

  it('prefers resolved roster up entries over explicit featured list', () => {
    const pool = {
      up_character: '旧名单A',
      featured_characters: ['旧名单A', '旧名单B'],
      resolved_roster: {
        up: [
          { name: '莱万汀' },
          { name: '洁尔佩塔' },
          { name: '艾尔黛拉' },
          { name: '骏卫' },
        ],
      },
    };

    expect(getPoolFeaturedNames(pool)).toEqual(['莱万汀', '洁尔佩塔', '艾尔黛拉', '骏卫']);
    expect(getPoolFeaturedLead(pool)).toBe('莱万汀');
  });

  it('falls back to explicit featured list and preserves single up as lead', () => {
    const pool = {
      up_character: '莱万汀',
      featured_characters: ['莱万汀', '洁尔佩塔'],
    };

    expect(getPoolFeaturedNames(pool)).toEqual(['莱万汀', '洁尔佩塔']);
    expect(getPoolFeaturedLead(pool)).toBe('莱万汀');
  });

  it('falls back to pool name when no featured names exist', () => {
    expect(getPoolFeaturedLead({ name: '未命名卡池' })).toBe('未命名卡池');
  });

  it('canonicalizes character ids from unified featured sources', () => {
    characterCache.applyCharacters([
      {
        id: 'chr_0027_tangtang',
        name: '汤汤',
        avatar_url: '/avatars/tangtang.png',
        rarity: 6,
        type: 'character',
        aliases: ['Tangtang'],
        is_limited: true,
      },
    ]);

    const pool = {
      up_character: 'chr_0027_tangtang',
      featured_characters: ['chr_0027_tangtang'],
    };

    expect(getPoolFeaturedNames(pool)).toEqual(['汤汤']);
    expect(getPoolFeaturedLead(pool)).toBe('汤汤');
  });
});
