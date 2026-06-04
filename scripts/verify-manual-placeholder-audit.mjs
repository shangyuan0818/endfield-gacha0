import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { parseArgs as parseSupabaseAuditArgs } from './audit-canonical-data-supabase.mjs';
import { buildManualPlaceholderRetirementReport } from './lib/manualPlaceholderAudit.mjs';

const report = buildManualPlaceholderRetirementReport({
  characters: [
    { id: 'char_manual_alpha_abc123', name: '阿尔法', type: 'character' },
    { id: 'weapon_manual_beta_def456', name: '贝塔武器', type: 'weapon' },
    { id: 'char_manual_conflict_ghi789', name: '冲突角色', type: 'character' },
    { id: 'char_alpha', name: '阿尔法', type: 'character' },
    { id: 'char_alpha_alt', name: '阿尔法别名', type: 'character' },
  ],
  pools: [
    {
      pool_id: 'special_manual_limited_alpha_20260605_abc123',
      name: '阿尔法寻访',
      type: 'limited',
      featured_characters: ['char_manual_alpha_abc123'],
    },
    {
      pool_id: 'joint_manual_extra_beta_20260612_def456',
      name: '贝塔联合寻访',
      type: 'extra',
      featured_characters: [],
    },
    {
      pool_id: 'special_1001',
      name: '官方阿尔法寻访',
      type: 'limited',
      featured_characters: ['char_alpha'],
    },
  ],
  characterAliasRows: [
    {
      source: 'internal',
      alias_id: 'char_manual_alpha_abc123',
      character_id: 'char_manual_alpha_abc123',
      is_primary: true,
    },
    {
      source: 'manual_placeholder',
      alias_id: 'char_manual_alpha_abc123',
      character_id: 'char_alpha',
      is_primary: false,
    },
    {
      source: 'internal',
      alias_id: 'weapon_manual_beta_def456',
      character_id: 'weapon_manual_beta_def456',
      is_primary: true,
    },
    {
      source: 'manual_placeholder',
      alias_id: 'char_manual_conflict_ghi789',
      character_id: 'char_alpha',
      is_primary: false,
    },
    {
      source: 'wiki',
      alias_id: 'char_manual_conflict_ghi789',
      character_id: 'char_alpha_alt',
      is_primary: false,
    },
  ],
  poolAliasRows: [
    {
      source: 'internal',
      alias_id: 'special_manual_limited_alpha_20260605_abc123',
      pool_id: 'special_manual_limited_alpha_20260605_abc123',
      is_primary: true,
    },
    {
      source: 'manual_placeholder',
      alias_id: 'special_manual_limited_alpha_20260605_abc123',
      pool_id: 'special_1001',
      is_primary: false,
    },
  ],
  historyRows: [
    {
      pool_id: 'special_manual_limited_alpha_20260605_abc123',
      character_id: 'char_manual_alpha_abc123',
    },
    {
      pool_id: 'joint_manual_extra_beta_20260612_def456',
      character_id: 'weapon_manual_beta_def456',
    },
  ],
  poolCharacterRows: [
    {
      pool_id: 'special_manual_limited_alpha_20260605_abc123',
      character_id: 'char_manual_alpha_abc123',
    },
    {
      pool_id: 'joint_manual_extra_beta_20260612_def456',
      character_id: 'weapon_manual_beta_def456',
    },
  ],
});

const overrideReport = buildManualPlaceholderRetirementReport({
  characters: [
    { id: 'char_manual_override_abc123', name: '覆盖角色', type: 'character' },
  ],
  pools: [
    {
      pool_id: 'special_manual_override_20260605_abc123',
      name: '覆盖卡池',
      type: 'limited',
      featured_characters: ['char_manual_override_abc123'],
    },
  ],
  characterAliasRows: [
    {
      source: 'internal',
      alias_id: 'char_manual_override_abc123',
      character_id: 'char_manual_override_abc123',
      is_primary: true,
    },
  ],
  poolAliasRows: [
    {
      source: 'internal',
      alias_id: 'special_manual_override_20260605_abc123',
      pool_id: 'special_manual_override_20260605_abc123',
      is_primary: true,
    },
  ],
  historyRows: [
    {
      pool_id: 'special_manual_override_20260605_abc123',
      character_id: 'char_manual_override_abc123',
    },
  ],
  referenceCountOverrides: {
    characters: {
      char_manual_override_abc123: {
        historyRows: 7,
      },
    },
    pools: {
      special_manual_override_20260605_abc123: {
        historyRows: 11,
      },
    },
  },
});

