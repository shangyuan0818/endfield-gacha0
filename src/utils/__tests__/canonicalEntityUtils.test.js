import { describe, expect, it } from 'vitest';

import {
  buildManualCharacterId,
  buildManualPoolId,
  classifyCharacterIdSource,
  classifyPoolIdSource,
  isGeneratedManualCharacterId,
} from '../canonicalEntityUtils.js';

describe('canonicalEntityUtils manual id helpers', () => {
  it('creates official-like manual character and weapon ids while accepting legacy ids', () => {
    const characterId = buildManualCharacterId('测试干员', 'character');
    const weaponId = buildManualCharacterId('测试武器', 'weapon');

    expect(characterId).toMatch(/^char_manual_/);
    expect(weaponId).toMatch(/^weapon_manual_/);
    expect(isGeneratedManualCharacterId(characterId)).toBe(true);
    expect(isGeneratedManualCharacterId(weaponId)).toBe(true);
    expect(isGeneratedManualCharacterId('manual_character_test_abcdef')).toBe(true);
    expect(isGeneratedManualCharacterId('manual_weapon_test_abcdef')).toBe(true);
    expect(classifyCharacterIdSource(characterId)).toBe('manual_placeholder');
    expect(classifyCharacterIdSource(weaponId)).toBe('manual_placeholder');
  });

  it('classifies wiki asset ids as seeded and numeric import ids as raw aliases', () => {
    expect(classifyCharacterIdSource('chr_0020_meurs')).toBe('seeded');
    expect(classifyCharacterIdSource('wpn_sword_0017')).toBe('seeded');
    expect(classifyCharacterIdSource('45')).toBe('source_raw');
  });

  it('creates official-like manual pool ids without classifying them as official ids', () => {
    const limitedPoolId = buildManualPoolId({
      type: 'limited',
      name: '测试限定池',
      upCharacter: '测试干员',
      startTime: '2026-06-05T12:00:00.000Z',
      endTime: '2026-06-26T12:00:00.000Z',
    });
    const extraPoolId = buildManualPoolId({
      type: 'extra',
      name: '测试附加寻访',
      upCharacter: '测试干员',
      startTime: '2026-06-05T12:00:00.000Z',
      endTime: '2026-06-26T12:00:00.000Z',
    });
    const weaponPoolId = buildManualPoolId({
      type: 'weapon',
      name: '测试武器池',
      upCharacter: '测试武器',
      startTime: '2026-06-05T12:00:00.000Z',
      endTime: '2026-06-26T12:00:00.000Z',
    });

    expect(limitedPoolId).toMatch(/^special_manual_limited_/);
    expect(extraPoolId).toMatch(/^joint_manual_extra_/);
    expect(weaponPoolId).toMatch(/^weaponbox_manual_weapon_/);
    expect(classifyPoolIdSource(limitedPoolId)).toBe('manual_placeholder');
    expect(classifyPoolIdSource(extraPoolId)).toBe('manual_placeholder');
    expect(classifyPoolIdSource(weaponPoolId)).toBe('manual_placeholder');
    expect(classifyPoolIdSource('special_123')).toBe('official');
    expect(classifyPoolIdSource('joint_123')).toBe('official');
  });
});