assert.equal(overrideReport.summary.historyCharacterManualReferenceCount, 7);
assert.equal(overrideReport.summary.historyPoolManualReferenceCount, 11);
assert.equal(
  overrideReport.characters.find(item => item.id === 'char_manual_override_abc123')?.references.historyRows,
  7
);
assert.equal(
  overrideReport.pools.find(item => item.id === 'special_manual_override_20260605_abc123')?.references.historyRows,
  11
);

assert.equal(report.summary.characterPlaceholderCount, 3);
assert.equal(report.summary.poolPlaceholderCount, 2);
assert.equal(report.summary.readyCharacterMergeCount, 1);
assert.equal(report.summary.readyPoolMergeCount, 1);
assert.equal(report.summary.characterNeedsOfficialIdCount, 1);
assert.equal(report.summary.poolNeedsOfficialIdCount, 1);
assert.equal(report.summary.characterAliasConflictCount, 1);
assert.equal(report.summary.poolAliasConflictCount, 0);
assert.equal(report.summary.historyCharacterManualReferenceCount, 2);
assert.equal(report.summary.historyPoolManualReferenceCount, 2);
assert.equal(report.summary.poolCharacterManualCharacterReferenceCount, 2);
assert.equal(report.summary.poolCharacterManualPoolReferenceCount, 2);
assert.equal(report.summary.featuredCharacterManualReferenceCount, 1);

const readyCharacter = report.characters.find(item => item.id === 'char_manual_alpha_abc123');
assert.equal(readyCharacter.state, 'ready_to_merge');
assert.deepEqual(readyCharacter.alias.canonicalTargetIds, ['char_alpha']);
assert.equal(readyCharacter.references.historyRows, 1);
assert.equal(readyCharacter.references.poolCharacterRows, 1);
assert.equal(readyCharacter.references.featuredCharacterEntries, 1);

const missingCharacter = report.characters.find(item => item.id === 'weapon_manual_beta_def456');
assert.equal(missingCharacter.state, 'needs_official_id');
assert.equal(missingCharacter.alias.hasInternalSelfAlias, true);

const conflictingCharacter = report.characters.find(item => item.id === 'char_manual_conflict_ghi789');
assert.equal(conflictingCharacter.state, 'conflicting_alias_targets');
assert.deepEqual(conflictingCharacter.alias.canonicalTargetIds, ['char_alpha', 'char_alpha_alt']);

const readyPool = report.pools.find(item => item.id === 'special_manual_limited_alpha_20260605_abc123');
assert.equal(readyPool.state, 'ready_to_merge');
assert.deepEqual(readyPool.alias.canonicalTargetIds, ['special_1001']);
assert.equal(readyPool.references.historyRows, 1);
assert.equal(readyPool.references.poolCharacterRows, 1);

const missingPool = report.pools.find(item => item.id === 'joint_manual_extra_beta_20260612_def456');
assert.equal(missingPool.state, 'needs_official_id');
assert.equal(missingPool.alias.hasInternalSelfAlias, false);

assert.deepEqual(
  parseSupabaseAuditArgs(['supabase/manual/data-backfill/manual-placeholder-audit.json']),
  {
    supabaseUrl: null,
    supabaseKey: null,
    pageSize: 1000,
    writeJson: 'supabase/manual/data-backfill/manual-placeholder-audit.json',
  },
  'Supabase audit should treat a positional .json argument as --write-json output for npm compatibility'
);

assert.deepEqual(
  parseSupabaseAuditArgs([
    '--supabase-url',
    'https://db.example.test',
    '--write-json',
    'custom.json',
  ]),
  {
    supabaseUrl: 'https://db.example.test',
    supabaseKey: null,
    pageSize: 1000,
    writeJson: 'custom.json',
  },
  'Explicit --write-json should keep priority over positional compatibility'
);

const jointPoolFixSql = await fs.readFile(
  path.join(process.cwd(), 'supabase', 'migrations', '122_fix_joint_pool_featured_character_refs.sql'),
  'utf8'
);
assert.match(jointPoolFixSql, /v_pool_id TEXT := 'joint_1_2_2'/);
assert.match(jointPoolFixSql, /'chr_0016_laevat', 'char_levantin'/);
assert.match(jointPoolFixSql, /'chr_0013_aglina', 'char_jerpeta'/);
assert.match(jointPoolFixSql, /'chr_0025_ardelia', 'char_eldelra'/);
assert.match(jointPoolFixSql, /'chr_0029_pograni', 'char_junwei'/);
assert.match(jointPoolFixSql, /featured_characters = v_featured_refs/);
assert.match(jointPoolFixSql, /INSERT INTO public\.pool_characters/);
assert.doesNotMatch(
  jointPoolFixSql,
  /featured_characters\s*=\s*ARRAY\['[^']*莱万汀/,
  'joint pool fix must not write display names back into featured_characters'
);

console.log('DATA-NEW-017 manual placeholder audit verification passed');
